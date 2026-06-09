"""
Load trained models and generate monthly forecasts.

Hybrid inference:
  1. Holt-Winters forecasts the trend + seasonal baseline
  2. XGBoost predicts the residual (external economic/calendar effect)
  3. Final = HW_forecast + XGBoost_residual
"""

import json
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Optional

from preprocess import (
    load_data, aggregate_monthly,
    TARGET_COLS, RESIDUAL_FEATURE_COLS,
)

PROVINCIAL_DIR = Path(__file__).parent / "models" / "provincial"
REGIONAL_DIR   = Path(__file__).parent / "models" / "regional"

ALERT_LABELS = {
    "Critical": "Predicted shortfall: donations well below distribution needs",
    "Warning":  "Tight supply: donations may not cover distribution",
    "Watch":    "Supply-demand gap is narrowing — monitor closely",
    "OK":       "Supply and demand appear balanced",
}


# ── Loaders ───────────────────────────────────────────────────────────────────

def load_models(model_dir: Path = PROVINCIAL_DIR) -> dict:
    """Returns {target: {'hw': fitted_hw, 'xgb': xgb_model}}."""
    models = {}
    for target in TARGET_COLS:
        hw_path  = model_dir / f"hw_{target.lower()}.pkl"
        xgb_path = model_dir / f"xgb_{target.lower()}.pkl"
        if hw_path.exists() and xgb_path.exists():
            models[target] = {
                "hw":  joblib.load(hw_path),
                "xgb": joblib.load(xgb_path),
            }
    return models


def load_feature_cols(model_dir: Path = PROVINCIAL_DIR) -> Optional[dict]:
    p = model_dir / "feature_cols.json"
    return json.load(open(p)) if p.exists() else None


def load_metrics(model_dir: Path = PROVINCIAL_DIR) -> dict:
    p = model_dir / "metrics.json"
    return json.load(open(p)) if p.exists() else {}


def load_feature_importance(target: str, model_dir: Path = PROVINCIAL_DIR) -> dict:
    p = model_dir / f"importance_{target.lower()}.json"
    return json.load(open(p)) if p.exists() else {}


def load_gap_stats(model_dir: Path = PROVINCIAL_DIR) -> dict:
    p = model_dir / "gap_stats.json"
    return json.load(open(p)) if p.exists() else {}


def models_are_trained(model_dir: Path = PROVINCIAL_DIR) -> bool:
    return all(
        (model_dir / f"hw_{t.lower()}.pkl").exists() and
        (model_dir / f"xgb_{t.lower()}.pkl").exists()
        for t in TARGET_COLS
    )


# ── Historical in-sample predictions ─────────────────────────────────────────

def predict_historical(
    df_monthly: pd.DataFrame,
    models: dict,
    feature_cols: dict,
) -> pd.DataFrame:
    """Return df_monthly with *_pred columns added."""
    out = df_monthly[["Date", "LBS_In", "LBS_Out"]].copy()
    for target, m in models.items():
        hw_preds    = m["hw"].fittedvalues.clip(0)
        xgb_resids  = m["xgb"].predict(df_monthly[feature_cols[target]])
        out[f"{target}_pred"] = (hw_preds + xgb_resids).clip(0)
    return out


# ── Future forecast ───────────────────────────────────────────────────────────

def _build_future_rows(df_monthly: pd.DataFrame, months: int) -> pd.DataFrame:
    """
    Build feature rows for the next `months` calendar months.
    Economic cols: carry forward last known value.
    Weather + calendar: climatological monthly mean from history.
    """
    last_date    = df_monthly["Date"].max()
    future_dates = pd.date_range(
        last_date + pd.DateOffset(months=1), periods=months, freq="MS"
    )
    future = pd.DataFrame({"Date": future_dates})
    future["month_of_year"] = future["Date"].dt.month
    future["quarter"]       = future["Date"].dt.quarter

    econ_cols = [
        "Unemployment_Rate", "CPI_Food", "CPI_Shelter", "CPI_All_items",
        "Net_Migration", "AISH_TOTAL", "EDMONTON_AISH_CASELOAD",
    ]
    last = df_monthly.iloc[-1]
    for col in econ_cols:
        if col in df_monthly.columns:
            future[col] = float(last[col])

    wx_cal = [
        "Mean_Temp", "Total_Precip", "Snow_on_Grnd",
        "n_holidays", "n_stat", "n_gst", "n_ccb", "n_school", "n_tax",
        "n_acwb", "n_acfb", "n_cdb", "n_cpp", "n_oas",
        "n_ramadan", "n_exam", "n_intl",
    ]
    available = [c for c in wx_cal if c in df_monthly.columns]
    climate   = df_monthly.groupby("month_of_year")[available].mean()
    for col in available:
        future[col] = future["month_of_year"].map(climate[col])

    for col in RESIDUAL_FEATURE_COLS:
        if col not in future.columns:
            future[col] = 0.0

    return future.fillna(0)


def _alert_level(gap: float, gap_stats: dict) -> str:
    if gap < gap_stats.get("critical_threshold", -999999):
        return "Critical"
    if gap < gap_stats.get("warn_threshold", 0):
        return "Warning"
    if gap < 0:
        return "Watch"
    return "OK"


def _hw_prediction_intervals(
    hw_fitted,
    steps: int,
    xgb_residual_std: float,
    n_sim: int = 500,
    interval: float = 0.80,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Simulate `n_sim` paths from the Holt-Winters model to get empirical
    prediction intervals.  XGBoost residual uncertainty is added in quadrature.

    Returns (lower, upper) arrays of length `steps` at the given interval width.
    """
    import warnings
    alpha = (1 - interval) / 2
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            sims = hw_fitted.simulate(
                nsimulations=steps,
                repetitions=n_sim,
                error="add",
            ).clip(0)           # shape: (steps, n_sim)
        lower = np.percentile(sims, alpha * 100,        axis=1)
        upper = np.percentile(sims, (1 - alpha) * 100,  axis=1)
    except Exception:
        # Fallback: use sMAPE-based symmetric interval if simulation fails
        point = hw_fitted.forecast(steps).values.clip(0)
        margin = point * xgb_residual_std
        lower, upper = (point - margin).clip(0), point + margin

    return lower, upper


def _residual_std(df_monthly: pd.DataFrame, models: dict, feature_cols: dict) -> dict:
    """Compute in-sample XGBoost residual standard deviation per target."""
    stds = {}
    for target, m in models.items():
        hw_in = m["hw"].fittedvalues.clip(0)
        actual = df_monthly[target].values
        xgb_resids = m["xgb"].predict(df_monthly[feature_cols[target]])
        hybrid = (hw_in + xgb_resids).clip(0)
        errors = actual - hybrid
        stds[target] = float(np.std(errors) / (np.mean(actual) + 1e-8))
    return stds


def forecast_monthly(
    df_monthly: pd.DataFrame,
    models: dict,
    feature_cols: dict,
    months: int = 3,
) -> list[dict]:
    """
    Forecast the next `months` months using Holt-Winters + XGBoost hybrid.

    Returns list of dicts with:
      month, LBS_In_forecast, LBS_Out_forecast, Gap_forecast, alert
      LBS_In_lower/upper, LBS_Out_lower/upper  ← 80% prediction intervals
      confidence_pct                            ← model R² as plain-English %
    """
    gap_stats  = load_gap_stats()
    metrics    = load_metrics()
    future     = _build_future_rows(df_monthly, months)
    resid_stds = _residual_std(df_monthly, models, feature_cols)

    hw_forecasts   = {}
    hw_lower       = {}
    hw_upper       = {}
    for target, m in models.items():
        hw_forecasts[target] = m["hw"].forecast(steps=months).clip(0)
        lo, hi = _hw_prediction_intervals(
            m["hw"], months, resid_stds.get(target, 0.3)
        )
        hw_lower[target] = lo
        hw_upper[target] = hi

    results = []
    for i in range(months):
        row_date = future["Date"].iloc[i]
        row_X    = future.iloc[[i]]

        preds = {}
        lower = {}
        upper = {}
        for target, m in models.items():
            hw_pt  = float(hw_forecasts[target][i])
            xgb_adj = float(m["xgb"].predict(row_X[feature_cols[target]])[0])
            pt = max(0.0, hw_pt + xgb_adj)
            preds[target] = pt

            # Shift the interval by the XGBoost adjustment
            lo = max(0.0, float(hw_lower[target][i]) + xgb_adj)
            hi = max(0.0, float(hw_upper[target][i]) + xgb_adj)
            lower[target] = min(lo, pt)
            upper[target] = max(hi, pt)

        lbs_in  = preds["LBS_In"]
        lbs_out = preds["LBS_Out"]
        gap     = lbs_in - lbs_out

        # Directional confidence: R² of the more reliable target (LBS_Out)
        r2_out = metrics.get("LBS_Out", {}).get("r2", 0)
        conf   = round(max(0.0, min(1.0, r2_out)) * 100, 0)

        results.append({
            "period":            row_date.strftime("%Y-%m"),
            "month":             row_date.strftime("%b %Y"),
            "LBS_In_forecast":   round(lbs_in,  0),
            "LBS_In_lower":      round(lower["LBS_In"],  0),
            "LBS_In_upper":      round(upper["LBS_In"],  0),
            "LBS_Out_forecast":  round(lbs_out, 0),
            "LBS_Out_lower":     round(lower["LBS_Out"], 0),
            "LBS_Out_upper":     round(upper["LBS_Out"], 0),
            "Gap_forecast":      round(gap,     0),
            "alert":             _alert_level(gap, gap_stats),
            "confidence_pct":    int(conf),   # based on LBS_Out R²
        })

    return results


def alert_message(alert: str, gap: float) -> str:
    sign = "+" if gap >= 0 else ""
    return f"{ALERT_LABELS[alert]} ({sign}{gap:,.0f} lbs)"
