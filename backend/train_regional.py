"""
Train the Regional / Client Outlook forecasting model.

This script mirrors train.py but targets the regional dataset.
It will be activated once the second dataset is supplied.

Expected data file:  backend/data/regional_data.csv
Output artefacts:    backend/models/regional/

The regional model predicts client-level daily/weekly demand
(outbound = real client visits at Edmonton regional food bank).
It shares the same external features as the provincial model
but applies stronger weight to AISH caseload and CCB dates.

Run
───
  cd backend
  python train_regional.py
"""

# ── TODO: implement once regional_data.csv is provided ───────────────────────
# The pipeline will be identical to train.py with these changes:
#   • DATA_PATH  = data/regional_data.csv
#   • MODELS_DIR = models/regional/
#   • TARGET_COLS may differ (e.g. "Client_Visits" instead of LBS_In/LBS_Out)
#   • Forecast granularity: daily + weekly rolling aggregation

raise NotImplementedError(
    "Regional dataset not yet available. "
    "Supply backend/data/regional_data.csv and implement this script."
)
