"""
Load trained ensemble models and generate monthly forecasts.

Inference:
  1. Prophet models produce continuous LBS_In, LBS_Out forecasts and net flow direction
  2. LightGBM classifies gap/surplus probability from 6-month rolling lag history
  3. Ensemble (50/50) gap probability drives alert levels
  4. Prophet 80% prediction intervals are passed through for each target
"""

import json
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Optional

from preprocess import load_data, aggregate_monthly

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
    """Returns ensemble model dict with prophet_net, prophet_lbs_in, prophet_lbs_out, lgbm."""
    keys   = ["prophet_net", "prophet_lbs_in", "prophet_lbs_out", "lgbm"]
    fnames = ["prophet_net.pkl", "prophet_lbs_in.pkl", "prophet_lbs_out.pkl", "lgbm_model.pkl"]
    models = {}
    for key, fname in zip(keys, fnames):
        p = model_dir / fname
        if p.exists():
            models[key] = joblib.load(p)
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


def _load_config(model_dir: Path = PROVINCIAL_DIR) -> dict:
    p = model_dir / "forecast_config.json"
    return json.load(open(p)) if p.exists() else {}


def models_are_trained(model_dir: Path = PROVINCIAL_DIR) -> bool:
    required = [
        "prophet_net.pkl", "prophet_lbs_in.pkl",
        "prophet_lbs_out.pkl", "lgbm_model.pkl",
    ]
    return all((model_dir / f).exists() for f in required)


# ── Internal helpers ──────────────────────────────────────────────────────────

def _prophet_predict(model, data: pd.DataFrame, top_features: list) -> pd.DataFrame:
    df_p = data[["Date"]].rename(columns={"Date": "ds"})
    for col in top_features:
        if col in data.columns:
            df_p[col] = data[col].values
    return model.predict(df_p)


def _alert_level(
    ensemble_gap_prob: float,
    threshold: float,
    gap: float,
    gap_stats: dict,
) -> str:
    # Probability below adaptive threshold → model predicts surplus
    if ensemble_gap_prob < threshold:
        return "OK"
    # Model predicts gap → severity by dollar amount
    if gap < gap_stats.get("critical_threshold", -999999):
        return "Critical"
    if gap < gap_stats.get("warn_threshold", 0):
        return "Warning"
    return "Watch"


# ── Historical in-sample predictions ─────────────────────────────────────────

def predict_historical(
    df_monthly: pd.DataFrame,
    models: dict,
    feature_cols: dict,
) -> pd.DataFrame:
    """Return df_monthly with LBS_In_pred and LBS_Out_pred columns added."""
    top_features = (feature_cols or {}).get("LBS_In", [])
    out = df_monthly[["Date", "LBS_In", "LBS_Out"]].copy()
    out["LBS_In_pred"]  = np.maximum(
        _prophet_predict(models["prophet_lbs_in"],  df_monthly, top_features)["yhat"].values, 0
    )
    out["LBS_Out_pred"] = np.maximum(
        _prophet_predict(models["prophet_lbs_out"], df_monthly, top_features)["yhat"].values, 0
    )
    return out


# ── Future forecast ───────────────────────────────────────────────────────────

def forecast_monthly(
    df_monthly: pd.DataFrame,
    models: dict,
    feature_cols: dict,
    months: int = 3,
) -> list[dict]:
    """
    Forecast the next `months` months using Prophet + LightGBM ensemble.

    Returns list of dicts with:
      period, month
      LBS_In_forecast, LBS_In_lower, LBS_In_upper
      LBS_Out_forecast, LBS_Out_lower, LBS_Out_upper
      Gap_forecast, alert, confidence_pct
    """
    config    = _load_config()
    gap_stats = load_gap_stats()
    metrics   = load_metrics()

    top_features = config.get("top_features", (feature_cols or {}).get("LBS_In", []))
    lookback     = int(config.get("lookback", 6))

    future_dates = pd.date_range(
        df_monthly["Date"].max() + pd.DateOffset(months=1),
        periods=months,
        freq="MS",
    )

    # Seed rolling windows from the tail of historical data
    rolling_in  = list(df_monthly["LBS_In"].tail(lookback).values)
    rolling_out = list(df_monthly["LBS_Out"].tail(lookback).values)
    rolling_net = list((df_monthly["LBS_In"] - df_monthly["LBS_Out"]).tail(lookback).values)

    # Adaptive threshold: ensemble probability above this → predicted gap
    threshold = float(config.get("threshold", 0.5))

    results = []
    for date in future_dates:
        # Build single-row Prophet input, carrying forward last known regressor values
        df_p = pd.DataFrame({"ds": [date]})
        for col in top_features:
            if col in df_monthly.columns:
                df_p[col] = df_monthly[col].iloc[-1]

        # Prophet point forecasts + 80% intervals
        fcst_net = models["prophet_net"].predict(df_p)
        fcst_in  = models["prophet_lbs_in"].predict(df_p)
        fcst_out = models["prophet_lbs_out"].predict(df_p)

        net_pred      = float(fcst_net["yhat"].iloc[0])
        lbs_in_pred   = max(float(fcst_in["yhat"].iloc[0]),  0.0)
        lbs_out_pred  = max(float(fcst_out["yhat"].iloc[0]), 0.0)

        in_lower  = max(float(fcst_in["yhat_lower"].iloc[0]),  0.0)
        in_upper  = max(float(fcst_in["yhat_upper"].iloc[0]),  0.0)
        out_lower = max(float(fcst_out["yhat_lower"].iloc[0]), 0.0)
        out_upper = max(float(fcst_out["yhat_upper"].iloc[0]), 0.0)

        # Ensemble gap probability (50/50 Prophet + LightGBM)
        prophet_gap_prob  = float(1 / (1 + np.exp(net_pred / 30000)))
        lags              = np.array(rolling_in + rolling_out + rolling_net).reshape(1, -1)
        lgbm_gap_prob     = float(models["lgbm"].predict_proba(lags)[0, 1])
        ensemble_gap_prob = 0.50 * prophet_gap_prob + 0.50 * lgbm_gap_prob
        surplus_prob      = 1.0 - ensemble_gap_prob

        gap   = lbs_in_pred - lbs_out_pred
        alert = _alert_level(ensemble_gap_prob, threshold, gap, gap_stats)
        # Per-row confidence: probability of the predicted class (gap or surplus)
        conf  = int(round((ensemble_gap_prob if alert != "OK" else surplus_prob) * 100))

        results.append({
            "period":            date.strftime("%Y-%m"),
            "month":             date.strftime("%b %Y"),
            "LBS_In_forecast":   round(lbs_in_pred,  0),
            "LBS_In_lower":      round(min(in_lower,  lbs_in_pred),  0),
            "LBS_In_upper":      round(max(in_upper,  lbs_in_pred),  0),
            "LBS_Out_forecast":  round(lbs_out_pred, 0),
            "LBS_Out_lower":     round(min(out_lower, lbs_out_pred), 0),
            "LBS_Out_upper":     round(max(out_upper, lbs_out_pred), 0),
            "Gap_forecast":      round(gap, 0),
            "alert":             alert,
            "confidence_pct":    conf,
            "gap_prob":          round(ensemble_gap_prob, 4),
        })

        # Advance rolling windows with this step's predictions
        rolling_in  = rolling_in[1:]  + [lbs_in_pred]
        rolling_out = rolling_out[1:] + [lbs_out_pred]
        rolling_net = rolling_net[1:] + [lbs_in_pred - lbs_out_pred]

    return results


def alert_message(alert: str, gap: float) -> str:
    sign = "+" if gap >= 0 else ""
    return f"{ALERT_LABELS[alert]} ({sign}{gap:,.0f} lbs)"
