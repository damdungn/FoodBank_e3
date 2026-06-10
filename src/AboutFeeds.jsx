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

const SECTIONS = [
  {
    icon: "alert-circle",
    color: "#8b2e1a",
    bg: "#fdecea",
    title: "Problem Statement",
    placeholder: "What is the core challenge facing food banks in Alberta? Why is demand forecasting difficult? What gaps exist in current planning tools?",
  },
  {
    icon: "bulb",
    color: C.jungleTeal,
    bg: C.surfaceGreen,
    title: "Our Solution",
    placeholder: "How does FEEDS address these challenges? What does the forecasting engine do, and what makes it different from manual planning?",
  },
  {
    icon: "cpu",
    color: "#3a5ea8",
    bg: "#eef3fb",
    title: "Models & Methods",
    placeholder: "What models are used? Prophet time-series, XGBoost/RandomForest ensemble, economic regressors (CPI, AISH, migration, temperature). What data sources power each model?",
  },
  {
    icon: "chart-bar",
    color: "#7a5ca8",
    bg: "#f3eefb",
    title: "Key Findings",
    placeholder: "What did we discover? How accurately can demand be predicted? Which factors matter most? What early-warning signals were identified?",
  },
  {
    icon: "route",
    color: "#8a6020",
    bg: "#fffbee",
    title: "Impact & Next Steps",
    placeholder: "How does FEEDS help food banks act earlier? What is the roadmap — Edmonton Campus FB integration, inventory signals, real-time data feeds?",
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
    regressors: "Academic calendar · exam periods · international arrivals · tuition deadlines",
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
  return (
    <div style={{
      height: "100%", overflowY: "auto", background: C.pageBg,
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>

      {/* Header */}
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
          <i className="ti ti-info-circle" style={{ fontSize: 12 }} aria-hidden="true" />
          About this project
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: "#fff", margin: "0 0 10px" }}>
          About FEEDS
        </h1>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.75)", maxWidth: 560, lineHeight: 1.7, margin: 0 }}>
          Forecasting Engine for Estimating Demand and Supply —
          an AI-powered early warning system for food bank demand across Alberta.
        </p>
      </div>

      <div style={{ padding: "36px 40px 52px", display: "flex", flexDirection: "column", gap: 36 }}>

        {/* Research sections */}
        <section>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: C.forestGreen, margin: "0 0 6px" }}>
            Research overview
          </h2>
          <p style={{ fontSize: 13, color: C.textMuted, margin: "0 0 20px" }}>
            Content coming soon — this page will document our full research findings.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {SECTIONS.map(s => (
              <div key={s.title} style={{
                background: C.surfaceWhite,
                border: `1px solid ${C.borderLight}`,
                borderLeft: `4px solid ${s.color}`,
                borderRadius: "0 12px 12px 0",
                padding: "20px 24px",
                display: "flex", gap: 18, alignItems: "flex-start",
              }}>
                <div style={{
                  width: 40, height: 40, flexShrink: 0, borderRadius: 10,
                  background: s.bg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <i className={`ti ti-${s.icon}`} style={{ fontSize: 18, color: s.color }} aria-hidden="true" />
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary, marginBottom: 6 }}>
                    {s.title}
                  </div>
                  <div style={{
                    fontSize: 13, color: C.textMuted, lineHeight: 1.65,
                    fontStyle: "italic",
                    background: "#f7f9f5", borderRadius: 6,
                    padding: "8px 12px",
                    borderLeft: `3px dashed ${C.borderLight}`,
                  }}>
                    {s.placeholder}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Models table */}
        <section>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: C.forestGreen, margin: "0 0 6px" }}>
            Models in FEEDS
          </h2>
          <p style={{ fontSize: 13, color: C.textMuted, margin: "0 0 20px" }}>
            One model per food bank — each tuned to its data granularity and demand drivers
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {MODELS.map(m => (
              <div key={m.name} style={{
                background: C.surfaceWhite,
                border: `1px solid ${C.borderLight}`,
                borderRadius: 12, padding: "18px 22px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary }}>{m.name}</div>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, flexShrink: 0,
                    background: m.statusBg, color: m.statusColor,
                  }}>
                    {m.status}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 24px" }}>
                  {[
                    { label: "Model type",  value: m.type       },
                    { label: "Predicts",    value: m.target     },
                    { label: "Data",        value: m.data       },
                    { label: "Key drivers", value: m.regressors },
                  ].map(row => (
                    <div key={row.label}>
                      <span style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {row.label}
                      </span>
                      <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 2, lineHeight: 1.5 }}>
                        {row.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Coming soon notice */}
        <div style={{
          background: C.surfaceGreen,
          border: `1px dashed ${C.borderLight}`,
          borderRadius: 12, padding: "24px 28px",
          display: "flex", gap: 14, alignItems: "flex-start",
        }}>
          <i className="ti ti-clock" style={{ fontSize: 22, color: C.jungleTeal, flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.forestGreen, marginBottom: 4 }}>
              Full documentation coming soon
            </div>
            <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.65 }}>
              This page will include the complete project write-up: methodology, model evaluation results,
              feature importance analysis, and recommendations for food banks.
              Content will be added as the research is finalised.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
