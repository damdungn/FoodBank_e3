<img width="1408" height="768" alt="Gemini_Generated_Image_" src="https://github.com/user-attachments/assets/ca64fc0f-0aeb-4612-962a-bbd446d9030d" />

# FEEDS — Forecasting Engine for Estimating Demand and Supply

An AI-powered forecasting platform that helps Alberta food banks anticipate demand before it arrives.

Built by team E3 · AI4Good Lab 2026


## The Problem

Food banks across Alberta plan reactively. Staff estimate upcoming demand from experience and recent history alone, with no tools to look ahead. When food prices rise, government benefits shift, or a university semester begins, demand can spike faster than food banks are prepared for.

This affects every level of the network: provincial supply allocation, regional hamper preparation, and campus visit surges.


## How We Solve It

FEEDS combines each food bank's historical records with external signals, such as inflation, benefit schedules, weather, academic calendars, to generate monthly demand forecasts.

Three tiers are currently supported:

| Level | Organization | Forecasts |
|-------|-------------|-----------|
| Provincial | Food Banks Alberta | Inbound donations vs. outbound need; supply gap alerts |
| Regional | Red Deer Food Bank | Monthly hamper demand |
| Campus | U of A Campus Food Bank | Monthly student visit demand |


## Key Features

- **3-tier forecasting**: Provincial → Regional → Campus, each with its own model
- **Supply gap alerts**: flags months where provincial donations may fall short of member needs
- **Academic calendar model**: campus visits driven by exam periods and semester schedule, not economics
- **Model health indicators**: confidence scores shown per forecast
- **Cross-tier context**: regional page surfaces provincial gap status; provincial page shows downstream outlook


## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite, Recharts, inline styles |
| Backend | Python, FastAPI, uvicorn |
| Forecasting | Facebook Prophet, RandomForest (scikit-learn) |
| Data | Statistics Canada (CPI, AISH), U of A academic calendar, food bank operational records |
| Deployment | Vercel (frontend), Render (backend) |


## Future Implementation

- Add Edmonton Food Bank data to extend regional coverage
- Refine all three models as new monthly data arrives
- Test model portability to additional food banks across Alberta with minimal retraining
- Build staff-facing planning tools: recommendations, donor outreach triggers, and allocation summaries
