import { useState, useEffect, useRef } from "react";

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────
const C = {
  brand: "#0d5c3a",
  brandMid: "#1a7a4e",
  brandLight: "#e8f5ee",
  brandAccent: "#3dba7e",
  sidebar: "#0a2418",
  sidebarHover: "rgba(61,186,126,0.12)",
  sidebarActive: "rgba(61,186,126,0.22)",
  green: "#22c55e",
  yellow: "#eab308",
  red: "#ef4444",
  orange: "#f97316",
  blue: "#3b82f6",
  page: "#f0f4f2",
  card: "#ffffff",
  border: "#e2e8e4",
  text: "#0f2418",
  muted: "#5a7a68",
  lighter: "#8aab96",
};

const SIDEBAR_W = 240;

// ─── SHARED COMPONENTS ───────────────────────────────────────────────────────

function Badge({ color, children }) {
  const map = {
    green: { bg: "#dcfce7", text: "#15803d" },
    yellow: { bg: "#fef9c3", text: "#a16207" },
    red: { bg: "#fee2e2", text: "#b91c1c" },
    orange: { bg: "#ffedd5", text: "#c2410c" },
    blue: { bg: "#dbeafe", text: "#1d4ed8" },
    gray: { bg: "#f1f5f9", text: "#475569" },
  };
  const s = map[color] || map.gray;
  return (
    <span style={{
      background: s.bg, color: s.text,
      fontSize: 11, fontWeight: 600, padding: "2px 8px",
      borderRadius: 20, whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

function Card({ children, style = {}, pad = "1.25rem" }) {
  return (
    <div style={{
      background: C.card, borderRadius: 14, border: `1px solid ${C.border}`,
      padding: pad, ...style,
    }}>{children}</div>
  );
}

function RAGDot({ status }) {
  const col = status === "green" ? C.green : status === "yellow" ? C.yellow : C.red;
  return <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: col, marginRight: 6 }} />;
}

function SectionTitle({ children }) {
  return <h2 style={{ fontSize: 17, fontWeight: 700, color: C.text, margin: "0 0 1rem" }}>{children}</h2>;
}

function PageHeader({ title, subtitle, action }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: 0 }}>{title}</h1>
        {subtitle && <p style={{ color: C.muted, margin: "4px 0 0", fontSize: 14 }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function Btn({ children, variant = "primary", onClick, style = {}, small = false }) {
  const base = {
    border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600,
    padding: small ? "6px 14px" : "9px 20px", fontSize: small ? 13 : 14,
    transition: "opacity .15s",
  };
  const vars = {
    primary: { background: C.brandMid, color: "#fff" },
    secondary: { background: C.brandLight, color: C.brand },
    danger: { background: "#fee2e2", color: "#b91c1c" },
    ghost: { background: "transparent", color: C.muted, border: `1px solid ${C.border}` },
  };
  return <button style={{ ...base, ...vars[variant], ...style }} onClick={onClick}>{children}</button>;
}

function Input({ placeholder, value, onChange, style = {}, type = "text" }) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px",
        fontSize: 14, outline: "none", color: C.text, background: "#fff",
        width: "100%", boxSizing: "border-box", ...style,
      }}
    />
  );
}

function Select({ value, onChange, options, style = {} }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px",
        fontSize: 13, outline: "none", color: C.text, background: "#fff",
        cursor: "pointer", ...style,
      }}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// Sparkline mini chart (SVG)
function Spark({ data, color = C.brandAccent, height = 40 }) {
  if (!data || data.length < 2) return null;
  const w = 120, h = height;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`).join(" ");
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <polyline fill="none" stroke={color} strokeWidth="2" points={pts} />
    </svg>
  );
}

// Progress bar
function ProgressBar({ value, color = C.brandAccent, label }) {
  return (
    <div>
      {label && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.muted, marginBottom: 4 }}>
        <span>{label}</span><span style={{ fontWeight: 600, color: C.text }}>{value}%</span>
      </div>}
      <div style={{ height: 7, background: C.border, borderRadius: 99 }}>
        <div style={{ height: "100%", width: `${value}%`, background: color, borderRadius: 99, transition: "width .6s" }} />
      </div>
    </div>
  );
}

// ─── DATA ────────────────────────────────────────────────────────────────────

const TERRITORIES = ["All Borneo", "Sabah", "Sarawak", "Brunei", "Kalimantan"];

const ESG_DATA = {
  environmental: [
    { name: "Forest Cover", value: "57.3%", unit: "%", trend: "down", rag: "yellow", spark: [62,61,60,59,58,57,58,57,56,57,57,57], source: "Global Forest Watch" },
    { name: "Deforestation Rate", value: "128,450", unit: "ha/yr", trend: "down", rag: "red", spark: [180,178,175,173,171,168,165,162,160,157,155,154], source: "Global Forest Watch" },
    { name: "Air Quality Index", value: "42", unit: "AQI", trend: "stable", rag: "green", spark: [40,41,39,40,42,41,43,44,43,45,44,42], source: "OpenAQ" },
    { name: "Water Quality Index", value: "68/100", unit: "score", trend: "stable", rag: "yellow", spark: [60,61,59,60,62,68,63,62,61,60,59,60], source: "Gov. Portals" },
    { name: "Active Fire Hotspots", value: "214", unit: "count", trend: "up", rag: "red", spark: [120,130,145,160,170,180,195,200,210,208,214,214], source: "NASA FIRMS" },
    { name: "Carbon Emissions", value: "1.2 Gt", unit: "GtCO₂", trend: "up", rag: "red", spark: [0.9,0.95,1.0,1.05,1.1,1.12,1.14,1.16,1.18,1.19,1.2,1.2], source: "World Bank" },
  ],
  social: [
    { name: "Poverty Rate", value: "13.2%", unit: "%", trend: "down", rag: "yellow", spark: [15,15,14,14,14,13,13,12,12,11,11,10], source: "World Bank" },
    { name: "Employment Rate", value: "67.8%", unit: "%", trend: "up", rag: "green", spark: [62,63,64,65,64,66,67,68,67,69,68,70], source: "World Bank" },
    { name: "Literacy / Education Index", value: "0.74", unit: "index", trend: "up", rag: "green", spark: [0.65,0.67,0.68,0.69,0.70,0.71,0.72,0.72,0.73,0.74,0.74,0.74], source: "UNESCO" },
    { name: "Healthcare Access Score", value: "61/100", unit: "score", trend: "up", rag: "yellow", spark: [50,52,54,55,56,57,58,59,60,61,61,61], source: "WHO" },
    { name: "Clean Water Access", value: "78.4%", unit: "%", trend: "up", rag: "yellow", spark: [70,71,72,73,74,75,76,77,78,78,78,78], source: "UN SDG DB" },
  ],
  governance: [
    { name: "Transparency Score", value: "42/100", unit: "score", trend: "up", rag: "yellow", spark: [36,37,38,38,39,40,40,41,42,42,42,42], source: "Transparency Int." },
    { name: "Ease of Doing Business", value: "58.1", unit: "score", trend: "up", rag: "yellow", spark: [52,53,54,55,55,56,57,57,58,58,58,58], source: "World Bank" },
    { name: "Public Service Delivery", value: "54/100", unit: "score", trend: "stable", rag: "yellow", spark: [50,51,51,52,52,53,53,54,54,54,54,54], source: "Gov. Portals" },
  ],
};

const SDG_DATA = [
  { id: 1, title: "No Poverty", color: "#E5243B", score: 45, status: "red", progress: 45, trend: "up" },
  { id: 3, title: "Good Health", color: "#4C9F38", score: 62, status: "yellow", progress: 62, trend: "up" },
  { id: 4, title: "Quality Education", color: "#C5192D", score: 68, status: "yellow", progress: 68, trend: "up" },
  { id: 6, title: "Clean Water", color: "#26BDE2", score: 71, status: "yellow", progress: 71, trend: "stable" },
  { id: 8, title: "Decent Work", color: "#A21942", score: 58, status: "yellow", progress: 58, trend: "up" },
  { id: 13, title: "Climate Action", color: "#3F7E44", score: 31, status: "red", progress: 31, trend: "down" },
  { id: 15, title: "Life on Land", color: "#56C02B", score: 38, status: "red", progress: 38, trend: "down" },
  { id: 16, title: "Peace & Justice", color: "#00689D", score: 55, status: "yellow", progress: 55, trend: "stable" },
];

const ALERTS = [
  { id: 1, title: "Forest Fire Detected", region: "Central Kalimantan", severity: "red", time: "2h ago", type: "fire" },
  { id: 2, title: "Flood Alert", region: "Kuching, Sarawak", severity: "orange", time: "5h ago", type: "flood" },
  { id: 3, title: "Water Quality Alert", region: "Sungai Kinabatangan, Sabah", severity: "orange", time: "1d ago", type: "water" },
  { id: 4, title: "Illegal Dumping Report", region: "Sandakan, Sabah", severity: "yellow", time: "2d ago", type: "dump" },
  { id: 5, title: "Air Quality Index High", region: "Bandar Seri Begawan, Brunei", severity: "yellow", time: "2d ago", type: "air" },
  { id: 6, title: "Deforestation Spike", region: "East Kalimantan", severity: "red", time: "3d ago", type: "forest" },
];

const COMMUNITY_REPORTS = [
  { id: 1, user: "Ahmad B.", category: "Forest Fire", location: "Tawau, Sabah", date: "2026-06-18", status: "Verified", severity: "red" },
  { id: 2, user: "Siti N.", category: "Pollution", location: "Miri, Sarawak", date: "2026-06-17", status: "Under Review", severity: "orange" },
  { id: 3, user: "Lim K.", category: "Flood", location: "Kota Kinabalu", date: "2026-06-16", status: "Verified", severity: "orange" },
  { id: 4, user: "Rudi S.", category: "Illegal Dumping", location: "Balikpapan, Kalimantan", date: "2026-06-15", status: "Submitted", severity: "yellow" },
  { id: 5, user: "Public User", category: "Wildlife Incident", location: "Danum Valley, Sabah", date: "2026-06-14", status: "Rejected", severity: "gray" },
];

const USERS = [
  { id: 1, name: "Ahmad Zulkifli", email: "ahmad@sabah.gov.my", role: "Admin", status: "Active", joined: "2025-01-10" },
  { id: 2, name: "Siti Norbaya", email: "siti@ngosarawak.org", role: "Editor", status: "Active", joined: "2025-03-22" },
  { id: 3, name: "Lim Kean Hock", email: "lim@researcher.edu", role: "Registered User", status: "Active", joined: "2025-06-01" },
  { id: 4, name: "Rudi Setiawan", email: "rudi@bps.go.id", role: "Editor", status: "Active", joined: "2025-08-14" },
  { id: 5, name: "Noor Hazwani", email: "noor@brunei.gov.bn", role: "Registered User", status: "Suspended", joined: "2025-11-30" },
  { id: 6, name: "James Tan", email: "james@wwf.org", role: "Registered User", status: "Active", joined: "2026-01-05" },
];

// ─── NAVIGATION CONFIG ────────────────────────────────────────────────────────

const PUBLIC_NAV = [
  { key: "dashboard", icon: "⊞", label: "Dashboard" },
  { key: "map", icon: "◎", label: "Borneo Map" },
  { key: "esg", icon: "≋", label: "ESG Indicators" },
  { key: "sdg", icon: "◉", label: "SDG Progress" },
  { key: "explorer", icon: "⊕", label: "Data Explorer" },
  { key: "alerts", icon: "⚑", label: "Alerts" },
  { key: "reports", icon: "☰", label: "Reports" },
  { key: "community", icon: "✦", label: "Community Reports" },
];

const ADMIN_NAV = [
  { key: "admin-dashboard", icon: "⊞", label: "Admin Overview" },
  { key: "manage-users", icon: "◑", label: "Manage Users" },
  { key: "manage-data", icon: "⊟", label: "Manage Data" },
  { key: "verify-reports", icon: "✓", label: "Verify Reports" },
  { key: "generate-reports", icon: "≡", label: "Report Generator" },
  { key: "settings", icon: "⚙", label: "System Settings" },
];

// ─── SIDEBAR ─────────────────────────────────────────────────────────────────

function Sidebar({ page, setPage, isAdmin, setIsAdmin, mobileOpen, setMobileOpen }) {
  const navItems = isAdmin ? ADMIN_NAV : PUBLIC_NAV;

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div onClick={() => setMobileOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 90 }} />
      )}
      <aside style={{
        width: SIDEBAR_W, background: C.sidebar, color: "#fff",
        display: "flex", flexDirection: "column", padding: "1.25rem 0.75rem",
        gap: 4, height: "100vh", position: "fixed", left: 0, top: 0, zIndex: 100,
        boxSizing: "border-box",
        transform: mobileOpen ? "translateX(0)" : undefined,
        transition: "transform .25s",
      }}>
        {/* Logo */}
        <div style={{ padding: "0 0.5rem 1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: "rgba(61,186,126,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
            }}>🌿</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: 1, lineHeight: 1.1 }}>BORNEO</div>
              <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: 1, lineHeight: 1.1 }}>TRACKER</div>
            </div>
          </div>
          <p style={{ fontSize: 11, color: "rgba(200,240,220,0.65)", margin: "8px 0 0", lineHeight: 1.5 }}>
            Tracking true wealth, building a resilient Borneo.
          </p>
        </div>

        {/* Mode toggle */}
        <div style={{
          display: "flex", borderRadius: 8, overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.1)", margin: "0 0 0.75rem",
        }}>
          <button onClick={() => { setIsAdmin(false); setPage("dashboard"); }}
            style={{ flex: 1, padding: "7px 0", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer",
              background: !isAdmin ? C.brandAccent : "transparent", color: !isAdmin ? "#fff" : "rgba(255,255,255,0.5)" }}>
            Public
          </button>
          <button onClick={() => { setIsAdmin(true); setPage("admin-dashboard"); }}
            style={{ flex: 1, padding: "7px 0", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer",
              background: isAdmin ? C.brandAccent : "transparent", color: isAdmin ? "#fff" : "rgba(255,255,255,0.5)" }}>
            Admin
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1 }}>
          {navItems.map(item => (
            <button key={item.key}
              onClick={() => { setPage(item.key); setMobileOpen(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                padding: "9px 12px", borderRadius: 8, border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: 500, textAlign: "left",
                background: page === item.key ? C.sidebarActive : "transparent",
                color: page === item.key ? C.brandAccent : "rgba(255,255,255,0.75)",
                transition: "all .15s",
              }}>
              <span style={{ fontSize: 14, width: 18 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Bottom card */}
        <div style={{
          borderRadius: 10, background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.08)", padding: "12px",
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Download App</div>
          <p style={{ fontSize: 11, color: "rgba(200,240,220,0.6)", margin: "0 0 10px" }}>Get updates on the go.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {["Google Play", "App Store"].map(s => (
              <div key={s} style={{
                background: "rgba(0,0,0,0.3)", borderRadius: 7,
                padding: "7px 10px", fontSize: 11, color: "rgba(255,255,255,0.7)", cursor: "pointer",
              }}>{s}</div>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}

// ─── TOPBAR ───────────────────────────────────────────────────────────────────

function Topbar({ setPage, mobileOpen, setMobileOpen, isLoggedIn, setIsLoggedIn }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      background: "#fff", borderRadius: 14, border: `1px solid ${C.border}`,
      padding: "10px 16px", marginBottom: "1.25rem",
    }}>
      <button onClick={() => setMobileOpen(!mobileOpen)}
        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, display: "flex",
          alignItems: "center", padding: 0, color: C.muted }}>☰</button>
      <input placeholder="Search indicators, regions, SDGs..."
        style={{ flex: 1, border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 14px",
          fontSize: 14, outline: "none", color: C.text }} />
      <button onClick={() => setPage("alerts")}
        style={{ background: C.brandLight, border: "none", borderRadius: 8, padding: "7px 12px",
          cursor: "pointer", fontSize: 16 }}>⚑</button>
      {isLoggedIn
        ? <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: C.brandMid,
              color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 700 }}>A</div>
            <button onClick={() => setIsLoggedIn(false)}
              style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 8,
                padding: "6px 12px", fontSize: 12, cursor: "pointer", color: C.muted }}>Logout</button>
          </div>
        : <button onClick={() => setIsLoggedIn(true)}
            style={{ background: C.brandMid, color: "#fff", border: "none", borderRadius: 8,
              padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Login / Register</button>
      }
    </div>
  );
}

// ─── SCREENS ──────────────────────────────────────────────────────────────────

// 1. DASHBOARD
function DashboardScreen({ setPage }) {
  const scoreColor = s => s >= 70 ? C.green : s >= 50 ? C.yellow : C.red;
  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Borneo island sustainability overview — updated June 2026" />

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))", gap: 12, marginBottom: "1.25rem" }}>
        {[
          { label: "Overall ESG Score", value: "64.7", unit: "/100", color: C.yellow },
          { label: "Forest Cover", value: "57.3%", color: C.yellow },
          { label: "Poverty Rate", value: "13.2%", color: C.yellow },
          { label: "Active Alerts", value: "6", color: C.red },
          { label: "SDGs On Track", value: "0 / 8", color: C.red },
          { label: "Community Reports", value: "214", color: C.brandAccent },
        ].map(k => (
          <Card key={k.label} pad="1rem">
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: k.color }}>{k.value}<span style={{ fontSize: 13, fontWeight: 400, color: C.muted }}>{k.unit}</span></div>
          </Card>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", marginBottom: "1.25rem" }}>
        {/* Territory scores */}
        <Card>
          <SectionTitle>Territory Resilience Scores</SectionTitle>
          {[
            { name: "Brunei", score: 78 },
            { name: "Sabah", score: 62 },
            { name: "Sarawak", score: 60 },
            { name: "Kalimantan", score: 44 },
          ].map(t => (
            <div key={t.name} style={{ marginBottom: 14 }}>
              <ProgressBar label={t.name} value={t.score} color={scoreColor(t.score)} />
            </div>
          ))}
        </Card>

        {/* SDG quick */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <SectionTitle>SDG Progress</SectionTitle>
            <span onClick={() => setPage("sdg")} style={{ fontSize: 12, color: C.brandMid, cursor: "pointer", fontWeight: 600 }}>View all →</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
            {SDG_DATA.map(s => (
              <div key={s.id} style={{
                borderRadius: 10, padding: "10px 6px", textAlign: "center",
                background: s.color + "22", border: `1px solid ${s.color}44`,
              }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: s.color }}>{s.id}</div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{s.title}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: s.color, marginTop: 4 }}>{s.score}%</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.25rem" }}>
        {/* Key indicators */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <SectionTitle>Key Indicators Snapshot</SectionTitle>
            <span onClick={() => setPage("esg")} style={{ fontSize: 12, color: C.brandMid, cursor: "pointer", fontWeight: 600 }}>View all →</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
            {[...ESG_DATA.environmental.slice(0,3), ...ESG_DATA.social.slice(0,3)].map(ind => (
              <div key={ind.name} style={{ background: C.page, borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontSize: 11, color: C.muted }}>{ind.name}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: C.text, margin: "4px 0" }}>{ind.value}</div>
                <Spark data={ind.spark} color={ind.rag === "green" ? C.green : ind.rag === "yellow" ? C.yellow : C.red} height={32} />
              </div>
            ))}
          </div>
        </Card>

        {/* Latest alerts */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <SectionTitle>Latest Alerts</SectionTitle>
            <span onClick={() => setPage("alerts")} style={{ fontSize: 12, color: C.brandMid, cursor: "pointer", fontWeight: 600 }}>View all →</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ALERTS.slice(0,4).map(a => (
              <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                background: C.page, borderRadius: 10, padding: "10px 12px" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{a.title}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{a.region}</div>
                </div>
                <Badge color={a.severity}>{a.severity === "red" ? "High" : a.severity === "orange" ? "Med" : "Low"}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Data sources */}
      <Card style={{ marginTop: "1.25rem" }}>
        <SectionTitle>Data Sources</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
          {[
            { name: "Global Forest Watch", desc: "Forest & deforestation data" },
            { name: "World Bank Open Data", desc: "Economic & poverty indicators" },
            { name: "UN SDG Database", desc: "SDG goals & sub-indicators" },
            { name: "OpenAQ", desc: "Real-time air quality" },
            { name: "NASA FIRMS", desc: "Satellite fire hotspots" },
            { name: "Gov. Open Portals", desc: "Malaysia, Indonesia, Brunei" },
          ].map(s => (
            <div key={s.name} style={{ background: C.page, borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{s.name}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// 2. MAP
function MapScreen() {
  const [selected, setSelected] = useState(null);
  const [layer, setLayer] = useState("resilience");
  const territories = [
    { key: "sabah", label: "Sabah", sub: "Malaysia", score: 62, color: "#22a86e", textColor: "#fff",
      path: "M420,90 L490,80 L560,90 L610,140 L640,200 L620,260 L570,290 L500,300 L440,280 L400,230 L390,170 Z",
      cx: 505, cy: 190 },
    { key: "sarawak", label: "Sarawak", sub: "Malaysia", score: 60, color: "#3b9cd4", textColor: "#fff",
      path: "M220,180 L300,150 L380,150 L420,180 L430,240 L410,290 L350,330 L280,340 L220,310 L190,260 Z",
      cx: 310, cy: 250 },
    { key: "kalimantan", label: "Kalimantan", sub: "Indonesia", score: 44, color: "#f59e0b", textColor: "#fff",
      path: "M300,290 L420,280 L540,295 L640,330 L680,400 L650,460 L560,490 L450,500 L340,480 L260,440 L240,370 Z",
      cx: 455, cy: 390 },
    { key: "brunei", label: "Brunei", sub: "Darussalam", score: 78, color: "#a78bfa", textColor: "#fff",
      path: "M460,250 L500,240 L530,255 L525,285 L490,295 L460,282 Z",
      cx: 493, cy: 268 },
  ];
  const sel = territories.find(t => t.key === selected);

  return (
    <div>
      <PageHeader title="Borneo Map" subtitle="Interactive territory map — click a region to explore" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: "1.25rem" }}>
        <Card pad="1rem">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.muted }}>Map Layer</div>
            <Select value={layer} onChange={setLayer} options={[
              { value: "resilience", label: "Overall Resilience" },
              { value: "forest", label: "Forest Cover" },
              { value: "air", label: "Air Quality" },
              { value: "poverty", label: "Poverty Rate" },
              { value: "fire", label: "Fire Hotspots" },
            ]} />
          </div>
          <svg viewBox="0 0 900 580" style={{ width: "100%", borderRadius: 10, background: "linear-gradient(180deg,#dff4ff,#b8e8ff)" }}>
            {territories.map(t => (
              <g key={t.key} onClick={() => setSelected(t.key === selected ? null : t.key)} style={{ cursor: "pointer" }}>
                <path d={t.path} fill={t.color}
                  stroke={selected === t.key ? "#fff" : "rgba(255,255,255,0.6)"}
                  strokeWidth={selected === t.key ? 3 : 1.5}
                  opacity={selected && selected !== t.key ? 0.55 : 0.92} />
                <text x={t.cx} y={t.cy - 8} textAnchor="middle" fill={t.textColor} fontSize={14} fontWeight="800">{t.label}</text>
                <text x={t.cx} y={t.cy + 10} textAnchor="middle" fill={t.textColor} fontSize={11} opacity={0.85}>({t.sub})</text>
                <text x={t.cx} y={t.cy + 26} textAnchor="middle" fill={t.textColor} fontSize={12} fontWeight="700">{t.score}/100</text>
              </g>
            ))}
          </svg>

          {/* Legend */}
          <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
            {[["#22c55e","≥70 Excellent"],["#84cc16","60–69 Good"],["#eab308","50–59 Moderate"],["#f97316","40–49 Poor"],["#ef4444","<40 Critical"]].map(([c,l]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: C.muted }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: c, display: "inline-block" }} />{l}
              </div>
            ))}
          </div>
        </Card>

        {/* Side panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {sel ? (
            <Card>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 4 }}>{sel.label}</div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>{sel.sub}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <ProgressBar label="Resilience Score" value={sel.score} color={sel.score >= 70 ? C.green : sel.score >= 50 ? C.yellow : C.red} />
                {ESG_DATA.environmental.slice(0,3).map(e => (
                  <div key={e.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: C.muted }}>{e.name}</span>
                    <span style={{ fontWeight: 600 }}>{e.value}</span>
                  </div>
                ))}
              </div>
            </Card>
          ) : (
            <Card>
              <div style={{ fontSize: 13, color: C.muted, textAlign: "center", padding: "1rem 0" }}>
                Click a territory on the map to view its details.
              </div>
            </Card>
          )}

          <Card>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 10 }}>Territory Summary</div>
            {territories.map(t => (
              <div key={t.key} onClick={() => setSelected(t.key === selected ? null : t.key)}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 0", borderBottom: `1px solid ${C.border}`, cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: t.color, display: "inline-block" }} />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{t.label}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: t.score >= 70 ? C.green : t.score >= 50 ? C.yellow : C.red }}>
                  {t.score}
                </span>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}

// 3. ESG INDICATORS
function ESGScreen() {
  const [territory, setTerritory] = useState("All Borneo");
  const [pillar, setPillar] = useState("all");
  const pillars = [
    { key: "all", label: "All Pillars" },
    { key: "environmental", label: "Environmental" },
    { key: "social", label: "Social" },
    { key: "governance", label: "Governance" },
  ];
  const pillarData = pillar === "all"
    ? Object.entries(ESG_DATA)
    : [[pillar, ESG_DATA[pillar]]];

  return (
    <div>
      <PageHeader title="ESG Indicators" subtitle="Environmental, Social, and Governance metrics across Borneo territories" />
      <div style={{ display: "flex", gap: 10, marginBottom: "1.25rem", flexWrap: "wrap" }}>
        <Select value={territory} onChange={setTerritory}
          options={TERRITORIES.map(t => ({ value: t, label: t }))} />
        <div style={{ display: "flex", gap: 6 }}>
          {pillars.map(p => (
            <button key={p.key} onClick={() => setPillar(p.key)}
              style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${C.border}`, cursor: "pointer",
                fontSize: 13, fontWeight: 500,
                background: pillar === p.key ? C.brandMid : "#fff",
                color: pillar === p.key ? "#fff" : C.muted }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {pillarData.map(([key, indicators]) => (
        <Card key={key} style={{ marginBottom: "1.25rem" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: "1rem", textTransform: "capitalize",
            borderBottom: `2px solid ${key === "environmental" ? C.green : key === "social" ? C.blue : C.brandAccent}`,
            paddingBottom: 8, display: "inline-block" }}>
            {key} indicators
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {["Indicator","Value","Trend","Status","Trend Chart","Source"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: C.muted, fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {indicators.map(ind => (
                  <tr key={ind.name} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: "10px", fontWeight: 500, color: C.text }}>{ind.name}</td>
                    <td style={{ padding: "10px", fontWeight: 700, color: C.text }}>{ind.value}</td>
                    <td style={{ padding: "10px" }}>
                      <span style={{ color: ind.trend === "up" ? C.green : ind.trend === "down" ? C.red : C.yellow, fontSize: 16 }}>
                        {ind.trend === "up" ? "↑" : ind.trend === "down" ? "↓" : "→"}
                      </span>
                    </td>
                    <td style={{ padding: "10px" }}>
                      <Badge color={ind.rag}>{ind.rag === "green" ? "On Track" : ind.rag === "yellow" ? "Moderate" : "Critical"}</Badge>
                    </td>
                    <td style={{ padding: "10px" }}>
                      <Spark data={ind.spark} color={ind.rag === "green" ? C.green : ind.rag === "yellow" ? C.yellow : C.red} />
                    </td>
                    <td style={{ padding: "10px", color: C.muted }}>{ind.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  );
}

// 4. SDG PROGRESS
function SDGScreen() {
  const [territory, setTerritory] = useState("All Borneo");
  const [expanded, setExpanded] = useState(null);
  const subIndicators = {
    1: ["Population below $2.15/day","Social protection coverage","Access to basic services"],
    3: ["Under-5 mortality rate","Maternal mortality ratio","Universal health coverage"],
    4: ["Primary education completion","Secondary enrollment rate","Youth & adult literacy"],
    6: ["Access to safe drinking water","Sanitation coverage","Water quality index"],
    8: ["GDP growth per capita","Youth unemployment rate","Labour productivity"],
    13: ["GHG emissions per capita","Climate policy implementation","Disaster risk reduction"],
    15: ["Forest area % of land","Protected area coverage","Threatened species index"],
    16: ["Homicide rate","Corruption perception","Access to justice"],
  };
  return (
    <div>
      <PageHeader title="SDG Progress" subtitle="UN Sustainable Development Goals tracking across Borneo" />
      <div style={{ marginBottom: "1.25rem" }}>
        <Select value={territory} onChange={setTerritory}
          options={TERRITORIES.map(t => ({ value: t, label: t }))} />
      </div>

      {/* Status legend */}
      <div style={{ display: "flex", gap: 10, marginBottom: "1.25rem", flexWrap: "wrap" }}>
        {[["green","On Track"],["yellow","Needs Attention"],["red","Critical"],["gray","No Data"]].map(([c,l]) => (
          <Badge key={l} color={c}>{l}</Badge>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: "1rem" }}>
        {SDG_DATA.map(s => (
          <Card key={s.id}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: s.color, display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontWeight: 800, fontSize: 16, flexShrink: 0,
                }}>SDG{s.id}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{s.title}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                    <Badge color={s.status}>{s.status === "green" ? "On Track" : s.status === "yellow" ? "Needs Attention" : "Critical"}</Badge>
                    <span style={{ fontSize: 12, color: s.trend === "up" ? C.green : s.trend === "down" ? C.red : C.yellow }}>
                      {s.trend === "up" ? "↑" : s.trend === "down" ? "↓" : "→"}
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.score}%</div>
            </div>
            <ProgressBar value={s.score} color={s.color} />
            <button onClick={() => setExpanded(expanded === s.id ? null : s.id)}
              style={{ marginTop: 10, background: "none", border: "none", cursor: "pointer",
                fontSize: 12, color: C.brandMid, fontWeight: 600, padding: 0 }}>
              {expanded === s.id ? "Hide" : "Show"} sub-indicators {expanded === s.id ? "▲" : "▼"}
            </button>
            {expanded === s.id && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
                {(subIndicators[s.id] || []).map(sub => (
                  <div key={sub} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0", color: C.muted }}>
                    <span>{sub}</span>
                    <span style={{ fontWeight: 600, color: C.text }}>{(Math.random() * 40 + 40).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

// 5. DATA EXPLORER
function ExplorerScreen() {
  const [territory, setTerritory] = useState("All Borneo");
  const [search, setSearch] = useState("");
  const allIndicators = [
    ...ESG_DATA.environmental.map(i => ({ ...i, pillar: "Environmental" })),
    ...ESG_DATA.social.map(i => ({ ...i, pillar: "Social" })),
    ...ESG_DATA.governance.map(i => ({ ...i, pillar: "Governance" })),
  ];
  const filtered = allIndicators.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.pillar.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div>
      <PageHeader title="Data Explorer" subtitle="Browse, search, filter, and export all Borneo sustainability data"
        action={<Btn variant="secondary">Export CSV</Btn>} />
      <div style={{ display: "flex", gap: 10, marginBottom: "1.25rem", flexWrap: "wrap" }}>
        <Input placeholder="Search indicators..." value={search} onChange={setSearch} style={{ maxWidth: 280 }} />
        <Select value={territory} onChange={setTerritory}
          options={TERRITORIES.map(t => ({ value: t, label: t }))} />
        <Select value="all" onChange={() => {}} options={[
          { value: "all", label: "All Years" },
          { value: "2025", label: "2025" },
          { value: "2024", label: "2024" },
          { value: "2023", label: "2023" },
        ]} />
        <Btn variant="ghost">Export Excel</Btn>
      </div>
      <Card pad="0">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.page }}>
                {["Indicator","Pillar","Value","Unit","Trend","Status","Source","Updated"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 14px", color: C.muted, fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(ind => (
                <tr key={ind.name} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: "10px 14px", fontWeight: 500, color: C.text }}>{ind.name}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <Badge color={ind.pillar === "Environmental" ? "green" : ind.pillar === "Social" ? "blue" : "gray"}>
                      {ind.pillar}
                    </Badge>
                  </td>
                  <td style={{ padding: "10px 14px", fontWeight: 700 }}>{ind.value}</td>
                  <td style={{ padding: "10px 14px", color: C.muted }}>{ind.unit}</td>
                  <td style={{ padding: "10px 14px", fontSize: 16 }}>
                    {ind.trend === "up" ? <span style={{ color: C.green }}>↑</span> : ind.trend === "down" ? <span style={{ color: C.red }}>↓</span> : <span style={{ color: C.yellow }}>→</span>}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <RAGDot status={ind.rag} />
                    {ind.rag === "green" ? "On Track" : ind.rag === "yellow" ? "Moderate" : "Critical"}
                  </td>
                  <td style={{ padding: "10px 14px", color: C.muted }}>{ind.source}</td>
                  <td style={{ padding: "10px 14px", color: C.muted }}>Jun 2026</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "12px 14px", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", fontSize: 13, color: C.muted }}>
          <span>Showing {filtered.length} of {allIndicators.length} indicators</span>
          <div style={{ display: "flex", gap: 6 }}>
            {["← Prev","1","2","Next →"].map(l => (
              <button key={l} style={{ padding: "4px 10px", border: `1px solid ${C.border}`, borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 12 }}>{l}</button>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

// 6. ALERTS
function AlertsScreen() {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? ALERTS : ALERTS.filter(a => a.severity === filter);
  return (
    <div>
      <PageHeader title="Alerts & Notifications" subtitle="Real-time environmental and sustainability alerts across Borneo"
        action={<Btn>Subscribe to Alerts</Btn>} />
      <div style={{ display: "flex", gap: 10, marginBottom: "1.25rem" }}>
        {[["all","All"],["red","High"],["orange","Medium"],["yellow","Low"]].map(([v,l]) => (
          <button key={v} onClick={() => setFilter(v)}
            style={{ padding: "7px 16px", borderRadius: 8, border: `1px solid ${C.border}`, cursor: "pointer",
              fontSize: 13, fontWeight: 500,
              background: filter === v ? C.brandMid : "#fff",
              color: filter === v ? "#fff" : C.muted }}>
            {l}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: "1.25rem" }}>
        {[["High Priority","2",C.red],["Medium Priority","2",C.orange],["Low Priority","2",C.yellow]].map(([l,v,c]) => (
          <Card key={l} pad="1rem" style={{ borderLeft: `3px solid ${c}` }}>
            <div style={{ fontSize: 12, color: C.muted }}>{l}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: c }}>{v}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map(a => (
          <Card key={a.id} style={{ borderLeft: `3px solid ${a.severity === "red" ? C.red : a.severity === "orange" ? C.orange : C.yellow}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: C.text }}>{a.title}</div>
                <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{a.region} · {a.time}</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Badge color={a.severity}>{a.severity === "red" ? "High" : a.severity === "orange" ? "Medium" : "Low"}</Badge>
                <Btn small variant="ghost">View Details</Btn>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// 7. REPORTS
function ReportsScreen() {
  const [territory, setTerritory] = useState("All Borneo");
  const [type, setType] = useState("ESG Summary");
  return (
    <div>
      <PageHeader title="Reports" subtitle="Generate and export sustainability reports for Borneo territories" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1.25rem" }}>
        <Card>
          <SectionTitle>Report Builder</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ fontSize: 13, color: C.muted, display: "block", marginBottom: 6 }}>Report Type</label>
              <Select value={type} onChange={setType} style={{ width: "100%" }} options={[
                { value: "ESG Summary", label: "ESG Summary" },
                { value: "SDG Progress", label: "SDG Progress" },
                { value: "Territory Comparison", label: "Territory Comparison" },
                { value: "Community Reports", label: "Community Reports" },
                { value: "Full Borneo Report", label: "Full Borneo Report" },
              ]} />
            </div>
            <div>
              <label style={{ fontSize: 13, color: C.muted, display: "block", marginBottom: 6 }}>Territory</label>
              <Select value={territory} onChange={setTerritory} style={{ width: "100%" }}
                options={TERRITORIES.map(t => ({ value: t, label: t }))} />
            </div>
            <div>
              <label style={{ fontSize: 13, color: C.muted, display: "block", marginBottom: 6 }}>Date Range</label>
              <Select value="2025-2026" onChange={() => {}} style={{ width: "100%" }} options={[
                { value: "2025-2026", label: "2025 – 2026" },
                { value: "2020-2026", label: "2020 – 2026" },
                { value: "2015-2026", label: "2015 – 2026 (Full)" },
              ]} />
            </div>
            <Btn>Generate Report</Btn>
            <Btn variant="ghost">Schedule Auto-Report</Btn>
          </div>
        </Card>

        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <SectionTitle>Recent Reports</SectionTitle>
            <Btn small variant="ghost">View All</Btn>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { name: "Borneo ESG Summary Q1 2026", date: "01 Apr 2026", type: "ESG Summary", format: "PDF" },
              { name: "Kalimantan Deforestation Report", date: "15 Mar 2026", type: "Environmental", format: "Excel" },
              { name: "SDG Progress — All Territories", date: "01 Mar 2026", type: "SDG Progress", format: "PDF" },
              { name: "Sabah Social Indicators 2025", date: "10 Feb 2026", type: "Social", format: "PDF" },
              { name: "Community Reports Q4 2025", date: "01 Jan 2026", type: "Community", format: "Excel" },
            ].map(r => (
              <div key={r.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                background: C.page, borderRadius: 10, padding: "10px 14px" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{r.date} · {r.type}</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <Badge color={r.format === "PDF" ? "red" : "green"}>{r.format}</Badge>
                  <Btn small variant="ghost">↓</Btn>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// 8. COMMUNITY REPORTS
function CommunityScreen({ isLoggedIn }) {
  const [showForm, setShowForm] = useState(false);
  const [cat, setCat] = useState("Pollution");
  const [desc, setDesc] = useState("");
  const [loc, setLoc] = useState("");
  return (
    <div>
      <PageHeader title="Community Reports" subtitle="Public submissions of environmental and social incidents across Borneo"
        action={isLoggedIn && <Btn onClick={() => setShowForm(!showForm)}>+ Submit Report</Btn>} />

      {!isLoggedIn && (
        <Card style={{ marginBottom: "1.25rem", borderLeft: `3px solid ${C.brandAccent}` }}>
          <div style={{ fontSize: 14, color: C.muted }}>
            🔒 <strong>Login required</strong> to submit community reports. Public users can view existing reports.
          </div>
        </Card>
      )}

      {showForm && isLoggedIn && (
        <Card style={{ marginBottom: "1.25rem" }}>
          <SectionTitle>Submit a Report</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={{ fontSize: 13, color: C.muted, display: "block", marginBottom: 6 }}>Category</label>
              <Select value={cat} onChange={setCat} style={{ width: "100%" }} options={
                ["Pollution","Forest Fire","Flood","Illegal Dumping","Deforestation","Wildlife Incident","Other"].map(c => ({ value: c, label: c }))
              } />
            </div>
            <div>
              <label style={{ fontSize: 13, color: C.muted, display: "block", marginBottom: 6 }}>Location</label>
              <Input placeholder="e.g. Kota Kinabalu, Sabah" value={loc} onChange={setLoc} />
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <label style={{ fontSize: 13, color: C.muted, display: "block", marginBottom: 6 }}>Description</label>
              <textarea value={desc} onChange={e => setDesc(e.target.value)}
                placeholder="Describe the incident in detail..."
                style={{ width: "100%", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px",
                  fontSize: 14, outline: "none", minHeight: 80, resize: "vertical", boxSizing: "border-box" }} />
            </div>
            <div style={{ gridColumn: "1/-1", display: "flex", gap: 10 }}>
              <Btn>Submit Report</Btn>
              <Btn variant="ghost" onClick={() => setShowForm(false)}>Cancel</Btn>
            </div>
          </div>
        </Card>
      )}

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: "1.25rem" }}>
        {[["Total Reports","214"],["Verified","128"],["Under Review","56"],["This Month","32"]].map(([l,v]) => (
          <Card key={l} pad="1rem">
            <div style={{ fontSize: 12, color: C.muted }}>{l}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: C.text }}>{v}</div>
          </Card>
        ))}
      </div>

      <Card pad="0">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: C.page }}>
              {["Submitted By","Category","Location","Date","Status","Severity"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "10px 14px", color: C.muted, fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMMUNITY_REPORTS.map(r => (
              <tr key={r.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: "10px 14px", fontWeight: 500 }}>{r.user}</td>
                <td style={{ padding: "10px 14px" }}>{r.category}</td>
                <td style={{ padding: "10px 14px", color: C.muted }}>{r.location}</td>
                <td style={{ padding: "10px 14px", color: C.muted }}>{r.date}</td>
                <td style={{ padding: "10px 14px" }}>
                  <Badge color={r.status === "Verified" ? "green" : r.status === "Under Review" ? "yellow" : r.status === "Rejected" ? "gray" : "blue"}>
                    {r.status}
                  </Badge>
                </td>
                <td style={{ padding: "10px 14px" }}><Badge color={r.severity}>{r.severity}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── ADMIN SCREENS ────────────────────────────────────────────────────────────

function AdminDashboard({ setPage }) {
  return (
    <div>
      <PageHeader title="Admin Overview" subtitle="Back-office control centre for Borneo Tracker" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: "1.25rem" }}>
        {[
          { label: "Total Users", value: "6", color: C.brandAccent, page: "manage-users" },
          { label: "Pending Verifications", value: "3", color: C.yellow, page: "verify-reports" },
          { label: "Data Entries", value: "342", color: C.blue, page: "manage-data" },
          { label: "Active Alerts", value: "6", color: C.red, page: null },
          { label: "Reports Generated", value: "28", color: C.brandMid, page: "generate-reports" },
          { label: "Last Sync", value: "2h ago", color: C.muted, page: null },
        ].map(k => (
          <Card key={k.label} pad="1rem" style={{ cursor: k.page ? "pointer" : "default" }}
            onClick={() => k.page && setPage(k.page)}>
            <div style={{ fontSize: 12, color: C.muted }}>{k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: k.color, marginTop: 4 }}>{k.value}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
        <Card>
          <SectionTitle>Quick Actions</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { label: "Add New Data Entry", page: "manage-data" },
              { label: "Verify Pending Reports", page: "verify-reports" },
              { label: "Manage Users", page: "manage-users" },
              { label: "Generate Monthly Report", page: "generate-reports" },
              { label: "System Settings", page: "settings" },
            ].map(a => (
              <button key={a.label} onClick={() => setPage(a.page)}
                style={{ background: C.brandLight, border: "none", borderRadius: 8, padding: "10px 14px",
                  textAlign: "left", cursor: "pointer", fontSize: 13, fontWeight: 500, color: C.brand }}>
                {a.label} →
              </button>
            ))}
          </div>
        </Card>
        <Card>
          <SectionTitle>Recent Activity Log</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { msg: "Ahmad approved a community report", time: "10m ago" },
              { msg: "Siti updated Forest Cover data (Sabah)", time: "1h ago" },
              { msg: "New user registered: james@wwf.org", time: "3h ago" },
              { msg: "Monthly report generated — Q1 2026", time: "1d ago" },
              { msg: "API sync completed — World Bank", time: "2h ago" },
            ].map((a, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13,
                padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ color: C.text }}>{a.msg}</span>
                <span style={{ color: C.muted, whiteSpace: "nowrap", marginLeft: 8 }}>{a.time}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function ManageUsersScreen() {
  const [search, setSearch] = useState("");
  const filtered = USERS.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.includes(search));
  return (
    <div>
      <PageHeader title="Manage Users" subtitle="Create, assign roles, and manage all registered users"
        action={<Btn>+ Add User</Btn>} />
      <div style={{ display: "flex", gap: 10, marginBottom: "1.25rem" }}>
        <Input placeholder="Search users..." value={search} onChange={setSearch} style={{ maxWidth: 280 }} />
        <Select value="all" onChange={() => {}} options={[
          { value: "all", label: "All Roles" },
          { value: "admin", label: "Admin" },
          { value: "editor", label: "Editor" },
          { value: "user", label: "Registered User" },
        ]} />
        <Select value="all" onChange={() => {}} options={[
          { value: "all", label: "All Status" },
          { value: "active", label: "Active" },
          { value: "suspended", label: "Suspended" },
        ]} />
      </div>
      <Card pad="0">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: C.page }}>
              {["Name","Email","Role","Status","Joined","Actions"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "10px 14px", color: C.muted, fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: "10px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 30, height: 30, borderRadius: "50%", background: C.brandLight,
                      color: C.brand, display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 700, fontSize: 12 }}>{u.name[0]}</div>
                    <span style={{ fontWeight: 500 }}>{u.name}</span>
                  </div>
                </td>
                <td style={{ padding: "10px 14px", color: C.muted }}>{u.email}</td>
                <td style={{ padding: "10px 14px" }}>
                  <Badge color={u.role === "Admin" ? "blue" : u.role === "Editor" ? "green" : "gray"}>{u.role}</Badge>
                </td>
                <td style={{ padding: "10px 14px" }}>
                  <Badge color={u.status === "Active" ? "green" : "red"}>{u.status}</Badge>
                </td>
                <td style={{ padding: "10px 14px", color: C.muted }}>{u.joined}</td>
                <td style={{ padding: "10px 14px" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <Btn small variant="secondary">Edit</Btn>
                    <Btn small variant="danger">{u.status === "Active" ? "Suspend" : "Activate"}</Btn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function ManageDataScreen() {
  const [showAdd, setShowAdd] = useState(false);
  return (
    <div>
      <PageHeader title="Manage Data" subtitle="Add, update, verify and manage all indicator data entries"
        action={<Btn onClick={() => setShowAdd(!showAdd)}>+ Add Entry</Btn>} />

      {showAdd && (
        <Card style={{ marginBottom: "1.25rem" }}>
          <SectionTitle>New Data Entry</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            {[
              { label: "Territory", type: "select", opts: TERRITORIES.slice(1) },
              { label: "Pillar", type: "select", opts: ["Environmental","Social","Governance"] },
              { label: "Indicator", type: "text", ph: "e.g. Forest Cover" },
              { label: "Value", type: "text", ph: "e.g. 57.3" },
              { label: "Unit", type: "text", ph: "e.g. %" },
              { label: "Year", type: "text", ph: "e.g. 2026" },
              { label: "Source", type: "text", ph: "e.g. World Bank" },
            ].map(f => (
              <div key={f.label}>
                <label style={{ fontSize: 13, color: C.muted, display: "block", marginBottom: 6 }}>{f.label}</label>
                {f.type === "select"
                  ? <Select value={f.opts[0]} onChange={() => {}} style={{ width: "100%" }} options={f.opts.map(o => ({ value: o, label: o }))} />
                  : <Input placeholder={f.ph} value="" onChange={() => {}} />}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <Btn>Submit for Review</Btn>
            <Btn variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Btn>
          </div>
        </Card>
      )}

      {/* Bulk upload */}
      <Card style={{ marginBottom: "1.25rem", borderLeft: `3px solid ${C.blue}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Bulk Upload via CSV</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Download the template, fill in data, and upload.</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn small variant="ghost">Download Template</Btn>
            <Btn small variant="secondary">Upload CSV</Btn>
          </div>
        </div>
      </Card>

      <Card pad="0">
        <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>All Data Entries</span>
          <Select value="all" onChange={() => {}} options={[
            { value: "all", label: "All Status" },
            { value: "published", label: "Published" },
            { value: "draft", label: "Draft" },
            { value: "pending", label: "Pending Review" },
          ]} />
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: C.page }}>
              {["Indicator","Territory","Value","Year","Status","Submitted By","Actions"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "10px 14px", color: C.muted, fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { ind: "Forest Cover", ter: "Sabah", val: "61.2%", yr: 2026, status: "Published", by: "Siti N." },
              { ind: "Air Quality Index", ter: "Brunei", val: "38", yr: 2026, status: "Pending Review", by: "Rudi S." },
              { ind: "Poverty Rate", ter: "Kalimantan", val: "18.4%", yr: 2025, status: "Draft", by: "Lim K." },
              { ind: "Employment Rate", ter: "Sarawak", val: "65.2%", yr: 2026, status: "Published", by: "Ahmad Z." },
              { ind: "Carbon Emissions", ter: "All Borneo", val: "1.22 Gt", yr: 2025, status: "Published", by: "Admin" },
            ].map((r, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: "10px 14px", fontWeight: 500 }}>{r.ind}</td>
                <td style={{ padding: "10px 14px", color: C.muted }}>{r.ter}</td>
                <td style={{ padding: "10px 14px", fontWeight: 700 }}>{r.val}</td>
                <td style={{ padding: "10px 14px", color: C.muted }}>{r.yr}</td>
                <td style={{ padding: "10px 14px" }}>
                  <Badge color={r.status === "Published" ? "green" : r.status === "Pending Review" ? "yellow" : "gray"}>{r.status}</Badge>
                </td>
                <td style={{ padding: "10px 14px", color: C.muted }}>{r.by}</td>
                <td style={{ padding: "10px 14px" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <Btn small variant="secondary">Edit</Btn>
                    <Btn small variant="danger">Delete</Btn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function VerifyReportsScreen() {
  return (
    <div>
      <PageHeader title="Verify Reports" subtitle="Review and approve or reject community-submitted reports" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: "1.25rem" }}>
        {[["Pending Review","3",C.yellow],["Verified Today","5",C.green],["Rejected Today","2",C.red]].map(([l,v,c]) => (
          <Card key={l} pad="1rem">
            <div style={{ fontSize: 12, color: C.muted }}>{l}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: c }}>{v}</div>
          </Card>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {COMMUNITY_REPORTS.filter(r => r.status === "Under Review" || r.status === "Submitted").map(r => (
          <Card key={r.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{r.category} — {r.location}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Submitted by {r.user} on {r.date}</div>
                <Badge color={r.status === "Under Review" ? "yellow" : "blue"} >{r.status}</Badge>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn small>✓ Verify</Btn>
                <Btn small variant="danger">✕ Reject</Btn>
                <Btn small variant="ghost">View Details</Btn>
              </div>
            </div>
            <div style={{ marginTop: 10, padding: "8px 10px", background: C.page, borderRadius: 8, fontSize: 13, color: C.muted }}>
              Admin notes: <input placeholder="Add a note..." style={{ border: "none", background: "transparent", outline: "none", fontSize: 13, color: C.text, width: "80%" }} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function GenerateReportsScreen() {
  return (
    <div>
      <PageHeader title="Report Generator" subtitle="Create, schedule, and export sustainability reports" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1.25rem" }}>
        <Card>
          <SectionTitle>Configure Report</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { label: "Report Type", opts: ["ESG Summary","SDG Progress","Territory Comparison","Community Reports","Full Borneo Report"] },
              { label: "Territory", opts: TERRITORIES },
              { label: "Date Range", opts: ["2025–2026","2020–2026","2015–2026 (Full)"] },
              { label: "Format", opts: ["PDF","Excel (.xlsx)","CSV"] },
            ].map(f => (
              <div key={f.label}>
                <label style={{ fontSize: 13, color: C.muted, display: "block", marginBottom: 4 }}>{f.label}</label>
                <Select value={f.opts[0]} onChange={() => {}} style={{ width: "100%" }}
                  options={f.opts.map(o => ({ value: o, label: o }))} />
              </div>
            ))}
            <Btn>Generate Now</Btn>
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 8 }}>Schedule Auto-Report</div>
              <Select value="monthly" onChange={() => {}} style={{ width: "100%" }} options={[
                { value: "monthly", label: "Monthly" },
                { value: "quarterly", label: "Quarterly" },
                { value: "yearly", label: "Yearly" },
              ]} />
              <Input placeholder="Delivery email(s)" value="" onChange={() => {}} style={{ marginTop: 8 }} />
              <Btn variant="ghost" style={{ marginTop: 8, width: "100%" }}>Save Schedule</Btn>
            </div>
          </div>
        </Card>
        <Card>
          <SectionTitle>Generated Reports Archive</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { name: "Full Borneo Sustainability Report Q1 2026", date: "01 Apr 2026", format: "PDF", size: "2.4 MB" },
              { name: "Kalimantan ESG Summary — Mar 2026", date: "31 Mar 2026", format: "PDF", size: "1.1 MB" },
              { name: "SDG Progress All Territories 2025", date: "01 Jan 2026", format: "Excel", size: "856 KB" },
              { name: "Community Reports Q4 2025", date: "02 Jan 2026", format: "PDF", size: "640 KB" },
              { name: "Sabah Environmental Indicators 2025", date: "15 Dec 2025", format: "CSV", size: "120 KB" },
            ].map((r, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                background: C.page, borderRadius: 10, padding: "10px 14px" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{r.date} · {r.size}</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <Badge color={r.format === "PDF" ? "red" : r.format === "Excel" ? "green" : "blue"}>{r.format}</Badge>
                  <Btn small variant="ghost">↓ Download</Btn>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function SettingsScreen() {
  return (
    <div>
      <PageHeader title="System Settings" subtitle="Configure indicators, data sources, alerts, and system behaviour" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
        <Card>
          <SectionTitle>Alert Thresholds</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { label: "AQI — Alert above", value: "100" },
              { label: "Deforestation spike — Alert above (ha/month)", value: "5000" },
              { label: "Fire hotspots — Alert above (count)", value: "50" },
              { label: "Water quality — Alert below (score)", value: "50" },
            ].map(f => (
              <div key={f.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={{ fontSize: 13, color: C.muted, flex: 1 }}>{f.label}</label>
                <Input value={f.value} onChange={() => {}} style={{ width: 90, textAlign: "right" }} />
              </div>
            ))}
            <Btn>Save Thresholds</Btn>
          </div>
        </Card>
        <Card>
          <SectionTitle>Data Source API Config</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { name: "Global Forest Watch", status: "Connected", freq: "Daily" },
              { name: "World Bank API", status: "Connected", freq: "Weekly" },
              { name: "UN SDG Database", status: "Connected", freq: "Monthly" },
              { name: "OpenAQ", status: "Connected", freq: "Hourly" },
              { name: "NASA FIRMS", status: "Error", freq: "Daily" },
            ].map(s => (
              <div key={s.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                background: C.page, borderRadius: 10, padding: "9px 12px" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>Sync: {s.freq}</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <Badge color={s.status === "Connected" ? "green" : "red"}>{s.status}</Badge>
                  <Btn small variant="ghost">Config</Btn>
                </div>
              </div>
            ))}
            <Btn variant="secondary">Run Manual Sync</Btn>
          </div>
        </Card>
        <Card>
          <SectionTitle>Indicator Management</SectionTitle>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 10 }}>Add, enable, or disable tracked indicators.</div>
          <Btn variant="secondary">Manage Indicators</Btn>
        </Card>
        <Card>
          <SectionTitle>Territory Configuration</SectionTitle>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 10 }}>Update territory boundaries, metadata, and contacts.</div>
          <Btn variant="secondary">Manage Territories</Btn>
        </Card>
      </div>
    </div>
  );
}

// ─── ROUTER ───────────────────────────────────────────────────────────────────

function renderScreen(page, props) {
  const map = {
    dashboard: <DashboardScreen setPage={props.setPage} />,
    map: <MapScreen />,
    esg: <ESGScreen />,
    sdg: <SDGScreen />,
    explorer: <ExplorerScreen />,
    alerts: <AlertsScreen />,
    reports: <ReportsScreen />,
    community: <CommunityScreen isLoggedIn={props.isLoggedIn} />,
    "admin-dashboard": <AdminDashboard setPage={props.setPage} />,
    "manage-users": <ManageUsersScreen />,
    "manage-data": <ManageDataScreen />,
    "verify-reports": <VerifyReportsScreen />,
    "generate-reports": <GenerateReportsScreen />,
    settings: <SettingsScreen />,
  };
  return map[page] || map["dashboard"];
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: C.page, fontFamily: "Inter, system-ui, sans-serif" }}>
      <Sidebar page={page} setPage={setPage} isAdmin={isAdmin} setIsAdmin={setIsAdmin}
        mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <div style={{ marginLeft: SIDEBAR_W, flex: 1, padding: "1.25rem", minWidth: 0, boxSizing: "border-box" }}>
        <Topbar setPage={setPage} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen}
          isLoggedIn={isLoggedIn} setIsLoggedIn={setIsLoggedIn} />
        {renderScreen(page, { setPage, isLoggedIn })}
        <footer style={{ marginTop: "2rem", paddingTop: "1rem", borderTop: `1px solid ${C.border}`,
          display: "flex", justifyContent: "space-between", fontSize: 12, color: C.lighter }}>
          <span>© 2026 Borneo Tracker. All rights reserved.</span>
          <div style={{ display: "flex", gap: 16 }}>
            {["Privacy Policy","Terms of Use","Data Policy","Contact Us"].map(l => (
              <span key={l} style={{ cursor: "pointer" }}>{l}</span>
            ))}
          </div>
        </footer>
      </div>
    </div>
  );
}
