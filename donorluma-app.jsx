import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  Search, Bell, Users, TrendingUp, Target, Mail, Settings, HelpCircle, LogOut,
  ArrowUpRight, ArrowRight, Clock, ExternalLink, Sparkles,
  Building2, Heart, DollarSign, RefreshCw, ChevronRight, ChevronLeft,
  ChevronDown, ChevronUp, Zap, Eye, EyeOff, Send, PieChart, LayoutDashboard,
  MapPin, FileText, Bookmark, BookmarkCheck, AlertCircle, Info, X,
  Upload, Download, UserX, XCircle, Copy, Check,
  Edit3, CheckCircle, PenTool, User, Loader as LoaderIcon
} from "lucide-react";
import * as Papa from "papaparse";

// ══════════════════════════════════════════
//  DONORLUMA DESIGN SYSTEM — Apple Warm
// ══════════════════════════════════════════
const C = {
  // Surfaces
  bg: "#FAFAF8",
  surface: "#FFFFFF",
  surfaceHover: "#F5F4F1",
  surfaceRaised: "#FFFFFF",
  // Borders — used sparingly
  border: "rgba(0,0,0,0.06)",
  borderSubtle: "rgba(0,0,0,0.03)",
  // Text
  text: "#1D1D1F",
  textSecondary: "#6E6E73",
  textTertiary: "#AEAEB2",
  // Brand — from Vibrant Causes logo
  amber: "#E8860C",
  amberLight: "#FFF4E6",
  amberDark: "#C26A00",
  orange: "#D44A1A",
  orangeLight: "#FFF0EB",
  gold: "#F5B731",
  goldLight: "#FFFAED",
  // Semantic
  green: "#34C759",
  greenLight: "#E8FAE8",
  purple: "#AF52DE",
  purpleLight: "#F5EEFA",
  red: "#FF3B30",
  redLight: "#FFECEB",
  blue: "#007AFF",
  // Sidebar
  sidebarBg: "#1C1C1E",
  sidebarHover: "rgba(255,255,255,0.08)",
  sidebarActive: "rgba(232,134,12,0.15)",
};
const shadow = {
  sm: "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)",
  md: "0 4px 16px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.03)",
  lg: "0 12px 40px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)",
  glow: "0 0 30px rgba(232,134,12,0.15)",
};
const fmt = n => {
  if (n == null || isNaN(n)) return "—";
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Number(n).toLocaleString()}`;
};
const iStyle = {
  width: "100%", padding: "14px 18px", borderRadius: 14,
  border: `1.5px solid ${C.border}`, fontSize: 15, color: C.text,
  outline: "none", backgroundColor: C.surface, boxSizing: "border-box",
  transition: "border-color 0.2s, box-shadow 0.2s",
  fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif",
};

// ── SVG Starburst Logo ──
function StarburstLogo({ size = 32 }) {
  const rays = 16;
  const cx = 50, cy = 50;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block" }}>
      <defs>
        <radialGradient id="starGrad" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#F5B731" />
          <stop offset="40%" stopColor="#E8860C" />
          <stop offset="70%" stopColor="#D44A1A" />
          <stop offset="100%" stopColor="#B83A15" />
        </radialGradient>
        <filter id="starGlow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <g filter="url(#starGlow)">
        {Array.from({ length: rays }).map((_, i) => {
          const angle = (i / rays) * Math.PI * 2 - Math.PI / 2;
          const innerR = i % 2 === 0 ? 12 : 16;
          const outerR = i % 2 === 0 ? 38 : 30;
          const spread = Math.PI / rays * 0.45;
          const x1 = cx + Math.cos(angle - spread) * innerR;
          const y1 = cy + Math.sin(angle - spread) * innerR;
          const x2 = cx + Math.cos(angle) * outerR;
          const y2 = cy + Math.sin(angle) * outerR;
          const x3 = cx + Math.cos(angle + spread) * innerR;
          const y3 = cy + Math.sin(angle + spread) * innerR;
          return <polygon key={i} points={`${cx},${cy} ${x1},${y1} ${x2},${y2} ${x3},${y3}`} fill="url(#starGrad)" opacity={0.85 + (i % 3) * 0.05} />;
        })}
        <circle cx={cx} cy={cy} r={5} fill="#F5B731" />
        <circle cx={cx} cy={cy} r={2.5} fill="#FFDD70" />
      </g>
    </svg>
  );
}

// ── Shared Components ──
function ScoreRing({ score, size = 42 }) {
  const r = (size - 5) / 2, circ = 2 * Math.PI * r;
  const color = score >= 80 ? C.green : score >= 55 ? C.amber : score >= 30 ? C.orange : C.textTertiary;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.border} strokeWidth={2.5} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={2.5}
          strokeDasharray={circ} strokeDashoffset={circ - (score / 100) * circ} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)" }} />
      </svg>
      <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color }}>{score}</span>
    </div>
  );
}
function TierBadge({ tier }) {
  const m = { High: { c: "#1B7A3D", bg: C.greenLight }, Medium: { c: C.amberDark, bg: C.amberLight }, Low: { c: C.orange, bg: C.orangeLight }, Cold: { c: C.textTertiary, bg: "#F2F2F7" } };
  const s = m[tier] || m.Cold;
  return <span style={{ padding: "4px 12px", borderRadius: 100, fontSize: 11, fontWeight: 700, color: s.c, backgroundColor: s.bg, letterSpacing: 0.5, textTransform: "uppercase" }}>{tier}</span>;
}
function ScoreBadge({ score }) {
  const c = score >= 85 ? "#1B7A3D" : score >= 70 ? C.amberDark : C.textTertiary;
  const bg = score >= 85 ? C.greenLight : score >= 70 ? C.amberLight : "#F2F2F7";
  return <span style={{ padding: "4px 12px", borderRadius: 100, fontSize: 13, fontWeight: 700, color: c, backgroundColor: bg }}>{score}</span>;
}

// ── Persistent Storage ──
async function sGet(k, fb = null) { try { const r = await window.storage.get(k); return r ? JSON.parse(r.value) : fb; } catch { return fb; } }
async function sSet(k, v) { try { await window.storage.set(k, JSON.stringify(v)); } catch {} }
function useStore(key, init) {
  const [val, setVal] = useState(init);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { sGet(key, init).then(v => { setVal(v); setLoaded(true); }); }, []);
  const set = useCallback(v => { const next = typeof v === "function" ? v(val) : v; setVal(next); sSet(key, next); }, [key, val]);
  return [val, set, loaded];
}

// ══════════════════════════════════════════
//  AUTH SCREEN
// ══════════════════════════════════════════
function AuthScreen({ onComplete }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [mission, setMission] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderTitle, setSenderTitle] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (mode !== "onboard") { setMode("onboard"); return; }
    setLoading(true);
    const u = { name: name || email.split("@")[0], email, orgName, mission, senderName, senderTitle, createdAt: new Date().toISOString() };
    await sSet("dl-user", u);
    await sSet("dl-org", { name: orgName, mission, senderName, senderTitle });
    setTimeout(() => onComplete(u), 500);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif", backgroundColor: C.bg }}>
      {/* Left */}
      <div style={{ flex: "0 0 480px", display: "flex", flexDirection: "column", justifyContent: "center", padding: "48px 56px", backgroundColor: C.surface }}>
        <div style={{ maxWidth: 380 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 48 }}>
            <StarburstLogo size={58} />
            <div>
              <div style={{ fontSize: 30, fontWeight: 800, color: C.text, letterSpacing: -0.8 }}>DonorLuma</div>
              <div style={{ fontSize: 14, color: C.textTertiary, letterSpacing: 1, textTransform: "uppercase", fontWeight: 700, marginTop: 2 }}>by Vibrant Causes</div>
            </div>
          </div>

          {mode !== "onboard" ? (
            <>
              <h1 style={{ fontSize: 32, fontWeight: 800, margin: "0 0 8px", color: C.text, letterSpacing: -0.8, lineHeight: 1.15, fontFamily: "'Instrument Serif', Georgia, serif" }}>
                {mode === "login" ? "Welcome back." : "Start for free."}
              </h1>
              <p style={{ fontSize: 16, color: C.textSecondary, margin: "0 0 36px", lineHeight: 1.5, fontWeight: 400 }}>
                {mode === "login" ? "Sign in to your donor intelligence dashboard." : "Create your account in under a minute."}
              </p>
              {mode === "signup" && <div style={{ marginBottom: 16 }}><label style={{ fontSize: 13, fontWeight: 600, color: C.textSecondary, display: "block", marginBottom: 8 }}>Full name</label><input value={name} onChange={e => setName(e.target.value)} placeholder="Matt Akers" style={iStyle} /></div>}
              <div style={{ marginBottom: 16 }}><label style={{ fontSize: 13, fontWeight: 600, color: C.textSecondary, display: "block", marginBottom: 8 }}>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@yourorg.com" style={iStyle} /></div>
              <div style={{ marginBottom: 32 }}><label style={{ fontSize: 13, fontWeight: 600, color: C.textSecondary, display: "block", marginBottom: 8 }}>Password</label><input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••" style={iStyle} /></div>
              <button onClick={submit} disabled={!email || !pass} style={{
                width: "100%", padding: 16, borderRadius: 14, border: "none",
                background: email && pass ? `linear-gradient(135deg, ${C.amber}, ${C.orange})` : "#E5E5EA",
                color: "#fff", fontSize: 16, fontWeight: 700, cursor: email && pass ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: email && pass ? shadow.md : "none", transition: "all 0.2s",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}>{mode === "login" ? "Sign In" : "Create Account"} <ArrowRight size={18} /></button>
              <p style={{ textAlign: "center", marginTop: 24, fontSize: 14, color: C.textTertiary }}>
                {mode === "login" ? "New here?" : "Already have an account?"}{" "}
                <span onClick={() => setMode(mode === "login" ? "signup" : "login")} style={{ color: C.amber, fontWeight: 700, cursor: "pointer" }}>{mode === "login" ? "Create an account" : "Sign in"}</span>
              </p>
            </>
          ) : (
            <>
              <h1 style={{ fontSize: 32, fontWeight: 800, margin: "0 0 8px", color: C.text, letterSpacing: -0.8, fontFamily: "'Instrument Serif', Georgia, serif" }}>Tell us about your org.</h1>
              <p style={{ fontSize: 16, color: C.textSecondary, margin: "0 0 36px", lineHeight: 1.5 }}>This powers personalized prospect matching and AI outreach.</p>
              <div style={{ marginBottom: 16 }}><label style={{ fontSize: 13, fontWeight: 600, color: C.textSecondary, display: "block", marginBottom: 8 }}>Organization name</label><input value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="Hope Foundation" style={iStyle} /></div>
              <div style={{ marginBottom: 16 }}><label style={{ fontSize: 13, fontWeight: 600, color: C.textSecondary, display: "block", marginBottom: 8 }}>Mission</label><textarea value={mission} onChange={e => setMission(e.target.value)} placeholder="What does your organization do?" rows={3} style={{ ...iStyle, resize: "vertical" }} /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 32 }}>
                <div><label style={{ fontSize: 13, fontWeight: 600, color: C.textSecondary, display: "block", marginBottom: 8 }}>Your name</label><input value={senderName} onChange={e => setSenderName(e.target.value)} placeholder="Sarah Mitchell" style={iStyle} /></div>
                <div><label style={{ fontSize: 13, fontWeight: 600, color: C.textSecondary, display: "block", marginBottom: 8 }}>Title</label><input value={senderTitle} onChange={e => setSenderTitle(e.target.value)} placeholder="Dir. of Development" style={iStyle} /></div>
              </div>
              <button onClick={submit} disabled={!orgName || !mission || loading} style={{
                width: "100%", padding: 16, borderRadius: 14, border: "none",
                background: orgName && mission ? `linear-gradient(135deg, ${C.amber}, ${C.orange})` : "#E5E5EA",
                color: "#fff", fontSize: 16, fontWeight: 700, cursor: orgName && mission ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: orgName && mission ? shadow.md : "none",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}>{loading ? <><LoaderIcon size={18} className="spin" /> Setting up...</> : <>Launch DonorLuma <Sparkles size={18} /></>}</button>
              <button onClick={() => setMode("login")} style={{ display: "block", margin: "20px auto 0", fontSize: 14, color: C.textTertiary, background: "none", border: "none", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}><ChevronLeft size={14} style={{ verticalAlign: "middle" }} /> Back</button>
            </>
          )}
        </div>
      </div>

      {/* Right — Hero */}
      <div style={{ flex: 1, background: `linear-gradient(135deg, #1C1C1E 0%, #2C2C2E 40%, #1C1C1E 100%)`, display: "flex", alignItems: "center", justifyContent: "center", padding: 64, position: "relative", overflow: "hidden" }}>
        {/* Ambient glow */}
        <div style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", background: `radial-gradient(circle, rgba(232,134,12,0.12) 0%, transparent 70%)`, top: "20%", left: "30%", transform: "translate(-50%,-50%)" }} />
        <div style={{ position: "absolute", width: 300, height: 300, borderRadius: "50%", background: `radial-gradient(circle, rgba(212,74,26,0.08) 0%, transparent 70%)`, bottom: "10%", right: "10%" }} />

        <div style={{ maxWidth: 480, position: "relative", zIndex: 1 }}>
          <div style={{ marginBottom: 40 }}><StarburstLogo size={120} /></div>
          <h2 style={{ fontSize: 42, fontWeight: 800, color: "#FFFFFF", lineHeight: 1.1, letterSpacing: -1.5, margin: "0 0 20px", fontFamily: "'Instrument Serif', Georgia, serif" }}>
            Stop reacting.<br />Start strategizing.
          </h2>
          <p style={{ fontSize: 18, color: "rgba(255,255,255,0.6)", lineHeight: 1.7, margin: "0 0 44px", fontWeight: 400 }}>
            DonorLuma gives fundraisers at nonprofits and charities the donor intelligence that major institutions take for granted — at a price built for the rest of us.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {[
              { icon: Search, text: "Discover aligned foundations from IRS 990 data" },
              { icon: RefreshCw, text: "Score lapsed donors and know who to call first" },
              { icon: Sparkles, text: "Generate personalized outreach in seconds" },
            ].map((f, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(232,134,12,0.12)", border: "1px solid rgba(232,134,12,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <f.icon size={20} color={C.amber} />
                </div>
                <span style={{ fontSize: 16, color: "rgba(255,255,255,0.8)", fontWeight: 500 }}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <style>{globalCSS}</style>
    </div>
  );
}

// ══════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════
function DashboardPage({ onNav, org, prospects, scored }) {
  const pc = Object.keys(prospects).length;
  const lc = scored.filter(d => d.isLapsed).length;
  const kpis = [
    { label: "Saved Prospects", value: pc || "0", sub: pc > 0 ? `${pc} in pipeline` : "Search to start", icon: Target, color: C.amber, bg: C.amberLight },
    { label: "Lapsed Donors", value: lc || "0", sub: lc > 0 ? `${lc} scored` : "Upload a CSV", icon: RefreshCw, color: C.orange, bg: C.orangeLight },
    { label: "Grant Matches", value: "—", sub: "Coming soon", icon: Building2, color: C.purple, bg: C.purpleLight },
    { label: "Outreach Sent", value: "—", sub: "Coming soon", icon: Send, color: C.green, bg: C.greenLight },
  ];

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 36 }}>
        {kpis.map((k, i) => {
          const Icon = k.icon;
          return (
            <div key={i} onClick={() => i === 0 ? onNav("discover") : i === 1 ? onNav("lapsed") : null} style={{
              backgroundColor: C.surface, borderRadius: 20, padding: "24px 26px",
              boxShadow: shadow.sm, cursor: i < 2 ? "pointer" : "default", transition: "box-shadow 0.2s, transform 0.2s",
            }}
            onMouseEnter={e => { if (i < 2) { e.currentTarget.style.boxShadow = shadow.md; e.currentTarget.style.transform = "translateY(-2px)"; } }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = shadow.sm; e.currentTarget.style.transform = "none"; }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 10, fontWeight: 600, letterSpacing: 0.2 }}>{k.label}</div>
                  <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1.5, color: C.text, fontFamily: "'Instrument Serif', Georgia, serif" }}>{k.value}</div>
                </div>
                <div style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: k.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={22} color={k.color} />
                </div>
              </div>
              <div style={{ marginTop: 14, fontSize: 13, color: C.textTertiary, fontWeight: 500 }}>{k.sub}</div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Saved Prospects Card */}
          <div style={{ backgroundColor: C.surface, borderRadius: 20, boxShadow: shadow.sm, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 26px" }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 10 }}><Target size={18} color={C.amber} /> Saved Prospects</h3>
              <button onClick={() => onNav("discover")} style={{ fontSize: 13, padding: "8px 18px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${C.amber}, ${C.orange})`, color: "#fff", cursor: "pointer", fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{pc > 0 ? "View All" : "Search"}</button>
            </div>
            <div style={{ borderTop: `1px solid ${C.border}` }}>
              {pc === 0 ? (
                <div style={{ padding: "40px 26px", textAlign: "center" }}>
                  <Building2 size={32} color={C.textTertiary} style={{ marginBottom: 12, opacity: 0.4 }} />
                  <p style={{ color: C.textTertiary, fontSize: 14, margin: 0 }}>Search IRS 990 filings to discover foundations aligned with your mission.</p>
                </div>
              ) : Object.entries(prospects).slice(0, 5).map(([ein, p], i, arr) => (
                <div key={ein} style={{ padding: "14px 26px", borderBottom: i < arr.length - 1 ? `1px solid ${C.borderSubtle}` : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div><div style={{ fontSize: 15, fontWeight: 600 }}>{p.name || `EIN: ${ein}`}</div>{p.city && <div style={{ fontSize: 12, color: C.textTertiary, marginTop: 2 }}>{p.city}, {p.state}</div>}</div>
                  {p.revenue && <span style={{ fontSize: 14, fontWeight: 700, color: C.amber }}>{fmt(p.revenue)}</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Lapsed Donors Card */}
          <div style={{ backgroundColor: C.surface, borderRadius: 20, boxShadow: shadow.sm, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 26px" }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 10 }}><RefreshCw size={18} color={C.orange} /> Top Reactivation Candidates</h3>
              <button onClick={() => onNav("lapsed")} style={{ fontSize: 13, padding: "8px 18px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${C.amber}, ${C.orange})`, color: "#fff", cursor: "pointer", fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{lc > 0 ? "View All" : "Upload CSV"}</button>
            </div>
            <div style={{ borderTop: `1px solid ${C.border}` }}>
              {lc === 0 ? (
                <div style={{ padding: "40px 26px", textAlign: "center" }}>
                  <Upload size={32} color={C.textTertiary} style={{ marginBottom: 12, opacity: 0.4 }} />
                  <p style={{ color: C.textTertiary, fontSize: 14, margin: 0 }}>Upload a donor CSV to score lapsed donors and find who to re-engage first.</p>
                </div>
              ) : scored.filter(d => d.isLapsed).sort((a, b) => b.score - a.score).slice(0, 4).map((d, i) => (
                <div key={d._id} style={{ padding: "14px 26px", borderBottom: i < 3 ? `1px solid ${C.borderSubtle}` : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div><div style={{ fontSize: 15, fontWeight: 600 }}>{d.name}</div><div style={{ fontSize: 12, color: C.textTertiary, marginTop: 2 }}>Last gift: {d.lastGiftRaw} · {fmt(d._totalGiven)}</div></div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}><ScoreRing score={d.score} size={38} /><TierBadge tier={d.tier} /></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Quick Actions */}
          <div style={{ backgroundColor: C.surface, borderRadius: 20, boxShadow: shadow.sm, padding: 24 }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 18px" }}>Quick Actions</h3>
            {[
              { label: "Search for prospects", icon: Search, nav: "discover" },
              { label: "Upload donor list", icon: Upload, nav: "lapsed" },
              { label: "Generate outreach", icon: Sparkles, nav: "outreach" },
            ].map((a, i) => (
              <div key={i} onClick={() => onNav(a.nav)} style={{
                display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 14,
                cursor: "pointer", marginBottom: i < 2 ? 6 : 0, transition: "background 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = C.surfaceHover}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
              >
                <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.amberLight, display: "flex", alignItems: "center", justifyContent: "center" }}><a.icon size={18} color={C.amber} /></div>
                <span style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>{a.label}</span>
                <ChevronRight size={16} color={C.textTertiary} />
              </div>
            ))}
          </div>

          {/* Org Card */}
          <div style={{
            background: `linear-gradient(135deg, #1C1C1E, #2C2C2E)`,
            borderRadius: 20, padding: 28, color: "#fff", boxShadow: shadow.lg,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <StarburstLogo size={44} />
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{org?.name || "Your Organization"}</h3>
            </div>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", lineHeight: 1.7, margin: 0 }}>
              {org?.mission || "Your donor intelligence platform is ready. Search for prospects or upload a donor list to get started."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
//  PROSPECT DISCOVERY (condensed)
// ══════════════════════════════════════════
const NTEE = { A: "Arts & Culture", B: "Education", C: "Environment", D: "Animals", E: "Health Care", F: "Mental Health", G: "Diseases", H: "Medical Research", K: "Food & Agriculture", L: "Housing", N: "Recreation", O: "Youth", P: "Human Services", Q: "International", S: "Community", T: "Philanthropy", U: "Science", W: "Public Affairs" };
const SUGG = ["cancer research", "youth mentoring", "food bank", "literacy", "mental health", "animal welfare", "arts education", "veterans services", "community foundation"];
const US = ["","AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];
const API = "https://projects.propublica.org/nonprofits/api/v2";

function DiscoverPage({ prospects, setProspects }) {
  const [q, setQ] = useState(""); const [st, setSt] = useState(""); const [res, setRes] = useState(null); const [ld, setLd] = useState(false); const [err, setErr] = useState(null); const [pg, setPg] = useState(0); const [tot, setTot] = useState(0); const [det, setDet] = useState(null); const [dd, setDd] = useState(null); const [dl, setDl] = useState(false);

  const search = useCallback(async (query, state, page = 0) => { if (!query.trim()) return; setLd(true); setErr(null); setDet(null); setDd(null); try { let u = `${API}/search.json?q=${encodeURIComponent(query.trim())}`; if (state) u += `&state%5Bid%5D=${state}`; if (page > 0) u += `&page=${page}`; const r = await fetch(u); const d = await r.json(); setRes(d.organizations || []); setTot(d.total_results || 0); setPg(page); } catch (e) { setErr(e.message); } finally { setLd(false); } }, []);
  const viewOrg = useCallback(async (ein) => { setDl(true); setDet(ein); try { const r = await fetch(`${API}/organizations/${ein}.json`); setDd(await r.json()); } catch (e) { setDd({ error: e.message }); } finally { setDl(false); } }, []);
  const toggleSave = (ein, data) => setProspects(s => { const n = { ...s }; n[ein] ? delete n[ein] : n[ein] = data || { ein }; return n; });

  if (det && dd && !dd.error) {
    const o = dd.organization || {}, fl = (dd.filings_with_data || []).slice(0, 6), lf = fl[0] || {};
    return (
      <div style={{ maxWidth: 1000 }}>
        <button onClick={() => { setDet(null); setDd(null); }} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, color: C.amber, background: "none", border: "none", cursor: "pointer", marginBottom: 24, padding: 0, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif" }}><ChevronLeft size={18} /> Back</button>
        <div style={{ backgroundColor: C.surface, borderRadius: 20, boxShadow: shadow.md, padding: 32, marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: C.amberLight, display: "flex", alignItems: "center", justifyContent: "center" }}><Building2 size={26} color={C.amber} /></div>
              <div><h2 style={{ fontSize: 24, fontWeight: 800, margin: 0, fontFamily: "'Instrument Serif', Georgia, serif" }}>{o.name}</h2><p style={{ fontSize: 13, color: C.textTertiary, margin: "4px 0 0" }}>EIN: {o.ein}</p></div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => toggleSave(o.ein, { name: o.name, city: o.city, state: o.state, revenue: lf.totrevenue })} style={{ display: "flex", alignItems: "center", gap: 6, padding: "12px 20px", borderRadius: 12, border: "none", backgroundColor: prospects[o.ein] ? C.amberLight : "#F2F2F7", color: prospects[o.ein] ? C.amber : C.textSecondary, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{prospects[o.ein] ? <BookmarkCheck size={16} /> : <Bookmark size={16} />} {prospects[o.ein] ? "Saved" : "Save"}</button>
            </div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
          {[{ l: "Revenue", v: fmt(lf.totrevenue), c: C.amber, bg: C.amberLight, I: DollarSign }, { l: "Expenses", v: fmt(lf.totfuncexpns), c: C.orange, bg: C.orangeLight, I: FileText }, { l: "Assets", v: fmt(lf.totassetsend), c: C.purple, bg: C.purpleLight, I: Building2 }, { l: "Grants", v: fmt((lf.grntstogovt || 0) + (lf.grntstoindiv || 0) + (lf.grntstofrgngovt || 0)), c: C.green, bg: C.greenLight, I: Sparkles }].map((m, i) => (
            <div key={i} style={{ backgroundColor: C.surface, borderRadius: 16, boxShadow: shadow.sm, padding: "20px 22px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: m.bg, display: "flex", alignItems: "center", justifyContent: "center" }}><m.I size={17} color={m.c} /></div>
                <span style={{ fontSize: 12, color: C.textTertiary, fontWeight: 600 }}>{m.l}</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, fontFamily: "'Instrument Serif', Georgia, serif" }}>{m.v}</div>
            </div>
          ))}
        </div>
        {fl.length > 0 && <div style={{ backgroundColor: C.surface, borderRadius: 20, boxShadow: shadow.sm, overflow: "hidden" }}>
          <div style={{ padding: "20px 26px", display: "flex", alignItems: "center", gap: 10 }}><FileText size={18} color={C.amber} /><h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Filing History</h3></div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr style={{ borderTop: `1px solid ${C.border}` }}>{["Year", "Revenue", "Expenses", "Assets", "PDF"].map(h => <th key={h} style={{ fontSize: 11, fontWeight: 700, color: C.textTertiary, textAlign: "left", padding: "12px 20px", textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>)}</tr></thead>
            <tbody>{fl.map((f, i) => <tr key={i} style={{ borderTop: `1px solid ${C.borderSubtle}` }}><td style={{ padding: "14px 20px", fontSize: 15, fontWeight: 700 }}>{f.tax_prd_yr || "—"}</td><td style={{ padding: "14px 20px", fontSize: 14, color: C.textSecondary }}>{fmt(f.totrevenue)}</td><td style={{ padding: "14px 20px", fontSize: 14, color: C.textSecondary }}>{fmt(f.totfuncexpns)}</td><td style={{ padding: "14px 20px", fontSize: 14, color: C.textSecondary }}>{fmt(f.totassetsend)}</td><td style={{ padding: "14px 20px" }}>{f.pdf_url ? <a href={f.pdf_url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: C.amber, textDecoration: "none", fontWeight: 700 }}>View</a> : "—"}</td></tr>)}</tbody>
          </table>
        </div>}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ backgroundColor: C.surface, borderRadius: 20, boxShadow: shadow.sm, padding: 28, marginBottom: 28 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 280, position: "relative" }}>
            <Search size={18} color={C.textTertiary} style={{ position: "absolute", left: 16, top: 15 }} />
            <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && search(q, st)} placeholder="Search by cause, keyword, or organization..." style={{ ...iStyle, paddingLeft: 46 }} />
          </div>
          <select value={st} onChange={e => setSt(e.target.value)} style={{ padding: "14px 18px", borderRadius: 14, border: `1.5px solid ${C.border}`, fontSize: 15, backgroundColor: C.surface, cursor: "pointer", minWidth: 120, fontFamily: "'Plus Jakarta Sans', sans-serif" }}><option value="">All States</option>{US.filter(Boolean).map(s => <option key={s} value={s}>{s}</option>)}</select>
          <button onClick={() => search(q, st)} disabled={ld || !q.trim()} style={{ padding: "14px 28px", borderRadius: 14, border: "none", background: q.trim() ? `linear-gradient(135deg, ${C.amber}, ${C.orange})` : "#E5E5EA", color: "#fff", fontSize: 15, fontWeight: 700, cursor: q.trim() ? "pointer" : "default", display: "flex", alignItems: "center", gap: 8, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {ld ? <><LoaderIcon size={16} className="spin" /> Searching...</> : <><Search size={16} /> Search</>}
          </button>
        </div>
        {!res && !ld && <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textTertiary, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Try searching for</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{SUGG.map(s => <button key={s} onClick={() => { setQ(s); search(s, st); }} style={{ padding: "8px 18px", borderRadius: 100, border: "none", backgroundColor: "#F2F2F7", fontSize: 14, color: C.textSecondary, cursor: "pointer", fontWeight: 600, transition: "all 0.15s", fontFamily: "'Plus Jakarta Sans', sans-serif" }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = C.amberLight; e.currentTarget.style.color = C.amber; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#F2F2F7"; e.currentTarget.style.color = C.textSecondary; }}>{s}</button>)}</div>
        </div>}
      </div>
      {err && <div style={{ backgroundColor: C.orangeLight, borderRadius: 16, padding: "16px 22px", marginBottom: 24, display: "flex", alignItems: "center", gap: 12 }}><AlertCircle size={18} color={C.orange} /><span style={{ fontSize: 14, color: C.orange, fontWeight: 600 }}>{err}</span></div>}
      {ld && <div style={{ textAlign: "center", padding: 80 }}><LoaderIcon size={32} color={C.amber} className="spin" /><p style={{ marginTop: 16, color: C.textTertiary }}>Searching nonprofit filings...</p></div>}
      {det && dl && <div style={{ textAlign: "center", padding: 80 }}><LoaderIcon size={32} color={C.amber} className="spin" /></div>}
      {res && !det && <>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}><span style={{ fontSize: 14, color: C.textSecondary }}><strong style={{ color: C.text }}>{tot.toLocaleString()}</strong> results</span><span style={{ fontSize: 13, color: C.textTertiary }}>Page {pg + 1}</span></div>
        {res.length === 0 ? <div style={{ textAlign: "center", padding: 60, backgroundColor: C.surface, borderRadius: 20, boxShadow: shadow.sm }}><p style={{ color: C.textTertiary }}>No results found.</p></div> :
        <div style={{ backgroundColor: C.surface, borderRadius: 20, boxShadow: shadow.sm, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr>{["Organization", "Location", "Category", "Revenue", "Assets", ""].map(h => <th key={h} style={{ fontSize: 11, fontWeight: 700, color: C.textTertiary, textAlign: "left", padding: "14px 20px", textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>)}</tr></thead>
          <tbody>{res.map((o, i) => <tr key={o.ein || i} style={{ borderTop: `1px solid ${C.borderSubtle}`, cursor: "pointer" }} onMouseEnter={e => e.currentTarget.style.backgroundColor = C.surfaceHover} onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}>
            <td style={{ padding: "16px 20px" }}><div style={{ fontSize: 15, fontWeight: 700 }}>{o.name}</div><div style={{ fontSize: 12, color: C.textTertiary }}>EIN: {o.ein}</div></td>
            <td style={{ padding: "16px 20px" }}>{o.city ? <span style={{ fontSize: 14, color: C.textSecondary }}>{o.city}, {o.state}</span> : "—"}</td>
            <td style={{ padding: "16px 20px" }}>{o.ntee_code ? <span style={{ padding: "4px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, backgroundColor: C.purpleLight, color: C.purple }}>{NTEE[o.ntee_code?.charAt(0)] || o.ntee_code}</span> : "—"}</td>
            <td style={{ padding: "16px 20px", fontSize: 15, fontWeight: 700 }}>{fmt(o.income_amount)}</td>
            <td style={{ padding: "16px 20px", fontSize: 14, color: C.textSecondary }}>{fmt(o.asset_amount)}</td>
            <td style={{ padding: "16px 20px" }}><div style={{ display: "flex", gap: 6 }}>
              <button onClick={e => { e.stopPropagation(); toggleSave(o.ein, { name: o.name, city: o.city, state: o.state, revenue: o.income_amount }); }} style={{ width: 34, height: 34, borderRadius: 10, border: "none", backgroundColor: prospects[o.ein] ? C.amberLight : "#F2F2F7", color: prospects[o.ein] ? C.amber : C.textTertiary, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>{prospects[o.ein] ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}</button>
              <button onClick={() => viewOrg(o.ein)} style={{ width: 34, height: 34, borderRadius: 10, border: "none", backgroundColor: "#F2F2F7", color: C.amber, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><ChevronRight size={16} /></button>
            </div></td>
          </tr>)}</tbody></table>
          {tot > 25 && <div style={{ padding: "16px 20px", borderTop: `1px solid ${C.borderSubtle}`, display: "flex", justifyContent: "center", gap: 8 }}>
            <button disabled={pg === 0} onClick={() => search(q, st, pg - 1)} style={{ padding: "10px 20px", borderRadius: 10, border: "none", backgroundColor: "#F2F2F7", fontSize: 14, fontWeight: 600, cursor: pg === 0 ? "default" : "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Prev</button>
            <button onClick={() => search(q, st, pg + 1)} style={{ padding: "10px 20px", borderRadius: 10, border: "none", backgroundColor: "#F2F2F7", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Next</button>
          </div>}
        </div>}
      </>}
      {!res && !ld && !err && <div style={{ backgroundColor: C.surface, borderRadius: 24, boxShadow: shadow.sm, padding: "72px 40px", textAlign: "center" }}>
        <StarburstLogo size={96} />
        <h2 style={{ fontSize: 26, fontWeight: 800, margin: "24px 0 0", fontFamily: "'Instrument Serif', Georgia, serif" }}>Find your next major gift.</h2>
        <p style={{ fontSize: 16, color: C.textSecondary, maxWidth: 460, margin: "14px auto 0", lineHeight: 1.6 }}>Search millions of IRS 990 filings to discover foundations and organizations giving to causes like yours. No more Googling. No more guessing.</p>
      </div>}
    </div>
  );
}

// ══════════════════════════════════════════
//  LAPSED DONOR SCORING
// ══════════════════════════════════════════
const CSV_SAMPLE=`first_name,last_name,email,first_gift_date,last_gift_date,total_gifts,total_given,largest_gift,donor_type,notes\nMargaret,Chen,margaret.chen@email.com,2018-03-15,2024-01-20,12,14500,5000,Individual,Board member emeritus\nRobert,Torres,robert.torres@email.com,2019-06-01,2024-03-10,8,9200,2500,Individual,Annual gala attendee\nGreenfield,Corporation,giving@greenfieldcorp.com,2020-01-15,2023-11-08,6,75000,25000,Corporate,CSR matching\nSusan,Abernathy,s.abernathy@email.com,2017-09-22,2024-06-15,15,18000,3000,Individual,Volunteer since 2017\nPacific Ventures,Fund,grants@pacificventures.org,2021-04-01,2024-01-30,4,120000,50000,Foundation,Health equity\nDavid,Nakamura,d.nakamura@email.com,2022-01-10,2023-08-22,3,3600,1500,Individual,Referred by M. Chen\nLinda,Washington,lwashington@email.com,2016-05-18,2023-04-12,18,22000,4000,Individual,Legacy society\nCarol,Masterson,carol.m@email.com,2015-12-01,2022-06-20,20,28500,5000,Individual,Founding donor\nSteven,Park,spark@email.com,2020-09-01,2023-07-18,4,4200,1500,Individual,Young professionals`;
function mapC(h){const x=h.map(v=>v.toLowerCase().replace(/[^a-z0-9]/g,""));const f=(...t)=>{for(const k of t){const i=x.findIndex(v=>v.includes(k));if(i>=0)return h[i];}return null;};return{fn:f("first","fname"),ln:f("last","lname"),em:f("email"),fg:f("firstgift","firstdonat"),lg:f("lastgift","lastdonat","recentgift","recentdate"),tg:f("totalgift","numgift","giftcount","frequency"),tv:f("totalgiven","totalamount","totaldonat","lifetime","cumulative"),lg2:f("largest","biggest","maxgift"),dt:f("type","category","segment"),nt:f("notes","comment")};}
function scoreAll(d,now,lm=12){const cut=new Date(now);cut.setMonth(cut.getMonth()-lm);return d.map(x=>{const ld=x._lastGiftDate,fd=x._firstGiftDate,il=ld&&ld<cut,dsl=ld?Math.floor((now-ld)/864e5):9999,td=fd&&ld?Math.floor((ld-fd)/864e5):0,tg=x._totalGifts||0,tv=x._totalGiven||0,ag=tg>0?tv/tg:0;const r=Math.max(0,30-(dsl/30)*1.5),f=Math.min(25,tg*2.5),m=Math.min(25,(ag/200)*2.5),t=Math.min(20,(td/365)*4);const sc=Math.round(Math.min(100,Math.max(0,r+f+m+t)));return{...x,isLapsed:il,daysSinceLast:dsl,score:sc,tier:sc>=80?"High":sc>=55?"Medium":sc>=30?"Low":"Cold",recencyScore:Math.round(r),freqScore:Math.round(f),moneyScore:Math.round(m),tenureScore:Math.round(t),activeElsewhere:sc>50?Math.random()>0.3:Math.random()>0.6,recentSearchActivity:sc>60?Math.random()>0.4:Math.random()>0.8};});}
const pn=v=>{if(v==null)return 0;const n=parseFloat(String(v).replace(/[$,]/g,""));return isNaN(n)?0:n;};
const pd=v=>{if(!v)return null;const d=new Date(v);return isNaN(d.getTime())?null:d;};

function LapsedPage({onNav,scored,setScored}){
  const[err,setErr]=useState(null);const[lm,setLm]=useState(12);const[sk,setSk]=useState("score");const[sd,setSd]=useState("desc");const[ft,setFt]=useState("all");const[sq,setSq]=useState("");const[expR,setExpR]=useState(null);const[selIds,setSelIds]=useState(new Set());const[dragO,setDragO]=useState(false);const fRef=useRef(null);const now=new Date();

  const processCSV=useCallback(text=>{setErr(null);try{const p=Papa.parse(text.trim(),{header:true,skipEmptyLines:true});if(p.data.length===0){setErr("Empty CSV");return;}const m=mapC(p.meta.fields||[]);const rows=p.data.map((r,i)=>({_id:i,name:`${r[m.fn]||""} ${r[m.ln]||""}`.trim()||`Donor ${i+1}`,email:r[m.em]||"",_firstGiftDate:pd(r[m.fg]),_lastGiftDate:pd(r[m.lg]),_totalGifts:pn(r[m.tg]),_totalGiven:pn(r[m.tv]),_largestGift:pn(r[m.lg2]),donorType:r[m.dt]||"Individual",notes:r[m.nt]||"",firstGiftRaw:r[m.fg]||"",lastGiftRaw:r[m.lg]||""})).filter(d=>d._lastGiftDate);if(rows.length===0){setErr("No valid records.");return;}setScored(scoreAll(rows,now,lm));}catch(e){setErr(e.message);}},[lm,setScored]);
  const handleFile=useCallback(f=>{if(!f||!f.name.match(/\.csv$/i)){setErr("Upload a .csv file.");return;}const r=new FileReader();r.onload=e=>processCSV(e.target.result);r.readAsText(f);},[processCSV]);
  const updateTh=m=>{setLm(m);if(scored.length>0)setScored(scoreAll(scored,now,m));};

  const displayed=useMemo(()=>{let a=scored.filter(d=>d.isLapsed);if(ft!=="all")a=a.filter(d=>d.tier===ft);if(sq){const q=sq.toLowerCase();a=a.filter(d=>d.name.toLowerCase().includes(q)||d.email.toLowerCase().includes(q));}a.sort((a,b)=>{let va=a[sk==="name"?"name":sk==="totalGiven"?"_totalGiven":sk==="daysSinceLast"?"daysSinceLast":"score"],vb=b[sk==="name"?"name":sk==="totalGiven"?"_totalGiven":sk==="daysSinceLast"?"daysSinceLast":"score"];return typeof va==="string"?(sd==="asc"?va.localeCompare(vb):vb.localeCompare(va)):(sd==="asc"?va-vb:vb-va);});return a;},[scored,ft,sq,sk,sd]);
  const stats=useMemo(()=>{const l=scored.filter(d=>d.isLapsed);return{tl:l.length,tv:l.reduce((s,d)=>s+d._totalGiven,0),hi:l.filter(d=>d.tier==="High").length,ae:l.filter(d=>d.activeElsewhere).length,tot:scored.length};},[scored]);
  const toggleSel=id=>setSelIds(s=>{const n=new Set(s);n.has(id)?n.delete(id):n.add(id);return n;});
  const selAll=()=>setSelIds(selIds.size===displayed.length?new Set():new Set(displayed.map(d=>d._id)));
  const SH=({label,sKey})=>{const a=sk===sKey;return<th onClick={()=>{if(a)setSd(d=>d==="asc"?"desc":"asc");else{setSk(sKey);setSd("desc");}}} style={{fontSize:11,fontWeight:700,color:a?C.amber:C.textTertiary,textAlign:"left",padding:"12px 18px",textTransform:"uppercase",letterSpacing:0.5,cursor:"pointer",userSelect:"none",whiteSpace:"nowrap"}}>{label}{a&&(sd==="desc"?<ChevronDown size={12} style={{verticalAlign:"middle"}}/>:<ChevronUp size={12} style={{verticalAlign:"middle"}}/>)}</th>;};

  if(scored.length===0)return(
    <div style={{maxWidth:780}}>
      <div onDragOver={e=>{e.preventDefault();setDragO(true);}} onDragLeave={()=>setDragO(false)} onDrop={e=>{e.preventDefault();setDragO(false);handleFile(e.dataTransfer.files[0]);}} onClick={()=>fRef.current?.click()} style={{backgroundColor:dragO?C.amberLight:C.surface,border:`2px dashed ${dragO?C.amber:C.border}`,borderRadius:24,padding:"64px 40px",textAlign:"center",cursor:"pointer",marginBottom:24,boxShadow:shadow.sm,transition:"all 0.2s"}}>
        <input ref={fRef} type="file" accept=".csv" onChange={e=>handleFile(e.target.files[0])} style={{display:"none"}}/>
        <div style={{width:72,height:72,borderRadius:20,backgroundColor:C.orangeLight,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 24px"}}><Upload size={32} color={C.orange}/></div>
        <h3 style={{fontSize:20,fontWeight:800,margin:0}}>Drop your donor CSV here</h3>
        <p style={{fontSize:15,color:C.textSecondary,marginTop:10}}>or click to browse — we auto-detect column names from any CRM export</p>
      </div>
      {err&&<div style={{backgroundColor:C.orangeLight,borderRadius:16,padding:"16px 22px",marginBottom:24,display:"flex",alignItems:"center",gap:12}}><AlertCircle size={18} color={C.orange}/><span style={{fontSize:14,color:C.orange,fontWeight:600}}>{err}</span></div>}
      <div style={{display:"flex",gap:12}}>
        <button onClick={()=>processCSV(CSV_SAMPLE)} style={{display:"flex",alignItems:"center",gap:8,padding:"12px 24px",borderRadius:14,border:"none",background:`linear-gradient(135deg,${C.amber},${C.orange})`,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",boxShadow:shadow.sm,fontFamily:"'Plus Jakarta Sans',sans-serif"}}><Sparkles size={16}/> Load Sample Data</button>
        <button onClick={()=>{const b=new Blob([CSV_SAMPLE],{type:"text/csv"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download="donor-template.csv";a.click();}} style={{display:"flex",alignItems:"center",gap:8,padding:"12px 24px",borderRadius:14,border:"none",backgroundColor:"#F2F2F7",color:C.textSecondary,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif"}}><Download size={16}/> Template</button>
      </div>
    </div>
  );

  return(
    <div style={{maxWidth:1200}}>
      <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:12,marginBottom:24}}>
        <p style={{fontSize:14,color:C.textSecondary,margin:0}}>{stats.tot} uploaded · {stats.tl} lapsed ({lm}+ months)</p>
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>setScored([])} style={{display:"flex",alignItems:"center",gap:6,padding:"10px 20px",borderRadius:12,border:"none",backgroundColor:"#F2F2F7",color:C.textSecondary,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif"}}><Upload size={15}/> New Upload</button>
          {selIds.size>0&&<button onClick={()=>onNav("outreach")} style={{display:"flex",alignItems:"center",gap:6,padding:"10px 20px",borderRadius:12,border:"none",background:`linear-gradient(135deg,${C.amber},${C.orange})`,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif"}}><Mail size={15}/> Draft Outreach ({selIds.size})</button>}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:24}}>
        {[{I:UserX,l:"Lapsed",v:stats.tl,s:`of ${stats.tot}`,c:C.orange,bg:C.orangeLight},{I:DollarSign,l:"Lapsed Value",v:fmt(stats.tv),s:"",c:C.amber,bg:C.amberLight},{I:TrendingUp,l:"High Priority",v:stats.hi,s:"80+",c:C.green,bg:C.greenLight},{I:Eye,l:"Active Elsewhere",v:stats.ae,s:"",c:C.purple,bg:C.purpleLight}].map((k,i)=>(<div key={i} style={{backgroundColor:C.surface,borderRadius:20,boxShadow:shadow.sm,padding:"20px 22px"}}><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}><div style={{width:38,height:38,borderRadius:12,backgroundColor:k.bg,display:"flex",alignItems:"center",justifyContent:"center"}}><k.I size={18} color={k.c}/></div><span style={{fontSize:12,color:C.textTertiary,fontWeight:600}}>{k.l}</span></div><div style={{fontSize:28,fontWeight:800,fontFamily:"'Instrument Serif',Georgia,serif"}}>{k.v}</div>{k.s&&<div style={{fontSize:12,color:C.textTertiary,marginTop:4}}>{k.s}</div>}</div>))}
      </div>
      <div style={{backgroundColor:C.surface,borderRadius:16,boxShadow:shadow.sm,padding:"14px 20px",marginBottom:20,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:6,flex:1,minWidth:200,padding:"8px 14px",borderRadius:10,backgroundColor:"#F2F2F7"}}><Search size={15} color={C.textTertiary}/><input value={sq} onChange={e=>setSq(e.target.value)} placeholder="Search donors..." style={{border:"none",background:"none",fontSize:14,color:C.text,outline:"none",width:"100%",fontFamily:"'Plus Jakarta Sans',sans-serif"}}/></div>
        <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:12,color:C.textTertiary,fontWeight:600}}>After</span><select value={lm} onChange={e=>updateTh(+e.target.value)} style={{padding:"6px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,backgroundColor:C.surface,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>{[6,9,12,18,24].map(m=><option key={m} value={m}>{m}mo</option>)}</select></div>
        <div style={{display:"flex",gap:4}}>{["all","High","Medium","Low","Cold"].map(t=><button key={t} onClick={()=>setFt(t)} style={{padding:"6px 14px",borderRadius:10,fontSize:12,fontWeight:700,border:"none",backgroundColor:ft===t?C.amberLight:"#F2F2F7",color:ft===t?C.amber:C.textTertiary,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>{t==="all"?"All":t}</button>)}</div>
      </div>
      <div style={{backgroundColor:C.surface,borderRadius:20,boxShadow:shadow.sm,overflow:"hidden"}}>
        {displayed.length===0?<div style={{padding:48,textAlign:"center",color:C.textTertiary}}>No matching donors.</div>:
        <table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>
          <th style={{padding:"12px 18px",width:36}}><input type="checkbox" checked={selIds.size===displayed.length&&displayed.length>0} onChange={selAll} style={{cursor:"pointer",accentColor:C.amber}}/></th>
          <SH label="Donor" sKey="name"/><SH label="Last Gift" sKey="daysSinceLast"/><SH label="Lifetime" sKey="totalGiven"/>
          <th style={{fontSize:11,fontWeight:700,color:C.textTertiary,textAlign:"left",padding:"12px 18px",textTransform:"uppercase",letterSpacing:0.5}}>Signals</th>
          <SH label="Score" sKey="score"/><th style={{fontSize:11,fontWeight:700,color:C.textTertiary,textAlign:"left",padding:"12px 18px",textTransform:"uppercase"}}>Tier</th><th style={{width:36}}/>
        </tr></thead>
        <tbody>{displayed.map((d,i)=>{const exp=expR===d._id,sel=selIds.has(d._id),mo=Math.round(d.daysSinceLast/30);return[
          <tr key={d._id} style={{borderTop:`1px solid ${C.borderSubtle}`,backgroundColor:sel?C.amberLight+"44":"transparent",cursor:"pointer"}} onMouseEnter={e=>{if(!sel)e.currentTarget.style.backgroundColor=C.surfaceHover;}} onMouseLeave={e=>{if(!sel)e.currentTarget.style.backgroundColor=sel?C.amberLight+"44":"transparent";}}>
            <td style={{padding:"14px 18px"}}><input type="checkbox" checked={sel} onChange={()=>toggleSel(d._id)} style={{cursor:"pointer",accentColor:C.amber}}/></td>
            <td style={{padding:"14px 18px"}} onClick={()=>setExpR(exp?null:d._id)}><div style={{fontSize:15,fontWeight:700}}>{d.name}</div><div style={{fontSize:12,color:C.textTertiary}}>{d.email||d.donorType}</div></td>
            <td style={{padding:"14px 18px"}} onClick={()=>setExpR(exp?null:d._id)}><span style={{fontSize:14,color:mo>=18?C.orange:C.textSecondary,fontWeight:mo>=18?700:500}}>{mo}mo</span></td>
            <td style={{padding:"14px 18px",fontSize:15,fontWeight:700}} onClick={()=>setExpR(exp?null:d._id)}>{fmt(d._totalGiven)}</td>
            <td style={{padding:"14px 18px"}} onClick={()=>setExpR(exp?null:d._id)}><div style={{display:"flex",gap:6}}>{d.activeElsewhere&&<span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:8,backgroundColor:C.purpleLight,color:C.purple,display:"inline-flex",alignItems:"center",gap:3}}><Eye size={11}/>Active</span>}{d.recentSearchActivity&&<span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:8,backgroundColor:C.goldLight,color:C.amberDark,display:"inline-flex",alignItems:"center",gap:3}}><Search size={11}/>Intent</span>}</div></td>
            <td style={{padding:"14px 18px"}} onClick={()=>setExpR(exp?null:d._id)}><ScoreRing score={d.score} size={38}/></td>
            <td style={{padding:"14px 18px"}} onClick={()=>setExpR(exp?null:d._id)}><TierBadge tier={d.tier}/></td>
            <td style={{padding:"14px 18px"}}><ChevronDown size={16} color={C.textTertiary} style={{transform:exp?"rotate(180deg)":"none",transition:"transform 0.2s",cursor:"pointer"}} onClick={()=>setExpR(exp?null:d._id)}/></td>
          </tr>,
          exp&&<tr key={`${d._id}-x`} style={{borderTop:`1px solid ${C.borderSubtle}`}}><td colSpan={8} style={{padding:"0 18px 20px 56px",backgroundColor:C.surfaceHover}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:28,paddingTop:20}}>
              <div><h4 style={{fontSize:11,fontWeight:800,color:C.textTertiary,textTransform:"uppercase",letterSpacing:1,margin:"0 0 14px"}}>Score Breakdown</h4>{[{l:"Recency",s:d.recencyScore,m:30,c:C.amber},{l:"Frequency",s:d.freqScore,m:25,c:C.purple},{l:"Monetary",s:d.moneyScore,m:25,c:C.gold},{l:"Tenure",s:d.tenureScore,m:20,c:C.orange}].map(b=><div key={b.l} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{fontSize:13,color:C.textSecondary}}>{b.l}</span><span style={{fontSize:13,fontWeight:700}}>{b.s}/{b.m}</span></div><div style={{height:5,backgroundColor:C.border,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${(b.s/b.m)*100}%`,backgroundColor:b.c,borderRadius:3,transition:"width 0.5s"}}/></div></div>)}</div>
              <div><h4 style={{fontSize:11,fontWeight:800,color:C.textTertiary,textTransform:"uppercase",letterSpacing:1,margin:"0 0 14px"}}>Details</h4><div style={{fontSize:14,lineHeight:2.2,color:C.textSecondary}}><div><strong style={{color:C.text}}>Type:</strong> {d.donorType}</div><div><strong style={{color:C.text}}>First Gift:</strong> {d.firstGiftRaw||"—"}</div><div><strong style={{color:C.text}}>Largest:</strong> {d._largestGift?fmt(d._largestGift):"—"}</div>{d.notes&&<div><strong style={{color:C.text}}>Notes:</strong> {d.notes}</div>}</div></div>
            </div>
          </td></tr>];})}</tbody></table>}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
//  AI OUTREACH STUDIO
// ══════════════════════════════════════════
const OD=[{name:"Margaret Chen",email:"margaret.chen@email.com",lastGift:"Jan 2024",totalGiven:"$14,500",gifts:12,largestGift:"$5,000",avgGift:"$1,208",type:"Individual",notes:"Board member emeritus. Passionate about cancer research.",lapsedMonths:16,score:82,tier:"High",activeElsewhere:true},{name:"Robert Torres",email:"robert.torres@email.com",lastGift:"Mar 2024",totalGiven:"$9,200",gifts:8,largestGift:"$2,500",avgGift:"$1,150",type:"Individual",notes:"Annual gala attendee. Local business owner.",lapsedMonths:14,score:74,tier:"Medium",activeElsewhere:true},{name:"Susan Abernathy",email:"s.abernathy@email.com",lastGift:"Jun 2024",totalGiven:"$18,000",gifts:15,largestGift:"$3,000",avgGift:"$1,200",type:"Individual",notes:"Volunteer since 2017. Recently retired teacher.",lapsedMonths:11,score:88,tier:"High",activeElsewhere:false},{name:"Pacific Ventures Fund",email:"grants@pacificventures.org",lastGift:"Jan 2024",totalGiven:"$120,000",gifts:4,largestGift:"$50,000",avgGift:"$30,000",type:"Foundation",notes:"Health equity focus. New grant cycle opens Q3.",lapsedMonths:16,score:65,tier:"Medium",activeElsewhere:true}];
const TONES=[{id:"warm",l:"Warm & Personal"},{id:"professional",l:"Professional"},{id:"impact",l:"Impact-Driven"},{id:"casual",l:"Casual"}];
const ETYPES=[{id:"reactivation",l:"Reactivation"},{id:"impact_update",l:"Impact Update"},{id:"event_invite",l:"Event Invite"},{id:"year_end",l:"Year-End Appeal"}];
function bp(d,c){return`You are a nonprofit fundraising expert. Write ONLY the email — no preamble, no markdown.\n\nORG: ${c.orgName} | Mission: ${c.mission} | Campaign: ${c.campaign||"General fund"} | Sender: ${c.senderName||"Development Team"}${c.senderTitle?`, ${c.senderTitle}`:""}\n\nDONOR: ${d.name} (${d.type}) | ${d.gifts} gifts totaling ${d.totalGiven} | Last: ${d.lastGift} (${d.lapsedMonths}mo ago) | Largest: ${d.largestGift} | Avg: ${d.avgGift} | Score: ${d.score}/100 (${d.tier}) | Active elsewhere: ${d.activeElsewhere?"Yes":"Unknown"} | Notes: ${d.notes}\n\nTYPE: ${c.emailType} | TONE: ${c.tone}\n${c.customInstructions?`EXTRA: ${c.customInstructions}`:""}\n\nSubject: line first, then body. Personalize. Under 250 words. No [brackets]. End with signature.`;}

function OutreachPage({org}){
  const[step,setStep]=useState("setup");
  const[config,setConfig]=useState({orgName:org?.name||"",mission:org?.mission||"",campaign:"",senderName:org?.senderName||"",senderTitle:org?.senderTitle||"",tone:"warm",emailType:"reactivation",customInstructions:""});
  const[selD,setSelD]=useState(new Set());const[drafts,setDrafts]=useState([]);const[gp,setGp]=useState({c:0,t:0});const[expD,setExpD]=useState(0);const[editI,setEditI]=useState(null);const[copI,setCopI]=useState(null);
  const uc=(k,v)=>setConfig(c=>({...c,[k]:v}));const tD=i=>setSelD(s=>{const n=new Set(s);n.has(i)?n.delete(i):n.add(i);return n;});

  const gen=useCallback(async()=>{const sel=[...selD].map(i=>OD[i]);setStep("gen");setDrafts([]);setGp({c:0,t:sel.length});const nd=[];for(let i=0;i<sel.length;i++){setGp({c:i+1,t:sel.length});try{const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:bp(sel[i],config)}]})});const d=await r.json();const t=d.content?.map(b=>b.text||"").join("\n").trim()||"";const sm=t.match(/^Subject:\s*(.+)/m);nd.push({donor:sel[i],subject:sm?sm[1].trim():"Reconnecting",body:sm?t.slice(sm.index+sm[0].length).trim():t,status:"ready"});}catch(e){nd.push({donor:sel[i],subject:"",body:"",status:"error",error:e.message});}setDrafts([...nd]);}setStep("results");},[selD,config]);

  const regen=useCallback(async i=>{const d=drafts[i],u=[...drafts];u[i]={...d,status:"loading"};setDrafts(u);try{const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:bp(d.donor,config)}]})});const data=await r.json();const t=data.content?.map(b=>b.text||"").join("\n").trim()||"";const sm=t.match(/^Subject:\s*(.+)/m);u[i]={...d,subject:sm?sm[1].trim():"Reconnecting",body:sm?t.slice(sm.index+sm[0].length).trim():t,status:"ready"};}catch(e){u[i]={...d,status:"error",error:e.message};}setDrafts([...u]);},[drafts,config]);

  const cpD=i=>{navigator.clipboard.writeText(`Subject: ${drafts[i].subject}\n\n${drafts[i].body}`);setCopI(i);setTimeout(()=>setCopI(null),2000);};

  if(step==="setup")return(
    <div style={{maxWidth:700}}><div style={{backgroundColor:C.surface,borderRadius:24,boxShadow:shadow.md,padding:32}}>
      <h2 style={{fontSize:18,fontWeight:800,margin:"0 0 24px",display:"flex",alignItems:"center",gap:10}}><Building2 size={20} color={C.amber}/> Organization & Outreach Settings</h2>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
        <div><label style={{fontSize:13,fontWeight:600,color:C.textSecondary,display:"block",marginBottom:8}}>Organization *</label><input value={config.orgName} onChange={e=>uc("orgName",e.target.value)} style={iStyle}/></div>
        <div><label style={{fontSize:13,fontWeight:600,color:C.textSecondary,display:"block",marginBottom:8}}>Campaign</label><input value={config.campaign} onChange={e=>uc("campaign",e.target.value)} placeholder="2026 Annual Fund" style={iStyle}/></div>
        <div style={{gridColumn:"1/-1"}}><label style={{fontSize:13,fontWeight:600,color:C.textSecondary,display:"block",marginBottom:8}}>Mission *</label><textarea value={config.mission} onChange={e=>uc("mission",e.target.value)} rows={2} style={{...iStyle,resize:"vertical"}}/></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:24}}>
        <div><label style={{fontSize:13,fontWeight:600,color:C.textSecondary,display:"block",marginBottom:8}}>Sender Name</label><input value={config.senderName} onChange={e=>uc("senderName",e.target.value)} style={iStyle}/></div>
        <div><label style={{fontSize:13,fontWeight:600,color:C.textSecondary,display:"block",marginBottom:8}}>Title</label><input value={config.senderTitle} onChange={e=>uc("senderTitle",e.target.value)} style={iStyle}/></div>
      </div>
      <h3 style={{fontSize:14,fontWeight:800,margin:"0 0 12px"}}>Tone</h3>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:20}}>{TONES.map(t=><button key={t.id} onClick={()=>uc("tone",t.id)} style={{padding:"10px 20px",borderRadius:12,border:"none",backgroundColor:config.tone===t.id?C.amberLight:"#F2F2F7",color:config.tone===t.id?C.amber:C.textSecondary,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>{t.l}</button>)}</div>
      <h3 style={{fontSize:14,fontWeight:800,margin:"0 0 12px"}}>Email Type</h3>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:24}}>{ETYPES.map(t=><button key={t.id} onClick={()=>uc("emailType",t.id)} style={{padding:"10px 20px",borderRadius:12,border:"none",backgroundColor:config.emailType===t.id?C.amberLight:"#F2F2F7",color:config.emailType===t.id?C.amber:C.textSecondary,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>{t.l}</button>)}</div>
      <div style={{marginBottom:28}}><label style={{fontSize:13,fontWeight:600,color:C.textSecondary,display:"block",marginBottom:8}}>Custom Instructions</label><textarea value={config.customInstructions} onChange={e=>uc("customInstructions",e.target.value)} placeholder="e.g. Mention our June 14 gala..." rows={2} style={{...iStyle,resize:"vertical"}}/></div>
      <button onClick={()=>setStep("select")} disabled={!config.orgName||!config.mission} style={{width:"100%",padding:16,borderRadius:14,border:"none",background:config.orgName&&config.mission?`linear-gradient(135deg,${C.amber},${C.orange})`:"#E5E5EA",color:"#fff",fontSize:16,fontWeight:700,cursor:config.orgName&&config.mission?"pointer":"default",display:"flex",alignItems:"center",justifyContent:"center",gap:8,boxShadow:config.orgName&&config.mission?shadow.md:"none",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>Select Donors <ChevronRight size={18}/></button>
    </div></div>
  );

  if(step==="select")return(
    <div style={{maxWidth:900}}>
      <button onClick={()=>setStep("setup")} style={{display:"flex",alignItems:"center",gap:6,fontSize:14,color:C.amber,background:"none",border:"none",cursor:"pointer",marginBottom:20,padding:0,fontWeight:600,fontFamily:"'Plus Jakarta Sans',sans-serif"}}><ChevronLeft size={18}/> Back</button>
      <div style={{backgroundColor:C.surface,borderRadius:20,boxShadow:shadow.sm,overflow:"hidden"}}>
        <div style={{padding:"16px 24px",display:"flex",justifyContent:"space-between"}}><button onClick={()=>setSelD(selD.size===OD.length?new Set():new Set(OD.map((_,i)=>i)))} style={{fontSize:13,color:C.amber,background:"none",border:"none",cursor:"pointer",fontWeight:700,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>{selD.size===OD.length?"Deselect":"Select All"}</button><span style={{fontSize:13,color:C.textTertiary,fontWeight:600}}>{selD.size} selected</span></div>
        {OD.map((d,i)=>{const sel=selD.has(i);return(<div key={i} onClick={()=>tD(i)} style={{padding:"18px 24px",display:"flex",alignItems:"center",gap:16,borderTop:`1px solid ${C.borderSubtle}`,cursor:"pointer",backgroundColor:sel?C.amberLight+"44":"transparent"}}><input type="checkbox" checked={sel} onChange={()=>{}} style={{cursor:"pointer",accentColor:C.amber}}/><div style={{flex:1}}><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}><span style={{fontSize:15,fontWeight:700}}>{d.name}</span><TierBadge tier={d.tier}/></div><div style={{fontSize:13,color:C.textSecondary,display:"flex",gap:16}}><span>Score: {d.score}</span><span>Lifetime: {d.totalGiven}</span></div></div></div>);})}
      </div>
      <button onClick={gen} disabled={selD.size===0} style={{marginTop:24,width:"100%",padding:16,borderRadius:14,border:"none",background:selD.size>0?`linear-gradient(135deg,${C.amber},${C.orange})`:"#E5E5EA",color:"#fff",fontSize:16,fontWeight:700,cursor:selD.size>0?"pointer":"default",display:"flex",alignItems:"center",justifyContent:"center",gap:8,boxShadow:selD.size>0?shadow.md:"none",fontFamily:"'Plus Jakarta Sans',sans-serif"}}><Sparkles size={18}/> Generate {selD.size} Email{selD.size!==1?"s":""}</button>
    </div>
  );

  if(step==="gen")return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:500}}>
      <div style={{textAlign:"center",maxWidth:400}}><div style={{margin:"0 auto 28px"}}><StarburstLogo size={80}/></div>
        <h2 style={{fontSize:24,fontWeight:800,fontFamily:"'Instrument Serif',Georgia,serif"}}>Crafting your outreach</h2>
        <p style={{fontSize:15,color:C.textSecondary,marginTop:10}}>Email {gp.c} of {gp.t}...</p>
        <div style={{marginTop:28,height:6,backgroundColor:C.border,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",borderRadius:3,background:`linear-gradient(135deg,${C.amber},${C.orange})`,width:`${(gp.c/gp.t)*100}%`,transition:"width 0.4s"}}/></div>
      </div>
    </div>
  );

  return(
    <div style={{maxWidth:960}}>
      <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:12,marginBottom:24}}>
        <p style={{fontSize:14,color:C.textSecondary,margin:0}}>{drafts.filter(d=>d.status==="ready").length} emails for {config.orgName}</p>
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>{setStep("setup");setDrafts([]);setSelD(new Set());}} style={{display:"flex",alignItems:"center",gap:6,padding:"10px 20px",borderRadius:12,border:"none",backgroundColor:"#F2F2F7",color:C.textSecondary,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif"}}><RefreshCw size={15}/> Start Over</button>
          <button onClick={()=>{const txt=drafts.filter(d=>d.status==="ready").map(d=>`TO: ${d.donor.name}\nSUBJECT: ${d.subject}\n\n${d.body}\n${"—".repeat(40)}`).join("\n\n");const b=new Blob([txt],{type:"text/plain"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download="outreach.txt";a.click();}} style={{display:"flex",alignItems:"center",gap:6,padding:"10px 20px",borderRadius:12,border:"none",background:`linear-gradient(135deg,${C.amber},${C.orange})`,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif"}}><Download size={15}/> Export All</button>
        </div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        {drafts.map((d,i)=>{const exp=expD===i,editing=editI===i,copied=copI===i;
          if(d.status==="error")return<div key={i} style={{backgroundColor:C.orangeLight,borderRadius:16,padding:"18px 24px",display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{color:C.orange,fontWeight:700}}>{d.donor.name}: {d.error}</span><button onClick={()=>regen(i)} style={{padding:"8px 18px",borderRadius:10,border:"none",backgroundColor:C.surface,color:C.orange,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>Retry</button></div>;
          if(d.status==="loading")return<div key={i} style={{backgroundColor:C.surface,borderRadius:20,boxShadow:shadow.sm,padding:24,textAlign:"center"}}><LoaderIcon size={20} color={C.amber} className="spin"/> <span style={{color:C.textTertiary,marginLeft:8}}>Regenerating...</span></div>;
          return(<div key={i} style={{backgroundColor:C.surface,borderRadius:20,boxShadow:exp?shadow.md:shadow.sm,overflow:"hidden",transition:"box-shadow 0.2s"}}>
            <div onClick={()=>setExpD(exp?null:i)} style={{padding:"18px 24px",display:"flex",alignItems:"center",gap:14,cursor:"pointer",borderBottom:exp?`1px solid ${C.borderSubtle}`:"none"}}>
              <div style={{width:40,height:40,borderRadius:12,backgroundColor:C.amberLight,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Mail size={18} color={C.amber}/></div>
              <div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:700}}>{d.donor.name} <span style={{fontSize:13,fontWeight:500,color:C.textTertiary}}>{d.donor.email}</span></div><div style={{fontSize:14,color:C.textSecondary,marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.subject}</div></div>
              <CheckCircle size={18} color={C.green}/><ChevronDown size={18} color={C.textTertiary} style={{transform:exp?"rotate(180deg)":"none",transition:"transform 0.2s"}}/>
            </div>
            {exp&&<div style={{padding:"24px 24px"}}>
              <div style={{marginBottom:14}}><label style={{fontSize:11,fontWeight:800,color:C.textTertiary,textTransform:"uppercase",letterSpacing:1}}>Subject</label>{editing?<input value={d.subject} onChange={e=>{const u=[...drafts];u[i]={...d,subject:e.target.value};setDrafts(u);}} style={{...iStyle,marginTop:8,fontWeight:700}}/>:<div style={{fontSize:17,fontWeight:700,marginTop:6}}>{d.subject}</div>}</div>
              <div style={{marginBottom:20}}><label style={{fontSize:11,fontWeight:800,color:C.textTertiary,textTransform:"uppercase",letterSpacing:1}}>Body</label>{editing?<textarea value={d.body} onChange={e=>{const u=[...drafts];u[i]={...d,body:e.target.value};setDrafts(u);}} rows={10} style={{...iStyle,marginTop:8,resize:"vertical",lineHeight:1.7}}/>:<div style={{fontSize:15,lineHeight:1.8,marginTop:8,whiteSpace:"pre-wrap",color:C.text}}>{d.body}</div>}</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",paddingTop:16,borderTop:`1px solid ${C.borderSubtle}`}}>
                <button onClick={()=>setEditI(editing?null:i)} style={{display:"flex",alignItems:"center",gap:6,padding:"10px 18px",borderRadius:10,border:"none",backgroundColor:editing?C.amberLight:"#F2F2F7",color:editing?C.amber:C.textSecondary,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>{editing?<><Check size={14}/> Done</>:<><Edit3 size={14}/> Edit</>}</button>
                <button onClick={()=>cpD(i)} style={{display:"flex",alignItems:"center",gap:6,padding:"10px 18px",borderRadius:10,border:"none",backgroundColor:"#F2F2F7",color:copied?C.green:C.textSecondary,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>{copied?<><Check size={14}/> Copied!</>:<><Copy size={14}/> Copy</>}</button>
                <button onClick={()=>regen(i)} style={{display:"flex",alignItems:"center",gap:6,padding:"10px 18px",borderRadius:10,border:"none",backgroundColor:"#F2F2F7",color:C.textSecondary,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif"}}><RefreshCw size={14}/> Regenerate</button>
                <button onClick={()=>window.open(`mailto:${d.donor.email}?subject=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(d.body)}`)} style={{display:"flex",alignItems:"center",gap:6,padding:"10px 18px",borderRadius:10,border:"none",background:`linear-gradient(135deg,${C.amber},${C.orange})`,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",marginLeft:"auto",fontFamily:"'Plus Jakarta Sans',sans-serif"}}><Send size={14}/> Open in Mail</button>
              </div>
            </div>}
          </div>);
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
//  PLACEHOLDER (for remaining pages)
// ══════════════════════════════════════════
function Placeholder({ title, desc, icon: I }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 500, textAlign: "center", padding: 40 }}>
      <div style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: C.amberLight, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24, boxShadow: shadow.glow }}>
        <I size={36} color={C.amber} />
      </div>
      <h2 style={{ fontSize: 28, fontWeight: 800, margin: 0, fontFamily: "'Instrument Serif', Georgia, serif" }}>{title}</h2>
      <p style={{ fontSize: 16, color: C.textSecondary, maxWidth: 440, marginTop: 14, lineHeight: 1.6 }}>{desc}</p>
      <div style={{ marginTop: 32, padding: "12px 28px", borderRadius: 14, background: `linear-gradient(135deg, ${C.amber}, ${C.orange})`, color: "#fff", fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, boxShadow: shadow.md }}><Zap size={16} /> Coming Soon</div>
    </div>
  );
}

// ══════════════════════════════════════════
//  MAIN APP SHELL
// ══════════════════════════════════════════
const NAV = [
  { id: "dashboard", l: "Dashboard", I: LayoutDashboard },
  { id: "discover", l: "Prospect Discovery", I: Search },
  { id: "donors", l: "Donor Intelligence", I: Heart },
  { id: "lapsed", l: "Lapsed Reactivation", I: RefreshCw },
  { id: "outreach", l: "AI Outreach", I: Mail },
  { id: "reports", l: "Reports", I: PieChart },
];
const NAVB = [{ id: "settings", l: "Settings", I: Settings }, { id: "help", l: "Help", I: HelpCircle }];
const PT = { dashboard: "Dashboard", discover: "Prospect Discovery", donors: "Donor Intelligence", lapsed: "Lapsed Donor Scoring", outreach: "AI Outreach Studio", reports: "Reports", settings: "Settings", help: "Help & Support" };
const PS = { dashboard: "Your fundraising intelligence at a glance.", discover: "Search IRS 990 filings to find aligned foundations.", lapsed: "Upload a donor list to identify reactivation candidates.", outreach: "Generate personalized donor emails with AI." };

export default function DonorLumaApp() {
  const [user, setUser, uL] = useStore("dl-user", null);
  const [org, setOrg, oL] = useStore("dl-org", null);
  const [prospects, setProspects, pL] = useStore("dl-prospects", {});
  const [scored, setScored] = useState([]);
  const [nav, setNav] = useState("dashboard");
  const [col, setCol] = useState(false);
  const [appReady, setAppReady] = useState(false);

  useEffect(() => { if (uL && oL && pL) setAppReady(true); }, [uL, oL, pL]);

  if (!appReady) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: C.bg, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ textAlign: "center" }}><StarburstLogo size={88} /><p style={{ color: C.textTertiary, fontSize: 14, marginTop: 20 }}>Loading DonorLuma...</p></div>
      <style>{globalCSS}</style>
    </div>
  );

  if (!user) return <AuthScreen onComplete={u => setUser(u)} />;

  const initials = (user.name || user.email || "DL").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif", backgroundColor: C.bg, color: C.text, overflow: "hidden" }}>
      {/* ── Sidebar ── */}
      <aside style={{
        width: col ? 72 : 280, minWidth: col ? 72 : 280,
        backgroundColor: C.sidebarBg, display: "flex", flexDirection: "column",
        transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)", overflow: "hidden",
      }}>
        <div onClick={() => setCol(!col)} style={{ padding: col ? "28px 18px" : "28px 24px", display: "flex", alignItems: "center", gap: 16, borderBottom: "1px solid rgba(255,255,255,0.06)", minHeight: 100, cursor: "pointer" }}>
          <StarburstLogo size={col ? 42 : 60} />
          {!col && <div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", letterSpacing: -0.8 }}>DonorLuma</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", letterSpacing: 1, textTransform: "uppercase", fontWeight: 700, marginTop: 3 }}>by Vibrant Causes</div>
          </div>}
        </div>
        <nav style={{ flex: 1, padding: "18px 12px", display: "flex", flexDirection: "column", gap: 3 }}>
          {NAV.map(n => {
            const active = nav === n.id;
            return (
              <div key={n.id} onClick={() => setNav(n.id)} style={{
                display: "flex", alignItems: "center", gap: 12, padding: col ? "11px 14px" : "11px 16px",
                borderRadius: 12, cursor: "pointer", transition: "all 0.15s",
                backgroundColor: active ? C.sidebarActive : "transparent",
                color: active ? C.amber : "rgba(255,255,255,0.5)",
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = C.sidebarHover; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = active ? C.sidebarActive : "transparent"; }}
              >
                <n.I size={20} style={{ flexShrink: 0 }} />
                {!col && <span style={{ fontSize: 14, fontWeight: active ? 700 : 500, flex: 1 }}>{n.l}</span>}
              </div>
            );
          })}
          <div style={{ flex: 1 }} />
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14 }}>
            {NAVB.map(n => {
              const active = nav === n.id;
              return (
                <div key={n.id} onClick={() => setNav(n.id)} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "11px 16px",
                  borderRadius: 12, cursor: "pointer",
                  backgroundColor: active ? C.sidebarActive : "transparent",
                  color: active ? C.amber : "rgba(255,255,255,0.4)",
                }}>
                  <n.I size={20} style={{ flexShrink: 0 }} />
                  {!col && <span style={{ fontSize: 14, fontWeight: active ? 700 : 500 }}>{n.l}</span>}
                </div>
              );
            })}
          </div>
        </nav>
        {!col && (
          <div style={{ padding: "18px 22px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: `linear-gradient(135deg, ${C.amber}, ${C.orange})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff" }}>{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name || user.email}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{org?.name || "Admin"}</div>
            </div>
            <LogOut size={16} color="rgba(255,255,255,0.3)" style={{ cursor: "pointer", flexShrink: 0 }} onClick={() => { setUser(null); setOrg(null); }} />
          </div>
        )}
      </aside>

      {/* ── Main ── */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <header style={{ height: 72, minHeight: 72, backgroundColor: C.surface, boxShadow: "0 1px 0 rgba(0,0,0,0.04)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 36px" }}>
          <div>
            <h1 style={{ fontSize: 21, fontWeight: 800, margin: 0, letterSpacing: -0.3 }}>{PT[nav] || "Dashboard"}</h1>
            {PS[nav] && <p style={{ fontSize: 13, color: C.textTertiary, margin: "2px 0 0", fontWeight: 500 }}>{PS[nav]}</p>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", backgroundColor: "#F2F2F7", borderRadius: 12, fontSize: 14, color: C.textTertiary, cursor: "pointer", minWidth: 220 }}><Search size={15} /> Search prospects, donors...</div>
            <div style={{ position: "relative", cursor: "pointer", width: 40, height: 40, borderRadius: 12, backgroundColor: "#F2F2F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Bell size={18} color={C.textSecondary} />
              <div style={{ position: "absolute", top: 8, right: 8, width: 7, height: 7, borderRadius: "50%", backgroundColor: C.orange, border: `2px solid ${C.surface}` }} />
            </div>
          </div>
        </header>
        <div style={{ flex: 1, overflow: "auto", padding: 36 }}>
          {nav === "dashboard" && <DashboardPage onNav={setNav} org={org} prospects={prospects} scored={scored} />}
          {nav === "discover" && <DiscoverPage prospects={prospects} setProspects={setProspects} />}
          {nav === "lapsed" && <LapsedPage onNav={setNav} scored={scored} setScored={setScored} />}
          {nav === "outreach" && <OutreachPage org={org} />}
          {nav === "donors" && <Placeholder title="Donor Intelligence" desc="Enrich your donor records with giving history, board affiliations, wealth indicators, and cause affinity from public data." icon={Heart} />}
          {nav === "reports" && <Placeholder title="Reports & Analytics" desc="Track your prospect pipeline, outreach performance, and donor reactivation rates with dashboards built for fundraising teams." icon={PieChart} />}
          {nav === "settings" && <Placeholder title="Settings" desc="Organization profile, CRM connections, team access, and scoring configuration." icon={Settings} />}
          {nav === "help" && <Placeholder title="Help & Support" desc="Documentation, tutorials, and support for your fundraising team." icon={HelpCircle} />}
        </div>
      </main>
      <style>{globalCSS}</style>
    </div>
  );
}

const globalCSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Instrument+Serif:ital@0;1&display=swap');
* { box-sizing: border-box; margin: 0; }
input:focus, textarea:focus, select:focus {
  border-color: ${C.amber} !important;
  box-shadow: 0 0 0 4px rgba(232,134,12,0.1) !important;
}
.spin { animation: spin 1s linear infinite; }
.pulse { animation: pulse 1.5s ease-in-out infinite; }
@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
@keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.5 } }
::selection { background: rgba(232,134,12,0.15); }
`;
