#!/usr/bin/env python3
"""
Train Provincial model: Prophet + LightGBM ensemble.

Hardened Ensemble Pipeline:
  - LightGBM: 18 lag features only (6×LBS_In, 6×LBS_Out, 6×net)
  - Prophet: conservative hyperparams (seasonality_prior_scale=0.01, changepoint_prior_scale=0.001)
  - Surplus class: hardcoded 2× sample weight
  - 75/25 chronological train/val split
  - Sigmoid scale: Dynamically normalized by historical standard deviation
  - Ensemble Ratio: Mathematically optimized on validation splits to maximize accuracy
  - Threshold: adaptive percentile (calibrated to full historical production rate)

Pipeline
────────
  1. Aggregate daily → monthly via preprocess.py
  2. Build 18-feature lag vectors for LightGBM
  3. 75/25 train/val split
  4. Fit Prophet on net, LBS_In, LBS_Out  (train slice)
  5. Fit LightGBM on 18 lag features      (train slice, with early stopping)
  6. Optimize ensemble weights (Prophet vs LightGBM) on validation slice
  7. Refit both models on FULL dataset for deployment using locked optimal iterations
  8. Recalibrate production threshold on full dataset distributions using locked weights
  9. Save artifacts to models/provincial/

Run
───
  cd backend && python train.py
"""

import json
import joblib
import warnings
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.metrics import (
    mean_absolute_error, mean_squared_error,
    accuracy_score, f1_score, recall_score, roc_auc_score, confusion_matrix,
)
from prophet import Prophet
import lightgbm as lgb

from preprocess import load_data, aggregate_monthly

MODELS_DIR = Path(__file__).parent / "models" / "provincial"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

LOOKBACK = 6

# External regressors for Prophet. Column names must match preprocess.aggregate_monthly output.
# Entries absent from the data are printed as warnings and silently skipped.
FIXED_REGRESSORS = [
    "n_stat", "n_holidays", "n_ccb", "n_cpp", "n_oas",
    "n_school", "n_exam", "n_intl",
    "n_nldb",
    "n_covid",
    "CPI_All_items", "CPI_Food", "CPI_Shelter",
    "Net_Migration",
    "AISH_TOTAL", "SINGLE_AISH_TOTAL", "SINGLE_AISH_PARENT",
    "EDMONTON_AISH_CASELOAD",
    "Mean_Temp",
]

# 18 LightGBM feature names: 6×LBS_In + 6×LBS_Out + 6×net lags
LAG_FEATURE_NAMES = (
    [f"LBS_In_lag{i+1}"  for i in range(LOOKBACK)] +
    [f"LBS_Out_lag{i+1}" for i in range(LOOKBACK)] +
    [f"net_lag{i+1}"     for i in range(LOOKBACK)]
)


# ── Prophet helpers ───────────────────────────────────────────────────────────

def _fit_prophet(
    data: pd.DataFrame,
    top_features: list,
    target_col: str,
) -> Prophet:
    df_p = data[["Date"]].copy().rename(columns={"Date": "ds"})
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
            model.add_regressor(col, prior_scale=0.02, mode="additive")

    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        model.fit(df_p)
    return model


def _prophet_predict(
    model: Prophet, data: pd.DataFrame, top_features: list
) -> pd.DataFrame:
    df_p = data[["Date"]].rename(columns={"Date": "ds"})
    for col in top_features:
        if col in data.columns:
            df_p[col] = data[col].values
    return model.predict(df_p)


# ── LightGBM feature builder ──────────────────────────────────────────────────

def _create_lag_features(
    data: pd.DataFrame, target_col: str
) -> tuple[np.ndarray, np.ndarray, pd.DatetimeIndex]:
    """18 features: 6×LBS_In lags + 6×LBS_Out lags + 6×net lags."""
    lbs_in  = data["LBS_In"].values
    lbs_out = data["LBS_Out"].values
    net     = (data["LBS_In"] - data["LBS_Out"]).values

    X, y, dates = [], [], []
    for i in range(LOOKBACK, len(data)):
        lags = np.concatenate([
            lbs_in[i - LOOKBACK:i],
            lbs_out[i - LOOKBACK:i],
            net[i - LOOKBACK:i],
        ])
        X.append(lags)
        y.append(data[target_col].iloc[i])
        dates.append(data["Date"].iloc[i])

    return np.array(X), np.array(y), pd.to_datetime(dates)


# ── Metrics ───────────────────────────────────────────────────────────────────

def _regression_metrics(preds: np.ndarray, actual: np.ndarray) -> dict:
    mae  = float(mean_absolute_error(actual, preds))
    rmse = float(np.sqrt(mean_squared_error(actual, preds)))
    ss_res = np.sum((actual - preds) ** 2)
    ss_tot = np.sum((actual - actual.mean()) ** 2)
    r2     = float(1.0 - ss_res / (ss_tot + 1e-12))
    nz     = actual > 0
    rel    = (float(np.mean(np.abs(actual[nz] - preds[nz]) / actual[nz]) * 100)
              if nz.any() else 0.0)
    smape  = float(np.mean(
        2 * np.abs(actual - preds) / (np.abs(actual) + np.abs(preds) + 1e-8)
    ) * 100)
    return {
        "mae":         round(mae,  0),
        "rmse":        round(rmse, 0),
        "r2":          round(r2,   4),
        "smape":       round(smape, 1),
        "rel_mae_pct": round(rel,  1),
        "mean_actual": round(float(actual.mean()), 0),
        "n_test":      int(len(actual)),
        "granularity": "monthly",
    }


def _gap_stats(df: pd.DataFrame) -> dict:
    gap = df["LBS_In"] - df["LBS_Out"]
    return {
        "mean_gap":           round(float(gap.mean()),  0),
        "std_gap":            round(float(gap.std()),   0),
        "min_gap":            round(float(gap.min()),   0),
        "max_gap":            round(float(gap.max()),   0),
        "pct_deficit":        round(float((gap < 0).mean() * 100), 1),
        "warn_threshold":     round(float(gap.mean() - gap.std()),     0),
        "critical_threshold": round(float(gap.mean() - 2 * gap.std()), 0),
    }


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    print("=" * 64)
    print("PROVINCIAL MODEL TRAINING — Prophet + LightGBM ensemble")
    print("=" * 64)

    # ── [1/5] Load data ───────────────────────────────────────────────────────
    print("\n[1/5] Loading and aggregating to monthly ...")
    monthly = aggregate_monthly(load_data())
    monthly["net"]        = monthly["LBS_In"] - monthly["LBS_Out"]
    monthly["gap_binary"] = (monthly["net"] < 0).astype(int)

    top_features = [c for c in FIXED_REGRESSORS if c in monthly.columns]
    missing      = [c for c in FIXED_REGRESSORS if c not in monthly.columns]
    print(f"  Monthly rows : {len(monthly)}  "
          f"({monthly['Date'].min().strftime('%b %Y')} → "
          f"{monthly['Date'].max().strftime('%b %Y')})")
    print(f"  Gap rate     : {monthly['gap_binary'].mean():.1%}  "
          f"({monthly['gap_binary'].sum()}/{len(monthly)} months in deficit)")
    print(f"  Regressors   : {top_features}")
    if missing:
        print(f"  Skipped (not in data): {missing}")

    # ── Build lag feature arrays ──────────────────────────────────────────────
    X_all, y_all, dates_all = _create_lag_features(monthly, "gap_binary")
    split_idx = int(len(X_all) * 0.75)

    X_train, X_val         = X_all[:split_idx],     X_all[split_idx:]
    y_train, y_val         = y_all[:split_idx],     y_all[split_idx:]
    dates_train, dates_val = dates_all[:split_idx], dates_all[split_idx:]

    def _slice(dates):
        idx = [monthly.index[monthly["Date"] == d][0] for d in dates]
        return monthly.loc[idx].copy()

    train_months = _slice(dates_train)
    val_months   = _slice(dates_val)

    # Prophet trains on all months before the first val date
    first_val_date   = dates_val[0]
    train_all_months = monthly[monthly["Date"] < first_val_date].copy()

    print(f"  Prophet train : {len(train_all_months)} months  "
          f"({train_all_months['Date'].min().strftime('%b %Y')} → "
          f"{train_all_months['Date'].max().strftime('%b %Y')})")
    print(f"  LGBM train    : {len(y_train)} rows | Val: {len(y_val)} rows  "
          f"| Train gap rate: {y_train.mean():.1%} | Val gap rate: {y_val.mean():.1%}")

    # ── [2/5] Fit Prophet ─────────────────────────────────────────────────────
    print("\n[2/5] Fitting Prophet models (net flow, LBS_In, LBS_Out) ...")
    prophet_net = _fit_prophet(train_all_months, top_features, "net")
    prophet_in  = _fit_prophet(train_all_months, top_features, "LBS_In")
    prophet_out = _fit_prophet(train_all_months, top_features, "LBS_Out")
    print("  ✓ Prophet fitted")

    val_fcst_net = _prophet_predict(prophet_net, val_months, top_features)
    val_fcst_in  = _prophet_predict(prophet_in,  val_months, top_features)
    val_fcst_out = _prophet_predict(prophet_out, val_months, top_features)

    # CHANGE 1: DYNAMIC SIGMOID NORMALIZATION (Stops hardcoded limits from flat-lining probabilities)
    train_net_std = float(np.std(train_all_months["net"].values))
    dynamic_sigmoid_scale = train_net_std if train_net_std > 0 else 30000.0

    net_pred         = val_fcst_net["yhat"].values
    prophet_gap_prob = 1.0 / (1.0 + np.exp(net_pred / dynamic_sigmoid_scale))

    lbs_in_val_pred  = np.maximum(val_fcst_in["yhat"].values,  0)
    lbs_out_val_pred = np.maximum(val_fcst_out["yhat"].values, 0)

    m_in  = _regression_metrics(lbs_in_val_pred,  val_months["LBS_In"].values)
    m_out = _regression_metrics(lbs_out_val_pred, val_months["LBS_Out"].values)
    print(f"  LBS_In  R²={m_in['r2']:+.4f}  sMAPE={m_in['smape']:.1f}%  "
          f"RelMAE={m_in['rel_mae_pct']:.1f}%")
    print(f"  LBS_Out R²={m_out['r2']:+.4f}  sMAPE={m_out['smape']:.1f}%  "
          f"RelMAE={m_out['rel_mae_pct']:.1f}%")

    # ── [3/5] Fit LightGBM ────────────────────────────────────────────────────
    print("\n[3/5] Fitting LightGBM (18-feature lag set) ...")
    sample_weights = np.where(y_train == 0, 2.0, 1.0)

    lgbm = lgb.LGBMClassifier(
        n_estimators=100,
        learning_rate=0.05,
        max_depth=2,
        num_leaves=4,
        min_data_in_leaf=5,
        lambda_l2=8.0,
        lambda_l1=2.0,
        subsample=0.7,
        colsample_bytree=0.7,
        random_state=42,
        verbose=-1,
    )
    lgbm.fit(
        X_train, y_train,
        sample_weight=sample_weights,
        eval_set=[(X_val, y_val)],
        eval_metric="auc",
        callbacks=[lgb.early_stopping(15, verbose=False), lgb.log_evaluation(period=0)],
    )
    print("  ✓ LightGBM fitted")
    
    # CHANGE 2: OPTIMAL ITERATION CAPTURE (Locks performance boundaries for deployment refits)
    best_iteration = lgbm.best_iteration_
    print(f"  ✓ Early stopping picked optimal tree count: {best_iteration}")

    lgbm_train_proba = lgbm.predict_proba(X_train)[:, 1]
    lgbm_val_proba   = lgbm.predict_proba(X_val)[:, 1]

    # ── [4/5] Ensemble evaluation & Weight Optimization ──────────────────────
    print("\n[4/5] Optimizing ensemble weights (Prophet vs LightGBM) ...")

    prophet_train_proba = 1.0 / (1.0 + np.exp(
        _prophet_predict(prophet_net, train_months, top_features)["yhat"].values / dynamic_sigmoid_scale
    ))
    
    hist_surplus_rate = 1.0 - monthly["gap_binary"].mean()

    # CHANGE 3: DYNAMIC RATIO SELECTION (Iterates validation options to break accuracy plates)
    best_prophet_weight = 0.50
    best_val_acc = -1.0
    candidate_weights = np.linspace(0.1, 0.9, 9)
    
    for w in candidate_weights:
        tmp_val_proba = (w * prophet_gap_prob) + ((1.0 - w) * lgbm_val_proba)
        tmp_threshold = float(np.percentile(tmp_val_proba, hist_surplus_rate * 100))
        tmp_val_pred = (tmp_val_proba > tmp_threshold).astype(int)
        
        tmp_acc = accuracy_score(y_val, tmp_val_pred)
        if tmp_acc > best_val_acc:
            best_val_acc = tmp_acc
            best_prophet_weight = float(w)

    best_lgbm_weight = 1.0 - best_prophet_weight
    print(f"  ✓ Optimal ratio discovered: {best_prophet_weight:.0%} Prophet / {best_lgbm_weight:.0%} LightGBM")
    print(f"  ✓ Maximized Validation Accuracy: {best_val_acc:.1%}")

    # Set parameters to globally calculated optimums
    ensemble_train_proba = (best_prophet_weight * prophet_train_proba) + (best_lgbm_weight * lgbm_train_proba)
    ensemble_val_proba   = (best_prophet_weight * prophet_gap_prob)    + (best_lgbm_weight * lgbm_val_proba)

    val_threshold = float(np.percentile(ensemble_val_proba, hist_surplus_rate * 100))
    val_pred  = (ensemble_val_proba > val_threshold).astype(int)
    acc       = float(accuracy_score(y_val, val_pred))
    f1        = float(f1_score(y_val, val_pred, zero_division=0))
    sur_rec   = (float(recall_score(y_val, val_pred, pos_label=0, zero_division=0)) if (y_val == 0).any() else 0.0)
    auc       = (float(roc_auc_score(y_val, ensemble_val_proba)) if len(np.unique(y_val)) > 1 else 0.50)
    cm        = confusion_matrix(y_val, val_pred)

    train_pred_adp  = (ensemble_train_proba > val_threshold).astype(int)
    train_acc_adp   = float(accuracy_score(y_train, train_pred_adp))
    train_f1_adp    = float(f1_score(y_train, train_pred_adp, zero_division=0))
    acc_gap         = train_acc_adp - acc
    f1_gap          = train_f1_adp  - f1

    if acc_gap > 0.15:
        overfit_label = "SEVERE OVERFITTING"
    elif acc_gap > 0.05:
        overfit_label = "MILD OVERFITTING"
    else:
        overfit_label = "NO OVERFITTING (good generalisation)"

    print(f"  @ validation threshold={val_threshold:.4f} (adaptive):")
    print(f"  Overfitting Check: {overfit_label}")
    print(f"    Accuracy  train={train_acc_adp:.1%} → val={acc:.1%}  gap={acc_gap:+.1%}")
    print(f"    F1        train={train_f1_adp:.3f} → val={f1:.3f}   gap={f1_gap:+.3f}")
    print(f"    Confusion (val):  TN={cm[0,0]:3d}  FP={cm[0,1]:3d}  FN={cm[1,0]:3d}  TP={cm[1,1]:3d}")

    for m in (m_in, m_out):
        m["gap_accuracy"]   = round(acc,     4)
        m["gap_f1"]         = round(f1,      4)
        m["gap_sur_recall"] = round(sur_rec, 4)
        m["gap_auc"]        = round(auc,     4)

    # ── [5/5] Refit on full dataset + save ────────────────────────────────────
    print("\n[5/5] Refitting on full dataset for deployment ...")
    prophet_net_prod = _fit_prophet(monthly, top_features, "net")
    prophet_in_prod  = _fit_prophet(monthly, top_features, "LBS_In")
    prophet_out_prod = _fit_prophet(monthly, top_features, "LBS_Out")

    X_prod, y_prod, _ = _create_lag_features(monthly, "gap_binary")
    prod_weights = np.where(y_prod == 0, 2.0, 1.0)

    # Fixed configuration deployment instantiation
    lgbm_prod = lgb.LGBMClassifier(
        n_estimators=max(1, best_iteration), 
        learning_rate=0.05, 
        max_depth=2, 
        num_leaves=4,
        min_data_in_leaf=5, 
        lambda_l2=8.0, 
        lambda_l1=2.0,
        subsample=0.7, 
        colsample_bytree=0.7, 
        random_state=42, 
        verbose=-1,
    )
    lgbm_prod.fit(X_prod, y_prod, sample_weight=prod_weights,
                  callbacks=[lgb.log_evaluation(period=0)])

    # CHANGE 4: FULL PRODUCTION ADAPTIVE THRESHOLD RE-CALIBRATION
    prod_net_std = float(np.std(monthly["net"].values))
    prod_dynamic_scale = prod_net_std if prod_net_std > 0 else 30000.0
    
    prod_prophet_fcst = _prophet_predict(prophet_net_prod, monthly, top_features)["yhat"].values
    prod_prophet_proba = 1.0 / (1.0 + np.exp(prod_prophet_fcst / prod_dynamic_scale))
    
    prod_lgbm_proba = lgbm_prod.predict_proba(X_prod)[:, 1]
    prod_lgbm_proba_padded = np.zeros(len(monthly))
    prod_lgbm_proba_padded[LOOKBACK:] = prod_lgbm_proba
    prod_lgbm_proba_padded[:LOOKBACK] = prod_lgbm_proba[0] 

    # Blend production utilizing dynamically discovered weights
    ensemble_prod_proba = (best_prophet_weight * prod_prophet_proba) + (best_lgbm_weight * prod_lgbm_proba_padded)
    deployment_threshold = float(np.percentile(ensemble_prod_proba, hist_surplus_rate * 100))
    print(f"  ✓ Re-calibrated production threshold to full window data: {deployment_threshold:.4f}")

    # ── Save artifacts ────────────────────────────────────────────────────────
    joblib.dump(prophet_net_prod, MODELS_DIR / "prophet_net.pkl")
    joblib.dump(prophet_in_prod,  MODELS_DIR / "prophet_lbs_in.pkl")
    joblib.dump(prophet_out_prod, MODELS_DIR / "prophet_lbs_out.pkl")
    joblib.dump(lgbm_prod,        MODELS_DIR / "lgbm_model.pkl")
    print("  Saved: prophet_net.pkl · prophet_lbs_in.pkl · prophet_lbs_out.pkl · lgbm_model.pkl")

    with open(MODELS_DIR / "metrics.json", "w") as f:
        json.dump({"LBS_In": m_in, "LBS_Out": m_out}, f, indent=2)

    with open(MODELS_DIR / "feature_cols.json", "w") as f:
        json.dump({"LBS_In": top_features, "LBS_Out": top_features}, f, indent=2)

    config = {
        "top_features":      top_features,
        "lookback":          LOOKBACK,
        "hist_surplus_rate": float(hist_surplus_rate),
        "threshold":         deployment_threshold,
        "prophet_weight":    best_prophet_weight,
        "lgbm_weight":       best_lgbm_weight,
        "lag_feature_names": LAG_FEATURE_NAMES,
    }
    with open(MODELS_DIR / "forecast_config.json", "w") as f:
        json.dump(config, f, indent=2)

    gap_stats = _gap_stats(monthly)
    with open(MODELS_DIR / "gap_stats.json", "w") as f:
        json.dump(gap_stats, f, indent=2)
    print(f"  Gap: mean={gap_stats['mean_gap']:+,.0f}  "
          f"warn<{gap_stats['warn_threshold']:+,.0f}  "
          f"critical<{gap_stats['critical_threshold']:+,.0f}  "
          f"({gap_stats['pct_deficit']}% months in deficit)")

    imps = dict(zip(LAG_FEATURE_NAMES, [int(v) for v in lgbm_prod.feature_importances_]))
    imps = dict(sorted(imps.items(), key=lambda kv: kv[1], reverse=True))
    for target in ("lbs_in", "lbs_out"):
        with open(MODELS_DIR / f"importance_{target}.json", "w") as f:
            json.dump(imps, f, indent=2)

    hist_fcst_in  = _prophet_predict(prophet_in_prod,  monthly, top_features)
    hist_fcst_out = _prophet_predict(prophet_out_prod, monthly, top_features)
    hist_df = monthly[["Date"]].copy()
    hist_df["LBS_In_pred"]    = np.maximum(hist_fcst_in["yhat"].values,  0)
    hist_df["LBS_Out_pred"]   = np.maximum(hist_fcst_out["yhat"].values, 0)
    hist_df["LBS_In_actual"]  = monthly["LBS_In"].values
    hist_df["LBS_Out_actual"] = monthly["LBS_Out"].values
    hist_df["Gap_actual"]     = monthly["net"].values
    hist_df.to_csv(MODELS_DIR / "history_predictions.csv", index=False)

    print("\n" + "=" * 64)
    print("DONE — artifacts saved to models/provincial/")
    print("=" * 64)
    print(json.dumps({"LBS_In": m_in, "LBS_Out": m_out}, indent=2))


if __name__ == "__main__":
    main()