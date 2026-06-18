import { useState, useEffect } from "react";
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

const C = {
  forestGreen:      "#224433",
  jungleTeal:       "#3f826d",
  teaGreen:         "#d0efb1",
  dustyDenim:       "#5588c7",
  pageBg:           "#fbfcf6",
  surfaceWhite:     "#ffffff",
  surfaceGreen:     "#f2f9ec",
  surfaceGreenBold: "#e3f6d2",
  borderLight:      "#dde8d8",
  textPrimary:      "#1a2e22",
  textSecondary:    "#4a6355",
  textMuted:        "#556b5f",
};

const BUSY_CFG = {
  quiet:    { label: "Quiet",    color: "#1f5a3a", bg: "#dff3e6", bar: C.jungleTeal, pct: 25 },
  moderate: { label: "Moderate", color: "#5a4a0b", bg: "#fbf0c2", bar: "#d0a400",    pct: 55 },
  busy:     { label: "Busy",     color: "#5a360b", bg: "#fce7cf", bar: "#b85c1f",    pct: 82 },
};

function classify(val, mean) {
  if (val >= mean * 1.10) return "busy";
  if (val <= mean * 0.89) return "quiet";
  return "moderate";
}

// ── Busyness gauge card ───────────────────────────────────────────────────────
function BusynessCard({ title, sub, level, visits }) {
  const cfg = BUSY_CFG[level] ?? BUSY_CFG.moderate;
  return (
    <div style={{
      background: C.surfaceWhite, border: `0.5px solid ${C.borderLight}`,
      borderTop: `3px solid ${cfg.bar}`, borderRadius: 12, padding: "18px 20px", flex: 1,
    }}>
      <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: C.textPrimary, marginBottom: 2 }}>{cfg.label}</div>
      <div style={{ fontSize: 14, color: C.textSecondary, marginBottom: 14 }}>{sub}</div>
      <div style={{ height: 8, background: C.teaGreen, borderRadius: 4, overflow: "hidden", marginBottom: 6 }}>
        <div style={{ height: "100%", width: `${cfg.pct}%`, background: cfg.bar, borderRadius: 4, transition: "width 0.6s ease" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.textMuted }}>
        <span>Quiet</span><span>Moderate</span><span>Busy</span>
      </div>
      {visits != null && (
        <div style={{ marginTop: 12 }}>
          <span style={{
            display: "inline-block", padding: "3px 10px", borderRadius: 20,
            fontSize: 13, fontWeight: 600, background: cfg.bg, color: cfg.color,
          }}>
            ~{Math.round(visits).toLocaleString()} visits forecast
          </span>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ClientOutlook() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [forecast, setForecast] = useState(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const BASE = import.meta.env.VITE_API_URL ?? "";
    setLoading(true);
    fetch(`${BASE}/api/campus/forecast`)
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
      .then(data => { setForecast(data); setLoading(false); });
  }, []);

  // ── Derived values ──────────────────────────────────────────────────────────
  const fcRows    = forecast?.forecast ?? [];
  const vals      = fcRows.map(r => r.forecast ?? 0);
  const mean      = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 1010;

  // Only show months from next month onwards (skip past/current month)
  // r.month is "YYYY-MM-DD" — compare as strings to avoid UTC timezone shift
  const now          = new Date();
  const nmMonth      = now.getMonth() + 2 > 12 ? 1 : now.getMonth() + 2;
  const nmYear       = now.getMonth() + 2 > 12 ? now.getFullYear() + 1 : now.getFullYear();
  const nextMonthISO = `${nmYear}-${String(nmMonth).padStart(2, "0")}-01`;

  const enriched = fcRows
    .map(r => {
      const val = r.forecast ?? 0;
      return { ...r, val, busyness: classify(val, mean) };
    })
    .filter(r => r.month >= nextMonthISO);

  const quietMonths = enriched.filter(r => r.busyness === "quiet");
  const busyMonths  = enriched.filter(r => r.busyness === "busy");
  const thisMonth   = enriched[0];
  const nextMonth   = enriched[1];
  const trendsObj   = forecast?.trends ?? {};
  const cvMape      = forecast?.accuracy?.cv_mape ?? 13.8;

  const whatItMeans = {
    busy:     "The food bank is expected to be busier than usual. If possible, visiting mid-month may mean shorter wait times.",
    moderate: "Demand is tracking close to the typical monthly level. No major spikes or dips are expected.",
    quiet:    "This is one of the quieter periods — a good time to visit if your schedule allows.",
  };

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: C.pageBg, overflow: "hidden",
    }}>

      {/* Header */}
      <header style={{ padding: isMobile ? "20px 16px 16px" : "32px 28px 20px", background: C.pageBg, flexShrink: 0 }}>
        <div style={{ fontSize: isMobile ? 20 : 25, fontWeight: 700, color: C.forestGreen, marginBottom: 4 }}>
          Student Outlook
        </div>
        <div style={{ fontSize: 14, color: C.textMuted }}>
          Campus Food Bank (U of A) · How busy is the food bank? · Based on 12-month visit forecast
        </div>
      </header>

      <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "0 16px 28px" : "0 28px 32px" }}>

        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: C.textMuted, fontSize: 13 }}>
            Loading forecast data…
          </div>
        ) : !forecast ? (
          <div style={{
            background: C.surfaceWhite, border: `0.5px solid ${C.borderLight}`,
            borderRadius: 12, padding: "40px 24px", textAlign: "center",
          }}>
            <i className="ti ti-database-off" style={{ fontSize: 28, color: C.textMuted, display: "block", marginBottom: 10 }} aria-hidden="true" />
            <div style={{ fontSize: 13, color: C.textMuted }}>
              Forecast unavailable — ensure the backend is running and{" "}
              <code style={{ background: C.surfaceGreen, padding: "1px 5px", borderRadius: 4 }}>cfb_forecast.json</code> is in{" "}
              <code style={{ background: C.surfaceGreen, padding: "1px 5px", borderRadius: 4 }}>backend/data/</code>.
            </div>
          </div>
        ) : (
          <>
            {/* This month / Next month busyness + plain-language card */}
            <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 14, marginBottom: 20 }}>
              {thisMonth && (
                <BusynessCard
                  title={`This month (${thisMonth.label})`}
                  sub="Based on 12-month forecast model"
                  level={thisMonth.busyness}
                  visits={thisMonth.val}
                />
              )}
              {nextMonth && (
                <BusynessCard
                  title={`Next month (${nextMonth.label})`}
                  sub="One month ahead · wider uncertainty"
                  level={nextMonth.busyness}
                  visits={nextMonth.val}
                />
              )}
              <div style={{
                background: C.surfaceGreenBold, borderRadius: 12,
                border: `0.5px solid ${C.borderLight}`,
                padding: "18px 20px", flex: 1,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                  <i className="ti ti-bulb" style={{ fontSize: 15, color: C.forestGreen }} aria-hidden="true" />
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.textSecondary, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                    What this means for you
                  </span>
                </div>
                <p style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.75, margin: 0 }}>
                  {whatItMeans[thisMonth?.busyness ?? "moderate"]}
                </p>
                {quietMonths.length > 0 && (
                  <p style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.75, margin: "10px 0 0" }}>
                    <strong style={{ color: C.forestGreen }}>Best upcoming months:</strong>{" "}
                    {quietMonths.map(r => r.label).join(", ")} — quieter than average.
                  </p>
                )}
              </div>
            </div>

            {/* Summary stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,minmax(0,1fr))", gap: 12, marginBottom: 20 }}>
              {[
                {
                  label: "Best time to visit",
                  value: quietMonths[0]?.label ?? "—",
                  sub: quietMonths[0] ? `~${Math.round(quietMonths[0].val).toLocaleString()} visits forecast` : "",
                  accent: C.jungleTeal, icon: "calendar-check",
                },
                {
                  label: "Busiest period ahead",
                  value: busyMonths[0]?.label ?? "—",
                  sub: busyMonths[0] ? `~${Math.round(busyMonths[0].val).toLocaleString()} visits` : "No peak detected",
                  accent: "#a03030", icon: "alert-triangle",
                },
                {
                  label: "Avg monthly visits",
                  value: `~${Math.round(mean).toLocaleString()}`,
                  sub: "forecast · next 12 months",
                  accent: C.dustyDenim, icon: "users",
                },
                {
                  label: "Food pressure index",
                  value: `${trendsObj.pressure_index_2026 ?? 9.35} / 10`,
                  sub: `up from ${trendsObj.pressure_index_2023 ?? 7.74} in 2023`,
                  accent: "#8b2e1a", icon: "trending-up",
                },
              ].map(s => (
                <div key={s.label} style={{
                  background: C.surfaceWhite, border: `0.5px solid ${C.borderLight}`,
                  borderTop: `3px solid ${s.accent}`, borderRadius: 12, padding: "14px 16px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <i className={`ti ti-${s.icon}`} style={{ fontSize: 13, color: s.accent }} aria-hidden="true" />
                    <div style={{ fontSize: 13, color: C.textMuted }}>{s.label}</div>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: C.textPrimary, marginBottom: 3 }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Monthly busyness chart */}
            <div style={{
              background: C.surfaceWhite, border: `0.5px solid ${C.borderLight}`,
              borderRadius: 12, padding: isMobile ? "16px 12px" : 24, marginBottom: 16,
            }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary, marginBottom: 4 }}>Monthly busyness forecast</div>
              <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 18 }}>
                Next 12 months · colour shows expected busyness level
              </div>
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={enriched} margin={{ top: 4, right: 12, bottom: 24, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.teaGreen} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: C.textMuted }} axisLine={false} tickLine={false} angle={-30} textAnchor="end" />
                  <YAxis tick={{ fontSize: 12, fill: C.textMuted }} axisLine={false} tickLine={false} domain={[0, "auto"]} tickFormatter={v => v.toLocaleString()} />
                  <Tooltip content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const pt  = payload[0]?.payload;
                    const cfg = BUSY_CFG[pt.busyness] ?? BUSY_CFG.moderate;
                    return (
                      <div style={{ background: C.forestGreen, borderRadius: 8, padding: "8px 13px", fontSize: 12, color: "#fff" }}>
                        <div style={{ fontWeight: 600, color: C.teaGreen, marginBottom: 4 }}>{label}</div>
                        <div>Forecast: <strong>{Math.round(pt.val).toLocaleString()} visits</strong></div>
                        <div style={{ marginTop: 4 }}>
                          <span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600, background: cfg.bar, color: "#fff" }}>
                            {cfg.label}
                          </span>
                        </div>
                      </div>
                    );
                  }} />
                  <Bar dataKey="val" radius={[4, 4, 0, 0]} barSize={isMobile ? 16 : 24}>
                    {enriched.map((entry, i) => (
                      <Cell key={i} fill={BUSY_CFG[entry.busyness]?.bar ?? C.jungleTeal} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
                {[
                  { color: BUSY_CFG.quiet.bar,    label: "Quiet — good time to visit" },
                  { color: BUSY_CFG.moderate.bar,  label: "Moderate — typical demand"  },
                  { color: BUSY_CFG.busy.bar,      label: "Busy — higher volume"        },
                ].map(({ color, label }) => (
                  <span key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.textMuted }}>
                    <span style={{ width: 12, height: 12, borderRadius: 3, background: color, display: "inline-block" }} />
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {/* Trends + Tips */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>

              {/* Food security trends */}
              <div style={{ background: C.surfaceWhite, border: `0.5px solid ${C.borderLight}`, borderRadius: 12, padding: isMobile ? "16px" : 24 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary, marginBottom: 4 }}>Food security trends</div>
                <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 18 }}>Campus Food Bank · 2023 → 2026</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {[
                    {
                      label: "Avg household size",
                      from: trendsObj.avg_hh_size_2023 ?? 1.66,
                      to: trendsObj.avg_hh_size_2026 ?? 2.11,
                      unit: "people/visit", worrying: true,
                      note: "More family members depending on each visit",
                    },
                    {
                      label: "Food per person",
                      from: trendsObj.lbs_per_person_2023 ?? 12.98,
                      to: trendsObj.lbs_per_person_2026 ?? 10.71,
                      unit: "lbs", worrying: false,
                      note: "Each person is receiving less food per visit",
                    },
                    {
                      label: "Pressure index",
                      from: trendsObj.pressure_index_2023 ?? 7.74,
                      to: trendsObj.pressure_index_2026 ?? 9.35,
                      unit: "/ 10", worrying: true,
                      note: "Composite indicator of demand vs supply stress",
                    },
                  ].map(row => (
                    <div key={row.label}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                        <div style={{ fontSize: 14, color: C.textSecondary, fontWeight: 500 }}>{row.label}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 14 }}>
                          <span style={{ color: C.textMuted }}>{row.from} {row.unit}</span>
                          <span style={{ color: C.textMuted }}>→</span>
                          <span style={{ fontWeight: 700, color: row.worrying ? "#8b2e1a" : C.jungleTeal }}>{row.to} {row.unit}</span>
                          <i className={`ti ti-arrow-${row.worrying ? "up" : "down"}`}
                            style={{ fontSize: 13, color: row.worrying ? "#8b2e1a" : C.jungleTeal }} aria-hidden="true" />
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>{row.note}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* When to visit */}
              <div style={{ background: C.surfaceWhite, border: `0.5px solid ${C.borderLight}`, borderRadius: 12, padding: isMobile ? "16px" : 24 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary, marginBottom: 4 }}>Planning your visit</div>
                <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 18 }}>Tips based on the 12-month forecast</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {[
                    {
                      icon: "sun", color: C.jungleTeal,
                      title: "Quietest months",
                      body: quietMonths.length
                        ? `${quietMonths.map(r => r.label).join(" & ")} — fewer visits forecast, shorter wait times.`
                        : "July & December are typically the quietest periods.",
                    },
                    {
                      icon: "alert-triangle", color: "#b85c1f",
                      title: "Busiest periods",
                      body: busyMonths.length
                        ? `${busyMonths.map(r => r.label).join(" & ")} — highest demand forecast. Visiting earlier in the month helps.`
                        : "January & March tend to be the busiest periods.",
                    },
                    {
                      icon: "school", color: C.dustyDenim,
                      title: "Exam periods drive demand",
                      body: "Visits spike around exams and semester starts — the strongest demand signal at this food bank.",
                    },
                    {
                      icon: "info-circle", color: C.textMuted,
                      title: "Forecast confidence",
                      body: `CV MAPE of ${cvMape}% — predictions are within ~${Math.round(cvMape / 100 * mean)} visits of actual monthly totals on average.`,
                    },
                  ].map(tip => (
                    <div key={tip.title} style={{
                      display: "flex", gap: 10, alignItems: "flex-start",
                      padding: "10px 12px", borderRadius: 8,
                      background: C.surfaceGreen, border: `0.5px solid ${C.borderLight}`,
                    }}>
                      <i className={`ti ti-${tip.icon}`} style={{ fontSize: 15, color: tip.color, flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, marginBottom: 2 }}>{tip.title}</div>
                        <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.5 }}>{tip.body}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 14, padding: "10px 12px", background: C.surfaceGreen, borderRadius: 8, border: `0.5px solid ${C.borderLight}` }}>
                  <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>
                    <strong style={{ color: C.textSecondary }}>About this data</strong><br />
                    Forecasts are based on a Prophet model trained on 36 months of visit data.
                    No personal or identifying information is shown.
                  </div>
                </div>
              </div>

            </div>
          </>
        )}
      </div>
    </div>
  );
}
