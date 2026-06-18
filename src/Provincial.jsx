import { useState, useEffect } from "react";
import { API_BASE } from "./config";
import {
  ComposedChart, BarChart,
  Line, Bar, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
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

const LEVEL_STYLE = {
  High:   { bg: "#fdecea", color: "#8b2e1a" },
  Medium: { bg: "#fdf6d8", color: "#7a6010" },
  Low:    { bg: "#b8ddb0", color: "#1e4d2b" },
};

const catColor = {
  economic:       C.jungleTeal,
  social:         C.dustyDenim,
  calendar:       C.lightGold,
  weather:        C.wheat,
  autoregressive: "#a889cc",
  other:          "#933838b8",
};

const CAT_LABEL = {
  economic:       "Economic",
  social:         "Social",
  calendar:       "Calendar & benefits",
  weather:        "Weather",
  autoregressive: "Autoregressive",
  other:          "Other factors",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionTitle({ title, sub }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 19, fontWeight: 600, color: C.textPrimary }}>{title}</div>
      {sub && <div style={{ fontSize: 14, color: C.textMuted, marginTop: 2 }}>{sub}</div>}
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

function Badge({ children, bg, color }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 20,
      fontSize: 12, fontWeight: 500, background: bg, color,
    }}>
      {children}
    </span>
  );
}

function MetricCard({ label, value, sub, tooltip }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative", padding: "12px 14px", borderRadius: 9,
        background: hovered ? "#e8f5e2" : C.surfaceGreen,
        border: `0.5px solid ${hovered ? C.jungleTeal : C.borderLight}`,
        cursor: "default", transition: "background 0.15s, border-color 0.15s",
      }}
    >
      <div style={{ fontSize: 14, color: C.textSecondary, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 27, fontWeight: 700, color: C.textPrimary }}>{value}</div>
      <div style={{ fontSize: 13, color: C.textMuted, marginTop: 2 }}>{sub}</div>
      {hovered && tooltip && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 8px)", left: 0,
          width: 220, zIndex: 10,
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

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: C.forestGreen, border: `1px solid ${C.jungleTeal}`,
      borderRadius: 8, padding: "8px 13px", fontSize: 13, color: "#fff",
    }}>
      <div style={{ fontWeight: 600, color: C.teaGreen, marginBottom: 4 }}>{label}</div>
      {payload.map((p) => p.value != null && (
        <div key={p.name} style={{ display: "flex", justifyContent: "space-between", gap: 16, opacity: 0.9 }}>
          <span>{p.name}</span>
          <span style={{ fontWeight: 600 }}>
            {p.value >= 0 ? "+" : ""}{(p.value / 1000).toFixed(1)}K lbs
          </span>
        </div>
      ))}
    </div>
  );
};

// ── Data input form ───────────────────────────────────────────────────────────

function DataInputForm({ isMobile }) {
  const [form, setForm] = useState({
    date: "", inbound: "", outbound: "",
    cpi_food: "", unemployment: "", mean_temp: "", notes: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const fields = [
    { key: "date",         label: "Date",              type: "date",   placeholder: ""         },
    { key: "inbound",      label: "Inbound (lbs)",     type: "number", placeholder: "e.g. 280000" },
    { key: "outbound",     label: "Outbound (lbs)",    type: "number", placeholder: "e.g. 310000" },
    { key: "cpi_food",     label: "CPI food index",    type: "number", placeholder: "e.g. 163.2"  },
    { key: "unemployment", label: "Unemployment rate", type: "number", placeholder: "e.g. 7.4"    },
    { key: "mean_temp",    label: "Mean temp (°C)",    type: "number", placeholder: "e.g. 14.2"   },
  ];

  function handleSubmit() {
    console.log("New data row:", form);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
    setForm({ date: "", inbound: "", outbound: "", cpi_food: "", unemployment: "", mean_temp: "", notes: "" });
  }

  const inputStyle = {
    width: "100%", padding: "8px 11px", fontSize: 15,
    border: `1px solid ${C.borderLight}`, borderRadius: 8,
    background: C.surfaceGreen, color: C.textPrimary, outline: "none",
    fontFamily: "inherit",
  };

  return (
    <Panel>
      <SectionTitle
        title="Add monthly data row"
        sub="Staff input"
      />
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(3, minmax(0,1fr))", gap: 12, marginBottom: 12 }}>
        {fields.map((f) => (
          <div key={f.key}>
            <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 4, fontWeight: 500 }}>
              {f.label}
            </div>
            <input
              type={f.type}
              value={form[f.key]}
              placeholder={f.placeholder}
              onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
              style={inputStyle}
            />
          </div>
        ))}
      </div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 4, fontWeight: 500 }}>Notes (optional)</div>
        <textarea
          value={form.notes}
          onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
          placeholder="Any context for this month such as an unusual donation event, data anomaly..."
          rows={2}
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
        />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={handleSubmit}
          style={{
            padding: "9px 20px", fontSize: 15, fontWeight: 600,
            background: C.forestGreen, color: C.teaGreen,
            border: "none", borderRadius: 8, cursor: "pointer",
          }}
        >
          <i className="ti ti-upload" style={{ marginRight: 6 }} aria-hidden="true" />
          Submit row
        </button>
        {submitted && (
          <span style={{ fontSize: 14, color: C.jungleTeal, display: "flex", alignItems: "center", gap: 5 }}>
            <i className="ti ti-circle-check" aria-hidden="true" />
            Row queued successfully
          </span>
        )}
        <span style={{ fontSize: 13, color: C.textMuted, marginLeft: "auto" }}>
          Full CSV upload coming soon
        </span>
      </div>
    </Panel>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Provincial() {
  const [activeTab, setActiveTab] = useState("overview");

  const [historyData,     setHistoryData]     = useState([]);
  const [featureData,     setFeatureData]     = useState([]);
  const [modelStats,      setModelStats]      = useState([]);
  const [confidence,      setConfidence]      = useState(null);
  const [gapForecast,     setGapForecast]     = useState([]);
  const [regionalOutlook, setRegionalOutlook] = useState({ rdfb: null, campus: null });

  const [loadingStats,    setLoadingStats]    = useState(true);
  const [loadingHistory,  setLoadingHistory]  = useState(true);
  const [isMobile,        setIsMobile]        = useState(() => window.innerWidth < 768);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);


  // Fetch regional forecasts for the outlook cards (independent of main load)
  useEffect(() => {
    const get = url => fetch(url).then(r => r.ok ? r.json() : null).catch(() => null);
    Promise.all([
      get(`${API_BASE}/api/regional/forecast`),
      get(`${API_BASE}/api/campus/forecast`),
    ]).then(([rdfb, campus]) => setRegionalOutlook({ rdfb, campus }));
  }, []);

  useEffect(() => {
    const CACHE_KEY = "feeds_prov_v2";
    const CACHE_TTL = 60 * 60 * 1000; // 1 hour

    // Serve cache instantly if still fresh
    let fromCache = false;
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const { ts, data } = JSON.parse(raw);
        if (Date.now() - ts < CACHE_TTL && data) {
          setHistoryData(data.hist    ?? []);
          setFeatureData(data.feats   ?? []);
          setModelStats (data.metrics ?? []);
          setConfidence (data.summary ?? null);
          setGapForecast(data.gap     ?? []);
          setLoadingStats(false);
          setLoadingHistory(false);
          fromCache = true;
        }
      }
    } catch (_) {}

    // Always re-fetch — updates cache silently if cache was used, shows spinner if not
    const histP = fetch(`${API_BASE}/api/provincial/history`)
      .then(r => r.json()).catch(() => null);
    const statsP = Promise.all([
      fetch(`${API_BASE}/api/provincial/features`).then(r => r.json()),
      fetch(`${API_BASE}/api/provincial/metrics`).then(r => r.json()),
      fetch(`${API_BASE}/api/model_summary`).then(r => r.json()),
      fetch(`${API_BASE}/api/gap`).then(r => r.json()),
    ]).catch(() => null);

    statsP
      .then(res => {
        if (!res) return;
        const [feats, metrics, summary, gap] = res;
        setFeatureData(feats.featureData ?? []);
        setModelStats(metrics.modelStats ?? []);
        setConfidence(summary);
        setGapForecast(gap.forecastGap ?? []);
      })
      .finally(() => { if (!fromCache) setLoadingStats(false); });

    histP
      .then(hist => {
        if (!hist) return;
        setHistoryData(hist.historyData ?? []);
      })
      .finally(() => { if (!fromCache) setLoadingHistory(false); });

    // Write cache once both finish
    Promise.all([statsP, histP]).then(([statsRes, hist]) => {
      if (!statsRes || !hist) return;
      const [feats, metrics, summary, gap] = statsRes;
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          ts: Date.now(),
          data: {
            hist:    hist.historyData    ?? [],
            feats:   feats.featureData   ?? [],
            metrics: metrics.modelStats  ?? [],
            summary: summary             ?? null,
            gap:     gap.forecastGap     ?? [],
          },
        }));
      } catch (_) {}
    });
  }, []);

  const tabs = [
    { key: "overview",   label: "Overview"     },
    { key: "model",      label: "Model detail" },
    { key: "allocation", label: "Allocation"   },
    { key: "input",      label: "Data input"   },
  ];

  // Stat card derivations
  const topGapAlert = gapForecast[0]?.alert ?? "OK";
  const gapStyle    = (topGapAlert === "Critical" || topGapAlert === "Warning") ? LEVEL_STYLE.High : LEVEL_STYLE.Low;

  const confPct   = confidence?.confidence_pct ?? "—";
  const confLabel = confidence?.confidence_label ?? "confidence";

  const chartData = historyData.filter(d => parseInt(d.date.split(" ")[1], 10) >= 2026);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.pageBg, overflow: "hidden" }}>

      {/* On mobile: header + content scroll together. On desktop: display:contents is transparent. */}
      <div style={isMobile ? { flex: 1, overflowY: "auto", overflowX: "hidden" } : { display: "contents" }}>

      {/* Header */}
      <header style={{ padding: isMobile ? "16px 14px 0" : "32px 28px 0", background: C.pageBg, flexShrink: 0 }}>
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "flex-end", justifyContent: "space-between", gap: isMobile ? 10 : 0, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 27, fontWeight: 700, color: C.forestGreen, marginBottom: 4 }}>
              Provincial model
            </div>
            <div style={{ fontSize: 14, color: C.textMuted }}>
              Predicts provincial inbound donations and outbound to regional FBs
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 2, borderBottom: `1px solid ${C.borderLight}`, overflowX: "auto" }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                padding: isMobile ? "8px 10px" : "8px 18px",
                fontSize: isMobile ? 13 : 15,
                cursor: "pointer",
                border: "none", background: "none",
                color: activeTab === t.key ? C.forestGreen : C.textMuted,
                fontWeight: activeTab === t.key ? 600 : 400,
                borderBottom: activeTab === t.key ? `2px solid ${C.jungleTeal}` : "2px solid transparent",
                marginBottom: -1,
                fontFamily: "inherit",
                flexShrink: 0,
                whiteSpace: "nowrap",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <div style={{ flex: isMobile ? undefined : 1, overflowY: isMobile ? undefined : "auto", overflowX: "hidden", padding: isMobile ? "16px 14px 24px" : "24px 28px 32px" }}>

        {loadingStats ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: C.textMuted, fontSize: 14 }}>
            Loading model data…
          </div>
        ) : (
          <>
            {/* ── OVERVIEW TAB ── */}
            {activeTab === "overview" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Stat row */}
                {(() => {
                  const next       = gapForecast[0];
                  const nextMonth  = next?.month ?? "—";
                  const nextOut    = next?.LBS_Out_forecast;
                  const nextIn     = next?.LBS_In_forecast;
                  const nextGap    = (nextIn != null && nextOut != null) ? nextIn - nextOut : null;
                  const isShortfall = nextGap != null && nextGap < 0;
                  const gapAbs     = nextGap != null ? Math.abs(nextGap) : null;
                  const gapValueStr = gapAbs != null
                    ? `${isShortfall ? "▼" : "▲"} ${(gapAbs / 1000).toFixed(0)}K lbs`
                    : "—";
                  const gapSubStr  = isShortfall ? "shortfall" : "surplus";
                  const gapAccent  = isShortfall ? (next?.alert === "Critical" ? "#c0622a" : C.lightGold) : C.jungleTeal;
                  const gapBadgeBg = isShortfall ? gapStyle.bg : C.teaGreen;
                  const gapBadgeColor = isShortfall ? gapStyle.color : C.forestGreen;

                  return (
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, minmax(0,1fr))", gap: 14 }}>
                      {[
                        {
                          label: `Outbound forecast`,
                          value: nextOut != null ? `${(nextOut / 1000).toFixed(0)}K lbs` : "—",
                          sub: nextMonth, accent: "#c0622a",
                          badgeBg: "#fde8e0", badgeColor: "#8b2e1a",
                        },
                        {
                          label: `Inbound forecast`,
                          value: nextIn != null ? `${(nextIn / 1000).toFixed(0)}K lbs` : "—",
                          sub: nextMonth, accent: C.jungleTeal,
                          badgeBg: C.teaGreen, badgeColor: C.forestGreen,
                        },
                        {
                          label: `Projected gap`,
                          value: gapValueStr,
                          sub: gapSubStr, accent: gapAccent,
                          badgeBg:    isShortfall ? "#fdecea" : "#e2ffec",
                          badgeColor: isShortfall ? "#c0622a" : "#1a8b20",
                        },
                        {
                          label: "Forecast accuracy",
                          value: confPct !== "—" ? `${confPct}%` : "—",
                          sub: confLabel, accent: C.dustyDenim,
                          badgeBg: "#ddeaf8", badgeColor: "#2d5a9e",
                        },
                      ].map((s) => (
                        <div key={s.label} style={{
                          background: C.surfaceWhite, border: `0.5px solid ${C.borderLight}`,
                          borderTop: `3px solid ${s.accent}`, borderRadius: 12, padding: "14px 16px",
                        }}>
                          <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 6 }}>{s.label}</div>
                          <div style={{ fontSize: 20, fontWeight: 600, color: C.textPrimary, marginBottom: 6 }}>{s.value}</div>
                          <Badge bg={s.badgeBg} color={s.badgeColor}>{s.sub}</Badge>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Main chart — supply gap */}
                {(() => {
                  const rawHist = chartData
                    .filter(d => d.inbound != null && d.outbound != null)
                    .map(d => ({ date: d.date, rawGap: d.inbound - d.outbound, modelLine: d.predicted_gap ?? null }));
                  const histGap = rawHist.map((d, i) => {
                    const win = rawHist.slice(Math.max(0, i - 2), i + 1);
                    const avg = win.reduce((s, x) => s + x.rawGap, 0) / win.length;
                    return { date: d.date, actualGap: Math.round(avg), modelLine: d.modelLine };
                  });
                  const fcMonths = new Set(gapForecast.map(r => r.month));
                  const bridgePoints = chartData
                    .filter(d => (d.inbound == null || d.outbound == null) && d.predicted_gap != null && !fcMonths.has(d.date))
                    .map(d => ({ date: d.date, actualGap: null, modelLine: d.predicted_gap }));
                  const fcGap = gapForecast.map(r => ({
                    date: r.month, actualGap: null,
                    modelLine: (r.LBS_In_forecast != null && r.LBS_Out_forecast != null) ? r.LBS_In_forecast - r.LBS_Out_forecast : null,
                  }));
                  const gapChartData = [...histGap, ...bridgePoints, ...fcGap];
                  return (
                    <Panel>
                      <SectionTitle
                        title="Supply gap (observed + 3 month forecast)"
                        sub="Prophet model · last 6 months observed & predicted · next 3 months forecast"
                      />
                      {loadingHistory ? (
                        <div style={{ textAlign: "center", padding: "40px 0", color: C.textMuted, fontSize: 14 }}>
                          Loading chart…
                        </div>
                      ) : (
                        <>
                          <ResponsiveContainer width="100%" height={280} style={{ outline: "none" }}>
                            <ComposedChart data={gapChartData} margin={{ top: 4, right: 16, bottom: isMobile ? 40 : 20, left: 10 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke={C.teaGreen} />
                              <XAxis
                                dataKey="date"
                                tick={{ fontSize: isMobile ? 10 : 13, fill: C.textMuted }}
                                axisLine={false} tickLine={false}
                                interval={isMobile ? 1 : 0}
                                angle={-30} textAnchor="end"
                                tickFormatter={isMobile ? (v) => { const [m, y] = v.split(" "); return y ? `${m} '${y.slice(2)}` : v; } : undefined}
                              />
                              <YAxis
                                domain={["auto", "auto"]}
                                tickFormatter={v => v === 0 ? "0" : `${v > 0 ? "+" : ""}${(v / 1000).toFixed(0)}K`}
                                tick={{ fontSize: 13, fill: C.textMuted }}
                                axisLine={false} tickLine={false} width={46}
                              />
                              <Tooltip content={<ChartTooltip />} />
                              <ReferenceLine y={0} stroke="#a0b8a0" strokeWidth={1.5} />
                              <Line type="monotone" dataKey="actualGap" name="Observed gap"   stroke={C.jungleTeal} strokeWidth={1.5} dot={{ r: 2.5, fill: C.jungleTeal }} connectNulls={false} />
                              <Line type="monotone" dataKey="modelLine" name="Forecast line"    stroke={C.dustyDenim} strokeWidth={1.5} dot={{ r: 2.5, fill: C.dustyDenim }} strokeDasharray="5 3" connectNulls />
                            </ComposedChart>
                          </ResponsiveContainer>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 10 }}>
                            {[
                              { color: C.jungleTeal, label: "Observed gap", dash: false },
                              { color: C.dustyDenim, label: "Forecast line",  dash: true  },
                            ].map(({ color, label, dash }) => (
                              <span key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.textMuted }}>
                                <svg width="18" height="10">
                                  <line x1="0" y1="5" x2="18" y2="5" stroke={color} strokeWidth="2.5" strokeDasharray={dash ? "5 3" : undefined} />
                                </svg>
                                {label}
                              </span>
                            ))}
                          </div>
                          <p style={{ fontSize: 13, color: C.textMuted, fontStyle: "italic", marginTop: 10, lineHeight: 1.5 }}>
                            Negative values mark months where the model forecasts a provincial supply shortfall which means more food distributed than donated.
                          </p>
                        </>
                      )}
                    </Panel>
                  );
                })()}

                {/* 3-month gap forecast */}
                {gapForecast.length > 0 && (
                  <Panel>
                    <SectionTitle
                      title="3 month supply-demand outlook"
                      sub="Predicted shortfall or surplus per month."
                    />
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0,1fr))", gap: 12 }}>
                      {gapForecast.map((row) => {
                        const rowGap = (row.LBS_In_forecast != null && row.LBS_Out_forecast != null) ? row.LBS_In_forecast - row.LBS_Out_forecast : 0;
                        const isGap  = rowGap < 0;
                        const isCrit = row.alert === "Critical";
                        const isWarn = row.alert === "Warning";
                        const alertLabel  = isCrit ? "Critical" : isWarn ? "Warning" : isGap ? "Caution" : "Stable";
                        const accentColor = isCrit ? "#e8a090" : isWarn ? "#d4c060" : isGap ? "#c9d8e8" : "#ace890";
                        const badgeBg     = isCrit ? "#fdecea" : isWarn ? "#fdf6d8" : isGap ? "#ddeaf8" : "#e2ffec";
                        const badgeColor  = isCrit ? "#8b2e1a" : isWarn ? "#7a6010" : isGap ? "#2d5a9e" : "#1a8b20";
                        const gapAbs = Math.abs(rowGap);
                        return (
                          <div key={row.period} style={{
                            border: `0.5px solid ${accentColor}`,
                            borderTop: `3px solid ${accentColor}`,
                            borderRadius: 10, padding: "14px 16px",
                            background: C.surfaceGreen,
                          }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                              <span style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary }}>{row.month}</span>
                              <span style={{
                                fontSize: 12, fontWeight: 500, padding: "2px 8px", borderRadius: 20,
                                background: badgeBg, color: badgeColor,
                              }}>{alertLabel}</span>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                              <div>
                                <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 3 }}>Donations in</div>
                                <div style={{ fontSize: 16, fontWeight: 700, color: C.jungleTeal }}>
                                  {(row.LBS_In_forecast / 1000).toFixed(0)}K
                                  <span style={{ fontSize: 13, fontWeight: 400, color: C.textMuted }}> lbs</span>
                                </div>
                              </div>
                              <div>
                                <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 3 }}>Demand out</div>
                                <div style={{ fontSize: 16, fontWeight: 700, color: "#c0622a" }}>
                                  {(row.LBS_Out_forecast / 1000).toFixed(0)}K
                                  <span style={{ fontSize: 13, fontWeight: 400, color: C.textMuted }}> lbs</span>
                                </div>
                              </div>
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: isGap ? "#8b2e1a" : "#1a8b20" }}>
                              {isGap ? "▼" : "▲"} {(gapAbs / 1000).toFixed(0)}K lbs {isGap ? "shortfall" : "surplus"}
                            </div>
                            <div style={{ fontSize: 13, color: C.textMuted, marginTop: 5 }}>
                              {row.confidence_pct}% model reliability
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Panel>
                )}

                {/* Regional outlook */}
                <Panel>
                  <SectionTitle
                    title="Regional outlook"
                    sub="Next-month demand forecast from downstream food banks"
                  />
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                    {[
                      { key: "rdfb",   label: "Red Deer Community FB",    icon: "map-pin", unit: "hampers", color: C.dustyDenim, data: regionalOutlook.rdfb   },
                      { key: "campus", label: "Campus Food Bank (U of A)", icon: "school",  unit: "visits",  color: "#7a5ca8",    data: regionalOutlook.campus },
                    ].map(fb => {
                      const _MO = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
                      const _parseLabel = lbl => { const [m,y] = lbl.split(" "); return new Date(+y, _MO[m]??0, 1); };
                      const _floor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
                      const nextRow = fb.data?.forecast?.find(r => _parseLabel(r.month) >= _floor)
                                   ?? fb.data?.forecast?.[0];
                      const yhat    = nextRow?.yhat;
                      const peak    = fb.data?.forecast?.length
                        ? fb.data.forecast.reduce((best, r) => r.yhat > best.yhat ? r : best)
                        : null;
                      return (
                        <div key={fb.key} style={{
                          padding: "14px 16px", borderRadius: 10,
                          background: C.surfaceGreen, border: `1px solid ${C.borderLight}`,
                          borderLeft: `4px solid ${fb.color}`,
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                            <i className={`ti ti-${fb.icon}`} style={{ fontSize: 14, color: fb.color }} aria-hidden="true" />
                            <span style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary }}>{fb.label}</span>
                          </div>
                          <div style={{ fontSize: 22, fontWeight: 700, color: C.textPrimary, marginBottom: 2 }}>
                            {yhat != null ? yhat.toLocaleString() : "—"}
                            <span style={{ fontSize: 13, fontWeight: 400, color: C.textMuted }}> {fb.unit}</span>
                          </div>
                          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>
                            {nextRow?.month ?? "Next month"} forecast
                          </div>
                          {peak && (
                            <div style={{ fontSize: 12, color: C.textSecondary }}>
                              Peak: <strong>{peak.month}</strong> · {peak.yhat.toLocaleString()} {fb.unit}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{
                    marginTop: 12, padding: "8px 12px", borderRadius: 8,
                    background: C.surfaceWhite, border: `0.5px solid ${C.borderLight}`,
                    fontSize: 12, color: C.textMuted, lineHeight: 1.6,
                  }}>
                    When provincial supply is under pressure, these regional food banks are first to feel reduced allocation.
                  </div>
                </Panel>

              </div>
            )}


            {/* ── MODEL DETAIL TAB ── */}
            {activeTab === "model" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Model stats grid */}
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(3, minmax(0,1fr))", gap: 14 }}>
                  {modelStats.map((s) => (
                    <div key={s.label} style={{
                      background: C.surfaceGreen, border: `0.5px solid ${C.borderLight}`,
                      borderRadius: 12, padding: "14px 16px",
                    }}>
                      <div style={{ fontSize: 14, color: C.textSecondary, marginBottom: 6 }}>{s.label}</div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: C.textPrimary, lineHeight: 1.3 }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* Feature importance chart */}
                <Panel>
                  <SectionTitle
                    title="Feature importance using provincial model (Prophet + Random Forest)"
                    sub="Feature contributions to gap prediction"
                  />
                  {featureData.length === 0 ? (
                    <div style={{ fontSize: 14, color: C.textMuted, textAlign: "center", padding: "20px 0" }}>
                      No feature data available
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={Math.max(280, featureData.length * 22)} style={{ outline: "none" }}>
                      <BarChart data={featureData} layout="vertical" margin={{ top: 4, right: isMobile ? 40 : 50, bottom: 0, left: isMobile ? 104 : 120 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.teaGreen} horizontal={false} />
                        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 13, fill: C.textMuted }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: isMobile ? 9 : 12, fill: C.textSecondary }} axisLine={false} tickLine={false} width={isMobile ? 104 : 120} />
                        <Bar dataKey="importance" name="Importance %" radius={[0, 4, 4, 0]} barSize={14} fill={C.jungleTeal}
                          label={{ position: "right", fontSize: 13, fill: C.textMuted, formatter: v => `${v}%` }}
                        >
                          {featureData.map((entry, i) => (
                            <Cell key={`cell-${i}`} fill={catColor[entry.category] ?? C.textMuted} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                  <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
                    {[...new Set(featureData.map(d => d.category))]
                      .sort((a, b) => a === "other" ? 1 : b === "other" ? -1 : 0)
                      .map((cat) => (
                        <span key={cat} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.textMuted }}>
                          <span style={{ width: 10, height: 10, background: catColor[cat] ?? C.textMuted, display: "inline-block", borderRadius: 2 }} />
                          {CAT_LABEL[cat] ?? cat.charAt(0).toUpperCase() + cat.slice(1)}
                        </span>
                      ))}
                  </div>
                  <div style={{
                    marginTop: 14, padding: "10px 14px",
                    background: C.surfaceGreen, borderRadius: 8, border: `0.5px solid ${C.borderLight}`,
                    fontSize: 14, color: C.textSecondary, lineHeight: 1.6,
                  }}>
                    <strong style={{ color: C.textPrimary }}>Note:</strong> Prophet decomposes long-term trend and seasonality;
                    residuals and external signals are passed to the Random Forest for the gap classification step.
                    Feature importances shown here reflect the Random Forest component.
                  </div>
                </Panel>

                {/* Gap classifier accuracy */}
                {confidence?.targets?.LBS_In?.gap_accuracy != null && (
                  <Panel>
                    <SectionTitle
                      title="Shortfall classifier performance"
                      sub="Tested against months the model had never seen before"
                    />
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 14 }}>
                      {[
                        {
                          label: "Correct predictions",
                          value: `${(confidence.targets.LBS_In.gap_accuracy * 100).toFixed(1)}%`,
                          sub: "overall accuracy",
                          tooltip: "How often the model correctly called whether a month would be a shortfall or surplus.",
                        },
                        {
                          label: "Detection quality",
                          value: (confidence.targets.LBS_In.gap_f1 ?? "—").toString().substring(0, 5),
                          sub: "F1 score",
                          tooltip: "A balance between catching real shortfalls and avoiding false alarms. Closer to 1.0 means both are done well; 0.5 is no better than a coin flip.",
                        },
                        {
                          label: "Gap months identified",
                          value: `${((confidence.targets.LBS_In.gap_sur_recall ?? 0) * 100).toFixed(1)}%`,
                          sub: "gap recall",
                          tooltip: "Of all the months that actually had a gap, how many did the model correctly flag?",
                        },
                       
                      ].map((m) => (
                        <MetricCard key={m.label} {...m} />
                      ))}
                    </div>
                    <div style={{
                      marginTop: 14, padding: "10px 14px",
                      background: C.surfaceGreen, borderRadius: 8, border: `0.5px solid ${C.borderLight}`,
                      fontSize: 13, color: C.textSecondary, lineHeight: 1.6,
                    }}>
                      Binary classification: shortfall month (gap &lt; 0) vs. surplus (gap ≥ 0).
                      Evaluated on a held-out test set the model was not trained on.
                    </div>
                  </Panel>
                )}
              </div>
            )}

            {/* ── ALLOCATION TAB ── */}
            {activeTab === "allocation" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <Panel>
                  <SectionTitle
                    title="Regional allocation index"
                    sub="Coming soon: interactive tool to plan allocation across the province based on regional forecasts, inventory levels, and local demand signals"
                  />
                </Panel>
              </div>
            )}

            {/* ── DATA INPUT TAB ── */}
            {activeTab === "input" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <DataInputForm isMobile={isMobile} />

                {/* Recent entries table */}
                <Panel>
                  <SectionTitle title="Recent staff entries" sub="Last 5 manually submitted rows" />
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                          {["Date", "Inbound", "Outbound", "CPI food", "Unemployment", "Temp", "Notes", "By"].map(h => (
                            <th key={h} style={{ padding: "8px 10px", textAlign: "left", color: C.textMuted, fontWeight: 600 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { date: "May 2026", inbound: "TBD", outbound: "TBD", cpi: 163.2, unemp: 7.4, temp: 14.2, notes: "Awaiting close", by: "System" },
                        ].map((row, i) => (
                          <tr key={i} style={{ borderBottom: `0.5px solid ${C.borderLight}`, background: i % 2 === 0 ? C.surfaceGreen : C.surfaceWhite }}>
                            <td style={{ padding: "8px 10px", color: C.textPrimary, fontWeight: 500 }}>{row.date}</td>
                            <td style={{ padding: "8px 10px", color: C.textSecondary }}>{row.inbound}</td>
                            <td style={{ padding: "8px 10px", color: C.textSecondary }}>{row.outbound}</td>
                            <td style={{ padding: "8px 10px", color: C.textSecondary }}>{row.cpi}</td>
                            <td style={{ padding: "8px 10px", color: C.textSecondary }}>{row.unemp}%</td>
                            <td style={{ padding: "8px 10px", color: C.textSecondary }}>{row.temp}°C</td>
                            <td style={{ padding: "8px 10px", color: C.textMuted, fontStyle: row.notes ? "normal" : "italic" }}>{row.notes || "—"}</td>
                            <td style={{ padding: "8px 10px", color: C.textMuted }}>{row.by}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              </div>
            )}
          </>
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
