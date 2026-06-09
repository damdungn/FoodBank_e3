import { useState, useEffect } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
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
  Low:    { bg: "#f2f9ec", color: "#4a6355" },
};

// ── Components ────────────────────────────────────────────────────────────────

function Badge({ children, bg, color }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 9px",
      borderRadius: 20, fontSize: 11, fontWeight: 500,
      background: bg, color,
    }}>
      {children}
    </span>
  );
}

function KpiCard({ icon, label, value, badge, badgeBg, badgeColor, valueSize = 22, accent }) {
  return (
    <div style={{
      background: C.surfaceWhite,
      border: `0.5px solid ${C.borderLight}`,
      borderTop: `3px solid ${accent || C.jungleTeal}`,
      borderRadius: 12, padding: "16px 16px 14px",
    }}>
      <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 7, display: "flex", alignItems: "center", gap: 5 }}>
        <i className={`ti ti-${icon}`} style={{ fontSize: 13 }} aria-hidden="true" />
        {label}
      </div>
      <div style={{ fontSize: valueSize, fontWeight: 600, lineHeight: 1, marginBottom: 8, color: C.textPrimary }}>
        {value}
      </div>
      <Badge bg={badgeBg} color={badgeColor}>{badge}</Badge>
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
      {payload.map((p) => p.value != null && (
        <div key={p.name} style={{ display: "flex", justifyContent: "space-between", gap: 16, opacity: 0.9 }}>
          <span>{p.name}</span>
          <span style={{ fontWeight: 600 }}>{(p.value / 1000).toFixed(1)}K lbs</span>
        </div>
      ))}
    </div>
  );
};

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [trendData, setTrendData]     = useState([]);
  const [signals, setSignals]         = useState([]);
  const [kpis, setKpis]               = useState(null);
  const [confidence, setConfidence]   = useState(null);
  const [gapForecast, setGapForecast] = useState([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard").then(r => r.json()),
      fetch("/api/signals").then(r => r.json()),
      fetch("/api/model_summary").then(r => r.json()),
      fetch("/api/gap").then(r => r.json()),
    ])
      .then(([dash, sigs, summary, gap]) => {
        setTrendData(dash.trendData ?? []);
        setKpis(dash.kpis ?? null);
        setSignals(sigs.signals ?? []);
        setConfidence(summary);
        setGapForecast(gap.forecastGap ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Derive demand signal from highest level present
  const topLevel = signals.find(s => s.level === "High") ? "High"
    : signals.find(s => s.level === "Medium") ? "Medium"
    : "Low";
  const demandLabel = { High: "Elevated", Medium: "Moderate", Low: "Stable" }[topLevel];
  const demandStyle = LEVEL_STYLE[topLevel];

  // Header alert pill — show only for Warning / Critical
  const topAlert   = gapForecast[0]?.alert;
  const alertMonth = gapForecast[0]?.month ?? "";
  const showAlert  = topAlert === "Critical" || topAlert === "Warning";
  const alertBg    = topAlert === "Critical" ? "#fdecea" : "#fdf6d8";
  const alertColor = topAlert === "Critical" ? "#8b2e1a" : "#7a6010";
  const alertBorder= topAlert === "Critical" ? "#e8a090" : "#d4c060";

  const pctIn = kpis?.pctChange?.inbound ?? 0;

  // Limit chart to last 15 actuals + 3 forecast for readability
  const displayTrend = trendData.length > 18 ? trendData.slice(-18) : trendData;

  // Dynamic insight text
  const insightText = (() => {
    if (!confidence) return "Loading forecast data…";
    const parts = [
      `The Holt-Winters + XGBoost model forecasts the next 3 months with ${confidence.confidence_pct}% confidence (${confidence.confidence_label}).`,
    ];
    if (topAlert === "Critical") {
      parts.push(`A critical supply shortfall is forecast for ${alertMonth} — donations may fall well below distribution needs.`);
    } else if (topAlert === "Warning") {
      parts.push(`A demand warning is forecast for ${alertMonth} — supply may not comfortably cover distribution needs.`);
    } else if (topAlert === "Watch") {
      parts.push(`A supply-demand gap is narrowing — monitor closely.`);
    } else {
      parts.push(`Supply and demand appear balanced across the 3-month forecast.`);
    }
    const highSigs = signals.filter(s => s.level === "High").map(s => s.name);
    if (highSigs.length) {
      parts.push(`High-impact signals active: ${highSigs.join(", ")}.`);
    }
    return parts.join(" ");
  })();

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.pageBg, overflow: "hidden", maxWidth: "100%" }}>

      {/* Header */}
      <header style={{ padding: "32px 28px 24px", background: C.pageBg, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 25, fontWeight: 700, color: C.forestGreen, marginBottom: 15 }}>
              Dashboard overview
            </div>
            <div style={{ fontSize: 14, color: C.textMuted, maxWidth: 560, lineHeight: 1.6, marginTop: 10, textAlign: "left" }}>
              Monthly inbound donations and outbound distributions — last 15 months actual with 3-month model forecast.
            </div>
          </div>
          {showAlert && (
            <div style={{
              display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
              background: alertBg, color: alertColor, fontSize: 12, fontWeight: 500,
              padding: "7px 13px", borderRadius: 7,
              border: `0.5px solid ${alertBorder}`, marginTop: 4, marginRight: 70,
            }}>
              <i className="ti ti-alert-triangle" style={{ fontSize: 13 }} aria-hidden="true" />
              {topAlert} demand forecast — {alertMonth}
            </div>
          )}
        </div>
      </header>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 28px 36px" }}>

        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: C.textMuted, fontSize: 13 }}>
            Loading model data…
          </div>
        ) : (
          <>
            {/* KPI row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 14, marginBottom: 24 }}>
              <KpiCard
                icon="arrow-up-right" label="Donation trend"
                value={kpis ? `${pctIn >= 0 ? "+" : ""}${pctIn}%` : "—"}
                badge={kpis ? `${pctIn >= 0 ? "↑" : "↓"} vs last month` : "loading…"}
                badgeBg={C.teaGreen} badgeColor={C.forestGreen}
                accent={C.jungleTeal}
              />
              <KpiCard
                icon="antenna" label="Demand signal" value={demandLabel}
                badge="next 30 days"
                badgeBg={demandStyle.bg} badgeColor={demandStyle.color}
                accent="#c0622a" valueSize={16}
              />
              <KpiCard
                icon="chart-bar" label="Forecast confidence"
                value={confidence ? `${confidence.confidence_pct}%` : "—"}
                badge={confidence?.confidence_label ?? "model accuracy"}
                badgeBg="#ddeaf8" badgeColor="#2d5a9e"
                accent={C.dustyDenim}
              />
            </div>

            {/* Main chart + signals side by side */}
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.7fr) minmax(0,1fr)", gap: 16, marginBottom: 16 }}>

              {/* Trend chart */}
              <div style={{
                background: C.surfaceWhite, border: `0.5px solid ${C.borderLight}`,
                borderRadius: 12, padding: 20,
              }}>
                <div style={{ fontSize: 18, fontWeight: 600, color: C.textPrimary, marginBottom: 3 }}>
                  Supply &amp; demand trend
                </div>
                <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 16 }}>
                  Monthly lbs totals · last 15 months actual + 3-month forecast (dashed)
                </div>
                <ResponsiveContainer width="100%" height={230}>
                  <AreaChart data={displayTrend} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="inGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={C.jungleTeal} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={C.jungleTeal} stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="outGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={C.wheat} stopOpacity={0.18} />
                        <stop offset="95%" stopColor={C.wheat} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.teaGreen} />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 10, fill: C.textMuted }}
                      axisLine={false} tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      domain={["auto", "auto"]}
                      tickFormatter={v => `${(v / 1000).toFixed(0)}K`}
                      tick={{ fontSize: 11, fill: C.textMuted }}
                      axisLine={false} tickLine={false} width={45}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    {/* Actuals */}
                    <Area type="monotone" dataKey="inbound"     name="Donations (actual)"   stroke={C.jungleTeal} strokeWidth={2.5} fill="url(#inGrad)"  dot={false} connectNulls={false} />
                    <Area type="monotone" dataKey="outbound"    name="Demand (actual)"      stroke={C.wheat}      strokeWidth={2.5} fill="url(#outGrad)" dot={false} connectNulls={false} />
                    {/* Forecasts */}
                    <Area type="monotone" dataKey="forecastIn"  name="Donations (forecast)" stroke="#8b2e1a" strokeWidth={2.5} fill="none" dot={{ r: 2.5 }} strokeDasharray="6 4" connectNulls />
                    <Area type="monotone" dataKey="forecastOut" name="Demand (forecast)"    stroke="#2d5a9e" strokeWidth={2.5} fill="none" dot={{ r: 2.5 }} strokeDasharray="6 4" connectNulls />
                  </AreaChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 10 }}>
                  {[
                    { color: C.jungleTeal, label: "Donations (actual)"   },
                    { color: C.wheat,      label: "Demand (actual)"      },
                    { color: "#8b2e1a",    label: "Donations (forecast)" },
                    { color: "#2d5a9e",    label: "Demand (forecast)"    },
                  ].map(({ color, label }) => (
                    <span key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.textMuted }}>
                      <span style={{ width: 10, height: 3, background: color, display: "inline-block", borderRadius: 2 }} />
                      {label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Demand signals */}
              <div style={{
                background: C.surfaceWhite, border: `0.5px solid ${C.borderLight}`,
                borderRadius: 12, padding: 20,
              }}>
                <div style={{ fontSize: 18, fontWeight: 600, color: C.textPrimary, marginBottom: 3 }}>
                  Demand signals
                </div>
                <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 14 }}>
                  Key factors driving this month's forecast
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {signals.length === 0 ? (
                    <div style={{ fontSize: 13, color: C.textMuted, textAlign: "center", padding: "20px 0" }}>
                      No active demand signals
                    </div>
                  ) : signals.map((s) => {
                    const sty = LEVEL_STYLE[s.level] ?? LEVEL_STYLE.Low;
                    return (
                      <div key={s.name} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "9px 11px", borderRadius: 8,
                        background: C.surfaceGreen, border: `0.5px solid ${C.borderLight}`,
                      }}>
                        <span style={{ fontSize: 13, color: C.textPrimary }}>{s.name}</span>
                        <Badge bg={sty.bg} color={sty.color}>{s.level}</Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* AI insight panel */}
            <div style={{ display: "flex", gap: 16 }}>
              <div style={{
                background: "#e2ffcfb3", borderRadius: 12, padding: 22,
                display: "flex", flexDirection: "column", flex: 1,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
                  <svg width="15" height="15" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <circle cx="7" cy="7" r="6" stroke={C.forestGreen} strokeWidth="1.3" />
                    <path d="M7 5v4M7 4v.5" stroke={C.forestGreen} strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                  <span style={{ fontSize: 15, fontWeight: 1000, color: C.forestGreen, textTransform: "uppercase", letterSpacing: "0.09em" }}>
                    Insight based on current forecast data and demand signals
                  </span>
                </div>
                <p style={{ fontSize: 14, color: "#294d1b", lineHeight: 1.8, margin: 1, flex: 1, fontWeight: 400, textAlign: "justify", paddingRight: 10 }}>
                  {insightText}
                </p>
                <div style={{
                  marginTop: 14, paddingTop: 14,
                  borderTop: "0.5px solid rgba(255,255,255,0.12)",
                  fontSize: 14, color: "rgba(43, 67, 18, 0.6)",
                }}>
                  Based on Holt-Winters + XGBoost hybrid model · monthly aggregates · 80% prediction intervals
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
