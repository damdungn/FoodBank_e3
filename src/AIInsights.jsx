import { useState, useRef, useEffect } from "react";

const C = {
  teal600: "#0F6E56", teal400: "#1D9E75", teal50: "#E1F5EE", teal100: "#9FE1CB",
  coral600: "#993C1D", coral50: "#FAECE7",
  gray50: "#F1EFE8", gray600: "#5F5E5A",
};

const SYSTEM_PROMPT = `You are the AI analyst for FoodBank AI, an early-warning system for the Edmonton Food Bank provincial hub in Alberta, Canada.

You help staff and leadership understand demand forecasts and supply planning. You have access to a dataset with:
- Daily inbound/outbound volumes from 2021 to May 2026
- External features: CPI (food, shelter, all-items), unemployment rate, net migration, AISH caseload, CCB/GST/CPP/OAS payment dates, school calendar, weather (mean/min/max temp, precipitation), stat/religious/cultural holidays, Ramadan, COVID periods, tax season, tuition deadlines, ACWB/ACFB/NLDB disbursements

The model uses XGBoost + Prophet for prediction. Current model confidence: 84%.

Current June 2026 snapshot:
- Demand signal: Elevated (next 30 days)
- Donation trend: +12% vs last month  
- Supply-demand gap: Moderate (needs attention)
- Top factors: CPI food (88%), unemployment rate (74%), AISH caseload (61%), school in session (43%), CCB dates (38%), mean temperature (27%)
- 30-day outlook: Week 1-2 at +14% above avg, Week 3 at +8%, Week 4 near baseline

Respond concisely and practically. Use bullet points for recommendations. Flag if a question is outside your data scope. Never fabricate specific numbers you don't have — say "model data not shown here" instead.`;

const SUGGESTED = [
  "Why is demand elevated this June?",
  "What should we recommend for regional allocation this month?",
  "How does AISH disbursement timing affect walk-ins?",
  "Which features most drove demand growth since 2023?",
  "What days of the week typically see the highest outbound?",
];

function UserBubble({ text }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
      <div style={{
        maxWidth: "72%", background: C.teal600, color: "#fff",
        borderRadius: "12px 12px 3px 12px", padding: "10px 14px", fontSize: 13, lineHeight: 1.6,
      }}>{text}</div>
    </div>
  );
}

function AssistantBubble({ text, loading }) {
  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "flex-start" }}>
      <div style={{
        width: 28, height: 28, flexShrink: 0,
        background: C.teal600, borderRadius: 7,
        display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1,
      }}>
        <svg width="13" height="13" viewBox="0 0 15 15" fill="none" aria-hidden="true">
          <path d="M7.5 1.5L13.5 5V10L7.5 13.5L1.5 10V5L7.5 1.5Z" stroke="white" strokeWidth="1.4" strokeLinejoin="round"/>
          <circle cx="7.5" cy="7.5" r="1.8" fill="white"/>
        </svg>
      </div>
      <div style={{
        maxWidth: "80%", background: "#fff", border: "0.5px solid #e5e5e2",
        borderRadius: "3px 12px 12px 12px", padding: "10px 14px",
        fontSize: 13, lineHeight: 1.7, color: "#222", whiteSpace: "pre-wrap",
      }}>
        {loading
          ? <span style={{ color: "#aaa" }}>Analysing forecast data<span className="dots">...</span></span>
          : text}
      </div>
    </div>
  );
}

export default function AIInsights() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hello! I'm the FoodBank AI analyst. I can help you interpret demand forecasts, understand what's driving signals this month, and plan allocation across the province. What would you like to explore?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text) {
    const userText = text || input.trim();
    if (!userText || loading) return;
    setInput("");

    const newMessages = [...messages, { role: "user", content: userText }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const apiMessages = newMessages.map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: apiMessages,
        }),
      });

      const data = await res.json();
      const reply = data.content?.map((b) => b.text || "").join("") || "Sorry, I couldn't generate a response.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", content: "Error reaching the AI service. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ padding: "16px 24px", borderBottom: "0.5px solid #e5e5e2", background: "#fff", flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>AI insights</div>
        <div style={{ fontSize: 11, color: "#888" }}>Ask questions about demand forecasts, drivers, and allocation</div>
      </div>

      {/* Suggested prompts — show only at start */}
      {messages.length === 1 && (
        <div style={{ padding: "14px 24px", borderBottom: "0.5px solid #e5e5e2", background: "#fafaf8", flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: "#aaa", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Suggested</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {SUGGESTED.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                style={{
                  padding: "5px 11px", fontSize: 12, borderRadius: 20,
                  background: C.teal50, color: C.teal600,
                  border: `0.5px solid ${C.teal100}`, cursor: "pointer",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
        {messages.map((m, i) =>
          m.role === "user"
            ? <UserBubble key={i} text={m.content} />
            : <AssistantBubble key={i} text={m.content} />
        )}
        {loading && <AssistantBubble loading />}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: "12px 24px", borderTop: "0.5px solid #e5e5e2",
        background: "#fff", flexShrink: 0,
        display: "flex", gap: 10,
      }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="Ask about demand drivers, allocation, or forecast trends…"
          style={{
            flex: 1, padding: "9px 14px", fontSize: 13,
            border: "0.5px solid #ddd", borderRadius: 8, outline: "none",
            background: "#fafaf8",
          }}
          aria-label="Chat input"
        />
        <button
          onClick={() => send()}
          disabled={loading || !input.trim()}
          style={{
            padding: "9px 16px", fontSize: 13, fontWeight: 500,
            background: loading || !input.trim() ? "#f1efe8" : C.teal600,
            color: loading || !input.trim() ? "#bbb" : "#fff",
            border: "none", borderRadius: 8, cursor: loading || !input.trim() ? "default" : "pointer",
          }}
          aria-label="Send message"
        >
          <i className="ti ti-send" style={{ fontSize: 15 }} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
