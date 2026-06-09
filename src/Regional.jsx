import { useState } from "react";
import {
  ComposedChart, AreaChart, LineChart, BarChart,
  Line, Bar, Area, XAxis, YAxis, CartesianGrid,
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
  textMuted:    "#7a9485",
};

// ── Mock data ─────────────────────────────────────────────────────────────────

// Daily — last 7 actual + 7 forecast
const dailyData = [
  { day: "May 30", actual: 102, forecast: null, lower: null, upper: null },
  { day: "Jun 2",  actual: 108, forecast: null, lower: null, upper: null },
  { day: "Jun 3",  actual: 91,  forecast: null, lower: null, upper: null }, // AISH dip
  { day: "Jun 4",  actual: 94,  forecast: null, lower: null, upper: null },
  { day: "Jun 5",  actual: 118, forecast: null, lower: null, upper: null },
  { day: "Jun 6",  actual: 123, forecast: null, lower: null, upper: null },
  { day: "Jun 7",  actual: 105, forecast: null, lower: null, upper: null },
  { day: "Jun 8",  actual: null, forecast: 88,  lower: 80,  upper: 96  },
  { day: "Jun 9",  actual: null, forecast: 126, lower: 114, upper: 138 },
  { day: "Jun 10", actual: null, forecast: 120, lower: 108, upper: 132 },
  { day: "Jun 11", actual: null, forecast: 113, lower: 101, upper: 125 },
  { day: "Jun 12", actual: null, forecast: 129, lower: 116, upper: 142 },
  { day: "Jun 13", actual: null, forecast: 132, lower: 118, upper: 146 },
  { day: "Jun 14", actual: null, forecast: 107, lower: 95,  upper: 119 },
];

// Weekly — 6 actual + 4 forecast
const weeklyData = [
  { week: "Apr 28", actual: 96,  forecast: null },
  { week: "May 5",  actual: 99,  forecast: null },
  { week: "May 12", actual: 103, forecast: null },
  { week: "May 19", actual: 108, forecast: null },
  { week: "May 26", actual: 112, forecast: null },
  { week: "Jun 2",  actual: 118, forecast: null },
  { week: "Jun 9",  actual: null, forecast: 124 },
  { week: "Jun 16", actual: null, forecast: 119 },
  { week: "Jun 23", actual: null, forecast: 111 },
  { week: "Jun 30", actual: null, forecast: 104 },
];

// Provincial connection signal
const provSignal = {
  status: "Flagged",
  message: "Regional client demand forecast (+24% above avg next week) has triggered a provincial allocation review. Edmonton quota recommended to increase by 10–15% for Jun 9–21 shipments.",
  triggeredAt: "Jun 7, 2026 · automated",
  color: "#8b2e1a", bg: "#fdecea", border: "#e8a090",
};

const featureData = [
  { name: "CPI food",          importance: 85 },
  { name: "Unemployment rate", importance: 71 },
  { name: "AISH caseload",     importance: 66 },
  { name: "CCB dates",         importance: 52 },
  { name: "School in session", importance: 44 },
  { name: "Mean temperature",  importance: 31 },
  { name: "GST dates",         importance: 22 },
  { name: "Snow on ground",    importance: 14 },
];

const modelStats = [
  { label: "MAE (daily)",        value: "5.1 pts"        },
  { label: "RMSE (daily)",       value: "7.3 pts"        },
  { label: "Weekly MAE",         value: "3.8 pts"        },
  { label: "Last retrained",     value: "Jun 1, 2026"    },
  { label: "Training window",    value: "Regional FB data (pending full dataset)" },
  { label: "Forecast horizon",   value: "30 days daily · 90 days weekly" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getBusyness(index) {
  if (index >= 125) return { label: "Very busy", color: "#8b2e1a", bar: "#c0622a", pct: 95 };
  if (index >= 110) return { label: "Busy",      color: "#7a4010", bar: "#d07030", pct: 72 };
  if (index >= 95)  return { label: "Moderate",  color: "#7a6010", bar: C.lightGold, pct: 52 };
  return               { label: "Quiet",      color: C.forestGreen, bar: C.jungleTeal, pct: 28 };
}

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
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary }}>{title}</div>
      {sub && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Badge({ children, bg, color }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 9px", borderRadius: 20,
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
      {payload.map((p) => p.value != null && p.name !== "CI band" && (
        <div key={p.name} style={{ display: "flex", justifyContent: "space-between", gap: 16, opacity: 0.9 }}>
          <span>{p.name}</span>
          <span style={{ fontWeight: 600 }}>{p.value}</span>
        </div>
      ))}
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
    width: "100%", padding: "8px 11px", fontSize: 13,
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
            <div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 4, fontWeight: 500 }}>{f.label}</div>
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
        <div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 4, fontWeight: 500 }}>Notes (optional)</div>
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
        <span style={{ fontSize: 11, color: C.textMuted, marginLeft: "auto" }}>
          Full CSV upload coming soon
        </span>
      </div>
    </Panel>
  );
}

// ── Recent entries table ──────────────────────────────────────────────────────

function RecentEntries() {
  const rows = [
    { date: "Jun 6", visits: 341, households: 218, cpi: 163.2, unemp: 7.4, temp: 14.2, aish: false, ccb: false, notes: "Friday — very busy" },
    { date: "Jun 5", visits: 318, households: 201, cpi: 163.2, unemp: 7.4, temp: 13.8, aish: false, ccb: false, notes: "" },
    { date: "Jun 4", visits: 264, households: 172, cpi: 163.2, unemp: 7.4, temp: 11.1, aish: true,  ccb: false, notes: "AISH week — quieter" },
    { date: "Jun 3", visits: 249, households: 160, cpi: 163.2, unemp: 7.4, temp: 10.5, aish: true,  ccb: false, notes: "AISH disbursement day" },
    { date: "Jun 2", visits: 295, households: 188, cpi: 162.8, unemp: 7.4, temp: 12.3, aish: false, ccb: false, notes: "" },
  ];

  return (
    <Panel>
      <SectionTitle title="Recent staff entries" sub="Last 5 manually submitted regional rows" />
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.borderLight}` }}>
              {["Date","Visits","Households","CPI food","Unemp.","Temp","AISH wk","CCB wk","Notes"].map(h => (
                <th key={h} style={{ padding: "8px 10px", textAlign: "left", color: C.textMuted, fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderBottom: `0.5px solid ${C.borderLight}`, background: i % 2 === 0 ? C.surfaceGreen : C.surfaceWhite }}>
                <td style={{ padding: "8px 10px", fontWeight: 500, color: C.textPrimary }}>{r.date}</td>
                <td style={{ padding: "8px 10px", color: C.textSecondary }}>{r.visits}</td>
                <td style={{ padding: "8px 10px", color: C.textSecondary }}>{r.households}</td>
                <td style={{ padding: "8px 10px", color: C.textSecondary }}>{r.cpi}</td>
                <td style={{ padding: "8px 10px", color: C.textSecondary }}>{r.unemp}%</td>
                <td style={{ padding: "8px 10px", color: C.textSecondary }}>{r.temp}°C</td>
                <td style={{ padding: "8px 10px" }}>
                  <span style={{ fontSize: 11, color: r.aish ? C.jungleTeal : C.textMuted }}>{r.aish ? "✓" : "—"}</span>
                </td>
                <td style={{ padding: "8px 10px" }}>
                  <span style={{ fontSize: 11, color: r.ccb ? C.jungleTeal : C.textMuted }}>{r.ccb ? "✓" : "—"}</span>
                </td>
                <td style={{ padding: "8px 10px", color: C.textMuted, fontStyle: r.notes ? "normal" : "italic" }}>{r.notes || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Regional() {
  const [activeTab, setActiveTab] = useState("daily");

  const tabs = [
    { key: "daily",  label: "Daily forecast"  },
    { key: "weekly", label: "Weekly forecast" },
    { key: "model",  label: "Model detail"    },
    { key: "input",  label: "Data input"      },
  ];

  const thisWeekBusy  = getBusyness(124);
  const nextWeekBusy  = getBusyness(119);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.pageBg, overflow: "hidden" }}>

      {/* Header */}
      <header style={{ padding: "32px 28px 0", background: C.pageBg, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.forestGreen, marginBottom: 4 }}>
              Regional model
            </div>
            <div style={{ fontSize: 13, color: C.textMuted }}>
              Model 2 · Edmonton regional FB · predicts daily &amp; weekly client demand · outbound = real client visits
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {/* Provincial link status */}
            <div style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "7px 12px", borderRadius: 8,
              background: "#fdecea", border: "0.5px solid #e8a090",
              fontSize: 12,
            }}>
              <i className="ti ti-alert-triangle" style={{ fontSize: 13, color: "#8b2e1a" }} aria-hidden="true" />
              <span style={{ color: "#8b2e1a", fontWeight: 600 }}>Provincial flagged</span>
            </div>
            <div style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "7px 14px", borderRadius: 8,
              background: C.surfaceWhite, border: `0.5px solid ${C.borderLight}`,
              fontSize: 12,
            }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.jungleTeal }} />
              <span style={{ color: C.textSecondary }}>Model healthy · </span>
              <span style={{ fontWeight: 600, color: C.forestGreen }}>81% confidence</span>
            </div>
          </div>
        </div>

        {/* Provincial connection alert */}
        <div style={{
          display: "flex", gap: 12, alignItems: "flex-start",
          padding: "12px 16px", borderRadius: 10, marginBottom: 16,
          background: provSignal.bg, border: `0.5px solid ${provSignal.border}`,
        }}>
          <i className="ti ti-link" style={{ fontSize: 16, color: provSignal.color, marginTop: 1, flexShrink: 0 }} aria-hidden="true" />
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: provSignal.color, marginBottom: 3 }}>
              Provincial connection · {provSignal.status}
            </div>
            <div style={{ fontSize: 12, color: "#a03020", lineHeight: 1.6 }}>{provSignal.message}</div>
            <div style={{ fontSize: 11, color: "#c06050", marginTop: 4 }}>Triggered: {provSignal.triggeredAt}</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 2, borderBottom: `1px solid ${C.borderLight}` }}>
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
              padding: "8px 18px", fontSize: 13, cursor: "pointer",
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

        {/* ── DAILY TAB ── */}
        {activeTab === "daily" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Busyness cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 14 }}>
              {[
                { title: "Today (Jun 8)", index: 88,  busy: getBusyness(88),  sub: "Sunday — quieter day" },
                { title: "Tomorrow (Jun 9)", index: 126, busy: getBusyness(126), sub: "Monday — high expected" },
                { title: "This week peak", index: 132, busy: getBusyness(132), sub: "Fri Jun 13 — busiest day" },
              ].map((c) => (
                <div key={c.title} style={{
                  background: C.surfaceWhite, border: `0.5px solid ${C.borderLight}`,
                  borderTop: `3px solid ${c.busy.bar}`, borderRadius: 12, padding: "16px 18px",
                }}>
                  <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>{c.title}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: C.textPrimary, marginBottom: 3 }}>{c.busy.label}</div>
                  <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 12 }}>{c.sub}</div>
                  <div style={{ height: 6, background: C.teaGreen, borderRadius: 3, overflow: "hidden", marginBottom: 5 }}>
                    <div style={{ height: "100%", width: `${c.busy.pct}%`, background: c.busy.bar, borderRadius: 3 }} />
                  </div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>Index {c.index} · baseline 100</div>
                </div>
              ))}
            </div>

            {/* Daily chart with CI band */}
            <Panel>
              <SectionTitle
                title="Daily client demand — actual + 7-day forecast"
                sub="Demand index (100 = avg day) · shaded = 90% confidence interval · outbound = real client visits"
              />
              <ResponsiveContainer width="100%" height={230}>
                <ComposedChart data={dailyData} margin={{ top: 4, right: 16, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.jungleTeal} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={C.jungleTeal} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.teaGreen} />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: C.textMuted }} axisLine={false} tickLine={false} />
                  <YAxis domain={[70, 155]} tick={{ fontSize: 11, fill: C.textMuted }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <ReferenceLine y={100} stroke={C.wheat} strokeDasharray="4 2" label={{ value: "avg", position: "insideTopLeft", fontSize: 10, fill: C.textMuted }} />
                  <ReferenceLine y={120} stroke="#e8a090" strokeDasharray="3 3" label={{ value: "busy", position: "insideTopLeft", fontSize: 10, fill: "#c0622a" }} />
                  {/* CI band */}
                  <Area type="monotone" dataKey="upper" name="CI band" stroke="none" fill="#ddeaf8" fillOpacity={0.5} legendType="none" connectNulls />
                  <Area type="monotone" dataKey="lower" name="CI band" stroke="none" fill={C.surfaceWhite} fillOpacity={1} legendType="none" connectNulls />
                  {/* Lines */}
                  <Line type="monotone" dataKey="actual"   name="Actual (client visits)"  stroke={C.jungleTeal} strokeWidth={2.5} dot={{ r: 3.5 }} connectNulls={false} />
                  <Line type="monotone" dataKey="forecast" name="Forecast"                stroke={C.dustyDenim} strokeWidth={2}   dot={{ r: 3 }} strokeDasharray="5 3" connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", gap: 18, marginTop: 10 }}>
                {[
                  { color: C.jungleTeal, label: "Actual client visits" },
                  { color: C.dustyDenim, label: "Forecast"             },
                  { color: "#ddeaf8",    label: "90% CI",  square: true },
                ].map(({ color, label, square }) => (
                  <span key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.textMuted }}>
                    <span style={{ width: 10, height: square ? 10 : 3, background: color, display: "inline-block", borderRadius: square ? 2 : 2, border: square ? `1px solid ${C.borderLight}` : "none" }} />
                    {label}
                  </span>
                ))}
              </div>
            </Panel>

            {/* Day-of-week pattern */}
            <Panel>
              <SectionTitle
                title="Day-of-week demand pattern"
                sub="Average demand index by weekday — based on historical regional data"
              />
              <ResponsiveContainer width="100%" height={160}>
                <BarChart
                  data={[
                    { day: "Mon", index: 118 },
                    { day: "Tue", index: 108 },
                    { day: "Wed", index: 102 },
                    { day: "Thu", index: 112 },
                    { day: "Fri", index: 128 },
                    { day: "Sat", index: 96  },
                    { day: "Sun", index: 82  },
                  ]}
                  margin={{ top: 4, right: 16, bottom: 0, left: -20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={C.teaGreen} vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: C.textMuted }} axisLine={false} tickLine={false} />
                  <YAxis domain={[70, 140]} tick={{ fontSize: 11, fill: C.textMuted }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <ReferenceLine y={100} stroke={C.wheat} strokeDasharray="4 2" />
                  <Bar dataKey="index" name="Avg demand index" radius={[4, 4, 0, 0]} barSize={28}
                    fill={C.jungleTeal}
                    label={{ position: "top", fontSize: 10, fill: C.textMuted }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Panel>
          </div>
        )}

        {/* ── WEEKLY TAB ── */}
        {activeTab === "weekly" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Weekly stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 14 }}>
              {[
                { label: "This week forecast", value: thisWeekBusy.label, sub: "Jun 9–14",   accent: thisWeekBusy.bar, badgeBg: "#fdecea", badgeColor: "#8b2e1a", badge: "Index 124" },
                { label: "Next week forecast",  value: nextWeekBusy.label, sub: "Jun 16–21",  accent: "#d07030",        badgeBg: "#fdf0e0", badgeColor: "#7a4010", badge: "Index 119" },
                { label: "4-week trend",        value: "+18%",             sub: "vs 4 wks ago", accent: C.dustyDenim,   badgeBg: "#ddeaf8", badgeColor: "#2d5a9e", badge: "Rising"   },
                { label: "Prov. alert status",  value: "Flagged",          sub: "quota review",  accent: "#c0622a",     badgeBg: "#fdecea", badgeColor: "#8b2e1a", badge: "Action needed" },
              ].map((s) => (
                <div key={s.label} style={{
                  background: C.surfaceWhite, border: `0.5px solid ${C.borderLight}`,
                  borderTop: `3px solid ${s.accent}`, borderRadius: 12, padding: "14px 16px",
                }}>
                  <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: C.textPrimary, marginBottom: 3 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8 }}>{s.sub}</div>
                  <Badge bg={s.badgeBg} color={s.badgeColor}>{s.badge}</Badge>
                </div>
              ))}
            </div>

            {/* Weekly trend chart */}
            <Panel>
              <SectionTitle
                title="Weekly client demand — 6-week history + 4-week forecast"
                sub="Demand index · actual weeks solid · forecast weeks dashed · 100 = weekly average"
              />
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={weeklyData} margin={{ top: 4, right: 16, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="weekGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.jungleTeal} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={C.jungleTeal} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.teaGreen} />
                  <XAxis dataKey="week" tick={{ fontSize: 10, fill: C.textMuted }} axisLine={false} tickLine={false} />
                  <YAxis domain={[85, 135]} tick={{ fontSize: 11, fill: C.textMuted }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <ReferenceLine y={100} stroke={C.wheat} strokeDasharray="4 2" label={{ value: "baseline", position: "insideTopLeft", fontSize: 10, fill: C.textMuted }} />
                  <Area type="monotone" dataKey="actual"   name="Actual (weekly)"   stroke={C.jungleTeal} strokeWidth={2.5} fill="url(#weekGrad)" dot={{ r: 4, fill: C.jungleTeal }} connectNulls={false} />
                  <Line type="monotone" dataKey="forecast" name="Forecast (weekly)"  stroke={C.dustyDenim} strokeWidth={2}   dot={{ r: 3.5, fill: C.dustyDenim }} strokeDasharray="6 4" connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", gap: 18, marginTop: 10 }}>
                {[
                  { color: C.jungleTeal, label: "Actual (weekly)"   },
                  { color: C.dustyDenim, label: "Forecast (weekly)" },
                ].map(({ color, label }) => (
                  <span key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.textMuted }}>
                    <span style={{ width: 10, height: 3, background: color, display: "inline-block", borderRadius: 2 }} />
                    {label}
                  </span>
                ))}
              </div>
            </Panel>

            {/* Provincial connection detail */}
            <Panel>
              <SectionTitle title="Provincial ↔ Regional connection" sub="How this model's output feeds back to provincial allocation" />
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { step: "1", label: "Regional model runs daily", detail: "Client demand forecasted 7 days ahead (daily) and 4 weeks ahead (weekly)", color: C.jungleTeal },
                  { step: "2", label: "Threshold check", detail: "If weekly forecast exceeds +15% above baseline → provincial flag triggered automatically", color: C.dustyDenim },
                  { step: "3", label: "Provincial model notified", detail: "Edmonton's quota weight adjusted in provincial allocation model for next shipment cycle", color: C.lightGold },
                  { step: "4", label: "Staff review & confirm", detail: "Staff in Provincial → Allocation tab review the recommended adjustment before confirming", color: C.wheat },
                ].map((s) => (
                  <div key={s.step} style={{
                    display: "flex", gap: 14, alignItems: "flex-start",
                    padding: "12px 14px", borderRadius: 9,
                    background: C.surfaceGreen, border: `0.5px solid ${C.borderLight}`,
                  }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                      background: s.color, display: "flex", alignItems: "center",
                      justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff",
                    }}>{s.step}</div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.textPrimary, marginBottom: 2 }}>{s.label}</div>
                      <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.5 }}>{s.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        )}

        {/* ── MODEL DETAIL TAB ── */}
        {activeTab === "model" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 14 }}>
              {modelStats.map((s) => (
                <div key={s.label} style={{
                  background: C.surfaceWhite, border: `0.5px solid ${C.borderLight}`,
                  borderRadius: 12, padding: "14px 16px",
                }}>
                  <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary, lineHeight: 1.3 }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Feature importance */}
            <Panel>
              <SectionTitle
                title="Feature importance — regional model (XGBoost)"
                sub="Variables driving client-level demand prediction · differs from provincial model"
              />
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={featureData} layout="vertical" margin={{ top: 4, right: 50, bottom: 0, left: 110 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.teaGreen} horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: C.textMuted }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: C.textSecondary }} axisLine={false} tickLine={false} width={110} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="importance" name="Importance %" fill={C.dustyDenim} radius={[0, 4, 4, 0]} barSize={14}
                    label={{ position: "right", fontSize: 11, fill: C.textMuted, formatter: v => `${v}%` }}
                  />
                </BarChart>
              </ResponsiveContainer>
              <div style={{
                marginTop: 14, padding: "10px 14px",
                background: C.surfaceGreen, borderRadius: 8, border: `0.5px solid ${C.borderLight}`,
                fontSize: 12, color: C.textSecondary, lineHeight: 1.6,
              }}>
                <strong style={{ color: C.textPrimary }}>Note:</strong> Regional model uses dusty denim bars to distinguish from the provincial model's
                teal bars. AISH caseload and CCB dates carry higher relative importance here because
                they directly predict individual client visit timing at the regional level.
              </div>
            </Panel>

            {/* Actual vs predicted */}
            <Panel>
              <SectionTitle
                title="Actual vs predicted — regional model accuracy (weekly, Apr–Jun 2026)"
                sub="Closer lines = better fit · gap = prediction error · synthetic data reflecting realistic patterns"
              />
              <ResponsiveContainer width="100%" height={190}>
                <LineChart
                  data={[
                    { week: "Apr 28", actual: 96,  predicted: 98  },
                    { week: "May 5",  actual: 99,  predicted: 101 },
                    { week: "May 12", actual: 103, predicted: 102 },
                    { week: "May 19", actual: 108, predicted: 106 },
                    { week: "May 26", actual: 112, predicted: 114 },
                    { week: "Jun 2",  actual: 118, predicted: 116 },
                  ]}
                  margin={{ top: 4, right: 16, bottom: 0, left: -20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={C.teaGreen} />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: C.textMuted }} axisLine={false} tickLine={false} />
                  <YAxis domain={[88, 128]} tick={{ fontSize: 11, fill: C.textMuted }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="actual"    name="Actual"    stroke={C.jungleTeal} strokeWidth={2.5} dot={{ r: 3.5 }} />
                  <Line type="monotone" dataKey="predicted" name="Predicted" stroke={C.dustyDenim} strokeWidth={2}   dot={{ r: 3 }} strokeDasharray="5 3" />
                </LineChart>
              </ResponsiveContainer>
            </Panel>
          </div>
        )}

        {/* ── DATA INPUT TAB ── */}
        {activeTab === "input" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <DataInputForm />
            <RecentEntries />
          </div>
        )}

      </div>
    </div>
  );
}
