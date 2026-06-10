import { useState, useEffect } from "react";
import {
  ComposedChart, LineChart, BarChart,
  Line, Bar, Cell, XAxis, YAxis, CartesianGrid,
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
  textMuted:    "#7a9485",
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
  other:          C.textMuted,
};

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionTitle({ title, sub }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 18, fontWeight: 600, color: C.textPrimary }}>{title}</div>
      {sub && <div style={{ fontSize: 13, color: C.textMuted, marginTop: 2 }}>{sub}</div>}
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
      fontSize: 11, fontWeight: 500, background: bg, color,
    }}>
      {children}
    </span>
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
      {payload.map((p) => p.value != null && (
        <div key={p.name} style={{ display: "flex", justifyContent: "space-between", gap: 16, opacity: 0.9 }}>
          <span>{p.name}</span>
          <span style={{ fontWeight: 600 }}>{(p.value / 1000).toFixed(1)}K lbs</span>
        </div>
      ))}
    </div>
  );
};

// ── Data input form ───────────────────────────────────────────────────────────

function DataInputForm() {
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
    width: "100%", padding: "8px 11px", fontSize: 13,
    border: `1px solid ${C.borderLight}`, borderRadius: 8,
    background: C.surfaceGreen, color: C.textPrimary, outline: "none",
    fontFamily: "inherit",
  };

  return (
    <Panel>
      <SectionTitle
        title="Add monthly data row"
        sub="Staff input — new rows are queued for the next model run"
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12, marginBottom: 12 }}>
        {fields.map((f) => (
          <div key={f.key}>
            <div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 4, fontWeight: 500 }}>
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
        <div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 4, fontWeight: 500 }}>Notes (optional)</div>
        <textarea
          value={form.notes}
          onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
          placeholder="Any context for this month — unusual donation event, data anomaly..."
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
            <i className="ti ti-circle-check" aria-hidden="true" />
            Row queued successfully
          </span>
        )}
        <span style={{ fontSize: 11, color: C.textMuted, marginLeft: "auto" }}>
          Full CSV upload coming soon
        </span>
      </div>
    </Panel>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Provincial() {
  const [activeTab, setActiveTab] = useState("overview");

  const [historyData, setHistoryData] = useState([]);
  const [featureData, setFeatureData] = useState([]);
  const [modelStats,  setModelStats]  = useState([]);
  const [signals,     setSignals]     = useState([]);
  const [confidence,  setConfidence]  = useState(null);
  const [gapForecast, setGapForecast] = useState([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/provincial/history").then(r => r.json()),
      fetch("/api/provincial/features").then(r => r.json()),
      fetch("/api/provincial/metrics").then(r => r.json()),
      fetch("/api/signals").then(r => r.json()),
      fetch("/api/model_summary").then(r => r.json()),
      fetch("/api/gap").then(r => r.json()),
    ])
      .then(([hist, feats, metrics, sigs, summary, gap]) => {
        setHistoryData(hist.historyData ?? []);
        setFeatureData(feats.featureData ?? []);
        setModelStats(metrics.modelStats ?? []);
        setSignals(sigs.signals ?? []);
        setConfidence(summary);
        setGapForecast(gap.forecastGap ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const tabs = [
    { key: "overview",   label: "Overview"     },
    { key: "model",      label: "Model detail" },
    { key: "allocation", label: "Allocation"   },
    { key: "input",      label: "Data input"   },
  ];

  // Stat card derivations
  const actualRows = historyData.filter(d => d.inbound !== null);
  const lastTwo    = actualRows.slice(-2);
  const pctIn = lastTwo.length === 2
    ? ((lastTwo[1].inbound - lastTwo[0].inbound) / (lastTwo[0].inbound || 1) * 100).toFixed(1)
    : null;

  const topLevel = signals.find(s => s.level === "High") ? "High"
    : signals.find(s => s.level === "Medium") ? "Medium"
    : "Low";
  const demandLabel = { High: "Elevated", Medium: "Moderate", Low: "Stable" }[topLevel] ?? "—";
  const demandStyle = LEVEL_STYLE[topLevel] ?? LEVEL_STYLE.Low;

  const detectionRate = modelStats.find(s => s.label === "Shortfall detection accuracy")?.value ?? "N/A";

  const topGapAlert = gapForecast[0]?.alert ?? "OK";
  const gapLabel    = { Critical: "Critical", Warning: "Warning", Watch: "Watch", OK: "Balanced" }[topGapAlert] ?? "—";
  const gapStyle    = topGapAlert === "Critical" ? LEVEL_STYLE.High
    : topGapAlert === "Warning" ? LEVEL_STYLE.Medium
    : LEVEL_STYLE.Low;

  const confPct   = confidence?.confidence_pct ?? "—";
  const confLabel = confidence?.confidence_label ?? "confidence";

  // Keep last 18 rows of history + forecast for chart clarity
  const chartData = historyData.length > 20 ? historyData.slice(-20) : historyData;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.pageBg, overflow: "hidden" }}>

      {/* Header */}
      <header style={{ padding: "32px 28px 0", background: C.pageBg, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 25, fontWeight: 700, color: C.forestGreen, marginBottom: 4 }}>
              Provincial model
            </div>
            <div style={{ fontSize: 13, color: C.textMuted }}>
              Model 1 · Predicts provincial inbound donations and outbound to regional FBs
            </div>
          </div>
          {/* Model health badge */}
          <div style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "7px 14px", borderRadius: 8,
            background: "#e2ffec", color: "#1a8b20", border: "0.5px solid #ace890",
            fontSize: 13,
          }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.jungleTeal }} />
            <span style={{ color: C.textSecondary }}>Model health: </span>
            <span style={{ fontWeight: 600, color: C.forestGreen }}>
              {confidence ? `${confPct}% ${confLabel} confidence` : "—"}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 2, borderBottom: `1px solid ${C.borderLight}` }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                padding: "8px 18px", fontSize: 14, cursor: "pointer",
                border: "none", background: "none",
                color: activeTab === t.key ? C.forestGreen : C.textMuted,
                fontWeight: activeTab === t.key ? 600 : 400,
                borderBottom: activeTab === t.key ? `2px solid ${C.jungleTeal}` : "2px solid transparent",
                marginBottom: -1,
                fontFamily: "inherit",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px 32px" }}>

        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: C.textMuted, fontSize: 13 }}>
            Loading model data…
          </div>
        ) : (
          <>
            {/* ── OVERVIEW TAB ── */}
            {activeTab === "overview" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Stat row */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 14 }}>
                  {[
                    {
                      label: "Inbound trend",
                      value: pctIn !== null ? `${parseFloat(pctIn) >= 0 ? "+" : ""}${pctIn}%` : "N/A",
                      sub: "vs last month", accent: C.jungleTeal,
                      badgeBg: C.teaGreen, badgeColor: C.forestGreen,
                    },
                    {
                      label: "Outbound signal", value: demandLabel, sub: "next 30 days",
                      accent: "#c0622a", badgeBg: demandStyle.bg, badgeColor: demandStyle.color, small: true,
                    },
                    {
                      label: "Shortfall detection", value: detectionRate, sub: "of deficit months caught",
                      accent: C.dustyDenim, badgeBg: "#ddeaf8", badgeColor: "#2d5a9e",
                    },
                    {
                      label: "Supply-demand gap", value: gapLabel, sub: "3-month outlook",
                      accent: C.lightGold, badgeBg: gapStyle.bg, badgeColor: gapStyle.color, small: true,
                    },
                  ].map((s) => (
                    <div key={s.label} style={{
                      background: C.surfaceWhite, border: `0.5px solid ${C.borderLight}`,
                      borderTop: `3px solid ${s.accent}`, borderRadius: 12, padding: "14px 16px",
                    }}>
                      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>{s.label}</div>
                      <div style={{ fontSize: s.small ? 16 : 18, fontWeight: 600, color: C.textPrimary, marginBottom: 6 }}>{s.value}</div>
                      <Badge bg={s.badgeBg} color={s.badgeColor}>{s.sub}</Badge>
                    </div>
                  ))}
                </div>

                {/* 3-month gap forecast */}
                {gapForecast.length > 0 && (
                  <Panel>
                    <SectionTitle
                      title="3-month supply-demand outlook"
                      sub="AI forecast with 80% confidence range"
                    />
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12 }}>
                      {gapForecast.map((row) => {
                        const isGap  = row.Gap_forecast < 0;
                        const isCrit = row.alert === "Critical";
                        const isWarn = row.alert === "Warning";
                        const accentColor = isCrit ? "#e8a090" : isWarn ? "#d4c060" : isGap ? "#c9d8e8" : "#ace890";
                        const badgeBg     = isCrit ? "#fdecea" : isWarn ? "#fdf6d8" : isGap ? "#ddeaf8" : "#e2ffec";
                        const badgeColor  = isCrit ? "#8b2e1a" : isWarn ? "#7a6010" : isGap ? "#2d5a9e" : "#1a8b20";
                        const gapAbs = Math.abs(row.Gap_forecast);
                        return (
                          <div key={row.period} style={{
                            border: `0.5px solid ${accentColor}`,
                            borderTop: `3px solid ${accentColor}`,
                            borderRadius: 10, padding: "14px 16px",
                            background: C.surfaceGreen,
                          }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                              <span style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary }}>{row.month}</span>
                              <span style={{
                                fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 20,
                                background: badgeBg, color: badgeColor,
                              }}>{row.alert}</span>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                              <div>
                                <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 3 }}>Donations in</div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: C.jungleTeal }}>
                                  {(row.LBS_In_forecast / 1000).toFixed(0)}K
                                  <span style={{ fontSize: 11, fontWeight: 400, color: C.textMuted }}> lbs</span>
                                </div>
                              </div>
                              <div>
                                <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 3 }}>Demand out</div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: "#c0622a" }}>
                                  {(row.LBS_Out_forecast / 1000).toFixed(0)}K
                                  <span style={{ fontSize: 11, fontWeight: 400, color: C.textMuted }}> lbs</span>
                                </div>
                              </div>
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: isGap ? "#8b2e1a" : "#1a8b20" }}>
                              {isGap ? "▼" : "▲"} {(gapAbs / 1000).toFixed(0)}K lbs {isGap ? "shortfall" : "surplus"}
                            </div>
                            <div style={{ fontSize: 10, color: C.textMuted, marginTop: 5 }}>
                              {row.confidence_pct}% model confidence
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Panel>
                )}

                {/* Main chart */}
                <Panel>
                  <SectionTitle
                    title="Inbound donations vs outbound allocation — history + 3-month forecast"
                    sub="Monthly lbs totals · solid = actual, dashed = model fit / forecast"
                  />
                  <ResponsiveContainer width="100%" height={230}>
                    <ComposedChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.teaGreen} />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: C.textMuted }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                      <YAxis
                        domain={["auto", "auto"]}
                        tickFormatter={v => `${(v / 1000).toFixed(0)}K`}
                        tick={{ fontSize: 11, fill: C.textMuted }} axisLine={false} tickLine={false} width={45}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Line type="monotone" dataKey="inbound"   name="Inbound (actual)"  stroke={C.jungleTeal} strokeWidth={2.5} dot={false} connectNulls={false} />
                      <Line type="monotone" dataKey="outbound"  name="Outbound (actual)" stroke={C.wheat}      strokeWidth={2.5} dot={false} strokeDasharray="5 3" connectNulls={false} />
                      <Line type="monotone" dataKey="predicted" name="Model forecast"    stroke={C.dustyDenim} strokeWidth={2}   dot={{ r: 3 }} strokeDasharray="7 4" connectNulls />
                    </ComposedChart>
                  </ResponsiveContainer>
                  <div style={{ display: "flex", gap: 20, marginTop: 10 }}>
                    {[
                      { color: C.jungleTeal, label: "Inbound (actual)"  },
                      { color: C.wheat,      label: "Outbound (actual)" },
                      { color: C.dustyDenim, label: "Model forecast"    },
                    ].map(({ color, label }) => (
                      <span key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.textMuted }}>
                        <span style={{ width: 10, height: 3, background: color, display: "inline-block", borderRadius: 2 }} />
                        {label}
                      </span>
                    ))}
                  </div>
                </Panel>

                {/* Demand signals */}
                <Panel>
                  <SectionTitle title="Active demand signals" sub="Key drivers identified by the model this month" />
                  {signals.length === 0 ? (
                    <div style={{ fontSize: 13, color: C.textMuted, textAlign: "center", padding: "16px 0" }}>
                      No active demand signals detected
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 8 }}>
                      {signals.map((s) => {
                        const sty = LEVEL_STYLE[s.level] ?? LEVEL_STYLE.Low;
                        return (
                          <div key={s.name} style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "10px 12px", borderRadius: 8,
                            background: C.surfaceGreen, border: `0.5px solid ${C.borderLight}`,
                          }}>
                            <div style={{ fontSize: 14, color: C.textPrimary, fontWeight: 500, textAlign: "left" }}>{s.name}</div>
                            <Badge bg={sty.bg} color={sty.color}>{s.level}</Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Panel>
              </div>
            )}

            {/* ── MODEL DETAIL TAB ── */}
            {activeTab === "model" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Ensemble info banner */}
                <div style={{
                  background: "#e2ffec", border: "0.5px solid #ace890",
                  borderRadius: 10, padding: "12px 16px",
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.jungleTeal, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: C.textPrimary }}>
                    <strong>How the forecast works:</strong> The model tracks long-term donation trends and seasonal
                    patterns alongside external indicators like food prices, benefit caseloads, and temperature.
                    It then predicts whether demand will outpace supply in the coming months.
                  </span>
                </div>

                {/* Model stats */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 14 }}>
                  {modelStats.map((s) => (
                    <div key={s.label} style={{
                      background: C.surfaceGreen, border: `0.5px solid ${C.borderLight}`,
                      borderRadius: 12, padding: "14px 16px",
                    }}>
                      <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 6 }}>{s.label}</div>
                      <div style={{ fontSize: 17, fontWeight: 600, color: C.textPrimary }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* Gap classifier metrics */}
                {confidence?.targets?.LBS_In?.gap_accuracy != null && (
                  <Panel>
                    <SectionTitle
                      title="How well does the model detect shortfall months?"
                      sub="Tested against months the model had never seen before"
                    />
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12 }}>
                      {[
                        { label: "Correct predictions", value: `${(confidence.targets.LBS_In.gap_accuracy * 100).toFixed(1)}%`, color: C.jungleTeal },
                        { label: "Detection quality",   value: (confidence.targets.LBS_In.gap_f1 ?? "—").toString().substring(0, 5),       color: C.dustyDenim },
                        { label: "Surplus months identified", value: `${((confidence.targets.LBS_In.gap_sur_recall ?? 0) * 100).toFixed(1)}%`, color: "#a889cc" },
                      ].map((m) => (
                        <div key={m.label} style={{
                          background: C.surfaceGreen, border: `0.5px solid ${C.borderLight}`,
                          borderRadius: 10, padding: "12px 16px",
                        }}>
                          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>{m.label}</div>
                          <div style={{ fontSize: 22, fontWeight: 700, color: m.color }}>{m.value}</div>
                        </div>
                      ))}
                    </div>
                  </Panel>
                )}

                {/* Feature importance chart */}
                <Panel>
                  <SectionTitle
                    title="What's driving the forecast?"
                    sub="How much each external factor shapes the supply-demand outlook · colour = category"
                  />
                  {featureData.length === 0 ? (
                    <div style={{ fontSize: 13, color: C.textMuted, textAlign: "center", padding: "20px 0" }}>
                      No feature data available
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={Math.max(280, featureData.length * 22)}>
                      <BarChart
                        data={featureData}
                        layout="vertical"
                        margin={{ top: 4, right: 50, bottom: 0, left: 120 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={C.teaGreen} horizontal={false} />
                        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: C.textMuted }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: C.textSecondary }} axisLine={false} tickLine={false} width={120} />
                        <Bar
                          dataKey="importance" name="Importance %" radius={[0, 4, 4, 0]} barSize={14}
                          fill={C.jungleTeal}
                          label={{ position: "right", fontSize: 11, fill: C.textMuted, formatter: v => `${v}%` }}
                        >
                          {featureData.map((entry, i) => (
                            <Cell key={`cell-${i}`} fill={catColor[entry.category] ?? C.textMuted} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}

                  {/* Category legend — only show categories present in the current data */}
                  <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
                    {[...new Set(featureData.map(d => d.category))].map((cat) => (
                      <span key={cat} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.textMuted }}>
                        <span style={{ width: 10, height: 10, background: catColor[cat] ?? C.textMuted, display: "inline-block", borderRadius: 2 }} />
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </span>
                    ))}
                  </div>
                </Panel>

                {/* Actual vs predicted chart */}
                <Panel>
                  <SectionTitle
                    title="How closely the model tracks past data"
                    sub="Solid = real data · dashed = what the model estimated"
                  />
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart
                      data={historyData.filter(d => d.outbound !== null).slice(-18)}
                      margin={{ top: 4, right: 16, bottom: 0, left: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={C.teaGreen} />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: C.textMuted }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                      <YAxis
                        domain={["auto", "auto"]}
                        tickFormatter={v => `${(v / 1000).toFixed(0)}K`}
                        tick={{ fontSize: 11, fill: C.textMuted }} axisLine={false} tickLine={false} width={45}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Line type="monotone" dataKey="outbound"  name="Actual"    stroke={C.jungleTeal} strokeWidth={2.5} dot={false} />
                      <Line type="monotone" dataKey="predicted" name="Predicted" stroke={C.dustyDenim} strokeWidth={2}   dot={false} strokeDasharray="5 3" />
                    </LineChart>
                  </ResponsiveContainer>
                </Panel>
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
                <DataInputForm />

                {/* Recent entries table */}
                <Panel>
                  <SectionTitle title="Recent staff entries" sub="Last 5 manually submitted rows" />
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
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
      </div>
    </div>
  );
}
