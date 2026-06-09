import { useState } from "react";
import {
  ComposedChart, LineChart, BarChart,
  Line, Bar, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend,
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

// ── Mock data ─────────────────────────────────────────────────────────────────

const historyData = [
  { date: "Jan",  inbound: 98,  outbound: 95,  predicted: 96  },
  { date: "Feb",  inbound: 104, outbound: 100, predicted: 102 },
  { date: "Mar",  inbound: 101, outbound: 103, predicted: 101 },
  { date: "Apr",  inbound: 107, outbound: 108, predicted: 109 },
  { date: "May",  inbound: 112, outbound: 110, predicted: 112 },
  { date: "Jun",  inbound: 116, outbound: 118, predicted: 120 },
  { date: "Jul",  inbound: null, outbound: null, predicted: 122 },
  { date: "Aug",  inbound: null, outbound: null, predicted: 115 },
  { date: "Sep",  inbound: null, outbound: null, predicted: 108 },
];

const featureData = [
  { name: "CPI food",          importance: 88, category: "economic" },
  { name: "Unemployment rate", importance: 74, category: "economic" },
  { name: "AISH caseload",     importance: 61, category: "social"   },
  { name: "School in session", importance: 43, category: "calendar" },
  { name: "CCB dates",         importance: 38, category: "calendar" },
  { name: "Mean temperature",  importance: 27, category: "weather"  },
  { name: "Net migration",     importance: 22, category: "social"   },
  { name: "Stat holidays",     importance: 18, category: "calendar" },
  { name: "GST dates",         importance: 15, category: "calendar" },
  { name: "Snow on ground",    importance: 11, category: "weather"  },
];

const modelStats = [
  { label: "MAE (mean abs. error)", value: "4.2 pts" },
  { label: "RMSE",                  value: "5.8 pts" },
  { label: "Last retrained",        value: "Jun 1, 2026" },
  { label: "Training window",       value: "2021 – May 2026" },
  { label: "Features used",         value: "34 variables" },
  { label: "Forecast horizon",      value: "90 days" },
];

const catColor = { economic: C.jungleTeal, social: C.dustyDenim, calendar: C.lightGold, weather: C.wheat };

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionTitle({ title, sub }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary }}>{title}</div>
      {sub && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{sub}</div>}
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
          <span>{p.name}</span><span style={{ fontWeight: 600 }}>{p.value}</span>
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
    { key: "date",         label: "Date",              type: "date",   placeholder: ""        },
    { key: "inbound",      label: "Inbound (index)",   type: "number", placeholder: "e.g. 108" },
    { key: "outbound",     label: "Outbound (index)",  type: "number", placeholder: "e.g. 112" },
    { key: "cpi_food",     label: "CPI food index",    type: "number", placeholder: "e.g. 163.2" },
    { key: "unemployment", label: "Unemployment rate", type: "number", placeholder: "e.g. 7.4" },
    { key: "mean_temp",    label: "Mean temp (°C)",    type: "number", placeholder: "e.g. 14.2" },
  ];

  function handleSubmit() {
    // In production: POST to FastAPI backend
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
        title="Add daily data row"
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
          placeholder="Any context for this day — holiday, special event, data anomaly..."
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
  const tabs = [
    { key: "overview",    label: "Overview"    },
    { key: "model",       label: "Model detail" },
    { key: "allocation",  label: "Allocation"  },
    { key: "input",       label: "Data input"  },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.pageBg, overflow: "hidden" }}>

      {/* Header */}
      <header style={{ padding: "32px 28px 0", background: C.pageBg, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.forestGreen, marginBottom: 4 }}>
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
            background: C.surfaceWhite, border: `0.5px solid ${C.borderLight}`,
            fontSize: 12,
          }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.jungleTeal }} />
            <span style={{ color: C.textSecondary }}>Model healthy · </span>
            <span style={{ fontWeight: 600, color: C.forestGreen }}>84% confidence</span>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 2, borderBottom: `1px solid ${C.borderLight}` }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                padding: "8px 18px", fontSize: 13, cursor: "pointer",
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

        {/* ── OVERVIEW TAB ── */}
        {activeTab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Stat row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 14 }}>
              {[
                { label: "Inbound trend",    value: "+12%",    sub: "vs last month",   accent: C.jungleTeal, badgeBg: C.teaGreen,  badgeColor: C.forestGreen },
                { label: "Outbound signal",  value: "Elevated",sub: "next 30 days",    accent: "#c0622a",    badgeBg: "#fdecea",   badgeColor: "#8b2e1a", small: true },
                { label: "Forecast MAE",     value: "4.2 pts", sub: "mean abs. error", accent: C.dustyDenim, badgeBg: "#ddeaf8",   badgeColor: "#2d5a9e" },
                { label: "Supply-demand gap",value: "Moderate",sub: "needs attention", accent: C.lightGold,  badgeBg: "#fdf6d8",   badgeColor: "#7a6010", small: true },
              ].map((s) => (
                <div key={s.label} style={{
                  background: C.surfaceWhite, border: `0.5px solid ${C.borderLight}`,
                  borderTop: `3px solid ${s.accent}`, borderRadius: 12, padding: "14px 16px",
                }}>
                  <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: s.small ? 16 : 22, fontWeight: 600, color: C.textPrimary, marginBottom: 6 }}>{s.value}</div>
                  <Badge bg={s.badgeBg} color={s.badgeColor}>{s.sub}</Badge>
                </div>
              ))}
            </div>

            {/* Main chart */}
            <Panel>
              <SectionTitle
                title="Inbound donations vs outbound allocation — indexed history + forecast"
                sub="Indexed to baseline (100 = monthly avg) · actual Jan–Jun, forecast Jul–Sep · no raw volumes shown"
              />
              <ResponsiveContainer width="100%" height={230}>
                <ComposedChart data={historyData} margin={{ top: 4, right: 16, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.teaGreen} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: C.textMuted }} axisLine={false} tickLine={false} />
                  <YAxis domain={[85, 135]} tick={{ fontSize: 11, fill: C.textMuted }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <ReferenceLine y={100} stroke={C.wheat} strokeDasharray="4 2" label={{ value: "baseline", position: "insideTopLeft", fontSize: 10, fill: C.textMuted }} />
                  <Line type="monotone" dataKey="inbound"   name="Inbound (actual)"  stroke={C.jungleTeal} strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} />
                  <Line type="monotone" dataKey="outbound"  name="Outbound (actual)" stroke={C.wheat}      strokeWidth={2.5} dot={{ r: 3 }} strokeDasharray="5 3" connectNulls={false} />
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
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 8 }}>
                {[
                  { name: "CPI food index elevated",  level: "High",   bg: "#fdecea", color: "#8b2e1a", note: "163.2 — highest since 2022" },
                  { name: "Unemployment rising",      level: "High",   bg: "#fdecea", color: "#8b2e1a", note: "7.4% province-wide (+0.3 MoM)" },
                  { name: "AISH disbursement week",   level: "Medium", bg: "#fdf6d8", color: "#7a6010", note: "Jun 3 — mid-week dip expected" },
                  { name: "School in session",        level: "Medium", bg: "#fdf6d8", color: "#7a6010", note: "Increases family visits" },
                  { name: "No stat holidays",         level: "Low",    bg: C.surfaceGreen, color: C.textSecondary, note: "Neutral effect" },
                  { name: "Mild temperature forecast",level: "Low",    bg: C.surfaceGreen, color: C.textSecondary, note: "~15°C avg — no weather spike" },
                ].map((s) => (
                  <div key={s.name} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 12px", borderRadius: 8,
                    background: C.surfaceGreen, border: `0.5px solid ${C.borderLight}`,
                  }}>
                    <div>
                      <div style={{ fontSize: 12, color: C.textPrimary, fontWeight: 500 }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{s.note}</div>
                    </div>
                    <Badge bg={s.bg} color={s.color}>{s.level}</Badge>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        )}

        {/* ── MODEL DETAIL TAB ── */}
        {activeTab === "model" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Model stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 14 }}>
              {modelStats.map((s) => (
                <div key={s.label} style={{
                  background: C.surfaceWhite, border: `0.5px solid ${C.borderLight}`,
                  borderRadius: 12, padding: "14px 16px",
                }}>
                  <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 17, fontWeight: 600, color: C.textPrimary }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Feature importance chart */}
            <Panel>
              <SectionTitle
                title="Feature importance (XGBoost)"
                sub="Relative contribution of each variable to the forecast · colour = category"
              />
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={featureData}
                  layout="vertical"
                  margin={{ top: 4, right: 40, bottom: 0, left: 100 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={C.teaGreen} horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: C.textMuted }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: C.textSecondary }} axisLine={false} tickLine={false} width={100} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="importance" name="Importance %" radius={[0, 4, 4, 0]} barSize={14}
                    fill={C.jungleTeal}
                    label={{ position: "right", fontSize: 11, fill: C.textMuted, formatter: v => `${v}%` }}
                  />
                </BarChart>
              </ResponsiveContainer>

              {/* Category legend */}
              <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
                {Object.entries(catColor).map(([cat, color]) => (
                  <span key={cat} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.textMuted }}>
                    <span style={{ width: 10, height: 10, background: color, display: "inline-block", borderRadius: 2 }} />
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </span>
                ))}
              </div>
            </Panel>

            {/* Actual vs predicted accuracy */}
            <Panel>
              <SectionTitle
                title="Actual vs predicted — model accuracy (Jan–Jun 2026)"
                sub="Closer lines = better model fit · gap = prediction error"
              />
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={historyData.filter(d => d.outbound)} margin={{ top: 4, right: 16, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.teaGreen} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: C.textMuted }} axisLine={false} tickLine={false} />
                  <YAxis domain={[85, 125]} tick={{ fontSize: 11, fill: C.textMuted }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="outbound"  name="Actual"    stroke={C.jungleTeal} strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="predicted" name="Predicted" stroke={C.dustyDenim} strokeWidth={2}   dot={{ r: 3 }} strokeDasharray="5 3" />
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
                      { date: "Jun 6", inbound: 122, outbound: 119, cpi: 163.2, unemp: 7.4, temp: 14.2, notes: "Friday rush", by: "Staff" },
                      { date: "Jun 5", inbound: 118, outbound: 115, cpi: 163.2, unemp: 7.4, temp: 13.8, notes: "",             by: "Staff" },
                      { date: "Jun 4", inbound: 95,  outbound: 92,  cpi: 163.2, unemp: 7.4, temp: 11.1, notes: "AISH week",   by: "Staff" },
                      { date: "Jun 3", inbound: 92,  outbound: 89,  cpi: 163.2, unemp: 7.4, temp: 10.5, notes: "AISH day",    by: "Staff" },
                      { date: "Jun 2", inbound: 108, outbound: 105, cpi: 162.8, unemp: 7.4, temp: 12.3, notes: "",             by: "Staff" },
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

      </div>
    </div>
  );
}
