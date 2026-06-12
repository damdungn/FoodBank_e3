import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { API_BASE } from "./config";

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
  borderDark:   "#254f2c",
  textPrimary:  "#1a2e22",
  textSecondary:"#4a6355",
  textMuted:    "#556b5f",
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

  return `You are the AI assistant for FEEDS (Forecasting Engine for Estimating Demand and Supply), an AI-powered forecasting platform built by a team of University of Alberta students in partnership with Food Banks Alberta and Red Deer Food Bank.

You are publicly accessible — you help anyone who visits the FEEDS website: community members, donors, volunteers, food bank staff, researchers, or people who are curious about food insecurity in Alberta. Keep answers warm, clear, and jargon-free. Provide more detail only when someone asks for it.

About FEEDS:
- FEEDS uses AI to help food banks predict future demand and supply before it happens, so they can plan ahead instead of reacting
- It combines food bank operational data with external signals: rising food prices, housing costs, government benefit schedules, weather, and more
- The goal is to give food bank staff earlier, more accurate warnings — so they can prepare the right amount of food, schedule volunteers, and serve more families

FEEDS currently has two trained models:

MODEL 1 — Provincial model (Food Banks Alberta):
- Forecasts monthly inbound food donations and outbound food distribution for the provincial hub
- Training data: Jan 2022 – May 2026 (monthly aggregates)
- Key external features: Food & shelter CPI, unemployment rate, net migration, AISH caseload, government benefit payment days (CCB, GST, CPP, OAS), weather (temperature, precipitation, snowfall), stat holidays, school calendar, Ramadan, exam season
- Forecast confidence (demand/distribution): ${confPct}% (${confLabel}) — explains ${r2OutPct}% of monthly variation. Typical error: ±${mOut.smape ?? "?"}%
- Forecast confidence (donations): ${r2InPct}% — donations are harder to predict; treat as a directional signal
- This helps Food Banks Alberta decide how much food to allocate across Alberta and when to run donor outreach campaigns

MODEL 2 — Regional model (Red Deer Food Bank):
- Forecasts monthly hamper demand at Red Deer Food Bank
- Training data: 2011–2026 (15-year window)
- Key features: AISH caseload, Food & shelter CPI, school calendar
- Confidence: 82.3% — helps Red Deer staff plan staffing, food packaging, and storage month by month
- This is the longest-running dataset in the project and captures long-term trends in community need

Models in progress:
- Edmonton Food Bank: research partner, dataset integration pending
- University of Alberta Campus Food Bank: dataset received (May 2023 – Apr 2026), model under development — campus demand is driven more by academic calendar events (exam periods, tuition deadlines, international student arrivals)

3-month supply-demand gap forecast (provincial):
${gapLines}
  - Positive = surplus (donations exceed distribution); Negative = shortfall (demand exceeds supply)

Historical gap context:
- Mean monthly gap: ${Math.round((gapStats.mean_gap ?? 0) / 1000)}K lbs (${(gapStats.mean_gap ?? 0) < 0 ? "chronic deficit on average" : "surplus on average"})
- ${gapStats.pct_deficit ?? "?"}% of months historically run a supply deficit
- Warning threshold: gap below ${Math.round((gapStats.warn_threshold ?? 0) / 1000)}K lbs/month
- Critical threshold: gap below ${Math.round((gapStats.critical_threshold ?? 0) / 1000)}K lbs/month

Key findings from this research:
- Economic conditions are the strongest driver of food bank demand — rising food prices, shelter costs, and income-support caseloads all matter
- AISH caseload changes often appear before demand increases, giving food banks a useful early-warning window
- Adding external features significantly outperforms models that only use historical trends
- Different food banks have different drivers: economic conditions dominate provincial and regional models, while campus food banks are more tied to the academic calendar

Guidelines:
- Be warm and approachable — many visitors may be community members or people seeking food support
- Be concise; use bullet points for multi-part answers
- For someone asking about visiting a food bank: give practical plain-language advice; note that the model forecasts monthly trends, not specific daily hours
- Never fabricate numbers not listed above — say "that information isn't in the current model" instead
- Be honest about uncertainty — forecasts have error margins and 80% prediction intervals mean 1 in 5 outcomes falls outside them
- If asked something outside your scope, say so clearly and suggest what FEEDS can help with`;
}

const DEFAULT_SYSTEM_PROMPT = buildSystemPrompt(null, null);

const SUGGESTED = [
  "Why are more people using food banks lately?",
  "What is FEEDS and how does it help food banks?",
  "Is food bank demand expected to go up or down soon?",
  "What causes food bank demand to spike?",
  "How can I support food banks in Alberta?",
];

// ── Bubble components ─────────────────────────────────────────────────────────

function UserBubble({ text, isMobile }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
      <div style={{
        maxWidth: isMobile ? "88%" : "72%",
        background: C.jungleTeal,
        color: "#fdfffd",
        borderRadius: "12px 12px 3px 12px",
        padding: "10px 15px",
        fontSize: 13,
        lineHeight: 1.65,
        textAlign: "justify",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        border: `0.5px solid ${C.borderLight}`,
      }}>
        {text}
      </div>
    </div>
  );
}

function AssistantBubble({ text, loading, isMobile }) {
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
        maxWidth: isMobile ? "90%" : "80%",
        background: "#d8ffddb0",
        border: `0.5px solid ${C.borderDark}`,
        borderRadius: "3px 12px 12px 12px",
        padding: "11px 15px",
        fontSize: 14, lineHeight: 1.75,
        color: C.textPrimary,
        wordBreak: "break-word",
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
        ) : (
          <ReactMarkdown
            components={{
              p:      ({ children }) => <p style={{ margin: "0 0 8px" }}>{children}</p>,
              ul:     ({ children }) => <ul style={{ margin: "4px 0 8px", paddingLeft: 20 }}>{children}</ul>,
              ol:     ({ children }) => <ol style={{ margin: "4px 0 8px", paddingLeft: 20 }}>{children}</ol>,
              li:     ({ children }) => <li style={{ marginBottom: 3 }}>{children}</li>,
              strong: ({ children }) => <strong style={{ color: C.forestGreen }}>{children}</strong>,
              em:     ({ children }) => <em style={{ color: C.textSecondary }}>{children}</em>,
              code:   ({ children }) => (
                <code style={{
                  background: "#e8f5e2", borderRadius: 4,
                  padding: "1px 5px", fontSize: 12, fontFamily: "monospace",
                }}>{children}</code>
              ),
              h3: ({ children }) => <p style={{ fontWeight: 700, color: C.forestGreen, margin: "8px 0 4px" }}>{children}</p>,
              h4: ({ children }) => <p style={{ fontWeight: 600, color: C.textSecondary, margin: "6px 0 3px" }}>{children}</p>,
            }}
          >
            {text}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AIInsights() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hi! I'm the FEEDS AI analyst. I can help anyone (clients, researchers, or staff) who understand food bank demand forecasts and what's driving them.\n\nWhat would you like to know?",
    },
  ]);
  const [input,        setInput]        = useState("");
  const [loading,      setLoading]      = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [confPct,      setConfPct]      = useState(null);
  const [confLabel,    setConfLabel]    = useState(null);
  const [isMobile,     setIsMobile]     = useState(() => window.innerWidth < 768);
  const bottomRef = useRef(null);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/model_summary`).then(r => r.json()),
      fetch(`${API_BASE}/api/gap`).then(r => r.json()),
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
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt,
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Server error");
      setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: `Error: ${err.message}` }]);
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

      {/* On mobile: header + suggested + messages all scroll together.
          On desktop: display:contents is transparent — children behave as direct flex items. */}
      <div style={isMobile ? { flex: 1, overflowY: "auto" } : { display: "contents" }}>

      {/* Header */}
      <header style={{ padding: isMobile ? "16px 14px 14px" : "32px 28px 20px", background: C.pageBg, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 8 : 0 }}>
          <div>
            <div style={{ fontSize: isMobile ? 20 : 25, fontWeight: 700, color: C.forestGreen, marginBottom: 5 }}>
              AI insights
            </div>
            <div style={{ fontSize: isMobile ? 13 : 15, color: C.textMuted, lineHeight: 1.5 }}>
              Ask anything about food bank demand, forecasts, or what's driving signals this month
            </div>
          </div>
          {/* Public badge */}
          {!isMobile && (
            <div style={{
              display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
              padding: "6px 12px", borderRadius: 8, marginTop: 4, marginRight: 50,
              background: C.surfaceGreen, border: `0.5px solid ${C.borderLight}`,
              fontSize: 14, fontWeight: 500, color: C.textSecondary,
            }}>
              <i className="ti ti-world" style={{ fontSize: 15, color: C.jungleTeal }} aria-hidden="true" />
              Public access
            </div>
          )}
        </div>

        {/* Model context pills */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
          {[
            {
              icon: "building", label: "Provincial model",
              detail: "Food Banks Alberta",
              color: C.jungleTeal, bg: C.surfaceGreen,
            },
            {
              icon: "map-2", label: "Regional model",
              detail: "Red Deer Food Bank",
              color: "#5588c7", bg: C.surfaceBlue,
            },
            {
              icon: "calendar", label: "June 2026",
              detail: "Current period",
              color: C.textSecondary, bg: C.surfaceRed,
            },
          ].map(p => (
            <div key={p.label} style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "6px 12px", borderRadius: 8,
              background: p.bg, border: `0.5px solid ${C.borderLight}`,
              fontSize: isMobile ? 12 : 14,
            }}>
              <i className={`ti ti-${p.icon}`} style={{ fontSize: 15, color: p.color }} aria-hidden="true" />
              <span style={{ fontWeight: 500, color: C.textPrimary }}>{p.label}</span>
              {!isMobile && <span style={{ color: C.textMuted }}>· {p.detail}</span>}
            </div>
          ))}
        </div>
      </header>

      {/* Suggested prompts — only on first load */}
      {messages.length === 1 && (
        <div style={{ padding: isMobile ? "0 14px 14px" : "0 28px 18px", flexShrink: 0 }}>
          <div style={{ fontSize: 14, color: C.textMuted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Suggested questions
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {SUGGESTED.map(s => (
              <button
                key={s}
                onClick={() => send(s)}
                style={{
                  padding: "6px 13px", fontSize: 14, borderRadius: 20, cursor: "pointer",
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
      <div style={{ height: "0.5px", background: C.borderLight, flexShrink: 0, margin: isMobile ? "0 14px" : "0 28px" }} />

      {/* Messages */}
      <div style={{ flex: isMobile ? undefined : 1, overflowY: isMobile ? undefined : "auto", padding: isMobile ? "16px 14px" : "20px 28px" }}>
        {messages.map((m, i) =>
          m.role === "user"
            ? <UserBubble key={i} text={m.content} isMobile={isMobile} />
            : <AssistantBubble key={i} text={m.content} isMobile={isMobile} />
        )}
        {loading && <AssistantBubble loading isMobile={isMobile} />}
        <div ref={bottomRef} />
      </div>

      </div>{/* end mobile scroll wrapper */}

      {/* Input bar */}
      <div style={{
        padding: isMobile ? "12px 14px 16px" : "14px 28px 20px",
        background: "#3a8565",
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
              flex: 1, padding: "10px 15px", fontSize: 14,
              border: `1px solid ${C.borderLight}`, borderRadius: 10,
              outline: "none", background: C.surfaceGreen,
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
            <i className="ti ti-send" style={{ fontSize: 18 }} aria-hidden="true" />
          </button>
        </div>
        <div style={{ fontSize: 12, color: "#cef9e4", marginTop: 8 }}>
          AI insights powered by OpenAI GPT-4 model · Monthly forecasts only · Cannot provide raw operational figures
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
