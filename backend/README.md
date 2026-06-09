# FoodBank Forecast — Backend

XGBoost-based demand forecasting for Edmonton Food Bank, served via FastAPI.

## Setup

```bash
cd backend

# Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

## 1 — Add your data

Place `data.csv` in the `data/` folder:

```
backend/data/data.csv
```

The CSV must have these columns (tab- or comma-separated):

```
Date, Month, LBS_In, LBS_Out,
holiday_is_stat, holiday_is_religious, holiday_is_seasonal, holiday_is_cultural,
is_holiday, holiday_is_ramadan, is_stanley_season, is_covid,
School_In_Session, Tax_Season, GST_Dates, CCB_Dates, Semster_Start,
Tuition_Payment_Deadline, Exam_Period, Reading_Week, International_Arrival,
Spring_summer_Sem, ACWB, ACFB, NLDB, CDB, CPP, OAS,
Unemployment_Rate, CPI All-items, CPI Food, CPI Shelter, Net Migration,
AISH_TOTAL, SINGLE_AISH_TOTAL, SINGLE_AISH_PARENT, EDMONTON_AISH_CASELOAD,
Mean_Temp, Min_Temp, Max_Temp, Total_Precip, Snow_on_Grnd
```

## 2 — Train the models

```bash
python train.py
```

This saves model artefacts to `models/`:
- `xgb_lbs_in.pkl` / `xgb_lbs_out.pkl` — trained XGBoost models
- `importance_lbs_in.json` / `importance_lbs_out.json` — feature importances
- `feature_cols.json` — ordered feature column list
- `metrics.json` — MAE / RMSE / MAPE on the held-out 6-month test set
- `history_predictions.csv` — full in-sample predictions

## 3 — Start the API server

```bash
uvicorn api:app --reload --port 8000
```

The API is now available at `http://localhost:8000`.

Interactive docs: `http://localhost:8000/docs`

## API Endpoints

| Endpoint | Used by |
|---|---|
| `GET /api/health` | Health check |
| `GET /api/dashboard` | Dashboard (trend chart + KPIs) |
| `GET /api/provincial/history` | Provincial (history + forecast chart) |
| `GET /api/provincial/features` | Provincial (feature importance bar) |
| `GET /api/provincial/metrics` | Provincial (model stats panel) |
| `GET /api/signals` | Dashboard (signal cards sidebar) |

## File overview

```
backend/
├── data/            ← place data.csv here
├── models/          ← auto-populated by train.py
├── preprocess.py    ← data loading, column sanitisation, feature engineering
├── train.py         ← model training entry point
├── predict.py       ← inference helpers (imported by api.py)
├── api.py           ← FastAPI server
└── requirements.txt
```
