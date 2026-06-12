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
  surfaceGreenBold: "#e3f6d2",
  borderLight:  "#dde8d8",
  textPrimary:  "#1a2e22",
  textSecondary:"#4a6355",
  textMuted:    "#556b5f",
};

const weeklyData = [
  { week: "May 5",  index: 98  },
  { week: "May 12", index: 102 },
  { week: "May 19", index: 107 },
  { week: "May 26", index: 111 },
  { week: "Jun 2",  index: 118 },
  { week: "Jun 9",  index: 124, forecast: true },
  { week: "Jun 16", index: 119, forecast: true },
  { week: "Jun 23", index: 112, forecast: true },
  { week: "Jun 30", index: 104, forecast: true },
];

// ── Busyness config ───────────────────────────────────────────────────────────
function getBusyness(index) {
  if (index >= 125) return { label: "Very busy", color: "#6b1f12", bg: "#fde0db", bar: "#a84a1e", pct: 95 };
  if (index >= 110) return { label: "Busy",      color: "#5a360b", bg: "#fce7cf", bar: "#b85c1f", pct: 75 };
  if (index >= 95)  return { label: "Moderate",  color: "#5a4a0b", bg: "#fbf0c2", bar: "#d0a400", pct: 55 };
  return              { label: "Quiet",          color: "#1f5a3a", bg: "#dff3e6", bar: "#1f7a4a", pct: 30 };
}

const todayIndex  = 124;   // this week forecast
const nextIndex   = 119;   // next week forecast
const todayBusy   = getBusyness(todayIndex);
const nextBusy    = getBusyness(nextIndex);

const tips = [
  { icon: "clock",         text: "Mid-week mornings (Tue–Wed) tend to be quieter — consider visiting then." },
  { icon: "calendar-week", text: "AISH payment week (Jun 3) typically sees a brief mid-week dip in visits." },
  { icon: "alert-triangle",text: "Fridays are usually among the busiest days of the week." },
  { icon: "info-circle",   text: "Demand is expected to ease slightly in the final week of June." },
];

// ── Tooltip ───────────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;
  const busy = val ? getBusyness(val) : null;
  return (
    <div style={{
      background: C.surfaceGreen, border: `1px solid ${C.teaGreen}`,
      borderRadius: 8, padding: "8px 13px", fontSize: 12, color: "#224433",
    }}>
      <div style={{ fontWeight: 600, color: C.forestGreen, marginBottom: 4 }}>{label}</div>
      {busy && (
        <>
          <div style={{ opacity: 1 }}>Demand index: <strong>{val}</strong></div>
          <div style={{ marginTop: 3, color: busy.bar, opacity: 1 }}>{busy.label}</div>
        </>
      )}
    </div>
  );
};

// ── Busyness gauge bar ────────────────────────────────────────────────────────
function BusynessCard({ title, sub, busy, index }) {
  return (
    <div style={{
      background: C.surfaceWhite, border: `0.5px solid ${C.borderLight}`,
      borderTop: `3px solid ${busy.bar}`,
      borderRadius: 12, padding: "18px 20px",
      flex: 1,
    }}>
      <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: C.textPrimary, marginBottom: 2 }}>
        {busy.label}
      </div>
      <div style={{ fontSize: 15, color: C.textSecondary, marginBottom: 14 }}>{sub}</div>

      {/* Gauge bar */}
      <div style={{ height: 8, background: C.teaGreen, borderRadius: 4, overflow: "hidden", marginBottom: 6 }}>
        <div style={{
          height: "100%", width: `${busy.pct}%`,
          background: busy.bar, borderRadius: 4,
          transition: "width 0.6s ease",
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.textMuted }}>
        <span>Quiet</span><span>Moderate</span><span>Very busy</span>
      </div>

      {/* Badge */}
      <div style={{ marginTop: 12 }}>
        <span style={{
          display: "inline-block", padding: "3px 10px",
          borderRadius: 20, fontSize: 13, fontWeight: 600,
          background: busy.bg, color: busy.color,
        }}>
          Demand index {index} · baseline 100
        </span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ClientOutlook() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.pageBg, overflow: "hidden", maxWidth: "100%" }}>

      {/* Header */}
      <header style={{ padding: "32px 28px 20px", background: C.pageBg, flexShrink: 0 }}>
        <div style={{ fontSize: 25, fontWeight: 700, color: C.forestGreen, marginBottom: 4 }}>
          Client outlook (coming soon)
        </div>
        <div style={{ fontSize: 15, color: C.textMuted }}>
          How busy is the food bank this week? Updated daily · indexed demand, no personal data shown
        </div>
      </header>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 28px 32px" }}>

        {/* Busyness cards */}
        <div style={{ display: "flex", gap: 14, marginBottom: 24 }}>
          <BusynessCard
            title="This week (Jun 9–14)"
            sub="Based on current forecast model"
            busy={todayBusy}
            index={todayIndex}
          />
          <BusynessCard
            title="Next week (Jun 16–21)"
            sub="7-day ahead forecast · wider uncertainty"
            busy={nextBusy}
            index={nextIndex}
          />

          {/* Plain language summary card */}
          <div style={{
            background: C.surfaceGreenBold, borderRadius: 12, border: `0.5px solid ${C.borderLight}`,
            padding: "18px 20px", flex: 1,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
              <i className="ti ti-bulb" style={{ fontSize: 15, color: C.forestGreen }} aria-hidden="true" />
              <span style={{ fontSize: 18, fontWeight: 1000, color: C.textSecondary, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                What this means for you
              </span>
            </div>
            <p style={{ fontSize: 15, color: C.textSecondary, lineHeight: 1.75, margin: 0 }}>
              The food bank is expected to be <strong style={{ color: C.forestGreen }}>busier than usual</strong> this
              week due to elevated food prices and rising demand. If possible, visiting
              mid-week or early morning may mean shorter wait times.
            </p>
          </div>
        </div>

        {/* Weekly trend */}
        <div style={{
          background: C.surfaceWhite, border: `0.5px solid ${C.borderLight}`,
          borderRadius: 12, padding: 24, marginBottom: 16,
        }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.textPrimary, marginBottom: 4 }}>Weekly demand trend</div>
          <div style={{ fontSize: 15, color: C.textMuted, marginBottom: 18 }}>
            Past 4 weeks + 4-week forecast · shaded = forecast period
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <AreaChart data={weeklyData} margin={{ top: 4, right: 12, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="weekGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.jungleTeal} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={C.jungleTeal} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.teaGreen} />
              <XAxis dataKey="week" tick={{ fontSize: 12, fill: C.textMuted }} axisLine={false} tickLine={false} />
              <YAxis domain={[88, 132]} tick={{ fontSize: 12, fill: C.textMuted }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={100} stroke={C.wheat} strokeDasharray="4 2" />
              <Area
                type="monotone" dataKey="index" name="Demand"
                stroke={C.jungleTeal} strokeWidth={2.5}
                fill="url(#weekGrad)"
                dot={(props) => {
                  const { cx, cy, payload } = props;
                  return (
                    <circle
                      key={payload.week}
                      cx={cx} cy={cy} r={4}
                      fill={payload.forecast ? C.dustyDenim : C.jungleTeal}
                      stroke="none"
                    />
                  );
                }}
                connectNulls
              />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: 18, marginTop: 12 }}>
            {[
              { color: C.jungleTeal, label: "Actual weeks"   },
              { color: C.dustyDenim, label: "Forecast weeks" },
            ].map(({ color, label }) => (
              <span key={label} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: C.textMuted }}>
                <span style={{ width: 10, height: 10, background: color, display: "inline-block", borderRadius: "50%" }} />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Visit tips */}
        <div style={{
          background: C.surfaceWhite, border: `0.5px solid ${C.borderLight}`,
          borderRadius: 12, padding: 24,
        }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.textPrimary, marginBottom: 4 }}>
            Planning your visit
          </div>
          <div style={{ fontSize: 15, color: C.textMuted, marginBottom: 20 }}>
            Tips based on this month's demand patterns
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {tips.map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: C.surfaceGreen, border: `0.5px solid ${C.borderLight}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <i className={`ti ti-${t.icon}`} style={{ fontSize: 16, color: C.jungleTeal }} aria-hidden="true" />
                </div>
                <div style={{ fontSize: 15, fontWeight: 500, color: C.textSecondary, lineHeight: 1.65, paddingTop: 6 }}>
                  {t.text}
                </div>
              </div>
            ))}
          </div>

          {/* Data note */}
          <div style={{
            marginTop: 24, padding: "12px 14px",
            background: C.surfaceGreen, borderRadius: 8,
            border: `0.5px solid ${C.borderLight}`,
          }}>
            <div style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.6 }}>
              <strong style={{ color: C.textSecondary }}>About this data</strong><br />
              Demand levels are model forecasts shown as indexed trends.
              No personal or operational data is disclosed.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
