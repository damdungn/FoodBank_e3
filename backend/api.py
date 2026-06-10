"""
FastAPI server — serves monthly forecast data to the React frontend.

Run:
    uvicorn api:app --reload --port 8000

Endpoints
─────────
  GET /api/health
  GET /api/dashboard            Dashboard  — trend chart, KPI cards
  GET /api/signals              Dashboard  — demand signal cards
  GET /api/gap                  Dashboard  — supply-demand gap forecast + alert
  GET /api/provincial/history   Provincial — history + 3-month forecast chart
  GET /api/provincial/features  Provincial — feature importance bar chart
  GET /api/provincial/metrics   Provincial — model performance stats
  GET /api/regional/*           Placeholder (regional model not yet trained)
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from predict import (
    PROVINCIAL_DIR,
    alert_message,
    forecast_monthly,
    load_feature_cols,
    load_feature_importance,
    load_gap_stats,
    load_metrics,
    load_models,
    models_are_trained,
    predict_historical,
)
from preprocess import load_data, aggregate_monthly, preprocess

# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="FoodBank Forecast API", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:4173",
    ],
    allow_methods=["GET"],
    allow_headers=["*"],
)

# ── Cache ─────────────────────────────────────────────────────────────────────

_cache: dict = {}


def _daily_df() -> pd.DataFrame:
    """Preprocessed daily dataframe (used only for /api/signals)."""
    if "daily" not in _cache:
        _cache["daily"] = preprocess(load_data())
    return _cache["daily"]


def _monthly_df() -> pd.DataFrame:
    if "monthly" not in _cache:
        _cache["monthly"] = aggregate_monthly(load_data())
    return _cache["monthly"]


def _prov():
    if "prov_models" not in _cache:
        _cache["prov_models"] = load_models(PROVINCIAL_DIR)
        _cache["prov_fc"]     = load_feature_cols(PROVINCIAL_DIR)
    return _cache["prov_models"], _cache["prov_fc"]


def _require_prov():
    if not models_are_trained(PROVINCIAL_DIR):
        raise HTTPException(
            status_code=503,
            detail="Provincial model not trained. Run `python train.py` inside backend/.",
        )
    return _prov()


# ── Category labels ───────────────────────────────────────────────────────────

_CAT = {
    "CPI_Food": "economic",        "CPI_All_items": "economic",
    "CPI_Shelter": "economic",     "Unemployment_Rate": "economic",
    "Net_Migration": "social",     "AISH_TOTAL": "social",
    "SINGLE_AISH_TOTAL": "social", "SINGLE_AISH_PARENT": "social",
    "EDMONTON_AISH_CASELOAD": "social",
    "LBS_In_lag1": "autoregressive",  "LBS_In_lag2": "autoregressive",
    "LBS_In_lag3": "autoregressive",  "LBS_In_lag12": "autoregressive",
    "LBS_Out_lag1": "autoregressive", "LBS_Out_lag12": "autoregressive",
    "LBS_In_roll3": "autoregressive", "LBS_Out_roll3": "autoregressive",
    "Gap_lag1": "autoregressive",
    "School_In_Session": "calendar", "Tax_Season": "calendar",
    "n_gst": "calendar",   "n_ccb": "calendar",
    "n_holidays": "calendar", "n_stat": "calendar",
    "n_acwb": "calendar",  "n_acfb": "calendar",
    "n_cdb": "calendar",   "n_cpp": "calendar",
    "n_oas": "calendar",   "n_ramadan": "calendar",
    "n_exam": "calendar",  "n_intl": "calendar",  "n_tax": "calendar",
    "month_of_year": "calendar", "quarter": "calendar",
    "Mean_Temp": "weather",   "Total_Precip": "weather",
    "Snow_on_Grnd": "weather",
}


def _pretty(col: str) -> str:
    label_map = {
        "LBS_In_lag1": "Prev month inbound", "LBS_In_lag12": "Same month last year (in)",
        "LBS_Out_lag1": "Prev month outbound", "LBS_In_roll3": "3-month rolling avg (in)",
        "Gap_lag1": "Prev month gap", "month_of_year": "Month of year",
        "n_gst": "GST payment days", "n_ccb": "CCB payment days",
        "n_acwb": "ACWB payment days", "n_holidays": "Holiday days",
        "EDMONTON_AISH_CASELOAD": "Edmonton AISH caseload",
    }
    return label_map.get(col, col.replace("_", " ").title())


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "provincial_trained": models_are_trained(PROVINCIAL_DIR),
        "regional_trained":   False,
    }


# ── Dashboard ─────────────────────────────────────────────────────────────────

@app.get("/api/dashboard")
def dashboard():
    """
    Returns:
      trendData  — last 24 months actuals + 3-month forecast
                   { month, inbound, outbound } or { month, forecastIn, forecastOut }
      kpis       — current and previous month totals + % change
    """
    df = _monthly_df()
    models, fc = _require_prov()

    # Last 24 months historical
    hist = df.tail(24).copy()
    trend_data = [
        {
            "month":    row.Date.strftime("%b %Y"),
            "inbound":  int(row.LBS_In),
            "outbound": int(row.LBS_Out),
        }
        for row in hist.itertuples()
    ]

    # 3-month forecast appended (includes prediction intervals)
    forecasts = forecast_monthly(df, models, fc, months=3)
    for fc_row in forecasts:
        trend_data.append({
            "month":          fc_row["month"],
            "forecastIn":     int(fc_row["LBS_In_forecast"]),
            "forecastOut":    int(fc_row["LBS_Out_forecast"]),
            "forecastInLow":  int(fc_row["LBS_In_lower"]),
            "forecastInHigh": int(fc_row["LBS_In_upper"]),
            "forecastOutLow": int(fc_row["LBS_Out_lower"]),
            "forecastOutHigh":int(fc_row["LBS_Out_upper"]),
        })

    # KPIs
    this_m = df.iloc[-1]
    prev_m = df.iloc[-2]
    pct_in  = round((this_m.LBS_In  - prev_m.LBS_In)  / (prev_m.LBS_In  + 1) * 100, 1)
    pct_out = round((this_m.LBS_Out - prev_m.LBS_Out) / (prev_m.LBS_Out + 1) * 100, 1)

    return {
        "trendData": trend_data,
        "kpis": {
            "thisMonth": {
                "inbound":       int(this_m.LBS_In),
                "outbound":      int(this_m.LBS_Out),
                "gap":           int(this_m.LBS_In - this_m.LBS_Out),
            },
            "prevMonth": {
                "inbound":       int(prev_m.LBS_In),
                "outbound":      int(prev_m.LBS_Out),
            },
            "pctChange": {
                "inbound":  pct_in,
                "outbound": pct_out,
            },
        },
    }


@app.get("/api/signals")
def signals():
    """
    Demand signal cards derived from the most recent daily data row
    and the last two monthly aggregates (for trend-based signals).
    """
    df_daily   = _daily_df()
    df_monthly = _monthly_df()
    last       = df_daily.iloc[-1]
    m_now      = df_monthly.iloc[-1]

    result = []

    # ── Economic ──────────────────────────────────────────────────────────────
    cpi_food    = float(last.get("CPI_Food",          0) or 0)
    cpi_shelter = float(last.get("CPI_Shelter",       0) or 0)
    unemp       = float(last.get("Unemployment_Rate", 0) or 0)
    net_mig     = float(last.get("Net_Migration",     0) or 0)

    if cpi_food > 170:
        result.append({"name": "CPI Food elevated",        "level": "High",   "value": f"{cpi_food:.0f}"})
    elif cpi_food > 155:
        result.append({"name": "CPI Food elevated",        "level": "Medium", "value": f"{cpi_food:.0f}"})

    if cpi_shelter > 190:
        result.append({"name": "CPI Shelter elevated",     "level": "High",   "value": f"{cpi_shelter:.0f}"})
    elif cpi_shelter > 175:
        result.append({"name": "CPI Shelter elevated",     "level": "Medium", "value": f"{cpi_shelter:.0f}"})

    if unemp > 8:
        result.append({"name": "Unemployment elevated",    "level": "High",   "value": f"{unemp:.1f}%"})
    elif unemp > 6:
        result.append({"name": "Unemployment rising",      "level": "Medium", "value": f"{unemp:.1f}%"})

    if "AISH_TOTAL" in df_monthly.columns:
        aish_series = pd.to_numeric(df_monthly["AISH_TOTAL"], errors="coerce")
        aish_now    = float(aish_series.iloc[-1] or 0)
        aish_mean   = float(aish_series.mean())
        if aish_now > 0 and aish_mean > 0:
            if aish_now > aish_mean * 1.05:
                result.append({"name": "AISH caseload above average", "level": "High",   "value": f"{aish_now:,.0f}"})
            elif aish_now >= aish_mean * 0.97:
                result.append({"name": "AISH caseload at average",    "level": "Medium", "value": f"{aish_now:,.0f}"})

    if net_mig > 10000:
        result.append({"name": "High net migration",       "level": "High",   "value": f"+{net_mig:,.0f}"})
    elif net_mig > 5000:
        result.append({"name": "Elevated net migration",   "level": "Medium", "value": f"+{net_mig:,.0f}"})

    # ── Benefits / calendar ───────────────────────────────────────────────────
    if int(last.get("GST_Dates", 0) or 0) or int(last.get("CCB_Dates", 0) or 0):
        result.append({"name": "GST / CCB payment week",          "level": "Medium"})

    if int(last.get("ACWB", 0) or 0) or int(last.get("ACFB", 0) or 0):
        result.append({"name": "AISH / ACWB disbursement",        "level": "Medium"})

    if int(last.get("CPP", 0) or 0) or int(last.get("OAS", 0) or 0):
        result.append({"name": "CPP / OAS payment week",          "level": "Low"})

    if int(last.get("Tax_Season", 0) or 0):
        result.append({"name": "Tax season — filing pressure",    "level": "Low"})

    if int(last.get("Exam_Period", 0) or 0):
        result.append({"name": "Student exam period",             "level": "Medium"})

    if int(last.get("Tuition_Payment_Deadline", 0) or 0):
        result.append({"name": "Tuition payment deadline",        "level": "Medium"})

    if int(last.get("International_Arrival", 0) or 0):
        result.append({"name": "International arrival period",    "level": "Medium"})

    if int(last.get("holiday_is_stat", 0) or 0):
        result.append({"name": "Statutory holiday",               "level": "Medium"})

    if int(last.get("holiday_is_ramadan", 0) or 0):
        result.append({"name": "Ramadan",                         "level": "Low"})

    if int(last.get("School_In_Session", 0) or 0):
        result.append({"name": "School in session",               "level": "Low"})

    if not result:
        result.append({"name": "No major demand signals",         "level": "Low"})

    return {"signals": result}


@app.get("/api/gap")
def gap_forecast():
    """
    3-month supply-demand gap forecast with alert levels.

    Gap = LBS_In − LBS_Out (monthly totals)
      Positive → surplus (donations exceed distribution)
      Negative → shortfall (distribution exceeds donations)

    Alert levels are calibrated against historical gap distribution:
      Critical → gap < mean − 2σ  (severe shortfall, rarely seen historically)
      Warning  → gap < mean − 1σ  (below-normal supply cushion)
      Watch    → gap < 0          (any shortfall)
      OK       → gap ≥ 0
    """
    df = _monthly_df()
    models, fc = _require_prov()
    gap_stats = load_gap_stats()
    forecasts = forecast_monthly(df, models, fc, months=3)

    enriched = []
    for row in forecasts:
        enriched.append({
            **row,
            "alert_message": alert_message(row["alert"], row["Gap_forecast"]),
            "warn_threshold":     gap_stats.get("warn_threshold"),
            "critical_threshold": gap_stats.get("critical_threshold"),
        })

    # Historical gap for context
    df["Gap_actual"] = df["LBS_In"] - df["LBS_Out"]
    hist_gap = [
        {"month": row.Date.strftime("%b %Y"), "gap": int(row.Gap_actual)}
        for row in df.tail(12).itertuples()
    ]

    return {
        "forecastGap":  enriched,
        "historicalGap": hist_gap,
        "gapStats":     gap_stats,
    }


# ── Provincial ────────────────────────────────────────────────────────────────

@app.get("/api/provincial/history")
def provincial_history():
    """
    Monthly actuals + in-sample model fit + 3-month forecast.
    Feeds the ComposedChart in Provincial.jsx.
    """
    df     = _monthly_df()
    models, fc = _require_prov()

    hist = predict_historical(df, models, fc)
    result = [
        {
            "date":      row.Date.strftime("%b %Y"),
            "inbound":   int(row.LBS_In),
            "outbound":  int(row.LBS_Out),
            "predicted": round(float(row.LBS_In_pred), 0),
        }
        for row in hist.itertuples()
    ]

    # Append 3-month forecast (inbound/outbound = null → dashed in chart)
    for fc_row in forecast_monthly(df, models, fc, months=3):
        result.append({
            "date":      fc_row["month"],
            "inbound":   None,
            "outbound":  None,
            "predicted": fc_row["LBS_In_forecast"],
        })

    return {"historyData": result}


@app.get("/api/provincial/features")
def provincial_features():
    """Top-15 feature importances for LBS_In with category labels."""
    _require_prov()
    importance = load_feature_importance("LBS_In", PROVINCIAL_DIR)
    if not importance:
        return {"featureData": []}

    top   = list(importance.items())[:15]
    total = sum(v for _, v in top) or 1.0

    return {
        "featureData": [
            {
                "name":       _pretty(name),
                "importance": round((val / total) * 100, 1),
                "category":   _CAT.get(name, "other"),
            }
            for name, val in top
        ]
    }


@app.get("/api/provincial/metrics")
def provincial_metrics():
    """Model performance stats for the Provincial stats panel."""
    _require_prov()
    metrics      = load_metrics(PROVINCIAL_DIR)
    feature_cols = load_feature_cols(PROVINCIAL_DIR) or {}
    df           = _monthly_df()

    m          = metrics.get("LBS_In", metrics.get("in", {}))
    n_features = len(feature_cols.get("LBS_In", []))

    stats = [
        {"label": "MAE (LBS_In)",      "value": f"{m.get('mae', 'N/A'):,} lbs/month"},
        {"label": "Relative MAE",       "value": f"{m.get('rel_mae_pct', 'N/A')} %"},
        {"label": "sMAPE",              "value": f"{m.get('smape', 'N/A')} %"},
        {"label": "R² score",           "value": str(m.get("r2", "N/A"))},
        {"label": "Granularity",        "value": "Monthly totals"},
        {"label": "Last retrained",     "value": datetime.now().strftime("%b %d, %Y")},
        {
            "label": "Training window",
            "value": f"{df['Date'].min().year} – {df['Date'].max().strftime('%b %Y')}",
        },
        {"label": "Features used",      "value": f"{n_features} variables"},
        {"label": "Forecast horizon",   "value": "3 months"},
    ]
    return {"modelStats": stats}


# ── Model summary (honest accuracy assessment) ───────────────────────────────

@app.get("/api/model_summary")
def model_summary():
    """
    Plain-language accuracy assessment for the AI Insights chat and confidence badges.

    confidence_pct is derived from LightGBM gap classifier accuracy (not Prophet R²).
    Prediction intervals (80%) are attached to every forecast row.
    """
    _require_prov()
    metrics = load_metrics(PROVINCIAL_DIR)
    # metrics.json uses "in"/"out"/"ensemble" keys (not "LBS_In"/"LBS_Out")
    m_in       = metrics.get("LBS_In",  metrics.get("in",  {}))
    m_out      = metrics.get("LBS_Out", metrics.get("out", {}))
    m_ensemble = metrics.get("ensemble", {})

    r2_out   = m_out.get("r2", 0)
    r2_in    = m_in.get("r2",  0)
    gap_acc  = m_in.get("gap_accuracy",
               m_out.get("gap_accuracy",
               m_ensemble.get("val_acc", 0)))

    def _confidence_label(r2: float) -> str:
        if r2 >= 0.75: return "High"
        if r2 >= 0.50: return "Moderate"
        if r2 >= 0.30: return "Low"
        return "Very low"

    def _gap_confidence_label(acc: float) -> str:
        if acc >= 0.80: return "High"
        if acc >= 0.65: return "Moderate"
        if acc >= 0.50: return "Low"
        return "Very low"

    return {
        "confidence_pct":   int(round(max(0.0, min(1.0, gap_acc)) * 100)),
        "confidence_label": _gap_confidence_label(gap_acc),
        "interval_width":   "80%",
        "targets": {
            "LBS_Out": {
                "r2":             m_out.get("r2"),
                "smape":          m_out.get("smape"),
                "rel_mae_pct":    m_out.get("rel_mae_pct"),
                "confidence":     _confidence_label(r2_out),
                "interpretation": (
                    f"The model explains {int(round(max(0,r2_out)*100))}% of month-to-month "
                    f"variation in outbound distribution. Typical forecast error: "
                    f"±{m_out.get('smape','?')}%."
                ),
            },
            "LBS_In": {
                "r2":              m_in.get("r2"),
                "smape":           m_in.get("smape"),
                "rel_mae_pct":     m_in.get("rel_mae_pct"),
                "confidence":      _confidence_label(r2_in),
                "gap_accuracy":    m_in.get("gap_accuracy", m_ensemble.get("val_acc")),
                "gap_f1":          m_in.get("gap_f1",       m_ensemble.get("val_f1")),
                "gap_sur_recall":  m_in.get("gap_sur_recall", m_ensemble.get("val_recall")),
                "interpretation": (
                    f"Donations are inherently irregular — the model explains "
                    f"{int(round(max(0,r2_in)*100))}% of inbound variation. "
                    f"Use as a directional signal, not a precise target."
                ),
            },
        },
        "improvement_paths": [
            "More months of data (biggest single driver — each new month helps)",
            "Add current inventory/stock level as a feature",
            "Separate large corporate donors from general donations",
            "Retrain quarterly to adapt to shifting demand patterns",
        ],
    }


# ── Regional placeholders ─────────────────────────────────────────────────────

@app.get("/api/regional/history")
def regional_history():
    raise HTTPException(
        status_code=503,
        detail="Regional model not yet available. Supply regional_data.csv and run train_regional.py.",
    )


@app.get("/api/regional/features")
def regional_features():
    raise HTTPException(status_code=503, detail="Regional model not yet available.")


@app.get("/api/regional/metrics")
def regional_metrics():
    raise HTTPException(status_code=503, detail="Regional model not yet available.")


# ── Dev runner ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
