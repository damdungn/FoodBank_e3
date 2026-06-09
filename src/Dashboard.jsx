import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
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

// ── Mock data — synthetic, reflects realistic seasonal patterns ───────────────
const trendData = [
  { month: "Jan", inbound: 98,  outbound: 95  },
  { month: "Feb", inbound: 104, outbound: 100 },
  { month: "Mar", inbound: 101, outbound: 103 },
  { month: "Apr", inbound: 107, outbound: 108 },
  { month: "May", inbound: 112, outbound: 110 },
  { month: "Jun", inbound: null, outbound: null, forecastIn: 116, forecastOut: 124 },
  { month: "Jul", forecastIn: 118, forecastOut: 126 },
  { month: "Aug", forecastIn: 114, forecastOut: 118 },
];

const weekBands = [
  { label: "Week 1–2", value: "+14% above avg", bg: "#fdecea", color: "#8b2e1a"       },
  { label: "Week 3",   value: "+8% above avg",  bg: "#fdf6d8", color: "#7a6010"       },
  { label: "Week 4",   value: "Near baseline",  bg: C.surfaceGreen, color: C.textSecondary },
];

const signals = [
  { name: "CPI food index elevated", level: "High",   bg: "#fdecea",      color: "#8b2e1a"       },
  { name: "Unemployment rising",     level: "High",   bg: "#fdecea",      color: "#8b2e1a"       },
  { name: "AISH disbursement week",  level: "Medium", bg: "#fdf6d8",      color: "#7a6010"       },
  { name: "No stat holidays",        level: "Low",    bg: C.surfaceGreen, color: C.textSecondary },
  { name: "Mild weather forecast",   level: "Low",    bg: C.surfaceGreen, color: C.textSecondary },
];

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
      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 7, display: "flex", alignItems: "center", gap: 5 }}>
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
          <span style={{ fontWeight: 600 }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.pageBg, overflow: "hidden" }}>

      {/* Header */}
      <header style={{ padding: "32px 28px 24px", background: C.pageBg, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.forestGreen, marginBottom: 5 }}>
              Dashboard overview
            </div>
            <div style={{ fontSize: 13, color: C.textMuted, maxWidth: 560, lineHeight: 1.6 }}>
              Visualizations reflect synthetic data modelled on realistic food bank demand and
              supply patterns. Intended for awareness and planning — not raw operational data.
            </div>
          </div>
          {/* Demand alert pill */}
          <div style={{
            display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
            background: "#fdecea", color: "#8b2e1a",
            fontSize: 12, fontWeight: 500,
            padding: "7px 13px", borderRadius: 8,
            border: "0.5px solid #e8a090", marginTop: 4,
          }}>
            <i className="ti ti-alert-triangle" style={{ fontSize: 13 }} aria-hidden="true" />
            High demand forecast — June 2026
          </div>
        </div>
      </header>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 28px 36px" }}>

        {/* KPI row — 3 cards, simple and clear */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 14, marginBottom: 24 }}>
          <KpiCard
            icon="arrow-up-right" label="Donation trend" value="+12%"
            badge="↑ vs last month" badgeBg={C.teaGreen} badgeColor={C.forestGreen}
            accent={C.jungleTeal}
          />
          <KpiCard
            icon="antenna" label="Demand signal" value="Elevated"
            badge="next 30 days" badgeBg="#fdecea" badgeColor="#8b2e1a"
            accent="#c0622a" valueSize={16}
          />
          <KpiCard
            icon="chart-bar" label="Forecast confidence" value="84%"
            badge="model accuracy" badgeBg="#ddeaf8" badgeColor="#2d5a9e"
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
            <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, marginBottom: 3 }}>
              Supply &amp; demand trend
            </div>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 16 }}>
              Indexed to baseline (100 = monthly avg) · Jan–May actual, Jun–Aug forecast · no raw volumes shown
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trendData} margin={{ top: 4, right: 12, bottom: 0, left: -20 }}>
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
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: C.textMuted }} axisLine={false} tickLine={false} />
                <YAxis domain={[85, 135]} tick={{ fontSize: 11, fill: C.textMuted }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <ReferenceLine y={100} stroke={C.wheat} strokeDasharray="4 2" />
                {/* Actuals */}
                <Area type="monotone" dataKey="inbound"     name="Donations (actual)"  stroke={C.jungleTeal} strokeWidth={2.5} fill="url(#inGrad)"  dot={{ r: 3 }} connectNulls={false} />
                <Area type="monotone" dataKey="outbound"    name="Demand (actual)"     stroke={C.wheat}      strokeWidth={2.5} fill="url(#outGrad)" dot={{ r: 3 }} strokeDasharray="5 3" connectNulls={false} />
                {/* Forecasts */}
                <Area type="monotone" dataKey="forecastIn"  name="Donations (forecast)" stroke={C.jungleTeal} strokeWidth={1.5} fill="none" dot={{ r: 2.5 }} strokeDasharray="6 4" connectNulls />
                <Area type="monotone" dataKey="forecastOut" name="Demand (forecast)"    stroke={C.wheat}      strokeWidth={1.5} fill="none" dot={{ r: 2.5 }} strokeDasharray="6 4" connectNulls />
              </AreaChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 10 }}>
              {[
                { color: C.jungleTeal, label: "Donations (actual)"   },
                { color: C.wheat,      label: "Demand (actual)"      },
                { color: C.dustyDenim, label: "Forecast (both lines)" },
              ].map(({ color, label }) => (
                <span key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.textMuted }}>
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
            <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, marginBottom: 3 }}>
              Demand signals
            </div>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 14 }}>
              Key factors driving this month's forecast
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {signals.map((s) => (
                <div key={s.name} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "9px 11px", borderRadius: 8,
                  background: C.surfaceGreen, border: `0.5px solid ${C.borderLight}`,
                }}>
                  <span style={{ fontSize: 12, color: C.textPrimary }}>{s.name}</span>
                  <Badge bg={s.bg} color={s.color}>{s.level}</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom row: week forecast bands + AI insight */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.2fr)", gap: 16 }}>

          {/* 30-day bands */}
          <div style={{
            background: C.surfaceWhite, border: `0.5px solid ${C.borderLight}`,
            borderRadius: 12, padding: 20,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, marginBottom: 3 }}>
              30-day demand outlook
            </div>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 16 }}>
              Weekly demand forecast for June 2026
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {weekBands.map((w) => (
                <div key={w.label} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: w.bg, border: `0.5px solid ${C.borderLight}`,
                  borderRadius: 9, padding: "12px 16px",
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: w.color, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {w.label}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: w.color }}>{w.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* AI insight */}
          <div style={{
            background: C.forestGreen, borderRadius: 12, padding: 22,
            display: "flex", flexDirection: "column",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
              <svg width="15" height="15" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <circle cx="7" cy="7" r="6" stroke={C.teaGreen} strokeWidth="1.3"/>
                <path d="M7 5v4M7 4v.5" stroke={C.teaGreen} strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              <span style={{ fontSize: 10, fontWeight: 700, color: C.teaGreen, textTransform: "uppercase", letterSpacing: "0.09em" }}>
                AI insight — June 2026
              </span>
            </div>
            <p style={{ fontSize: 13, color: "#d8edd0", lineHeight: 1.8, margin: 0, flex: 1 }}>
              Elevated food CPI and rising unemployment are the primary drivers of above-average
              demand this month. The AISH disbursement on June 3rd is expected to briefly reduce
              walk-ins mid-week. Donation inflows remain positive but may not fully offset
              projected demand — the supply-demand gap warrants attention in the first two weeks.
            </p>
            <div style={{
              marginTop: 16, paddingTop: 14,
              borderTop: "0.5px solid rgba(255,255,255,0.12)",
              fontSize: 11, color: "rgba(208,239,177,0.6)",
            }}>
              Based on XGBoost + Prophet model · synthetic trend data · not operational figures
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
