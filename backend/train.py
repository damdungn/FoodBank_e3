"""
Train Provincial model: Holt-Winters (trend + seasonality) + XGBoost (residuals).

Why this hybrid?
─────────────────
XGBoost alone can't extrapolate a trend — it predicts values in the range it
was trained on, which is why R² was negative.

Holt-Winters Triple Exponential Smoothing handles exactly what Prophet would:
  • Additive trend       → captures steady growth in demand over years
  • Multiplicative seasonality (12 months) → captures seasonal patterns within year
  • Damped trend         → prevents runaway long-range extrapolation

XGBoost then models the RESIDUALS (actual − Holt-Winters baseline):
  "Given the expected seasonal trend, how much do economic and calendar
   factors push this month above or below it?"
  Examples: CPI food spike, AISH caseload growth, GST/CCB week density.

This gives each model what it is good at:
  Holt-Winters → trend, seasonality (no Stan/cmdstanpy dependency)
  XGBoost      → external economic/calendar shock effects on residuals

Pipeline per target
───────────────────
  1. Train Holt-Winters on monthly time series
  2. Compute residuals = actual − Holt-Winters in-sample
  3. First-pass XGBoost on residuals → rank + drop low-importance features
  4. Final XGBoost on selected features
  5. Report metrics for HW-only AND HW+XGBoost on 12-month hold-out
  6. Refit both on FULL dataset for deployment
  7. Save to models/provincial/

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
from sklearn.metrics import mean_absolute_error, mean_squared_error
from statsmodels.tsa.holtwinters import ExponentialSmoothing
import xgboost as xgb

from preprocess import (
    load_data, aggregate_monthly,
    get_residual_feature_cols, TARGET_COLS,
)

MODELS_DIR  = Path(__file__).parent / "models" / "provincial"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

TEST_MONTHS       = 6
VAL_FRAC          = 0.15
IMPORTANCE_CUTOFF = 0.95


# ── Holt-Winters (trend + seasonality layer) ──────────────────────────────────

def _train_hw(series: pd.Series):
    """
    Fit Holt-Winters with additive trend + multiplicative seasonality.
    Multiplicative seasonality captures swings that scale with volume.
    Convergence warnings are suppressed — the optimizer finds a workable
    solution even when it doesn't fully converge; results are still usable.
    Returns the fitted result object.
    """
    model = ExponentialSmoothing(
        series.values.astype(float),
        trend="add",
        seasonal="mul",
        seasonal_periods=12,
        damped_trend=True,
        initialization_method="heuristic",
    )
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        return model.fit(optimized=True)


def _hw_insample(fitted) -> np.ndarray:
    return fitted.fittedvalues.clip(0)


def _hw_forecast(fitted, steps: int) -> np.ndarray:
    return fitted.forecast(steps).clip(0)


# ── XGBoost (residual layer) ──────────────────────────────────────────────────

def _build_xgb() -> xgb.XGBRegressor:
    return xgb.XGBRegressor(
        n_estimators=500,
        learning_rate=0.02,
        max_depth=2,          # shallow — ~40 training rows
        min_child_weight=5,
        subsample=0.8,
        colsample_bytree=0.7,
        reg_alpha=1.0,
        reg_lambda=3.0,
        random_state=42,
        early_stopping_rounds=30,
        eval_metric="mae",
        verbosity=0,
    )


def _fit_xgb(X: pd.DataFrame, y: np.ndarray) -> xgb.XGBRegressor:
    n_val = max(3, int(len(X) * VAL_FRAC))
    model = _build_xgb()
    model.fit(
        X.iloc[:-n_val], y[:-n_val],
        eval_set=[(X.iloc[-n_val:], y[-n_val:])],
        verbose=False,
    )
    return model


def _select_features(model: xgb.XGBRegressor, cols: list[str]) -> list[str]:
    pairs = sorted(zip(cols, model.feature_importances_), key=lambda x: x[1], reverse=True)
    total = sum(v for _, v in pairs) + 1e-12
    cumulative, selected = 0.0, []
    for feat, imp in pairs:
        selected.append(feat)
        cumulative += imp / total
        if cumulative >= IMPORTANCE_CUTOFF:
            break
    dropped = [f for f in cols if f not in selected]
    print(f"    kept {len(selected)}/{len(cols)} features "
          f"(dropped {len(dropped)}: {dropped[:5]}{'…' if len(dropped) > 5 else ''})")
    return selected


# ── Metrics ───────────────────────────────────────────────────────────────────

def _metrics(preds: np.ndarray, actual: np.ndarray, label: str) -> dict:
    mae  = mean_absolute_error(actual, preds)
    rmse = np.sqrt(mean_squared_error(actual, preds))
    ss_res = np.sum((actual - preds) ** 2)
    ss_tot = np.sum((actual - actual.mean()) ** 2)
    r2     = 1.0 - ss_res / (ss_tot + 1e-12)
    nz     = actual > 0
    rel    = np.mean(np.abs(actual[nz] - preds[nz]) / actual[nz]) * 100
    smape  = np.mean(2 * np.abs(actual - preds) / (np.abs(actual) + np.abs(preds) + 1e-8)) * 100
    print(f"  {label:20s} R²={r2:+.4f}  RelMAE={rel:.1f}%  sMAPE={smape:.1f}%")
    return {
        "mae":         round(float(mae),  0),
        "rmse":        round(float(rmse), 0),
        "r2":          round(float(r2),   4),
        "smape":       round(float(smape),1),
        "rel_mae_pct": round(float(rel),  1),
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
    print("PROVINCIAL MODEL TRAINING — Holt-Winters + XGBoost hybrid")
    print("=" * 64)

    print("\n[1/4] Loading and aggregating to monthly …")
    df_monthly    = aggregate_monthly(load_data())
    residual_cols = get_residual_feature_cols(df_monthly)

    cutoff   = df_monthly["Date"].max() - pd.DateOffset(months=TEST_MONTHS)
    df_train = df_monthly[df_monthly["Date"] <= cutoff].copy()
    df_test  = df_monthly[df_monthly["Date"] >  cutoff].copy()

    print(f"  Monthly rows : {len(df_monthly)}  "
          f"({df_monthly['Date'].min().strftime('%b %Y')} → "
          f"{df_monthly['Date'].max().strftime('%b %Y')})")
    print(f"  Train        : {len(df_train)} months (up to {cutoff.strftime('%b %Y')})")
    print(f"  Test         : {len(df_test)} months")
    print(f"  Residual features: {len(residual_cols)} candidates")

    all_metrics:  dict = {}
    final_xcols:  dict = {}
    history_preds = df_monthly[["Date"]].copy()

    for target in TARGET_COLS:
        print(f"\n── {target} ──────────────────────────────────────────────────")

        # ── Stage 1: Holt-Winters ────────────────────────────────────
        print("[2/4] Fitting Holt-Winters (trend + seasonality) …")
        hw_train = _train_hw(df_train[target])
        train_preds_hw = _hw_insample(hw_train)
        test_preds_hw  = _hw_forecast(hw_train, steps=len(df_test))

        m_hw = _metrics(test_preds_hw, df_test[target].values, "Holt-Winters only")

        # ── Stage 2: XGBoost on residuals ────────────────────────────
        print("[3/4] Fitting XGBoost on residuals (external features) …")
        train_residuals = df_train[target].values - train_preds_hw

        xgb_pass1 = _fit_xgb(df_train[residual_cols], train_residuals)
        selected  = _select_features(xgb_pass1, residual_cols)
        xgb_final = _fit_xgb(df_train[selected], train_residuals)

        test_resid_pred  = xgb_final.predict(df_test[selected])
        test_preds_hybrid = (test_preds_hw + test_resid_pred).clip(0)

        m_hybrid = _metrics(test_preds_hybrid, df_test[target].values, "HW + XGBoost")
        print(f"  XGBoost boost: ΔR²={m_hybrid['r2'] - m_hw['r2']:+.4f}  "
              f"ΔRelMAE={m_hybrid['rel_mae_pct'] - m_hw['rel_mae_pct']:+.1f}%")

        all_metrics[target] = {**m_hybrid, "hw_only_r2": m_hw["r2"]}
        final_xcols[target] = selected

        # ── Stage 3: Refit on FULL dataset for deployment ────────────
        print("[4/4] Refitting on full dataset …")
        hw_full         = _train_hw(df_monthly[target])
        full_preds_hw   = _hw_insample(hw_full)
        full_residuals  = df_monthly[target].values - full_preds_hw
        xgb_full        = _fit_xgb(df_monthly[selected], full_residuals)

        history_preds[f"{target}_pred"] = (
            full_preds_hw + xgb_full.predict(df_monthly[selected])
        ).clip(0)

        # Save artefacts
        joblib.dump(hw_full,   MODELS_DIR / f"hw_{target.lower()}.pkl")
        joblib.dump(xgb_full,  MODELS_DIR / f"xgb_{target.lower()}.pkl")

        importance = {k: float(v) for k, v in zip(selected, xgb_full.feature_importances_)}
        importance = dict(sorted(importance.items(), key=lambda x: x[1], reverse=True))
        with open(MODELS_DIR / f"importance_{target.lower()}.json", "w") as f:
            json.dump(importance, f, indent=2)

        print(f"  Saved: hw_{target.lower()}.pkl · xgb_{target.lower()}.pkl · "
              f"importance_{target.lower()}.json")

    # ── Shared artefacts ──────────────────────────────────────────────
    with open(MODELS_DIR / "metrics.json", "w") as f:
        json.dump(all_metrics, f, indent=2)
    with open(MODELS_DIR / "feature_cols.json", "w") as f:
        json.dump(final_xcols, f, indent=2)

    gap_stats = _gap_stats(df_monthly)
    with open(MODELS_DIR / "gap_stats.json", "w") as f:
        json.dump(gap_stats, f, indent=2)
    print(f"\n  Gap: mean={gap_stats['mean_gap']:+,.0f}  "
          f"warn<{gap_stats['warn_threshold']:+,.0f}  "
          f"critical<{gap_stats['critical_threshold']:+,.0f}  "
          f"({gap_stats['pct_deficit']}% months in deficit)")

    history_preds["LBS_In_actual"]  = df_monthly["LBS_In"].values
    history_preds["LBS_Out_actual"] = df_monthly["LBS_Out"].values
    history_preds["Gap_actual"]     = (df_monthly["LBS_In"] - df_monthly["LBS_Out"]).values
    history_preds.to_csv(MODELS_DIR / "history_predictions.csv", index=False)

    print("\n" + "=" * 64)
    print("DONE — artefacts saved to models/provincial/")
    print("=" * 64)
    print(json.dumps(all_metrics, indent=2))


if __name__ == "__main__":
    main()
