import { useState, useEffect } from "react";
import { API_BASE } from "./config";

const C = {
  forestGreen:   "#274e3a",
  jungleTeal:    "#3f826d",
  teaGreen:      "#d0efb1",
  pageBg:        "#fbfcf6",
  surfaceWhite:  "#ffffff",
  surfaceGreen:  "#f2f9ec",
  borderLight:   "#dde8d8",
  textPrimary:   "#1a2e22",
  textSecondary: "#4a6355",
  textMuted:     "#556b5f",
};

const DRIVERS = [
  {
    icon:    "chart-bar",
    color:   "#1a6630",
    bg:      "#edfaf0",
    border:  "#b0d8b8",
    title:   "Economic indicators",
    desc:    "Rising food and housing costs push families toward food banks. FEEDS tracks CPI components, income-support caseloads, and net migration signals month by month.",
    factors: ["Food & shelter CPI", "AISH caseload", "Unemployment rate", "Net migration"],
    signalKeys: [],
  },
  {
    icon:    "cloud-rain",
    color:   "#1a5070",
    bg:      "#eaf5fb",
    border:  "#a8d4f0",
    title:   "Weather & climate",
    desc:    "Cold weather and extreme precipitation affect both client travel and volunteer capacity. The model uses monthly temperature and precipitation averages as features.",
    factors: ["Average temperature (°C)", "Total precipitation (mm)", "Snowfall (cm)"],
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
    color:   "#a03030",
    bg:      "#fbeeee",
    border:  "#e8a8a8",
    title:   "Student-specific factors",
    desc:    "Campus food banks face different demand cycles tied to academic life such as exam stress, tuition deadlines, and surges when international students arrive each semester.",
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
    role: "Provincial model · Coordinating food distribution across Alberta",
    icon: "building",
    logo: "/aberta_fb.jpg",
    color: C.forestGreen,
    bg: C.surfaceGreen,
    border: C.teaGreen,
    data: "Provincial model trained · 2021–2026",
  },
  {
    key: "rdfb",
    name: "Red Deer Food Bank",
    role: "Regional model · Serving hampers based on local demand requests",
    icon: "map-pin",
    logo: "/red_deer_fb.jpg",
    color: "#5588c7",
    bg: "#eef3fb",
    border: "#c8d8f0",
    data: "Regional model trained · 2011–2026",
  },
  {
    key: "edfb",
    name: "Edmonton Food Bank",
    role: "Regional partner · Serving Edmonton metropolitan",
    icon: "map-2",
    logo: "/edmonton_fb.jpg",
    color: "#a85c5c",
    bg: "#fbeeee",
    border: "#f0c0c0",
    data: "Used as a research partner",
  },
  {
    key: "campus",
    name: "Campus Food Bank",
    role: "University of Alberta · Addressing student food insecurity",
    icon: "school",
    logo: "/campus_fb.jpg",
    color: "#8a6020",
    bg: "#fffbee",
    border: "#e8d890",
    data: "Regional model trained · May 2023–Apr 2026",
  },
];

export default function Dashboard({ onNavigate }) {
  const [kpis,        setKpis]        = useState(null);
  const [gapForecast, setGapForecast] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [signals,     setSignals]     = useState(null);
  const [isMobile,    setIsMobile]    = useState(() => window.innerWidth < 768);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

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
      icon: "building",
      title: "Provincial Staff",
      desc: "Food Banks Alberta team accessing provincial supply-demand forecasts, donation trends, and model analysis.",
      page: "provincial",
      color: "#c39728",
      bg: "#f7f5ec",
      border: "#d8caa8",
      btnLabel: "Provincial Access",
      locked: true,
    },
    {
      icon: "map-2",
      title: "Regional Staff",
      desc: "Regional food bank staff accessing hamper forecasts and regional demand patterns.",
      page: "regional",
      color: "#3a5ea8",
      bg: "#eef3fb",
      border: "#c8d8f0",
      btnLabel: "Regional Access",
      locked: true,
    },
    {
      icon: "users",
      title: "Clients & Community",
      desc: "Check the best time to visit, or explore food bank demand in your community.",
      page: "client-outlook",
      color: C.jungleTeal,
      bg: C.surfaceGreen,
      border: C.borderLight,
      btnLabel: "Go to Client Outlook",
    },
  ];

  return (
    <div style={{
      height: "100%", overflowY: "auto", background: C.pageBg,
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes heroSlideUp {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes wordReveal {
          from { opacity: 0; transform: translateX(-12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .hero-word {
          display: inline-block;
          opacity: 0;
          animation: wordReveal 0.35s ease forwards;
        }
        @keyframes logoEntrance {
          from { opacity: 0; transform: translateX(40px) scale(0.92); }
          to   { opacity: 1; transform: translateX(0)    scale(1);    }
        }
        @keyframes logoFloat {
          0%, 100% { transform: translateY(0px);  }
          50%      { transform: translateY(-8px); }
        }
        .hero-logo {
          animation:
            logoEntrance 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.3s both,
            logoFloat    4s ease-in-out 1.2s infinite;
        }
      `}</style>

      <div style={{
        background: `linear-gradient(135deg, #224433 0%, ${C.forestGreen} 40%, #33795a 75%, #438f77 100%)`,
        padding: isMobile ? "32px 20px 28px" : "52px 44px 48px",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Decorative rings */}
        <div style={{
          position: "absolute", top: -60, right: -60,
          width: 260, height: 260, borderRadius: "50%",
          border: "1.5px solid rgba(208,239,177,0.12)",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", top: -20, right: -20,
          width: 160, height: 160, borderRadius: "50%",
          border: "1.5px solid rgba(208,239,177,0.08)",
          pointerEvents: "none",
        }} />
        {/* Subtle leaf dot pattern */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, top: 0,
          backgroundImage: "radial-gradient(circle, rgba(208,239,177,0.06) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          pointerEvents: "none",
        }} />

        {/* Hero content row */}
        <div style={{
          display: "flex",
          flexDirection: isMobile ? "column-reverse" : "row",
          alignItems: isMobile ? "flex-start" : "center",
          justifyContent: "space-between", gap: isMobile ? 16 : 32,
          position: "relative",
        }}>
          {/* Left — text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Badge */}
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              background: "rgba(208,239,177,0.15)",
              border: "1px solid rgba(208,239,177,0.25)",
              borderRadius: 20,
              padding: "5px 15px", fontSize: 13, fontWeight: 600,
              color: C.teaGreen, marginBottom: 22, letterSpacing: "0.07em",
              textTransform: "uppercase",
              animation: "heroSlideUp 0.5s ease both",
              animationDelay: "0.05s",
            }}>
              <i className="ti ti-welcome" style={{ fontSize: 13 }} aria-hidden="true" />
              Welcome!
            </div>

            {/* Motto — word by word */}
            <h1 style={{
              fontSize: isMobile ? 22 : 30, fontWeight: 800, color: "#fff",
              margin: "0 0 14px", lineHeight: 1.25,
            }}>
              {"FEEDS lands insights, so food banks can land on time.".split(" ").map((word, i) => (
                <span
                  key={i}
                  className="hero-word"
                  style={{ animationDelay: `${0.25 + i * 0.08}s`, marginRight: "0.28em" }}
                >
                  {word}
                </span>
              ))}
            </h1>

            {/* Sub-line */}
            <p style={{
              fontSize: 16, color: "rgba(208,239,177,0.75)",
              margin: 0, lineHeight: 1.6, maxWidth: 520,
              animation: "heroSlideUp 0.55s ease both",
              animationDelay: "1.2s",
            }}>
              AI supply &amp; demand forecasting tool to help Alberta food banks plan ahead, and serve more families.
            </p>
          </div>
        </div>
      </div>

      <div style={{ padding: isMobile ? "24px 16px 40px" : "36px 40px 52px", display: "flex", flexDirection: "column", gap: isMobile ? 28 : 40 }}>

        {/* ── WHO ARE YOU ──────────────────────────────────────────────── */}
        <section>
          <h2 style={{ fontSize: 25, fontWeight: 700, color: C.forestGreen, margin: "0 0 6px" }}>
            Who are you?
          </h2>
          <p style={{ fontSize: 14, color: C.textMuted, margin: "0 0 20px" }}>
            Choose the section that best matches you.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 16 }}>
            {WHO.map(w => (
              <div key={w.page} style={{
                background: w.bg,
                border: `1px solid ${w.border}`,
                borderRadius: 14, padding: "24px 22px",
                display: "flex", flexDirection: "column", gap: 14,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: 14, flexShrink: 0,
                    background: `linear-gradient(135deg, ${w.color}22 0%, ${w.color}44 100%)`,
                    border: `1.5px solid ${w.color}55`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <i className={`ti ti-${w.icon}`} style={{ fontSize: 26, color: w.color }} aria-hidden="true" />
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: w.color, lineHeight: 1.25 }}>
                    {w.title}
                  </div>
                </div>
                <div style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.65 }}>
                  {w.desc}
                </div>
                <button
                  onClick={() => onNavigate?.(w.page)}
                  style={{
                    marginTop: "auto",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    padding: "9px 0", borderRadius: 8, 
                    background: w.color, color: "#fff",
                    border: "none", cursor: "pointer",
                    fontSize: 14, fontWeight: 600, fontFamily: "inherit",
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = "0.88"}
                  onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                >
                  {w.locked && <i className="ti ti-lock" style={{ fontSize: 13 }} aria-hidden="true" />}
                  {w.btnLabel}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* ── WHAT DRIVES DEMAND ───────────────────────────────────────── */}
        <section>
          <h2 style={{ fontSize: 25, fontWeight: 700, color: C.forestGreen, margin: "0 0 6px" }}>
            What drives food bank demand?
          </h2>
          <p style={{ fontSize: 14, color: C.textMuted, margin: "0 0 20px", maxWidth: 900, lineHeight: 1.65 }}>
            FEEDS analyses four categories of external factors that drive demand up or down to give food banks early and more accurate warnings.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
            {DRIVERS.map(d => (
              <div key={d.title} style={{
                background: d.bg, border: `1px solid ${d.border}`,
                borderRadius: 14, padding: "22px 18px",
                display: "flex", flexDirection: "column", gap: 12,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 13, flexShrink: 0,
                    background: `linear-gradient(135deg, ${d.color}22 0%, ${d.color}45 100%)`,
                    border: `1.5px solid ${d.color}55`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <i className={`ti ti-${d.icon}`} style={{ fontSize: 24, color: d.color }} aria-hidden="true" />
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: d.color, lineHeight: 1.3 }}>
                    {d.title}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.6, marginBottom: 10 }}>
                    {d.desc}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {d.factors.map(f => (
                      <div key={f} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 5, height: 5, borderRadius: "50%", background: d.color, opacity: 0.6, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: C.textSecondary }}>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── FOOD BANKS WE COVER ──────────────────────────────────────── */}
        <section>
          <h2 style={{ fontSize: 25, fontWeight: 700, color: C.forestGreen, margin: "0 0 6px" }}>
            Food banks in this study
          </h2>
          <p style={{ fontSize: 14, color: C.textMuted, margin: "0 0 20px" }}>
            FEEDS used data from 2 Alberta food banks across provincial and regional levels and 2 research partners to build forecasting tools grounded in real-world needs. 
          </p>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 14 }}>
            {FOOD_BANKS.map(fb => (
              <div key={fb.key} style={{
                background: fb.bg,
                border: `1px solid ${fb.border}`,
                borderRadius: 12, padding: "20px 18px",
                display: "flex", flexDirection: "column", gap: 12,
              }}>
                {/* Logo + Name row */}
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{
                    width: isMobile ? 60 : 76, height: isMobile ? 60 : 76,
                    borderRadius: "50%", flexShrink: 0,
                    background: "#fff",
                    border: `1.5px solid ${fb.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    overflow: "hidden", padding: "7px", boxSizing: "border-box",
                  }}>
                    <img
                      src={fb.logo}
                      alt={`${fb.name} logo`}
                      onError={e => {
                        e.currentTarget.style.display = "none";
                        e.currentTarget.nextSibling.style.display = "flex";
                      }}
                      style={{
                        maxWidth: "100%", maxHeight: "100%",
                        objectFit: "contain",
                        display: "block",
                      }}
                    />
                    <div style={{ display: "none", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}>
                      <i className={`ti ti-${fb.icon}`} style={{ fontSize: 28, color: fb.color }} aria-hidden="true" />
                    </div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: fb.color, lineHeight: 1.3 }}>
                    {fb.name}
                  </div>
                </div>
                <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.6 }}>
                  {fb.role}
                </div>
                <div style={{
                  fontSize: 12, color: C.textMuted,
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
          background: `linear-gradient(135deg, #122b1e 0%, ${C.forestGreen} 40%, #2d6a50 75%, #3f826d 100%)`,
          borderRadius: 14, padding: isMobile ? "22px 20px" : "28px 32px",
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          alignItems: isMobile ? "flex-start" : "center",
          justifyContent: "space-between", gap: isMobile ? 16 : 24,
        }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 6 }}>
              How does FEEDS work?
            </div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.72)", maxWidth: 480, lineHeight: 1.7 }}>
              Learn about our problem statement, the models we built, and what we found.
            </div>
          </div>
          <button
            onClick={() => onNavigate?.("about-feeds")}
            style={{
              flexShrink: 0,
              width: isMobile ? "100%" : "auto",
              padding: "10px 22px",
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
