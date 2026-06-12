"""
Data loading, preprocessing, and monthly aggregation.

Two modes:
  daily   → load_data() + preprocess()           (not used for training anymore)
  monthly → load_data() + aggregate_monthly()    (used for training + prediction)
"""

import pandas as pd
import numpy as np
from pathlib import Path

DATA_PATH = Path(__file__).parent / "data" / "data.csv"

TARGET_COLS = ["LBS_In", "LBS_Out"]

# Columns that are already monthly — carry forward within month
ECONOMIC_COLS = [
    "Unemployment_Rate", "CPI_All_items", "CPI_Food", "CPI_Shelter",
    "Net_Migration", "AISH_TOTAL", "SINGLE_AISH_TOTAL",
    "SINGLE_AISH_PARENT", "EDMONTON_AISH_CASELOAD",
]

COL_RENAME = {
    "CPI All-items":    "CPI_All_items",
    "CPI Food":         "CPI_Food",
    "CPI Shelter":      "CPI_Shelter",
    "Net Migration":    "Net_Migration",
    "Mean Temp (°C)":   "Mean_Temp",
    "Total Precip (mm)":"Total_Precip",
    "Unemployment Rate ": "Unemployment_Rate",
}


# ── Daily loading ─────────────────────────────────────────────────────────────

def load_data() -> pd.DataFrame:
    df = pd.read_csv(DATA_PATH, parse_dates=["Date"])
    df = df.rename(columns=COL_RENAME)
    df = df.sort_values("Date").reset_index(drop=True)
    # AISH columns may be stored as comma-formatted strings ("70,472") — coerce to numeric
    for col in ["AISH_TOTAL", "SINGLE_AISH_TOTAL", "SINGLE_AISH_PARENT", "EDMONTON_AISH_CASELOAD"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col].astype(str).str.replace(",", ""), errors="coerce")
    return df


def _add_date_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["day_of_week"]  = df["Date"].dt.dayofweek
    df["day_of_month"] = df["Date"].dt.day
    df["month_num"]    = df["Date"].dt.month
    df["year"]         = df["Date"].dt.year
    df["quarter"]      = df["Date"].dt.quarter
    df["week_of_year"] = df["Date"].dt.isocalendar().week.astype(int)
    df["is_weekend"]   = (df["day_of_week"] >= 5).astype(int)
    return df


def preprocess(df: pd.DataFrame) -> pd.DataFrame:
    """Daily preprocessing — used only for the API signals endpoint."""
    df = _add_date_features(df)
    for col in ECONOMIC_COLS:
        if col in df.columns:
            df[col] = df[col].ffill().bfill()
    return df.fillna(0)


# ── Monthly aggregation ───────────────────────────────────────────────────────

# How each daily column collapses to a monthly value
_MONTHLY_AGG = {
    # Targets
    "LBS_In":  ("LBS_In",  "sum"),
    "LBS_Out": ("LBS_Out", "sum"),
    # Weather: monthly mean / total
    "Snow_on_Grnd": ("Snow_on_Grnd", "mean"),
    # Calendar: count of event-days in the month
    "n_holidays":  ("is_holiday",           "sum"),
    "n_stat":      ("holiday_is_stat",      "sum"),
    "n_gst":       ("GST_Dates",            "sum"),
    "n_ccb":       ("CCB_Dates",            "sum"),
    "n_school":    ("School_In_Session",    "sum"),
    "n_tax":       ("Tax_Season",           "sum"),
    "n_acwb":      ("ACWB",                 "sum"),
    "n_acfb":      ("ACFB",                 "sum"),
    "n_cdb":       ("CDB",                  "sum"),
    "n_cpp":       ("CPP",                  "sum"),
    "n_oas":       ("OAS",                  "sum"),
    "n_ramadan":   ("holiday_is_ramadan",   "sum"),
    "n_exam":      ("Exam_Period",          "sum"),
    "n_intl":      ("International_Arrival","sum"),
    # Weather (continued)
    "Mean_Temp":    ("Mean_Temp",    "mean"),
    "Total_Precip": ("Total_Precip", "sum"),
    # Calendar (continued)
    "n_nldb":  ("NLDB",     "sum"),
    "n_covid": ("is_covid", "sum"),
    # Economic: take last value of the month
    "Unemployment_Rate":      ("Unemployment_Rate",      "last"),
    "CPI_Food":               ("CPI_Food",               "last"),
    "CPI_Shelter":            ("CPI_Shelter",            "last"),
    "CPI_All_items":          ("CPI_All_items",          "last"),
    "Net_Migration":          ("Net_Migration",          "last"),
    "AISH_TOTAL":             ("AISH_TOTAL",             "last"),
    "SINGLE_AISH_TOTAL":      ("SINGLE_AISH_TOTAL",      "last"),
    "SINGLE_AISH_PARENT":     ("SINGLE_AISH_PARENT",     "last"),
    "EDMONTON_AISH_CASELOAD": ("EDMONTON_AISH_CASELOAD", "last"),
}


def aggregate_monthly(df: pd.DataFrame, min_lag: int = 3) -> pd.DataFrame:
    """
    Collapse daily rows into monthly totals/means.
    Then add:
      - Date features (month_of_year, year, quarter)
      - Lag features: lag-1, lag-2, lag-3, lag-12 for LBS_In and LBS_Out
      - 3-month rolling mean (shifted to avoid leakage)
      - Gap = LBS_In - LBS_Out  and  Gap_lag1
    Only rows where lags up to `min_lag` are unavailable are dropped.

    Parameters
    ----------
    min_lag : int
        Minimum lag that must be non-null for a row to be kept.
        Default 3 — retains all months except the first 3.
        Pass 12 to restore the original behaviour (drops first 12 months).
        The training pipeline uses LOOKBACK=6 so lags 4-12 may be NaN in
        early rows; train.py's fillna(0) pass handles those safely.
    """
    df = df.copy()
    for col in ECONOMIC_COLS:
        if col in df.columns:
            df[col] = df[col].ffill().bfill()

    df["ym"] = df["Date"].dt.to_period("M")

    agg_spec = {
        new_col: (src, func)
        for new_col, (src, func) in _MONTHLY_AGG.items()
        if src in df.columns
    }
    monthly = df.groupby("ym").agg(**agg_spec).reset_index()

    # Date features
    monthly["Date"]         = monthly["ym"].dt.to_timestamp()
    monthly["month_of_year"] = monthly["ym"].dt.month
    monthly["year"]          = monthly["ym"].dt.year
    monthly["quarter"]       = monthly["ym"].dt.quarter

    # Lag features (do NOT leak: shift before using)
    for lag in [1, 2, 3, 12]:
        monthly[f"LBS_In_lag{lag}"]  = monthly["LBS_In"].shift(lag)
        monthly[f"LBS_Out_lag{lag}"] = monthly["LBS_Out"].shift(lag)

    # 3-month rolling mean of the *previous* month's values
    monthly["LBS_In_roll3"]  = monthly["LBS_In"].shift(1).rolling(3, min_periods=2).mean()
    monthly["LBS_Out_roll3"] = monthly["LBS_Out"].shift(1).rolling(3, min_periods=2).mean()

    # Post-Ramadan signal: previous month's Ramadan days → captures donation hangover
    monthly["n_ramadan_lag1"] = monthly["n_ramadan"].shift(1).fillna(0)

    # Gap (actual surplus/deficit) and its lag
    monthly["Gap"]      = monthly["LBS_In"] - monthly["LBS_Out"]
    monthly["Gap_lag1"] = monthly["Gap"].shift(1)

    # Drop only the first `min_lag` months where short lags are unavailable.
    # lag-12 may still be NaN for early rows; callers needing it can pass
    # min_lag=12.  The training pipeline uses min_lag=3 (default) and fills
    # any remaining NaNs with 0 via its own fillna(0) pass.
    drop_cols = [c for c in [f"LBS_In_lag{min_lag}", f"LBS_Out_lag{min_lag}"]
                 if c in monthly.columns]
    if drop_cols:
        monthly = monthly.dropna(subset=drop_cols).reset_index(drop=True)

    return monthly


# ── Full monthly feature set (used for standalone XGBoost if needed) ──────────
MONTHLY_FEATURE_COLS = [
    "month_of_year", "year", "quarter",
    "LBS_In_lag1",  "LBS_In_lag2",  "LBS_In_lag3",  "LBS_In_lag12",
    "LBS_Out_lag1", "LBS_Out_lag2", "LBS_Out_lag3", "LBS_Out_lag12",
    "LBS_In_roll3", "LBS_Out_roll3", "Gap_lag1",
    "Unemployment_Rate", "CPI_Food", "CPI_Shelter", "CPI_All_items",
    "Net_Migration", "AISH_TOTAL", "EDMONTON_AISH_CASELOAD",
    "Mean_Temp", "Total_Precip", "Snow_on_Grnd",
    "n_holidays", "n_stat", "n_gst", "n_ccb", "n_school", "n_tax",
    "n_acwb", "n_acfb", "n_cdb", "n_cpp", "n_oas",
    "n_ramadan", "n_exam", "n_intl",
]

# ── Residual feature set (used by the XGBoost layer in the Prophet+XGBoost hybrid)
# No lag features — Prophet already handles the autocorrelation / trend.
# These are external features that explain WHY a month is above/below the trend.
RESIDUAL_FEATURE_COLS = [
    "month_of_year", "quarter",
    "Unemployment_Rate", "CPI_Food", "CPI_Shelter", "CPI_All_items",
    "Net_Migration", "AISH_TOTAL", "EDMONTON_AISH_CASELOAD",
    "Mean_Temp", "Total_Precip", "Snow_on_Grnd",
    "n_holidays", "n_stat", "n_gst", "n_ccb", "n_school", "n_tax",
    "n_acwb", "n_acfb", "n_cdb", "n_cpp", "n_oas",
    "n_ramadan", "n_exam", "n_intl",
]


def get_monthly_feature_cols(df_monthly: pd.DataFrame) -> list[str]:
    return [c for c in MONTHLY_FEATURE_COLS if c in df_monthly.columns]


def get_residual_feature_cols(df_monthly: pd.DataFrame) -> list[str]:
    return [c for c in RESIDUAL_FEATURE_COLS if c in df_monthly.columns]