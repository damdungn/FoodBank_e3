import { useState, useEffect } from "react";

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
  textMuted:     "#556b5f",
};

const SECTIONS = [
  {
    icon: "alert-circle",
    color: "#8b2e1a",
    bg: "#fdecea",
    title: "The problem",
    summary: "Food banks plan reactively with limited tools to anticipate demand before it arrives.",
    points: [
      "Most planning relies on recent experience, not forward-looking data.",
      "Demand is shaped by many interconnected factors: food prices, housing costs, government benefits, weather, and local events.",
      "Provincial staff must allocate food across Alberta; regional staff must prepare the right number of hampers. Both are working without much advance notice.",
      "Tracking and interpreting all these signals manually is difficult and time-consuming.",
    ],
  },
  {
    icon: "bulb",
    color: C.jungleTeal,
    bg: C.surfaceGreen,
    title: "Our solution",
    summary: "FEEDS combines food bank records with external indicators to forecast demand before it hits.",
    points: [
      "Ingests operational data alongside economic, weather, and calendar datasets.",
      "Generates monthly forecasts for inbound donations and outbound distribution.",
      "Gives provincial staff early visibility into supply-demand gaps and when donor outreach is needed.",
      "Gives regional staff monthly hamper estimates to support staffing, storage, and food packaging.",
      "Designed to inform decisions, not replace them so that staff stay in control.",
    ],
  },
  {
    icon: "chart-bar",
    color: "#7a5ca8",
    bg: "#f3eefb",
    title: "Key findings",
    summary: "Four consistent patterns emerged from model development and analysis.",
    points: [
      "Economic conditions drive demand at every level such as food prices, shelter costs, and income and support caseloads all matter.",
      "AISH caseload is a particularly strong early warning signal: changes often appear before corresponding increases in food bank demand.",
      "Adding external features significantly improves forecasts compared to models that rely on historical trends alone.",
      "Different food banks have different drivers: economic conditions dominate provincial and regional models, while campus demand is more tied to the academic calendar.",
    ],
  },
  {
    icon: "route",
    color: "#8a6020",
    bg: "#fffbee",
    title: "Impact & next steps",
    summary: "FEEDS helps food banks plan ahead so they can focus on the communities they serve.",
    points: [
      "Earlier demand visibility reduces reactive scrambling for food, volunteers, and storage capacity.",
      "Better provincial allocation when staff can see supply-demand gaps forming weeks in advance.",
      "Next: integrate Edmonton Food Bank data and complete the Campus Food Bank model.",
      "Future: improve forecast explainability, collect more data to better generalize the models and move toward real time data feeds.",
    ],
  },
];

const MODELS = [
  {
    name: "Provincial model",
    type: "Prophet + RandomForest ensemble",
    target: "Monthly provincial inbound donations & outbound distribution",
    data: "Food Banks Alberta · Jan 2022 – May 2026 · monthly aggregates",
    regressors: "CPI (food, shelter, all-items) · AISH caseload · Net migration · Mean temperature",
    status: "Trained & deployed",
    statusColor: "#1a6630",
    statusBg: "#edfaf0",
  },
  {
    name: "Regional model (Red Deer)",
    type: "Prophet + economic regressors",
    target: "Monthly hamper demand at Red Deer Food Bank",
    data: "RDFB · 15-year training window (2011–2026)",
    regressors: "AISH caseload · CPI · School calendar",
    status: "Trained & deployed",
    statusColor: "#1a6630",
    statusBg: "#edfaf0",
  },
  {
    name: "Campus Food Bank model",
    type: "To be determined",
    target: "Daily visit demand at University of Alberta Campus FB",
    data: "May 2023 – Apr 2026 · daily granularity",
    regressors: "Academic calendar · Exam periods · International arrivals · Tuition Deadlines",
    status: "Dataset received · pending",
    statusColor: "#7a6010",
    statusBg: "#fdf6d8",
  },
  {
    name: "Edmonton Food Bank model",
    type: "To be determined",
    target: "Regional demand for Edmonton metro area",
    data: "Dataset integration pending",
    regressors: "TBD",
    status: "In planning",
    statusColor: "#7a9485",
    statusBg: "#f2f9ec",
  },
];

export default function AboutFeeds() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div style={{
      height: "100%", overflowY: "auto", background: C.pageBg,
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>

      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, #122b1e 0%, ${C.forestGreen} 40%, #2d6a50 75%, #3f826d 100%)`,
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
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          background: "rgba(255,255,255,0.12)", borderRadius: 20,
          padding: "4px 14px", fontSize: 12, fontWeight: 600,
          color: C.teaGreen, marginBottom: 18, letterSpacing: "0.05em",
          textTransform: "uppercase",
        }}>
          <i className="ti ti-info-circle" style={{ fontSize: 13 }} aria-hidden="true" />
          About this project
        </div>
        <h1 style={{ fontSize: isMobile ? 24 : 32, fontWeight: 800, color: "#fff", margin: "0 0 10px", marginBottom: 30 }}>
          About FEEDS
        </h1>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.75)", maxWidth: 650, lineHeight: 1.7, margin: 0 }}>
          Forecasting Engine for Estimating Demand and Supply:
          an AI-powered early warning system for food bank demand across Alberta.
        </p>
      </div>

      <div style={{ padding: isMobile ? "24px 16px 40px" : "36px 40px 52px", display: "flex", flexDirection: "column", gap: 36 }}>

        {/* Team photo — drop team.jpg into /public to activate */}
        <section>
          <h2 style={{ fontSize: 25, fontWeight: 700, color: C.forestGreen, margin: "0 0 6px" }}>
            Meet the team
          </h2>
          <p style={{ fontSize: 14, color: C.textMuted, margin: "0 0 16px" }}>
            FEEDS was built by a team of students at the University of Alberta.
          </p>
          <div style={{
            borderRadius: 16,
            overflow: "hidden",
            border: `1px solid ${C.borderLight}`,
            background: C.surfaceWhite,
            boxShadow: "0 2px 12px rgba(34,68,51,0.07)",
          }}>
            <img
              src="/team.jpg"
              alt="The FEEDS team"
              onError={e => { e.currentTarget.style.display = "none"; e.currentTarget.nextSibling.style.display = "flex"; }}
              style={{
                width: "100%",
                maxHeight: isMobile ? 260 : 420,
                objectFit: "cover",
                objectPosition: "center top",
                display: "block",
              }}
            />
            {/* Fallback shown when team.jpg is missing */}
            <div style={{
              display: "none",
              alignItems: "center", justifyContent: "center",
              flexDirection: "column", gap: 10,
              height: 200,
              background: C.surfaceGreen,
              color: C.textMuted,
            }}>
              <i className="ti ti-users" style={{ fontSize: 32, color: C.borderLight }} aria-hidden="true" />
              <span style={{ fontSize: 14 }}>Add <code style={{ background: "#eee", padding: "1px 6px", borderRadius: 4 }}>team.jpg</code> to the <code style={{ background: "#eee", padding: "1px 6px", borderRadius: 4 }}>public/</code> folder</span>
            </div>
            <div style={{
              padding: "14px 20px",
              borderTop: `1px solid ${C.borderLight}`,
              fontSize: 13, color: C.textMuted,
              background: C.surfaceGreen,
            }}>
              The FEEDS team · University of Alberta · 2025–2026
            </div>
          </div>
        </section>

        {/* Research sections */}
        <section>
          <h2 style={{ fontSize: 25, fontWeight: 700, color: C.forestGreen, margin: "0 0 6px" }}>
            Research overview
          </h2>
          <p style={{ fontSize: 14, color: C.textMuted, margin: "0 0 20px" }}>
            Why we built FEEDS, how it works, what we found, and where it's going.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {SECTIONS.map(s => (
              <div key={s.title} style={{
                background: C.surfaceWhite,
                border: `1px solid ${C.borderLight}`,
                borderLeft: `4px solid ${s.color}`,
                borderRadius: "0 12px 12px 0",
                padding: isMobile ? "16px 16px" : "20px 24px",
                display: "flex", gap: 18, alignItems: "flex-start",
              }}>
                <div style={{
                  width: 40, height: 40, flexShrink: 0, borderRadius: 10,
                  background: s.bg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <i className={`ti ti-${s.icon}`} style={{ fontSize: 18, color: s.color }} aria-hidden="true" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: C.textPrimary, marginBottom: 4 }}>
                    {s.title}
                  </div>
                  <div style={{ fontSize: 14, color: C.textSecondary, marginBottom: 10, lineHeight: 1.6 }}>
                    {s.summary}
                  </div>
                  <ul style={{ margin: 0, padding: "0 0 0 16px", display: "flex", flexDirection: "column", gap: 5 }}>
                    {s.points.map((p, i) => (
                      <li key={i} style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.65 }}>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Models table */}
        <section>
          <h2 style={{ fontSize: 25, fontWeight: 700, color: C.forestGreen, margin: "0 0 6px" }}>
            Models in FEEDS
          </h2>
          <p style={{ fontSize: 14, color: C.textMuted, margin: "0 0 20px" }}>
            One model per food bank — each tuned to its data granularity and demand drivers
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {MODELS.map(m => (
              <div key={m.name} style={{
                background: C.surfaceWhite,
                border: `1px solid ${C.borderLight}`,
                borderRadius: 12, padding: "18px 22px",
              }}>
                <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "flex-start", gap: isMobile ? 6 : 0, marginBottom: 10 }}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: C.textPrimary }}>{m.name}</div>
                  <span style={{
                    fontSize: 13, fontWeight: 600, padding: "3px 10px", borderRadius: 20, flexShrink: 0,
                    background: m.statusBg, color: m.statusColor,
                  }}>
                    {m.status}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 8 : "6px 24px" }}>
                  {[
                    { label: "Model type",  value: m.type       },
                    { label: "Predicts",    value: m.target     },
                    { label: "Data",        value: m.data       },
                    { label: "Key drivers", value: m.regressors },
                  ].map(row => (
                    <div key={row.label}>
                      <span style={{ fontSize: 13, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {row.label}
                      </span>
                      <div style={{ fontSize: 14, color: C.textSecondary, marginTop: 2, lineHeight: 1.5 }}>
                        {row.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Collaboration note */}
        <div style={{
          background: C.surfaceGreen,
          border: `1px solid ${C.borderLight}`,
          borderRadius: 12, padding: isMobile ? "18px 16px" : "24px 28px",
          display: "flex", gap: 14, alignItems: "flex-start",
        }}>
          <i className="ti ti-heart-handshake" style={{ fontSize: 22, color: C.jungleTeal, flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.forestGreen, marginBottom: 4 }}>
              Built in collaboration with food banks
            </div>
            <div style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.65 }}>
              FEEDS was developed in partnership with Food Banks Alberta and Red Deer Food Bank.
              Through continued collaboration, the goal is to make FEEDS a practical support tool
              that helps organizations anticipate needs, allocate resources, and improve food security outcomes across Alberta.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
