# ─────────────────────────────────────────────────────────────────────────────
# FEEDS — Prophet Experiment (Google Colab)
#
# Paste each cell into a Colab notebook in order, or run as a script.
# At the end you download 3 files — drop them into backend/models/provincial/
# and tell Claude to update predict.py.
#
# Baseline to beat (HW + XGBoost, 6-month test):
#   LBS_In  — R²=+0.49  RelMAE=76.2%  sMAPE=42.6%
#   LBS_Out — R²=+0.67  RelMAE=68.7%  sMAPE=32.3%
# ─────────────────────────────────────────────────────────────────────────────


# ── Cell 1 — Install (run once, restart runtime if prompted) ──────────────────

# !pip install prophet scikit-learn joblib -q


# ── Cell 2 — Imports ──────────────────────────────────────────────────────────

import warnings
warnings.filterwarnings("ignore")

import json, joblib
import numpy as np
import pandas as pd
from prophet import Prophet
from sklearn.metrics import mean_absolute_error, mean_squared_error

print("Imports OK")


# ── Cell 3 — Upload data.csv ──────────────────────────────────────────────────

from google.colab import files
print("Upload your data.csv:")
uploaded = files.upload()   # pick data.csv from your machine


# ── Cell 4 — Load and aggregate to monthly ────────────────────────────────────

COL_RENAME = {
    "CPI All-items": "CPI_All_items",
    "CPI Food":      "CPI_Food",
    "CPI Shelter":   "CPI_Shelter",
    "Net Migration": "Net_Migration",
}

def load_monthly(path="data.csv"):
    df = pd.read_csv(path, parse_dates=["Date"])
    df.rename(columns=COL_RENAME, inplace=True)

    for col in df.columns:
        if col != "Date":
            df[col] = pd.to_numeric(df[col], errors="coerce")

    lbs_cols  = ["LBS_In", "LBS_Out"]
    feat_cols = [c for c in df.columns if c not in ["Date"] + lbs_cols]

    df["Month"] = df["Date"].dt.to_period("M").dt.to_timestamp()
    agg = {c: "sum" for c in lbs_cols}
    agg.update({c: "mean" for c in feat_cols if c in df.columns})

    monthly = (
        df.groupby("Month").agg(agg)
        .reset_index()
        .rename(columns={"Month": "Date"})
        .dropna(subset=lbs_cols)
        .reset_index(drop=True)
    )
    return monthly

df = load_monthly()
print(f"Rows: {len(df)}  ({df['Date'].min().strftime('%b %Y')} → {df['Date'].max().strftime('%b %Y')})")


# ── Cell 5 — Train / test split (same as local baseline) ─────────────────────

TEST_MONTHS = 6
cutoff   = df["Date"].max() - pd.DateOffset(months=TEST_MONTHS)
df_train = df[df["Date"] <= cutoff].copy().reset_index(drop=True)
df_test  = df[df["Date"] >  cutoff].copy().reset_index(drop=True)

print(f"Train: {len(df_train)} months → up to {cutoff.strftime('%b %Y')}")
print(f"Test:  {len(df_test)} months")

# Pick whichever regressor columns exist in this dataset
CANDIDATE_REGRESSORS = [
    "CPI_Food", "Unemployment_Rate",
    "EDMONTON_AISH_CASELOAD", "AISH_TOTAL",
]
REGRESSORS = [c for c in CANDIDATE_REGRESSORS if c in df.columns]
print(f"Regressors available: {REGRESSORS}")


# ── Cell 6 — Helpers ──────────────────────────────────────────────────────────

def calc_metrics(actual, preds, label):
    actual = np.array(actual, dtype=float)
    preds  = np.array(preds,  dtype=float).clip(0)
    mae  = mean_absolute_error(actual, preds)
    rmse = np.sqrt(mean_squared_error(actual, preds))
    ss_res = np.sum((actual - preds) ** 2)
    ss_tot = np.sum((actual - actual.mean()) ** 2)
    r2     = 1.0 - ss_res / (ss_tot + 1e-12)
    nz     = actual > 0
    rel    = np.mean(np.abs(actual[nz] - preds[nz]) / actual[nz]) * 100
    smape  = np.mean(2 * np.abs(actual - preds) / (np.abs(actual) + np.abs(preds) + 1e-8)) * 100
    print(f"    {label:35s}  R²={r2:+.4f}  RelMAE={rel:.1f}%  sMAPE={smape:.1f}%")
    return {
        "r2":          round(float(r2),    4),
        "mae":         round(float(mae),   0),
        "rmse":        round(float(rmse),  0),
        "smape":       round(float(smape), 1),
        "rel_mae_pct": round(float(rel),   1),
        "mean_actual": round(float(actual.mean()), 0),
        "n_test":      int(len(actual)),
        "granularity": "monthly",
    }


def fit_prophet(train_df, target, regressors=None):
    prophet_df = train_df[["Date", target]].rename(columns={"Date": "ds", target: "y"})

    m = Prophet(
        yearly_seasonality=True,
        weekly_seasonality=False,
        daily_seasonality=False,
        seasonality_mode="multiplicative",
        changepoint_prior_scale=0.3,
        seasonality_prior_scale=10,
    )
    if regressors:
        for reg in regressors:
            m.add_regressor(reg, standardize=True)
        for reg in regressors:
            prophet_df[reg] = train_df[reg].values

    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        m.fit(prophet_df)
    return m


def predict_prophet(model, test_df, regressors=None):
    future = test_df[["Date"]].rename(columns={"Date": "ds"}).copy()
    if regressors:
        for reg in regressors:
            future[reg] = test_df[reg].values
    forecast = model.predict(future)
    return forecast["yhat"].clip(lower=0).values


# ── Cell 7 — Experiment A: Prophet alone ─────────────────────────────────────

print("\n" + "=" * 65)
print("EXPERIMENT A — Prophet alone (no external regressors)")
print("=" * 65)

results = {}

for target in ["LBS_In", "LBS_Out"]:
    print(f"\n  {target}:")
    m     = fit_prophet(df_train, target, regressors=None)
    preds = predict_prophet(m, df_test, regressors=None)
    met   = calc_metrics(df_test[target].values, preds, "Prophet (no regressors)")
    results[f"A_{target}"] = {"model": m, "metrics": met, "regressors": []}


# ── Cell 8 — Experiment B: Prophet + regressors ───────────────────────────────

print("\n" + "=" * 65)
print(f"EXPERIMENT B — Prophet + regressors: {REGRESSORS}")
print("=" * 65)

if not REGRESSORS:
    print("  No regressors found — skipping experiment B")
else:
    for target in ["LBS_In", "LBS_Out"]:
        print(f"\n  {target}:")
        m     = fit_prophet(df_train, target, regressors=REGRESSORS)
        preds = predict_prophet(m, df_test, regressors=REGRESSORS)
        met   = calc_metrics(df_test[target].values, preds, f"Prophet + {len(REGRESSORS)} regressors")
        results[f"B_{target}"] = {"model": m, "metrics": met, "regressors": REGRESSORS}


# ── Cell 9 — Summary vs baseline ─────────────────────────────────────────────

BASELINE = {
    "LBS_In":  {"r2": 0.4887, "rel_mae_pct": 76.2, "smape": 42.6},
    "LBS_Out": {"r2": 0.6720, "rel_mae_pct": 68.7, "smape": 32.3},
}

print("\n" + "=" * 65)
print("SUMMARY — vs HW+XGBoost baseline")
print("=" * 65)
print(f"  {'Model':<40} {'R² (In)':>8} {'R² (Out)':>9}")
print(f"  {'-'*40} {'-'*8} {'-'*9}")

for exp_label, exp_key in [("HW + XGBoost (current baseline)", None),
                             ("Prophet alone (Exp A)",           "A"),
                             ("Prophet + regressors (Exp B)",    "B")]:
    if exp_key is None:
        r2_in  = BASELINE["LBS_In"]["r2"]
        r2_out = BASELINE["LBS_Out"]["r2"]
    elif f"{exp_key}_LBS_In" not in results:
        continue
    else:
        r2_in  = results[f"{exp_key}_LBS_In"]["metrics"]["r2"]
        r2_out = results[f"{exp_key}_LBS_Out"]["metrics"]["r2"]
    print(f"  {exp_label:<40} {r2_in:>+8.4f} {r2_out:>+9.4f}")

print("\n  Higher R² = better.  Beat the baseline to justify switching.")


# ── Cell 10 — Pick winner and refit on FULL dataset ──────────────────────────

# !! CHANGE THIS based on Cell 9 results !!
# "A" = Prophet alone, "B" = Prophet + regressors
# Set to None to keep the current HW+XGBoost model
WINNER = "A"   # <-- change me after reading Cell 9 output

if WINNER is None:
    print("No winner chosen — keep the current HW+XGBoost model.")
else:
    print(f"\nRefitting winner ({WINNER}) on FULL dataset for deployment…")
    best_regressors = results[f"{WINNER}_LBS_In"]["regressors"]

    deployed = {}
    for target in ["LBS_In", "LBS_Out"]:
        m_full = fit_prophet(df, target, regressors=best_regressors if best_regressors else None)
        deployed[target] = m_full
        print(f"  {target} — refit done")

    # Save
    joblib.dump(deployed["LBS_In"],  "prophet_lbs_in.pkl")
    joblib.dump(deployed["LBS_Out"], "prophet_lbs_out.pkl")

    meta = {
        "model_type":  "prophet",
        "winner":      WINNER,
        "regressors":  best_regressors,
        "test_months": TEST_MONTHS,
        "metrics": {
            "LBS_In":  results[f"{WINNER}_LBS_In"]["metrics"],
            "LBS_Out": results[f"{WINNER}_LBS_Out"]["metrics"],
        },
    }
    with open("prophet_meta.json", "w") as f:
        json.dump(meta, f, indent=2)

    print("\nSaved: prophet_lbs_in.pkl  prophet_lbs_out.pkl  prophet_meta.json")


# ── Cell 11 — Download ────────────────────────────────────────────────────────

if WINNER is not None:
    files.download("prophet_lbs_in.pkl")
    files.download("prophet_lbs_out.pkl")
    files.download("prophet_meta.json")

    print("\nNext steps:")
    print("  1. Copy the 3 files into backend/models/provincial/")
    print("  2. Tell Claude — it will update predict.py to use Prophet (~20 lines)")
    print("  3. Restart the FastAPI server — no frontend changes needed")
