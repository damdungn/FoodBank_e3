import { useState, useEffect } from "react";
import { API_BASE } from "./config";

const C = {
  forestGreen:   "#224433",
  jungleTeal:    "#3f826d",
  teaGreen:      "#d0efb1",
  pageBg:        "#fbfcf6",
  surfaceWhite:  "#ffffff",
  surfaceGreen:  "#f2f9ec",
  borderLight:   "#dde8d8",
  textPrimary:   "#1a2e22",
  textSecondary: "#4a6355",
  textMuted:     "#7a9485",
};

const DRIVERS = [
  {
    icon:    "chart-bar",
    color:   "#1a6630",
    bg:      "#edfaf0",
    border:  "#b0d8b8",
    title:   "Economic conditions",
    desc:    "Rising food and housing costs push families toward food banks. FEEDS tracks CPI components, income-support caseloads, and labour-market signals month by month.",
    factors: ["Food & shelter CPI", "AISH caseload", "Unemployment rate", "Net migration"],
    signalKeys: [],
  },
  {
    icon:    "cloud-rain",
    color:   "#1a5070",
    bg:      "#eaf5fb",
    border:  "#a8d4f0",
    title:   "Weather & climate",
    desc:    "Cold snaps and extreme precipitation affect both client travel and volunteer capacity. The model uses monthly temperature and precipitation averages as regressors.",
    factors: ["Mean temperature (°C)", "Total precipitation (mm)", "Snowfall (cm)"],
    signalKeys: [],
  },
  {
    icon:    "calendar-dollar",
    color:   "#7a6010",
    bg:      "#fdf6d8",
    border:  "#e0cc70",
    title:   "Calendar & benefits",
    desc:    "Government benefit payment dates create predictable demand spikes. FEEDS flags GST credit days, CCB payments, stat holidays, and end-of-month patterns.",
    factors: ["GST credit days", "CCB payment days", "Stat holidays", "Month-end pressure"],
    signalKeys: ["gst_day", "ccb_day", "is_holiday", "is_stat_day"],
  },
  {
    icon:    "school",
    color:   "#6030a0",
    bg:      "#f3eefb",
    border:  "#c0a8e8",
    title:   "Student-specific factors",
    desc:    "Campus food banks face unique demand cycles tied to academic life — exam stress, tuition deadlines, and surges when international students arrive each semester.",
    factors: ["Exam periods", "Tuition deadlines", "International arrivals"],
    signalKeys: ["is_exam_period", "is_tuition_deadline", "is_intl_arrival_period"],
  },
];

const SIGNAL_LABELS = {
  gst_day:                 "GST credit day",
  ccb_day:                 "CCB payment",
  is_holiday:              "Public holiday",
  is_stat_day:             "Stat day",
  is_exam_period:          "Exam period",
  is_tuition_deadline:     "Tuition deadline",
  is_intl_arrival_period:  "Intl. student arrivals",
};

const ALERT_META = {
  Critical: { label: "Critical need",  bg: "#fdecea", color: "#8b2e1a", icon: "alert-triangle" },
  Warning:  { label: "High demand",    bg: "#fdf6d8", color: "#7a6010", icon: "alert-circle"   },
  Watch:    { label: "Watch",          bg: "#fff8e8", color: "#8a6020", icon: "eye"             },
  OK:       { label: "Balanced",       bg: "#edfaf0", color: "#1a6630", icon: "circle-check"   },
};

function fmt(lbs) {
  if (lbs >= 1_000_000) return `${(lbs / 1_000_000).toFixed(1)}M`;
  if (lbs >= 1_000)     return `${(lbs / 1_000).toFixed(0)}K`;
  return String(Math.round(lbs));
}

const FOOD_BANKS = [
  {
    key: "afb",
    name: "Food Banks Alberta",
    role: "Provincial hub · coordinates food distribution across Alberta",
    icon: "building",
    color: C.forestGreen,
    bg: C.surfaceGreen,
    border: C.borderLight,
    data: "Provincial model trained · 2021–2026",
  },
  {
    key: "rdfb",
    name: "Red Deer Food Bank",
    role: "Regional model · hamper demand forecasting",
    icon: "map-pin",
    color: "#5588c7",
    bg: "#eef3fb",
    border: "#c8d8f0",
    data: "Prophet model · 15-year training window",
  },
  {
    key: "edfb",
    name: "Edmonton Food Bank",
    role: "Regional partner · serving Edmonton metro area",
    icon: "map-2",
    color: "#7a5ca8",
    bg: "#f3eefb",
    border: "#d0c0f0",
    data: "Dataset integration pending",
  },
  {
    key: "campus",
    name: "Campus Food Bank",
    role: "University of Alberta · student food security",
    icon: "school",
    color: "#8a6020",
    bg: "#fffbee",
    border: "#e8d890",
    data: "Dataset received · May 2023–Apr 2026",
  },
];

export default function Dashboard({ onNavigate }) {
  const [kpis,        setKpis]        = useState(null);
  const [gapForecast, setGapForecast] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [signals,     setSignals]     = useState(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/dashboard`).then(r => r.json()),
      fetch(`${API_BASE}/api/gap`).then(r => r.json()),
    ])
      .then(([dash, gap]) => {
        setKpis(dash.kpis ?? null);
        setGapForecast(gap.forecastGap ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/api/signals`)
      .then(r => r.json())
      .then(d => setSignals(d.signals ?? d))
      .catch(() => {});
  }, []);

  const pctOut   = kpis?.pctChange?.outbound ?? 0;
  const topAlert = gapForecast[0]?.alert ?? "OK";
  const meta     = ALERT_META[topAlert] ?? ALERT_META.OK;

  const WHO = [
    {
      icon: "users",
      title: "Clients & Community",
      desc: "Looking for food support, want to know when to visit, or curious about food bank demand in your area.",
      page: "client-outlook",
      color: C.jungleTeal,
      bg: C.surfaceGreen,
      border: C.borderLight,
      btnLabel: "Go to Client Outlook",
    },
    {
      icon: "building",
      title: "Provincial Staff",
      desc: "Food Banks Alberta team accessing provincial supply-demand forecasts, donation trends, and model analysis.",
      page: "provincial",
      color: C.forestGreen,
      bg: "#f0f7ec",
      border: "#b8d8a8",
      btnLabel: "Provincial Access",
      locked: true,
    },
    {
      icon: "map-2",
      title: "Regional Staff",
      desc: "Red Deer and Edmonton regional food bank staff accessing hamper forecasts and regional demand patterns.",
      page: "regional",
      color: "#3a5ea8",
      bg: "#eef3fb",
      border: "#c8d8f0",
      btnLabel: "Regional Access",
      locked: true,
    },
  ];

  return (
    <div style={{
      height: "100%", overflowY: "auto", background: C.pageBg,
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <div style={{
        background: `linear-gradient(135deg, ${C.forestGreen} 0%, #2d6a50 100%)`,
        padding: "44px 40px 40px",
      }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          background: "rgba(255,255,255,0.12)", borderRadius: 20,
          padding: "4px 14px", fontSize: 11, fontWeight: 600,
          color: C.teaGreen, marginBottom: 18, letterSpacing: "0.05em",
          textTransform: "uppercase",
        }}>
          <i className="ti ti-building" style={{ fontSize: 12 }} aria-hidden="true" />
          Food Banks Alberta · Forecasting Tool
        </div>

        <h1 style={{ fontSize: 32, fontWeight: 800, color: "#fff", margin: "0 0 10px", lineHeight: 1.2 }}>
          FEEDS
        </h1>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.75)", maxWidth: 500, lineHeight: 1.7, margin: "0 0 30px" }}>
          Forecasting Engine for Estimating Demand and Supply —
          helping Alberta food banks plan ahead so every family gets the support they need.
        </p>

        {/* Key stats */}
        {!loading && kpis ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {[
              {
                icon: "package",
                label: "Food given to families last month",
                value: `${fmt(kpis.thisMonth.outbound)} lbs`,
                sub: null,
              },
              {
                icon: pctOut >= 0 ? "trending-up" : "trending-down",
                label: "Change vs previous month",
                value: `${pctOut >= 0 ? "+" : ""}${pctOut}%`,
                sub: null,
              },
              {
                icon: meta.icon,
                label: "3-month demand outlook",
                value: meta.label,
                sub: gapForecast[0]?.month ?? "",
              },
            ].map(s => (
              <div key={s.label} style={{
                background: "rgba(255,255,255,0.10)",
                border: "1px solid rgba(255,255,255,0.16)",
                borderRadius: 10, padding: "11px 16px",
                display: "flex", alignItems: "center", gap: 10, minWidth: 180,
              }}>
                <i className={`ti ti-${s.icon}`} style={{ fontSize: 20, color: C.teaGreen, flexShrink: 0 }} aria-hidden="true" />
                <div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", marginBottom: 1, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {s.label}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>
                    {s.value}
                    {s.sub && <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 6, opacity: 0.7 }}>{s.sub}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Loading data…</div>
        )}
      </div>

      <div style={{ padding: "36px 40px 52px", display: "flex", flexDirection: "column", gap: 40 }}>

        {/* ── WHO ARE YOU ──────────────────────────────────────────────── */}
        <section>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: C.forestGreen, margin: "0 0 6px" }}>
            Who are you?
          </h2>
          <p style={{ fontSize: 13, color: C.textMuted, margin: "0 0 20px" }}>
            Choose the section that matches you — each is tailored to what you need.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {WHO.map(w => (
              <div key={w.page} style={{
                background: w.bg,
                border: `1px solid ${w.border}`,
                borderRadius: 14, padding: "24px 22px",
                display: "flex", flexDirection: "column", gap: 14,
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: "rgba(255,255,255,0.7)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <i className={`ti ti-${w.icon}`} style={{ fontSize: 20, color: w.color }} aria-hidden="true" />
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: w.color, marginBottom: 6 }}>
                    {w.title}
                  </div>
                  <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.65 }}>
                    {w.desc}
                  </div>
                </div>
                <button
                  onClick={() => onNavigate?.(w.page)}
                  style={{
                    marginTop: "auto",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    padding: "9px 0", borderRadius: 8,
                    background: w.color, color: "#fff",
                    border: "none", cursor: "pointer",
                    fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = "0.88"}
                  onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                >
                  {w.locked && <i className="ti ti-lock" style={{ fontSize: 12 }} aria-hidden="true" />}
                  {w.btnLabel}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* ── WHAT DRIVES DEMAND ───────────────────────────────────────── */}
        <section>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: C.forestGreen, margin: "0 0 6px" }}>
            What drives food bank demand?
          </h2>
          <p style={{ fontSize: 13, color: C.textMuted, margin: "0 0 20px", maxWidth: 620, lineHeight: 1.65 }}>
            Unlike simple trend lines, FEEDS analyses four categories of external factors
            that independently push demand up or down — giving food banks earlier, more accurate warnings.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
            {DRIVERS.map(d => (
              <div key={d.title} style={{
                background: d.bg, border: `1px solid ${d.border}`,
                borderRadius: 14, padding: "22px 18px",
                display: "flex", flexDirection: "column", gap: 12,
              }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 10, flexShrink: 0,
                  background: "rgba(255,255,255,0.7)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <i className={`ti ti-${d.icon}`} style={{ fontSize: 20, color: d.color }} aria-hidden="true" />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: d.color, marginBottom: 5 }}>
                    {d.title}
                  </div>
                  <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.6, marginBottom: 10 }}>
                    {d.desc}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {d.factors.map(f => (
                      <div key={f} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 5, height: 5, borderRadius: "50%", background: d.color, opacity: 0.6, flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: C.textSecondary }}>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Live signal pills — only shown when API data is available */}
          {signals && (() => {
            const activeKeys = Object.keys(SIGNAL_LABELS).filter(k => signals[k] === true || signals[k] === 1);
            const monthLabel = signals.month_label ?? signals.date ?? null;
            return (
              <div style={{
                background: C.surfaceWhite,
                border: `1px solid ${C.borderLight}`,
                borderRadius: 12, padding: "16px 20px",
                display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.jungleTeal }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary }}>
                    Active signals{monthLabel ? ` · ${monthLabel}` : ""}
                  </span>
                </div>
                {activeKeys.length === 0 ? (
                  <span style={{ fontSize: 12, color: C.textMuted, fontStyle: "italic" }}>
                    No calendar or student signals active this period
                  </span>
                ) : (
                  activeKeys.map(k => (
                    <span key={k} style={{
                      fontSize: 11, fontWeight: 600,
                      padding: "3px 10px", borderRadius: 20,
                      background: C.surfaceGreen, color: C.jungleTeal,
                      border: `1px solid ${C.borderLight}`,
                    }}>
                      {SIGNAL_LABELS[k]}
                    </span>
                  ))
                )}
              </div>
            );
          })()}
        </section>

        {/* ── FOOD BANKS WE COVER ──────────────────────────────────────── */}
        <section>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: C.forestGreen, margin: "0 0 6px" }}>
            Food banks in this study
          </h2>
          <p style={{ fontSize: 13, color: C.textMuted, margin: "0 0 20px" }}>
            FEEDS covers four Alberta food banks across provincial and regional levels
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            {FOOD_BANKS.map(fb => (
              <div key={fb.key} style={{
                background: fb.bg,
                border: `1px solid ${fb.border}`,
                borderRadius: 12, padding: "20px 18px",
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12, marginBottom: 14,
                  background: "rgba(255,255,255,0.7)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <i className={`ti ti-${fb.icon}`} style={{ fontSize: 22, color: fb.color }} aria-hidden="true" />
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: fb.color, marginBottom: 5 }}>
                  {fb.name}
                </div>
                <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.6, marginBottom: 10 }}>
                  {fb.role}
                </div>
                <div style={{
                  fontSize: 11, color: C.textMuted,
                  borderTop: `1px solid ${fb.border}`, paddingTop: 8,
                }}>
                  {fb.data}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── ABOUT FEEDS TEASER ───────────────────────────────────────── */}
        <section style={{
          background: C.forestGreen,
          borderRadius: 14, padding: "28px 32px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24,
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 6 }}>
              How does FEEDS work?
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.72)", maxWidth: 480, lineHeight: 1.7 }}>
              Learn about our problem statement, the models we built, and what we found —
              including how AI forecasting can help food banks prevent shortfalls before they happen.
            </div>
          </div>
          <button
            onClick={() => onNavigate?.("about-feeds")}
            style={{
              flexShrink: 0, padding: "10px 22px",
              background: C.teaGreen, color: C.forestGreen,
              border: "none", borderRadius: 8, cursor: "pointer",
              fontSize: 13, fontWeight: 700, fontFamily: "inherit",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = "0.88"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}
          >
            About FEEDS →
          </button>
        </section>

      </div>
    </div>
  );
}
