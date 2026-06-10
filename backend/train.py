#!/usr/bin/env python3

"""
IMPROVED PROVINCIAL TRAINING PIPELINE
Prophet + LightGBM Ensemble

Improvements:
- Better gap accuracy
- Better demand signal detection
- No feature leakage
- Better overfitting detection
- Better frontend dashboard signals
- Keeps SAME output artifacts / structure
"""

import json
import joblib
import warnings

import numpy as np
import pandas as pd

from pathlib import Path

from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    accuracy_score,
    f1_score,
    recall_score,
    roc_auc_score,
    confusion_matrix,
)

from sklearn.calibration import CalibratedClassifierCV
from sklearn.preprocessing import StandardScaler, RobustScaler

from prophet import Prophet
import lightgbm as lgb

from preprocess import load_data, aggregate_monthly


# ─────────────────────────────────────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────────────────────────────────────

MODELS_DIR = Path(__file__).parent / "models" / "provincial"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

LOOKBACK = 6


# ─────────────────────────────────────────────────────────────────────────────
# REGRESSORS
# ─────────────────────────────────────────────────────────────────────────────

FIXED_REGRESSORS = [

    # ── Administrative / calendar events ──────────────────────────────
    "n_stat",
    "n_holidays",
    "n_ccb",
    "n_cpp",
    "n_oas",

    "n_school",
    "n_exam",
    "n_intl",

    "n_nldb",
    "n_covid",

    # ── Macro / cost-of-living signals ────────────────────────────────
    "CPI_All_items",
    "CPI_Food",
    "CPI_Shelter",

    "Net_Migration",

    # ── Social-assistance caseload ────────────────────────────────────
    "AISH_TOTAL",
    "SINGLE_AISH_TOTAL",
    "SINGLE_AISH_PARENT",

    "EDMONTON_AISH_CASELOAD",

    # ── Climate ───────────────────────────────────────────────────────
    "Mean_Temp",

    # NOTE: lag-derived / engineered signals (net_3mo_avg, momentum,
    # deficit_streak, pressure_index, etc.) are intentionally excluded
    # from Prophet regressors.  They are already captured by the
    # LightGBM lag-feature block and adding them to Prophet both
    # duplicates information and risks subtle look-ahead leakage when
    # the Prophet future frame is constructed.
]


# ─────────────────────────────────────────────────────────────────────────────
# FEATURE NAMES
# ─────────────────────────────────────────────────────────────────────────────

LAG_FEATURE_NAMES = (

    [f"LBS_In_lag{i+1}" for i in range(LOOKBACK)] +

    [f"LBS_Out_lag{i+1}" for i in range(LOOKBACK)] +

    [f"net_lag{i+1}" for i in range(LOOKBACK)] +

    [

        "net_3mo_avg",
        "net_6mo_avg",

        "net_3mo_std",
        "net_6mo_std",

        "in_momentum",
        "out_momentum",

        "net_delta",
        "net_acceleration",

        "demand_supply_ratio",

        "deficit_streak",

        "month_sin",
        "month_cos",

        "pressure_index",

        "forecast_uncertainty",
    ]
)


# ─────────────────────────────────────────────────────────────────────────────
# PROPHET HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _fit_prophet(
    data: pd.DataFrame,
    top_features: list,
    target_col: str,
) -> Prophet:

    df_p = data[["Date"]].copy().rename(
        columns={"Date": "ds"}
    )

    df_p["y"] = data[target_col].values

    for col in top_features:

        if col in data.columns:
            df_p[col] = data[col].values

    model = Prophet(

        interval_width=0.80,

        yearly_seasonality=True,
        weekly_seasonality=False,
        daily_seasonality=False,

        seasonality_prior_scale=0.01,
        seasonality_mode="additive",

        changepoint_prior_scale=0.001,
    )

    for col in top_features:

        if col in data.columns:

            model.add_regressor(
                col,
                prior_scale=0.02,
                mode="additive",
            )

    with warnings.catch_warnings():

        warnings.simplefilter("ignore")

        model.fit(df_p)

    return model


def _prophet_predict(
    model: Prophet,
    data: pd.DataFrame,
    top_features: list,
) -> pd.DataFrame:

    df_p = data[["Date"]].rename(
        columns={"Date": "ds"}
    )

    for col in top_features:

        if col in data.columns:
            df_p[col] = data[col].values

    return model.predict(df_p)


# ─────────────────────────────────────────────────────────────────────────────
# FEATURE ENGINEERING
# ─────────────────────────────────────────────────────────────────────────────

def _create_lag_features(
    data: pd.DataFrame,
    target_col: str,
):

    lbs_in = data["LBS_In"].values
    lbs_out = data["LBS_Out"].values
    net = data["net"].values

    X = []
    y = []
    dates = []

    for i in range(LOOKBACK, len(data)):

        lag_block = np.concatenate([

            lbs_in[i - LOOKBACK:i],

            lbs_out[i - LOOKBACK:i],

            net[i - LOOKBACK:i],
        ])

        engineered = np.array([

            data["net_3mo_avg"].iloc[i],
            data["net_6mo_avg"].iloc[i],

            data["net_3mo_std"].iloc[i],
            data["net_6mo_std"].iloc[i],

            data["in_momentum"].iloc[i],
            data["out_momentum"].iloc[i],

            data["net_delta"].iloc[i],
            data["net_acceleration"].iloc[i],

            data["demand_supply_ratio"].iloc[i],

            data["deficit_streak"].iloc[i],

            data["month_sin"].iloc[i],
            data["month_cos"].iloc[i],

            data["pressure_index"].iloc[i],

            data["forecast_uncertainty"].iloc[i],
        ])

        features = np.concatenate([
            lag_block,
            engineered,
        ])

        X.append(features)

        y.append(
            data[target_col].iloc[i]
        )

        dates.append(
            data["Date"].iloc[i]
        )

    # Convert features to a DataFrame so LightGBM recognizes feature names natively
    df_X = pd.DataFrame(X, columns=LAG_FEATURE_NAMES)

    return (
        df_X,
        np.array(y),
        pd.to_datetime(dates)
    )


# ─────────────────────────────────────────────────────────────────────────────
# METRICS
# ─────────────────────────────────────────────────────────────────────────────

def _regression_metrics(preds, actual):

    mae = float(
        mean_absolute_error(actual, preds)
    )

    rmse = float(
        np.sqrt(mean_squared_error(actual, preds))
    )

    ss_res = np.sum(
        (actual - preds) ** 2
    )

    ss_tot = np.sum(
        (actual - actual.mean()) ** 2
    )

    r2 = float(
        1.0 - ss_res / (ss_tot + 1e-12)
    )

    nz = actual > 0

    rel = (

        float(

            np.mean(

                np.abs(actual[nz] - preds[nz]) /

                actual[nz]

            ) * 100

        )

        if nz.any()

        else 0.0
    )

    smape = float(

        np.mean(

            2 * np.abs(actual - preds) /

            (
                np.abs(actual) +
                np.abs(preds) +
                1e-8
            )

        ) * 100
    )

    return {

        "mae": round(mae, 0),

        "rmse": round(rmse, 0),

        "r2": round(r2, 4),

        "smape": round(smape, 1),

        "rel_mae_pct": round(rel, 1),

        "mean_actual": round(float(actual.mean()), 0),

        "n_test": int(len(actual)),

        "granularity": "monthly",
    }


# ─────────────────────────────────────────────────────────────────────────────
# GAP STATS
# ─────────────────────────────────────────────────────────────────────────────

def _gap_stats(df: pd.DataFrame):

    gap = df["LBS_In"] - df["LBS_Out"]

    return {

        "mean_gap": round(float(gap.mean()), 0),

        "std_gap": round(float(gap.std()), 0),

        "min_gap": round(float(gap.min()), 0),

        "max_gap": round(float(gap.max()), 0),

        "pct_deficit": round(
            float((gap < 0).mean() * 100),
            1
        ),

        "warn_threshold": round(
            float(gap.mean() - gap.std()),
            0
        ),

        "critical_threshold": round(
            float(gap.mean() - 2 * gap.std()),
            0
        ),
    }


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

def main():

    print("=" * 64)
    print("IMPROVED PROVINCIAL TRAINING PIPELINE")
    print("=" * 64)

    # ─────────────────────────────────────────────────────────────────────
    # LOAD DATA
    # ─────────────────────────────────────────────────────────────────────

    print("\n[1/5] Loading monthly data...")

    monthly = aggregate_monthly(load_data())

    monthly["net"] = (
        monthly["LBS_In"] - monthly["LBS_Out"]
    )

    monthly["gap_binary"] = (
        monthly["net"] < 0
    ).astype(int)

    # ─────────────────────────────────────────────────────────────────────
    # FEATURE ENGINEERING
    # IMPORTANT: ALL FEATURES SHIFTED TO PREVENT LEAKAGE
    # ─────────────────────────────────────────────────────────────────────

    monthly["net_3mo_avg"] = (

        monthly["net"]

        .shift(1)

        .rolling(3, min_periods=1)

        .mean()
    )

    monthly["net_6mo_avg"] = (

        monthly["net"]

        .shift(1)

        .rolling(6, min_periods=1)

        .mean()
    )

    monthly["net_3mo_std"] = (

        monthly["net"]

        .shift(1)

        .rolling(3, min_periods=1)

        .std()

        .fillna(0)
    )

    monthly["net_6mo_std"] = (

        monthly["net"]

        .shift(1)

        .rolling(6, min_periods=1)

        .std()

        .fillna(0)
    )

    monthly["in_momentum"] = (

        monthly["LBS_In"]

        .pct_change()

        .shift(1)

        .fillna(0)
    )

    monthly["out_momentum"] = (

        monthly["LBS_Out"]

        .pct_change()

        .shift(1)

        .fillna(0)
    )

    monthly["net_delta"] = (

        monthly["net"]

        .diff()

        .shift(1)

        .fillna(0)
    )

    monthly["net_acceleration"] = (

        monthly["net_delta"]

        .diff()

        .shift(1)

        .fillna(0)
    )

    monthly["demand_supply_ratio"] = (

        (

            monthly["LBS_Out"] /

            (monthly["LBS_In"] + 1)

        )

        .shift(1)

        .fillna(1)
    )

    # Deficit streak: how many consecutive prior months were in deficit.
    # Correct vectorised implementation — shifts once for lag-safety.
    _gap_shifted = monthly["gap_binary"].shift(1).fillna(0).astype(int)
    _streak, _cnt = [], 0
    for _g in _gap_shifted:
        _cnt = (_cnt + 1) if _g == 1 else 0
        _streak.append(_cnt)
    monthly["deficit_streak"] = _streak

    month_num = monthly["Date"].dt.month

    monthly["month_sin"] = np.sin(
        2 * np.pi * month_num / 12
    )

    monthly["month_cos"] = np.cos(
        2 * np.pi * month_num / 12
    )

    monthly["pressure_index"] = (

        (

            0.35 * monthly["demand_supply_ratio"] +

            0.25 * monthly["out_momentum"].clip(-1, 1) +

            0.20 * (
                monthly["CPI_Food"] /
                monthly["CPI_Food"].mean()
            ) +

            0.20 * (
                monthly["Net_Migration"] /
                monthly["Net_Migration"].mean()
            )

        )

        .shift(1)

        .fillna(0)
    )

    monthly["forecast_uncertainty"] = (

        (

            monthly["net_6mo_std"] /

            (
                monthly["net_6mo_avg"].abs() + 1
            )

        )

        .shift(1)

        .fillna(0)
    )

    monthly = monthly.fillna(0)

    top_features = [

        c for c in FIXED_REGRESSORS

        if c in monthly.columns
    ]

    print(
        f"  Monthly rows : {len(monthly)}"
    )

    print(

        f"  Date range   : "

        f"{monthly['Date'].min().strftime('%b %Y')} → "

        f"{monthly['Date'].max().strftime('%b %Y')}"
    )

    print(

        f"  Gap rate     : "

        f"{monthly['gap_binary'].mean():.1%}"
    )

    print(
        f"  Regressors   : {len(top_features)}"
    )

    # ─────────────────────────────────────────────────────────────────────
    # BUILD FEATURES
    # ─────────────────────────────────────────────────────────────────────

    X_all, y_all, dates_all = _create_lag_features(
        monthly,
        "gap_binary"
    )

    split_idx = int(len(X_all) * 0.75)

    X_train = X_all.iloc[:split_idx]
    X_val = X_all.iloc[split_idx:]

    y_train = y_all[:split_idx]
    y_val = y_all[split_idx:]

    dates_train = dates_all[:split_idx]
    dates_val = dates_all[split_idx:]

    def _slice(dates):

        idx = [

            monthly.index[
                monthly["Date"] == d
            ][0]

            for d in dates
        ]

        return monthly.loc[idx].copy()

    train_months = _slice(dates_train)
    val_months = _slice(dates_val)

    first_val_date = dates_val[0]

    train_all_months = monthly[
        monthly["Date"] < first_val_date
    ].copy()

    print(

        f"  Prophet train : "

        f"{len(train_all_months)} months"
    )

    print(

        f"  LGBM train    : "

        f"{len(y_train)} rows"
    )

    print(

        f"  Validation    : "

        f"{len(y_val)} rows"
    )

    # ─────────────────────────────────────────────────────────────────────
    # PROPHET
    # ─────────────────────────────────────────────────────────────────────

    print("\n[2/5] Training Prophet...")

    prophet_net = _fit_prophet(
        train_all_months,
        top_features,
        "net"
    )

    prophet_in = _fit_prophet(
        train_all_months,
        top_features,
        "LBS_In"
    )

    prophet_out = _fit_prophet(
        train_all_months,
        top_features,
        "LBS_Out"
    )

    val_fcst_net = _prophet_predict(
        prophet_net,
        val_months,
        top_features
    )

    val_fcst_in = _prophet_predict(
        prophet_in,
        val_months,
        top_features
    )

    val_fcst_out = _prophet_predict(
        prophet_out,
        val_months,
        top_features
    )

    lbs_in_val_pred = np.maximum(
        val_fcst_in["yhat"].values,
        0
    )

    lbs_out_val_pred = np.maximum(
        val_fcst_out["yhat"].values,
        0
    )

    m_in = _regression_metrics(
        lbs_in_val_pred,
        val_months["LBS_In"].values
    )

    m_out = _regression_metrics(
        lbs_out_val_pred,
        val_months["LBS_Out"].values
    )

    print(

        f"  LBS_In  "

        f"R²={m_in['r2']:+.4f}  "

        f"sMAPE={m_in['smape']:.1f}%  "

        f"RelMAE={m_in['rel_mae_pct']:.1f}%"
    )

    print(

        f"  LBS_Out "

        f"R²={m_out['r2']:+.4f}  "

        f"sMAPE={m_out['smape']:.1f}%  "

        f"RelMAE={m_out['rel_mae_pct']:.1f}%"
    )

    # ─────────────────────────────────────────────────────────────────────
    # GAP PROBABILITY
    # ─────────────────────────────────────────────────────────────────────

    train_net_std = float(
        np.std(train_all_months["net"])
    )

    dynamic_scale = (
        train_net_std if train_net_std > 0 else 30000.0
    )

    prophet_gap_prob = 1.0 / (

        1.0 +

        np.exp(

            val_fcst_net["yhat"].values /

            dynamic_scale
        )
    )

    # ─────────────────────────────────────────────────────────────────────
    # LIGHTGBM
    # ─────────────────────────────────────────────────────────────────────

    print("\n[3/5] Training LightGBM...")

    # Upweight the minority gap class so the model is penalised more
    # for missing real deficits (false negatives).
    gap_rate = y_train.mean()
    gap_weight = (1.0 - gap_rate) / (gap_rate + 1e-9)   # inverse-frequency
    gap_weight = float(np.clip(gap_weight, 1.5, 5.0))   # guard against extremes
    sample_weights = np.where(y_train == 1, gap_weight, 1.0)

    lgbm = lgb.LGBMClassifier(

        n_estimators=200,

        learning_rate=0.02,

        max_depth=4,

        num_leaves=10,

        min_data_in_leaf=6,

        lambda_l2=8.0,

        lambda_l1=2.0,

        subsample=0.75,

        colsample_bytree=0.75,

        min_gain_to_split=0.01,

        # inverse-frequency class weight baked into the model
        scale_pos_weight=gap_weight,

        random_state=42,

        verbose=-1,
    )

    lgbm.fit(

        X_train,
        y_train,

        sample_weight=sample_weights,

        eval_set=[(X_val, y_val)],

        eval_metric="auc",

        callbacks=[

            lgb.early_stopping(
                20,
                verbose=False
            ),

            lgb.log_evaluation(period=0),
        ]
    )

    print("  ✓ LightGBM fitted")

    # ─────────────────────────────────────────────────────────────────────
    # CALIBRATION
    # ─────────────────────────────────────────────────────────────────────

    calibrated_lgbm = CalibratedClassifierCV(

        lgbm,

        method="sigmoid",

        cv=3
    )

    calibrated_lgbm.fit(
        X_train,
        y_train
    )

    lgbm_train_proba = (

        calibrated_lgbm

        .predict_proba(X_train)[:, 1]
    )

    lgbm_val_proba = (

        calibrated_lgbm

        .predict_proba(X_val)[:, 1]
    )

    print("  ✓ Probabilities calibrated")

    # ─────────────────────────────────────────────────────────────────────
    # ENSEMBLE
    # ─────────────────────────────────────────────────────────────────────

    print("\n[4/5] Optimising ensemble...")

    prophet_train_proba = 1.0 / (

        1.0 +

        np.exp(

            _prophet_predict(
                prophet_net,
                train_months,
                top_features
            )["yhat"].values /

            dynamic_scale
        )
    )

    best_weight = 0.5
    best_threshold = 0.5
    best_score = -1

    for w in np.linspace(0.1, 0.9, 9):

        val_proba = (

            w * prophet_gap_prob +

            (1.0 - w) * lgbm_val_proba
        )

        thresholds = np.arange(
            0.30,
            0.71,
            0.02
        )

        for t in thresholds:

            pred = (
                val_proba > t
            ).astype(int)

            # F-beta (β=2) weights recall twice as heavily as precision
            # so the search favours catching real gaps over avoiding false alarms.
            f1  = f1_score(y_val, pred, zero_division=0)
            rec = recall_score(y_val, pred, zero_division=0)
            prec = f1 / (2 * rec - f1 + 1e-9) if rec > 0 else 0.0
            beta = 2.0
            score = (
                (1 + beta**2) * prec * rec /
                (beta**2 * prec + rec + 1e-9)
            )

            if score > best_score:

                best_score = score

                best_weight = float(w)

                best_threshold = float(t)

    print(

        f"  ✓ Best Prophet Weight : "

        f"{best_weight:.0%}"
    )

    print(

        f"  ✓ Best Threshold      : "

        f"{best_threshold:.2f}"
    )

    ensemble_train_proba = (

        best_weight * prophet_train_proba +

        (1.0 - best_weight) *
        lgbm_train_proba
    )

    ensemble_val_proba = (

        best_weight * prophet_gap_prob +

        (1.0 - best_weight) *
        lgbm_val_proba
    )

    train_pred = (
        ensemble_train_proba >
        best_threshold
    ).astype(int)

    val_pred = (
        ensemble_val_proba >
        best_threshold
    ).astype(int)

    train_acc = accuracy_score(
        y_train,
        train_pred
    )

    val_acc = accuracy_score(
        y_val,
        val_pred
    )

    train_f1 = f1_score(
        y_train,
        train_pred,
        zero_division=0
    )

    val_f1 = f1_score(
        y_val,
        val_pred,
        zero_division=0
    )

    val_recall = recall_score(y_val, val_pred, zero_division=0)

    auc = roc_auc_score(
        y_val,
        ensemble_val_proba
    )

    cm = confusion_matrix(
        y_val,
        val_pred
    )

    # ─────────────────────────────────────────────────────────────────────
    # OVERFITTING
    # ─────────────────────────────────────────────────────────────────────

    print("\n[5/5] Overfitting analysis & Saving Models...")

    generalisation_gap = (

        abs(train_acc - val_acc) +

        abs(train_f1 - val_f1)

    ) / 2

    if generalisation_gap > 0.15:

        overfit_label = "SEVERE OVERFITTING"

    elif generalisation_gap > 0.07:

        overfit_label = "MILD OVERFITTING"

    else:

        overfit_label = "GOOD GENERALISATION"

    print("\n" + "=" * 64)
    print("OVERFITTING REPORT")
    print("=" * 64)

    print(f"Status: {overfit_label}")

    print(

        f"Accuracy  "

        f"train={train_acc:.1%} "

        f"val={val_acc:.1%} "
    )

    print(

        f"F1        "

        f"train={train_f1:.3f} "

        f"val={val_f1:.3f}"
    )

    print(f"AUC       {auc:.3f}")

    print(f"Gap Recall (val): {val_recall:.1%}")

    print(
        f"Generalisation Gap: "
        f"{generalisation_gap:.3f}"
    )

    print(

        f"Confusion Matrix: "

        f"TN={cm[0,0]} "

        f"FP={cm[0,1]} "

        f"FN={cm[1,0]} "

        f"TP={cm[1,1]}"
    )

    # ─────────────────────────────────────────────────────────────────────
    # SAVE ARTIFACTS
    # ─────────────────────────────────────────────────────────────────────

    hist_df = monthly[["Date"]].copy()

    hist_df["pressure_index"] = (
        monthly["pressure_index"]
    )

    hist_df["forecast_uncertainty"] = (
        monthly["forecast_uncertainty"]
    )

    hist_df["demand_supply_ratio"] = (
        monthly["demand_supply_ratio"]
    )

    hist_df["deficit_streak"] = (
        monthly["deficit_streak"]
    )

    hist_df.to_csv(
        MODELS_DIR / "history_predictions.csv",
        index=False
    )

    gap_stats = _gap_stats(monthly)

    with open(
        MODELS_DIR / "gap_stats.json",
        "w"
    ) as f:

        json.dump(
            gap_stats,
            f,
            indent=2
        )

    # --- ADDED CODE: Save All Required Backend Artifacts ---
    
    # 1. Models
    joblib.dump(calibrated_lgbm, MODELS_DIR / "lgbm_model.pkl")
    joblib.dump(prophet_in, MODELS_DIR / "prophet_lbs_in.pkl")
    joblib.dump(prophet_out, MODELS_DIR / "prophet_lbs_out.pkl")
    joblib.dump(prophet_net, MODELS_DIR / "prophet_net.pkl")

    # 2. Config & Features
    forecast_config = {
        "lookback": LOOKBACK,
        "best_weight": float(best_weight),
        "best_threshold": float(best_threshold),
        "dynamic_scale": float(dynamic_scale),
        "prophet_regressors": FIXED_REGRESSORS,
        "lgbm_features": LAG_FEATURE_NAMES
    }
    with open(MODELS_DIR / "forecast_config.json", "w") as f:
        json.dump(forecast_config, f, indent=2)

    with open(MODELS_DIR / "feature_cols.json", "w") as f:
        json.dump({"features": LAG_FEATURE_NAMES}, f, indent=2)

    # 3. Metrics
    metrics = {
        "in": m_in,
        "out": m_out,
        "ensemble": {
            "train_acc": float(train_acc),
            "val_acc": float(val_acc),
            "train_f1": float(train_f1),
            "val_f1": float(val_f1),
            "val_recall": float(val_recall),
            "auc": float(auc)
        }
    }
    with open(MODELS_DIR / "metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)

    # 4. Importances (Using empty dicts since Prophet doesn't use standard feature importances)
    with open(MODELS_DIR / "importance_lbs_in.json", "w") as f:
        json.dump({}, f)
    with open(MODELS_DIR / "importance_lbs_out.json", "w") as f:
        json.dump({}, f)

    # 5. Scalers (Fitted on dataframe to preserve shape & feature names)
    robust_scaler = RobustScaler().fit(X_all)
    production_scaler = StandardScaler().fit(X_all)
    joblib.dump(robust_scaler, MODELS_DIR / "robust_scaler.pkl")
    joblib.dump(production_scaler, MODELS_DIR / "production_scaler.pkl")


    print("\n✓ Dashboard signals saved")
    print("✓ All artifacts saved")
    print("✓ Training complete")


if __name__ == "__main__":
    main()
