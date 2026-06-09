import { useState, useRef, useEffect } from "react";

const C = {
  forestGreen:  "#224433",
  jungleTeal:   "#3f826d",
  teaGreen:     "#d0efb1",
  dustyDenim:   "#5588c7",
  pageBg:       "#fbfcf6",
  surfaceLight: "#f4fef0",
  surfaceWhite: "#f9f9f9",
  surfaceGreen: "#e0f6cd",
  surfaceBlue:  "#cedef8",
  surfaceRed:   "#f9d4d0",
  borderLight:  "#dde8d8",
  textPrimary:  "#1a2e22",
  textSecondary:"#4a6355",
  textMuted:    "#7a9485",
  sidebarBorder: "#247250",
};

function buildSystemPrompt(summary, gapData) {
  const confPct   = summary?.confidence_pct ?? "N/A";
  const confLabel = summary?.confidence_label ?? "unknown";
  const mIn       = summary?.targets?.LBS_In  ?? {};
  const mOut      = summary?.targets?.LBS_Out ?? {};
  const gapStats  = gapData?.gapStats ?? {};

  const gapLines = (gapData?.forecastGap ?? [])
    .map(f => {
      const sign = f.Gap_forecast >= 0 ? "+" : "";
      return `  - ${f.month}: ${f.alert} (gap ${sign}${Math.round(f.Gap_forecast / 1000)}K lbs)`;
    })
    .join("\n") || "  - No forecast available";

  const r2InPct  = Math.round(Math.max(0, mIn.r2  ?? 0) * 100);
  const r2OutPct = Math.round(Math.max(0, mOut.r2 ?? 0) * 100);

  return `You are the AI analyst for FEEDS (Forecasting Engine for Estimating Demand and Supply), an early-warning system for the Edmonton Food Bank provincial hub in Alberta, Canada.

You are publicly accessible — you help clients, researchers, staff, and the general public understand food bank demand forecasts. Keep answers clear and jargon-free for general audiences, but provide depth when asked.

You have access to two model outputs:

MODEL 1 — Provincial (Holt-Winters + XGBoost hybrid):
- Predicts provincial inbound donations (LBS_In) and outbound distribution (LBS_Out) — monthly totals in lbs
- Monthly data aggregated from daily records: Jan 2022 – May 2026
- Features used: CPI (food, shelter, all-items), unemployment rate, net migration, AISH caseload, CCB/GST/CPP/OAS payment days per month, school calendar, weather (mean temp, precipitation, snow on ground), stat/religious holidays, Ramadan, exam season, ACWB/ACFB disbursements
- Architecture: Holt-Winters handles trend + seasonality; XGBoost models the external economic/calendar shocks on top
- Prediction confidence (LBS_Out — more reliable): ${confPct}% (${confLabel}) — explains ${r2OutPct}% of month-to-month variation in outbound distribution. Typical error: ±${mOut.smape ?? "?"}%.
- Prediction confidence (LBS_In — donations): ${r2InPct}% — donations are inherently irregular; use as a directional signal, not a precise target. Typical error: ±${mIn.smape ?? "?"}%.
- 80% prediction intervals are attached to every forecast (there is genuine uncertainty — the model is honest about this)

MODEL 2 — Regional (not yet available):
- Will predict client-level demand at Edmonton regional food bank
- Awaiting regional dataset before training

3-month gap forecast (LBS_In − LBS_Out):
${gapLines}
  - Positive = surplus (donations > distribution); Negative = shortfall (demand > supply)

Historical gap context:
- Mean monthly gap: ${Math.round((gapStats.mean_gap ?? 0) / 1000)}K lbs (${(gapStats.mean_gap ?? 0) < 0 ? "chronic deficit" : "surplus"})
- ${gapStats.pct_deficit ?? "?"}% of months historically run a supply deficit
- Warning threshold: gap below ${Math.round((gapStats.warn_threshold ?? 0) / 1000)}K lbs/month
- Critical threshold: gap below ${Math.round((gapStats.critical_threshold ?? 0) / 1000)}K lbs/month

Model improvement opportunities (honest limitations):
${(summary?.improvement_paths ?? []).map(p => `  - ${p}`).join("\n")}

Guidelines:
- Be concise and practical
- Use bullet points for recommendations
- For clients asking about visiting: give plain-language advice (busy months, quieter periods; note this is a monthly model — daily visit patterns are not available yet)
- Never fabricate specific numbers not listed above — say "not available in current model output" instead
- Flag if a question is outside your scope
- Be honest about model uncertainty — 80% intervals mean 20% of outcomes fall outside them`;
}

const DEFAULT_SYSTEM_PROMPT = buildSystemPrompt(null, null);

const SUGGESTED = [
  "Is demand expected to be high next month?",
  "What's driving the supply-demand gap?",
  "How confident is the forecast?",
  "How does AISH disbursement affect food bank demand?",
  "What would improve the model accuracy?",
  "How are the two models connected?",
];

// ── Bubble components ─────────────────────────────────────────────────────────

function UserBubble({ text }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
      <div style={{
        maxWidth: "72%",
        background: "#315c4b",
        color: "#d1ecc8",
        borderRadius: "12px 12px 3px 12px",
        padding: "10px 15px",
        fontSize: 13,
        lineHeight: 1.65,
        textAlign: "justify",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}>
        {text}
      </div>
    </div>
  );
}

function AssistantBubble({ text, loading }) {
  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "flex-start" }}>
      {/* Avatar */}
      <div style={{
        width: 30, height: 30, flexShrink: 0, marginTop: 1,
        background: C.jungleTeal, borderRadius: 8,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <img src="/logo.png" alt="FEEDS logo" style={{ width: 40, height: 40, borderRadius: 7, objectFit: "contain", border: `1px solid ${C.sidebarBorder}` }} />
      </div>
      <div style={{
        maxWidth: "80%",
        background: "#d8ffddb0",
        border: `0.5px solid ${C.borderLight}`,
        borderRadius: "3px 12px 12px 12px",
        padding: "11px 15px",
        fontSize: 14, lineHeight: 1.75,
        color: C.textPrimary,
        whiteSpace: "pre-wrap", textAlign: "justify", wordBreak: "break-word",
      }}>
        {loading ? (
          <span style={{ color: C.textMuted }}>
            Analysing forecast data
            <span style={{ display: "inline-flex", gap: 3, marginLeft: 4 }}>
              {[0, 1, 2].map(i => (
                <span key={i} style={{
                  width: 5, height: 5, borderRadius: "50%",
                  background: C.jungleTeal, display: "inline-block",
                  animation: "pulse 1.2s ease-in-out infinite",
                  animationDelay: `${i * 0.2}s`,
                }} />
              ))}
            </span>
          </span>
        ) : text}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AIInsights() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hi! I'm the FEEDS AI analyst. I can help anyone — clients, researchers, or staff — understand food bank demand forecasts and what's driving them.\n\nWhat would you like to know?",
    },
  ]);
  const [input,        setInput]        = useState("");
  const [loading,      setLoading]      = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [confPct,      setConfPct]      = useState(null);
  const [confLabel,    setConfLabel]    = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/model_summary").then(r => r.json()),
      fetch("/api/gap").then(r => r.json()),
    ])
      .then(([summary, gapData]) => {
        setSystemPrompt(buildSystemPrompt(summary, gapData));
        setConfPct(summary?.confidence_pct ?? null);
        setConfLabel(summary?.confidence_label ?? null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text) {
    const userText = (text || input).trim();
    if (!userText || loading) return;
    setInput("");

    const newMessages = [...messages, { role: "user", content: userText }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: systemPrompt,
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      const reply = data.content?.map(b => b.text || "").join("") || "Sorry, I couldn't generate a response.";
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Error reaching the AI service. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  const pillConf = confPct !== null ? `${confPct}% confidence` : "loading…";

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: C.pageBg, fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>

      {/* Header */}
      <header style={{ padding: "32px 28px 20px", background: C.pageBg, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 25, fontWeight: 700, color: C.forestGreen, marginBottom: 5 }}>
              AI insights
            </div>
            <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.5 }}>
              Ask anything about food bank demand, forecasts, or what's driving signals this month · open to everyone
            </div>
          </div>
          {/* Public badge */}
          <div style={{
            display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
            padding: "6px 12px", borderRadius: 8, marginTop: 4,
            background: C.surfaceGreen, border: `0.5px solid ${C.borderLight}`,
            fontSize: 12, fontWeight: 500, color: C.textSecondary,
          }}>
            <i className="ti ti-world" style={{ fontSize: 15, color: C.jungleTeal }} aria-hidden="true" />
            Public access
          </div>
        </div>

        {/* Model context pills */}
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          {[
            {
              icon: "building", label: "Provincial model",
              detail: pillConf,
              color: C.jungleTeal, bg: C.surfaceGreen,
            },
            {
              icon: "map-2", label: "Regional model",
              detail: "not yet trained",
              color: "#5588c7", bg: C.surfaceBlue,
            },
            {
              icon: "calendar", label: "Jun 2026",
              detail: "Current period",
              color: C.textSecondary, bg: C.surfaceRed,
            },
          ].map(p => (
            <div key={p.label} style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "6px 12px", borderRadius: 8,
              background: p.bg, border: `0.5px solid ${C.borderLight}`,
              fontSize: 12,
            }}>
              <i className={`ti ti-${p.icon}`} style={{ fontSize: 15, color: p.color }} aria-hidden="true" />
              <span style={{ fontWeight: 500, color: C.textPrimary }}>{p.label}</span>
              <span style={{ color: C.textMuted }}>· {p.detail}</span>
            </div>
          ))}
        </div>
      </header>

      {/* Suggested prompts — only on first load */}
      {messages.length === 1 && (
        <div style={{ padding: "0 28px 18px", flexShrink: 0 }}>
          <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Suggested questions
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {SUGGESTED.map(s => (
              <button
                key={s}
                onClick={() => send(s)}
                style={{
                  padding: "6px 13px", fontSize: 13, borderRadius: 20, cursor: "pointer",
                  background: C.surfaceLight, color: C.textSecondary,
                  border: `0.5px solid ${C.borderLight}`,
                  fontFamily: "inherit",
                  transition: "background 0.12s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = C.teaGreen}
                onMouseLeave={e => e.currentTarget.style.background = C.surfaceLight}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Divider */}
      <div style={{ height: "0.5px", background: C.borderLight, flexShrink: 0, margin: "0 28px" }} />

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}>
        {messages.map((m, i) =>
          m.role === "user"
            ? <UserBubble key={i} text={m.content} />
            : <AssistantBubble key={i} text={m.content} />
        )}
        {loading && <AssistantBubble loading />}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div style={{
        padding: "14px 28px 20px",
        background: C.surfaceLight,
        borderTop: `1px solid ${C.borderLight}`,
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
            placeholder="Ask about demand, forecasts, supply gaps, or what's driving signals…"
            style={{
              flex: 1, padding: "10px 15px", fontSize: 13,
              border: `1px solid ${C.borderLight}`, borderRadius: 10,
              outline: "none", background: C.surfaceWhite,
              color: C.textPrimary, fontFamily: "inherit",
            }}
            aria-label="Chat input"
          />
          <button
            onClick={() => send()}
            disabled={loading || !input.trim()}
            style={{
              width: 40, height: 40, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: loading || !input.trim() ? C.surfaceGreen : C.forestGreen,
              color: loading || !input.trim() ? C.textMuted : C.teaGreen,
              border: `1px solid ${C.borderLight}`,
              borderRadius: 10, cursor: loading || !input.trim() ? "default" : "pointer",
              transition: "background 0.15s",
            }}
            aria-label="Send message"
          >
            <i className="ti ti-send" style={{ fontSize: 16 }} aria-hidden="true" />
          </button>
        </div>
        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 8 }}>
          Responses are grounded in live model data · monthly forecasts only · not raw operational figures
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40%            { opacity: 1;   transform: scale(1);   }
        }
      `}</style>
    </div>
  );
}
