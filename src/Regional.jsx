import { useState, useEffect } from "react";
import {
  ComposedChart, BarChart,
  Line, Bar, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
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
    unit:     "hampers",
    health:   "82.3% Good confidence",
    ready:    true,
    api: {
      forecast: "/api/regional/forecast",
      features: "/api/regional/features",
      metrics:  "/api/regional/metrics",
    },
  },
  {
    key:      "campus",
    label:    "Campus Food Bank (U of A)",
    subtitle: "Prophet model · academic calendar drivers · May 2023–Apr 2026",
    unit:     "visits",
    health:   "86.2% Good confidence",
    ready:    true,
    api: {
      forecast: "/api/campus/forecast",
      features: "/api/campus/features",
      metrics:  "/api/campus/metrics",
      trends:   "/api/campus/trends",
    },
  },
  {
    key:      "edmonton",
    label:    "Edmonton Food Bank",
    subtitle: "Dataset integration pending",
    unit:     "hampers",
    ready:    false,
    dataset: {
      period:      "TBD",
      granularity: "Monthly",
      metrics: [
        { icon: "users",          label: "Hamper requests",  desc: "Monthly hamper demand" },
        { icon: "heart-handshake",label: "Donations",        desc: "Total pounds donated"  },
      ],
      plannedTabs: [
        "Monthly hamper forecast",
        "Donation vs demand gap",
        "Seasonal demand patterns",
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
const featureData = {
  rdfb: [
    { name: "Edmonton AISH caseload", importance: 58.9 },
    { name: "Single AISH total",      importance: 18.1 },
    { name: "CPI All-items",          importance: 14.7 },
    { name: "CPI Food",               importance: 4.2  },
    { name: "School in session",      importance: 4.0  },
  ],
  campus: [
    { name: "Exam Period",        importance: 100.0 },
    { name: "School In Session",  importance:  75.2 },
  ],
};

const modelStats = {
  rdfb: [
    { label: "Training months",  value: "185"                      },
    { label: "Training window",  value: "2011-01-01 → 2026-05-01" },
    { label: "Model type",       value: "Prophet"                  },
    { label: "Forecast horizon", value: "12 months"                },
    { label: "CV MAE",           value: "118 hampers/month"        },
    { label: "CV MAPE",          value: "17.7%"                    },
  ],
  campus: [
    { label: "Training months",  value: "36"                       },
    { label: "Training window",  value: "May 2023 → Apr 2026"      },
    { label: "Model type",       value: "Prophet + academic calendar" },
    { label: "Forecast horizon", value: "12 months"                },
    { label: "CV MAE",           value: "144 visits/month"         },
    { label: "CV MAPE",          value: "13.8%"                    },
  ],
};

const METRIC_ENRICH = {

  "CV MAE": {
    tooltip: "Cross validation mean absolute error",
  },
  "CV MAPE": {
    tooltip: "Cross validation mean absolute percentage error",
  },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, tooltip }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        background: hovered && tooltip ? "#e8f5e2" : C.surfaceGreen,
        border: `0.5px solid ${hovered && tooltip ? C.jungleTeal : C.borderLight}`,
        borderRadius: 12, padding: "14px 16px",
        transition: "background 0.15s, border-color 0.15s",
        cursor: "default",
      }}
    >
      <div style={{ fontSize: 15, color: C.textSecondary, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 600, color: C.textPrimary, lineHeight: 1.3 }}>{value}</div>
      {sub && <div style={{ fontSize: 13, color: C.textMuted, marginTop: 3 }}>{sub}</div>}
      {hovered && tooltip && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 8px)", left: 0,
          width: 240, zIndex: 10,
          background: C.forestGreen, color: "#e8f5e2",
          borderRadius: 8, padding: "9px 12px",
          fontSize: 13, lineHeight: 1.55,
          boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
          pointerEvents: "none",
        }}>
          {tooltip}
          <div style={{
            position: "absolute", top: "100%", left: 20,
            borderLeft: "6px solid transparent", borderRight: "6px solid transparent",
            borderTop: `6px solid ${C.forestGreen}`,
          }} />
        </div>
      )}
    </div>
  );
}

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
      <div style={{ fontSize: 16, fontWeight: 600, color: C.textPrimary }}>{title}</div>
      {sub && <div style={{ fontSize: 15, color: C.textMuted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}


const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: C.forestGreen, border: `1px solid ${C.jungleTeal}`,
      borderRadius: 8, padding: "8px 13px", fontSize: 13, color: "#fff",
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

const makeHamperTooltip = (unit) => ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const pt = payload[0]?.payload ?? {};
  const isForecast = pt.actual == null;
  return (
    <div style={{
      background: C.forestGreen, border: `1px solid ${C.jungleTeal}`,
      borderRadius: 8, padding: "8px 13px", fontSize: 14, color: "#fff",
    }}>
      <div style={{ fontWeight: 600, color: C.teaGreen, marginBottom: 5 }}>{label}</div>
      {!isForecast ? (
        <>
          <div style={{ opacity: 0.9 }}>Actual: <strong>{pt.actual?.toLocaleString()}</strong> {unit}</div>
          <div style={{ opacity: 0.7, marginTop: 2 }}>Fitted: <strong>{pt.fitted?.toLocaleString()}</strong> {unit}</div>
        </>
      ) : (
        <>
          <div style={{ opacity: 0.9 }}>Forecast: <strong>{pt.yhat?.toLocaleString()}</strong> {unit}</div>
          {pt.bandBot != null && (
            <div style={{ opacity: 0.65, fontSize: 13, marginTop: 2 }}>
              80% CI: {pt.bandBot?.toLocaleString()} – {(pt.bandBot + pt.band)?.toLocaleString()}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ── Data input form ───────────────────────────────────────────────────────────

function DataInputForm({ isMobile }) {
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
    width: "100%", padding: "8px 11px", fontSize: 15,
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
        title="Add daily data row"
        sub="Client-level entries · queued for next model retraining run"
      />
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(3, minmax(0,1fr))", gap: 12, marginBottom: 12 }}>
        {fields.map((f) => (
          <div key={f.key}>
            <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 4, fontWeight: 500 }}>{f.label}</div>
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
      <div style={{ display: "flex", gap: isMobile ? 12 : 24, marginBottom: 12, flexWrap: "wrap" }}>
        {[
          { key: "aish_week", label: "AISH disbursement week" },
          { key: "ccb_week",  label: "CCB payment week"       },
        ].map((f) => (
          <label key={f.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.textSecondary, cursor: "pointer" }}>
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
        <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 4, fontWeight: 500 }}>Notes (optional)</div>
        <textarea
          value={form.notes}
          onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
          placeholder="Special events, data anomalies, closures..."
          rows={2}
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={handleSubmit}
          style={{
            padding: "9px 20px", fontSize: 14, fontWeight: 600,
            background: C.forestGreen, color: C.teaGreen,
            border: "none", borderRadius: 8, cursor: "pointer",
          }}
        >
          <i className="ti ti-upload" style={{ marginRight: 6 }} aria-hidden="true" />
          Submit row
        </button>
        {submitted && (
          <span style={{ fontSize: 13, color: C.jungleTeal, display: "flex", alignItems: "center", gap: 5 }}>
            <i className="ti ti-circle-check" aria-hidden="true" /> Row queued
          </span>
        )}
        {!isMobile && (
          <span style={{ fontSize: 13, color: C.textMuted, marginLeft: "auto" }}>
            Full CSV upload coming soon
          </span>
        )}
      </div>
    </Panel>
  );
}


// ── Main page ─────────────────────────────────────────────────────────────────

export default function Regional({ defaultBank = "rdfb", lockedBank = null }) {
  const [activeTab,  setActiveTab]  = useState("hamper");
  const [selectedFB, setSelectedFB] = useState(defaultBank);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const [forecast,    setForecast]    = useState(null);
  const [features,    setFeatures]    = useState(null);
  const [metrics,     setMetrics]     = useState(null);
  const [trends,      setTrends]      = useState(null);
  const [gapContext,  setGapContext]   = useState(null);
  const [loading,     setLoading]     = useState(false);

  // Fetch provincial gap once on mount for the context banner
  useEffect(() => {
    const BASE = (import.meta.env.VITE_API_URL ?? "");
    fetch(`${BASE}/api/gap`)
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
      .then(data => { if (data?.forecastGap?.[0]) setGapContext(data.forecastGap[0]); });
  }, []);

  useEffect(() => {
    const fb = FOOD_BANKS.find(b => b.key === selectedFB);
    if (!fb?.ready) return;
    setForecast(null); setFeatures(null); setMetrics(null); setTrends(null);
    setLoading(true);
    const BASE = (import.meta.env.VITE_API_URL ?? "");
    const get  = url => fetch(url).then(r => r.ok ? r.json() : null).catch(() => null);
    const reqs = [
      get(`${BASE}${fb.api.forecast}`),
      get(`${BASE}${fb.api.features}`),
      get(`${BASE}${fb.api.metrics}`),
      fb.api.trends ? get(`${BASE}${fb.api.trends}`) : Promise.resolve(null),
    ];
    Promise.all(reqs)
      .then(([fc, feat, met, tr]) => {
        if (fc)   setForecast(fc);
        if (feat) setFeatures(feat);
        if (met)  setMetrics(met);
        if (tr)   setTrends(tr);
      })
      .finally(() => setLoading(false));
  }, [selectedFB]);

  // Derived values for hamper tab
  const historicalRows = forecast?.historical ?? [];
  const forecastRows   = forecast?.forecast   ?? [];
  const meanYhat       = forecastRows.length
    ? Math.round(forecastRows.reduce((s, r) => s + r.yhat, 0) / forecastRows.length)
    : 0;
  const peakRow        = forecastRows.length
    ? forecastRows.reduce((best, r) => r.yhat > best.yhat ? r : best)
    : null;
  const seasonality    = forecast?.seasonality ?? {};

  // Combined chart: historical actual+fitted then forecast yhat+CI
  const chartData = [
    ...historicalRows.map(r => ({
      month:   r.label ?? r.month,
      actual:  Math.round(r.actual),
      fitted:  Math.round(r.fitted),
      yhat:    null,
      bandBot: null,
      band:    null,
    })),
    ...forecastRows.map(r => ({
      month:   r.month,
      actual:  null,
      fitted:  null,
      yhat:    r.yhat,
      bandBot: r.lower,
      band:    r.upper - r.lower,
    })),
  ];

  const fbMeta  = FOOD_BANKS.find(b => b.key === selectedFB);
  const fbReady = fbMeta?.ready ?? false;
  const unit    = fbMeta?.unit ?? "hampers";

  const tabs = [
    { key: "hamper", label: selectedFB === "campus" ? "Visit forecast" : "Hamper forecast" },
    { key: "model",  label: "Model detail" },
    { key: "input",  label: "About & data" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.pageBg, overflow: "hidden" }}>

      {/* On mobile: header + content scroll together. On desktop: display:contents is transparent. */}
      <div style={isMobile ? { flex: 1, overflowY: "auto", overflowX: "hidden" } : { display: "contents" }}>

      {/* Header */}
      <header style={{ padding: isMobile ? "16px 14px 0" : "32px 28px 0", background: C.pageBg, flexShrink: 0 }}>
        <div style={{ marginBottom: 16 }}>

          {/* Provincial context banner */}
          {gapContext && (() => {
            const rowGap = (gapContext.LBS_In_forecast != null && gapContext.LBS_Out_forecast != null)
              ? gapContext.LBS_In_forecast - gapContext.LBS_Out_forecast : null;
            const isShortfall = rowGap != null && rowGap < 0;
            const gapAbs      = rowGap != null ? Math.abs(rowGap) : null;
            const alert       = gapContext.alert ?? "OK";
            const isWarn      = alert === "Warning" || alert === "Critical";
            return (
              <div style={{
                display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                padding: "8px 14px", borderRadius: 8, marginBottom: 14,
                background: isWarn ? "#fffbeb" : "#f2f9ec",
                border: `1px solid ${isWarn ? "#d4c060" : "#ace890"}`,
                fontSize: 14,
              }}>
                <i className="ti ti-building-warehouse" style={{ fontSize: 15, color: C.textMuted, flexShrink: 0 }} aria-hidden="true" />
                <span style={{ color: C.textSecondary }}>
                  <strong style={{ color: C.textPrimary }}>FBA provincial · {gapContext.month}:</strong>{" "}
                  {gapAbs != null
                    ? `${isShortfall ? "−" : "+"}${(gapAbs / 1000).toFixed(0)}K lbs ${isShortfall ? "shortfall" : "surplus"} forecast`
                    : "forecast unavailable"
                  }
                </span>
                <span style={{
                  fontSize: 12, fontWeight: 600, padding: "2px 8px", borderRadius: 20, flexShrink: 0,
                  background: isWarn ? "#fdf6d8" : "#e2ffec",
                  color:      isWarn ? "#7a6010" : "#1a8b20",
                }}>
                  {alert}
                </span>
                <span style={{ marginLeft: "auto", fontSize: 13, color: C.textMuted }}>
                  FBA provincial model
                </span>
              </div>
            );
          })()}

          {/* Food bank selector — hidden when locked to a specific bank */}
          {!lockedBank && (
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              {FOOD_BANKS.map(fb => (
                <button
                  key={fb.key}
                  onClick={() => fb.ready && setSelectedFB(fb.key)}
                  disabled={!fb.ready}
                  style={{
                    padding: "5px 14px", borderRadius: 20, fontSize: 14, cursor: fb.ready ? "pointer" : "default",
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
                      fontSize: 11, fontWeight: 600, padding: "1px 6px", borderRadius: 8,
                      background: C.lightGold, color: C.forestGreen, letterSpacing: "0.04em",
                    }}>
                      SOON
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Dynamic title + subtitle */}
          {(() => {
            const fb = FOOD_BANKS.find(b => b.key === selectedFB);
            return (
              <>
                <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "flex-end", justifyContent: "space-between", gap: isMobile ? 10 : 0, marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: isMobile ? 20 : 25, fontWeight: 700, color: C.forestGreen, marginBottom: 4 }}>
                      {fb.label}
                    </div>
                    <div style={{ fontSize: 14, color: C.textMuted, marginBottom: fb.ready ? 10 : 0 }}>
                      {fb.subtitle}
                    </div>
                  </div>
                  {fb.ready && (
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: 7,
                      padding: "7px 14px", borderRadius: 8,
                      background: "#e2ffec", border: "0.5px solid #ace890",
                      fontSize: 14,
                    }}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.jungleTeal }} />
                      <span style={{ color: C.textSecondary }}>Model health: </span>
                      <span style={{ fontWeight: 600, color: C.forestGreen }}>{fb.health}</span>
                    </div>
                )}
                </div>
              </>
            );
          })()}
        </div>

        {/* Tabs — hidden when selected FB isn't ready yet */}
        <div style={{ display: fbReady ? "flex" : "none", gap: 2, borderBottom: `1px solid ${C.borderLight}`, overflowX: "auto" }}>
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
              padding: "8px 18px", fontSize: 15, cursor: "pointer",
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
      <div style={{ flex: isMobile ? undefined : 1, overflowY: isMobile ? undefined : "auto", overflowX: "hidden", padding: isMobile ? "16px 14px 24px" : "24px 28px 32px" }}>

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
                <i className="ti ti-clock-hour-4" style={{ fontSize: 24, color: "#b45309", marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#92400e", marginBottom: 4 }}>
                    Dataset received — model integration pending
                  </div>
                  <div style={{ fontSize: 14, color: "#a16207", lineHeight: 1.6 }}>
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
                <div style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary, marginBottom: 4 }}>Dataset overview</div>
                <div style={{ fontSize: 14, color: C.textMuted, marginBottom: 18 }}>
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
                        <i className={`ti ti-${m.icon}`} style={{ fontSize: 16, color: C.jungleTeal }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary }}>{m.label}</div>
                        <div style={{ fontSize: 13, color: C.textMuted, marginTop: 2 }}>{m.desc}</div>
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
                <div style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary, marginBottom: 4 }}>Planned analysis</div>
                <div style={{ fontSize: 14, color: C.textMuted, marginBottom: 16 }}>
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
                        fontSize: 11, color: C.textMuted, fontWeight: 600,
                      }}>
                        {i + 1}
                      </div>
                      <div style={{ fontSize: 14, color: C.textSecondary }}>{t}</div>
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
            {loading ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: C.textMuted, fontSize: 14 }}>
                Loading model data…
              </div>
            ) : !forecast ? (
              <Panel>
                <div style={{ padding: "40px 0", textAlign: "center" }}>
                  <i className="ti ti-database-off" style={{ fontSize: 30, color: C.textMuted, display: "block", marginBottom: 10 }} />
                  <div style={{ fontSize: 14, color: C.textMuted }}>
                    Forecast not available — ensure the backend is running and the data files are in{" "}
                    <code style={{ background: C.surfaceGreen, padding: "1px 5px", borderRadius: 4 }}>backend/data/</code>.
                  </div>
                </div>
              </Panel>
            ) : (
              <>
                {/* Summary cards */}
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, minmax(0,1fr))", gap: 14 }}>
                  {[
                    {
                      label:  "Average forecast",
                      value:  `${meanYhat.toLocaleString()} ${unit}`,
                      sub:    "per month · next 12 months",
                      accent: C.jungleTeal,
                    },
                    {
                      label:  "Peak demand month",
                      value:  peakRow?.month ?? "—",
                      sub:    peakRow ? `${peakRow.yhat.toLocaleString()} ${unit} forecast` : "",
                      accent: "#d07030",
                    },
                    {
                      label:  "CV MAPE",
                      value:  metrics?.modelStats?.find(s => s.label === "CV MAPE")?.value
                              ?? (selectedFB === "campus" ? "13.8%" : "17.7%"),
                      sub:    "cross-validated forecast error",
                      accent: C.dustyDenim,
                    },
                  ].filter(Boolean).map(s => (
                    <div key={s.label} style={{
                      background: C.surfaceWhite, border: `0.5px solid ${C.borderLight}`,
                      borderTop: `3px solid ${s.accent}`, borderRadius: 12, padding: "14px 16px",
                    }}>
                      <div style={{ fontSize: 14, color: C.textMuted, marginBottom: 6 }}>{s.label}</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: C.textPrimary, marginBottom: 3 }}>{s.value}</div>
                      <div style={{ fontSize: 14, color: C.textMuted }}>{s.sub}</div>
                    </div>
                  ))}
                </div>

                {/* Combined historical + forecast chart */}
                <Panel>
                  <SectionTitle
                    title="Model performance & 12-month forecast"
                    sub="Prophet model · last 25 months observed & predicted · 80% CI on forecast"
                  />
                  <ResponsiveContainer width="100%" height={280} style={{ outline: "none" }}>
                    <ComposedChart data={chartData} margin={{ top: 4, right: 16, bottom: isMobile ? 40 : 20, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.teaGreen} />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: isMobile ? 10 : 12, fill: C.textMuted }}
                        axisLine={false} tickLine={false}
                        interval={isMobile ? 6 : 4}
                        angle={-30} textAnchor="end"
                        tickFormatter={isMobile ? (v) => { const [m, y] = v.split(" "); return y ? `${m} '${y.slice(2)}` : v; } : undefined}
                      />
                      <YAxis
                        tick={{ fontSize: 13, fill: C.textMuted }} axisLine={false} tickLine={false}
                        tickFormatter={v => v.toLocaleString()} domain={["auto", "auto"]}
                      />
                      <Tooltip content={makeHamperTooltip(unit)} />
                      {/* 80% CI band (forecast only — null values break the area naturally) */}
                      <Area type="monotone" dataKey="bandBot" stackId="ci" stroke="none" fill="transparent" legendType="none" connectNulls={false} />
                      <Area type="monotone" dataKey="band"    stackId="ci" stroke="none" fill="#ddeaf8" fillOpacity={0.7} legendType="none" connectNulls={false} />
                      {/* Historical: actual */}
                      <Line
                        type="monotone" dataKey="actual" name="Actual"
                        stroke={C.jungleTeal} strokeWidth={2.5}
                        dot={{ r: 3, fill: C.jungleTeal }}
                        connectNulls={false}
                      />
                      {/* Historical: fitted */}
                      <Line
                        type="monotone" dataKey="fitted" name="Fitted"
                        stroke={C.jungleTeal} strokeWidth={1.5} strokeDasharray="5 3"
                        dot={false}
                        connectNulls={false}
                      />
                      {/* Forecast */}
                      <Line
                        type="monotone" dataKey="yhat" name="Forecast"
                        stroke={C.dustyDenim} strokeWidth={2.5}
                        dot={{ r: 3, fill: C.dustyDenim }}
                        connectNulls={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 10 }}>
                    {[
                      { color: C.jungleTeal, label: `Actual ${unit}`,          line: true,   dash: false },
                      { color: C.jungleTeal, label: `Predicted ${unit}`,        line: true,   dash: true  },
                      { color: C.dustyDenim, label: "Forecast (next 12 mo.)",  line: true,   dash: false },
                      { color: "#ddeaf8",    label: "80% confidence interval", square: true              },
                    ].map(({ color, label, line, dash }) => (
                      <span key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.textMuted }}>
                        {line ? (
                          <svg width="18" height="10">
                            <line
                              x1="0" y1="5" x2="18" y2="5"
                              stroke={color} strokeWidth="2.5"
                              strokeDasharray={dash ? "5 3" : undefined}
                            />
                          </svg>
                        ) : (
                          <span style={{
                            width: 12, height: 12, background: color, display: "inline-block",
                            borderRadius: 3, border: `1px solid ${C.borderLight}`,
                          }} />
                        )}
                        {label}
                      </span>
                    ))}
                  </div>
                </Panel>

                {/* Seasonality / Trends + about */}
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
                  {selectedFB === "campus" ? (
                    <Panel>
                      <SectionTitle title="Food security trends" sub="Campus Food Bank · 2023–2026" />
                      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        {[
                          {
                            label: "Avg household size",
                            from:  trends?.trends?.avg_hh_size_2023   ?? 1.66,
                            to:    trends?.trends?.avg_hh_size_2026   ?? 2.11,
                            unit:  "people/visit",
                            up: true,
                          },
                          {
                            label: "Food per person",
                            from:  trends?.trends?.lbs_per_person_2023 ?? 12.98,
                            to:    trends?.trends?.lbs_per_person_2026 ?? 10.71,
                            unit:  "lbs",
                            up: false,
                          },
                        ].map(row => (
                          <div key={row.label} style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "center", gap: isMobile ? 4 : 10 }}>
                            <div style={{ fontSize: 14, color: C.textSecondary }}>{row.label}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
                              <span style={{ color: C.textMuted }}>{row.from} {row.unit}</span>
                              <span style={{ color: C.textMuted }}>→</span>
                              <span style={{ fontWeight: 700, color: row.up ? "#8b2e1a" : C.jungleTeal }}>
                                {row.to} {row.unit}
                              </span>
                              <i className={`ti ti-arrow-${row.up ? "up" : "down"}`}
                                style={{ fontSize: 13, color: row.up ? "#8b2e1a" : C.jungleTeal }}
                                aria-hidden="true" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </Panel>
                  ) : (
                    <Panel>
                      <SectionTitle title="Historical seasonality" sub="Based on 15 years of Red Deer FB data (2011–2026)" />
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {[
                          { label: "Peak months",     months: seasonality.peakMonths,   color: "#c0622a"   },
                          { label: "Quietest months", months: seasonality.troughMonths, color: C.jungleTeal },
                        ].map(row => (
                          <div key={row.label} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: row.color, flexShrink: 0, marginTop: 5 }} />
                            <div style={{ fontSize: 15, color: C.textSecondary }}>
                              <strong style={{ color: C.textPrimary }}>{row.label}:</strong>{" "}
                              {(row.months ?? []).join(", ") || "—"}
                            </div>
                          </div>
                        ))}
                      </div>
                    </Panel>
                  )}
                  <Panel>
                    <SectionTitle title="About this forecast" sub="" />
                    <div style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.7 }}>
                      {selectedFB === "campus"
                        ? "Trained on 36 months of Campus Food Bank visit data (May 2023 – Apr 2026) using Prophet with academic calendar regressors. Exam periods and school-in-session flags are the dominant drivers (Pearson r = 0.48 and 0.36). CV MAPE of 13.8% on 6-month rolling holdouts."
                        : "Trained on 185 months of Red Deer FB data using Prophet with provincial economic regressors (AISH caseload, CPI, school calendar). Features were selected via SHAP analysis on the FBA provincial model where the same drivers predict both provincial outbound and regional hamper demand."
                      }
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

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(3, minmax(0,1fr))", gap: 14 }}>
              {(() => {
                const apiMap = Object.fromEntries((metrics?.modelStats ?? []).map(s => [s.label, s.value]));
                return (modelStats[selectedFB] ?? modelStats.rdfb).map(s => {
                  const enrich = METRIC_ENRICH[s.label] ?? {};
                  return <StatCard key={s.label} label={s.label} value={apiMap[s.label] ?? s.value} sub={enrich.sub} tooltip={enrich.tooltip} />;
                });
              })()}
            </div>
            <div style={{
              padding: "10px 14px",
              background: C.surfaceGreen, borderRadius: 8, border: `0.5px solid ${C.borderLight}`,
              fontSize: 14, color: C.textSecondary, lineHeight: 1.6,
            }}>
              {selectedFB === "campus"
                ? "Cross-validation used a 6-month rolling holdout window. CV MAPE of 13.8% reflects forecast error on held-out months. In-sample MAPE (1.4%) reflects fit on the training window."
                : "Cross-validation used a 3-year rolling window, retraining every 6 months with a 6-month forecast horizon. CV MAPE of 17.7% is the validation missed percentage; in-sample MAPE (10.8%) reflects fit on training data. Hover the metric cards above for plain language explanations."
              }
            </div>

            {/* Feature importance */}
            <Panel>
              <SectionTitle
                title={selectedFB === "campus"
                  ? "Feature importance (Pearson correlation)"
                  : "Feature importance (Prophet + SHAP)"}
                sub={selectedFB === "campus"
                  ? "Normalized correlation with monthly visit volume · May 2023 – Apr 2026"
                  : "SHAP values from FBA model applied to RDFB · Same economic drivers, regional target"}
              />
              <ResponsiveContainer width="100%" height={250} style={{ outline: "none" }}>
                <BarChart data={features?.featureData?.length ? features.featureData : featureData} layout="vertical" margin={{ top: 4, right: isMobile ? 40 : 50, bottom: 0, left: isMobile ? 100 : 110 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.teaGreen} horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 14, fill: C.textMuted }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: isMobile ? 9 : 13, fill: C.textSecondary }} axisLine={false} tickLine={false} width={isMobile ? 100 : 110} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="importance" name="Importance %" fill={C.dustyDenim} radius={[0, 4, 4, 0]} barSize={14}
                    label={{ position: "right", fontSize: 14, fill: C.textMuted, formatter: v => `${v}%` }}
                  />
                </BarChart>
              </ResponsiveContainer>
              <div style={{
                marginTop: 14, padding: "10px 14px",
                background: C.surfaceGreen, borderRadius: 8, border: `0.5px solid ${C.borderLight}`,
                fontSize: 14, color: C.textSecondary, lineHeight: 1.6,
              }}>
                {selectedFB === "campus"
                  ? <><strong style={{ color: C.textPrimary }}>Note:</strong> Importance is normalized Pearson correlation with monthly visit volume. Exam Period (r&nbsp;=&nbsp;0.48) and School In Session (r&nbsp;=&nbsp;0.36) are the top drivers — confirming that academic calendar is the primary demand signal at the Campus Food Bank.</>
                  : <><strong style={{ color: C.textPrimary }}>Note:</strong> SHAP importances are derived from the FBA provincial model and validated against Red Deer FB hamper data. Edmonton AISH caseload is the dominant driver (SHAP&nbsp;104), followed by single AISH total, CPI, and school calendar.</>
                }
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
                title="Food bank network"
                sub="How this model connects to the broader Alberta food bank system"
              />
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 12 }}>
                {(selectedFB === "campus" ? [
                  {
                    icon: "building-warehouse",
                    label: "FBA (provincial)",
                    status: "Live model",
                    statusColor: C.jungleTeal,
                    detail: "Forecasts provincial inbound / outbound lbs. SHAP analysis identified the economic drivers shared across all regional models.",
                    border: C.jungleTeal,
                  },
                  {
                    icon: "school",
                    label: "Campus Food Bank (U of A)",
                    status: "This model",
                    statusColor: C.dustyDenim,
                    detail: "Prophet model trained on 36 months of visit data. Academic calendar (exam periods, school-in-session) are the primary demand drivers.",
                    border: C.dustyDenim,
                  },
                  {
                    icon: "map-pin",
                    label: "Red Deer Community FB",
                    status: "Live model",
                    statusColor: C.jungleTeal,
                    detail: "Prophet model trained on 185 months of hamper data using AISH caseload, CPI, and school calendar as regressors.",
                    border: C.borderLight,
                  },
                ] : [
                  {
                    icon: "building-warehouse",
                    label: "FBA (provincial)",
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
                    label: "Campus Food Bank (U of A)",
                    status: "Live model",
                    statusColor: C.jungleTeal,
                    detail: "Prophet model trained on 36 months of visit data with academic calendar drivers. CV MAPE 13.8%.",
                    border: C.borderLight,
                  },
                ]).map(fb => (
                  <div key={fb.label} style={{
                    padding: "14px 16px", borderRadius: 10,
                    background: C.surfaceGreen, border: `1.5px solid ${fb.border}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <i className={`ti ti-${fb.icon}`} style={{ fontSize: 17, color: fb.statusColor }} aria-hidden="true" />
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary }}>{fb.label}</div>
                        <div style={{ fontSize: 13, color: fb.statusColor, fontWeight: 500 }}>{fb.status}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.6 }}>{fb.detail}</div>
                  </div>
                ))}
              </div>
              <div style={{
                marginTop: 14, padding: "10px 14px",
                background: C.surfaceWhite, borderRadius: 8, border: `0.5px solid ${C.borderLight}`,
                fontSize: 14, color: C.textSecondary, lineHeight: 1.6,
              }}>
                {selectedFB === "campus"
                  ? <><strong style={{ color: C.textPrimary }}>The connection:</strong> Unlike the RDFB model, the Campus Food Bank model is driven primarily by academic calendar rather than provincial economic indicators. Student food insecurity peaks around exam periods and drops in summer — a pattern distinct from the broader Alberta economic cycle.</>
                  : <><strong style={{ color: C.textPrimary }}>The connection:</strong> FBA forecasts provincial supply. Both Red Deer and Campus FBs are downstream consumers of that supply. Red Deer demand is driven by the same provincial economic signals (AISH caseload, CPI, school calendar) as the FBA model when FBA signals a supply gap, it directly affects Red Deer operations.</>
                }
              </div>
            </Panel>

            {/* What gets unlocked with donation data */}
            <Panel>
              <SectionTitle
                title={selectedFB === "campus"
                  ? "What opens up with Campus FB donation data"
                  : "What opens up with Red Deer donation data (2011–2026)"}
                sub="Planned additions once inbound donation history is available"
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {(selectedFB === "campus" ? [
                  {
                    icon: "trending-up",
                    label: "Donation trend forecast",
                    detail: "Prophet pipeline applied to inbound food donations. Shows whether donations are keeping pace with rising student visit demand across each academic term.",
                    ready: false,
                  },
                  {
                    icon: "circle-minus",
                    label: "Campus supply and demand gap",
                    detail: "Visits needed vs food donated, forecasted monthly. Enables targeted donation drives aligned with exam period demand spikes.",
                    ready: false,
                  },
                  {
                    icon: "chart-bar",
                    label: "Visit food allocation trend",
                    detail: "Tracks lbs of food distributed per visit over time. Currently shows a declining trend (12.98 -> 10.71 lbs/person) with richer donation data would allow cause analysis.",
                    ready: false,
                  },
                  {
                    icon: "calendar-stats",
                    label: "Academic calendar donation alignment",
                    detail: "Which months see donation surges vs demand spikes, to inform campaign timing around semester starts, exam periods, and summertime.",
                    ready: false,
                  },
                ] : [
                  {
                    icon: "trending-up",
                    label: "Donation trend forecast",
                    detail: "Same Prophet pipeline applied to inbound donations. Shows whether donations are keeping pace with rising hamper demand.",
                    ready: false,
                  },
                  {
                    icon: "circle-minus",
                    label: "Red Deer supply and demand gap",
                    detail: "Hampers needed minus donations received, forecasted monthly. Mirrors the FBA gap model but at the regional level which enables local donor alerts.",
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
                ]).map(item => (
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
                      <i className={`ti ti-${item.icon}`} style={{ fontSize: 15, color: C.textMuted }} aria-hidden="true" />
                    </div>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: C.textPrimary, marginBottom: 2 }}>{item.label}</div>
                      <div style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.5 }}>{item.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            {/* Data input form */}
            <DataInputForm isMobile={isMobile} />
          </div>
        )}

        {/* Footer */}
        <footer style={{
          background: `linear-gradient(135deg, ${C.forestGreen} 40%, #2d6a50 75%, #3f826d 100%)`,
          padding: isMobile ? "28px 20px 32px" : "36px 44px 40px",
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          alignItems: isMobile ? "flex-start" : "center",
          gap: isMobile ? 28 : 0,
          borderTop: `1px solid rgba(208,239,177,0.15)`,
          marginLeft:   isMobile ? -14 : -28,
          marginRight:  isMobile ? -14 : -28,
          marginBottom: isMobile ? -24 : -32,
        }}>

        {/* Left — Contact */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "flex-start", marginLeft: isMobile ? 0 : 40 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.teaGreen, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>
            Contact us
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <a
              href="mailto:feeds4good@gmail.com"
              style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, color: "rgba(255,255,255,0.75)", textDecoration: "none" }}
            >
              <i className="ti ti-mail" style={{ fontSize: 17, color: C.teaGreen, flexShrink: 0 }} aria-hidden="true" />
              feeds4good@gmail.com
            </a>
            <a
              href="https://www.instagram.com/feeds4good/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "rgba(255,255,255,0.75)", textDecoration: "none" }}
            >
              <i className="ti ti-brand-instagram" style={{ fontSize: 16, color: C.teaGreen, flexShrink: 0 }} aria-hidden="true" />
              @feeds4good
            </a>
          </div>
        </div>

        {/* Center — Logo */}
        <div style={{
          flex: 1, display: "flex", justifyContent: "center", alignItems: "center",
          order: isMobile ? -1 : 0,
          marginBottom: isMobile ? 4 : 0,
        }}>
          <img
            src="/logo-removebg.png"
            alt="FEEDS logo"
            style={{ height: isMobile ? 70 : 90, objectFit: "contain", filter: "brightness(0) invert(1)", opacity: 0.9 }}
          />
        </div>

        {/* Right — Collaboration */}
        <div style={{ flex: 1, display: "flex", justifyContent: "flex-start" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, maxWidth: 400 }}>
            <i className="ti ti-heart-handshake" style={{ fontSize: 18, color: C.teaGreen, flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 5 }}>
                Built in collaboration with food banks
              </div>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", lineHeight: 1.65 }}>
                Developed in partnership with Food Banks Alberta and Red Deer Food Bank to improve food security outcomes across Alberta.
              </div>
            </div>
          </div>
        </div>

      </footer>
      </div>{/* end content */}
      </div>{/* end mobile scroll wrapper */}
    </div>
  );
}
