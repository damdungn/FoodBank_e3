import { useState, useEffect } from "react";
import Dashboard     from "./Dashboard";
import ClientOutlook from "./ClientOutlook";
import Provincial    from "./Provincial";
import Regional      from "./Regional";
import AIInsights    from "./AIInsights";
import AboutFeeds    from "./AboutFeeds";

const C = {
  sidebarBg:      "#224433",
  sidebarBorder:  "#1a3328",
  sidebarHover:   "#2d5a42",
  activeItemBg:   "#d0efb1",
  activeItemText: "#1a2e22",
  inactiveText:   "#bbe7cd",
  sectionLabel:   "#7bb782",
  teaGreen:       "#d0efb1",
  lockedText:     "#6a9e80",
};

const PASSWORDS = {
  "provincial":     import.meta.env.VITE_PROVINCIAL_PASS,
  "regional-rdfb":  import.meta.env.VITE_RDFB_PASS,
  "regional-campus":import.meta.env.VITE_CAMPUS_PASS,
};

const NAV = [
  {
    section: "Overview",
    items: [
      { icon: "layout-dashboard", label: "Home",       page: "dashboard"      },
      { icon: "map-pin",          label: "Client outlook",  page: "client-outlook"},
      { icon: "brain",            label: "AI insights",     page: "ai-insights"    },
      { icon: "info-circle",     label: "About FEEDS",     page: "about-feeds"    },
    ],
  },
  {
    section: "Analysis",
    items: [
      { icon: "building",   label: "Provincial", page: "provincial" },
      { icon: "map-2",      label: "Regional",   page: "regional"   },
    ],
  },
  {
    section: "Coming soon",
    items: [
      { icon: "file-text", label: "Reports", page: "reports", disabled: true },
      { icon: "file-text", label: "Inventory Checkup", page: "reports", disabled: true },
      { icon: "file-text", label: "Donor Alerts", page: "reports", disabled: true },
    ],
  },
];

// ── Password modal ────────────────────────────────────────────────────────────
function PasswordModal({ targetPage, onSuccess, onClose }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const isProvincial = targetPage === "provincial";
  const label = isProvincial ? "Provincial staff" : "Regional staff";

  function attempt() {
    if (targetPage === "provincial" && input === PASSWORDS["provincial"]) {
      onSuccess("provincial");
      return;
    }
    if (targetPage === "regional") {
      if (input === PASSWORDS["regional-rdfb"])   { onSuccess("regional-rdfb");   return; }
      if (input === PASSWORDS["regional-campus"])  { onSuccess("regional-campus");  return; }
    }
    setError(true);
    setShake(true);
    setInput("");
    setTimeout(() => setShake(false), 500);
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(20, 35, 25, 0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        backdropFilter: "blur(3px)",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 16, padding: "32px 24px",
          width: "min(380px, calc(100vw - 32px))",
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
          animation: shake ? "shake 0.4s ease" : "none",
          boxSizing: "border-box",
        }}
      >
        {/* Icon + label */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, flexShrink: 0,
            background: isProvincial ? "#f2f9ec" : "#eef3fb",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <i
              className={`ti ti-${isProvincial ? "building" : "map-2"}`}
              style={{ fontSize: 22, color: isProvincial ? "#224433" : "#5588c7" }}
              aria-hidden="true"
            />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#1a2e22" }}>
              {label} access
            </div>
            <div style={{ fontSize: 12, color: "#7a9485", marginTop: 2 }}>
              {isProvincial ? "Provincial model · allocation data" : "Regional model · client data"}
            </div>
          </div>
        </div>

        <div style={{ fontSize: 13, color: "#7a9485", marginBottom: 20, lineHeight: 1.5 }}>
          This section contains operational data and model details restricted to
          authorised <strong style={{ color: "#4a6355" }}>{label.toLowerCase()}</strong>.
        </div>

        <input
          type="password"
          value={input}
          onChange={e => { setInput(e.target.value); setError(false); }}
          onKeyDown={e => e.key === "Enter" && attempt()}
          placeholder={`Enter ${label.toLowerCase()} password`}
          autoFocus
          style={{
            width: "100%", padding: "10px 14px", fontSize: 16,
            border: `1.5px solid ${error ? "#e88080" : "#dde8d8"}`,
            borderRadius: 8, outline: "none", marginBottom: 8,
            background: error ? "#fff5f5" : "#fbfcf6",
            color: "#1a2e22", fontFamily: "inherit",
            boxSizing: "border-box",
          }}
        />
        {error && (
          <div style={{ fontSize: 12, color: "#c04040", marginBottom: 10 }}>
            Incorrect password. Please try again.
          </div>
        )}

        <button
          onClick={attempt}
          style={{
            width: "100%", padding: "10px", fontSize: 15, fontWeight: 600,
            background: isProvincial ? "#224433" : "#5588c7",
            color: isProvincial ? "#d0efb1" : "#fff",
            border: "none", borderRadius: 8, cursor: "pointer",
            marginTop: error ? 0 : 8, fontFamily: "inherit",
          }}
        >
          Unlock {label.toLowerCase()} access
        </button>
      </div>

      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%      { transform: translateX(-8px); }
          40%      { transform: translateX(8px); }
          60%      { transform: translateX(-5px); }
          80%      { transform: translateX(5px); }
        }
      `}</style>
    </div>
  );
}

// ── Placeholder ───────────────────────────────────────────────────────────────
function Placeholder({ title }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      height: "100%", flexDirection: "column", gap: 12, background: "#fbfcf6",
    }}>
      <i className="ti ti-hammer" style={{ fontSize: 36, color: "#ccc" }} aria-hidden="true" />
      <div style={{ fontSize: 15, fontWeight: 500, color: "#999" }}>{title}</div>
      <div style={{ fontSize: 13, color: "#bbb" }}>Coming soon</div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [page,        setPage]        = useState("dashboard");
  const [showModal,   setShowModal]   = useState(false);
  const [pendingPage, setPendingPage] = useState(null);
  const [isMobile,    setIsMobile]    = useState(() => window.innerWidth < 768);
  const [menuOpen,    setMenuOpen]    = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Track which pages are unlocked independently
  const [unlocked, setUnlocked] = useState({
    provincial:      false,
    "regional-rdfb":   false,
    "regional-campus": false,
  });

  function isLocked(p) {
    if (p === "provincial") return !unlocked.provincial;
    if (p === "regional")   return !unlocked["regional-rdfb"] && !unlocked["regional-campus"];
    return false;
  }

  function isActivePage(itemPage) {
    if (itemPage === "regional") return page === "regional-rdfb" || page === "regional-campus";
    return page === itemPage;
  }

  function handleNavClick(item) {
    if (item.disabled) return;
    setMenuOpen(false);
    if (item.page === "regional") {
      if (unlocked["regional-rdfb"])   { setPage("regional-rdfb");   return; }
      if (unlocked["regional-campus"]) { setPage("regional-campus"); return; }
      setPendingPage("regional");
      setShowModal(true);
      return;
    }
    if (isLocked(item.page)) {
      setPendingPage(item.page);
      setShowModal(true);
    } else {
      setPage(item.page);
    }
  }

  function handleUnlock(unlockedPage) {
    setUnlocked(prev => ({ ...prev, [unlockedPage]: true }));
    setShowModal(false);
    setPendingPage(null);
    setPage(unlockedPage);
  }

  function handleLock(targetPage) {
    setUnlocked(prev => ({ ...prev, [targetPage]: false }));
    if (page === targetPage) setPage("dashboard");
  }

  function renderPage() {
    switch (page) {
      case "dashboard":      return <Dashboard onNavigate={p => handleNavClick({ page: p })} />;
      case "client-outlook": return <ClientOutlook />;
      case "ai-insights":    return <AIInsights />;
      case "about-feeds":    return <AboutFeeds />;
      // "provincial" is handled by the always-mounted div below
      case "regional-rdfb":  return <Regional defaultBank="rdfb"   lockedBank="rdfb" />;
      case "regional-campus":return <Regional defaultBank="campus" lockedBank="campus" />;
      default:               return <Placeholder title={NAV.flatMap(s => s.items).find(i => i.page === page)?.label || page} />;
    }
  }

  // ── Shared nav items renderer (used by both sidebar and mobile drawer) ──
  function NavItems() {
    return NAV.map((sec) => (
      <div key={sec.section} style={{ marginBottom: 6 }}>
        <div style={{
          fontSize: 11, fontWeight: 600, color: C.sectionLabel,
          letterSpacing: "0.09em", textTransform: "uppercase",
          padding: "10px 8px 5px",
        }}>
          {sec.section}
        </div>
        {sec.items.map((item) => {
          const active   = isActivePage(item.page);
          const locked   = isLocked(item.page);
          const disabled = item.disabled;
          const lockColor = item.page === "provincial" ? "#7bb782" : "#7899c7";
          return (
            <button
              key={item.label}
              onClick={() => handleNavClick(item)}
              disabled={disabled}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                width: "100%", padding: "8px 10px",
                borderRadius: 8, marginBottom: 2,
                fontSize: 15, cursor: disabled ? "default" : "pointer",
                border: "none",
                background: active ? C.activeItemBg : "transparent",
                color: disabled ? C.lockedText : active ? C.activeItemText : C.inactiveText,
                fontWeight: active ? 600 : 400,
                textAlign: "left",
                opacity: disabled ? 0.5 : 1,
                transition: "background 0.15s, color 0.15s",
                fontFamily: "inherit",
              }}
              onMouseEnter={e => { if (!active && !disabled) e.currentTarget.style.background = C.sidebarHover; }}
              onMouseLeave={e => { if (!active && !disabled) e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <i className={`ti ti-${item.icon}`} style={{ fontSize: 15 }} aria-hidden="true" />
                {item.label}
              </span>
              {locked && <i className="ti ti-lock" style={{ fontSize: 12, color: lockColor, opacity: 0.9 }} aria-hidden="true" />}
              {!locked && (item.page === "provincial" || item.page === "regional") && (
                <i className="ti ti-lock-open" style={{ fontSize: 12, color: C.teaGreen, opacity: 0.7 }} aria-hidden="true" />
              )}
              {disabled && <span style={{ fontSize: 10, color: C.lockedText, fontWeight: 500 }}>Soon</span>}
            </button>
          );
        })}
      </div>
    ));
  }

  function NavFooter() {
    return (
      <div style={{ padding: "12px 10px 16px", borderTop: `1px solid ${C.sidebarBorder}` }}>
        {(unlocked.provincial || unlocked["regional-rdfb"] || unlocked["regional-campus"]) && (
          <div style={{ marginBottom: 10 }}>
            {unlocked.provincial && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px 5px 10px", marginBottom: 4, background: "rgba(255,255,255,0.06)", borderRadius: 6 }}>
                <i className="ti ti-shield-check" style={{ fontSize: 12, color: C.teaGreen }} aria-hidden="true" />
                <span style={{ fontSize: 13, color: C.teaGreen, flex: 1 }}>Provincial unlocked</span>
                <button onClick={() => handleLock("provincial")} style={{ fontSize: 12, color: C.lockedText, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontFamily: "inherit" }}>Lock</button>
              </div>
            )}
            {unlocked["regional-rdfb"] && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px 5px 10px", marginBottom: 4, background: "rgba(255,255,255,0.06)", borderRadius: 6 }}>
                <i className="ti ti-shield-check" style={{ fontSize: 12, color: "#9ab8e8" }} aria-hidden="true" />
                <span style={{ fontSize: 13, color: "#9ab8e8", flex: 1 }}>Red Deer unlocked</span>
                <button onClick={() => handleLock("regional-rdfb")} style={{ fontSize: 12, color: C.lockedText, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontFamily: "inherit" }}>Lock</button>
              </div>
            )}
            {unlocked["regional-campus"] && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px 5px 10px", background: "rgba(255,255,255,0.06)", borderRadius: 6 }}>
                <i className="ti ti-shield-check" style={{ fontSize: 12, color: "#9ab8e8" }} aria-hidden="true" />
                <span style={{ fontSize: 13, color: "#9ab8e8", flex: 1 }}>Campus FB unlocked</span>
                <button onClick={() => handleLock("regional-campus")} style={{ fontSize: 12, color: C.lockedText, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontFamily: "inherit" }}>Lock</button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{
      display: "flex",
      flexDirection: isMobile ? "column" : "row",
      height: "100dvh", margin: 0, padding: 0,
      fontFamily: "'DM Sans', system-ui, sans-serif",
      background: "#fbfcf6",
      overflow: "hidden",
    }}>

      {/* ── Mobile top bar ─────────────────────────────────────── */}
      {isMobile && (
        <>
          <header style={{
            height: 56, flexShrink: 0,
            background: C.sidebarBg,
            borderBottom: `1px solid ${C.sidebarBorder}`,
            display: "flex", alignItems: "center",
            padding: "0 14px", gap: 10, zIndex: 50,
          }}>
            <img src="/logo.png" alt="FEEDS" style={{ width: 34, height: 34, borderRadius: 7, objectFit: "contain" }} />
            <span style={{ fontSize: 22, fontWeight: 800, color: C.teaGreen, flex: 1 }}>FEEDS</span>
            <button
              onClick={() => setMenuOpen(o => !o)}
              style={{
                background: menuOpen ? C.sidebarHover : "transparent",
                border: "none", cursor: "pointer", borderRadius: 8,
                padding: "6px 8px", color: C.teaGreen, lineHeight: 1,
              }}
              aria-label="Toggle menu"
            >
              <i className={`ti ti-${menuOpen ? "x" : "menu-2"}`} style={{ fontSize: 22 }} aria-hidden="true" />
            </button>
          </header>

          {/* Dropdown drawer */}
          {menuOpen && (
            <>
              {/* Backdrop */}
              <div
                onClick={() => setMenuOpen(false)}
                style={{ position: "fixed", inset: 0, top: 56, zIndex: 40, background: "rgba(0,0,0,0.35)" }}
              />
              {/* Drawer */}
              <div style={{
                position: "fixed", top: 56, left: 0, right: 0, zIndex: 45,
                background: C.sidebarBg,
                borderBottom: `1px solid ${C.sidebarBorder}`,
                maxHeight: "calc(100vh - 56px)",
                overflowY: "auto",
                animation: "drawerSlide 0.2s ease",
              }}>
                <style>{`@keyframes drawerSlide { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }`}</style>
                <nav style={{ padding: "8px 10px" }}>
                  <NavItems />
                </nav>
                <NavFooter />
              </div>
            </>
          )}
        </>
      )}

      {/* ── Desktop sidebar ────────────────────────────────────── */}
      {!isMobile && <aside style={{
        width: 250, flexShrink: 0,
        background: C.sidebarBg,
        borderRight: `1px solid ${C.sidebarBorder}`,
        display: "flex", flexDirection: "column",
      }}>

        {/* Logo */}
        <div style={{ padding: "20px 16px 18px", borderBottom: `1px solid ${C.sidebarBorder}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <img src="/logo.png" alt="FEEDS logo" style={{ width: 50, height: 50, borderRadius: 8, objectFit: "contain" }} />
            <div style={{ fontSize: 28, fontWeight: 800, color: C.teaGreen, lineHeight: 1 }}>FEEDS</div>
          </div>
          <div style={{ fontSize: 12, color: C.inactiveText, lineHeight: 1.4 }}>
            Forecasting Engine for Estimating Demand and Supply
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: "10px 8px", flex: 1, overflowY: "auto" }}>
          {NAV.map((sec) => (
            <div key={sec.section} style={{ marginBottom: 6 }}>

              <div style={{
                fontSize: 13, fontWeight: 600, color: C.sectionLabel,
                letterSpacing: "0.09em", textTransform: "uppercase",
                padding: "10px 8px 5px",
              }}>
                {sec.section}
              </div>

              {sec.items.map((item) => {
                const active   = isActivePage(item.page);
                const locked   = isLocked(item.page);
                const disabled = item.disabled;

                // Pick lock icon colour by which partner
                const lockColor = item.page === "provincial" ? "#7bb782" : "#7899c7";

                return (
                  <button
                    key={item.label}
                    onClick={() => handleNavClick(item)}
                    disabled={disabled}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      width: "100%", padding: "8px 10px",
                      borderRadius: 8, marginBottom: 2,
                      fontSize: 15, cursor: disabled ? "default" : "pointer",
                      border: "none",
                      background: active ? C.activeItemBg : "transparent",
                      color: disabled ? C.lockedText : active ? C.activeItemText : C.inactiveText,
                      fontWeight: active ? 600 : 400,
                      textAlign: "left",
                      opacity: disabled ? 0.5 : 1,
                      transition: "background 0.15s, color 0.15s",
                      fontFamily: "inherit",
                    }}
                    onMouseEnter={e => { if (!active && !disabled) e.currentTarget.style.background = C.sidebarHover; }}
                    onMouseLeave={e => { if (!active && !disabled) e.currentTarget.style.background = "transparent"; }}
                    aria-current={active ? "page" : undefined}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <i className={`ti ti-${item.icon}`} style={{ fontSize: 15 }} aria-hidden="true" />
                      {item.label}
                    </span>
                    {locked && (
                      <i className="ti ti-lock" style={{ fontSize: 12, color: lockColor, opacity: 0.9 }} aria-hidden="true" />
                    )}
                    {!locked && (item.page === "provincial" || item.page === "regional") && (
                      <i className="ti ti-lock-open" style={{ fontSize: 12, color: C.teaGreen, opacity: 0.7 }} aria-hidden="true" />
                    )}
                    {disabled && (
                      <span style={{ fontSize: 10, color: C.lockedText, fontWeight: 500 }}>Soon</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: "12px 10px 16px", borderTop: `1px solid ${C.sidebarBorder}` }}>

          {/* Session status — show each unlocked partner separately */}
          {(unlocked.provincial || unlocked["regional-rdfb"] || unlocked["regional-campus"]) && (
            <div style={{ marginBottom: 10 }}>
              {unlocked.provincial && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "5px 8px 5px 10px", marginBottom: 4,
                  background: "rgba(255,255,255,0.06)", borderRadius: 6,
                }}>
                  <i className="ti ti-shield-check" style={{ fontSize: 12, color: C.teaGreen }} aria-hidden="true" />
                  <span style={{ fontSize: 13, color: C.teaGreen, flex: 1 }}>Provincial unlocked</span>
                  <button
                    onClick={() => handleLock("provincial")}
                    style={{ fontSize: 12, color: C.lockedText, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontFamily: "inherit" }}
                  >
                    Lock
                  </button>
                </div>
              )}
              {unlocked["regional-rdfb"] && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "5px 8px 5px 10px", marginBottom: 4,
                  background: "rgba(255,255,255,0.06)", borderRadius: 6,
                }}>
                  <i className="ti ti-shield-check" style={{ fontSize: 12, color: "#9ab8e8" }} aria-hidden="true" />
                  <span style={{ fontSize: 13, color: "#9ab8e8", flex: 1 }}>Red Deer unlocked</span>
                  <button
                    onClick={() => handleLock("regional-rdfb")}
                    style={{ fontSize: 12, color: C.lockedText, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontFamily: "inherit" }}
                  >
                    Lock
                  </button>
                </div>
              )}
              {unlocked["regional-campus"] && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "5px 8px 5px 10px",
                  background: "rgba(255,255,255,0.06)", borderRadius: 6,
                }}>
                  <i className="ti ti-shield-check" style={{ fontSize: 12, color: "#9ab8e8" }} aria-hidden="true" />
                  <span style={{ fontSize: 13, color: "#9ab8e8", flex: 1 }}>Campus FB unlocked</span>
                  <button
                    onClick={() => handleLock("regional-campus")}
                    style={{ fontSize: 12, color: C.lockedText, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontFamily: "inherit" }}
                  >
                    Lock
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

      </aside>}

      {/* ── Page content ───────────────────────────────────────── */}
      <main style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        overflowX: "hidden",
        minWidth: 0,
      }}>
        {/* Provincial stays mounted after unlock so data only loads once per session */}
        {unlocked.provincial && (
          <div style={{
            display: page === "provincial" ? "flex" : "none",
            flexDirection: "column", flex: 1, overflow: "hidden", height: "100%",
          }}>
            <Provincial />
          </div>
        )}
        {page !== "provincial" && renderPage()}
      </main>

      {/* ── Password modal ──────────────────────────────────────── */}
      {showModal && (
        <PasswordModal
          targetPage={pendingPage}
          onSuccess={handleUnlock}
          onClose={() => { setShowModal(false); setPendingPage(null); }}
        />
      )}

    </div>
  );
}
