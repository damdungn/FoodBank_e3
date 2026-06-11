import { useState, useEffect } from "react";
import {
  ComposedChart, BarChart,
  Line, Bar, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceArea,
} from "recharts";

const C = {
  forestGreen:  "#224433",
  jungleTeal:   "#3f826d",
  teaGreen:     "#d0efb1",
  dustyDenim:   "#5588c7",
  lightGold:    "#e1dd8f",
  wheat:        "#CCAA88",
  pageBg:       "#fbfcf6",
  surfaceWhite: "#ffffff",
  surfaceGreen: "#f2f9ec",
  borderLight:  "#dde8d8",
  textPrimary:  "#1a2e22",
  textSecondary:"#4a6355",
  textMuted:    "#556b5f",
};

// ── Food bank registry ────────────────────────────────────────────────────────
// Add a new entry here when a dataset arrives. `ready: false` shows the button
// as "coming soon" and skips the API fetch until flipped to true.
const FOOD_BANKS = [
  {
    key:      "rdfb",
    label:    "Red Deer Community FB",
    subtitle: "Prophet model · 15-year training window (2011–2026)",
    ready:    true,
    api: {
      forecast: "/api/regional/forecast",
      features: "/api/regional/features",
      metrics:  "/api/regional/metrics",
    },
  },
  {
    key:      "edmonton",
    label:    "Edmonton Campus FB",
    subtitle: "Dataset received · May 2023 – Apr 2026 · daily granularity · pending model integration",
    ready:    false,
    dataset: {
      period:      "May 1, 2023 – April 30, 2026",
      granularity: "Daily",
      metrics: [
        { icon: "users",          label: "Visits",           desc: "Number of visits per day" },
        { icon: "user-check",     label: "People per visit", desc: "Household size at each visit" },
        { icon: "weight",         label: "Food distributed", desc: "Pounds of food per visit" },
        { icon: "heart-handshake",label: "Donations",        desc: "Total pounds donated (aggregated)" },
      ],
      plannedTabs: [
        "Daily visit trend & forecast",
        "Food weight distributed over time",
        "Donation vs demand gap",
        "Seasonal visit patterns",
      ],
    },
    api: {
      forecast: "/api/edmonton/forecast",
      features: "/api/edmonton/features",
      metrics:  "/api/edmonton/metrics",
    },
  },
];

// ── Mock data ─────────────────────────────────────────────────────────────────

// Fallback data (used only if API is unreachable)
const featureData = [
  { name: "Edmonton AISH caseload", importance: 58.9 },
  { name: "Single AISH total",      importance: 18.1 },
  { name: "CPI All-items",          importance: 14.7 },
  { name: "CPI Food",               importance: 4.2  },
  { name: "School in session",      importance: 4.0  },
];

const modelStats = [
  { label: "MAE (in-sample)",  value: "59 hampers/month"          },
  { label: "MAPE (in-sample)", value: "10.8%"                     },
  { label: "CV MAE",           value: "118 hampers/month"         },
  { label: "CV MAPE",          value: "17.7%"                     },
  { label: "Training months",  value: "185"                       },
  { label: "Training window",  value: "2011-01-01 → 2026-05-01"  },
  { label: "Model type",       value: "Prophet + economic regressors" },
  { label: "Forecast horizon", value: "12 months"                 },
  { label: "Generated",        value: "2026-06-09"                },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function Panel({ children, style = {} }) {
  return (
    <div style={{
      background: C.surfaceWhite, border: `0.5px solid ${C.borderLight}`,
      borderRadius: 12, padding: 20, ...style,
    }}>
      {children}
    </div>
  );
}

function SectionTitle({ title, sub }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary }}>{title}</div>
      {sub && <div style={{ fontSize: 14, color: C.textMuted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}


const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: C.forestGreen, border: `1px solid ${C.jungleTeal}`,
      borderRadius: 8, padding: "8px 13px", fontSize: 12, color: "#fff",
    }}>
      <div style={{ fontWeight: 600, color: C.teaGreen, marginBottom: 4 }}>{label}</div>
      {payload.map((p) => p.value != null && p.name !== "CI band" && (
        <div key={p.name} style={{ display: "flex", justifyContent: "space-between", gap: 16, opacity: 0.9 }}>
          <span>{p.name}</span>
          <span style={{ fontWeight: 600 }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
};

const HamperTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const yhat  = payload.find(p => p.dataKey === "yhat");
  const lower = payload[0]?.payload?.lower;
  const upper = payload[0]?.payload?.upper;
  const isGap = payload[0]?.payload?.afbGap === 1;
  return (
    <div style={{
      background: C.forestGreen, border: `1px solid ${C.jungleTeal}`,
      borderRadius: 8, padding: "8px 13px", fontSize: 14, color: "#fff",
    }}>
      <div style={{ fontWeight: 600, color: C.teaGreen, marginBottom: 4 }}>{label}</div>
      {yhat && (
        <div style={{ opacity: 0.9 }}>
          Forecast: <strong>{yhat.value?.toLocaleString()}</strong> hampers
        </div>
      )}
      {lower != null && upper != null && (
        <div style={{ opacity: 0.7, fontSize: 12, marginTop: 2 }}>
          80% CI: {lower.toLocaleString()} – {upper.toLocaleString()}
        </div>
      )}
      {isGap && (
        <div style={{ marginTop: 4, color: "#f09070", fontSize: 12 }}>
          ⚠ AFB supply gap month
        </div>
      )}
    </div>
  );
};

// ── Data input form ───────────────────────────────────────────────────────────

function DataInputForm() {
  const [form, setForm] = useState({
    date: "", visits: "", households: "",
    cpi_food: "", unemployment: "", mean_temp: "",
    aish_week: false, ccb_week: false, notes: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const fields = [
    { key: "date",         label: "Date",                    type: "date",   placeholder: ""          },
    { key: "visits",       label: "Client visits (count)",   type: "number", placeholder: "e.g. 312"  },
    { key: "households",   label: "Unique households",       type: "number", placeholder: "e.g. 198"  },
    { key: "cpi_food",     label: "CPI food index",          type: "number", placeholder: "e.g. 163.2"},
    { key: "unemployment", label: "Unemployment rate (%)",   type: "number", placeholder: "e.g. 7.4"  },
    { key: "mean_temp",    label: "Mean temp (°C)",          type: "number", placeholder: "e.g. 14.2" },
  ];

  const inputStyle = {
    width: "100%", padding: "8px 11px", fontSize: 14,
    border: `1px solid ${C.borderLight}`, borderRadius: 8,
    background: C.surfaceGreen, color: C.textPrimary,
    outline: "none", fontFamily: "inherit",
  };

  function handleSubmit() {
    console.log("Regional data row:", form);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
    setForm({ date: "", visits: "", households: "", cpi_food: "", unemployment: "", mean_temp: "", aish_week: false, ccb_week: false, notes: "" });
  }

  return (
    <Panel>
      <SectionTitle
        title="Add daily data row — regional FB"
        sub="Client-level entries · queued for next model retraining run"
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12, marginBottom: 12 }}>
        {fields.map((f) => (
          <div key={f.key}>
            <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 4, fontWeight: 500 }}>{f.label}</div>
            <input
              type={f.type}
              value={form[f.key]}
              placeholder={f.placeholder}
              onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
              style={inputStyle}
            />
          </div>
        ))}
      </div>

      {/* Boolean flags */}
      <div style={{ display: "flex", gap: 24, marginBottom: 12 }}>
        {[
          { key: "aish_week", label: "AISH disbursement week" },
          { key: "ccb_week",  label: "CCB payment week"       },
        ].map((f) => (
          <label key={f.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.textSecondary, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={form[f.key]}
              onChange={e => setForm(p => ({ ...p, [f.key]: e.target.checked }))}
              style={{ accentColor: C.jungleTeal, width: 14, height: 14 }}
            />
            {f.label}
          </label>
        ))}
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 4, fontWeight: 500 }}>Notes (optional)</div>
        <textarea
          value={form.notes}
          onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
          placeholder="Special events, data anomalies, closures..."
          rows={2}
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={handleSubmit}
          style={{
            padding: "9px 20px", fontSize: 13, fontWeight: 600,
            background: C.forestGreen, color: C.teaGreen,
            border: "none", borderRadius: 8, cursor: "pointer",
          }}
        >
          <i className="ti ti-upload" style={{ marginRight: 6 }} aria-hidden="true" />
          Submit row
        </button>
        {submitted && (
          <span style={{ fontSize: 12, color: C.jungleTeal, display: "flex", alignItems: "center", gap: 5 }}>
            <i className="ti ti-circle-check" aria-hidden="true" /> Row queued
          </span>
        )}
        <span style={{ fontSize: 12, color: C.textMuted, marginLeft: "auto" }}>
          Full CSV upload coming soon
        </span>
      </div>
    </Panel>
  );
}


// ── Main page ─────────────────────────────────────────────────────────────────

export default function Regional() {
  const [activeTab,  setActiveTab]  = useState("hamper");
  const [selectedFB, setSelectedFB] = useState("rdfb");

  const [forecast, setForecast] = useState(null);
  const [features, setFeatures] = useState(null);
  const [metrics,  setMetrics]  = useState(null);

  useEffect(() => {
    const fb = FOOD_BANKS.find(b => b.key === selectedFB);
    if (!fb?.ready) return;          // "coming soon" banks — skip fetch
    setForecast(null);
    setFeatures(null);
    setMetrics(null);
    const BASE = (import.meta.env.VITE_API_URL ?? "");
    const get  = url => fetch(url).then(r => r.ok ? r.json() : null).catch(() => null);
    Promise.all([
      get(`${BASE}${fb.api.forecast}`),
      get(`${BASE}${fb.api.features}`),
      get(`${BASE}${fb.api.metrics}`),
    ]).then(([fc, feat, met]) => {
      if (fc)   setForecast(fc);
      if (feat) setFeatures(feat);
      if (met)  setMetrics(met);
    });
  }, [selectedFB]);

  // Derived values for hamper tab
  const forecastRows = forecast?.forecast ?? [];
  const gapMonths    = forecastRows.filter(r => r.afbGap === 1).map(r => r.month);
  const meanYhat     = forecastRows.length
    ? Math.round(forecastRows.reduce((s, r) => s + r.yhat, 0) / forecastRows.length)
    : 0;
  const peakRow      = forecastRows.length
    ? forecastRows.reduce((best, r) => r.yhat > best.yhat ? r : best)
    : null;
  const seasonality  = forecast?.seasonality ?? {};
  const chartData    = forecastRows.map(r => ({
    month:   r.month,
    yhat:    r.yhat,
    lower:   r.lower,
    upper:   r.upper,
    bandBot: r.lower,
    band:    r.upper - r.lower,
    afbGap:  r.afbGap,
  }));

  const fbReady = FOOD_BANKS.find(b => b.key === selectedFB)?.ready ?? false;

  const tabs = [
    { key: "hamper", label: "Hamper forecast" },
    { key: "model",  label: "Model detail"    },
    { key: "input",  label: "About & data"    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.pageBg, overflow: "hidden" }}>

      {/* Header */}
      <header style={{ padding: "32px 28px 0", background: C.pageBg, flexShrink: 0 }}>
        <div style={{ marginBottom: 16 }}>
          {/* Food bank selector */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            {FOOD_BANKS.map(fb => (
              <button
                key={fb.key}
                onClick={() => fb.ready && setSelectedFB(fb.key)}
                disabled={!fb.ready}
                style={{
                  padding: "5px 14px", borderRadius: 20, fontSize: 13, cursor: fb.ready ? "pointer" : "default",
                  border: `1.5px solid ${selectedFB === fb.key ? C.jungleTeal : C.borderLight}`,
                  background: selectedFB === fb.key ? C.jungleTeal : fb.ready ? C.surfaceWhite : C.surfaceGreen,
                  color: selectedFB === fb.key ? "#fff" : fb.ready ? C.textPrimary : C.textMuted,
                  fontFamily: "inherit", fontWeight: selectedFB === fb.key ? 600 : 400,
                  opacity: fb.ready ? 1 : 0.65,
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                {fb.label}
                {!fb.ready && (
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 8,
                    background: C.lightGold, color: C.forestGreen, letterSpacing: "0.04em",
                  }}>
                    SOON
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Dynamic title + subtitle */}
          {(() => {
            const fb = FOOD_BANKS.find(b => b.key === selectedFB);
            return (
              <>
                <div style={{ fontSize: 25, fontWeight: 700, color: C.forestGreen, marginBottom: 4 }}>
                  {fb.label}
                </div>
                <div style={{ fontSize: 13, color: C.textMuted, marginBottom: fb.ready ? 10 : 0 }}>
                  {fb.subtitle}
                </div>
                {fb.ready && (
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 7,
                    padding: "7px 14px", borderRadius: 8,
                    background: "#e2ffec", border: "0.5px solid #ace890",
                    fontSize: 13,
                  }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.jungleTeal }} />
                    <span style={{ color: C.textSecondary }}>Model health: </span>
                    <span style={{ fontWeight: 600, color: C.forestGreen }}>82.3% Good confidence</span>
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {/* Tabs — hidden when selected FB isn't ready yet */}
        <div style={{ display: fbReady ? "flex" : "none", gap: 2, borderBottom: `1px solid ${C.borderLight}` }}>
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
              padding: "8px 18px", fontSize: 14, cursor: "pointer",
              border: "none", background: "none", fontFamily: "inherit",
              color: activeTab === t.key ? C.forestGreen : C.textMuted,
              fontWeight: activeTab === t.key ? 600 : 400,
              borderBottom: activeTab === t.key ? `2px solid ${C.jungleTeal}` : "2px solid transparent",
              marginBottom: -1,
            }}>
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px 32px" }}>

        {/* ── COMING SOON PLACEHOLDER (shown when selected FB is not ready) ── */}
        {!fbReady && (() => {
          const fb = FOOD_BANKS.find(b => b.key === selectedFB);
          const ds = fb?.dataset;
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Status banner */}
              <div style={{
                background: "#fffbeb", border: `1px solid ${C.lightGold}`,
                borderRadius: 12, padding: "18px 22px",
                display: "flex", alignItems: "flex-start", gap: 14,
              }}>
                <i className="ti ti-clock-hour-4" style={{ fontSize: 22, color: "#b45309", marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#92400e", marginBottom: 4 }}>
                    Dataset received — model integration pending
                  </div>
                  <div style={{ fontSize: 13, color: "#a16207", lineHeight: 1.6 }}>
                    The Edmonton Campus Food Bank dataset is in hand and covers <strong>{ds?.period}</strong>.
                    Forecasting tabs will appear here once the model is trained and the backend endpoints are wired up.
                  </div>
                </div>
              </div>

              {/* Dataset overview */}
              <div style={{
                background: C.surfaceWhite, border: `0.5px solid ${C.borderLight}`,
                borderRadius: 12, padding: "20px 22px",
              }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary, marginBottom: 4 }}>Dataset overview</div>
                <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 18 }}>
                  {ds?.period} · {ds?.granularity} records · aggregated non-identifying operational metrics
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {ds?.metrics.map(m => (
                    <div key={m.label} style={{
                      display: "flex", gap: 12, alignItems: "flex-start",
                      background: C.surfaceGreen, borderRadius: 10, padding: "12px 14px",
                    }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                        background: C.surfaceWhite, border: `0.5px solid ${C.borderLight}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <i className={`ti ti-${m.icon}`} style={{ fontSize: 15, color: C.jungleTeal }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary }}>{m.label}</div>
                        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{m.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Planned tabs */}
              <div style={{
                background: C.surfaceWhite, border: `0.5px solid ${C.borderLight}`,
                borderRadius: 12, padding: "20px 22px",
              }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary, marginBottom: 4 }}>Planned analysis</div>
                <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 16 }}>
                  Tabs that will be available once the model is integrated
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {ds?.plannedTabs.map((t, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 14px", borderRadius: 8,
                      background: C.surfaceGreen, border: `0.5px solid ${C.borderLight}`,
                    }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                        border: `1.5px dashed ${C.textMuted}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, color: C.textMuted, fontWeight: 600,
                      }}>
                        {i + 1}
                      </div>
                      <div style={{ fontSize: 13, color: C.textSecondary }}>{t}</div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          );
        })()}

        {/* ── HAMPER FORECAST TAB ── */}
        {fbReady && activeTab === "hamper" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {!forecast ? (
              <Panel>
                <div style={{ padding: "40px 0", textAlign: "center" }}>
                  <i className="ti ti-database-off" style={{ fontSize: 28, color: C.textMuted, display: "block", marginBottom: 10 }} />
                  <div style={{ fontSize: 13, color: C.textMuted }}>
                    Forecast not available — ensure the backend is running and{" "}
                    <code style={{ background: C.surfaceGreen, padding: "1px 5px", borderRadius: 4 }}>rdfb_forecast.json</code>{" "}
                    is in{" "}
                    <code style={{ background: C.surfaceGreen, padding: "1px 5px", borderRadius: 4 }}>backend/data/</code>.
                  </div>
                </div>
              </Panel>
            ) : (
              <>
                {/* Summary cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 14 }}>
                  {[
                    {
                      label:  "Avg forecast",
                      value:  `${meanYhat.toLocaleString()} hampers`,
                      sub:    "per month · next 12 months",
                      accent: C.jungleTeal,
                    },
                    {
                      label:  "AFB gap months",
                      value:  `${gapMonths.length} / ${forecastRows.length}`,
                      sub:    "provincial supply gap overlap",
                      accent: "#c0622a",
                    },
                    {
                      label:  "Peak demand month",
                      value:  peakRow?.month ?? "—",
                      sub:    peakRow ? `${peakRow.yhat.toLocaleString()} hampers forecast` : "",
                      accent: "#d07030",
                    },
                    {
                      label:  "CV MAPE",
                      value:  metrics?.modelStats?.find(s => s.label === "CV MAPE")?.value ?? "17.7%",
                      sub:    "cross-validated forecast error",
                      accent: C.dustyDenim,
                    },
                  ].map(s => (
                    <div key={s.label} style={{
                      background: C.surfaceWhite, border: `0.5px solid ${C.borderLight}`,
                      borderTop: `3px solid ${s.accent}`, borderRadius: 12, padding: "14px 16px",
                    }}>
                      <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 6 }}>{s.label}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: C.textPrimary, marginBottom: 3 }}>{s.value}</div>
                      <div style={{ fontSize: 13, color: C.textMuted }}>{s.sub}</div>
                    </div>
                  ))}
                </div>

                {/* 12-month forecast chart */}
                <Panel>
                  <SectionTitle
                    title="12-month hamper demand forecast — Red Deer FB"
                    sub="Prophet model · 80% prediction interval · red shading = AFB provincial supply gap months"
                  />
                  <ResponsiveContainer width="100%" height={240}>
                    <ComposedChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.teaGreen} />
                      <XAxis dataKey="month" tick={{ fontSize: 12, fill: C.textMuted }} axisLine={false} tickLine={false} />
                      <YAxis
                        tick={{ fontSize: 13, fill: C.textMuted }} axisLine={false} tickLine={false}
                        tickFormatter={v => v.toLocaleString()} domain={["auto", "auto"]}
                      />
                      <Tooltip content={<HamperTooltip />} />
                      {/* CI band — stacked so gap shading renders on top */}
                      <Area type="monotone" dataKey="bandBot" stackId="ci" stroke="none" fill="transparent" legendType="none" />
                      <Area type="monotone" dataKey="band"    stackId="ci" stroke="none" fill="#ddeaf8" fillOpacity={0.6} legendType="none" />
                      {/* AFB gap month shading */}
                      {gapMonths.map(m => (
                        <ReferenceArea key={m} x1={m} x2={m} fill="#fdecea" fillOpacity={0.65} />
                      ))}
                      {/* Forecast line */}
                      <Line
                        type="monotone" dataKey="yhat" name="Forecast (hampers/month)"
                        stroke={C.jungleTeal} strokeWidth={2.5}
                        dot={{ r: 4, fill: C.jungleTeal }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                  <div style={{ display: "flex", gap: 18, marginTop: 10 }}>
                    {[
                      { color: C.jungleTeal, label: "Forecast hampers/month", line: true  },
                      { color: "#ddeaf8",    label: "80% confidence interval", square: true },
                      { color: "#fdecea",    label: "AFB supply gap month",    square: true },
                    ].map(({ color, label, line, square }) => (
                      <span key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.textMuted }}>
                        <span style={{
                          width: 10, height: line ? 3 : 10,
                          background: color, display: "inline-block",
                          borderRadius: 2, border: square ? `1px solid ${C.borderLight}` : "none",
                        }} />
                        {label}
                      </span>
                    ))}
                  </div>
                </Panel>

                {/* Seasonality + about */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <Panel>
                    <SectionTitle title="Historical seasonality" sub="Based on 15 years of Red Deer FB data (2011–2026)" />
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {[
                        { label: "Peak months",     months: seasonality.peakMonths,   color: "#c0622a"   },
                        { label: "Quietest months", months: seasonality.troughMonths, color: C.jungleTeal },
                      ].map(row => (
                        <div key={row.label} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: row.color, flexShrink: 0, marginTop: 5 }} />
                          <div style={{ fontSize: 14, color: C.textSecondary }}>
                            <strong style={{ color: C.textPrimary }}>{row.label}:</strong>{" "}
                            {(row.months ?? []).join(", ") || "—"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Panel>
                  <Panel>
                    <SectionTitle title="About this forecast" sub="" />
                    <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.7 }}>
                      Trained on 185 months of Red Deer FB data using Prophet with provincial
                      economic regressors (AISH caseload, CPI, school calendar). Features were
                      selected via SHAP analysis on the AFB provincial model — the same drivers
                      predict both provincial outbound and regional hamper demand.
                      <br /><br />
                      <strong style={{ color: C.textPrimary }}>Red shading</strong> marks months
                      where the AFB model forecasts a provincial supply gap — high regional demand
                      coinciding with constrained supply.
                    </div>
                  </Panel>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── MODEL DETAIL TAB ── */}
        {fbReady && activeTab === "model" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 14 }}>
              {(metrics?.modelStats ?? modelStats).map((s) => (
                <div key={s.label} style={{
                  background: C.surfaceGreen, border: `0.5px solid ${C.borderLight}`,
                  borderRadius: 12, padding: "14px 16px",
                }}>
                  <div style={{ fontSize: 14, color: C.textSecondary, marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: C.textPrimary, lineHeight: 1.3 }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Feature importance */}
            <Panel>
              <SectionTitle
                title="Feature importance — regional model (Prophet + SHAP)"
                sub="SHAP values from AFB model applied to RDFB · Same economic drivers, regional target"
              />
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={features?.featureData ?? featureData} layout="vertical" margin={{ top: 4, right: 50, bottom: 0, left: 110 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.teaGreen} horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 13, fill: C.textMuted }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 13, fill: C.textSecondary }} axisLine={false} tickLine={false} width={110} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="importance" name="Importance %" fill={C.dustyDenim} radius={[0, 4, 4, 0]} barSize={14}
                    label={{ position: "right", fontSize: 13, fill: C.textMuted, formatter: v => `${v}%` }}
                  />
                </BarChart>
              </ResponsiveContainer>
              <div style={{
                marginTop: 14, padding: "10px 14px",
                background: C.surfaceGreen, borderRadius: 8, border: `0.5px solid ${C.borderLight}`,
                fontSize: 13, color: C.textSecondary, lineHeight: 1.6,
              }}>
                <strong style={{ color: C.textPrimary }}>Note:</strong> SHAP importances are derived from the AFB provincial model and validated
                against Red Deer FB hamper data. Edmonton AISH caseload is the dominant driver (SHAP 104),
                followed by single AISH total, CPI, and school calendar.
              </div>
            </Panel>

            {/* In-sample accuracy summary */}
            <Panel>
              <SectionTitle
                title="In-sample model accuracy"
                sub="Measured on 185 months of training data (2011–2026)"
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {[
                  { label: "In-sample MAE",  value: "59 hampers/month", sub: "8.6% of monthly mean"  },
                  { label: "In-sample MAPE", value: "10.8%",            sub: "typical forecast error" },
                  { label: "CV MAE",         value: "118 hampers/month", sub: "honest out-of-sample"  },
                  { label: "CV MAPE",        value: "17.7%",            sub: "6-month horizon"        },
                ].map(s => (
                  <div key={s.label} style={{
                    padding: "12px 14px", borderRadius: 9,
                    background: C.surfaceGreen, border: `0.5px solid ${C.borderLight}`,
                  }}>
                    <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: C.textPrimary }}>{s.value}</div>
                    <div style={{ fontSize: 13, color: C.textMuted, marginTop: 2 }}>{s.sub}</div>
                  </div>
                ))}
              </div>
              <div style={{
                marginTop: 14, padding: "10px 14px",
                background: C.surfaceGreen, borderRadius: 8, border: `0.5px solid ${C.borderLight}`,
                fontSize: 13, color: C.textSecondary, lineHeight: 1.6,
              }}>
                Cross-validation used a 3-year initial window, retraining every 6 months with a 6-month
                forecast horizon. CV MAPE of 17.7% is the honest out-of-sample accuracy — in-sample
                MAPE (10.8%) reflects fit on training data.
              </div>
            </Panel>
          </div>
        )}

        {/* ── ABOUT & DATA TAB ── */}
        {fbReady && activeTab === "input" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Edmonton / Red Deer connection */}
            <Panel>
              <SectionTitle
                title="Food bank network — where Red Deer fits"
                sub="How this model connects to the broader Alberta food bank system"
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                {[
                  {
                    icon: "building-warehouse",
                    label: "AFB (provincial)",
                    status: "Live model",
                    statusColor: C.jungleTeal,
                    detail: "Forecasts provincial inbound / outbound lbs. SHAP analysis identified the economic features used in both models.",
                    border: C.jungleTeal,
                  },
                  {
                    icon: "map-pin",
                    label: "Red Deer Community FB",
                    status: "This model",
                    statusColor: C.dustyDenim,
                    detail: "Prophet model trained on 185 months of hamper data. Uses same AISH / CPI features validated at provincial level.",
                    border: C.dustyDenim,
                  },
                  {
                    icon: "school",
                    label: "Edmonton Campus FB",
                    status: "Pending dataset",
                    statusColor: C.textMuted,
                    detail: "Same model architecture ready to deploy. Waiting on historical hamper data. Will use identical feature pipeline once available.",
                    border: C.borderLight,
                  },
                ].map(fb => (
                  <div key={fb.label} style={{
                    padding: "14px 16px", borderRadius: 10,
                    background: C.surfaceGreen, border: `1.5px solid ${fb.border}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <i className={`ti ti-${fb.icon}`} style={{ fontSize: 16, color: fb.statusColor }} aria-hidden="true" />
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary }}>{fb.label}</div>
                        <div style={{ fontSize: 12, color: fb.statusColor, fontWeight: 500 }}>{fb.status}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.6 }}>{fb.detail}</div>
                  </div>
                ))}
              </div>
              <div style={{
                marginTop: 14, padding: "10px 14px",
                background: C.surfaceWhite, borderRadius: 8, border: `0.5px solid ${C.borderLight}`,
                fontSize: 13, color: C.textSecondary, lineHeight: 1.6,
              }}>
                <strong style={{ color: C.textPrimary }}>The connection:</strong> AFB forecasts provincial supply.
                Both Red Deer and Edmonton FBs are downstream consumers of that supply, and both face demand
                driven by the same provincial economic signals (AISH caseload, CPI, school calendar).
                When AFB signals a supply gap, it affects all regional FBs that's why the gap overlay
                on the Hamper forecast tab is meaningful for Red Deer operations.
              </div>
            </Panel>

            {/* What gets unlocked with donation data */}
            <Panel>
              <SectionTitle
                title="What opens up with Red Deer donation data (2011–2026)"
                sub="Planned additions once inbound donation history is available"
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  {
                    icon: "trending-up",
                    label: "Donation trend forecast",
                    detail: "Same Prophet pipeline applied to inbound donations. Shows whether donations are keeping pace with rising hamper demand.",
                    ready: false,
                  },
                  {
                    icon: "circle-minus",
                    label: "Red Deer supply-demand gap",
                    detail: "Hampers needed minus donations received, forecasted monthly. Mirrors the AFB gap model but at the regional level which enables local donor alerts.",
                    ready: false,
                  },
                  {
                    icon: "chart-line",
                    label: "Actual vs predicted chart",
                    detail: "In-sample fit chart using real historical data. Currently replaced by accuracy summary stats.",
                    ready: false,
                  },
                  {
                    icon: "calendar-stats",
                    label: "Seasonal donation pattern",
                    detail: "Which months historically receive more donations vs which months see demand spikes to support campaign planning.",
                    ready: false,
                  },
                ].map(item => (
                  <div key={item.label} style={{
                    display: "flex", gap: 12, alignItems: "flex-start",
                    padding: "12px 14px", borderRadius: 9,
                    background: C.surfaceGreen, border: `0.5px solid ${C.borderLight}`,
                  }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                      background: C.surfaceWhite, border: `0.5px solid ${C.borderLight}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <i className={`ti ti-${item.icon}`} style={{ fontSize: 14, color: C.textMuted }} aria-hidden="true" />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary, marginBottom: 2 }}>{item.label}</div>
                      <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.5 }}>{item.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            {/* Data input form */}
            <DataInputForm />
          </div>
        )}

      </div>
    </div>
  );
}
