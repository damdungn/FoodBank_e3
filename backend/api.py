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
import os
from datetime import datetime
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

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
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Cache ─────────────────────────────────────────────────────────────────────

_cache: dict = {}

_MONTHLY_JSON = Path(__file__).parent / "data" / "monthly_data.json"
_SIGNALS_JSON = Path(__file__).parent / "data" / "latest_signals.json"


def _daily_df() -> pd.DataFrame:
    """Last daily row used for /api/signals. Loads from JSON snapshot; falls back to CSV."""
    if "daily" not in _cache:
        if _SIGNALS_JSON.exists():
            row = json.load(open(_SIGNALS_JSON))
            _cache["daily"] = pd.DataFrame([row])
        else:
            _cache["daily"] = preprocess(load_data())
    return _cache["daily"]


def _monthly_df() -> pd.DataFrame:
    """Monthly aggregated dataframe. Loads from JSON snapshot; falls back to CSV."""
    if "monthly" not in _cache:
        if _MONTHLY_JSON.exists():
            df = pd.read_json(_MONTHLY_JSON, orient="records")
            df["Date"] = pd.to_datetime(df["Date"])
            df = df.sort_values("Date").reset_index(drop=True)
        else:
            df = aggregate_monthly(load_data())
        _cache["monthly"] = df
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
    # Economic / cost-of-living
    "CPI_Food": "economic",        "CPI_All_items": "economic",
    "CPI_Shelter": "economic",     "Unemployment_Rate": "economic",
    # Social / demographic
    "Net_Migration": "social",     "AISH_TOTAL": "social",
    "SINGLE_AISH_TOTAL": "social", "SINGLE_AISH_PARENT": "social",
    "EDMONTON_AISH_CASELOAD": "social",
    # Calendar / benefit payments
    "School_In_Session": "calendar", "Tax_Season": "calendar",
    "n_gst": "calendar",   "n_ccb": "calendar",
    "n_holidays": "calendar", "n_stat": "calendar",
    "n_acwb": "calendar",  "n_acfb": "calendar",
    "n_cdb": "calendar",   "n_cpp": "calendar",
    "n_oas": "calendar",   "n_ramadan": "calendar",
    "n_exam": "calendar",  "n_intl": "calendar",  "n_tax": "calendar",
    "month_of_year": "calendar", "quarter": "calendar",
    "month_sin": "calendar",     "month_cos": "calendar",
    # Weather
    "Mean_Temp": "weather",   "Total_Precip": "weather",
    "Snow_on_Grnd": "weather",
    # Autoregressive lag features (LAG_FEATURE_NAMES from train.py)
    **{f"LBS_In_lag{i}":  "autoregressive" for i in range(1, 7)},
    **{f"LBS_Out_lag{i}": "autoregressive" for i in range(1, 7)},
    **{f"net_lag{i}":     "autoregressive" for i in range(1, 7)},
    "net_3mo_avg": "autoregressive",  "net_6mo_avg": "autoregressive",
    "net_3mo_std": "autoregressive",  "net_6mo_std": "autoregressive",
    "in_momentum": "autoregressive",  "out_momentum": "autoregressive",
    "net_delta": "autoregressive",    "net_acceleration": "autoregressive",
    "demand_supply_ratio": "autoregressive",
    "deficit_streak": "autoregressive",
    "pressure_index": "autoregressive",
    "forecast_uncertainty": "autoregressive",
    # Legacy names kept for backwards compatibility
    "LBS_In_lag12": "autoregressive",  "LBS_Out_lag12": "autoregressive",
    "LBS_In_roll3": "autoregressive",  "LBS_Out_roll3": "autoregressive",
    "Gap_lag1": "autoregressive",
}


def _pretty(col: str) -> str:
    label_map = {
        # External regressors — staff-readable names
        "CPI_Food":      "Food price index",
        "AISH_TOTAL":    "Income support caseload",
        "Net_Migration": "Net migration",
        "Mean_Temp":     "Average temperature",
        # Legacy lag features
        "LBS_In_lag1": "Prev month inbound", "LBS_In_lag12": "Same month last year (in)",
        "LBS_Out_lag1": "Prev month outbound", "LBS_In_roll3": "3-month rolling avg (in)",
        "Gap_lag1": "Prev month gap", "month_of_year": "Month of year",
        "n_gst": "GST payment days", "n_ccb": "CCB payment days",
        "n_acwb": "ACWB payment days", "n_holidays": "Holiday days",
        "EDMONTON_AISH_CASELOAD": "Edmonton AISH caseload",
        "n_ramadan_lag1": "Post-Ramadan donation effect",
    }
    return label_map.get(col, col.replace("_", " ").title())


# ── AI chat proxy ─────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    messages: list[dict]
    systemPrompt: str = ""


@app.post("/api/chat")
def chat(req: ChatRequest):
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key or api_key == "paste-your-key-here":
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY not set in backend/.env")

    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model="gpt-4o",
            max_tokens=1000,
            messages=[
                {"role": "system", "content": req.systemPrompt},
                *req.messages,
            ],
        )
        return {"reply": response.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "provincial_trained": models_are_trained(PROVINCIAL_DIR),
        "regional_trained":   _regional_available(),
        "campus_trained":     _cfb_available(),
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

    def sig(name, level, category, description, value=None):
        entry = {"name": name, "level": level, "category": category, "description": description}
        if value is not None:
            entry["value"] = value
        return entry

    # ── Economic ──────────────────────────────────────────────────────────────
    cpi_food    = float(last.get("CPI_Food",          0) or 0)
    cpi_shelter = float(last.get("CPI_Shelter",       0) or 0)
    unemp       = float(last.get("Unemployment_Rate", 0) or 0)
    net_mig     = float(last.get("Net_Migration",     0) or 0)

    if cpi_food > 170:
        result.append(sig("Food prices are high", "High", "economic",
            "Grocery costs are well above normal — more households are likely to seek food bank support.",
            f"Food price index: {cpi_food:.0f}"))
    elif cpi_food > 155:
        result.append(sig("Food prices are elevated", "Medium", "economic",
            "Grocery costs are above average, which can strain tight household budgets.",
            f"Food price index: {cpi_food:.0f}"))

    if cpi_shelter > 190:
        result.append(sig("Housing costs are very high", "High", "economic",
            "High rent and housing costs leave less money for food — a key driver of food bank demand.",
            f"Shelter price index: {cpi_shelter:.0f}"))
    elif cpi_shelter > 175:
        result.append(sig("Housing costs are elevated", "Medium", "economic",
            "Above-average housing costs may be squeezing household budgets.",
            f"Shelter price index: {cpi_shelter:.0f}"))

    if unemp > 8:
        result.append(sig("Unemployment is high", "High", "economic",
            "A high jobless rate directly increases the number of families needing food bank support.",
            f"Unemployment rate: {unemp:.1f}%"))
    elif unemp > 6:
        result.append(sig("Unemployment is rising", "Medium", "economic",
            "Unemployment trending upward — an early warning sign of growing food bank demand.",
            f"Unemployment rate: {unemp:.1f}%"))

    if "AISH_TOTAL" in df_monthly.columns:
        aish_series = pd.to_numeric(df_monthly["AISH_TOTAL"], errors="coerce")
        aish_now    = float(aish_series.iloc[-1] or 0)
        aish_mean   = float(aish_series.mean())
        if aish_now > 0 and aish_mean > 0:
            if aish_now > aish_mean * 1.05:
                result.append(sig("Income support caseload is elevated", "High", "social",
                    "More people on income assistance than usual — this group relies heavily on food banks.",
                    f"AISH caseload: {aish_now:,.0f}"))
            elif aish_now >= aish_mean * 0.97:
                result.append(sig("Income support caseload is normal", "Medium", "social",
                    "AISH caseload is within its typical range.",
                    f"AISH caseload: {aish_now:,.0f}"))

    if net_mig > 10000:
        result.append(sig("High migration into Alberta", "High", "social",
            "Many newcomers arriving who may need food support while they settle.",
            f"Net migration: +{net_mig:,.0f}"))
    elif net_mig > 5000:
        result.append(sig("Migration into Alberta is elevated", "Medium", "social",
            "More newcomers than usual are arriving — some may seek food bank help.",
            f"Net migration: +{net_mig:,.0f}"))

    # ── Benefits / calendar ───────────────────────────────────────────────────
    if int(last.get("GST_Dates", 0) or 0) or int(last.get("CCB_Dates", 0) or 0):
        result.append(sig("Government benefit payment week", "Medium", "calendar",
            "GST/CCB cheques going out. Clients often visit the food bank around payment day."))

    if int(last.get("ACWB", 0) or 0) or int(last.get("ACFB", 0) or 0):
        result.append(sig("Income support cheques going out", "Medium", "calendar",
            "AISH and Alberta child benefit payments this week. Recipients often visit food banks around disbursement."))

    if int(last.get("CPP", 0) or 0) or int(last.get("OAS", 0) or 0):
        result.append(sig("Senior pension payment week", "Low", "calendar",
            "CPP and OAS payments this week. Seniors may visit the food bank before or after payment day."))

    if int(last.get("Tax_Season", 0) or 0):
        result.append(sig("Tax season", "Low", "calendar",
            "Tax filing period. Refund uncertainty can put pressure on tight budgets."))

    if int(last.get("Exam_Period", 0) or 0):
        result.append(sig("Student exam period", "Medium", "calendar",
            "Exam period is underway. Academic stress can increase visits from student clients."))

    if int(last.get("Tuition_Payment_Deadline", 0) or 0):
        result.append(sig("Tuition payment deadline", "Medium", "calendar",
            "Tuition deadlines this week. Student food bank visits tend to rise around this time."))

    if int(last.get("International_Arrival", 0) or 0):
        result.append(sig("International student arrivals", "Medium", "calendar",
            "New international students arriving. Many need food support while they get settled."))

    if int(last.get("holiday_is_stat", 0) or 0):
        result.append(sig("Statutory holiday this week", "Medium", "calendar",
            "Statutory holiday coming up. Some clients stock up or visit before the closure."))

    if int(last.get("holiday_is_ramadan", 0) or 0):
        result.append(sig("Ramadan", "Low", "calendar",
            "Ramadan is underway. Muslim clients may have different visit patterns this month."))

    if int(last.get("School_In_Session", 0) or 0):
        result.append(sig("School year is active", "Low", "calendar",
            "School in session. Family visit patterns tend to be regular and predictable."))

    if not result:
        result.append(sig("No major demand signals", "Low", "other",
            "Current economic and calendar indicators are all within normal ranges."))

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
            "date":           row.Date.strftime("%b %Y"),
            "inbound":        int(row.LBS_In),
            "outbound":       int(row.LBS_Out),
            "predicted":      round(float(row.LBS_In_pred), 0),
            "predicted_gap":  round(float(row.LBS_Net_pred), 0),
        }
        for row in hist.itertuples()
    ]

    # Append 3-month forecast (inbound/outbound = null → dashed in chart)
    for fc_row in forecast_monthly(df, models, fc, months=3):
        result.append({
            "date":           fc_row["month"],
            "inbound":        None,
            "outbound":       None,
            "predicted":      fc_row["LBS_In_forecast"],
            "predicted_gap":  round(float(fc_row["Gap_forecast"]), 0),
        })

    return {"historyData": result}


@app.get("/api/provincial/features")
def provincial_features():
    """External regressor importances (Prophet additive contributions) with category labels."""
    _require_prov()
    # Prefer the Prophet regressor importance file (external economic/social/weather factors).
    # Fall back to lag importances if the regressor file hasn't been generated yet.
    reg_path = PROVINCIAL_DIR / "importance_regressors.json"
    if reg_path.exists():
        importance = json.load(open(reg_path))
    else:
        importance = load_feature_importance("LBS_In", PROVINCIAL_DIR)

    if not importance:
        return {"featureData": []}

    total = sum(importance.values()) or 1.0
    return {
        "featureData": [
            {
                "name":       _pretty(name),
                "importance": round((val / total) * 100, 1),
                "category":   _CAT.get(name, "other"),
            }
            for name, val in importance.items()
        ]
    }


@app.get("/api/provincial/metrics")
def provincial_metrics():
    """Model performance stats for the Provincial stats panel."""
    _require_prov()
    metrics = load_metrics(PROVINCIAL_DIR)
    df      = _monthly_df()

    m_ensemble = metrics.get("ensemble", {})
    val_acc    = m_ensemble.get("val_acc", 0)
    n_months   = len(df)

    # Count external regressors from saved importance file
    reg_path = PROVINCIAL_DIR / "importance_regressors.json"
    n_regressors = len(json.load(open(reg_path))) if reg_path.exists() else 4

    stats = [
        {
            "label": "Shortfall detection accuracy",
            "value": f"{int(round(val_acc * 100))}%",
        },
        {
            "label": "What the model predicts",
            "value": "Monthly Supply Gap",
        },
        {
            "label": "Forecast horizon",
            "value": "3 months ahead",
        },
        {
            "label": "External indicators used",
            "value": f"{n_regressors-1} (food prices, income support, migration, temperature)",
        },
        {
            "label": "Historical data used",
            "value": f"{n_months} months ({df['Date'].min().year} – {df['Date'].max().strftime('%b %Y')})",
        },
        {
            "label": "Last retrained",
            "value": datetime.now().strftime("%b %d, %Y"),
        },
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


# ── Regional — Prophet forecast JSON (exported from Colab) ───────────────────
# Drop rdfb_forecast.json into backend/data/ to activate these endpoints.

REGIONAL_JSON = Path(__file__).parent / "data" / "rdfb_forecast.json"
CFB_JSON      = Path(__file__).parent / "data" / "cfb_forecast.json"


def _regional_available() -> bool:
    return REGIONAL_JSON.exists()


def _load_regional() -> dict:
    if "regional_json" not in _cache:
        if not _regional_available():
            raise HTTPException(
                status_code=503,
                detail=(
                    "Regional forecast not available. "
                    "Export rdfb_forecast_export.json from Colab and save it as "
                    "backend/data/rdfb_forecast.json."
                ),
            )
        with open(REGIONAL_JSON) as f:
            _cache["regional_json"] = json.load(f)
    return _cache["regional_json"]


@app.get("/api/regional/forecast")
def regional_forecast():
    """
    12-month Prophet hamper forecast with 80% CI.
    Returns both historical (actual + fitted) and forecast arrays.
    Supports new format (forecast/lower_80/upper_80/label) and old (yhat/lower/upper/month).
    """
    data = _load_regional()
    raw_fc = data.get("forecast", [])
    forecast_norm = [
        {
            "month":  r.get("label", r.get("month", "")),
            "yhat":   round(float(r.get("forecast", r.get("yhat", 0))), 1),
            "lower":  round(float(r.get("lower_80",  r.get("lower",  0))), 1),
            "upper":  round(float(r.get("upper_80",  r.get("upper",  0))), 1),
            "afbGap": r.get("afbGap", 0),
        }
        for r in raw_fc
    ]
    return {
        "historical":  data.get("historical", []),
        "forecast":    forecast_norm,
        "seasonality": data.get("seasonality", {}),
        "generatedAt": data.get("generated", data.get("generatedAt")),
    }


@app.get("/api/regional/features")
def regional_features():
    """SHAP-derived feature importance from the RDFB Prophet model."""
    data = _load_regional()
    raw  = data.get("featureImportance", [])
    total = sum(f["shap"] for f in raw) or 1.0

    _pretty_regional = {
        "EDMONTON_AISH_CASELOAD": "Edmonton AISH caseload",
        "SINGLE_AISH_TOTAL":      "Single AISH total",
        "CPI All-items":          "CPI All-items",
        "CPI Food":               "CPI Food",
        "School_In_Session":      "School in session",
    }

    return {
        "featureData": [
            {
                "name":       _pretty_regional.get(f["name"], f["name"].replace("_", " ").title()),
                "importance": round((f["shap"] / total) * 100, 1),
                "shap":       f["shap"],
            }
            for f in raw
        ]
    }


@app.get("/api/regional/metrics")
def regional_metrics():
    """Model performance stats for the RDFB Prophet model."""
    data = _load_regional()
    m    = data.get("metrics", data.get("accuracy", {}))

    return {
        "modelStats": [
            {"label": "MAE (in-sample)",   "value": f"{m.get('mae', 'N/A')} hampers/month"},
            {"label": "MAPE (in-sample)",  "value": f"{m.get('mape', 'N/A')}%"},
            {"label": "CV MAE",            "value": f"{m.get('cv_mae', 'N/A')} hampers/month"},
            {"label": "CV MAPE",           "value": f"{m.get('cv_mape', 'N/A')}%"},
            {"label": "Training months",   "value": str(m.get("trainingMonths", "N/A"))},
            {"label": "Training window",   "value": m.get("trainingWindow", "N/A")},
            {"label": "Model type",        "value": "Prophet + economic regressors"},
            {"label": "Forecast horizon",  "value": "12 months"},
            {"label": "Generated",         "value": data.get("generated", data.get("generatedAt", "N/A"))},
        ]
    }


@app.get("/api/regional/history")
def regional_history():
    """Alias for /api/regional/forecast (kept for backwards compat)."""
    return regional_forecast()


# ── Campus Food Bank — Prophet forecast JSON ──────────────────────────────────
# Drop cfb_forecast.json into backend/data/ to activate these endpoints.

def _cfb_available() -> bool:
    return CFB_JSON.exists()


def _load_cfb() -> dict:
    if "cfb_json" not in _cache:
        if not _cfb_available():
            raise HTTPException(
                status_code=503,
                detail="Campus FB forecast not available. Save cfb_forecast.json to backend/data/.",
            )
        with open(CFB_JSON) as f:
            _cache["cfb_json"] = json.load(f)
    return _cache["cfb_json"]


@app.get("/api/campus/forecast")
def campus_forecast():
    """25 months historical (actual + fitted) + 12-month visit forecast with 80% CI."""
    data = _load_cfb()
    raw_fc = data.get("forecast", [])
    forecast_norm = [
        {
            "month":  r.get("label", r.get("month", "")),
            "date":   r.get("month", ""),
            "yhat":   round(float(r.get("forecast", r.get("yhat", 0))), 1),
            "lower":  round(float(r.get("lower_80",  r.get("lower",  0))), 1),
            "upper":  round(float(r.get("upper_80",  r.get("upper",  0))), 1),
        }
        for r in raw_fc
    ]
    return {
        "historical":  data.get("historical", []),
        "forecast":    forecast_norm,
        "seasonality": data.get("seasonality", {}),
        "trends":      data.get("trends", {}),
        "accuracy":    data.get("accuracy", {}),
        "generatedAt": data.get("generated"),
    }


@app.get("/api/campus/features")
def campus_features():
    """Top demand drivers by Pearson correlation for the CFB Prophet model."""
    data = _load_cfb()
    drivers  = data.get("top_drivers", [])
    max_corr = max((d["correlation"] for d in drivers), default=1.0)
    return {
        "featureData": [
            {
                "name":        d["feature"].replace("_", " ").title(),
                "importance":  round((d["correlation"] / max_corr) * 100, 1),
                "correlation": round(d["correlation"], 3),
            }
            for d in drivers
        ]
    }


@app.get("/api/campus/metrics")
def campus_metrics():
    """Model performance stats for the CFB Prophet model."""
    data = _load_cfb()
    m    = data.get("accuracy", {})
    return {
        "modelStats": [
            {"label": "CV MAE",           "value": f"{m.get('cv_mae',         'N/A')} visits/month"},
            {"label": "CV MAPE",          "value": f"{m.get('cv_mape',        'N/A')}%"},
            {"label": "In-sample MAPE",   "value": f"{m.get('in_sample_mape', 'N/A')}%"},
            {"label": "Training months",  "value": "36"},
            {"label": "Training window",  "value": "May 2023 → Apr 2026"},
            {"label": "Model type",       "value": "Prophet + academic calendar"},
            {"label": "Forecast horizon", "value": "12 months"},
            {"label": "Generated",        "value": data.get("generated", "N/A")},
        ]
    }


@app.get("/api/campus/trends")
def campus_trends():
    """Food security trend indicators from CFB historical data (2023 vs 2026)."""
    data = _load_cfb()
    return {
        "trends":    data.get("trends", {}),
        "historical": data.get("historical", []),
    }


# ── Dev runner ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
