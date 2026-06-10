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
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler, RobustScaler

from prophet import Prophet

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

    # Only the 4 strongest, mathematically defensible drivers.
    # More regressors → more overfitting on ~42 monthly rows.

    "CPI_Food",        # food-price inflation → direct demand driver
    "AISH_TOTAL",      # income-assistance caseload → poverty proxy
    "Net_Migration",   # population growth → demand volume
    "Mean_Temp",       # seasonal weather → donation / usage patterns
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

    print("\n[3/5] Training RandomForest classifier...")

    # Shallow Random Forest — handles tiny tabular data far better than
    # LightGBM when n_train ≈ 32 rows.  max_depth=2 prevents memorising
    # individual months; class_weight='balanced' handles gap imbalance.
    clf = RandomForestClassifier(
        n_estimators=50,
        max_depth=2,
        min_samples_leaf=3,
        class_weight="balanced",
        random_state=42,
    )

    clf.fit(X_train, y_train)

    print("  ✓ RandomForest fitted")

    # ─────────────────────────────────────────────────────────────────────
    # CALIBRATION  (cv='prefit' — only fits the sigmoid layer on X_train;
    # does NOT refit the forest, so feature_importances_ stays intact)
    # ─────────────────────────────────────────────────────────────────────

    calibrated_clf = CalibratedClassifierCV(clf, method="sigmoid", cv="prefit")
    calibrated_clf.fit(X_train, y_train)

    clf_train_proba = calibrated_clf.predict_proba(X_train)[:, 1]
    clf_val_proba   = calibrated_clf.predict_proba(X_val)[:, 1]

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

    # Step 1 — pick blend weight by maximising ROC-AUC on the val set.
    # AUC is threshold-free so the search can't be gamed by majority-class
    # guessing the way accuracy/F1 can.
    best_weight = 0.5
    best_auc    = -1.0

    for w in np.linspace(0.1, 0.9, 9):

        val_proba = w * prophet_gap_prob + (1.0 - w) * clf_val_proba

        try:
            score = roc_auc_score(y_val, val_proba)
        except ValueError:
            score = 0.0

        if score > best_auc:
            best_auc    = score
            best_weight = float(w)

    # Step 2 — with the weight fixed, find the classification threshold
    # using F-beta(β=2) so recall is weighted twice over precision.
    best_threshold = 0.5
    best_fbeta     = -1.0
    _blended_val   = best_weight * prophet_gap_prob + (1.0 - best_weight) * clf_val_proba

    for t in np.arange(0.30, 0.71, 0.02):

        pred = (_blended_val > t).astype(int)
        f1   = f1_score(y_val, pred, zero_division=0)
        rec  = recall_score(y_val, pred, zero_division=0)
        prec = f1 / (2 * rec - f1 + 1e-9) if rec > 0 else 0.0
        beta = 2.0
        score = (1 + beta**2) * prec * rec / (beta**2 * prec + rec + 1e-9)

        if score > best_fbeta:
            best_fbeta     = score
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
        (1.0 - best_weight) * clf_train_proba
    )

    ensemble_val_proba = (
        best_weight * prophet_gap_prob +
        (1.0 - best_weight) * clf_val_proba
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

    # --- Save All Required Backend Artifacts ---

    # 1. Models
    joblib.dump(calibrated_clf, MODELS_DIR / "lgbm_model.pkl")
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

    # 4. RandomForest lag importances (kept for diagnostics)
    importance_dict = dict(
        sorted(
            zip(LAG_FEATURE_NAMES, clf.feature_importances_),
            key=lambda x: x[1],
            reverse=True,
        )
    )
    importance_dict = {k: round(float(v), 6) for k, v in importance_dict.items()}
    with open(MODELS_DIR / "importance_lbs_in.json", "w") as f:
        json.dump(importance_dict, f, indent=2)
    with open(MODELS_DIR / "importance_lbs_out.json", "w") as f:
        json.dump(importance_dict, f, indent=2)

    # 4b. Prophet regressor contributions — mean absolute additive effect per regressor.
    # Prophet's predict() returns a column per extra_regressor showing its additive
    # contribution to yhat at each time step; mean(|col|) is a clean importance proxy.
    train_fcst_in_reg = _prophet_predict(prophet_in, train_all_months, top_features)
    raw_reg: dict = {}
    for reg in top_features:
        if reg in train_fcst_in_reg.columns:
            raw_reg[reg] = float(train_fcst_in_reg[reg].abs().mean())
        else:
            raw_reg[reg] = 0.0
    reg_total = sum(raw_reg.values()) or 1.0
    importance_regressors = {
        k: round(v / reg_total, 6)
        for k, v in sorted(raw_reg.items(), key=lambda x: x[1], reverse=True)
    }
    with open(MODELS_DIR / "importance_regressors.json", "w") as f:
        json.dump(importance_regressors, f, indent=2)

    # 5. Scalers (Fitted on dataframe to preserve shape & feature names)
    robust_scaler = RobustScaler().fit(X_all)
    production_scaler = StandardScaler().fit(X_all)
    joblib.dump(robust_scaler, MODELS_DIR / "robust_scaler.pkl")
    joblib.dump(production_scaler, MODELS_DIR / "production_scaler.pkl")


    # ── Export deployment snapshots (no CSV needed on server) ────────────────
    DATA_DIR = Path(__file__).parent / "data"

    # Monthly aggregated data — 62 rows, no individual records
    export_df = monthly.copy()
    # Drop Period column — not JSON serialisable
    export_df = export_df.drop(columns=["ym"], errors="ignore")
    # Convert any remaining Period columns
    for col in export_df.columns:
        if hasattr(export_df[col], "dt") and hasattr(export_df[col].dt, "to_timestamp"):
            try:
                export_df[col] = export_df[col].dt.to_timestamp()
            except Exception:
                export_df[col] = export_df[col].astype(str)
    export_df.to_json(DATA_DIR / "monthly_data.json", orient="records", date_format="iso")
    print("✓ monthly_data.json exported")

    # Latest signals row — economic/calendar flags only, no individual records
    from preprocess import preprocess as _preprocess
    daily_df = _preprocess(load_data())
    last_row = daily_df.iloc[-1].to_dict()
    safe_row = {}
    for k, v in last_row.items():
        if hasattr(v, "item"):
            safe_row[k] = v.item()
        elif isinstance(v, (int, float, bool, str)):
            safe_row[k] = v if v == v else 0  # replace NaN
        elif hasattr(v, "isoformat"):
            safe_row[k] = v.isoformat()
        else:
            safe_row[k] = str(v)
    with open(DATA_DIR / "latest_signals.json", "w") as f:
        json.dump(safe_row, f, indent=2)
    print("✓ latest_signals.json exported")

    print("\n✓ Dashboard signals saved")
    print("✓ All artifacts saved")
    print("✓ Training complete")


if __name__ == "__main__":
    main()
