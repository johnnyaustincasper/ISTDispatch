import { useState, useEffect } from "react";
import { db } from "./firebase.js";
import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  getDocs,
  getDoc,
  setDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";

// ─── Constants ───
const JOB_TYPES = ["Foam","Fiberglass","Removal"];
const STATUS_OPTIONS = [
  { value: "not_started", label: "Not Started", color: "#6b7280", bg: "#f3f4f6" },
  { value: "en_route", label: "En Route", color: "#1d4ed8", bg: "#dbeafe" },
  { value: "in_progress", label: "In Progress", color: "#b45309", bg: "#fef3c7" },
  { value: "wrapping_up", label: "Wrapping Up", color: "#6d28d9", bg: "#ede9fe" },
  { value: "completed", label: "Completed", color: "#15803d", bg: "#dcfce7" },
  { value: "issue", label: "Issue / Need Help", color: "#b91c1c", bg: "#fee2e2" },
];
const TICKET_PRIORITIES = [
  { value: "low", label: "Low — Can Wait", color: "#1d4ed8", bg: "#dbeafe" },
  { value: "medium", label: "Medium — Needs Attention", color: "#b45309", bg: "#fef3c7" },
  { value: "high", label: "High — Affecting Work", color: "#b91c1c", bg: "#fee2e2" },
  { value: "critical", label: "Critical — Truck Down", color: "#991b1b", bg: "#fecaca" },
];
const TICKET_STATUSES = [
  { value: "open", label: "Open", color: "#b91c1c", bg: "#fee2e2" },
  { value: "acknowledged", label: "Acknowledged", color: "#b45309", bg: "#fef3c7" },
  { value: "in_repair", label: "In Repair", color: "#6d28d9", bg: "#ede9fe" },
  { value: "resolved", label: "Resolved", color: "#15803d", bg: "#dcfce7" },
];
const OFFICE_PROFILES = ["Skip", "Jordan", "Johnny", "Duck"];

const todayStr = () => new Date().toISOString().split("T")[0];
const naturalSort = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
const timeStr = () => new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const dateStr = (iso) => { try { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); } catch { return ""; } };

// ─── Theme ───
const t = {
  bg: "#f8f9fb",
  surface: "#ffffff",
  card: "#ffffff",
  border: "#e2e5ea",
  borderLight: "#eef0f3",
  accent: "#1a56db",
  accentHover: "#1648b8",
  accentBg: "#eef2ff",
  text: "#111827",
  textSecondary: "#4b5563",
  textMuted: "#9ca3af",
  danger: "#dc2626",
  dangerBg: "#fef2f2",
  shadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
  shadowMd: "0 4px 12px rgba(0,0,0,0.08)",
};

// ─── Reusable Components ───
function Badge({ children, color, bg }) {
  return <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: "4px", fontSize: "10.5px", fontWeight: 600, letterSpacing: "0.4px", textTransform: "uppercase", color: color || t.accent, background: bg || t.accentBg, whiteSpace: "nowrap" }}>{children}</span>;
}

function Button({ children, onClick, variant = "primary", style: s, disabled }) {
  const base = { padding: "9px 18px", border: "none", borderRadius: "6px", fontWeight: 500, fontSize: "13.5px", cursor: disabled ? "not-allowed" : "pointer", transition: "all 0.15s ease", opacity: disabled ? 0.45 : 1, fontFamily: "inherit" };
  const v = {
    primary: { background: t.accent, color: "#fff" },
    secondary: { background: t.bg, color: t.textSecondary, border: "1px solid " + t.border },
    danger: { background: t.dangerBg, color: t.danger, border: "1px solid #fecaca" },
    ghost: { background: "transparent", color: t.textMuted, padding: "6px 10px" },
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...v[variant], ...s }}>{children}</button>;
}

function Input({ label, ...props }) {
  return (
    <div style={{ marginBottom: "16px" }}>
      {label && <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: t.textSecondary, marginBottom: "5px" }}>{label}</label>}
      <input {...props} style={{ width: "100%", padding: "9px 12px", background: "#fff", border: "1px solid " + t.border, borderRadius: "6px", color: t.text, fontSize: "14px", fontFamily: "inherit", outline: "none", boxSizing: "border-box", ...(props.style || {}) }} onFocus={(e) => e.target.style.borderColor = t.accent} onBlur={(e) => e.target.style.borderColor = t.border} />
    </div>
  );
}

function Select({ label, options, ...props }) {
  return (
    <div style={{ marginBottom: "16px" }}>
      {label && <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: t.textSecondary, marginBottom: "5px" }}>{label}</label>}
      <select {...props} style={{ width: "100%", padding: "9px 12px", background: "#fff", border: "1px solid " + t.border, borderRadius: "6px", color: t.text, fontSize: "14px", fontFamily: "inherit", outline: "none", boxSizing: "border-box", ...(props.style || {}) }}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function TextArea({ label, ...props }) {
  return (
    <div style={{ marginBottom: "16px" }}>
      {label && <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: t.textSecondary, marginBottom: "5px" }}>{label}</label>}
      <textarea {...props} style={{ width: "100%", padding: "9px 12px", background: "#fff", border: "1px solid " + t.border, borderRadius: "6px", color: t.text, fontSize: "14px", fontFamily: "inherit", outline: "none", resize: "vertical", minHeight: "80px", boxSizing: "border-box", ...(props.style || {}) }} onFocus={(e) => e.target.style.borderColor = t.accent} onBlur={(e) => e.target.style.borderColor = t.border} />
    </div>
  );
}

function Card({ children, style: s, onClick }) {
  return (
    <div onClick={onClick} style={{ background: t.card, border: "1px solid " + t.border, borderRadius: "8px", padding: "16px", marginBottom: "10px", cursor: onClick ? "pointer" : "default", transition: "all 0.15s ease", boxShadow: t.shadow, ...s }}
      onMouseEnter={(e) => { if (onClick) { e.currentTarget.style.borderColor = t.accent; e.currentTarget.style.boxShadow = t.shadowMd; } }}
      onMouseLeave={(e) => { if (onClick) { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.boxShadow = t.shadow; } }}>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }} onClick={onClose}>
      <div style={{ background: "#fff", border: "1px solid " + t.border, borderRadius: "12px", padding: "28px", maxWidth: "480px", width: "100%", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "22px", paddingBottom: "14px", borderBottom: "1px solid " + t.borderLight }}>
          <h2 style={{ fontSize: "17px", fontWeight: 600, color: t.text, margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: t.bg, border: "1px solid " + t.border, color: t.textMuted, width: "28px", height: "28px", borderRadius: "6px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SectionHeader({ title, right }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
      <h2 style={{ fontSize: "18px", fontWeight: 600, color: t.text, margin: 0 }}>{title}</h2>
      {right && <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>{right}</div>}
    </div>
  );
}

function EmptyState({ text, sub }) {
  return (
    <Card style={{ textAlign: "center", padding: "52px 24px", borderStyle: "dashed" }}>
      <div style={{ color: t.textSecondary, fontSize: "14px" }}>{text}</div>
      {sub && <div style={{ color: t.textMuted, fontSize: "13px", marginTop: "4px" }}>{sub}</div>}
    </Card>
  );
}

// ─── Screens ───

function RoleSelect({ onSelect }) {
  return (
    <div style={{ minHeight: "100vh", background: t.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
      <div style={{ textAlign: "center", marginBottom: "40px" }}>
        <div style={{ fontSize: "14px", fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase", color: t.accent }}>Insulation Services of Tulsa</div>
        <div style={{ fontSize: "32px", fontWeight: 700, color: t.text, marginTop: "6px" }}>IST Dispatch</div>
        <div style={{ width: "40px", height: "2px", background: t.accent, margin: "14px auto 0", borderRadius: "1px" }} />
      </div>
      <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", justifyContent: "center", maxWidth: "460px", width: "100%" }}>
        <Card onClick={() => onSelect("admin")} style={{ flex: "1 1 200px", textAlign: "center", padding: "32px 20px", cursor: "pointer" }}>
          <div style={{ width: "44px", height: "44px", borderRadius: "10px", background: t.accentBg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <svg width="20" height="20" fill="none" stroke={t.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
          </div>
          <div style={{ fontSize: "16px", fontWeight: 600, color: t.text }}>Office</div>
          <div style={{ fontSize: "13px", color: t.textMuted, marginTop: "4px" }}>Schedule jobs & manage crews</div>
        </Card>
        <Card onClick={() => onSelect("crew")} style={{ flex: "1 1 200px", textAlign: "center", padding: "32px 20px", cursor: "pointer" }}>
          <div style={{ width: "44px", height: "44px", borderRadius: "10px", background: t.accentBg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <svg width="20" height="20" fill="none" stroke={t.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8zM5.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM18.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"/></svg>
          </div>
          <div style={{ fontSize: "16px", fontWeight: 600, color: t.text }}>Field Crew</div>
          <div style={{ fontSize: "13px", color: t.textMuted, marginTop: "4px" }}>View jobs & send updates</div>
        </Card>
      </div>
    </div>
  );
}

function AdminLogin({ onLogin, onBack }) {
  const [selected, setSelected] = useState(null);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [mode, setMode] = useState(null); // null | "enter" | "create"
  const [error, setError] = useState("");
  const [storedHash, setStoredHash] = useState(null);

  const hashPin = (p) => { let h = 0; const s = p + "ist_salt"; for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; } return String(h); };

  const handleSelect = async (name) => {
    setSelected(name);
    setPin("");
    setConfirmPin("");
    setError("");
    try {
      const snap = await getDoc(doc(db, "pins", name.toLowerCase()));
      if (snap.exists()) {
        setStoredHash(snap.data().hash);
        setMode("enter");
      } else {
        setMode("create");
      }
    } catch {
      setMode("create");
    }
  };

  const handleEnterPin = () => {
    if (hashPin(pin) === storedHash) {
      onLogin(selected);
    } else {
      setError("Incorrect PIN. Try again.");
      setPin("");
    }
  };

  const handleCreatePin = async () => {
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) { setError("PIN must be exactly 4 digits."); return; }
    if (pin !== confirmPin) { setError("PINs don't match. Try again."); return; }
    await setDoc(doc(db, "pins", selected.toLowerCase()), { hash: hashPin(pin), user: selected });
    onLogin(selected);
  };

  if (selected && mode === "enter") {
    return (
      <div style={{ minHeight: "100vh", background: t.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
        <div style={{ maxWidth: "340px", width: "100%" }}>
          <button onClick={() => { setSelected(null); setMode(null); }} style={{ background: "none", border: "none", color: t.textMuted, fontSize: "13px", cursor: "pointer", marginBottom: "24px", padding: 0, fontFamily: "inherit" }}>← Back</button>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "8px", background: t.accentBg, color: t.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: 700 }}>{selected[0]}</div>
            <div>
              <div style={{ fontSize: "18px", fontWeight: 600, color: t.text }}>{selected}</div>
              <div style={{ fontSize: "13px", color: t.textMuted }}>Enter your 4-digit PIN</div>
            </div>
          </div>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            placeholder="----"
            value={pin}
            onChange={(e) => { setPin(e.target.value.replace(/\D/g, "").slice(0, 4)); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && pin.length === 4 && handleEnterPin()}
            autoFocus
            style={{ width: "100%", padding: "14px", background: "#fff", border: "1px solid " + t.border, borderRadius: "8px", color: t.text, fontSize: "24px", fontFamily: "inherit", textAlign: "center", letterSpacing: "12px", outline: "none", boxSizing: "border-box" }}
          />
          {error && <div style={{ color: t.danger, fontSize: "13px", marginTop: "8px", textAlign: "center" }}>{error}</div>}
          <Button onClick={handleEnterPin} disabled={pin.length !== 4} style={{ width: "100%", marginTop: "14px" }}>Log In</Button>
        </div>
      </div>
    );
  }

  if (selected && mode === "create") {
    return (
      <div style={{ minHeight: "100vh", background: t.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
        <div style={{ maxWidth: "340px", width: "100%" }}>
          <button onClick={() => { setSelected(null); setMode(null); }} style={{ background: "none", border: "none", color: t.textMuted, fontSize: "13px", cursor: "pointer", marginBottom: "24px", padding: 0, fontFamily: "inherit" }}>← Back</button>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "8px", background: t.accentBg, color: t.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: 700 }}>{selected[0]}</div>
            <div style={{ fontSize: "18px", fontWeight: 600, color: t.text }}>{selected}</div>
          </div>
          <p style={{ color: t.textMuted, fontSize: "13.5px", margin: "0 0 20px" }}>First time? Set up a 4-digit PIN.</p>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: t.textSecondary, marginBottom: "5px" }}>Create PIN</label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            placeholder="----"
            value={pin}
            onChange={(e) => { setPin(e.target.value.replace(/\D/g, "").slice(0, 4)); setError(""); }}
            autoFocus
            style={{ width: "100%", padding: "14px", background: "#fff", border: "1px solid " + t.border, borderRadius: "8px", color: t.text, fontSize: "24px", fontFamily: "inherit", textAlign: "center", letterSpacing: "12px", outline: "none", boxSizing: "border-box", marginBottom: "14px" }}
          />
          <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: t.textSecondary, marginBottom: "5px" }}>Confirm PIN</label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            placeholder="----"
            value={confirmPin}
            onChange={(e) => { setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4)); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && pin.length === 4 && confirmPin.length === 4 && handleCreatePin()}
            style={{ width: "100%", padding: "14px", background: "#fff", border: "1px solid " + t.border, borderRadius: "8px", color: t.text, fontSize: "24px", fontFamily: "inherit", textAlign: "center", letterSpacing: "12px", outline: "none", boxSizing: "border-box" }}
          />
          {error && <div style={{ color: t.danger, fontSize: "13px", marginTop: "8px", textAlign: "center" }}>{error}</div>}
          <Button onClick={handleCreatePin} disabled={pin.length !== 4 || confirmPin.length !== 4} style={{ width: "100%", marginTop: "14px" }}>Set PIN & Log In</Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: t.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
      <div style={{ maxWidth: "380px", width: "100%" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: t.textMuted, fontSize: "13px", cursor: "pointer", marginBottom: "24px", padding: 0, fontFamily: "inherit" }}>← Back</button>
        <h1 style={{ fontSize: "22px", fontWeight: 600, color: t.text, margin: "0 0 6px" }}>Office Login</h1>
        <p style={{ color: t.textMuted, fontSize: "13.5px", margin: "0 0 24px" }}>Select your profile</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {OFFICE_PROFILES.map((name) => (
            <Card key={name} onClick={() => handleSelect(name)} style={{ padding: "14px 18px", cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: t.accentBg, color: t.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: 700 }}>{name[0]}</div>
                <div style={{ fontWeight: 500, color: t.text, fontSize: "15px" }}>{name}</div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function CrewLogin({ trucks, onLogin, onBack }) {
  const [selected, setSelected] = useState("");
  const [crewName, setCrewName] = useState("");
  return (
    <div style={{ minHeight: "100vh", background: t.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
      <div style={{ maxWidth: "380px", width: "100%" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: t.textMuted, fontSize: "13px", cursor: "pointer", marginBottom: "24px", padding: 0, fontFamily: "inherit" }}>← Back</button>
        <h1 style={{ fontSize: "22px", fontWeight: 600, color: t.text, margin: "0 0 6px" }}>Crew Login</h1>
        <p style={{ color: t.textMuted, fontSize: "13.5px", margin: "0 0 24px" }}>Select your crew and enter your name</p>
        <Input label="Your Name" placeholder="Enter your name" value={crewName} onChange={(e) => setCrewName(e.target.value)} />
        {trucks.length === 0 ? (
          <EmptyState text="No crews set up yet." sub="Ask the office to add your crew." />
        ) : (
          <>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: t.textSecondary, marginBottom: "8px" }}>Select Your Crew</label>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "20px" }}>
              {[...trucks].sort((a, b) => (a.order ?? 999) - (b.order ?? 999)).map((tr) => (
                <Card key={tr.id} onClick={() => setSelected(tr.id)} style={{ padding: "12px 16px", cursor: "pointer", borderColor: selected === tr.id ? t.accent : t.border, background: selected === tr.id ? t.accentBg : "#fff" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ width: "32px", height: "32px", borderRadius: "6px", background: selected === tr.id ? t.accent : t.bg, color: selected === tr.id ? "#fff" : t.textMuted, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8zM5.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM18.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"/></svg>
                    </div>
                    <div>
                      <div style={{ fontWeight: 500, color: t.text, fontSize: "14px" }}>{tr.name}</div>
                      {tr.members && <div style={{ fontSize: "12px", color: t.textMuted }}>{tr.members}</div>}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
        <Button onClick={() => onLogin(selected, crewName)} disabled={!selected || !crewName.trim()} style={{ width: "100%" }}>Log In</Button>
      </div>
    </div>
  );
}

// ─── Crew Dashboard ───
function CrewDashboard({ truck, crewName, jobs, updates, tickets, onSubmitUpdate, onSubmitTicket, onLogout }) {
  const myJobs = jobs.filter((j) => {
    if (j.truckId !== truck.id) return false;
    const latest = updates.filter((u) => u.jobId === j.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
    return !latest || latest.status !== "completed";
  });
  const myTickets = tickets.filter((tk) => tk.truckId === truck.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const [crewView, setCrewView] = useState("jobs");
  const [activeJob, setActiveJob] = useState(null);
  const [status, setStatus] = useState("in_progress");
  const [eta, setEta] = useState("");
  const [notes, setNotes] = useState("");
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [ticketDesc, setTicketDesc] = useState("");
  const [ticketPriority, setTicketPriority] = useState("medium");

  const getJobUpdates = (jobId) => updates.filter((u) => u.jobId === jobId).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const getLatestStatus = (jobId) => { const u = getJobUpdates(jobId); return u.length > 0 ? u[0].status : "not_started"; };

  const handleSubmit = () => {
    onSubmitUpdate({ jobId: activeJob.id, truckId: truck.id, crewName, status, eta, notes, timestamp: new Date().toISOString(), timeStr: timeStr() });
    setActiveJob(null); setStatus("in_progress"); setEta(""); setNotes("");
  };
  const handleTicketSubmit = () => {
    onSubmitTicket({ truckId: truck.id, truckName: truck.name, submittedBy: crewName, description: ticketDesc, priority: ticketPriority, status: "open", timestamp: new Date().toISOString() });
    setTicketDesc(""); setTicketPriority("medium"); setShowTicketForm(false);
  };

  const tabStyle = (active) => ({ padding: "8px 16px", background: active ? t.accent : "transparent", color: active ? "#fff" : t.textMuted, border: active ? "none" : "1px solid " + t.border, borderRadius: "6px", fontSize: "12.5px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit", position: "relative" });
  const openTicketCount = myTickets.filter((tk) => tk.status !== "resolved").length;

  return (
    <div style={{ minHeight: "100vh", background: t.bg }}>
      <div style={{ background: t.surface, borderBottom: "1px solid " + t.border, padding: "12px 20px", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "15px", fontWeight: 600, color: t.text }}>IST Dispatch</div>
            <div style={{ fontSize: "12px", color: t.textMuted }}>{truck.name} — {crewName}</div>
          </div>
          <Button variant="ghost" onClick={onLogout} style={{ fontSize: "12px" }}>Log Out</Button>
        </div>
        <div style={{ display: "flex", gap: "6px", marginTop: "10px" }}>
          <button style={tabStyle(crewView === "jobs")} onClick={() => setCrewView("jobs")}>Jobs</button>
          <button style={tabStyle(crewView === "tickets")} onClick={() => setCrewView("tickets")}>
            Equipment Issues
            {openTicketCount > 0 && <span style={{ position: "absolute", top: "-5px", right: "-5px", background: t.danger, color: "#fff", fontSize: "10px", fontWeight: 700, borderRadius: "50%", width: "17px", height: "17px", display: "flex", alignItems: "center", justifyContent: "center" }}>{openTicketCount}</span>}
          </button>
        </div>
      </div>

      <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
        {crewView === "jobs" && (
          <>
            <SectionHeader title="Your Jobs" />
            {myJobs.length === 0 ? <EmptyState text="No active jobs assigned to you." sub="Check back or contact the office." /> : myJobs.map((job) => {
              const latestStatus = getLatestStatus(job.id);
              const statusObj = STATUS_OPTIONS.find((s) => s.value === latestStatus);
              const jobUpdates = getJobUpdates(job.id);
              return (
                <Card key={job.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <div>
                      <div style={{ fontWeight: 600, color: t.text, fontSize: "15px" }}>{job.builder || "No Customer Listed"}</div>
                      <div style={{ fontSize: "12.5px", color: t.textMuted, marginTop: "2px" }}>{job.address}</div>
                      <div style={{ fontSize: "12.5px", color: t.textMuted, marginTop: "2px" }}>{job.type}</div>
                    </div>
                    <Badge color={statusObj.color} bg={statusObj.bg}>{statusObj.label}</Badge>
                  </div>
                  {job.notes && <div style={{ fontSize: "13px", color: t.textSecondary, background: t.bg, padding: "10px 12px", borderRadius: "6px", marginBottom: "10px", borderLeft: "3px solid " + t.accent }}>Office: {job.notes}</div>}
                  {jobUpdates.length > 0 && (
                    <div style={{ marginBottom: "10px" }}>
                      <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", color: t.textMuted, marginBottom: "6px", fontWeight: 600 }}>Update Log</div>
                      {jobUpdates.slice(0, 3).map((u) => {
                        const uStatus = STATUS_OPTIONS.find((s) => s.value === u.status);
                        return (
                          <div key={u.id} style={{ fontSize: "12.5px", color: t.textSecondary, padding: "6px 0", borderBottom: "1px solid " + t.borderLight, display: "flex", gap: "8px" }}>
                            <span style={{ color: t.textMuted, flexShrink: 0 }}>{u.timeStr}</span>
                            <span>
                              <Badge color={uStatus?.color} bg={uStatus?.bg}>{uStatus?.label}</Badge>
                              {u.eta && <span style={{ marginLeft: "8px" }}>ETA: {u.eta}</span>}
                              {u.notes && <span style={{ display: "block", marginTop: "3px", color: t.textMuted }}>{u.notes}</span>}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <Button onClick={() => setActiveJob(job)} style={{ width: "100%" }}>Send Update</Button>
                </Card>
              );
            })}
          </>
        )}

        {crewView === "tickets" && (
          <>
            <SectionHeader title="Equipment Issues" right={<Button onClick={() => setShowTicketForm(true)}>+ Report Issue</Button>} />
            {myTickets.length === 0 ? <EmptyState text="No issues reported for this truck." sub="Tap '+ Report Issue' if something needs attention." /> : myTickets.map((ticket) => {
              const prioObj = TICKET_PRIORITIES.find((p) => p.value === ticket.priority);
              const statObj = TICKET_STATUSES.find((s) => s.value === ticket.status);
              return (
                <Card key={ticket.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginBottom: "8px" }}>
                    <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                      <Badge color={prioObj?.color} bg={prioObj?.bg}>{prioObj?.label?.split("—")[0]?.trim()}</Badge>
                      <Badge color={statObj?.color} bg={statObj?.bg}>{statObj?.label}</Badge>
                    </div>
                    <span style={{ fontSize: "11.5px", color: t.textMuted, flexShrink: 0 }}>{dateStr(ticket.timestamp)}</span>
                  </div>
                  <div style={{ fontSize: "14px", color: t.text, lineHeight: 1.5 }}>{ticket.description}</div>
                  <div style={{ fontSize: "12px", color: t.textMuted, marginTop: "6px" }}>Submitted by {ticket.submittedBy}</div>
                  {ticket.adminNote && <div style={{ fontSize: "13px", color: t.textSecondary, background: t.bg, padding: "10px 12px", borderRadius: "6px", marginTop: "10px", borderLeft: "3px solid " + t.accent }}>Office: {ticket.adminNote}</div>}
                </Card>
              );
            })}
          </>
        )}
      </div>

      {activeJob && (
        <Modal title="Job Update" onClose={() => setActiveJob(null)}>
          <div style={{ fontSize: "13.5px", color: t.textMuted, marginBottom: "18px" }}><strong style={{ color: t.text }}>{activeJob.builder || "No Customer"}</strong><br />{activeJob.address} — {activeJob.type}</div>
          <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)} options={STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label }))} />
          <Input label="Time Estimate" placeholder="e.g. 2 more hours, done by 3pm" value={eta} onChange={(e) => setEta(e.target.value)} />
          <TextArea label="Notes" placeholder="Issues, material needs, progress details..." value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
            <Button variant="secondary" onClick={() => setActiveJob(null)} style={{ flex: 1 }}>Cancel</Button>
            <Button onClick={handleSubmit} style={{ flex: 1 }}>Submit</Button>
          </div>
        </Modal>
      )}

      {showTicketForm && (
        <Modal title="Report Issue" onClose={() => setShowTicketForm(false)}>
          <div style={{ fontSize: "13px", color: t.textMuted, marginBottom: "16px", background: t.bg, padding: "10px 12px", borderRadius: "6px" }}>Reporting for <strong style={{ color: t.text }}>{truck.name}</strong></div>
          <TextArea label="Describe the problem" placeholder="e.g. spray gun leaking at the tip, generator won't start, flat tire on rear passenger side..." value={ticketDesc} onChange={(e) => setTicketDesc(e.target.value)} style={{ minHeight: "110px" }} />
          <Select label="Priority" value={ticketPriority} onChange={(e) => setTicketPriority(e.target.value)} options={TICKET_PRIORITIES.map((p) => ({ value: p.value, label: p.label }))} />
          <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
            <Button variant="secondary" onClick={() => setShowTicketForm(false)} style={{ flex: 1 }}>Cancel</Button>
            <Button onClick={handleTicketSubmit} disabled={!ticketDesc.trim()} style={{ flex: 1 }}>Submit Ticket</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Admin Dashboard ───
function AdminDashboard({ adminName, trucks, jobs, updates, tickets, activityLog, onAddTruck, onDeleteTruck, onReorderTruck, onAddJob, onEditJob, onDeleteJob, onUpdateTicket, onLogAction, onLogout }) {
  const [view, setView] = useState("schedule");
  const [showAddJob, setShowAddJob] = useState(false);
  const [showAddTruck, setShowAddTruck] = useState(false);
  const [jobForm, setJobForm] = useState({ address: "", builder: "", type: JOB_TYPES[0], truckId: "", date: todayStr(), notes: "" });
  const [truckForm, setTruckForm] = useState({ name: "", members: "" });
  const [activeTicket, setActiveTicket] = useState(null);
  const [ticketStatus, setTicketStatus] = useState("acknowledged");
  const [ticketNote, setTicketNote] = useState("");
  const [ticketFilter, setTicketFilter] = useState("active");
  const [editingJob, setEditingJob] = useState(null);
  const [editForm, setEditForm] = useState({ address: "", builder: "", type: "", truckId: "", date: "", notes: "" });
  const [truckFilter, setTruckFilter] = useState(null);

  const activeJobs = jobs.filter((j) => {
    const latest = updates.filter((u) => u.jobId === j.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
    const isCompleted = latest && latest.status === "completed";
    return !isCompleted && (!truckFilter || j.truckId === truckFilter);
  });
  const openTicketCount = tickets.filter((tk) => tk.status === "open").length;
  const filteredTickets = (ticketFilter === "active" ? tickets.filter((tk) => tk.status !== "resolved") : tickets).filter((tk) => !truckFilter || tk.truckId === truckFilter);
  const truckFilterName = truckFilter ? trucks.find((tr) => tr.id === truckFilter)?.name : null;
  const sortedTickets = [...filteredTickets].sort((a, b) => {
    const prioOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    if (prioOrder[a.priority] !== prioOrder[b.priority]) return prioOrder[a.priority] - prioOrder[b.priority];
    return new Date(b.timestamp) - new Date(a.timestamp);
  });
  const orderSort = (a, b) => (a.order ?? 999) - (b.order ?? 999) || naturalSort(a, b);
  const sortedTrucks = [...trucks].sort(orderSort);

  const getLatestUpdate = (jobId) => { const u = updates.filter((u) => u.jobId === jobId).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); return u.length > 0 ? u[0] : null; };
  const handleAddJob = () => { onAddJob({ ...jobForm }); onLogAction("Added job: " + jobForm.address + " (" + jobForm.type + ")"); setJobForm({ address: "", builder: "", type: JOB_TYPES[0], truckId: "", date: todayStr(), notes: "" }); setShowAddJob(false); };
  const handleAddTruck = () => { const maxOrder = trucks.reduce((m, tr) => Math.max(m, tr.order ?? 0), 0); onAddTruck({ ...truckForm, order: maxOrder + 1 }); onLogAction("Added crew: " + truckForm.name); setTruckForm({ name: "", members: "" }); setShowAddTruck(false); };
  const handleMoveTruck = (truckId, direction) => {
    const idx = sortedTrucks.findIndex((tr) => tr.id === truckId);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= sortedTrucks.length) return;
    const a = sortedTrucks[idx];
    const b = sortedTrucks[swapIdx];
    onReorderTruck(a.id, b.order ?? swapIdx);
    onReorderTruck(b.id, a.order ?? idx);
  };
  const handleTicketUpdate = () => { onUpdateTicket(activeTicket.id, { status: ticketStatus, adminNote: ticketNote }); onLogAction("Updated ticket for " + activeTicket.truckName + " to " + ticketStatus); setActiveTicket(null); setTicketStatus("acknowledged"); setTicketNote(""); };
  const openEditJob = (job) => { setEditingJob(job); setEditForm({ address: job.address, builder: job.builder || "", type: job.type, truckId: job.truckId || "", date: job.date, notes: job.notes || "" }); };
  const handleSaveEdit = () => { onEditJob(editingJob.id, { ...editForm }); onLogAction("Edited job: " + editForm.address); setEditingJob(null); };
  const handleRemoveJob = (job) => { onDeleteJob(job.id); onLogAction("Removed job: " + job.address + " (" + job.type + ")"); };
  const handleRemoveTruck = (tr) => { onDeleteTruck(tr.id); onLogAction("Removed crew: " + tr.name); };
  const recentUpdates = [...updates].filter((u) => u.status !== "completed").sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 30);
  const sortedLog = [...activityLog].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const tabStyle = (active) => ({ padding: "8px 16px", background: active ? t.accent : "transparent", color: active ? "#fff" : t.textMuted, border: active ? "none" : "1px solid " + t.border, borderRadius: "6px", fontSize: "12.5px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit", position: "relative" });

  return (
    <div style={{ minHeight: "100vh", background: t.bg }}>
      <div style={{ background: t.surface, borderBottom: "1px solid " + t.border, padding: "12px 20px", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: "900px", margin: "0 auto" }}>
          <div style={{ fontSize: "15px", fontWeight: 600, color: t.text }}>IST Dispatch</div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "12.5px", color: t.textMuted }}>{adminName}</span>
            <Button variant="ghost" onClick={onLogout} style={{ fontSize: "12px" }}>Log Out</Button>
          </div>
        </div>
        <div style={{ display: "flex", gap: "6px", marginTop: "10px", maxWidth: "900px", margin: "10px auto 0", flexWrap: "wrap" }}>
          <button style={tabStyle(view === "schedule")} onClick={() => { setTruckFilter(null); setView("schedule"); }}>Schedule</button>
          <button style={tabStyle(view === "feed")} onClick={() => { setView("feed"); }}>Live Feed</button>
          <button style={tabStyle(view === "tickets")} onClick={() => { setTruckFilter(null); setView("tickets"); }}>
            Tickets
            {openTicketCount > 0 && <span style={{ position: "absolute", top: "-5px", right: "-5px", background: t.danger, color: "#fff", fontSize: "10px", fontWeight: 700, borderRadius: "50%", width: "17px", height: "17px", display: "flex", alignItems: "center", justifyContent: "center" }}>{openTicketCount}</span>}
          </button>
          <button style={tabStyle(view === "trucks")} onClick={() => setView("trucks")}>Crews</button>
          <button style={tabStyle(view === "log")} onClick={() => setView("log")}>Activity Log</button>
        </div>
      </div>

      <div style={{ padding: "20px", maxWidth: "900px", margin: "0 auto" }}>

        {view === "schedule" && (
          <>
            <SectionHeader title="Schedule" right={<>
              <Button onClick={() => { setJobForm({ ...jobForm, date: todayStr() }); setShowAddJob(true); }}>+ Add Job</Button>
            </>} />
            {truckFilterName && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px", padding: "8px 12px", background: t.accentBg, borderRadius: "6px", fontSize: "13px", color: t.accent, fontWeight: 500 }}>
                Showing jobs for {truckFilterName}
                <button onClick={() => setTruckFilter(null)} style={{ background: "none", border: "none", color: t.accent, cursor: "pointer", fontWeight: 700, fontSize: "14px", fontFamily: "inherit", padding: "0 4px" }}>✕</button>
              </div>
            )}
            {activeJobs.length === 0 ? <EmptyState text="No active jobs." /> : (() => {
              const unassigned = activeJobs.filter((j) => !j.truckId);
              const crewGroups = sortedTrucks.filter((tr) => !truckFilter || tr.id === truckFilter).map((tr) => ({ crew: tr, jobs: activeJobs.filter((j) => j.truckId === tr.id) })).filter((g) => g.jobs.length > 0);
              if (unassigned.length > 0) crewGroups.push({ crew: { id: "_unassigned", name: "Unassigned" }, jobs: unassigned });
              return crewGroups.map((group) => (
                <div key={group.crew.id} style={{ marginBottom: "20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", paddingBottom: "6px", borderBottom: "2px solid " + t.accent }}>
                    <div style={{ fontSize: "15px", fontWeight: 600, color: t.text }}>{group.crew.name}</div>
                    {group.crew.members && <span style={{ fontSize: "12px", color: t.textMuted }}>— {group.crew.members}</span>}
                    <Badge>{group.jobs.length} job{group.jobs.length !== 1 ? "s" : ""}</Badge>
                  </div>
                  {group.jobs.map((job) => {
                    const latest = getLatestUpdate(job.id);
                    const statusObj = latest ? STATUS_OPTIONS.find((s) => s.value === latest.status) : STATUS_OPTIONS[0];
                    const jobUpdates = updates.filter((u) => u.jobId === job.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                    return (
                      <Card key={job.id} style={{ marginLeft: "8px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "8px" }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, color: t.text, fontSize: "15px" }}>{job.builder || "No Customer Listed"}</div>
                            <div style={{ fontSize: "12.5px", color: t.textMuted, marginTop: "2px" }}>{job.address}</div>
                            <div style={{ fontSize: "12.5px", color: t.textMuted, marginTop: "2px" }}>{job.type} — {new Date(job.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
                          </div>
                          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                            <Badge color={statusObj.color} bg={statusObj.bg}>{statusObj.label}</Badge>
                            <Button variant="secondary" onClick={() => openEditJob(job)} style={{ padding: "4px 8px", fontSize: "11px" }}>Edit</Button>
                            <Button variant="danger" onClick={() => handleRemoveJob(job)} style={{ padding: "4px 8px", fontSize: "11px" }}>Remove</Button>
                          </div>
                        </div>
                        {job.notes && <div style={{ fontSize: "13px", color: t.textMuted, marginTop: "8px", fontStyle: "italic" }}>Notes: {job.notes}</div>}
                        {jobUpdates.length > 0 && (
                          <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px solid " + t.borderLight }}>
                            <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", color: t.textMuted, marginBottom: "6px", fontWeight: 600 }}>Crew Updates</div>
                            {jobUpdates.map((u) => {
                              const uStatus = STATUS_OPTIONS.find((s) => s.value === u.status);
                              return (
                                <div key={u.id} style={{ fontSize: "12.5px", padding: "6px 0", borderBottom: "1px solid " + t.borderLight, color: t.textSecondary }}>
                                  <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                                    <span style={{ color: t.textMuted }}>{u.timeStr}</span>
                                    <strong style={{ color: t.text }}>{u.crewName}</strong>
                                    <Badge color={uStatus?.color} bg={uStatus?.bg}>{uStatus?.label}</Badge>
                                    {u.eta && <span>— ETA: {u.eta}</span>}
                                  </div>
                                  {u.notes && <div style={{ marginTop: "3px", color: t.textMuted, paddingLeft: "2px" }}>{u.notes}</div>}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              ));
            })()}
          </>
        )}

        {view === "feed" && (
          <>
            <SectionHeader title="Live Feed" />
            {recentUpdates.length === 0 ? <EmptyState text="No active crew updates." /> : recentUpdates.map((u) => {
              const job = jobs.find((j) => j.id === u.jobId);
              const truck = trucks.find((tr) => tr.id === u.truckId);
              const statusObj = STATUS_OPTIONS.find((s) => s.value === u.status);
              return (
                <Card key={u.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "6px" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: t.text, fontSize: "14px" }}>{job?.builder || "No Customer"} — {truck?.name || "Unknown"}</div>
                      <div style={{ fontSize: "12.5px", color: t.textMuted, marginTop: "2px" }}>{job?.address || "Unknown"} — {job?.type}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <Badge color={statusObj?.color} bg={statusObj?.bg}>{statusObj?.label}</Badge>
                      <div style={{ fontSize: "11.5px", color: t.textMuted, marginTop: "3px" }}>{u.timeStr}</div>
                    </div>
                  </div>
                  {u.eta && <div style={{ fontSize: "12.5px", color: t.textSecondary, marginTop: "6px" }}>ETA: {u.eta}</div>}
                  {u.notes && <div style={{ fontSize: "12.5px", color: t.textMuted, marginTop: "4px" }}>{u.notes}</div>}
                  {job && (
                    <div style={{ display: "flex", gap: "6px", marginTop: "10px", paddingTop: "10px", borderTop: "1px solid " + t.borderLight }}>
                      <Button variant="secondary" onClick={() => openEditJob(job)} style={{ fontSize: "12px", padding: "5px 12px" }}>Edit Job</Button>
                      <Button variant="danger" onClick={() => handleRemoveJob(job)} style={{ fontSize: "12px", padding: "5px 12px" }}>Remove Job</Button>
                    </div>
                  )}
                </Card>
              );
            })}
          </>
        )}

        {view === "tickets" && (
          <>
            <SectionHeader title="Equipment Tickets" right={
              <div style={{ display: "flex", gap: "4px" }}>
                <button onClick={() => setTicketFilter("active")} style={{ padding: "6px 12px", border: "1px solid " + t.border, borderRadius: "6px", fontSize: "12px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit", background: ticketFilter === "active" ? t.accent : "#fff", color: ticketFilter === "active" ? "#fff" : t.textMuted }}>Active ({tickets.filter((tk) => tk.status !== "resolved").length})</button>
                <button onClick={() => setTicketFilter("all")} style={{ padding: "6px 12px", border: "1px solid " + t.border, borderRadius: "6px", fontSize: "12px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit", background: ticketFilter === "all" ? t.accent : "#fff", color: ticketFilter === "all" ? "#fff" : t.textMuted }}>All ({tickets.length})</button>
              </div>
            } />
            {truckFilterName && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px", padding: "8px 12px", background: t.accentBg, borderRadius: "6px", fontSize: "13px", color: t.accent, fontWeight: 500 }}>
                Showing tickets for {truckFilterName}
                <button onClick={() => setTruckFilter(null)} style={{ background: "none", border: "none", color: t.accent, cursor: "pointer", fontWeight: 700, fontSize: "14px", fontFamily: "inherit", padding: "0 4px" }}>✕</button>
              </div>
            )}
            {sortedTickets.length === 0 ? <EmptyState text={ticketFilter === "active" ? "No active tickets. All clear." : "No tickets submitted yet."} /> : sortedTickets.map((ticket) => {
              const prioObj = TICKET_PRIORITIES.find((p) => p.value === ticket.priority);
              const statObj = TICKET_STATUSES.find((s) => s.value === ticket.status);
              return (
                <Card key={ticket.id} onClick={() => { setActiveTicket(ticket); setTicketStatus(ticket.status === "open" ? "acknowledged" : ticket.status); setTicketNote(ticket.adminNote || ""); }} style={{ cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", gap: "5px", alignItems: "center", flexWrap: "wrap" }}>
                      <Badge color={prioObj?.color} bg={prioObj?.bg}>{prioObj?.label?.split("—")[0]?.trim()}</Badge>
                      <Badge color={statObj?.color} bg={statObj?.bg}>{statObj?.label}</Badge>
                      <span style={{ fontSize: "13px", fontWeight: 500, color: t.text }}>{ticket.truckName}</span>
                    </div>
                    <span style={{ fontSize: "11.5px", color: t.textMuted }}>{dateStr(ticket.timestamp)}</span>
                  </div>
                  <div style={{ fontSize: "14px", color: t.text, lineHeight: 1.5 }}>{ticket.description}</div>
                  <div style={{ fontSize: "12px", color: t.textMuted, marginTop: "6px" }}>Submitted by {ticket.submittedBy}</div>
                  {ticket.adminNote && <div style={{ fontSize: "13px", color: t.textSecondary, background: t.bg, padding: "10px 12px", borderRadius: "6px", marginTop: "8px", borderLeft: "3px solid #15803d" }}>Response: {ticket.adminNote}</div>}
                </Card>
              );
            })}
          </>
        )}

        {view === "trucks" && (
          <>
            <SectionHeader title="Crews" right={<Button onClick={() => setShowAddTruck(true)}>+ Add Crew</Button>} />
            {trucks.length === 0 ? <EmptyState text="No crews yet. Add one to get started." /> : sortedTrucks.map((tr, idx) => {
              const truckJobs = jobs.filter((j) => { if (j.truckId !== tr.id) return false; const lat = updates.filter((u) => u.jobId === j.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]; return !lat || lat.status !== "completed"; });
              const truckTickets = tickets.filter((tk) => tk.truckId === tr.id && tk.status !== "resolved");
              return (
                <Card key={tr.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <button onClick={() => handleMoveTruck(tr.id, -1)} disabled={idx === 0} style={{ background: "none", border: "1px solid " + (idx === 0 ? t.borderLight : t.border), borderRadius: "4px", width: "24px", height: "20px", cursor: idx === 0 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: idx === 0 ? 0.3 : 1, color: t.textMuted }}>
                          <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M18 15l-6-6-6 6"/></svg>
                        </button>
                        <button onClick={() => handleMoveTruck(tr.id, 1)} disabled={idx === sortedTrucks.length - 1} style={{ background: "none", border: "1px solid " + (idx === sortedTrucks.length - 1 ? t.borderLight : t.border), borderRadius: "4px", width: "24px", height: "20px", cursor: idx === sortedTrucks.length - 1 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: idx === sortedTrucks.length - 1 ? 0.3 : 1, color: t.textMuted }}>
                          <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
                        </button>
                      </div>
                      <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: t.accentBg, color: t.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8zM5.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM18.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"/></svg>
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: t.text, fontSize: "14.5px" }}>{tr.name}</div>
                        {tr.members && <div style={{ fontSize: "12.5px", color: t.textMuted }}>{tr.members}</div>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <span onClick={() => { setTruckFilter(tr.id); setView("schedule"); }} style={{ cursor: "pointer" }}><Badge>{truckJobs.length} active job{truckJobs.length !== 1 ? "s" : ""}</Badge></span>
                      {truckTickets.length > 0 && <span onClick={() => { setTruckFilter(tr.id); setTicketFilter("active"); setView("tickets"); }} style={{ cursor: "pointer" }}><Badge color="#b91c1c" bg="#fee2e2">{truckTickets.length} issue{truckTickets.length !== 1 ? "s" : ""}</Badge></span>}
                      <Button variant="danger" onClick={() => handleRemoveTruck(tr)} style={{ padding: "4px 8px", fontSize: "11px" }}>Remove</Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </>
        )}

        {view === "log" && (
          <>
            <SectionHeader title="Activity Log" right={<span style={{ fontSize: "12.5px", color: t.textMuted }}>Office actions only</span>} />
            {sortedLog.length === 0 ? <EmptyState text="No activity recorded yet." /> : sortedLog.map((entry) => (
              <Card key={entry.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                      <div style={{ width: "26px", height: "26px", borderRadius: "6px", background: t.accentBg, color: t.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, flexShrink: 0 }}>{entry.user?.[0]}</div>
                      <span style={{ fontWeight: 600, color: t.text, fontSize: "13.5px" }}>{entry.user}</span>
                    </div>
                    <div style={{ fontSize: "13.5px", color: t.textSecondary, paddingLeft: "34px" }}>{entry.action}</div>
                  </div>
                  <span style={{ fontSize: "11.5px", color: t.textMuted, flexShrink: 0, whiteSpace: "nowrap" }}>{dateStr(entry.timestamp)}</span>
                </div>
              </Card>
            ))}
          </>
        )}
      </div>

      {showAddJob && (
        <Modal title="Add Job" onClose={() => setShowAddJob(false)}>
          <Input label="Builder / Customer" placeholder="e.g. Smith Residence, ABC Builders" value={jobForm.builder} onChange={(e) => setJobForm({ ...jobForm, builder: e.target.value })} />
          <Input label="Job Address" placeholder="e.g. 1234 E 91st St, Tulsa" value={jobForm.address} onChange={(e) => setJobForm({ ...jobForm, address: e.target.value })} />
          <Select label="Job Type" value={jobForm.type} onChange={(e) => setJobForm({ ...jobForm, type: e.target.value })} options={JOB_TYPES.map((jt) => ({ value: jt, label: jt }))} />
          <Select label="Assign to Crew" value={jobForm.truckId} onChange={(e) => setJobForm({ ...jobForm, truckId: e.target.value })} options={[{ value: "", label: "— Unassigned —" }, ...sortedTrucks.map((tr) => ({ value: tr.id, label: tr.name }))]} />
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: t.textSecondary, marginBottom: "5px" }}>Date</label>
            <input type="date" value={jobForm.date} onChange={(e) => setJobForm({ ...jobForm, date: e.target.value })} style={{ width: "100%", padding: "9px 12px", background: "#fff", border: "1px solid " + t.border, borderRadius: "6px", color: t.text, fontSize: "14px", fontFamily: "inherit", boxSizing: "border-box" }} />
          </div>
          <TextArea label="Office Notes (visible to crew)" placeholder="Special instructions, materials needed..." value={jobForm.notes} onChange={(e) => setJobForm({ ...jobForm, notes: e.target.value })} />
          <Button onClick={handleAddJob} disabled={!jobForm.address.trim()} style={{ width: "100%" }}>Add Job to Schedule</Button>
        </Modal>
      )}

      {showAddTruck && (
        <Modal title="Add Crew" onClose={() => setShowAddTruck(false)}>
          <Input label="Crew Name" placeholder="e.g. Alex & Juan, Harold Sr. & Jr." value={truckForm.name} onChange={(e) => setTruckForm({ ...truckForm, name: e.target.value })} />
          <Input label="Notes (optional)" placeholder="e.g. Fiberglass crew, Foam rig, etc." value={truckForm.members} onChange={(e) => setTruckForm({ ...truckForm, members: e.target.value })} />
          <Button onClick={handleAddTruck} disabled={!truckForm.name.trim()} style={{ width: "100%" }}>Add Crew</Button>
        </Modal>
      )}

      {activeTicket && (
        <Modal title="Respond to Ticket" onClose={() => setActiveTicket(null)}>
          <div style={{ background: t.bg, padding: "14px", borderRadius: "8px", marginBottom: "18px" }}>
            <div style={{ display: "flex", gap: "5px", marginBottom: "8px", flexWrap: "wrap" }}>
              {(() => { const p = TICKET_PRIORITIES.find((p) => p.value === activeTicket.priority); return <Badge color={p?.color} bg={p?.bg}>{p?.label}</Badge>; })()}
            </div>
            <div style={{ fontSize: "12.5px", color: t.textMuted, marginBottom: "4px" }}>{activeTicket.truckName} — {activeTicket.submittedBy} — {dateStr(activeTicket.timestamp)}</div>
            <div style={{ fontSize: "14px", color: t.text, lineHeight: 1.5 }}>{activeTicket.description}</div>
          </div>
          <Select label="Update Status" value={ticketStatus} onChange={(e) => setTicketStatus(e.target.value)} options={TICKET_STATUSES.map((s) => ({ value: s.value, label: s.label }))} />
          <TextArea label="Response Note (visible to crew)" placeholder="e.g. Parts ordered, will fix Saturday..." value={ticketNote} onChange={(e) => setTicketNote(e.target.value)} />
          <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
            <Button variant="secondary" onClick={() => setActiveTicket(null)} style={{ flex: 1 }}>Cancel</Button>
            <Button onClick={handleTicketUpdate} style={{ flex: 1 }}>Update Ticket</Button>
          </div>
        </Modal>
      )}

      {editingJob && (
        <Modal title="Edit Job" onClose={() => setEditingJob(null)}>
          <Input label="Builder / Customer" value={editForm.builder} onChange={(e) => setEditForm({ ...editForm, builder: e.target.value })} />
          <Input label="Job Address" value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
          <Select label="Job Type" value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })} options={JOB_TYPES.map((jt) => ({ value: jt, label: jt }))} />
          <Select label="Assign to Crew" value={editForm.truckId} onChange={(e) => setEditForm({ ...editForm, truckId: e.target.value })} options={[{ value: "", label: "— Unassigned —" }, ...sortedTrucks.map((tr) => ({ value: tr.id, label: tr.name }))]} />
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: t.textSecondary, marginBottom: "5px" }}>Date</label>
            <input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} style={{ width: "100%", padding: "9px 12px", background: "#fff", border: "1px solid " + t.border, borderRadius: "6px", color: t.text, fontSize: "14px", fontFamily: "inherit", boxSizing: "border-box" }} />
          </div>
          <TextArea label="Office Notes (visible to crew)" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
          <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
            <Button variant="secondary" onClick={() => setEditingJob(null)} style={{ flex: 1 }}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={!editForm.address.trim()} style={{ flex: 1 }}>Save Changes</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Main App ───
export default function App() {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);
  const [crewSession, setCrewSession] = useState(null);
  const [adminName, setAdminName] = useState(null);
  const [trucks, setTrucks] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [activityLog, setActivityLog] = useState([]);

  useEffect(() => {
    const unsubTrucks = onSnapshot(collection(db, "trucks"), (snap) => { setTrucks(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); });
    const unsubJobs = onSnapshot(collection(db, "jobs"), (snap) => { setJobs(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); });
    const unsubUpdates = onSnapshot(collection(db, "updates"), (snap) => { setUpdates(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); });
    const unsubTickets = onSnapshot(collection(db, "tickets"), (snap) => { setTickets(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false); });
    const unsubLog = onSnapshot(collection(db, "activityLog"), (snap) => { setActivityLog(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); });
    return () => { unsubTrucks(); unsubJobs(); unsubUpdates(); unsubTickets(); unsubLog(); };
  }, []);

  const handleAddTruck = async (data) => { await addDoc(collection(db, "trucks"), data); };
  const handleDeleteTruck = async (id) => { await deleteDoc(doc(db, "trucks", id)); };
  const handleReorderTruck = async (id, newOrder) => { await updateDoc(doc(db, "trucks", id), { order: newOrder }); };
  const handleAddJob = async (data) => { await addDoc(collection(db, "jobs"), data); };
  const handleDeleteJob = async (id) => {
    await deleteDoc(doc(db, "jobs", id));
    const updatesSnap = await getDocs(query(collection(db, "updates"), where("jobId", "==", id)));
    updatesSnap.forEach(async (d) => { await deleteDoc(doc(db, "updates", d.id)); });
  };
  const handleSubmitUpdate = async (data) => { await addDoc(collection(db, "updates"), { ...data, createdAt: serverTimestamp() }); };
  const handleEditJob = async (id, data) => { await updateDoc(doc(db, "jobs", id), data); };
  const handleSubmitTicket = async (data) => { await addDoc(collection(db, "tickets"), { ...data, createdAt: serverTimestamp() }); };
  const handleUpdateTicket = async (id, data) => { await updateDoc(doc(db, "tickets", id), data); };
  const handleLogAction = async (action) => { await addDoc(collection(db, "activityLog"), { user: adminName, action, timestamp: new Date().toISOString(), createdAt: serverTimestamp() }); };
  const handleCrewLogin = (truckId, crewName) => { setCrewSession({ truckId, crewName }); setRole("crew"); };
  const handleAdminLogin = (name) => { setAdminName(name); setRole("admin"); addDoc(collection(db, "activityLog"), { user: name, action: "Signed in", timestamp: new Date().toISOString(), createdAt: serverTimestamp() }); };

  if (loading) return <div style={{ minHeight: "100vh", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ fontSize: "20px", fontWeight: 600, color: t.textMuted, letterSpacing: "2px" }}>IST</div></div>;

  if (!role) return <RoleSelect onSelect={setRole} />;
  if (role === "admin" && !adminName) return <AdminLogin onLogin={handleAdminLogin} onBack={() => setRole(null)} />;
  if (role === "crew" && !crewSession) return <CrewLogin trucks={trucks} onLogin={handleCrewLogin} onBack={() => setRole(null)} />;
  if (role === "crew" && crewSession) {
    const truck = trucks.find((tr) => tr.id === crewSession.truckId);
    if (!truck) return <CrewLogin trucks={trucks} onLogin={handleCrewLogin} onBack={() => setRole(null)} />;
    return <CrewDashboard truck={truck} crewName={crewSession.crewName} jobs={jobs} updates={updates} tickets={tickets} onSubmitUpdate={handleSubmitUpdate} onSubmitTicket={handleSubmitTicket} onLogout={() => { setCrewSession(null); setRole(null); }} />;
  }
  if (role === "admin") return <AdminDashboard adminName={adminName} trucks={trucks} jobs={jobs} updates={updates} tickets={tickets} activityLog={activityLog} onAddTruck={handleAddTruck} onDeleteTruck={handleDeleteTruck} onReorderTruck={handleReorderTruck} onAddJob={handleAddJob} onEditJob={handleEditJob} onDeleteJob={handleDeleteJob} onUpdateTicket={handleUpdateTicket} onLogAction={handleLogAction} onLogout={() => { setAdminName(null); setRole(null); }} />;
  return null;
}
