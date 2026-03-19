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
  deleteField,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";

// ─── Constants ───
const JOB_TYPES = ["Foam","Fiberglass","Removal"];
const STATUS_OPTIONS = [
  { value: "not_started", label: "Not Started", color: "#6b7280", bg: "#f3f4f6" },
  { value: "in_progress", label: "In Progress", color: "#b45309", bg: "#fef3c7" },
  { value: "completed", label: "Completed", color: "#15803d", bg: "#dcfce7" },
  { value: "issue", label: "Issue / Need Help", color: "#b91c1c", bg: "#fee2e2" },
];

const INVENTORY_ITEMS = [
  // Foam
  { id: "oc_a",       name: "Ambit Open Cell A",       unit: "bbl",   category: "Foam" },
  { id: "oc_b",       name: "Ambit Open Cell B",       unit: "bbl",   category: "Foam" },
  { id: "cc_a",       name: "Ambit Closed Cell A",     unit: "bbl",   category: "Foam" },
  { id: "cc_b",       name: "Ambit Closed Cell B",     unit: "bbl",   category: "Foam" },
  { id: "env_oc_a",   name: "Enverge Open Cell A",     unit: "bbl",   category: "Foam" },
  { id: "env_oc_b",   name: "Enverge Open Cell B",     unit: "bbl",   category: "Foam" },
  { id: "free_env_oc_a", name: "FREE Enverge Open Cell A", unit: "bbl", category: "Foam" },
  { id: "free_env_oc_b", name: "FREE Enverge Open Cell B", unit: "bbl", category: "Foam" },
  { id: "env_cc_a",   name: "Enverge Closed Cell A",   unit: "bbl",   category: "Foam" },
  { id: "env_cc_b",   name: "Enverge Closed Cell B",   unit: "bbl",   category: "Foam" },
  // Blown
  { id: "blown_fg",        name: "Certainteed Blown Fiberglass", unit: "bags", category: "Blown" },
  { id: "blown_fg_jm",     name: "JM Blown Fiberglass",          unit: "bags", category: "Blown" },
  { id: "blown_cel",       name: "Blown Cellulose",  unit: "bags",  category: "Blown" },
  // Certainteed R11
  { id: "r11_15_8_t",     name: 'R11 x 15" x 93" (8ft)', pcsPerTube: 16, sqftPerTube: 155,    unit: "tubes", category: "Certainteed R11", hasPieces: true },
  { id: "r11_15_8_pcs",   name: 'R11 x 15" x 93" (8ft)', unit: "pcs",   category: "Certainteed R11", isPieces: true, parentId: "r11_15_8_t" },
  // Certainteed R13
  { id: "r13_15_8_t",     name: 'R13 x 15" x 93" (8ft)', pcsPerTube: 13, sqftPerTube: 125.94, unit: "tubes", category: "Certainteed R13", hasPieces: true },
  { id: "r13_15_8_pcs",   name: 'R13 x 15" x 93" (8ft)', unit: "pcs",   category: "Certainteed R13", isPieces: true, parentId: "r13_15_8_t" },
  { id: "r13_15_9_t",     name: 'R13 x 15" x 105" (9ft)',pcsPerTube: 13, sqftPerTube: 142.19, unit: "tubes", category: "Certainteed R13", hasPieces: true },
  { id: "r13_15_9_pcs",   name: 'R13 x 15" x 105" (9ft)',unit: "pcs",   category: "Certainteed R13", isPieces: true, parentId: "r13_15_9_t" },
  { id: "r13_24_8_t",     name: 'R13 x 24" x 96"',       pcsPerTube: 11, sqftPerTube: 176,    unit: "tubes", category: "Certainteed R13", hasPieces: true },
  { id: "r13_24_8_pcs",   name: 'R13 x 24" x 96"',       unit: "pcs",   category: "Certainteed R13", isPieces: true, parentId: "r13_24_8_t" },
  // Certainteed R19
  { id: "r19_15_8_t",     name: 'R19 x 15" x 93" (8ft)', pcsPerTube: 9,  sqftPerTube: 87.19,  unit: "tubes", category: "Certainteed R19", hasPieces: true },
  { id: "r19_15_8_pcs",   name: 'R19 x 15" x 93" (8ft)', unit: "pcs",   category: "Certainteed R19", isPieces: true, parentId: "r19_15_8_t" },
  { id: "r19_19_8_t",     name: 'R19 x 19.25" x 48"',    pcsPerTube: 18, sqftPerTube: 115.5,  unit: "tubes", category: "Certainteed R19", hasPieces: true },
  { id: "r19_19_8_pcs",   name: 'R19 x 19.25" x 48"',    unit: "pcs",   category: "Certainteed R19", isPieces: true, parentId: "r19_19_8_t" },
  { id: "r19_24_8_t",     name: 'R19 x 24" x 96"',       pcsPerTube: 9,  sqftPerTube: 144,    unit: "tubes", category: "Certainteed R19", hasPieces: true },
  { id: "r19_24_8_pcs",   name: 'R19 x 24" x 96"',       unit: "pcs",   category: "Certainteed R19", isPieces: true, parentId: "r19_24_8_t" },
  // Certainteed R30
  { id: "r30_15_t",       name: 'R30 x 16" x 48"',       pcsPerTube: 11, sqftPerTube: 58.67,  unit: "tubes", category: "Certainteed R30", hasPieces: true },
  { id: "r30_15_pcs",     name: 'R30 x 16" x 48"',       unit: "pcs",   category: "Certainteed R30", isPieces: true, parentId: "r30_15_t" },
  { id: "r30_24_t",       name: 'R30 x 24" x 48"',       pcsPerTube: 11, sqftPerTube: 88,     unit: "tubes", category: "Certainteed R30", hasPieces: true },
  { id: "r30_24_pcs",     name: 'R30 x 24" x 48"',       unit: "pcs",   category: "Certainteed R30", isPieces: true, parentId: "r30_24_t" },
  // Johns Manville R11
  { id: "jm_r11_15_8_t",   name: 'JM R11 x 15" x 93"',    pcsPerTube: 16, sqftPerTube: 155.00, unit: "tubes", category: "Johns Manville R11", hasPieces: true },
  { id: "jm_r11_15_8_pcs", name: 'JM R11 x 15" x 93"',    unit: "pcs", category: "Johns Manville R11", isPieces: true, parentId: "jm_r11_15_8_t" },
  // Johns Manville R13
  { id: "jm_r13_15_8_t",   name: 'JM R13 x 15" x 93"',    pcsPerTube: 11, sqftPerTube: 106.56, unit: "tubes", category: "Johns Manville R13", hasPieces: true },
  { id: "jm_r13_15_8_pcs", name: 'JM R13 x 15" x 93"',    unit: "pcs", category: "Johns Manville R13", isPieces: true, parentId: "jm_r13_15_8_t" },
  { id: "jm_r13_15_9_t",   name: 'JM R13 x 15" x 105"',   pcsPerTube: 11, sqftPerTube: 120.31, unit: "tubes", category: "Johns Manville R13", hasPieces: true },
  { id: "jm_r13_15_9_pcs", name: 'JM R13 x 15" x 105"',   unit: "pcs", category: "Johns Manville R13", isPieces: true, parentId: "jm_r13_15_9_t" },
  { id: "jm_r13_23_8_t",   name: 'JM R13 x 23" x 93"',    pcsPerTube: 11, sqftPerTube: 163.39, unit: "tubes", category: "Johns Manville R13", hasPieces: true },
  { id: "jm_r13_23_8_pcs", name: 'JM R13 x 23" x 93"',    unit: "pcs", category: "Johns Manville R13", isPieces: true, parentId: "jm_r13_23_8_t" },
  // Johns Manville R19
  { id: "jm_r19_15_8_t",   name: 'JM R19 x 15" x 93"',    pcsPerTube: 9,  sqftPerTube: 87.18,  unit: "tubes", category: "Johns Manville R19", hasPieces: true },
  { id: "jm_r19_15_8_pcs", name: 'JM R19 x 15" x 93"',    unit: "pcs", category: "Johns Manville R19", isPieces: true, parentId: "jm_r19_15_8_t" },
  { id: "jm_r19_19_8_t",   name: 'JM R19 x 19.25" x 48"', pcsPerTube: 18, sqftPerTube: 115.50, unit: "tubes", category: "Johns Manville R19", hasPieces: true },
  { id: "jm_r19_19_8_pcs", name: 'JM R19 x 19.25" x 48"', unit: "pcs", category: "Johns Manville R19", isPieces: true, parentId: "jm_r19_19_8_t" },
  { id: "jm_r19_24_8_t",   name: 'JM R19 x 24" x 48"',    pcsPerTube: 18, sqftPerTube: 144.00, unit: "tubes", category: "Johns Manville R19", hasPieces: true },
  { id: "jm_r19_24_8_pcs", name: 'JM R19 x 24" x 48"',    unit: "pcs", category: "Johns Manville R19", isPieces: true, parentId: "jm_r19_24_8_t" },
  // Johns Manville R30
  { id: "jm_r30_16_t",     name: 'JM R30 x 16" x 48"',    pcsPerTube: 11, sqftPerTube: 58.66,  unit: "tubes", category: "Johns Manville R30", hasPieces: true },
  { id: "jm_r30_16_pcs",   name: 'JM R30 x 16" x 48"',    unit: "pcs", category: "Johns Manville R30", isPieces: true, parentId: "jm_r30_16_t" },
  { id: "jm_r30_24_t",     name: 'JM R30 x 24" x 48"',    pcsPerTube: 11, sqftPerTube: 88.00,  unit: "tubes", category: "Johns Manville R30", hasPieces: true },
  { id: "jm_r30_24_pcs",   name: 'JM R30 x 24" x 48"',    unit: "pcs", category: "Johns Manville R30", isPieces: true, parentId: "jm_r30_24_t" },
  { id: "lambswool",  name: "Lambswool",         unit: "rolls", category: "Lambswool" },
  // Rockwool
  { id: "rw_4_t",    name: 'Rockwool 4"',        unit: "tubes", category: "Rockwool", hasPieces: true },
  { id: "rw_4_pcs",  name: 'Rockwool 4"',        unit: "pcs",   category: "Rockwool", isPieces: true, parentId: "rw_4_t" },
  { id: "rw_6_t",    name: 'Rockwool 6"',        unit: "tubes", category: "Rockwool", hasPieces: true },
  { id: "rw_6_pcs",  name: 'Rockwool 6"',        unit: "pcs",   category: "Rockwool", isPieces: true, parentId: "rw_6_t" },
];
// Returns deduction array for tube items using full-tube + loose-piece logic
const calcTubeDeductions = (tubeItem, fullTubesUsed, loosePiecesUsed, truckInv) => {
  if (!tubeItem || !tubeItem.pcsPerTube) return [];
  const pcsItem = INVENTORY_ITEMS.find(i => i.parentId === tubeItem.id);
  const ppt = tubeItem.pcsPerTube;
  const currentTubes = truckInv[tubeItem.id] || 0;
  const currentLoose = pcsItem ? (truckInv[pcsItem.id] || 0) : 0;
  const totalOnTruck = currentTubes * ppt + currentLoose;
  const totalUsed = (fullTubesUsed || 0) * ppt + (loosePiecesUsed || 0);
  const remaining = Math.max(0, totalOnTruck - totalUsed);
  const newTubes = Math.floor(remaining / ppt);
  const newLoose = remaining % ppt;
  const result = [{ itemId: tubeItem.id, stillHave: newTubes }];
  if (pcsItem) result.push({ itemId: pcsItem.id, stillHave: newLoose });
  return result;
};

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
const OFFICE_PROFILES = ["Skip", "Jordan", "Johnny", "Duck", "Carolyn"];

const todayCST = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
const tsToCST = (ts) => new Date(ts).toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
const todayStr = todayCST; // alias
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
      onMouseEnter={(e) => { if (onClick) { e.currentTarget.style.borderColor = s?.borderColor || t.accent; e.currentTarget.style.boxShadow = t.shadowMd; } }}
      onMouseLeave={(e) => { if (onClick) { e.currentTarget.style.borderColor = s?.borderColor || t.border; e.currentTarget.style.boxShadow = t.shadow; } }}>
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

const kbStyles = `
  @keyframes kenburns {
    0%   { transform: scale(1.0) translate(0%, 0%); }
    50%  { transform: scale(1.12) translate(-2%, -1%); }
    100% { transform: scale(1.0) translate(0%, 0%); }
  }
  @keyframes authFadeIn {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .kb-img { position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;animation:kenburns 20s ease-in-out infinite;transform-origin:center center; }
  .kb-overlay { position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,0.55) 0%,rgba(0,0,0,0.35) 50%,rgba(0,0,0,0.65) 100%); }
  .kb-content { animation: authFadeIn 0.45s cubic-bezier(0.16,1,0.3,1) both; }
  .kb-back-btn { background:rgba(255,255,255,0.12)!important;border:1px solid rgba(255,255,255,0.2)!important;color:#fff!important;backdrop-filter:blur(8px); }
  .kb-card { background:rgba(255,255,255,0.1)!important;backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.2)!important;box-shadow:0 4px 24px rgba(0,0,0,0.3)!important;transition:background 0.2s,transform 0.2s!important; }
  .kb-card:hover { background:rgba(255,255,255,0.18)!important;transform:translateY(-2px); }
  .kb-input { background:rgba(255,255,255,0.12)!important;border:1px solid rgba(255,255,255,0.25)!important;color:#fff!important; }
  .kb-input::placeholder { color:rgba(255,255,255,0.4)!important; }
  .kb-input:focus { border-color:rgba(255,255,255,0.6)!important; }
`;

function AuthShell({ children, centered = false }) {
  return (
    <div style={{ minHeight: "100dvh", position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: centered ? "center" : "flex-start", padding: centered ? "20px" : "calc(env(safe-area-inset-top,0px) + 10vh) 20px calc(env(safe-area-inset-bottom,0px) + 40px)", overflowX: "hidden", overflowY: "auto" }}>
      <div className="kb-content" style={{ position: "relative", zIndex: 1, maxWidth: "420px", width: "100%" }}>
        {children}
      </div>
    </div>
  );
}

function RoleSelect({ onSelect }) {
  return (
    <AuthShell centered>
      <div style={{ textAlign: "center", marginBottom: "40px" }}>
        <div style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "3px", textTransform: "uppercase", color: "rgba(255,255,255,0.7)" }}>Insulation Services of Tulsa</div>
        <div style={{ fontSize: "36px", fontWeight: 700, color: "#fff", marginTop: "8px", letterSpacing: "-0.5px" }}>IST Dispatch</div>
        <div style={{ width: "40px", height: "2px", background: t.accent, margin: "14px auto 0", borderRadius: "1px" }} />
      </div>
      <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", justifyContent: "center" }}>
        <div className="kb-card" onClick={() => onSelect("admin")} style={{ flex: "1 1 160px", textAlign: "center", padding: "32px 20px", cursor: "pointer", borderRadius: "12px" }}>
          <div style={{ width: "44px", height: "44px", borderRadius: "10px", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <svg width="20" height="20" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
          </div>
          <div style={{ fontSize: "16px", fontWeight: 600, color: "#fff" }}>Office</div>
          <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.65)", marginTop: "4px" }}>Schedule jobs & manage crews</div>
        </div>
        <div className="kb-card" onClick={() => onSelect("crew")} style={{ flex: "1 1 160px", textAlign: "center", padding: "32px 20px", cursor: "pointer", borderRadius: "12px" }}>
          <div style={{ width: "44px", height: "44px", borderRadius: "10px", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <svg width="20" height="20" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8zM5.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM18.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"/></svg>
          </div>
          <div style={{ fontSize: "16px", fontWeight: 600, color: "#fff" }}>Field Crew</div>
          <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.65)", marginTop: "4px" }}>View jobs & send updates</div>
        </div>
      </div>
    </AuthShell>
  );
}

function AdminLogin({ onLogin, onBack }) {
  const [selected, setSelected] = useState(null);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [mode, setMode] = useState(null); // null | "enter" | "create"
  const [error, setError] = useState("");
  const [storedHash, setStoredHash] = useState(null);
  const [loadingPin, setLoadingPin] = useState(false);

  const hashPin = (p) => { let h = 0; const s = p + "ist_salt"; for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; } return String(h); };

  const handleSelect = async (name) => {
    if (loadingPin) return;
    setSelected(name);
    setPin("");
    setConfirmPin("");
    setError("");
    setLoadingPin(true);
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
    } finally {
      setLoadingPin(false);
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
      <AuthShell>
          <button onClick={() => { setSelected(null); setMode(null); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", fontSize: "13px", cursor: "pointer", marginBottom: "24px", padding: 0, fontFamily: "inherit" }}>← Back</button>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "8px", background: "rgba(255,255,255,0.2)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: 700 }}>{selected[0]}</div>
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
      </AuthShell>
    );
  }

  if (selected && mode === "create") {
    return (
      <AuthShell>
          <button onClick={() => { setSelected(null); setMode(null); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", fontSize: "13px", cursor: "pointer", marginBottom: "24px", padding: 0, fontFamily: "inherit" }}>← Back</button>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "8px", background: "rgba(255,255,255,0.2)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: 700 }}>{selected[0]}</div>
            <div style={{ fontSize: "18px", fontWeight: 600, color: t.text }}>{selected}</div>
          </div>
          <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "13.5px", margin: "0 0 20px" }}>First time? Set up a 4-digit PIN.</p>
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
      </AuthShell>
    );
  }

  return (
    <AuthShell>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", fontSize: "13px", cursor: "pointer", marginBottom: "24px", padding: 0, fontFamily: "inherit" }}>← Back</button>
        <h1 style={{ fontSize: "22px", fontWeight: 600, color: "#fff", margin: "0 0 6px" }}>Office Login</h1>
        <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "13.5px", margin: "0 0 24px" }}>Select your profile</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {OFFICE_PROFILES.map((name) => (
            <Card key={name} onClick={() => handleSelect(name)} style={{ padding: "14px 18px", cursor: loadingPin ? "wait" : "pointer", opacity: loadingPin && selected !== name ? 0.5 : 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "rgba(255,255,255,0.2)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: 700 }}>{name[0]}</div>
                <div style={{ fontWeight: 500, color: t.text, fontSize: "15px" }}>{name}</div>
                {loadingPin && selected === name && <div style={{ marginLeft: "auto", fontSize: 12, color: t.textMuted }}>Loading...</div>}
              </div>
            </Card>
          ))}
        </div>
    </AuthShell>
  );
}

function CrewLogin({ trucks, onLogin, onBack }) {
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [step, setStep] = useState("pick"); // pick | pin | setup | confirm | email
  const [selectedMember, setSelectedMember] = useState(null);
  const [pin, setPin] = useState("");
  const [setupPin, setSetupPin] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "crewMembers"), snap => {
      setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoadingMembers(false);
    });
    return unsub;
  }, []);

  function handleSelectMember(member) {
    setSelectedMember(member);
    setPin(""); setSetupPin(""); setError("");
    setStep(member.pin ? "pin" : "setup");
  }

  async function handlePinDigit(digit) {
    if (checking) return;

    if (step === "setup") {
      const next = setupPin + digit;
      if (next.length > 4) return;
      setSetupPin(next);
      if (next.length === 4) { setStep("confirm"); setPin(""); setError(""); }
      return;
    }

    if (step === "confirm") {
      const next = pin + digit;
      if (next.length > 4) return;
      setPin(next);
      if (next.length === 4) {
        if (next !== setupPin) {
          setError("PINs don't match. Try again.");
          setPin(""); setSetupPin(""); setStep("setup");
          return;
        }
        setChecking(true);
        await updateDoc(doc(db, "crewMembers", selectedMember.id), { pin: next });
        setChecking(false);
        if (!selectedMember.email) { setStep("email"); } else { finishLogin({ ...selectedMember, pin: next }); }
      }
      return;
    }

    // verify
    const next = pin + digit;
    if (next.length > 4) return;
    setPin(next);
    if (next.length === 4) {
      if (selectedMember.pin === next) {
        if (!selectedMember.email) { setStep("email"); } else { finishLogin(selectedMember); }
      } else {
        setError("Wrong PIN. Try again.");
        setPin("");
      }
    }
  }

  function finishLogin(member) {
    const truck = trucks.find(tr => tr.id === member.truckId) || null;
    onLogin(member, truck);
  }

  async function handleEmailSubmit() {
    if (email.trim()) {
      await updateDoc(doc(db, "crewMembers", selectedMember.id), { email: email.trim() });
    }
    finishLogin({ ...selectedMember, email: email.trim() });
  }

  function handleBackspace() {
    if (step === "setup") setSetupPin(p => p.slice(0,-1));
    else setPin(p => p.slice(0,-1));
    setError("");
  }

  const displayPin = step === "setup" ? setupPin : pin;
  const title = step === "pick" ? "Who are you?" : step === "setup" ? "Create your PIN" : step === "confirm" ? "Confirm your PIN" : step === "email" ? "One more thing" : `Hi, ${selectedMember?.name}`;
  const subtitle = step === "pick" ? "Select your name" : step === "setup" ? "You'll use this every time" : step === "confirm" ? "Enter your PIN again" : step === "email" ? "Add your email for job alerts (optional)" : "Enter your PIN";

  return (
    <AuthShell>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", fontSize: "13px", cursor: "pointer", marginBottom: "24px", padding: 0, fontFamily: "inherit" }}>← Back</button>
        <h1 style={{ fontSize: "22px", fontWeight: 600, color: "#fff", margin: "0 0 6px" }}>{title}</h1>
        <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "13.5px", margin: "0 0 24px" }}>{subtitle}</p>

        {step === "pick" && (
          loadingMembers ? <EmptyState text="Loading..." /> :
          members.length === 0 ? <EmptyState text="No crew members yet." sub="Ask the office to add you to the roster." /> :
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "55vh", overflowY: "auto", WebkitOverflowScrolling: "touch", paddingBottom: "8px" }}>
            {members.sort((a,b) => { const ap = a.pin ? 0 : 1; const bp = b.pin ? 0 : 1; return ap !== bp ? ap - bp : a.name.localeCompare(b.name); }).map(m => (
              <Card key={m.id} onClick={() => handleSelectMember(m)} style={{ padding: "14px 16px", cursor: "pointer", flexShrink: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 15, color: t.text }}>{m.name}</div>
                {m.truckId && <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
                  {(() => { const tr = trucks.find(tr => tr.id === m.truckId); return tr ? (tr.members || tr.name) : ""; })()}
                </div>}
                {!m.pin && <div style={{ fontSize: 11, color: t.accent, marginTop: 2 }}>First time — set PIN</div>}
              </Card>
            ))}
          </div>
        )}

        {step === "email" && (
          <>
            <Input label="Your Email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} />
            <Button onClick={handleEmailSubmit} style={{ width: "100%", marginTop: 8 }}>Continue</Button>
            <button onClick={() => finishLogin(selectedMember)} style={{ width: "100%", marginTop: 8, background: "none", border: "none", color: t.textMuted, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Skip for now</button>
          </>
        )}

        {(step === "pin" || step === "setup" || step === "confirm") && (
          <>
            <div style={{ display: "flex", justifyContent: "center", gap: 16, marginBottom: 32 }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{ width: 18, height: 18, borderRadius: "50%", background: i < displayPin.length ? t.accent : "rgba(0,0,0,0.12)", transition: "background 0.15s" }} />
              ))}
            </div>
            {error && <div style={{ textAlign: "center", color: "#ef4444", fontSize: 14, marginBottom: 16, fontWeight: 500 }}>{error}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
              {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((d, i) => {
                if (d === "") return <div key={i} />;
                return (
                  <button key={i} onClick={() => d === "⌫" ? handleBackspace() : handlePinDigit(String(d))}
                    disabled={checking}
                    style={{ padding: "18px 0", borderRadius: 12, fontSize: d === "⌫" ? 20 : 22, fontWeight: 600, background: "#fff", border: "1.5px solid " + t.border, color: t.text, cursor: "pointer", fontFamily: "inherit", WebkitTapHighlightColor: "transparent" }}>{d}</button>
                );
              })}
            </div>
            <button onClick={() => { setStep("pick"); setPin(""); setSetupPin(""); setError(""); }} style={{ width: "100%", padding: "10px", background: "none", border: "none", color: t.textMuted, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>← Back</button>
          </>
        )}
    </AuthShell>
  );
}

// ─── Crew Dashboard ───
function buildDayJobMap(jobs, updates, memberId, memberName, mon, sat) {
  const map = {};
  const localStr = (d) => d.toLocaleDateString("en-CA");
  const monStr = localStr(mon);
  const satStr = localStr(sat);
  const todayStr = todayCST();

  (jobs || [])
    .filter(j => {
      // Include if member is in default crew OR any daily override
      const inDefault = Array.isArray(j.crewMemberIds) && j.crewMemberIds.includes(memberId);
      const inAnyOverride = Object.values(j.dailyCrewOverrides || {}).some(ids => ids.includes(memberId));
      return inDefault || inAnyOverride;
    })
    .forEach(j => {
      const jobUpds = (updates || [])
        .filter(u => u.jobId === j.id)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      // Job must have at least one in_progress update to appear on timesheet
      const firstStarted = jobUpds.find(u => ["in_progress","on_site","started"].includes(u.status));
      if (!firstStarted) return;

      const startDate = tsToCST(firstStarted.timestamp);

      // End date: when completed, or today if still open
      const completedUpd = [...jobUpds].reverse().find(u => u.status === "completed");
      const endDate = completedUpd ? tsToCST(completedUpd.timestamp) : todayStr;

      // Show job on every day within the week range between start and end
      const cur = new Date(Math.max(new Date(startDate + "T12:00:00"), mon));
      const end = new Date(Math.min(new Date(endDate + "T12:00:00"), sat));

      while (cur <= end) {
        const dayStr = localStr(cur);
        // Check dailyCrewOverrides for this day; fall back to default crewMemberIds
        const overrides = j.dailyCrewOverrides || {};
        const crewForDay = overrides[dayStr] ? overrides[dayStr] : (j.crewMemberIds || []);
        if (crewForDay.includes(memberId)) {
          if (!map[dayStr]) map[dayStr] = [];
          if (!map[dayStr].find(x => x.id === j.id)) map[dayStr].push(j);
        }
        cur.setDate(cur.getDate() + 1);
      }
    });
  return map;
}

function buildTimesheetHtml(name, mon, sat, DAYS, dayJobMap, _unused, fmtDate, fmtDay, dayNotes = {}) {
  const rows = DAYS.map(day => {
    const dayStr = day.toLocaleDateString("en-CA");
    const dayJobs = dayJobMap[dayStr] || [];
    const note = dayNotes[dayStr];
    const noteHtml = note ? `<div style="font-size:9px;font-style:italic;color:#555;margin-top:3px;border-top:1px dashed #ccc;padding-top:2px">${note}</div>` : "";
    return `<tr><td style="padding:3px 8px;border:1px solid #ccc;font-weight:600;white-space:nowrap;vertical-align:top;font-size:10px;width:90px">${fmtDay(day)}</td><td style="padding:3px 8px;border:1px solid #ccc;font-size:10px">${dayJobs.length === 0 ? '<span style="color:#aaa">—</span>' : dayJobs.map(j => `<span style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px"><span><strong>${j.builder || "No Customer"}</strong> — ${j.address}${j.type ? " (" + j.type + ")" : ""}</span><span style="margin-left:12px;white-space:nowrap;font-size:9px">Pay: <span style="display:inline-block;width:80px;border-bottom:1px solid #000">&nbsp;</span></span></span>`).join("")}${noteHtml}</td></tr>`;
  }).join("");
  return `<!DOCTYPE html><html><head><title>Timesheet</title><style>@page{size:letter;margin:0.5in}*{box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:10px;color:#111;margin:0}h2{font-size:13px;margin:0 0 2px}p{font-size:9px;color:#666;margin:0 0 8px}table{width:100%;border-collapse:collapse}th{padding:3px 8px;border:1px solid #ccc;background:#f5f5f5;text-align:left;font-size:10px}.summary{margin-top:8px;border:1px solid #ccc;border-radius:4px;overflow:hidden}.srow{display:flex;justify-content:space-between;align-items:center;padding:3px 8px;border-bottom:1px solid #eee;font-size:10px}.srow:last-child{border:none;font-weight:700}.blank{display:inline-block;width:100px;border-bottom:1px solid #000}@media print{body{-webkit-print-color-adjust:exact}}</style></head><body><h2>Weekly Timesheet — ${name}</h2><p>Week of ${fmtDate(mon)} – ${fmtDate(sat)} &nbsp;|&nbsp; Printed ${new Date().toLocaleDateString()}</p><table><thead><tr><th style="width:90px">Day</th><th>Jobs &amp; Pay</th></tr></thead><tbody>${rows}</tbody></table><div class="summary"><div class="srow"><span>Regular Hours</span><span class="blank">&nbsp;</span></div><div class="srow"><span>Overtime Hours</span><span class="blank">&nbsp;</span></div><div class="srow"><span>Total Job Pay</span><span class="blank">&nbsp;</span></div><div class="srow"><span>Overtime Pay</span><span class="blank">&nbsp;</span></div><div class="srow"><span>Total Pay</span><span class="blank">&nbsp;</span></div></div></body></html>`;
}

function CrewTimesheetTab({ crewMemberId, crewName, jobs, updates, weekOffset, setWeekOffset }) {
  const getWeekRange = (offsetWeeks = 0) => {
    const now = new Date();
    const day = now.getDay();
    const mon = new Date(now);
    mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offsetWeeks * 7);
    mon.setHours(0,0,0,0);
    const sat = new Date(mon);
    sat.setDate(mon.getDate() + 5);
    sat.setHours(23,59,59,999);
    return { mon, sat };
  };
  const { mon, sat } = getWeekRange(weekOffset);
  const fmtDate = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const fmtDay = (d) => d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  const localDateStr = (d) => d.toLocaleDateString("en-CA");
  const weekKey = localDateStr(mon);
  const tsDocId = `${crewMemberId}_${weekKey}`;
  const DAYS = Array.from({ length: 6 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d; });

  const [tsNotes, setTsNotes] = useState({});
  const [noteDay, setNoteDay] = useState(null);
  const [noteText, setNoteText] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "timesheets", tsDocId), snap => {
      setTsNotes(snap.exists() ? (snap.data().dayNotes || {}) : {});
    });
    return unsub;
  }, [tsDocId]);

  const saveNote = async () => {
    await setDoc(doc(db, "timesheets", tsDocId), { dayNotes: { ...tsNotes, [noteDay]: noteText }, memberId: crewMemberId, memberName: crewName, weekStart: weekKey }, { merge: true });
    setNoteDay(null);
  };

  const dayJobMap = buildDayJobMap(jobs, updates, crewMemberId, crewName, mon, sat);

  const handlePrint = () => {
    const html = buildTimesheetHtml(crewName, mon, sat, DAYS, dayJobMap, null, fmtDate, fmtDay, tsNotes);
    const w = window.open("", "_blank"); w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: t.text }}>Weekly Timesheet</div>
          <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>{fmtDate(mon)} – {fmtDate(sat)}</div>
        </div>
        <Button onClick={handlePrint} variant="secondary" style={{ fontSize: 13 }}>Print</Button>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Button variant="secondary" onClick={() => setWeekOffset(w => w - 1)} style={{ fontSize: 13 }}>Prev Week</Button>
        {weekOffset !== 0 && <Button variant="secondary" onClick={() => setWeekOffset(0)} style={{ fontSize: 13 }}>This Week</Button>}
        {weekOffset < 0 && <Button variant="secondary" onClick={() => setWeekOffset(w => w + 1)} style={{ fontSize: 13 }}>Next Week</Button>}
      </div>
      {DAYS.map(day => {
        const dayStr = localDateStr(day);
        const dayJobs = dayJobMap[dayStr] || [];
        const note = tsNotes[dayStr];
        return (
          <Card key={dayStr} style={{ marginBottom: 10, cursor: "pointer" }} onClick={() => { setNoteDay(dayStr); setNoteText(note || ""); }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: dayJobs.length > 0 || note ? 8 : 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: t.text }}>{fmtDay(day)}</div>
              <span style={{ fontSize: 11, color: t.accent }}>+ Note</span>
            </div>
            {dayJobs.length === 0 && !note ? <div style={{ fontSize: 12, color: t.textMuted }}>No jobs — tap to add a note</div> : null}
            {dayJobs.map(j => (
              <div key={j.id} style={{ padding: "4px 0", borderTop: "1px solid " + t.borderLight }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: t.text }}>{j.builder || "No Customer"}</div>
                <div style={{ color: t.textMuted, fontSize: 12 }}>{j.address}{j.type ? " — " + j.type : ""}</div>
              </div>
            ))}
            {note ? <div style={{ marginTop: 6, fontSize: 12, color: t.textSecondary, fontStyle: "italic", borderTop: "1px solid " + t.borderLight, paddingTop: 4 }}>{note}</div> : null}
          </Card>
        );
      })}
      <Card style={{ marginTop: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>Weekly Summary</div>
        {["Regular Hours", "Overtime Hours", "Total Job Pay", "Overtime Pay", "Total Pay"].map(label => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", paddingBottom: 7, marginBottom: 7, borderBottom: "1px solid " + t.borderLight }}>
            <span style={{ fontSize: 13, color: t.text }}>{label}</span>
            <span style={{ fontSize: 13, color: t.textMuted }}>___________</span>
          </div>
        ))}
      </Card>

      {noteDay && (
        <Modal title={`Note — ${fmtDay(new Date(noteDay + "T12:00:00"))}`} onClose={() => setNoteDay(null)}>
          <TextArea label="Additional work or notes for this day" placeholder="e.g. Helped on Johnson job, assisted with blowing attic around 3pm" value={noteText} onChange={e => setNoteText(e.target.value)} />
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <Button variant="secondary" onClick={() => setNoteDay(null)} style={{ flex: 1 }}>Cancel</Button>
            <Button onClick={saveNote} style={{ flex: 1 }}>Save</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function DailyProcedureCard() {
  const [open, setOpen] = useState(false);
  const steps = [
    "Every morning — count everything on your truck plus what you're pulling from the warehouse. Enter the total and tap Confirm Load Out.",
    "After each job — tap Log Materials on the job card and enter what you used. Do this before leaving the job site.",
    "Multi-day jobs — log materials at the end of every day worked. You will not be able to close out the job until all days are accounted for.",
    "When the job is finished — mark it as Completed. If today's materials are already logged, it will close out immediately. If not, you'll be prompted to enter them first.",
    "Every evening when you return to the shop — tap Unload to Warehouse to return all remaining materials back to inventory."
  ];
  return (
    <Card style={{ marginBottom: 16, borderLeft: "4px solid #dc2626" }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: "inherit" }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "#dc2626" }}>⚠️ DAILY PROCEDURE</div>
        <span style={{ fontSize: 16, color: "#dc2626", display: "inline-block", transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▾</span>
      </button>
      {open && (
        <ol style={{ margin: "10px 0 0 0", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 8 }}>
          {steps.map((s, i) => <li key={i} style={{ fontSize: 12, color: "#dc2626", fontWeight: 600, lineHeight: 1.6 }}>{s}</li>)}
        </ol>
      )}
    </Card>
  );
}

function CrewDashboard({ truck, crewName, crewMemberId, jobs, updates, tickets, inventory, truckInventory, onSubmitUpdate, onSubmitTicket, onCloseOutJob, onSaveJobMaterials, onLoadTruck, onReturnMaterial, onDeductFromTruck, onDeltaAdjustTruck, onLogDailyMaterials, onLogout }) {
  const myJobs = jobs.filter((j) => {
    if (j.onHold) return false;
    const assignedByMember = crewMemberId && (j.crewMemberIds || []).includes(crewMemberId);
    if (!assignedByMember) return false;
    const latest = updates.filter((u) => u.jobId === j.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
    return !latest || latest.status !== "completed";
  });
  const myTickets = tickets.filter((tk) => tk.truckId === truck.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const [crewView, setCrewView] = useState("jobs");
  const [tsWeekOffset, setTsWeekOffset] = useState(0);
  const [activeJob, setActiveJob] = useState(null);
  const [materialCountJob, setMaterialCountJob] = useState(null);
  const [materialQtys, setMaterialQtys] = useState({});
  const [confirmUnload, setConfirmUnload] = useState(false);
  const [closeoutJob, setCloseoutJob] = useState(null);
  const [closeoutMaterialQtys, setCloseoutMaterialQtys] = useState({});
  const [editMaterialsJob, setEditMaterialsJob] = useState(null);
  const [editMaterialQtys, setEditMaterialQtys] = useState({});
  const [dailyMaterialsJob, setDailyMaterialsJob] = useState(null);
  const [dailyMaterialQtys, setDailyMaterialQtys] = useState({});
  const [histCalMonth, setHistCalMonth] = useState(new Date().getMonth());
  const [histCalYear, setHistCalYear] = useState(new Date().getFullYear());
  const [histDayJobs, setHistDayJobs] = useState(null); // { date, jobs[] }
  const [loadTruckMode, setLoadTruckMode] = useState(false);
  const [loadQtys, setLoadQtys] = useState({});   // from warehouse
  const [carriedQtys, setCarriedQtys] = useState({});  // already on truck
  const [status, setStatus] = useState("in_progress");
  const [eta, setEta] = useState("");
  const [notes, setNotes] = useState("");
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [ticketDesc, setTicketDesc] = useState("");
  const [ticketPriority, setTicketPriority] = useState("medium");
  const [ticketType, setTicketType] = useState("equipment");
  const [toCalMonth, setToCalMonth] = useState(new Date().getMonth());
  const [toCalYear, setToCalYear] = useState(new Date().getFullYear());
  const [toStart, setToStart] = useState(null);
  const [toEnd, setToEnd] = useState(null);
  const toMonthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const toCalDays = () => {
    const first = new Date(toCalYear, toCalMonth, 1);
    const cells = [];
    for (let i = 0; i < first.getDay(); i++) cells.push(null);
    for (let d = 1; d <= new Date(toCalYear, toCalMonth + 1, 0).getDate(); d++) cells.push(d);
    return cells;
  };
  const toDateStr = (y, m, d) => y + "-" + String(m + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
  const handleToDay = (day) => {
    if (!day) return;
    const ds = toDateStr(toCalYear, toCalMonth, day);
    if (!toStart || (toStart && toEnd)) { setToStart(ds); setToEnd(null); }
    else if (ds < toStart) { setToEnd(toStart); setToStart(ds); }
    else { setToEnd(ds); }
  };
  const isInToRange = (day) => {
    if (!day || !toStart) return false;
    const ds = toDateStr(toCalYear, toCalMonth, day);
    if (!toEnd) return ds === toStart;
    return ds >= toStart && ds <= toEnd;
  };
  const isToStartOrEnd = (day) => {
    if (!day || !toStart) return false;
    const ds = toDateStr(toCalYear, toCalMonth, day);
    return ds === toStart || ds === toEnd;
  };
  const formatToDate = (ds) => { if (!ds) return ""; const [y, m, d] = ds.split("-"); return toMonthNames[parseInt(m) - 1] + " " + parseInt(d); };

  const getJobUpdates = (jobId) => updates.filter((u) => u.jobId === jobId).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const getLatestStatus = (jobId) => { const u = getJobUpdates(jobId); return u.length > 0 ? u[0].status : "not_started"; };

  const getWorkedDays = (job) => {
    // All unique calendar days this job had an in_progress or on_site update
    const jobUpds = updates.filter(u => u.jobId === job.id);
    const days = new Set();
    jobUpds.forEach(u => {
      if (u.status === "in_progress" || u.status === "on_site" || u.status === "started") {
        days.add(tsToCST(u.timestamp));
      }
    });
    return [...days].sort();
  };

  const getMissingMaterialDays = (job) => {
    const worked = getWorkedDays(job);
    const logged = new Set((job.dailyMaterialLogs || []).map(l => l.date));
    const today = todayCST();
    // Exclude today — that's handled by closeout modal
    return worked.filter(d => d !== today && !logged.has(d));
  };

  const handleSubmit = () => {
    if (status === "completed") {
      // Check all worked days have materials logged (including today)
      const missing = getMissingMaterialDays(activeJob);
      const todayStr = todayCST();
      const todayLogged = (activeJob.dailyMaterialLogs || []).some(l => l.date === todayStr);
      const allMissing = todayLogged ? missing : [...missing, todayStr];
      if (allMissing.length > 0 && !todayLogged) {
        // Today not logged — show closeout modal to capture today's materials
        const fmt = (ds) => { const [y,m,d] = ds.split("-"); return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(m)-1] + " " + parseInt(d); };
        if (missing.length > 0) {
          alert("Please log materials for all worked days before closing out.\n\nMissing: " + missing.map(fmt).join(", "));
          return;
        }
        setCloseoutJob({ job: activeJob, status, eta, notes });
        setCloseoutMaterialQtys({});
        setActiveJob(null); setStatus("in_progress"); setEta(""); setNotes("");
        return;
      }
      if (missing.length > 0) {
        const fmt = (ds) => { const [y,m,d] = ds.split("-"); return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(m)-1] + " " + parseInt(d); };
        alert("Please log materials for all worked days before closing out.\n\nMissing: " + missing.map(fmt).join(", "));
        return;
      }
      // Today already logged — skip material entry, go straight to closeout
      setCloseoutJob({ job: activeJob, status, eta, notes, skipMaterials: true });
      setCloseoutMaterialQtys({});
      setActiveJob(null); setStatus("in_progress"); setEta(""); setNotes("");
      return;
    }
    onSubmitUpdate({ jobId: activeJob.id, truckId: truck.id, crewName, status, eta, notes, timestamp: new Date().toISOString(), timeStr: timeStr() });
    setActiveJob(null); setStatus("in_progress"); setEta(""); setNotes("");
  };

  const handleCloseoutConfirm = (bypass) => {
    const { job, status: s, eta: e, notes: n } = closeoutJob;
    const isFoam = (id) => ["oc_a","oc_b","cc_a","cc_b","env_oc_a","env_oc_b","env_cc_a","env_cc_b","free_env_oc_a","free_env_oc_b"].includes(id);
    const materialsUsed = bypass ? null : (() => {
      const used = {};
      INVENTORY_ITEMS.forEach(i => {
        const qty = closeoutMaterialQtys[i.id];
        if (qty && parseFloat(qty) > 0) {
          used[i.id] = isFoam(i.id) ? Math.round(parseFloat(qty) / (["cc_a","cc_b","env_cc_a","env_cc_b"].includes(i.id) ? 50 : 48) * 100) / 100 : parseFloat(qty);
        }
      });
      return Object.keys(used).length > 0 ? used : null;
    })();
    // Deduct used materials from truck
    if (materialsUsed && truck?.id) {
      onDeductFromTruck(truck.id, materialsUsed);
    }
    onSubmitUpdate({ jobId: job.id, truckId: truck.id, crewName, status: s, eta: e, notes: n, timestamp: new Date().toISOString(), timeStr: timeStr() });
    onCloseOutJob(job.id, materialsUsed);
    setCloseoutJob(null); setCloseoutMaterialQtys({});
  };

  // Completed jobs for today (or recent) that belong to this crew member
  const today = todayCST();
  const myCompletedJobs = jobs.filter(j => {
    const assignedByMember = crewMemberId && (j.crewMemberIds || []).includes(crewMemberId);
    if (!assignedByMember) return false;
    const completedUpdate = updates.filter(u => u.jobId === j.id && u.status === "completed")[0];
    if (!completedUpdate) return false;
    return tsToCST(completedUpdate.timestamp) === today;
  });
  const handleTicketSubmit = () => {
    const desc = ticketType === "timeoff"
      ? (toStart ? (toEnd && toEnd !== toStart ? formatToDate(toStart) + " – " + formatToDate(toEnd) : formatToDate(toStart)) : "") + (ticketDesc.trim() ? (toStart ? " — " : "") + ticketDesc.trim() : "")
      : ticketDesc;
    onSubmitTicket({ truckId: truck.id, truckName: truck.name, submittedBy: crewName, description: desc, priority: ticketPriority, ticketType, timeOffStart: ticketType === "timeoff" ? toStart : null, timeOffEnd: ticketType === "timeoff" ? (toEnd || toStart) : null, status: "open", timestamp: new Date().toISOString() });
    setTicketDesc(""); setTicketPriority("medium"); setTicketType("equipment"); setToStart(null); setToEnd(null); setShowTicketForm(false);
  };

  const tabStyle = (active) => ({ padding: "8px 16px", background: active ? t.accent : "transparent", color: active ? "#fff" : t.textMuted, border: active ? "none" : "1px solid " + t.border, borderRadius: "6px", fontSize: "12.5px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit", position: "relative" });
  const openTicketCount = myTickets.filter((tk) => tk.status !== "resolved").length;

  return (
    <div style={{ minHeight: "100dvh", background: t.bg }}>
      <div style={{ background: t.surface, borderBottom: "1px solid " + t.border, padding: "12px 20px", paddingTop: "calc(12px + env(safe-area-inset-top, 0px))", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "15px", fontWeight: 600, color: t.text }}>IST Dispatch</div>
            <div style={{ fontSize: "12px", color: t.textMuted }}>{truck.name} — {crewName}</div>
          </div>
          <Button variant="ghost" onClick={onLogout} style={{ fontSize: "12px" }}>Log Out</Button>
        </div>
        <div style={{ display: "flex", gap: "6px", marginTop: "10px" }}>
          <button style={tabStyle(crewView === "jobs")} onClick={() => setCrewView("jobs")}>Jobs</button>
          <button style={tabStyle(crewView === "truck")} onClick={() => setCrewView("truck")}>Truck</button>
          <button style={tabStyle(crewView === "history")} onClick={() => setCrewView("history")}>Calendar</button>
          <button style={tabStyle(crewView === "timesheet")} onClick={() => setCrewView("timesheet")}>Timesheet</button>
          <button style={tabStyle(crewView === "tickets")} onClick={() => setCrewView("tickets")}>
            Tickets
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
                  {(() => {
                    const jobUpds = updates.filter(u => u.jobId === job.id);
                    const workedDays = [...new Set(jobUpds.filter(u => ["in_progress","on_site","started"].includes(u.status)).map(u => tsToCST(u.timestamp)))].sort();
                    const logged = new Set((job.dailyMaterialLogs || []).map(l => l.date));
                    const todayStr = todayCST();
                    const missing = workedDays.filter(d => d !== todayStr && !logged.has(d));
                    if (missing.length === 0) return null;
                    const fmt = (ds) => { const [y,m,d] = ds.split("-"); return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(m)-1]+" "+parseInt(d); };
                    return (
                      <div style={{ fontSize: "12px", color: "#b45309", background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: "6px", padding: "8px 10px", marginBottom: "10px" }}>
                        ⚠️ Materials not logged for: <strong>{missing.map(fmt).join(", ")}</strong> — required before closeout
                      </div>
                    );
                  })()}
                  {(job.dailyMaterialLogs || []).length > 0 && (
                    <div style={{ marginBottom: "10px", background: t.bg, borderRadius: "6px", padding: "8px 12px" }}>
                      <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", color: t.textMuted, marginBottom: "6px", fontWeight: 600 }}>Materials Logged</div>
                      {(job.dailyMaterialLogs || []).map((log, idx) => (
                        <div key={idx} style={{ fontSize: "12px", color: t.textSecondary, paddingBottom: "4px", marginBottom: "4px", borderBottom: idx < job.dailyMaterialLogs.length - 1 ? "1px solid " + t.borderLight : "none" }}>
                          <span style={{ color: t.textMuted, marginRight: "8px" }}>{log.date}</span>
                          {Object.entries(log.materials).map(([itemId, qty]) => {
                            const item = INVENTORY_ITEMS.find(i => i.id === itemId);
                            if (!item) return null;
                            const isFoam = ["oc_a","oc_b","cc_a","cc_b","env_oc_a","env_oc_b","env_cc_a","env_cc_b","free_env_oc_a","free_env_oc_b"].includes(itemId);
                            const display = isFoam ? Math.round(qty * (["cc_a","cc_b","env_cc_a","env_cc_b"].includes(itemId) ? 50 : 48)) + " gal" : qty + " " + item.unit;
                            return <span key={itemId} style={{ marginRight: "8px" }}>{item.name}: <strong>{display}</strong></span>;
                          })}
                        </div>
                      ))}
                    </div>
                  )}
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
                  {(() => {
                    const todayStr = todayCST();
                    const existingToday = (job.dailyMaterialLogs || []).find(l => l.date === todayStr);
                    return (
                      <div style={{ display: "flex", gap: "8px" }}>
                        <Button onClick={() => setActiveJob(job)} style={{ flex: 1 }}>Send Update</Button>
                        <Button variant="secondary" onClick={() => {
                          if (existingToday) {
                            const preQtys = {};
                            INVENTORY_ITEMS.forEach(i => {
                              const isFoam = ["oc_a","oc_b","cc_a","cc_b","env_oc_a","env_oc_b","env_cc_a","env_cc_b","free_env_oc_a","free_env_oc_b"].includes(i.id);
                              const val = existingToday.materials[i.id];
                              if (val) preQtys[i.id] = isFoam ? String(Math.round(val * (["cc_a","cc_b","env_cc_a","env_cc_b"].includes(i.id) ? 50 : 48))) : String(val);
                            });
                            setDailyMaterialQtys(preQtys);
                            // Pass existing materials explicitly so delta calc is always accurate
                            setDailyMaterialsJob({ ...job, _existingMaterials: existingToday.materials });
                          } else {
                            setDailyMaterialQtys({});
                            setDailyMaterialsJob(job);
                          }
                        }} style={{ flex: 1 }}>{existingToday ? "Edit Today" : "Log Materials"}</Button>
                      </div>
                    );
                  })()}
                </Card>
              );
            })}


          </>
        )}

        {/* ── LOAD TRUCK MODAL ── */}
        {crewView === "history" && (() => {
          const isFoam = (id) => ["oc_a","oc_b","cc_a","cc_b","env_oc_a","env_oc_b","env_cc_a","env_cc_b","free_env_oc_a","free_env_oc_b"].includes(id);
          const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
          const dayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
          // All completed jobs for this crew member
          const allMyCompleted = jobs.filter(j => {
            if (!(j.crewMemberIds || []).includes(crewMemberId)) return false;
            return updates.some(u => u.jobId === j.id && u.status === "completed");
          });
          // Map: date string -> jobs completed that day
          const completedByDate = {};
          allMyCompleted.forEach(j => {
            const cu = updates.filter(u => u.jobId === j.id && u.status === "completed").sort((a,b) => new Date(b.timestamp)-new Date(a.timestamp))[0];
            if (!cu) return;
            const d = tsToCST(cu.timestamp);
            if (!completedByDate[d]) completedByDate[d] = [];
            completedByDate[d].push(j);
          });
          const firstDay = new Date(histCalYear, histCalMonth, 1).getDay();
          const daysInMonth = new Date(histCalYear, histCalMonth + 1, 0).getDate();
          const cells = [];
          for (let i = 0; i < firstDay; i++) cells.push(null);
          for (let d = 1; d <= daysInMonth; d++) cells.push(d);
          const ds = (d) => histCalYear + "-" + String(histCalMonth+1).padStart(2,"0") + "-" + String(d).padStart(2,"0");
          return (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <button onClick={() => { if (histCalMonth === 0) { setHistCalMonth(11); setHistCalYear(histCalYear-1); } else setHistCalMonth(histCalMonth-1); }} style={{ background: "none", border: "1px solid "+t.border, borderRadius: 6, padding: "6px 12px", cursor: "pointer", color: t.text, fontSize: 16 }}>{"<"}</button>
                <div style={{ fontWeight: 700, fontSize: 16, color: t.text }}>{monthNames[histCalMonth]} {histCalYear}</div>
                <button onClick={() => { if (histCalMonth === 11) { setHistCalMonth(0); setHistCalYear(histCalYear+1); } else setHistCalMonth(histCalMonth+1); }} style={{ background: "none", border: "1px solid "+t.border, borderRadius: 6, padding: "6px 12px", cursor: "pointer", color: t.text, fontSize: 16 }}>{">"}</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 4 }}>
                {dayNames.map(d => <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", padding: "4px 0" }}>{d}</div>)}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
                {cells.map((day, idx) => {
                  if (!day) return <div key={"e"+idx} />;
                  const dateStr = ds(day);
                  const dayJobs = completedByDate[dateStr] || [];
                  const hasJobs = dayJobs.length > 0;
                  const isToday = dateStr === todayCST();
                  return (
                    <div key={dateStr} onClick={() => hasJobs && setHistDayJobs({ date: dateStr, jobs: dayJobs })}
                      style={{ minHeight: 48, borderRadius: 8, border: "1px solid " + (isToday ? t.accent : t.border), background: hasJobs ? "#dcfce7" : t.surface, cursor: hasJobs ? "pointer" : "default", padding: "4px 5px", position: "relative" }}>
                      <div style={{ fontSize: 12, fontWeight: isToday ? 700 : 500, color: isToday ? t.accent : t.text }}>{day}</div>
                      {hasJobs && <div style={{ fontSize: 10, fontWeight: 700, color: "#15803d", marginTop: 2 }}>{dayJobs.length} job{dayJobs.length > 1 ? "s" : ""}</div>}
                    </div>
                  );
                })}
              </div>
              {histDayJobs && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: t.text }}>{new Date(histDayJobs.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</div>
                    <button onClick={() => setHistDayJobs(null)} style={{ background: "none", border: "none", color: t.textMuted, fontSize: 18, cursor: "pointer" }}>✕</button>
                  </div>
                  {histDayJobs.jobs.map(job => {
                    const mu = job.materialsUsed || {};
                    const hasMaterials = Object.keys(mu).length > 0;
                    return (
                      <Card key={job.id} style={{ borderLeft: "3px solid #15803d" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14, color: t.text }}>{job.builder || "No Customer"}</div>
                            <div style={{ fontSize: 12, color: t.textMuted }}>{job.address}</div>
                            <div style={{ fontSize: 12, color: t.textMuted }}>{job.type}</div>
                          </div>
                          <Badge color="#15803d" bg="#dcfce7">Done</Badge>
                        </div>
                        {hasMaterials ? (
                          <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 6 }}>
                            {Object.entries(mu).map(([itemId, qty]) => {
                              const item = INVENTORY_ITEMS.find(i => i.id === itemId);
                              if (!item) return null;
                              let display = isFoam(itemId) ? Math.round(qty * (["cc_a","cc_b","env_cc_a","env_cc_b"].includes(itemId) ? 50 : 48)) + " gal" : qty + " " + item.unit;
                              return <div key={itemId}>{item.name} — <strong>{display}</strong></div>;
                            })}
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: t.textMuted, fontStyle: "italic", marginTop: 6 }}>No materials logged</div>
                        )}
                        {histDayJobs.date === today && (
                          <Button variant="secondary" onClick={() => { setEditMaterialsJob(job); setEditMaterialQtys({}); }} style={{ width: "100%", marginTop: 10, fontSize: 13 }}>
                            {hasMaterials ? "Edit Materials" : "Log Materials"}
                          </Button>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {crewView === "truck" && (() => {
          const isFoam = (id) => ["oc_a","oc_b","cc_a","cc_b","env_oc_a","env_oc_b","env_cc_a","env_cc_b","free_env_oc_a","free_env_oc_b"].includes(id);
          const galsToBbl = (g, id) => Math.round(g / (id && ["cc_a","cc_b","env_cc_a","env_cc_b"].includes(id) ? 50 : 48) * 100) / 100;
          const bblToGals = (b, id) => Math.round(b * (id && ["cc_a","cc_b","env_cc_a","env_cc_b"].includes(id) ? 50 : 48));
          const loadedItems = INVENTORY_ITEMS.filter(i => (truckInventory[i.id] || 0) > 0);
          const ocSets = Math.min(truckInventory["oc_a"] || 0, truckInventory["oc_b"] || 0);
          const ccSets = Math.min(truckInventory["cc_a"] || 0, truckInventory["cc_b"] || 0);
          const envOcSets = Math.min(truckInventory["env_oc_a"] || 0, truckInventory["env_oc_b"] || 0);
          const envCcSets = Math.min(truckInventory["env_cc_a"] || 0, truckInventory["env_cc_b"] || 0);
          const freeEnvOcSets = Math.min(truckInventory["free_env_oc_a"] || 0, truckInventory["free_env_oc_b"] || 0);
          const nonFoamLoaded = loadedItems.filter(i => !isFoam(i.id));
          const renderTruckForm = (mode) => {
            const categories = [...new Set(INVENTORY_ITEMS.map(i => i.category))];
            const itemsForMode = mode === "return"
              ? INVENTORY_ITEMS.filter(i => (truckInventory[i.id] || 0) > 0 || (i.isPieces && truckInventory[i.parentId] > 0))
              : INVENTORY_ITEMS;
            const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid " + t.border, fontSize: 15, fontFamily: "inherit", textAlign: "right", boxSizing: "border-box" };
            return (
              <div>
                <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 16 }}>
                  {mode === "load"
                    ? <div style={{ marginBottom: 8, color: "#dc2626", fontWeight: 600 }}>Count <strong>everything on your truck</strong> — what was already there plus what you're grabbing today. Enter the total.</div>
                    : "Enter what you still have on the truck. Anything not entered was used on the job."}
                </div>
                {categories.map(cat => {
                  const items = itemsForMode.filter(i => i.category === cat);
                  if (items.length === 0) return null;
                  return (
                    <div key={cat} style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: t.accent, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 10 }}>{cat}</div>
                      {mode === "return" && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 56px 90px 56px", gap: "4px 8px", alignItems: "center", marginBottom: 6, paddingBottom: 6, borderBottom: "1px solid " + t.border }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase" }}></div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", textAlign: "center" }}>Loaded</div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "#15803d", textTransform: "uppercase", textAlign: "center" }}>Still Have</div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "#dc2626", textTransform: "uppercase", textAlign: "center" }}>Used</div>
                        </div>
                      )}
                      {items.map(item => {
                        const warehouseQty = inventory.find(r => r.itemId === item.id)?.qty || 0;
                        const onTruck = truckInventory[item.id] || 0;
                        const pi = item.hasPieces ? INVENTORY_ITEMS.find(x => x.parentId === item.id) : null;

                        const label = item.isPieces ? "↳ Loose pieces" : item.name;
                        const subLabel = isFoam(item.id)
                          ? `${warehouseQty.toFixed(2)} bbl (${bblToGals(warehouseQty, item.id)} gal) in warehouse`
                          : warehouseQty > 0 ? `${warehouseQty} in warehouse` : "0 in warehouse";

                        if (mode === "return") {
                          const stillHaveUnits = isFoam(item.id) ? (loadQtys[item.id] || 0) : (loadQtys[item.id] || 0);
                          const used = Math.max(0, Math.round((onTruck - stillHaveUnits) * 100) / 100);
                          return (
                            <div key={item.id} style={{ display: "grid", gridTemplateColumns: "1fr 56px 90px 56px", gap: "4px 8px", alignItems: "center", marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid " + t.borderLight }}>
                              <div>
                                <div style={{ fontSize: item.isPieces ? 12 : 13, fontWeight: 600, color: item.isPieces ? t.textMuted : t.text }}>{label}</div>
                              </div>
                              <div style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: t.textMuted }}>
                                {isFoam(item.id) ? <>{bblToGals(onTruck, item.id)}<div style={{ fontSize: 9 }}>gal</div></> : onTruck}
                              </div>
                              <div>
                                {isFoam(item.id)
                                  ? <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                      <input type="number" min="0" step="1" placeholder="0"
                                        value={loadQtys[item.id + "_gal"] || ""}
                                        onChange={e => { const g = parseFloat(e.target.value)||0; const b = Math.min(onTruck, Math.round(g/(["cc_a","cc_b","env_cc_a","env_cc_b"].includes(item.id)?50:48)*100)/100); setLoadQtys(q => ({...q,[item.id+"_gal"]:e.target.value,[item.id]:b})); }}
                                        style={{ ...inputStyle, width: 64 }} />
                                      <span style={{ fontSize: 10, color: t.textMuted }}>gal</span>
                                    </div>
                                  : <input type="number" min="0" step="1" placeholder="0"
                                      value={loadQtys[item.id] || ""}
                                      onChange={e => setLoadQtys(q => ({...q,[item.id]:Math.max(0,parseInt(e.target.value)||0)}))}
                                      style={inputStyle} />
                                }
                              </div>
                              <div style={{ textAlign: "center" }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: used > 0 ? "#dc2626" : t.textMuted }}>
                                  {isFoam(item.id) ? bblToGals(used, item.id) : used}
                                </div>
                                {isFoam(item.id) && used > 0 && <div style={{ fontSize: 9, color: "#dc2626" }}>{used.toFixed(2)} bbl</div>}
                              </div>
                            </div>
                          );
                        }

                        // Load mode — single column: total on truck today
                        const unit = isFoam(item.id) ? "gal" : item.isPieces ? "pcs" : "tubes";
                        return (
                          <div key={item.id} style={{ display: "grid", gridTemplateColumns: "1fr 90px", gap: "4px 8px", alignItems: "center", marginBottom: 12 }}>
                            <div>
                              <div style={{ fontSize: item.isPieces ? 12 : 13, fontWeight: 600, color: item.isPieces ? t.textMuted : t.text }}>{label}</div>
                              {subLabel && <div style={{ fontSize: 10, color: t.textMuted }}>{subLabel}</div>}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                              {isFoam(item.id)
                                ? <input type="number" min="0" step="1" placeholder="0"
                                    value={loadQtys[item.id + "_gal"] || ""}
                                    onChange={e => { const g = parseFloat(e.target.value)||0; const b = Math.round(g/(["cc_a","cc_b","env_cc_a","env_cc_b"].includes(item.id)?50:48)*100)/100; setLoadQtys(q => ({...q,[item.id+"_gal"]:e.target.value,[item.id]:b})); }}
                                    style={{ ...inputStyle, width: 70 }} />
                                : <input type="number" min="0" step="1" placeholder="0"
                                    value={loadQtys[item.id] || ""}
                                    onChange={e => setLoadQtys(q => ({...q,[item.id]:Math.max(0,parseInt(e.target.value)||0)}))}
                                    style={{ ...inputStyle, width: 70 }} />
                              }
                              <span style={{ fontSize: 10, color: t.textMuted }}>{unit}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
                {mode === "load"
                  ? <button onClick={() => {
                      // Everything they entered = total leaving on truck today, all deducted from warehouse
                      const allItems = INVENTORY_ITEMS.filter(i => (loadQtys[i.id] || 0) > 0).map(i => ({ itemId: i.id, name: i.name, unit: i.unit, qty: loadQtys[i.id] }));
                      onLoadTruck(allItems, truck?.id);
                      setLoadTruckMode(false); setLoadQtys({}); setCarriedQtys({});
                    }} style={{ width: "100%", padding: "14px", borderRadius: 12, background: "#1e40af", border: "none", color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer", fontFamily: "inherit", marginTop: 12 }}>
                      Confirm Load Out
                    </button>
                  : <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, textAlign: "center", marginBottom: 2 }}>What are you doing with the remaining material?</div>
                      <button onClick={() => {
                        const returning = [
                          ...INVENTORY_ITEMS.filter(i => !i.isPieces && (truckInventory[i.id] || 0) > 0).map(i => ({ itemId: i.id, name: i.name, unit: i.unit, stillHave: loadQtys[i.id] || 0 })),
                          ...INVENTORY_ITEMS.filter(i => i.isPieces && (loadQtys[i.id] || 0) > 0).map(i => ({ itemId: i.id, name: i.name, unit: i.unit, stillHave: loadQtys[i.id] || 0 })),
                        ];
                        onReturnMaterial(returning, truck?.id, "unload");
                        setLoadTruckMode(false); setLoadQtys({});
                      }} style={{ width: "100%", padding: "14px", borderRadius: 12, background: "#15803d", border: "none", color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                        Unload to Warehouse
                        <div style={{ fontSize: 12, fontWeight: 400, marginTop: 3, opacity: 0.85 }}>Return remaining material — truck inventory zeroes out</div>
                      </button>
                      <button onClick={() => {
                        const keeping = [
                          ...INVENTORY_ITEMS.filter(i => !i.isPieces && (truckInventory[i.id] || 0) > 0).map(i => ({ itemId: i.id, name: i.name, unit: i.unit, stillHave: loadQtys[i.id] || 0 })),
                          ...INVENTORY_ITEMS.filter(i => i.isPieces).map(i => ({ itemId: i.id, name: i.name, unit: i.unit, stillHave: loadQtys[i.id] || 0 })),
                        ];
                        onReturnMaterial(keeping, truck?.id, "keep");
                        setLoadTruckMode(false); setLoadQtys({});
                      }} style={{ width: "100%", padding: "14px", borderRadius: 12, background: "#1e40af", border: "none", color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                        Keep on Truck
                        <div style={{ fontSize: 12, fontWeight: 400, marginTop: 3, opacity: 0.85 }}>Material stays on truck — load more tomorrow on top of this</div>
                      </button>
                    </div>
                }
                <button onClick={() => { setLoadTruckMode(false); setLoadQtys({}); }} style={{ width: "100%", padding: "12px", borderRadius: 12, background: "none", border: "1px solid " + t.border, color: t.textMuted, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit", marginTop: 8 }}>
                  Cancel
                </button>
              </div>
            );
          };
          return (
            <div style={{ padding: "0 16px 32px" }}>
              <SectionHeader title="Truck Inventory" />
              {/* Current truck load */}
              <Card style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: t.textMuted, marginBottom: loadedItems.length ? 10 : 0 }}>Currently Loaded</div>
                {loadedItems.length === 0
                  ? <div style={{ fontSize: 13, color: t.textMuted }}>Nothing loaded on truck.</div>
                  : <>
                    {ocSets > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid " + t.borderLight }}><span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Ambit Open Cell</span><span style={{ fontSize: 13, fontWeight: 800, color: t.accent }}>{ocSets.toFixed(2)} sets ({bblToGals(ocSets, "oc_a")*2} gal total)</span></div>}
                    {ccSets > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid " + t.borderLight }}><span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Ambit Closed Cell</span><span style={{ fontSize: 13, fontWeight: 800, color: t.accent }}>{ccSets.toFixed(2)} sets ({bblToGals(ccSets, "cc_a")*2} gal total)</span></div>}
                    {envOcSets > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid " + t.borderLight }}><span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Enverge Open Cell</span><span style={{ fontSize: 13, fontWeight: 800, color: t.accent }}>{envOcSets.toFixed(2)} sets ({bblToGals(envOcSets, "env_oc_a")*2} gal total)</span></div>}
                    {freeEnvOcSets > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid " + t.borderLight }}><span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>FREE Enverge Open Cell</span><span style={{ fontSize: 13, fontWeight: 800, color: "#16a34a" }}>{freeEnvOcSets.toFixed(2)} sets ({bblToGals(freeEnvOcSets, "free_env_oc_a")*2} gal total)</span></div>}
                    {envCcSets > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid " + t.borderLight }}><span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Enverge Closed Cell</span><span style={{ fontSize: 13, fontWeight: 800, color: t.accent }}>{envCcSets.toFixed(2)} sets ({bblToGals(envCcSets, "env_cc_a")*2} gal total)</span></div>}
                    {nonFoamLoaded.filter(i => !i.isPieces).map(item => {
                      const pi = item.hasPieces ? INVENTORY_ITEMS.find(x => x.parentId === item.id) : null;
                      const pq = pi ? (truckInventory[pi.id] || 0) : 0;
                      return (
                        <div key={item.id} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid " + t.borderLight }}>
                          <div>
                            <span style={{ fontSize: 13, color: t.text }}>{item.name}</span>
                            {pi && pq > 0 && <div style={{ fontSize: 11, color: t.textMuted, paddingLeft: 8 }}>↳ {pq} loose pcs</div>}
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: t.accent }}>{truckInventory[item.id]} {item.unit}</span>
                        </div>
                      );
                    })}
                    {/* Loose pieces with no full tubes remaining */}
                    {nonFoamLoaded.filter(i => i.isPieces && !(truckInventory[i.parentId] > 0)).map(item => (
                      <div key={item.id} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid " + t.borderLight }}>
                        <div>
                          <span style={{ fontSize: 13, color: t.text }}>{item.name}</span>
                          <div style={{ fontSize: 11, color: t.textMuted }}>loose pieces (partial tube)</div>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: t.accent }}>{truckInventory[item.id]} pcs</span>
                      </div>
                    ))}
                  </>
                }
              </Card>
              {/* Procedures */}
              <DailyProcedureCard />

              {!loadTruckMode ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <button onClick={() => {
                    setLoadTruckMode("load");
                    setLoadQtys({});
                  }} style={{ padding: "18px", borderRadius: 12, background: "#1e40af", border: "none", color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                    Load Out<div style={{ fontSize: 12, fontWeight: 400, marginTop: 4, opacity: 0.85 }}>Take material from warehouse</div>
                  </button>
                  <button onClick={() => setConfirmUnload(true)} style={{ padding: "18px", borderRadius: 12, background: "#15803d", border: "none", color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                    Unload to Warehouse<div style={{ fontSize: 12, fontWeight: 400, marginTop: 4, opacity: 0.85 }}>Returns everything on your truck back to warehouse</div>
                  </button>
                </div>
              ) : renderTruckForm(loadTruckMode)}
            </div>
          );
        })()}

        {crewView === "timesheet" && <CrewTimesheetTab crewMemberId={crewMemberId} crewName={crewName} jobs={jobs} updates={updates} weekOffset={tsWeekOffset} setWeekOffset={setTsWeekOffset} />}
        {crewView === "tickets" && (
          <>
            <SectionHeader title="My Tickets" right={<Button onClick={() => setShowTicketForm(true)}>+ Submit Ticket</Button>} />
            {myTickets.length === 0 ? <EmptyState text="No tickets submitted yet." sub="Tap '+ Submit Ticket' to report an issue, request supplies, or request time off." /> : myTickets.map((ticket) => {
              const prioObj = TICKET_PRIORITIES.find((p) => p.value === ticket.priority);
              const statObj = TICKET_STATUSES.find((s) => s.value === ticket.status);
              const typeLabel = ticket.ticketType === "inventory" ? "Inventory" : ticket.ticketType === "timeoff" ? "Time Off" : "Equipment";
              return (
                <Card key={ticket.id} style={{ border: ticket.status === "open" && !ticket.adminNote ? "3px solid #ef4444" : "1px solid #e5e7eb" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginBottom: "8px" }}>
                    <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "11px", fontWeight: 600, color: t.textSecondary }}>{typeLabel}</span>
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

      {/* ── UNLOAD CONFIRMATION ── */}
      {confirmUnload && (
        <Modal title="Unload to Warehouse" onClose={() => setConfirmUnload(false)}>
          <div style={{ fontSize: 15, color: t.text, marginBottom: 8 }}>Are you sure you want to return everything back to the warehouse inventory?</div>
          <div style={{ fontSize: 13, color: t.danger, fontWeight: 600, marginBottom: 20 }}>You can't undo this once you press Yes.</div>
          <div style={{ display: "flex", gap: 10 }}>
            <Button variant="secondary" onClick={() => setConfirmUnload(false)} style={{ flex: 1 }}>No</Button>
            <Button variant="danger" onClick={() => {
              const returning = INVENTORY_ITEMS.filter(i => (truckInventory[i.id] || 0) > 0).map(i => ({ itemId: i.id, name: i.name, unit: i.unit, stillHave: truckInventory[i.id] || 0 }));
              onReturnMaterial(returning, truck?.id, "unload");
              setConfirmUnload(false);
            }} style={{ flex: 1 }}>Yes, Unload</Button>
          </div>
        </Modal>
      )}

      {/* ── CLOSEOUT MATERIALS MODAL ── */}
      {dailyMaterialsJob && (() => {
        const isFoam = (id) => ["oc_a","oc_b","cc_a","cc_b","env_oc_a","env_oc_b","env_cc_a","env_cc_b","free_env_oc_a","free_env_oc_b"].includes(id);
        const today = dailyMaterialsJob._editingDate || todayCST();
        const isEditingPast = !!dailyMaterialsJob._editingDate;
        const existingDailyEntry = dailyMaterialsJob._existingMaterials || {};
        const isEditing = Object.keys(existingDailyEntry).length > 0;
        const fmtDateLabel = (ds) => { const [y,m,d] = ds.split("-"); return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(m)-1]+" "+parseInt(d)+", "+y; };
        const tubeItems = INVENTORY_ITEMS.filter(i => !i.isPieces && (
          (truckInventory[i.id] || 0) > 0 ||
          (i.hasPieces && (truckInventory[INVENTORY_ITEMS.find(p => p.parentId === i.id)?.id] || 0) > 0) ||
          existingDailyEntry[i.id] ||
          (i.hasPieces && existingDailyEntry[INVENTORY_ITEMS.find(p => p.parentId === i.id)?.id])
        ));
        return (
          <Modal title={isEditingPast ? "Edit Materials — " + fmtDateLabel(today) : "Log Today's Materials"} onClose={() => { setDailyMaterialsJob(null); setDailyMaterialQtys({}); }}>
            <div style={{ fontSize: 13.5, color: t.textMuted, marginBottom: 14 }}>
              <strong style={{ color: t.text }}>{dailyMaterialsJob.builder || "No Customer"}</strong><br />{dailyMaterialsJob.address}
              <div style={{ fontSize: 12, marginTop: 4, color: t.accent, fontWeight: 600 }}>{isEditingPast ? fmtDateLabel(today) : "Job stays open — just logging today's usage"}</div>
            </div>
            {tubeItems.length === 0 && <div style={{ fontSize: 13, color: t.textMuted, fontStyle: "italic", marginBottom: 14 }}>No materials loaded on truck.</div>}
            {tubeItems.map(item => {
              const onTruck = truckInventory[item.id] || 0;
              const pcsItem = item.hasPieces ? INVENTORY_ITEMS.find(x => x.parentId === item.id) : null;
              const loosePcsOnTruck = pcsItem ? (truckInventory[pcsItem.id] || 0) : 0;
              const looseOnly = onTruck === 0 && loosePcsOnTruck > 0;
              const existingQty = existingDailyEntry[item.id];
              const existingPcsQty = pcsItem ? existingDailyEntry[pcsItem.id] : null;
              const label = isFoam(item.id)
                ? item.name + (onTruck > 0 ? " (on truck: " + Math.round(onTruck * (["cc_a","cc_b","env_cc_a","env_cc_b"].includes(item.id) ? 50 : 48)) + " gal)" : "")
                : item.name + (
                    onTruck > 0 ? " (on truck: " + onTruck + " tubes" + (loosePcsOnTruck > 0 ? " + " + loosePcsOnTruck + " pcs)" : ")")
                    : loosePcsOnTruck > 0 ? " (on truck: " + loosePcsOnTruck + " pcs)"
                    : existingQty ? " (logged: " + existingQty + " tubes)"
                    : existingPcsQty ? " (logged: " + existingPcsQty + " pcs)"
                    : ""
                  );
              return (
                <div key={item.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center", padding: "10px 0", borderBottom: "1px solid " + t.borderLight }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{item.name}</div>
                    <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>
                      {onTruck > 0 && <span>On truck: {onTruck} tubes{loosePcsOnTruck > 0 ? " + " + loosePcsOnTruck + " pcs" : ""}</span>}
                      {onTruck === 0 && loosePcsOnTruck > 0 && <span>On truck: {loosePcsOnTruck} pcs</span>}
                      {existingQty > 0 && <span style={{ marginLeft: onTruck > 0 || loosePcsOnTruck > 0 ? 8 : 0, color: "#2563eb" }}>Logged: {existingQty} tubes</span>}
                      {existingPcsQty > 0 && <span style={{ marginLeft: 8, color: "#2563eb" }}>Logged: {existingPcsQty} pcs</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                    {!looseOnly && (
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <input type="number" min="0" placeholder="0" value={dailyMaterialQtys[item.id] || ""}
                          onChange={e => setDailyMaterialQtys(p => ({ ...p, [item.id]: e.target.value }))}
                          style={{ width: 64, padding: "8px 10px", borderRadius: 8, border: "1px solid " + t.border, fontSize: 15, fontFamily: "inherit", textAlign: "right", boxSizing: "border-box" }} />
                        <span style={{ fontSize: 11, color: t.textMuted, minWidth: 28 }}>tubes</span>
                      </div>
                    )}
                    {pcsItem && item.pcsPerTube && (
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <input type="number" min="0" placeholder="0" value={dailyMaterialQtys[pcsItem.id] || ""}
                          onChange={e => setDailyMaterialQtys(p => ({ ...p, [pcsItem.id]: e.target.value }))}
                          style={{ width: 64, padding: "8px 10px", borderRadius: 8, border: "1px solid " + t.border, fontSize: 15, fontFamily: "inherit", textAlign: "right", boxSizing: "border-box" }} />
                        <span style={{ fontSize: 11, color: t.textMuted, minWidth: 28 }}>pcs</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <Button variant="secondary" onClick={() => { setDailyMaterialsJob(null); setDailyMaterialQtys({}); }} style={{ flex: 1 }}>Cancel</Button>
              <Button onClick={() => {
                const used = {};
                INVENTORY_ITEMS.forEach(i => {
                  const raw = dailyMaterialQtys[i.id];
                  if (raw && parseFloat(raw) > 0) {
                    used[i.id] = isFoam(i.id) ? Math.round(parseFloat(raw) / (["cc_a","cc_b","env_cc_a","env_cc_b"].includes(i.id) ? 50 : 48) * 100) / 100 : parseFloat(raw);
                  }
                });
                if (Object.keys(used).length > 0) {
                  // Validate: can't log more than what's on the truck (accounting for already-logged)
                  let valid = true;
                  INVENTORY_ITEMS.filter(i => !i.isPieces).forEach(item => {
                    const pcsItem = INVENTORY_ITEMS.find(p => p.parentId === item.id);
                    const newUsedPcs = item.pcsPerTube
                      ? (used[item.id] || 0) * item.pcsPerTube + (pcsItem ? (used[pcsItem.id] || 0) : 0)
                      : (used[item.id] || 0);
                    const oldUsedPcs = item.pcsPerTube
                      ? (existingDailyEntry[item.id] || 0) * item.pcsPerTube + (pcsItem ? (existingDailyEntry[pcsItem.id] || 0) : 0)
                      : (existingDailyEntry[item.id] || 0);
                    const delta = newUsedPcs - oldUsedPcs;
                    if (delta > 0) {
                      const onTruckPcs = item.pcsPerTube
                        ? (truckInventory[item.id] || 0) * item.pcsPerTube + (pcsItem ? (truckInventory[pcsItem.id] || 0) : 0)
                        : (truckInventory[item.id] || 0);
                      if (delta > onTruckPcs) {
                        alert("Not enough " + item.name + " on your truck.\nYou have " + onTruckPcs + " pcs available.");
                        valid = false;
                      }
                    }
                  });
                  if (!valid) return;
                  // Delta adjust if editing existing entry, full deduct if new
                  if (isEditing) {
                    onDeltaAdjustTruck(truck?.id, existingDailyEntry, used);
                  } else {
                    onDeductFromTruck(truck?.id, used);
                  }
                  // Save as a daily log entry (upsert by date)
                  onLogDailyMaterials(dailyMaterialsJob.id, { date: today, materials: used, loggedBy: crewName, timestamp: new Date().toISOString() }, true);
                }
                setDailyMaterialsJob(null); setDailyMaterialQtys({});
              }} style={{ flex: 1 }}>Save</Button>
            </div>
          </Modal>
        );
      })()}

      {closeoutJob && (() => {
        const isFoam = (id) => ["oc_a","oc_b","cc_a","cc_b","env_oc_a","env_oc_b","env_cc_a","env_cc_b","free_env_oc_a","free_env_oc_b"].includes(id);
        const truckItems = INVENTORY_ITEMS.filter(i => !i.isPieces && (truckInventory[i.id] || 0) > 0);
        return (
          <Modal title="Close Out Job" onClose={() => setCloseoutJob(null)}>
            <div style={{ fontSize: 13.5, color: t.textMuted, marginBottom: 14 }}>
              <strong style={{ color: t.text }}>{closeoutJob.job.builder || "No Customer"}</strong><br />{closeoutJob.job.address}
            </div>
            {/* Daily material log review */}
            {(() => {
              const logs = closeoutJob.job.dailyMaterialLogs || [];
              if (logs.length === 0) return null;
              const fmtDate = (ds) => { const [y,m,d] = ds.split("-"); const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; return months[parseInt(m)-1] + " " + parseInt(d); };
              const isFoam = (id) => ["oc_a","oc_b","cc_a","cc_b","env_oc_a","env_oc_b","env_cc_a","env_cc_b","free_env_oc_a","free_env_oc_b"].includes(id);
              return (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", color: t.textMuted, fontWeight: 600, marginBottom: 8 }}>Materials Logged — Previous Days</div>
                  {logs.sort((a,b) => a.date.localeCompare(b.date)).map((log, idx) => (
                    <div key={idx} style={{ background: t.bg, border: "1px solid " + t.border, borderRadius: 8, padding: "10px 12px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 4 }}>{fmtDate(log.date)}</div>
                        <div style={{ fontSize: 12, color: t.textSecondary }}>
                          {Object.entries(log.materials).map(([itemId, qty]) => {
                            const item = INVENTORY_ITEMS.find(i => i.id === itemId);
                            if (!item) return null;
                            const display = isFoam(itemId) ? Math.round(qty * (["cc_a","cc_b","env_cc_a","env_cc_b"].includes(itemId) ? 50 : 48)) + " gal" : qty + " " + item.unit;
                            return <span key={itemId} style={{ marginRight: 10 }}>{item.name}: <strong>{display}</strong></span>;
                          })}
                        </div>
                      </div>
                      <button onClick={() => {
                        const preQtys = {};
                        INVENTORY_ITEMS.forEach(i => {
                          const isFoamItem = ["oc_a","oc_b","cc_a","cc_b","env_oc_a","env_oc_b","env_cc_a","env_cc_b","free_env_oc_a","free_env_oc_b"].includes(i.id);
                          const val = log.materials[i.id];
                          if (val) preQtys[i.id] = isFoamItem ? String(Math.round(val * (["cc_a","cc_b","env_cc_a","env_cc_b"].includes(i.id) ? 50 : 48))) : String(val);
                        });
                        setDailyMaterialsJob({ ...closeoutJob.job, _editingDate: log.date });
                        setDailyMaterialQtys(preQtys);
                      }} style={{ fontSize: 12, fontWeight: 600, color: t.accent, background: t.accentBg, border: "1px solid " + t.accent, borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>Edit</button>
                    </div>
                  ))}
                  <div style={{ borderTop: "1px solid " + t.border, marginTop: 12, paddingTop: 12 }}>
                    <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", color: t.textMuted, fontWeight: 600, marginBottom: 10 }}>Today's Materials</div>
                  </div>
                </div>
              );
            })()}
            {!closeoutJob.skipMaterials && (
              <>
                <div style={{ fontSize: 13, color: t.textSecondary, marginBottom: 16, background: t.bg, padding: "10px 12px", borderRadius: 6, borderLeft: "3px solid " + t.accent }}>
                  Enter what you used today. Leave blank for items you did not use.
                </div>
                {truckItems.length === 0 && <div style={{ fontSize: 13, color: t.textMuted, fontStyle: "italic", marginBottom: 16 }}>No materials loaded on truck.</div>}
                {truckItems.map(item => {
                  const onTruck = truckInventory[item.id] || 0;
                  const label = isFoam(item.id)
                    ? item.name + " (on truck: " + Math.round(onTruck * (["cc_a","cc_b","env_cc_a","env_cc_b"].includes(item.id) ? 50 : 48)) + " gal)"
                    : item.name + " (on truck: " + onTruck + " " + item.unit + ")";
                  const placeholder = isFoam(item.id) ? "gallons used" : item.unit + " used";
                  const pcsItem = item.hasPieces ? INVENTORY_ITEMS.find(x => x.parentId === item.id) : null;
                  return (
                    <div key={item.id} style={{ marginBottom: 14 }}>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: t.textSecondary, marginBottom: 4 }}>{label}</label>
                      <input type="number" min="0" placeholder={placeholder} value={closeoutMaterialQtys[item.id] || ""}
                        onChange={e => setCloseoutMaterialQtys(p => ({ ...p, [item.id]: e.target.value }))}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid " + t.border, fontSize: 15, fontFamily: "inherit", boxSizing: "border-box" }} />
                      {pcsItem && item.pcsPerTube && (
                        <div style={{ marginTop: 6, paddingLeft: 14, borderLeft: "2px dashed " + t.border }}>
                          <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: t.textMuted, marginBottom: 3 }}>
                            Loose pieces used <span style={{ fontWeight: 400 }}>(from open tube — {item.pcsPerTube} pcs/tube)</span>
                          </label>
                          <input type="number" min="0" placeholder="loose pieces from open tube" value={closeoutMaterialQtys[pcsItem.id] || ""}
                            onChange={e => setCloseoutMaterialQtys(p => ({ ...p, [pcsItem.id]: e.target.value }))}
                            style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid " + t.border, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
            {closeoutJob.skipMaterials && (
              <div style={{ fontSize: 13, color: "#15803d", background: "#dcfce7", border: "1px solid #86efac", borderRadius: 6, padding: "10px 12px", marginBottom: 16 }}>
                ✓ Materials already logged for today — ready to close out.
              </div>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <Button variant="secondary" onClick={() => setCloseoutJob(null)} style={{ flex: 1 }}>Cancel</Button>
              <Button onClick={() => handleCloseoutConfirm(closeoutJob.skipMaterials)} style={{ flex: 1 }}>Confirm Closeout</Button>
            </div>
          </Modal>
        );
      })()}

      {/* ── EDIT MATERIALS MODAL ── */}
      {editMaterialsJob && (() => {
        const isFoam = (id) => ["oc_a","oc_b","cc_a","cc_b","env_oc_a","env_oc_b","env_cc_a","env_cc_b","free_env_oc_a","free_env_oc_b"].includes(id);
        // Aggregate all installed: daily logs + materialsUsed
        const existing = (() => {
          const totals = { ...(editMaterialsJob.materialsUsed || {}) };
          (editMaterialsJob.dailyMaterialLogs || []).forEach(log => {
            Object.entries(log.materials || {}).forEach(([id, qty]) => {
              totals[id] = (totals[id] || 0) + qty;
            });
          });
          return totals;
        })();
        // Show items already installed OR on truck
        const tubeItems = INVENTORY_ITEMS.filter(i => !i.isPieces && (existing[i.id] || (truckInventory[i.id] || 0) > 0 || (i.hasPieces && (truckInventory[INVENTORY_ITEMS.find(p => p.parentId === i.id)?.id] || 0) > 0)));
        const getVal = (item) => { const e = existing[item.id]; const r = editMaterialQtys[item.id]; if (r !== undefined) return r; if (e) return isFoam(item.id) ? String(Math.round(e * (["cc_a","cc_b","env_cc_a","env_cc_b"].includes(item.id) ? 50 : 48))) : String(e); return ""; };
        return (
          <Modal title="Edit Materials" onClose={() => setEditMaterialsJob(null)}>
            <div style={{ fontSize: 13.5, color: t.textMuted, marginBottom: 14 }}>
              <strong style={{ color: t.text }}>{editMaterialsJob.builder || "No Customer"}</strong><br />{editMaterialsJob.address}
            </div>
            {tubeItems.map(item => {
              const onTruck = truckInventory[item.id] || 0;
              const label = isFoam(item.id)
                ? item.name + (onTruck > 0 ? " (on truck: " + Math.round(onTruck * (["cc_a","cc_b","env_cc_a","env_cc_b"].includes(item.id) ? 50 : 48)) + " gal)" : "")
                : item.name + (onTruck > 0 ? " (on truck: " + onTruck + " " + item.unit + ")" : "");
              const pcsItem = item.hasPieces ? INVENTORY_ITEMS.find(x => x.parentId === item.id) : null;
              const showPcs = pcsItem && ((truckInventory[pcsItem.id] || 0) > 0 || existing[pcsItem.id]);
              return (
                <div key={item.id} style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: t.textSecondary, marginBottom: 4 }}>{label}</label>
                  <input type="number" min="0" placeholder={isFoam(item.id) ? "gallons used" : item.hasPieces ? "full tubes used" : item.unit + " used"} value={getVal(item)}
                    onChange={e => setEditMaterialQtys(p => ({ ...p, [item.id]: e.target.value }))}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid " + t.border, fontSize: 15, fontFamily: "inherit", boxSizing: "border-box" }} />
                  {(pcsItem && (showPcs || true)) && (
                    <div style={{ marginTop: 6, paddingLeft: 14, borderLeft: "2px dashed " + t.border }}>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: t.textMuted, marginBottom: 4 }}>Pieces used</label>
                      <input type="number" min="0" placeholder="pieces used" value={getVal(pcsItem)}
                        onChange={e => setEditMaterialQtys(p => ({ ...p, [pcsItem.id]: e.target.value }))}
                        style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid " + t.border, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }} />
                    </div>
                  )}
                </div>
              );
            })}
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <Button variant="secondary" onClick={() => setEditMaterialsJob(null)} style={{ flex: 1 }}>Cancel</Button>
              <Button onClick={() => {
                const used = {};
                INVENTORY_ITEMS.forEach(i => {
                  const raw = editMaterialQtys[i.id] !== undefined ? editMaterialQtys[i.id] : (existing[i.id] ? (isFoam(i.id) ? String(Math.round(existing[i.id] * (["cc_a","cc_b","env_cc_a","env_cc_b"].includes(i.id) ? 50 : 48))) : String(existing[i.id])) : "");
                  if (raw && parseFloat(raw) > 0) {
                    used[i.id] = isFoam(i.id) ? Math.round(parseFloat(raw) / (["cc_a","cc_b","env_cc_a","env_cc_b"].includes(i.id) ? 50 : 48) * 100) / 100 : parseFloat(raw);
                  }
                });
                // Validate: can only ADD if truck has enough
                let canSave = true;
                INVENTORY_ITEMS.filter(i => !i.isPieces && i.pcsPerTube).forEach(item => {
                  const pcsItem = INVENTORY_ITEMS.find(p => p.parentId === item.id);
                  const oldPcs = (existing[item.id] || 0) * item.pcsPerTube + (pcsItem ? (existing[pcsItem.id] || 0) : 0);
                  const newPcs = (used[item.id] || 0) * item.pcsPerTube + (pcsItem ? (used[pcsItem.id] || 0) : 0);
                  const delta = newPcs - oldPcs;
                  if (delta > 0) {
                    const onTruckPcs = (truckInventory[item.id] || 0) * item.pcsPerTube + (pcsItem ? (truckInventory[pcsItem.id] || 0) : 0);
                    if (delta > onTruckPcs) { alert("Not enough " + item.name + " on your truck to add that many."); canSave = false; }
                  }
                });
                if (!canSave) return;
                // Delta adjust truck: only apply difference between old and new
                onDeltaAdjustTruck(truck?.id, existing, used);
                onSaveJobMaterials(editMaterialsJob.id, Object.keys(used).length > 0 ? used : null);
                setEditMaterialsJob(null); setEditMaterialQtys({});
              }} style={{ flex: 1 }}>Save</Button>
            </div>
          </Modal>
        );
      })()}

      {showTicketForm && (
        <Modal title="Submit Ticket" onClose={() => setShowTicketForm(false)}>
          <div style={{ fontSize: "13px", color: t.textMuted, marginBottom: "16px", background: t.bg, padding: "10px 12px", borderRadius: "6px" }}>Submitting for <strong style={{ color: t.text }}>{truck.name}</strong></div>
          <div style={{ marginBottom: "14px" }}>
            <div style={{ fontSize: "13px", fontWeight: 600, color: t.text, marginBottom: "8px" }}>Ticket Type</div>
            <div style={{ display: "flex", gap: "8px" }}>
              {[{ value: "equipment", label: "Equipment" }, { value: "inventory", label: "Inventory" }, { value: "timeoff", label: "Time Off" }].map((opt) => (
                <button key={opt.value} onClick={() => setTicketType(opt.value)} style={{ flex: 1, padding: "10px 6px", border: ticketType === opt.value ? "2px solid " + t.accent : "1px solid " + t.border, borderRadius: "8px", background: ticketType === opt.value ? t.accentBg : t.surface, color: ticketType === opt.value ? t.accent : t.textSecondary, fontWeight: 600, fontSize: "12px", cursor: "pointer", fontFamily: "inherit" }}>{opt.label}</button>
              ))}
            </div>
          </div>
          {ticketType === "timeoff" ? (
            <>
              {/* Mini inline calendar */}
              <div style={{ marginBottom: "14px" }}>
                <div style={{ fontSize: "13px", fontWeight: 600, color: t.text, marginBottom: "8px" }}>Select Dates</div>
                <div style={{ background: t.bg, borderRadius: "10px", padding: "12px", border: "1px solid " + t.border }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    <button onClick={() => { if (toCalMonth === 0) { setToCalMonth(11); setToCalYear(y => y - 1); } else setToCalMonth(m => m - 1); }} style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted, fontSize: "18px", padding: "0 6px" }}>‹</button>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: t.text }}>{toMonthNames[toCalMonth]} {toCalYear}</span>
                    <button onClick={() => { if (toCalMonth === 11) { setToCalMonth(0); setToCalYear(y => y + 1); } else setToCalMonth(m => m + 1); }} style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted, fontSize: "18px", padding: "0 6px" }}>›</button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px", textAlign: "center" }}>
                    {["S","M","T","W","T","F","S"].map((d, i) => <div key={i} style={{ fontSize: "10px", fontWeight: 700, color: t.textMuted, padding: "3px 0" }}>{d}</div>)}
                    {toCalDays().map((day, i) => {
                      const inRange = isInToRange(day);
                      const isEdge = isToStartOrEnd(day);
                      return (
                        <div key={i} onClick={() => handleToDay(day)} style={{ padding: "6px 2px", borderRadius: "6px", fontSize: "12px", fontWeight: isEdge ? 700 : 400, background: isEdge ? "#2563eb" : inRange ? "#dbeafe" : "transparent", color: isEdge ? "#fff" : inRange ? "#1d4ed8" : day ? t.text : "transparent", cursor: day ? "pointer" : "default", userSelect: "none" }}>{day || ""}</div>
                      );
                    })}
                  </div>
                </div>
                {(toStart) && (
                  <div style={{ marginTop: "8px", fontSize: "13px", color: t.accent, fontWeight: 600, textAlign: "center" }}>
                    {toEnd && toEnd !== toStart ? formatToDate(toStart) + " – " + formatToDate(toEnd) : formatToDate(toStart) + " (tap another date to set end)"}
                  </div>
                )}
              </div>
              <TextArea label="Reason (optional)" placeholder="e.g. family event, vacation, appointment..." value={ticketDesc} onChange={(e) => setTicketDesc(e.target.value)} style={{ minHeight: "70px" }} />
              <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
                <Button variant="secondary" onClick={() => setShowTicketForm(false)} style={{ flex: 1 }}>Cancel</Button>
                <Button onClick={handleTicketSubmit} disabled={!toStart} style={{ flex: 1 }}>Submit</Button>
              </div>
            </>
          ) : (
            <>
              <TextArea label={ticketType === "equipment" ? "Describe the problem" : "What supplies do you need?"} placeholder={ticketType === "equipment" ? "e.g. spray gun leaking at the tip, generator won't start..." : "e.g. need more 2-part foam, running low on tarps..."} value={ticketDesc} onChange={(e) => setTicketDesc(e.target.value)} style={{ minHeight: "100px" }} />
              <Select label="Priority" value={ticketPriority} onChange={(e) => setTicketPriority(e.target.value)} options={TICKET_PRIORITIES.map((p) => ({ value: p.value, label: p.label }))} />
              <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
                <Button variant="secondary" onClick={() => setShowTicketForm(false)} style={{ flex: 1 }}>Cancel</Button>
                <Button onClick={handleTicketSubmit} disabled={!ticketDesc.trim()} style={{ flex: 1 }}>Submit</Button>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

// ─── Admin Dashboard ───
// ─── Roster View ─────────────────────────────────────────────────────────────
function TimesheetModal({ member, jobs, updates, weekOffset, setWeekOffset, onClose }) {
  const getWeekRange = (offsetWeeks = 0) => {
    const now = new Date(); const day = now.getDay(); const mon = new Date(now);
    mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offsetWeeks * 7); mon.setHours(0,0,0,0);
    const sat = new Date(mon); sat.setDate(mon.getDate() + 5); sat.setHours(23,59,59,999);
    return { mon, sat };
  };
  const { mon, sat } = getWeekRange(weekOffset);
  const fmtDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const fmtDay = (d) => d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const localDateStr = (d) => d.toLocaleDateString('en-CA');
  const DAYS = Array.from({ length: 6 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d; });
  const weekKey = localDateStr(mon);
  const tsDocId = `${member.id}_${weekKey}`;

  // Persisted job entries: { "2026-03-17": ["jobId1","jobId2"], ... }
  const [jobEntries, setJobEntries] = useState({});
  const [loading, setLoading] = useState(true);
  const [addingDay, setAddingDay] = useState(null); // dayStr when picker is open
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(doc(db, "timesheets", tsDocId), snap => {
      if (snap.exists() && snap.data().jobEntries) {
        setJobEntries(snap.data().jobEntries);
        setLoading(false);
      } else {
        // Seed from dynamic job assignments so existing work isn't lost
        const seeded = {};
        const dayMap = buildDayJobMap(jobs || [], updates || [], member.id, member.name, mon, sat);
        DAYS.forEach(d => {
          const ds = localDateStr(d);
          const seededJobs = dayMap[ds] || [];
          if (seededJobs.length > 0) seeded[ds] = seededJobs.map(j => j.id);
        });
        setJobEntries(seeded);
        setLoading(false);
      }
    });
    return unsub;
  }, [tsDocId]);

  const saveEntries = async (next) => {
    setSaving(true);
    await setDoc(doc(db, "timesheets", tsDocId), { jobEntries: next, memberId: member.id, memberName: member.name, weekStart: weekKey }, { merge: true });
    setSaving(false);
  };

  const addJob = async (dayStr, jobId) => {
    const cur = jobEntries[dayStr] || [];
    if (cur.includes(jobId)) { setAddingDay(null); return; }
    const next = { ...jobEntries, [dayStr]: [...cur, jobId] };
    setJobEntries(next);
    await saveEntries(next);
    setAddingDay(null);
  };

  const removeJob = async (dayStr, jobId) => {
    const next = { ...jobEntries, [dayStr]: (jobEntries[dayStr] || []).filter(id => id !== jobId) };
    setJobEntries(next);
    await saveEntries(next);
  };

  // Jobs available to add: last 14 days
  const twoWeeksAgo = new Date(); twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 7);
  const recentJobs = (jobs || []).filter(j => {
    const d = new Date((j.date || "") + "T12:00:00");
    return d >= twoWeeksAgo;
  });

  // Category colors
  const catColor = { Foam: "#f59e0b", Fiberglass: "#3b82f6", Removal: "#ef4444" };
  const catBg   = { Foam: "#fef3c7", Fiberglass: "#dbeafe", Removal: "#fee2e2" };

  const handlePrint = () => {
    const dayJobMap = {};
    DAYS.forEach(d => {
      const ds = localDateStr(d);
      dayJobMap[ds] = (jobEntries[ds] || []).map(id => (jobs||[]).find(j=>j.id===id)).filter(Boolean);
    });
    const html = buildTimesheetHtml(member.name, mon, sat, DAYS, dayJobMap, null, fmtDate, fmtDay);
    const w = window.open('', '_blank'); w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
  };

  return (
    <Modal title={`Timesheet — ${member.name}`} onClose={onClose}>
      <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 12 }}>{fmtDate(mon)} – {fmtDate(sat)}</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <Button variant='secondary' onClick={() => { setWeekOffset(w => w - 1); setAddingDay(null); }} style={{ fontSize: 12 }}>← Prev</Button>
        {weekOffset !== 0 && <Button variant='secondary' onClick={() => { setWeekOffset(0); setAddingDay(null); }} style={{ fontSize: 12 }}>This Week</Button>}
        {weekOffset < 0 && <Button variant='secondary' onClick={() => { setWeekOffset(w => w + 1); setAddingDay(null); }} style={{ fontSize: 12 }}>Next →</Button>}
        <Button onClick={handlePrint} variant='secondary' style={{ fontSize: 12, marginLeft: 'auto' }}>Print</Button>
      </div>

      {loading ? <div style={{ fontSize: 13, color: t.textMuted }}>Loading…</div> : DAYS.map(day => {
        const dayStr = localDateStr(day);
        const dayJobIds = jobEntries[dayStr] || [];
        const dayJobs = dayJobIds.map(id => (jobs||[]).find(j=>j.id===id)).filter(Boolean);
        // Group by type
        const grouped = { Foam: [], Fiberglass: [], Removal: [], Other: [] };
        dayJobs.forEach(j => { const cat = JOB_TYPES.includes(j.type) ? j.type : 'Other'; grouped[cat].push(j); });
        const isAdding = addingDay === dayStr;
        const alreadyIds = dayJobIds;
        const available = recentJobs.filter(j => !alreadyIds.includes(j.id));
        return (
          <div key={dayStr} style={{ marginBottom: 10, padding: '10px 12px', background: t.bg, borderRadius: 8, border: '1px solid ' + t.borderLight }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: dayJobs.length > 0 ? 8 : 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: t.text }}>{fmtDay(day)}</div>
              <button onClick={() => setAddingDay(isAdding ? null : dayStr)} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid '+t.accent, background: isAdding ? t.accent : 'transparent', color: isAdding ? '#fff' : t.accent, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                {isAdding ? '✕ Cancel' : '+ Add Job'}
              </button>
            </div>

            {isAdding && (
              <div style={{ marginBottom: 8, border: '1px solid '+t.border, borderRadius: 8, background: t.card, overflow: 'hidden' }}>
                {available.length === 0
                  ? <div style={{ fontSize: 12, color: t.textMuted, padding: '10px 12px' }}>No recent jobs to add</div>
                  : ['Foam','Fiberglass','Removal'].map(cat => {
                      const catJobs = available.filter(j => j.type === cat);
                      if (catJobs.length === 0) return null;
                      return (
                        <details key={cat} open style={{ borderBottom: '1px solid '+t.borderLight }}>
                          <summary style={{ padding: '8px 12px', fontWeight: 700, fontSize: 12, color: catColor[cat], background: catBg[cat], cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 10 }}>▾</span>{cat} ({catJobs.length})
                          </summary>
                          {catJobs.map(j => (
                            <button key={j.id} onClick={() => addJob(dayStr, j.id)}
                              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px 8px 20px', background: 'none', border: 'none', borderTop: '1px solid '+t.borderLight, cursor: 'pointer', fontFamily: 'inherit' }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>{j.builder || 'No Customer'}</div>
                              <div style={{ fontSize: 11, color: t.textMuted }}>{j.address}</div>
                            </button>
                          ))}
                        </details>
                      );
                    })
                }
              </div>
            )}

            {dayJobs.length === 0 && !isAdding && <div style={{ fontSize: 12, color: t.textMuted }}>No jobs</div>}
            {['Foam','Fiberglass','Removal','Other'].filter(cat => grouped[cat].length > 0).map(cat => (
              <div key={cat} style={{ marginBottom: 4 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: catColor[cat]||t.textMuted, marginBottom: 3 }}>{cat}</div>
                {grouped[cat].map(j => (
                  <div key={j.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4, paddingBottom: 4, borderTop: '1px solid '+t.borderLight }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: t.text }}>{j.builder || 'No Customer'}</div>
                      <div style={{ color: t.textMuted, fontSize: 12 }}>{j.address}</div>
                    </div>
                    <button onClick={() => removeJob(dayStr, j.id)} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, marginLeft: 8 }}>✕</button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        );
      })}

      {saving && <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>Saving…</div>}
    </Modal>
  );
}
function RosterView({ trucks, jobs, updates }) {
  const [members, setMembers] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [assigning, setAssigning] = useState(null);
  const [timesheetMember, setTimesheetMember] = useState(null);
  const [tsWeekOffset, setTsWeekOffset] = useState(0);

  const printAllTimesheets = async () => {
    const now = new Date();
    const day = now.getDay();
    const mon = new Date(now);
    mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    mon.setHours(0,0,0,0);
    const sat = new Date(mon); sat.setDate(mon.getDate() + 5); sat.setHours(23,59,59,999);
    const fmtDate = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const fmtDay = (d) => d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
    const localDateStr = (d) => d.toLocaleDateString("en-CA");
    const weekKey = localDateStr(mon);
    const DAYS = Array.from({ length: 6 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d; });
    const getJobWorkDate = (j) => {
      const ju = (updates || []).filter(u => u.jobId === j.id).sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
      return started ? tsToCST(started.timestamp) : j.date;
    };
    const allStartedJobs = (jobs || []).filter(j =>
      (updates || []).some(u => u.jobId === j.id && ["in_progress","on_site","started"].includes(u.status))
    );
    const pages = await Promise.all(members.map(async member => {
      const tsDocId = `${member.id}_${weekKey}`;
      const snap = await getDoc(doc(db, "timesheets", tsDocId));
      const dayNotes = snap.exists() ? (snap.data().dayNotes || {}) : {};
      const memberDayMap = buildDayJobMap(allStartedJobs, updates, member.id, member.name, mon, sat);
      return buildTimesheetHtml(member.name, mon, sat, DAYS, memberDayMap, null, fmtDate, fmtDay, dayNotes);
    }));
    const combined = `<!DOCTYPE html><html><head><title>All Timesheets</title><style>@page{size:letter;margin:0.5in}.page-break{page-break-after:always}</style></head><body>${pages.map((p,i) => `<div${i < pages.length - 1 ? ' class="page-break"' : ''}>${p.replace(/<!DOCTYPE html>.*?<body>/s,'').replace(/<\/body><\/html>/,'')}</div>`).join('')}</body></html>`;
    const w = window.open("", "_blank"); w.document.write(combined); w.document.close(); w.focus(); setTimeout(() => w.print(), 400);
  };

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "crewMembers"), snap => {
      setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  const addMember = async () => {
    if (!newName.trim()) return;
    await addDoc(collection(db, "crewMembers"), { name: newName.trim(), truckId: null, email: null, createdAt: new Date().toISOString() });
    setNewName(""); setShowAdd(false);
  };

  const assignTruck = async (memberId, truckId) => {
    await updateDoc(doc(db, "crewMembers", memberId), { truckId: truckId || null });
    setAssigning(null);
  };

  const removeMember = async (id) => {
    if (!window.confirm("Remove this crew member?")) return;
    await deleteDoc(doc(db, "crewMembers", id));
  };

  const getTruckName = (truckId) => { const tr = trucks.find(tr => tr.id === truckId); return tr ? (tr.members || tr.name) : "Unassigned"; };

  return (
    <div>
      <SectionHeader title="Roster" right={<div style={{ display: "flex", gap: 8 }}><Button variant="secondary" onClick={printAllTimesheets} style={{ fontSize: 12 }}>Print All Timesheets</Button><Button onClick={() => setShowAdd(true)}>+ Add Member</Button></div>} />

      {showAdd && (
        <Card style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 8 }}>New Crew Member</div>
          <Input label="Name" placeholder="Full name" value={newName} onChange={e => setNewName(e.target.value)} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <Button onClick={addMember} disabled={!newName.trim()}>Add</Button>
            <Button variant="secondary" onClick={() => { setShowAdd(false); setNewName(""); }}>Cancel</Button>
          </div>
        </Card>
      )}

      {members.length === 0 ? (
        <EmptyState text="No crew members yet." sub="Add your first crew member above." />
      ) : (() => {
        // Group by truck
        const sortedTrucks = [...trucks].sort((a,b) => (a.order ?? 999) - (b.order ?? 999));
        const unassigned = members.filter(m => !m.truckId);
        const groups = [
          ...sortedTrucks.map(tr => ({ truck: tr, members: members.filter(m => m.truckId === tr.id).sort((a,b) => a.name.localeCompare(b.name)) })).filter(g => g.members.length > 0),
          ...(unassigned.length > 0 ? [{ truck: null, members: unassigned.sort((a,b) => a.name.localeCompare(b.name)) }] : []),
        ];

        return groups.map(({ truck, members: groupMembers }) => (
          <div key={truck?.id || "unassigned"} style={{ marginBottom: 20 }}>
            {/* Truck header */}
            <div style={{ fontSize: 12, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid " + t.borderLight }}>
              {truck ? (truck.members || truck.name) : "Unassigned"}
            </div>
            {groupMembers.map(member => (
              <Card key={member.id} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: t.accent, cursor: "pointer", textDecoration: "underline" }} onClick={() => { setTimesheetMember(member); setTsWeekOffset(0); }}>{member.name}</div>
                    <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
                      {member.email ? member.email : "No email yet"}
                    </div>
                    {member.pin ? (
                      <div style={{ fontSize: 11, color: t.green, marginTop: 2 }}>✓ PIN set</div>
                    ) : (
                      <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>No PIN yet</div>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {assigning === member.id ? (
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        <select onChange={e => assignTruck(member.id, e.target.value)} defaultValue={member.truckId || ""} style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid " + t.border, fontFamily: "inherit" }}>
                          <option value="">Unassigned</option>
                          {trucks.map(tr => <option key={tr.id} value={tr.id}>{tr.members || tr.name}</option>)}
                        </select>
                        <button onClick={() => setAssigning(null)} style={{ fontSize: 11, color: t.textMuted, background: "none", border: "none", cursor: "pointer" }}>Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setAssigning(member.id)} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, border: "1px solid " + t.border, background: member.truckId ? t.accentBg : t.bg, color: member.truckId ? t.accent : t.textMuted, cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>
                        {getTruckName(member.truckId)}
                      </button>
                    )}

                  </div>
                </div>
              </Card>
            ))}
          </div>
        ));
      })()}

      {timesheetMember && <TimesheetModal member={timesheetMember} jobs={jobs} updates={updates} weekOffset={tsWeekOffset} setWeekOffset={setTsWeekOffset} onClose={() => setTimesheetMember(null)} />}

    </div>
  );
}

function InventoryEditCell({ itemId, qty, isFoam, bblToGals, galsToBbl, pcsItem, pcsQty, onUpdateInventory }) {
  const [editing, setEditing] = useState(false);
  const [bbls, setBbls] = useState("");
  const [gals, setGals] = useState("");
  const [pcsVal, setPcsVal] = useState("");

  const galPerBbl = ["cc_a","cc_b","env_cc_a","env_cc_b"].includes(itemId) ? 50 : 48;

  const open = () => {
    setBbls(isFoam ? String(Math.round(qty)) : "");
    setGals(isFoam ? String(bblToGals(qty, itemId)) : "");
    setPcsVal(pcsItem ? String(pcsQty) : "");
    setEditing(true);
  };

  const save = () => {
    if (isFoam) {
      // Use whichever was last edited — gals takes priority if both filled
      const g = parseFloat(gals);
      const b = parseFloat(bbls);
      let newBbl;
      if (!isNaN(g) && g >= 0) newBbl = Math.round((g / galPerBbl) * 100) / 100;
      else if (!isNaN(b) && b >= 0) newBbl = Math.round(b * 100) / 100;
      if (newBbl !== undefined) onUpdateInventory(itemId, Math.max(0, newBbl));
    } else {
      const parsed = parseFloat(gals || bbls);
      if (!isNaN(parsed) && parsed >= 0) onUpdateInventory(itemId, Math.max(0, parsed));
    }
    if (pcsItem && pcsVal !== "") {
      const p = parseFloat(pcsVal);
      if (!isNaN(p) && p >= 0) onUpdateInventory(pcsItem.id, Math.max(0, Math.round(p)));
    }
    setEditing(false);
  };

  if (!editing) {
    return (
      <button onClick={open} style={{ fontSize: 11, fontWeight: 600, color: t.accent, background: t.accentBg, border: "1px solid " + t.accent, borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
        Edit
      </button>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 160 }}>
      {isFoam ? (
        <>
          <div>
            <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 3, fontWeight: 600 }}>BARRELS (bbls)</div>
            <input type="number" min="0" autoFocus
              value={bbls} onChange={e => setBbls(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
              placeholder="barrels"
              style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid " + t.border, fontSize: 15, fontFamily: "inherit", boxSizing: "border-box" }} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 3, fontWeight: 600 }}>GALLONS</div>
            <input type="number" min="0"
              value={gals} onChange={e => setGals(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
              placeholder="gallons"
              style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "2px solid " + t.accent, fontSize: 15, fontFamily: "inherit", boxSizing: "border-box" }} />
          </div>
        </>
      ) : (
        <div>
          <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 3, fontWeight: 600 }}>QTY</div>
          <input type="number" min="0" autoFocus
            value={gals} onChange={e => setGals(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
            placeholder="qty"
            style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "2px solid " + t.accent, fontSize: 15, fontFamily: "inherit", boxSizing: "border-box" }} />
        </div>
      )}
      {pcsItem && (
        <div>
          <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 3, fontWeight: 600 }}>SET COUNT</div>
          <input type="number" min="0"
            value={pcsVal} onChange={e => setPcsVal(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") save(); }}
            placeholder="sets"
            style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid " + t.border, fontSize: 15, fontFamily: "inherit", boxSizing: "border-box" }} />
        </div>
      )}
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={save} style={{ flex: 1, padding: "8px", borderRadius: 6, background: t.accent, color: "#fff", border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Save</button>
        <button onClick={() => setEditing(false)} style={{ padding: "8px 12px", borderRadius: 6, background: "none", color: t.textMuted, border: "1px solid " + t.border, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
      </div>
    </div>
  );
}


function AdminDashboard({  adminName, trucks, jobs, updates, tickets, activityLog, pmUpdates, members, inventory, truckInventory, returnLog, loadLog, onAddTruck, onDeleteTruck, onReorderTruck, onAddJob, onEditJob, onDeleteJob, onUpdateTicket, onSubmitTicket, onLogAction, onSubmitPmUpdate, onUpdateInventory, onLogout }) {
  const [view, setView] = useState("schedule");
  const [showAddJob, setShowAddJob] = useState(false);
  const [expandedJobs, setExpandedJobs] = useState({});
  const toggleJobExpand = (id) => setExpandedJobs(prev => ({ ...prev, [id]: !prev[id] }));
  const [showAddTruck, setShowAddTruck] = useState(false);
  const [truckHistoryView, setTruckHistoryView] = useState(null);
  const [showAdminTicketForm, setShowAdminTicketForm] = useState(false);
  const [adminTicketForm, setAdminTicketForm] = useState({ truckId: "", description: "", priority: "medium", ticketType: "equipment" });
  const [jobForm, setJobForm] = useState({ address: "", builder: "", type: JOB_TYPES[0], truckId: "", crewMemberIds: [null, null, null, null], date: todayStr(), notes: "", jobCategory: "" });
  const [crewPickerSlot, setCrewPickerSlot] = useState(null); // index 0-3 of slot being picked
  const [truckForm, setTruckForm] = useState({ name: "", members: "" });
  const [activeTicket, setActiveTicket] = useState(null);
  const [ticketStatus, setTicketStatus] = useState("acknowledged");
  const [ticketNote, setTicketNote] = useState("");
  const [ticketFilter, setTicketFilter] = useState("active");
  const [ticketTypeTab, setTicketTypeTab] = useState("equipment");
  const [editingJob, setEditingJob] = useState(null);
  const [editForm, setEditForm] = useState({ address: "", builder: "", type: "", truckId: "", crewMemberIds: [null,null,null,null], date: "", notes: "", jobCategory: "" });
  const [editCrewPickerSlot, setEditCrewPickerSlot] = useState(null);
  const [truckFilter, setTruckFilter] = useState(null);
  const [showUncheckedOnly, setShowUncheckedOnly] = useState(false);
  const [showOngoing, setShowOngoing] = useState(false);
  const [pmJob, setPmJob] = useState(null);
  const [pmNote, setPmNote] = useState("");
  const [pmCheckedAM, setPmCheckedAM] = useState("No");
  const [pmCheckedPM, setPmCheckedPM] = useState("No");
  const [calViewJob, setCalViewJob] = useState(null);
  const [calDayView, setCalDayView] = useState(null); // { dateStr, jobs }

  const activeJobs = jobs.filter((j) => {
    if (j.onHold) return false;
    const latest = updates.filter((u) => u.jobId === j.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
    const isCompleted = latest && latest.status === "completed";
    return !isCompleted && (!truckFilter || j.truckId === truckFilter);
  });
  const onHoldJobs = jobs.filter((j) => j.onHold);
  const openTicketCount = tickets.filter((tk) => tk.status === "open").length;
  const STATUS_SORT_ORDER = { open: 0, acknowledged: 1, in_progress: 2, resolved: 3 };
  const filteredTickets = tickets
    .filter((tk) => !truckFilter || tk.truckId === truckFilter)
    .filter((tk) => (tk.ticketType || "equipment") === ticketTypeTab)
    .sort((a, b) => (STATUS_SORT_ORDER[a.status] ?? 0) - (STATUS_SORT_ORDER[b.status] ?? 0) || new Date(b.timestamp) - new Date(a.timestamp));
  const truckFilterName = truckFilter ? trucks.find((tr) => tr.id === truckFilter)?.name : null;
  const sortedTickets = [...filteredTickets].sort((a, b) => {
    const prioOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    if (prioOrder[a.priority] !== prioOrder[b.priority]) return prioOrder[a.priority] - prioOrder[b.priority];
    return new Date(b.timestamp) - new Date(a.timestamp);
  });
  const orderSort = (a, b) => (a.order ?? 999) - (b.order ?? 999) || naturalSort(a, b);
  const sortedTrucks = [...trucks].sort(orderSort);
  const isFoam = (id) => ["oc_a","oc_b","cc_a","cc_b","env_oc_a","env_oc_b","env_cc_a","env_cc_b","free_env_oc_a","free_env_oc_b"].includes(id);

  const getLatestUpdate = (jobId) => { const u = updates.filter((u) => u.jobId === jobId).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); return u.length > 0 ? u[0] : null; };
  const handleAddJob = () => { onAddJob({ ...jobForm }); onLogAction("Added job: " + jobForm.address + " (" + jobForm.type + ")"); setJobForm({ address: "", builder: "", type: JOB_TYPES[0], truckId: "", crewMemberIds: [null, null, null, null], date: todayStr(), notes: "", jobCategory: "" }); setCrewPickerSlot(null); setShowAddJob(false); };
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
  const openEditJob = (job) => { setEditingJob(job); setEditCrewPickerSlot(null); setEditForm({ address: job.address, builder: job.builder || "", type: job.type, truckId: job.truckId || "", crewMemberIds: job.crewMemberIds?.length === 4 ? job.crewMemberIds : [null,null,null,null], date: job.date, notes: job.notes || "", jobCategory: job.jobCategory || "" }); };
  const handleSaveEdit = () => { onEditJob(editingJob.id, { ...editForm }); onLogAction("Edited job: " + editForm.address); setEditingJob(null); };
  const handleRemoveJob = (job) => { onDeleteJob(job.id); onLogAction("Removed job: " + job.address + " (" + job.type + ")"); };
  const handlePmSubmit = () => {
    const jobLabel = pmJob.builder || pmJob.address;
    const jobId = pmJob.id;
    const prevAM = pmJob.jobCheckedAM || "No";
    const prevPM = pmJob.jobCheckedPM || "No";
    const changes = {};
    if (pmCheckedAM !== prevAM) { changes.jobCheckedAM = pmCheckedAM; changes.amCheckedAt = new Date().toISOString(); onLogAction("AM Check: " + pmCheckedAM + " on " + jobLabel); }
    if (pmCheckedPM !== prevPM) { changes.jobCheckedPM = pmCheckedPM; changes.pmCheckedAt = new Date().toISOString(); onLogAction("PM Check: " + pmCheckedPM + " on " + jobLabel); }
    if (pmNote.trim()) { onSubmitPmUpdate({ jobId, user: adminName, note: pmNote, timestamp: new Date().toISOString(), timeStr: timeStr() }); onLogAction("PM note on " + jobLabel + ": \"" + pmNote.trim().slice(0, 80) + (pmNote.trim().length > 80 ? "..." : "") + "\""); }
    // Submit immediately — no waiting on GPS
    onEditJob(jobId, { jobCheckedAM: pmCheckedAM, jobCheckedPM: pmCheckedPM, ...changes });
    setPmJob(null); setPmNote(""); setPmCheckedAM("No"); setPmCheckedPM("No");
    // Try to capture geo in background and patch it in
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const geoTag = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) };
          const patch = {};
          if (pmCheckedAM !== prevAM) patch.amGeoTag = geoTag;
          if (pmCheckedPM !== prevPM) patch.pmGeoTag = geoTag;
          if (Object.keys(patch).length > 0) onEditJob(jobId, patch);
        },
        () => {}, // silently ignore if denied
        { timeout: 10000, maximumAge: 0, enableHighAccuracy: true }
      );
    }
  };
  const handleRemoveTruck = (tr) => { onDeleteTruck(tr.id); onLogAction("Removed crew: " + tr.name); };
  const sortedLog = [...activityLog].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const calPrev = () => { if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); } else { setCalMonth(calMonth - 1); } };
  const calNext = () => { if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); } else { setCalMonth(calMonth + 1); } };
  const calDays = () => {
    const first = new Date(calYear, calMonth, 1);
    const last = new Date(calYear, calMonth + 1, 0);
    const startDay = first.getDay();
    const totalDays = last.getDate();
    const cells = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) cells.push(d);
    return cells;
  };
  const calMonthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const getJobsForDate = (day) => {
    if (!day) return [];
    const cellDate = new Date(calYear, calMonth, day);
    if (cellDate.getDay() === 0) return []; // No jobs on Sunday
    const ds = calYear + "-" + String(calMonth + 1).padStart(2, "0") + "-" + String(day).padStart(2, "0");
    const todayStr = todayCST();
    return jobs.filter((j) => {
      if (j.onHold) return false;
      const jobUpdates = updates.filter(u => u.jobId === j.id).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      // Must have at least one in_progress or completed update to appear on calendar
      const startedUpdate = jobUpdates.find(u => u.status === "in_progress" || u.status === "completed");
      if (!startedUpdate) return false;
      const startedDate = tsToCST(startedUpdate.timestamp);
      const completedUpdate = jobUpdates.find(u => u.status === "completed");
      const completedDate = completedUpdate ? tsToCST(completedUpdate.timestamp) : null;
      if (ds < startedDate) return false;
      if (completedDate) return ds <= completedDate;
      return ds <= todayStr;
    });
  };
  const todayDay = new Date().getDate();
  const todayMonth = new Date().getMonth();
  const todayYear = new Date().getFullYear();

  const tabStyle = (active) => ({ padding: "8px 16px", background: active ? t.accent : "transparent", color: active ? "#fff" : t.textMuted, border: active ? "none" : "1px solid " + t.border, borderRadius: "6px", fontSize: "12.5px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit", position: "relative" });

  const NAV_ICONS = {
    schedule: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>,
    calendar: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 14h8M8 18h5"/></svg>,
    tickets: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M2 9a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v1.5a1.5 1.5 0 0 0 0 3V15a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-1.5a1.5 1.5 0 0 0 0-3V9z"/></svg>,
    trucks: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
    roster: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75M21 21v-2a4 4 0 0 0-3-3.87"/></svg>,
    inventory: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M5 8h14M5 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8m-9 4h4"/></svg>,
    log: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>,
  };
  const NAV_ITEMS = [
    { key: "schedule", label: "Schedule" },
    { key: "calendar", label: "Calendar" },
    { key: "tickets", label: "Tickets", badge: openTicketCount },
    { key: "trucks", label: "Trucks" },
    { key: "inventory", label: "Inventory" },
    { key: "roster", label: "Roster" },
    { key: "log", label: "Log" },
  ];

  return (
    <div style={{ minHeight: "100dvh", background: t.bg, paddingBottom: "calc(72px + env(safe-area-inset-bottom, 0px))" }}>
      {/* Top header — title + logout only */}
      <div style={{ background: t.surface, borderBottom: "1px solid " + t.border, padding: "12px 20px", paddingTop: "calc(12px + env(safe-area-inset-top, 0px))", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: "900px", margin: "0 auto" }}>
          <svg width="180" height="50" viewBox="0 0 360 100" xmlns="http://www.w3.org/2000/svg">
            <rect width="360" height="100" fill="#0f172a" rx="8"/>
            <rect x="18" y="14" width="4" height="72" fill="#2563eb" rx="2"/>
            <text x="32" y="80" fontFamily="Arial Black,sans-serif" fontSize="72" fontWeight="900" fill="white" letterSpacing="-3">IST</text>
            <line x1="168" y1="16" x2="168" y2="84" stroke="#1e3a5f" strokeWidth="1.5"/>
            <text x="180" y="38" fontFamily="Arial,sans-serif" fontSize="12" fontWeight="700" fill="#3b82f6" letterSpacing="3">INSULATION</text>
            <text x="180" y="56" fontFamily="Arial,sans-serif" fontSize="12" fontWeight="700" fill="#3b82f6" letterSpacing="3">SERVICES</text>
            <text x="180" y="74" fontFamily="Arial,sans-serif" fontSize="12" fontWeight="700" fill="#3b82f6" letterSpacing="3">OF TULSA</text>
          </svg>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "12.5px", color: t.textMuted }}>{adminName}</span>
            <Button variant="ghost" onClick={onLogout} style={{ fontSize: "12px" }}>Log Out</Button>
          </div>
        </div>
      </div>

      {/* Bottom nav */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 200, background: t.surface, borderTop: "1px solid " + t.border, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex" }}>
        {NAV_ITEMS.map(item => (
          <button key={item.key} onClick={() => { if (item.key === "schedule" || item.key === "tickets") setTruckFilter(null); setView(item.key); }} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "8px 4px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", position: "relative", gap: "2px" }}>
            <span style={{ lineHeight: 1, color: view === item.key ? t.accent : "rgba(100,116,139,0.7)" }}>{NAV_ICONS[item.key]}</span>
            <span style={{ fontSize: "10px", fontWeight: view === item.key ? 700 : 400, color: view === item.key ? t.accent : t.textMuted }}>{item.label}</span>
            {item.badge > 0 && <span style={{ position: "absolute", top: "4px", right: "calc(50% - 16px)", background: t.danger, color: "#fff", fontSize: "9px", fontWeight: 700, borderRadius: "50%", width: "15px", height: "15px", display: "flex", alignItems: "center", justifyContent: "center", animation: "badgePulse 1.8s ease-in-out infinite" }}>{item.badge}</span>}
            {view === item.key && <div style={{ position: "absolute", top: 0, left: "15%", right: "15%", height: "2px", background: t.accent, borderRadius: "0 0 2px 2px" }} />}
          </button>
        ))}
        </div>
        <div style={{ height: "env(safe-area-inset-bottom, 0px)", background: t.surface }} />
      </div>

      <div style={{ padding: "20px", maxWidth: "900px", margin: "0 auto" }}>

        {view === "schedule" && (
          <>
            {(() => { const uncheckedCount = activeJobs.filter((j) => j.jobCheckedAM !== "Yes" || j.jobCheckedPM !== "Yes").length; return (
            <SectionHeader title="Schedule" right={<>
              {uncheckedCount > 0 && <button onClick={() => setShowUncheckedOnly(!showUncheckedOnly)} style={{ padding: "6px 12px", border: "1px solid " + (showUncheckedOnly ? t.danger : t.border), borderRadius: "6px", fontSize: "12px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit", background: showUncheckedOnly ? t.dangerBg : "#fff", color: showUncheckedOnly ? t.danger : t.textMuted }}>{showUncheckedOnly ? "Show All" : uncheckedCount + " Unchecked"}</button>}
              <button onClick={() => setShowOngoing(o => !o)} style={{ padding: "6px 12px", border: "1px solid " + (showOngoing ? t.accent : t.border), borderRadius: "6px", fontSize: "12px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit", background: showOngoing ? t.accentBg : "#fff", color: showOngoing ? t.accent : t.textMuted, position: "relative" }}>On-going Jobs{onHoldJobs.length > 0 && <span style={{ position: "absolute", top: -5, right: -5, background: t.accent, color: "#fff", fontSize: 9, fontWeight: 700, borderRadius: "50%", width: 15, height: 15, display: "flex", alignItems: "center", justifyContent: "center" }}>{onHoldJobs.length}</span>}</button>
              <Button onClick={() => { setJobForm({ ...jobForm, date: todayStr() }); setShowAddJob(true); }}>+ Add Job</Button>
            </>} />
            ); })()}
            {showOngoing && (
              <div style={{ background: t.surface, border: "1px solid " + t.border, borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>On-going Jobs</div>
                {onHoldJobs.length === 0
                  ? <div style={{ fontSize: 13, color: t.textMuted }}>No on-going jobs.</div>
                  : onHoldJobs.map(job => {
                    const crew = trucks.find(tr => tr.id === job.truckId);
                    return (
                      <div key={job.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid " + t.borderLight, gap: 8 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{job.builder || "No Customer"}</div>
                          <div style={{ fontSize: 11, color: t.textMuted }}>{job.address?.split(",")[0]} · {new Date(job.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {crew?.members || crew?.name || "Unassigned"}</div>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <Button onClick={() => onEditJob(job.id, { ...job, onHold: false })} style={{ padding: "5px 10px", fontSize: 11 }}>Resume</Button>
                          <Button variant="danger" onClick={() => { if (confirm("Delete this job?")) onDeleteJob(job.id); }} style={{ padding: "5px 10px", fontSize: 11 }}>Delete</Button>
                        </div>
                      </div>
                    );
                  })
                }
              </div>
            )}
            {truckFilterName && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px", padding: "8px 12px", background: t.accentBg, borderRadius: "6px", fontSize: "13px", color: t.accent, fontWeight: 500 }}>
                Showing jobs for {truckFilterName}
                <button onClick={() => setTruckFilter(null)} style={{ background: "none", border: "none", color: t.accent, cursor: "pointer", fontWeight: 700, fontSize: "14px", fontFamily: "inherit", padding: "0 4px" }}>✕</button>
              </div>
            )}
            {(() => {
              const displayJobs = showUncheckedOnly ? activeJobs.filter((j) => j.jobCheckedAM !== "Yes" || j.jobCheckedPM !== "Yes") : activeJobs;
              if (displayJobs.length === 0) return <EmptyState text={showUncheckedOnly ? "All jobs have been checked." : "No active jobs."} />;
              const unassigned = displayJobs.filter((j) => !j.truckId);
              // Group jobs by their assigned crew member combo (sorted IDs joined as key)
              const crewGroupMap = {};
              displayJobs.forEach((j) => {
                const ids = (j.crewMemberIds || []).filter(Boolean).sort();
                const key = ids.length > 0 ? ids.join(",") : "_unassigned";
                if (!crewGroupMap[key]) {
                  const names = ids.map(id => members.find(m => m.id === id)?.name).filter(Boolean);
                  const truck = trucks.find(tr => tr.id === j.truckId);
                  crewGroupMap[key] = { key, names, truckLabel: truck ? (truck.members || truck.name) : null, jobs: [] };
                }
                crewGroupMap[key].jobs.push(j);
              });
              const crewGroups = Object.values(crewGroupMap).sort((a, b) => {
                if (a.key === "_unassigned") return 1;
                if (b.key === "_unassigned") return -1;
                return (a.names[0] || "").localeCompare(b.names[0] || "");
              }).filter((g) => !truckFilter || g.jobs.some(j => j.truckId === truckFilter));
              return crewGroups.map((group) => (
                <div key={group.key} style={{ marginBottom: "20px" }}>
                  {(() => {
                    const headerName = group.names.length > 0 ? group.names.join(" and ") : "Unassigned";
                    return (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", paddingBottom: "6px", borderBottom: "2px solid " + t.accent }}>
                        <div style={{ fontSize: "15px", fontWeight: 600, color: t.text }}>{headerName}</div>
                        {group.truckLabel && <span style={{ fontSize: "12px", color: t.textMuted }}>— {group.truckLabel}</span>}
                        <Badge>{group.jobs.length} job{group.jobs.length !== 1 ? "s" : ""}</Badge>
                      </div>
                    );
                  })()}
                  {group.jobs.map((job) => {
                    const latest = getLatestUpdate(job.id);
                    const statusObj = latest ? STATUS_OPTIONS.find((s) => s.value === latest.status) : STATUS_OPTIONS[0];
                    const jobUpdates = updates.filter((u) => u.jobId === job.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                    const jobPmUpdates = pmUpdates.filter((p) => p.jobId === job.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                    const isChecked = job.jobCheckedAM === "Yes" && job.jobCheckedPM === "Yes";
                    const partialCheck = job.jobCheckedAM === "Yes" || job.jobCheckedPM === "Yes";
                    const isExpanded = !!expandedJobs[job.id];
                    return (
                      <Card key={job.id} style={{ marginLeft: "8px", padding: "14px 16px" }}>

                        {/* Top row — customer + expand toggle */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", cursor: "pointer" }} onClick={() => toggleJobExpand(job.id)}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: t.text, fontSize: "15px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{job.builder || "No Customer Listed"}</div>
                            <div style={{ fontSize: "12.5px", color: t.textMuted, marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{job.address}</div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                            <Badge color={statusObj.color} bg={statusObj.bg}>{statusObj.label}</Badge>
                            <span style={{ fontSize: "14px", color: t.textMuted, lineHeight: 1 }}>{isExpanded ? "▲" : "▼"}</span>
                          </div>
                        </div>

                        {/* Pill row — always visible */}
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "10px", flexWrap: "wrap" }}>
                          {job.amGeoTag
                            ? <a href={`https://www.google.com/maps?q=${job.amGeoTag.lat},${job.amGeoTag.lng}`} target="_blank" rel="noreferrer" style={{ fontSize: "11px", fontWeight: 600, padding: "3px 8px", borderRadius: "20px", background: "#dcfce7", color: "#15803d", textDecoration: "none" }}>AM ✓ 📍</a>
                            : <span style={{ fontSize: "11px", fontWeight: 600, padding: "3px 8px", borderRadius: "20px", background: job.jobCheckedAM === "Yes" ? "#dcfce7" : "#fee2e2", color: job.jobCheckedAM === "Yes" ? "#15803d" : "#dc2626" }}>AM {job.jobCheckedAM === "Yes" ? "✓" : "✗"}</span>}
                          {job.pmGeoTag
                            ? <a href={`https://www.google.com/maps?q=${job.pmGeoTag.lat},${job.pmGeoTag.lng}`} target="_blank" rel="noreferrer" style={{ fontSize: "11px", fontWeight: 600, padding: "3px 8px", borderRadius: "20px", background: "#dcfce7", color: "#15803d", textDecoration: "none" }}>PM ✓ 📍</a>
                            : <span style={{ fontSize: "11px", fontWeight: 600, padding: "3px 8px", borderRadius: "20px", background: job.jobCheckedPM === "Yes" ? "#dcfce7" : "#fee2e2", color: job.jobCheckedPM === "Yes" ? "#15803d" : "#dc2626" }}>PM {job.jobCheckedPM === "Yes" ? "✓" : "✗"}</span>}
                          <span style={{ fontSize: "11px", color: t.textMuted, marginLeft: "2px" }}>{job.type}</span>
                          {job.jobCategory && <span style={{ fontSize: "11px", fontWeight: 600, color: job.jobCategory === "Retro" ? "#15803d" : "#dc2626" }}>{job.jobCategory}</span>}
                          <span style={{ fontSize: "11px", color: t.textMuted, marginLeft: "auto" }}>{new Date(job.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                        </div>

                        {/* Expanded detail */}
                        {isExpanded && (
                          <>
                            {job.notes && <div style={{ fontSize: "13px", color: t.textMuted, marginTop: "10px", fontStyle: "italic", paddingTop: "10px", borderTop: "1px solid " + t.borderLight }}>{job.notes}</div>}

                            <div style={{ display: "flex", gap: "16px", marginTop: "12px", flexWrap: "wrap" }}>
                              <div style={{ flex: "1 1 45%", minWidth: "200px" }}>
                                <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", color: t.textMuted, marginBottom: "6px", fontWeight: 600, paddingTop: "10px", borderTop: "1px solid " + t.borderLight }}>Crew Updates</div>
                                {jobUpdates.length === 0 ? <div style={{ fontSize: "12.5px", color: t.textMuted }}>Nothing.</div> : jobUpdates.map((u) => {
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
                              <div style={{ flex: "1 1 45%", minWidth: "200px", cursor: "pointer", borderRadius: "6px", padding: "4px", margin: "-4px", transition: "background 0.15s ease" }} onClick={() => { setPmJob(job); setPmCheckedAM(job.jobCheckedAM || "No"); setPmCheckedPM(job.jobCheckedPM || "No"); }} onMouseEnter={(e) => e.currentTarget.style.background = t.bg} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                                <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", color: "#dc2626", marginBottom: "6px", fontWeight: 600, paddingTop: "10px", borderTop: "1px solid " + t.borderLight, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <span>PM Updates</span>
                                  <span style={{ fontSize: "10px", color: t.textMuted, fontWeight: 500, textTransform: "none" }}>Tap to update</span>
                                </div>
                                {jobPmUpdates.length === 0 ? <div style={{ fontSize: "12.5px", color: t.textMuted }}>Nothing.</div> : jobPmUpdates.map((p) => (
                                  <div key={p.id} style={{ fontSize: "12.5px", padding: "6px 0", borderBottom: "1px solid " + t.borderLight, color: t.textSecondary }}>
                                    <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                                      <span style={{ color: t.textMuted }}>{p.timeStr}</span>
                                      <strong style={{ color: t.text }}>{p.user}</strong>
                                    </div>
                                    <div style={{ marginTop: "3px", color: t.text, paddingLeft: "2px" }}>{p.note}</div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Action row */}
                            <div style={{ display: "flex", gap: "8px", marginTop: "14px", paddingTop: "12px", borderTop: "1px solid " + t.borderLight }}>
                              <Button variant="secondary" onClick={() => { setPmJob(job); setPmCheckedAM(job.jobCheckedAM || "No"); setPmCheckedPM(job.jobCheckedPM || "No"); }} style={{ padding: "6px 12px", fontSize: "12px", flex: 1 }}>PM Note</Button>
                              <Button variant="secondary" onClick={() => openEditJob(job)} style={{ padding: "6px 12px", fontSize: "12px", flex: 1 }}>Edit</Button>
                              <Button variant="secondary" onClick={() => onEditJob(job.id, { ...job, onHold: true })} style={{ padding: "6px 12px", fontSize: "12px", flex: 1 }}>Hold</Button>
                              <Button variant="danger" onClick={() => handleRemoveJob(job)} style={{ padding: "6px 12px", fontSize: "12px", flex: 1 }}>Remove</Button>
                            </div>
                          </>
                        )}
                      </Card>
                    );
                  })}
                </div>
              ));
            })()}
          </>
        )}

        {view === "calendar" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <button onClick={calPrev} style={{ background: t.surface, border: "1px solid " + t.border, borderRadius: "6px", padding: "6px 14px", cursor: "pointer", color: t.text, fontSize: "14px", fontFamily: "inherit" }}>←</button>
              <div style={{ fontSize: "18px", fontWeight: 600, color: t.text }}>{calMonthNames[calMonth]} {calYear}</div>
              <button onClick={calNext} style={{ background: t.surface, border: "1px solid " + t.border, borderRadius: "6px", padding: "6px 14px", cursor: "pointer", color: t.text, fontSize: "14px", fontFamily: "inherit" }}>→</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: "1px", background: t.border, border: "1px solid " + t.border, borderRadius: "8px", overflow: "hidden", width: "100%" }}>
              {["Su","Mo","Tu","We","Th","Fr","Sa"].map((d) => (
                <div key={d} style={{ background: t.surface, padding: "6px 2px", textAlign: "center", fontSize: "10px", fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.3px" }}>{d}</div>
              ))}
              {calDays().map((day, i) => {
                const dayJobs = getJobsForDate(day);
                const isToday = day === todayDay && calMonth === todayMonth && calYear === todayYear;
                const calDayStr = day ? calYear + "-" + String(calMonth + 1).padStart(2, "0") + "-" + String(day).padStart(2, "0") : null;
                const dayTimeOff = calDayStr ? tickets.filter((tk) => tk.ticketType === "timeoff" && tk.timeOffStart && tk.status !== "resolved" && calDayStr >= tk.timeOffStart && calDayStr <= (tk.timeOffEnd || tk.timeOffStart)) : [];
                const grouped = {};
                dayJobs.forEach((j) => {
                  const crew = trucks.find((tr) => tr.id === j.truckId);
                  const key = crew ? crew.id : "_unassigned";
                  if (!grouped[key]) grouped[key] = { name: crew ? (crew.members || crew.name) : "Unassigned", jobs: [] };
                  grouped[key].jobs.push(j);
                });
                const crewKeys = Object.keys(grouped).sort((a, b) => {
                  if (a === "_unassigned") return 1;
                  if (b === "_unassigned") return -1;
                  return (grouped[a].name).localeCompare(grouped[b].name);
                });
                const totalItems = dayJobs.length + dayTimeOff.length;
                return (
                  <div key={i} style={{ background: day ? (isToday ? t.accentBg : "#fff") : t.bg, padding: "3px 2px", minHeight: "80px", overflow: "hidden", boxSizing: "border-box" }}>
                    {day && (
                      <>
                        <div onClick={() => dayJobs.length > 0 && setCalDayView({ dateStr: calDayStr, jobs: dayJobs })} style={{ fontSize: "11px", fontWeight: isToday ? 700 : 500, color: isToday ? "#fff" : t.textMuted, marginBottom: "3px", textAlign: "center", width: "20px", height: "20px", lineHeight: "20px", borderRadius: "50%", background: isToday ? t.accent : "transparent", margin: "0 auto 3px", cursor: dayJobs.length > 0 ? "pointer" : "default" }}>{day}</div>
                        {crewKeys.map((key) => (
                          grouped[key].jobs.map((j) => {
                            const lat = updates.filter((u) => u.jobId === j.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
                            const isDone = lat && lat.status === "completed";
                            return (
                              <div key={j.id} style={{ fontSize: "9px", padding: "2px 3px", marginBottom: "2px", borderRadius: "3px", background: j.jobCategory === "Retro" ? "#dcfce7" : j.jobCategory === "New Construction" ? "#fee2e2" : "#dbeafe", color: j.jobCategory === "Retro" ? "#15803d" : j.jobCategory === "New Construction" ? "#dc2626" : "#1d4ed8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer", borderLeft: (j.jobCheckedAM === "Yes" && j.jobCheckedPM === "Yes") ? "2px solid #15803d" : (j.jobCheckedAM === "Yes" || j.jobCheckedPM === "Yes") ? "2px solid #f59e0b" : "2px solid #dc2626", display: "block", maxWidth: "100%" }} title={(j.builder || "No Customer") + " — " + j.address} onClick={() => setCalViewJob(j)}>
                                {isDone ? "✓ " : ""}{j.builder || j.address}
                              </div>
                            );
                          })
                        ))}
                        {dayTimeOff.map((tk) => (
                          <div key={tk.id} style={{ fontSize: "9px", padding: "2px 3px", marginBottom: "2px", borderRadius: "3px", background: "#f3e8ff", color: "#7c3aed", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", borderLeft: "2px solid #8b5cf6", cursor: "pointer", display: "block", maxWidth: "100%" }} title={"Time Off: " + tk.submittedBy} onClick={() => { setTicketTypeTab("timeoff"); setView("tickets"); }}>
                            {tk.submittedBy}
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: "12px", marginTop: "12px", fontSize: "11px", color: t.textMuted, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ width: "10px", height: "10px", borderRadius: "2px", background: "#dcfce7", display: "inline-block" }}></span> Retro</div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ width: "10px", height: "10px", borderRadius: "2px", background: "#fee2e2", display: "inline-block" }}></span> New Construction</div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ width: "10px", height: "10px", borderRadius: "2px", background: "#dbeafe", display: "inline-block" }}></span> Uncategorized</div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>✓ = Completed</div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ width: "3px", height: "10px", borderRadius: "1px", background: "#15803d", display: "inline-block" }}></span> Both Checked</div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ width: "3px", height: "10px", borderRadius: "1px", background: "#f59e0b", display: "inline-block" }}></span> Partial (AM or PM)</div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ width: "3px", height: "10px", borderRadius: "1px", background: "#dc2626", display: "inline-block" }}></span> Not Checked</div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ width: "10px", height: "10px", borderRadius: "2px", background: "#f3e8ff", display: "inline-block" }}></span> Time Off</div>
            </div>
          </>
        )}

        {view === "tickets" && (
          <>
            <SectionHeader title="Tickets" right={<Button onClick={() => setShowAdminTicketForm(true)}>+ New Ticket</Button>} />
            {/* Ticket type tab bar */}
            {(() => {
              const typeTabs = [
                { key: "equipment", emoji: "", label: "Equipment", accent: t.accent },
                { key: "inventory", emoji: "", label: "Inventory", accent: "#f59e0b" },
                { key: "timeoff",   emoji: "",  label: "Time Off",  accent: "#8b5cf6" },
              ];
              return (
                <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                  {typeTabs.map((tab) => {
                    const openCount = tickets.filter((tk) => (tk.ticketType || "equipment") === tab.key && tk.status !== "resolved" && (!truckFilter || tk.truckId === truckFilter)).length;
                    const unresponded = tickets.filter((tk) => (tk.ticketType || "equipment") === tab.key && tk.status === "open" && !tk.adminNote && (!truckFilter || tk.truckId === truckFilter)).length;
                    const active = ticketTypeTab === tab.key;
                    return (
                      <button key={tab.key} onClick={() => setTicketTypeTab(tab.key)} style={{ flex: 1, padding: "10px 6px", border: active ? "2px solid " + tab.accent : unresponded > 0 ? "2px solid #ef4444" : "1px solid " + t.border, borderRadius: "8px", background: active ? tab.accent : t.surface, color: active ? "#fff" : t.textSecondary, fontWeight: 600, fontSize: "12px", cursor: "pointer", fontFamily: "inherit", position: "relative", animation: !active && unresponded > 0 ? "borderPulse 1.8s ease-in-out infinite" : "none" }}>
                        {tab.emoji} {tab.label}
                        {openCount > 0 && <span style={{ position: "absolute", top: "-6px", right: "-4px", background: "#ef4444", color: "#fff", fontSize: "10px", fontWeight: 700, borderRadius: "50%", width: "18px", height: "18px", display: "flex", alignItems: "center", justifyContent: "center" }}>{openCount}</span>}
                      </button>
                    );
                  })}
                </div>
              );
            })()}

            {truckFilterName && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px", padding: "8px 12px", background: t.accentBg, borderRadius: "6px", fontSize: "13px", color: t.accent, fontWeight: 500 }}>
                Showing tickets for {truckFilterName}
                <button onClick={() => setTruckFilter(null)} style={{ background: "none", border: "none", color: t.accent, cursor: "pointer", fontWeight: 700, fontSize: "14px", fontFamily: "inherit", padding: "0 4px" }}>✕</button>
              </div>
            )}

            {filteredTickets.length === 0
              ? <EmptyState text="No tickets here." sub="Nothing submitted in this category yet." />
              : filteredTickets.map((ticket) => {
                  const prioObj = TICKET_PRIORITIES.find((p) => p.value === ticket.priority);
                  const statObj = TICKET_STATUSES.find((s) => s.value === ticket.status);
                  const isOpen = ticket.status === "open" && !ticket.adminNote;
                  return (
                    <Card key={ticket.id} onClick={() => { setActiveTicket(ticket); setTicketStatus(ticket.status === "open" ? "acknowledged" : ticket.status); setTicketNote(ticket.adminNote || ""); }} style={{ cursor: "pointer", marginBottom: "8px", border: isOpen ? "2px solid #ef4444" : "1px solid #e5e7eb", opacity: ticket.status === "resolved" ? 0.6 : 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
                        <div style={{ display: "flex", gap: "5px", alignItems: "center", flexWrap: "wrap" }}>
                          {ticketTypeTab !== "timeoff" && <Badge color={prioObj?.color} bg={prioObj?.bg}>{prioObj?.label?.split("—")[0]?.trim()}</Badge>}
                          <Badge color={statObj?.color} bg={statObj?.bg}>{statObj?.label}</Badge>
                          <span style={{ fontSize: "11px", color: t.textMuted }}>{ticket.truckName || "Unknown Truck"}</span>
                        </div>
                        <span style={{ fontSize: "11.5px", color: t.textMuted, flexShrink: 0 }}>{dateStr(ticket.timestamp)}</span>
                      </div>
                      <div style={{ fontSize: "14px", color: t.text, lineHeight: 1.5 }}>{ticket.description}</div>
                      <div style={{ fontSize: "12px", color: t.textMuted, marginTop: "6px" }}>Submitted by {ticket.submittedBy}</div>
                      {ticket.adminNote && <div style={{ fontSize: "13px", color: t.textSecondary, background: t.bg, padding: "10px 12px", borderRadius: "6px", marginTop: "8px", borderLeft: "3px solid #15803d" }}>Response: {ticket.adminNote}</div>}
                    </Card>
                  );
                })
            }
          </>
        )}

        {view === "trucks" && (
          <>
            <SectionHeader title="Trucks" right={<Button onClick={() => setShowAddTruck(true)}>+ Add Truck</Button>} />
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
                        <div style={{ fontWeight: 600, color: t.accent, fontSize: "14.5px", cursor: "pointer", textDecoration: "underline" }} onClick={() => setTruckHistoryView({ truck: tr, calMonth: new Date().getMonth(), calYear: new Date().getFullYear(), selectedDate: null })}>{tr.members || tr.name}</div>
                        <div style={{ fontSize: 11, color: t.textMuted }}>View unload history</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <span onClick={() => { setTruckFilter(tr.id); setView("schedule"); }} style={{ cursor: "pointer" }}><Badge>{truckJobs.length} active job{truckJobs.length !== 1 ? "s" : ""}</Badge></span>
                      {truckTickets.length > 0 && <span onClick={() => { setTruckFilter(tr.id); setTicketFilter("active"); setView("tickets"); }} style={{ cursor: "pointer" }}><Badge color="#b91c1c" bg="#fee2e2">{truckTickets.length} issue{truckTickets.length !== 1 ? "s" : ""}</Badge></span>}
                      <Button variant="danger" onClick={() => handleRemoveTruck(tr)} style={{ padding: "4px 8px", fontSize: "11px" }}>Remove</Button>
                    </div>
                  </div>
                  {/* Truck inventory */}
                  {(() => {
                    const ti = truckInventory?.[tr.id] || {};
                    const loaded = INVENTORY_ITEMS.filter(i => (ti[i.id] || 0) > 0);
                    return (
                      <div style={{ marginTop: 12, borderTop: "1px solid " + t.borderLight, paddingTop: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Loaded on Truck</div>
                        {loaded.length === 0
                          ? <div style={{ fontSize: 12, color: t.textMuted }}>Nothing loaded.</div>
                          : <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                              {(() => { const ocS = Math.min(ti["oc_a"]||0, ti["oc_b"]||0); const ccS = Math.min(ti["cc_a"]||0, ti["cc_b"]||0); return <>{ocS > 0 && <span style={{ fontSize: 12, fontWeight: 600, background: t.accentBg, color: t.accent, padding: "3px 9px", borderRadius: 6 }}>Open Cell — {ocS.toFixed(2)} sets</span>}{ccS > 0 && <span style={{ fontSize: 12, fontWeight: 600, background: t.accentBg, color: t.accent, padding: "3px 9px", borderRadius: 6 }}>Closed Cell — {ccS.toFixed(2)} sets</span>}</>; })()}
                              {loaded.filter(item => !isFoam(item.id)).map(item => (
                                <span key={item.id} style={{ fontSize: 12, fontWeight: 600, background: t.accentBg, color: t.accent, padding: "3px 9px", borderRadius: 6 }}>{item.name} — {ti[item.id]} {item.unit}</span>
                              ))}
                            </div>
                        }
                      </div>
                    );
                  })()}
                </Card>
              );
            })}
          </>
        )}

        {view === "roster" && (
          <RosterView trucks={trucks} jobs={jobs} updates={updates} />
        )}

        {view === "inventory" && (() => {
          const categories = [...new Set(INVENTORY_ITEMS.map(i => i.category))];
          const getQty = (itemId) => (inventory.find(r => r.itemId === itemId)?.qty || 0);
          const isFgTube = (item) => item.hasPieces;
          const isFgPcs = (item) => item.isPieces;
          const galsToBbl = (g, id) => Math.round(g / (id && ["cc_a","cc_b","env_cc_a","env_cc_b"].includes(id) ? 50 : 48) * 100) / 100;
          const bblToGals = (b, id) => Math.round(b * (id && ["cc_a","cc_b","env_cc_a","env_cc_b"].includes(id) ? 50 : 48));
          const S = {
            tbl: { width: "100%", borderCollapse: "collapse" },
            catRow: { background: "#1e293b", color: "#fff" },
            catTd: { padding: "5px 12px", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1 },
            th: { padding: "6px 8px", fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.5, background: t.surface, borderBottom: "1px solid " + t.border, textAlign: "left" },
            thR: { padding: "6px 8px", fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.5, background: t.surface, borderBottom: "1px solid " + t.border, textAlign: "right" },
            td: { padding: "5px 8px", fontSize: 13, color: t.text, borderBottom: "1px solid " + t.borderLight },
            tdR: { padding: "5px 8px", fontSize: 13, fontWeight: 700, textAlign: "right", borderBottom: "1px solid " + t.borderLight },
            btn: { height: 36, minWidth: 36, padding: "0 8px", borderRadius: 7, border: "1px solid " + t.border, background: t.bg, fontSize: 13, cursor: "pointer", fontFamily: "inherit", lineHeight: 1 },
          };
          return (
            <div style={{ padding: "0 0 24px" }}>
              <div style={{ padding: "10px 14px 6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: t.text }}>Warehouse Inventory</div>
                <span style={{ fontSize: 10, color: t.textMuted }}>Live</span>
              </div>
              {categories.map(cat => {
                const catItems = INVENTORY_ITEMS.filter(i => i.category === cat && !i.isPieces).sort((a,b) => { const isMP = s => s.unit==='MP'||s.unit==='master packs'; if(isMP(a)!==isMP(b)) return isMP(a)?-1:1; const base = s => s.name.replace(/ *(MP|Tubes).*$/i,'').trim(); return base(a).localeCompare(base(b)); });
                return (
                <details key={cat} open style={{ marginBottom: 8, borderRadius: 8, overflow: "hidden", border: "1px solid " + t.border }}>
                  <summary style={{ background: "#1e293b", color: "#fff", padding: "8px 14px", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, cursor: "pointer", listStyle: "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>{cat}</span><span style={{ fontSize: 10, opacity: 0.6 }}>▾</span>
                  </summary>
                <table style={S.tbl}>
                <thead>
                  <tr>
                    <th style={S.th}>Material</th>
                    <th style={{ ...S.thR, width: 60 }}>Qty</th>
                    <th style={{ ...S.thR, width: 70 }}>±</th>
                  </tr>
                </thead>
                <tbody>
                  {[cat].map(() => (
                    <>
                      {INVENTORY_ITEMS.filter(i => i.category === cat && !i.isPieces).sort((a,b) => { const isMP = s => s.unit==='MP'||s.unit==='master packs'; if(isMP(a)!==isMP(b)) return isMP(a)?-1:1; const base = s => s.name.replace(/ *(MP|Tubes).*$/i,'').trim(); return base(a).localeCompare(base(b)); }).map(item => {
                        const qty = getQty(item.id);
                        const pcsItem = item.hasPieces ? INVENTORY_ITEMS.find(i => i.parentId === item.id) : null;
                        const pcsQty = pcsItem ? getQty(pcsItem.id) : 0;
                        const low = qty === 0 ? "#ef4444" : qty <= 2 ? "#d97706" : t.text;
                        return (
                          <tr key={item.id} style={{ background: qty === 0 ? "#fff5f5" : qty <= 2 ? "#fffbeb" : "#fff" }}>
                            <td style={S.td}>
                              <div>{item.name} <span style={{ fontSize: 10, color: t.textMuted }}>({item.unit})</span></div>
                              {item.sqftPerTube && <div style={{ fontSize: 10, color: t.textMuted }}>{item.sqftPerTube} sqft/tube</div>}
                            </td>
                            <td style={{ ...S.tdR, fontSize: 15 }}>
                              <div style={{ color: low, fontWeight: 700 }}>{isFoam(item.id) ? qty.toFixed(2) : qty}{isFoam(item.id) && <span style={{ fontSize: 9, color: t.textMuted, fontWeight: 500, marginLeft: 3 }}>{bblToGals(qty, item.id)} gal</span>}</div>
                              {item.sqftPerTube && qty > 0 && <div style={{ fontSize: 9, color: t.textMuted }}>{(item.sqftPerTube * qty).toFixed(0)} sqft</div>}
                              {qty === 0 && <div style={{ fontSize: 8, fontWeight: 800, color: "#ef4444" }}>OUT</div>}
                              {!isFoam(item.id) && qty > 0 && qty <= 2 && <div style={{ fontSize: 8, fontWeight: 800, color: "#d97706" }}>LOW</div>}
                              {pcsItem && <div style={{ marginTop: 4, paddingTop: 4, borderTop: "1px dashed #e5e7eb" }}>
                                <div style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.4 }}>Pieces</div>
                                <div style={{ fontSize: 16, fontWeight: 800, color: pcsQty > 0 ? "#1e40af" : "#9ca3af" }}>{pcsQty}</div>
                                {item.sqftPerTube && item.pcsPerTube && pcsQty > 0 && <div style={{ fontSize: 9, color: t.textMuted }}>{((item.sqftPerTube / item.pcsPerTube) * pcsQty).toFixed(1)} sqft</div>}
                              </div>}
                            </td>
                            <td style={{ ...S.tdR, verticalAlign: "top", paddingTop: 8 }}>
                              <InventoryEditCell
                                itemId={item.id}
                                qty={qty}
                                isFoam={isFoam(item.id)}
                                bblToGals={bblToGals}
                                galsToBbl={galsToBbl}
                                pcsItem={pcsItem}
                                pcsQty={pcsQty}
                                onUpdateInventory={onUpdateInventory}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </>
                  ))}
                </tbody>
              </table>
              </details>
                );
              })}
            </div>
          );
        })()}

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
          <Select label="Assign Truck" value={jobForm.truckId} onChange={(e) => setJobForm({ ...jobForm, truckId: e.target.value })} options={[{ value: "", label: "— Unassigned —" }, ...sortedTrucks.map((tr) => ({ value: tr.id, label: tr.members || tr.name }))]} />
          {/* Assign Crew Members — 4 slots */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: t.textSecondary, marginBottom: "10px" }}>Assign Crew Members</label>
            <div style={{ display: "flex", gap: "8px" }}>
              {[0, 1, 2, 3].map((slot) => {
                const memberId = jobForm.crewMemberIds[slot];
                const member = memberId ? members.find(m => m.id === memberId) : null;
                return (
                  <button key={slot} onClick={() => setCrewPickerSlot(slot)} style={{ flex: 1, aspectRatio: "1", borderRadius: "10px", border: member ? "2px solid " + t.accent : "2px dashed " + t.border, background: member ? t.accentBg : t.bg, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px", fontFamily: "inherit", padding: "6px 2px" }}>
                    {member ? (
                      <>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: t.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13 }}>{member.name[0]}</div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: t.accent, textAlign: "center", lineHeight: 1.2, wordBreak: "break-word" }}>{member.name.split(" ")[0]}</div>
                      </>
                    ) : (
                      <div style={{ fontSize: 22, color: t.border, fontWeight: 300, lineHeight: 1 }}>+</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          {/* Crew picker — full-screen overlay rendered outside the form flow */}
          {crewPickerSlot !== null && (
            <div onClick={() => setCrewPickerSlot(null)} style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
              <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "16px", padding: "20px", width: "100%", maxWidth: "340px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <span style={{ fontSize: "15px", fontWeight: 700, color: t.text }}>Slot {crewPickerSlot + 1} — Pick Crew</span>
                  <button onClick={() => setCrewPickerSlot(null)} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: t.textMuted, padding: "0 4px" }}>✕</button>
                </div>
                {jobForm.crewMemberIds[crewPickerSlot] && (
                  <button onClick={() => { const ids = [...jobForm.crewMemberIds]; ids[crewPickerSlot] = null; setJobForm({ ...jobForm, crewMemberIds: ids }); setCrewPickerSlot(null); }} style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "#fef2f2", border: "1px solid #fecaca", cursor: "pointer", fontSize: 13, color: "#dc2626", fontWeight: 700, fontFamily: "inherit", marginBottom: "12px" }}>
                    ✕ Remove {members.find(m => m.id === jobForm.crewMemberIds[crewPickerSlot])?.name}
                  </button>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  {members.filter(m => !jobForm.crewMemberIds.includes(m.id)).map(m => (
                    <button key={m.id} onClick={() => { const ids = [...jobForm.crewMemberIds]; ids[crewPickerSlot] = m.id; setJobForm({ ...jobForm, crewMemberIds: ids }); setCrewPickerSlot(null); }} style={{ padding: "14px 10px", borderRadius: "10px", border: "1px solid " + t.border, background: t.bg, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: t.accentBg, color: t.accent, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>{m.name[0]}</div>
                      <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{m.name}</span>
                    </button>
                  ))}
                </div>
                {members.filter(m => !jobForm.crewMemberIds.includes(m.id)).length === 0 && (
                  <div style={{ fontSize: 13, color: t.textMuted, fontStyle: "italic", textAlign: "center", padding: "12px 0" }}>All crew members assigned</div>
                )}
              </div>
            </div>
          )}
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: t.textSecondary, marginBottom: "5px" }}>Date</label>
            <input type="date" value={jobForm.date} onChange={(e) => setJobForm({ ...jobForm, date: e.target.value })} style={{ width: "100%", padding: "9px 12px", background: "#fff", border: "1px solid " + t.border, borderRadius: "6px", color: t.text, fontSize: "14px", fontFamily: "inherit", boxSizing: "border-box" }} />
          </div>
          <TextArea label="Office Notes (visible to crew)" placeholder="Special instructions, materials needed..." value={jobForm.notes} onChange={(e) => setJobForm({ ...jobForm, notes: e.target.value })} />
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: t.textSecondary, marginBottom: "8px" }}>Job Category</label>
            <div style={{ display: "flex", gap: "16px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "14px", color: t.text }}>
                <input type="checkbox" checked={jobForm.jobCategory === "Retro"} onChange={() => setJobForm({ ...jobForm, jobCategory: jobForm.jobCategory === "Retro" ? "" : "Retro" })} style={{ width: "18px", height: "18px", accentColor: "#15803d", cursor: "pointer" }} />
                Retro
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "14px", color: t.text }}>
                <input type="checkbox" checked={jobForm.jobCategory === "New Construction"} onChange={() => setJobForm({ ...jobForm, jobCategory: jobForm.jobCategory === "New Construction" ? "" : "New Construction" })} style={{ width: "18px", height: "18px", accentColor: "#dc2626", cursor: "pointer" }} />
                New Construction
              </label>
            </div>
          </div>
          <Button onClick={handleAddJob} disabled={!jobForm.address.trim()} style={{ width: "100%" }}>Add Job to Schedule</Button>
        </Modal>
      )}

      {/* ── TRUCK UNLOAD HISTORY MODAL ── */}
      {truckHistoryView && (() => {
        const { truck: hTruck, calMonth, calYear, selectedDate } = truckHistoryView;
        const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
        const dayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
        const isFoam = (id) => ["oc_a","oc_b","cc_a","cc_b","env_oc_a","env_oc_b","env_cc_a","env_cc_b","free_env_oc_a","free_env_oc_b"].includes(id);
        const fmtQty = (itemId, qty) => isFoam(itemId) ? Math.round(qty * (["cc_a","cc_b","env_cc_a","env_cc_b"].includes(itemId) ? 50 : 48)) + " gal" : qty + " " + (INVENTORY_ITEMS.find(i => i.id === itemId)?.unit || "");
        const toCST = (ts) => new Date(ts).toLocaleDateString("en-CA", { timeZone: "America/Chicago" }); // returns YYYY-MM-DD in CST

        // Group loads, unloads, and job usage by date for this truck
        const truckLoads = (loadLog || []).filter(r => r.truckId === hTruck.id);
        const truckReturns = returnLog.filter(r => r.truckId === hTruck.id);
        // Job usage: closed-out jobs assigned to this truck with dailyMaterialLogs
        const truckJobs = jobs.filter(j => (j.crewMemberIds || []).some(mid => {
          const m = members.find(mb => mb.id === mid);
          return m && m.truckId === hTruck.id;
        }) || j.truckId === hTruck.id);

        const loadsByDate = {};
        truckLoads.forEach(r => { const d = toCST(r.timestamp); if (!loadsByDate[d]) loadsByDate[d] = []; loadsByDate[d].push(r); });
        const returnsByDate = {};
        truckReturns.forEach(r => { const d = toCST(r.timestamp); if (!returnsByDate[d]) returnsByDate[d] = []; returnsByDate[d].push(r); });
        // Daily job usage: from dailyMaterialLogs on jobs + materialsUsed on closed jobs
        const usageByDate = {};
        truckJobs.forEach(job => {
          (job.dailyMaterialLogs || []).forEach(log => {
            if (!usageByDate[log.date]) usageByDate[log.date] = [];
            usageByDate[log.date].push({ job, materials: log.materials });
          });
          if (job.closedOut && job.materialsUsed && job.closedAt) {
            const d = tsToCST(job.closedAt);
            const alreadyLogged = (job.dailyMaterialLogs || []).some(l => l.date === d);
            if (!alreadyLogged) {
              if (!usageByDate[d]) usageByDate[d] = [];
              usageByDate[d].push({ job, materials: job.materialsUsed });
            }
          }
        });

        const allActiveDates = new Set([...Object.keys(loadsByDate), ...Object.keys(returnsByDate), ...Object.keys(usageByDate)]);
        const firstDay = new Date(calYear, calMonth, 1).getDay();
        const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
        const cells = [];
        for (let i = 0; i < firstDay; i++) cells.push(null);
        for (let d = 1; d <= daysInMonth; d++) cells.push(d);
        const ds = (d) => calYear + "-" + String(calMonth+1).padStart(2,"0") + "-" + String(d).padStart(2,"0");
        const today = todayCST();

        return (
          <Modal title={(hTruck.members || hTruck.name) + " — Daily History"} onClose={() => setTruckHistoryView(null)}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <button onClick={() => setTruckHistoryView(v => { const m = v.calMonth === 0 ? 11 : v.calMonth - 1; const y = v.calMonth === 0 ? v.calYear - 1 : v.calYear; return {...v, calMonth: m, calYear: y, selectedDate: null}; })} style={{ background: "none", border: "1px solid "+t.border, borderRadius: 6, padding: "5px 11px", cursor: "pointer", color: t.text, fontSize: 15 }}>{"<"}</button>
              <div style={{ fontWeight: 700, fontSize: 15, color: t.text }}>{monthNames[calMonth]} {calYear}</div>
              <button onClick={() => setTruckHistoryView(v => { const m = v.calMonth === 11 ? 0 : v.calMonth + 1; const y = v.calMonth === 11 ? v.calYear + 1 : v.calYear; return {...v, calMonth: m, calYear: y, selectedDate: null}; })} style={{ background: "none", border: "1px solid "+t.border, borderRadius: 6, padding: "5px 11px", cursor: "pointer", color: t.text, fontSize: 15 }}>{">"}</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 4 }}>
              {dayNames.map(d => <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", padding: "3px 0" }}>{d}</div>)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3, marginBottom: 16 }}>
              {cells.map((day, idx) => {
                if (!day) return <div key={"e"+idx} />;
                const dateStr = ds(day);
                const hasActivity = allActiveDates.has(dateStr);
                const isSelected = dateStr === selectedDate;
                const isToday = dateStr === today;
                const dots = [loadsByDate[dateStr] ? "🔵" : null, usageByDate[dateStr] ? "🟠" : null, returnsByDate[dateStr] ? "🟢" : null].filter(Boolean);
                return (
                  <div key={dateStr} onClick={() => hasActivity && setTruckHistoryView(v => ({...v, selectedDate: isSelected ? null : dateStr}))}
                    style={{ minHeight: 46, borderRadius: 7, border: "1px solid " + (isSelected ? t.accent : isToday ? t.accent : t.border), background: isSelected ? t.accent : hasActivity ? "#eff6ff" : t.surface, cursor: hasActivity ? "pointer" : "default", padding: "4px 5px" }}>
                    <div style={{ fontSize: 12, fontWeight: isToday ? 700 : 500, color: isSelected ? "#fff" : isToday ? t.accent : t.text }}>{day}</div>
                    {dots.length > 0 && <div style={{ fontSize: 9, marginTop: 2 }}>{dots.join("")}</div>}
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 12, display: "flex", gap: 10 }}>
              <span>🔵 Load out</span><span>🟠 Job usage</span><span>🟢 Unload</span>
            </div>
            {selectedDate && (
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: t.text, marginBottom: 12 }}>
                  {new Date(selectedDate+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}
                </div>

                {/* LOADS */}
                {(loadsByDate[selectedDate] || []).map((load, i) => (
                  <div key={i} style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#1d4ed8", marginBottom: 6 }}>🔵 LOADED OUT — {new Date(load.timestamp).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",hour12:true,timeZone:"America/Chicago"})}</div>
                    {Object.entries(load.items || {}).map(([itemId, qty]) => {
                      const item = INVENTORY_ITEMS.find(i => i.id === itemId);
                      return item ? <div key={itemId} style={{ fontSize: 12, color: "#1e40af", marginBottom: 2 }}>{item.name} — <strong>{fmtQty(itemId, qty)}</strong></div> : null;
                    })}
                  </div>
                ))}

                {/* JOB USAGE */}
                {(usageByDate[selectedDate] || []).map((entry, i) => (
                  <div key={i} style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#c2410c", marginBottom: 4 }}>🟠 USED ON JOB</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 6 }}>{entry.job.builder || "No Customer"} — {entry.job.address}</div>
                    {Object.entries(entry.materials).map(([itemId, qty]) => {
                      const item = INVENTORY_ITEMS.find(i => i.id === itemId);
                      return item ? <div key={itemId} style={{ fontSize: 12, color: "#9a3412", marginBottom: 2 }}>{item.name} — <strong>{fmtQty(itemId, qty)}</strong></div> : null;
                    })}
                  </div>
                ))}

                {/* UNLOADS */}
                {(returnsByDate[selectedDate] || []).map((ret, i) => (
                  <div key={i} style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#15803d", marginBottom: 6 }}>🟢 UNLOADED TO WAREHOUSE — {new Date(ret.timestamp).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",hour12:true,timeZone:"America/Chicago"})}</div>
                    {Object.entries(ret.items || {}).map(([itemId, qty]) => {
                      const item = INVENTORY_ITEMS.find(i => i.id === itemId);
                      return item ? <div key={itemId} style={{ fontSize: 12, color: "#166534", marginBottom: 2 }}>{item.name} — <strong>{fmtQty(itemId, qty)}</strong></div> : null;
                    })}
                  </div>
                ))}

                {!loadsByDate[selectedDate] && !usageByDate[selectedDate] && !returnsByDate[selectedDate] && (
                  <div style={{ fontSize: 13, color: t.textMuted, fontStyle: "italic" }}>No activity recorded for this day.</div>
                )}
              </div>
            )}
            {!selectedDate && allActiveDates.size === 0 && (
              <div style={{ fontSize: 13, color: t.textMuted, fontStyle: "italic", textAlign: "center", paddingBottom: 8 }}>No activity recorded yet for this truck.</div>
            )}
          </Modal>
        );
      })()}

      {showAdminTicketForm && (
        <Modal title="New Ticket" onClose={() => setShowAdminTicketForm(false)}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 8 }}>Ticket Type</div>
            <div style={{ display: "flex", gap: 8 }}>
              {[{v:"equipment",l:"Equipment"},{v:"inventory",l:"Inventory"},{v:"timeoff",l:"Time Off"}].map(tab => (
                <button key={tab.v} onClick={() => setAdminTicketForm(f => ({...f, ticketType: tab.v}))}
                  style={{ flex: 1, padding: "8px 4px", borderRadius: 7, border: adminTicketForm.ticketType === tab.v ? "2px solid "+t.accent : "1px solid "+t.border, background: adminTicketForm.ticketType === tab.v ? t.accent : t.surface, color: adminTicketForm.ticketType === tab.v ? "#fff" : t.text, fontWeight: 600, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>{tab.l}</button>
              ))}
            </div>
          </div>
          <Select label="Crew / Truck" value={adminTicketForm.truckId} onChange={e => setAdminTicketForm(f => ({...f, truckId: e.target.value}))}
            options={[{value:"",label:"— Office / General —"}, ...sortedTrucks.map(tr => ({value: tr.id, label: tr.members || tr.name}))]} />
          <Select label="Priority" value={adminTicketForm.priority} onChange={e => setAdminTicketForm(f => ({...f, priority: e.target.value}))}
            options={TICKET_PRIORITIES.map(p => ({value: p.value, label: p.label}))} />
          <TextArea label="Description" placeholder="Describe the issue..." value={adminTicketForm.description} onChange={e => setAdminTicketForm(f => ({...f, description: e.target.value}))} />
          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <Button variant="secondary" onClick={() => setShowAdminTicketForm(false)} style={{ flex: 1 }}>Cancel</Button>
            <Button disabled={!adminTicketForm.description.trim()} onClick={() => {
              const tr = sortedTrucks.find(t => t.id === adminTicketForm.truckId);
              onSubmitTicket({ truckId: adminTicketForm.truckId || null, truckName: tr ? (tr.members || tr.name) : "Office", submittedBy: adminName, description: adminTicketForm.description, priority: adminTicketForm.priority, ticketType: adminTicketForm.ticketType, status: "open", timestamp: new Date().toISOString() });
              onLogAction("Admin submitted ticket: " + adminTicketForm.description);
              setAdminTicketForm({ truckId: "", description: "", priority: "medium", ticketType: "equipment" });
              setShowAdminTicketForm(false);
            }} style={{ flex: 1 }}>Submit</Button>
          </div>
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
          <Select label="Assign Truck" value={editForm.truckId} onChange={(e) => setEditForm({ ...editForm, truckId: e.target.value })} options={[{ value: "", label: "— Unassigned —" }, ...sortedTrucks.map((tr) => ({ value: tr.id, label: tr.members || tr.name }))]} />
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: t.textSecondary, marginBottom: "10px" }}>Assign Crew Members</label>
            <div style={{ display: "flex", gap: "8px" }}>
              {[0,1,2,3].map((slot) => {
                const memberId = editForm.crewMemberIds[slot];
                const member = memberId ? members.find(m => m.id === memberId) : null;
                return (
                  <button key={slot} onClick={() => setEditCrewPickerSlot(slot)} style={{ flex: 1, aspectRatio: "1", borderRadius: "10px", border: member ? "2px solid " + t.accent : "2px dashed " + t.border, background: member ? t.accentBg : t.bg, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px", fontFamily: "inherit", padding: "6px 2px" }}>
                    {member ? (<><div style={{ width: 28, height: 28, borderRadius: "50%", background: t.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13 }}>{member.name[0]}</div><div style={{ fontSize: 9, fontWeight: 700, color: t.accent, textAlign: "center", lineHeight: 1.2, wordBreak: "break-word" }}>{member.name.split(" ")[0]}</div></>) : (<div style={{ fontSize: 22, color: t.border, fontWeight: 300, lineHeight: 1 }}>+</div>)}
                  </button>
                );
              })}
            </div>
          </div>
          {editCrewPickerSlot !== null && (
            <div onClick={() => setEditCrewPickerSlot(null)} style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
              <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "16px", padding: "20px", width: "100%", maxWidth: "340px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <span style={{ fontSize: "15px", fontWeight: 700, color: t.text }}>Slot {editCrewPickerSlot + 1} — Pick Crew</span>
                  <button onClick={() => setEditCrewPickerSlot(null)} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: t.textMuted, padding: "0 4px" }}>✕</button>
                </div>
                {editForm.crewMemberIds[editCrewPickerSlot] && (
                  <button onClick={() => { const ids = [...editForm.crewMemberIds]; ids[editCrewPickerSlot] = null; setEditForm({ ...editForm, crewMemberIds: ids }); setEditCrewPickerSlot(null); }} style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "#fef2f2", border: "1px solid #fecaca", cursor: "pointer", fontSize: 13, color: "#dc2626", fontWeight: 700, fontFamily: "inherit", marginBottom: "12px" }}>
                    ✕ Remove {members.find(m => m.id === editForm.crewMemberIds[editCrewPickerSlot])?.name}
                  </button>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  {members.filter(m => !editForm.crewMemberIds.includes(m.id)).map(m => (
                    <button key={m.id} onClick={() => { const ids = [...editForm.crewMemberIds]; ids[editCrewPickerSlot] = m.id; setEditForm({ ...editForm, crewMemberIds: ids }); setEditCrewPickerSlot(null); }} style={{ padding: "14px 10px", borderRadius: "10px", border: "1px solid " + t.border, background: t.bg, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: t.accentBg, color: t.accent, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>{m.name[0]}</div>
                      <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{m.name}</span>
                    </button>
                  ))}
                </div>
                {members.filter(m => !editForm.crewMemberIds.includes(m.id)).length === 0 && <div style={{ fontSize: 13, color: t.textMuted, fontStyle: "italic", textAlign: "center", padding: "12px 0" }}>All crew members assigned</div>}
              </div>
            </div>
          )}
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: t.textSecondary, marginBottom: "5px" }}>Date</label>
            <input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} style={{ width: "100%", padding: "9px 12px", background: "#fff", border: "1px solid " + t.border, borderRadius: "6px", color: t.text, fontSize: "14px", fontFamily: "inherit", boxSizing: "border-box" }} />
          </div>
          <TextArea label="Office Notes (visible to crew)" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: t.textSecondary, marginBottom: "8px" }}>Job Category</label>
            <div style={{ display: "flex", gap: "16px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "14px", color: t.text }}>
                <input type="checkbox" checked={editForm.jobCategory === "Retro"} onChange={() => setEditForm({ ...editForm, jobCategory: editForm.jobCategory === "Retro" ? "" : "Retro" })} style={{ width: "18px", height: "18px", accentColor: "#15803d", cursor: "pointer" }} />
                Retro
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "14px", color: t.text }}>
                <input type="checkbox" checked={editForm.jobCategory === "New Construction"} onChange={() => setEditForm({ ...editForm, jobCategory: editForm.jobCategory === "New Construction" ? "" : "New Construction" })} style={{ width: "18px", height: "18px", accentColor: "#dc2626", cursor: "pointer" }} />
                New Construction
              </label>
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
            <Button variant="secondary" onClick={() => setEditingJob(null)} style={{ flex: 1 }}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={!editForm.address.trim()} style={{ flex: 1 }}>Save Changes</Button>
          </div>
        </Modal>
      )}

      {pmJob && (
        <Modal title="Project Manager Update" onClose={() => { setPmJob(null); setPmNote(""); setPmCheckedAM("No"); setPmCheckedPM("No"); }}>
          <div style={{ fontSize: "13.5px", color: t.textMuted, marginBottom: "12px" }}><strong style={{ color: t.text }}>{pmJob.builder || "No Customer"}</strong><br />{pmJob.address} — {pmJob.type}</div>
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "12px 14px", marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e", marginBottom: 6 }}>Location Verification Required</div>
            <div style={{ fontSize: 12, color: "#78350f", lineHeight: 1.6 }}>
              When you tap <strong>Submit</strong>, your browser will ask permission to share your location. <strong>You must tap Allow</strong> — this verifies you were on site.
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: "#92400e", lineHeight: 1.7 }}>
              <strong>If you accidentally denied location:</strong><br />
              <strong>Chrome:</strong> Tap the lock icon in the address bar → Permissions → Location → Allow<br />
              <strong>Samsung Internet:</strong> Tap the lock icon → Location → Allow<br />
              <strong>Either browser:</strong> Go to phone Settings → Apps → Chrome (or Samsung Internet) → Permissions → Location → Allow
            </div>
          </div>
          <TextArea label="Your update" placeholder="Add notes, instructions, status info for this job..." value={pmNote} onChange={(e) => setPmNote(e.target.value)} style={{ minHeight: "100px" }} />
          <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: t.textSecondary, marginBottom: "5px" }}>Job Checked</label>
          <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
            <div style={{ flex: 1 }}>
              <Select label="AM" value={pmCheckedAM} onChange={(e) => setPmCheckedAM(e.target.value)} options={[{ value: "No", label: "No" }, { value: "Yes", label: "Yes" }]} />
            </div>
            <div style={{ flex: 1 }}>
              <Select label="PM" value={pmCheckedPM} onChange={(e) => setPmCheckedPM(e.target.value)} options={[{ value: "No", label: "No" }, { value: "Yes", label: "Yes" }]} />
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
            <Button variant="secondary" onClick={() => { setPmJob(null); setPmNote(""); setPmCheckedAM("No"); setPmCheckedPM("No"); }} style={{ flex: 1 }}>Cancel</Button>
            <Button onClick={handlePmSubmit} style={{ flex: 1 }}>Submit</Button>
          </div>
        </Modal>
      )}

      {calDayView && (() => {
        const typeConfig = {
          "Foam":       { color: "#f97316", bg: "#fff7ed", border: "#fed7aa", emoji: "" },
          "Fiberglass": { color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe", emoji: "" },
          "Removal":    { color: "#8b5cf6", bg: "#f5f3ff", border: "#ddd6fe", emoji: "" },
        };
        const grouped = {};
        calDayView.jobs.forEach(j => {
          const type = j.type || "Other";
          if (!grouped[type]) grouped[type] = [];
          grouped[type].push(j);
        });
        const typeOrder = ["Foam", "Fiberglass", "Removal"];
        const sortedTypes = [...typeOrder.filter(t => grouped[t]), ...Object.keys(grouped).filter(t => !typeOrder.includes(t))];
        const dayLabel = new Date(calDayView.dateStr + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
        return (
          <Modal title={dayLabel} onClose={() => setCalDayView(null)}>
            {sortedTypes.map(type => {
              const cfg = typeConfig[type] || { color: t.accent, bg: t.bg, border: t.border, emoji: "" };
              return (
                <div key={type} style={{ marginBottom: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 10px", borderRadius: "8px", background: cfg.bg, border: `1px solid ${cfg.border}`, marginBottom: "8px" }}>
                    <span style={{ fontSize: "14px" }}>{cfg.emoji}</span>
                    <span style={{ fontSize: "13px", fontWeight: 800, color: cfg.color }}>{type}</span>
                    <span style={{ marginLeft: "auto", fontSize: "11px", fontWeight: 700, color: cfg.color, background: cfg.border, padding: "2px 8px", borderRadius: "10px" }}>{grouped[type].length} job{grouped[type].length !== 1 ? "s" : ""}</span>
                  </div>
                  {grouped[type].map(j => {
                    const lat = updates.filter(u => u.jobId === j.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
                    const statusObj = lat ? STATUS_OPTIONS.find(s => s.value === lat.status) : STATUS_OPTIONS[0];
                    const assignedNames = (j.crewMemberIds || []).filter(Boolean).map(id => members.find(m => m.id === id)?.name).filter(Boolean);
                    const truck = trucks.find(tr => tr.id === j.truckId);
                    return (
                      <div key={j.id} onClick={() => { setCalViewJob(j); setCalDayView(null); }} style={{ padding: "10px 12px", borderRadius: "8px", background: "#fff", border: "1px solid " + t.border, marginBottom: "6px", cursor: "pointer", borderLeft: `3px solid ${cfg.color}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: "13px", color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{j.builder || "No Customer"}</div>
                            <div style={{ fontSize: "11px", color: t.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{j.address}</div>
                            {assignedNames.length > 0 && <div style={{ fontSize: "11px", color: t.accent, fontWeight: 600, marginTop: "2px" }}>{assignedNames.join(", ")}</div>}
                            {truck && <div style={{ fontSize: "10px", color: t.textMuted }}>{truck.members || truck.name}</div>}
                          </div>
                          <div style={{ flexShrink: 0, textAlign: "right" }}>
                            {j.jobCategory && <div style={{ fontSize: "10px", fontWeight: 700, color: j.jobCategory === "Retro" ? "#15803d" : "#dc2626" }}>{j.jobCategory}</div>}
                            <div style={{ fontSize: "11px", fontWeight: 600, color: statusObj?.color || t.textMuted }}>{statusObj?.label || "Not Started"}</div>
                            <div style={{ fontSize: "10px", color: t.textMuted }}>AM: {j.jobCheckedAM || "No"} · PM: {j.jobCheckedPM || "No"}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
            <Button variant="secondary" onClick={() => setCalDayView(null)} style={{ width: "100%", marginTop: "4px" }}>Close</Button>
          </Modal>
        );
      })()}

      {calViewJob && (() => {
        const crew = trucks.find((tr) => tr.id === calViewJob.truckId);
        const jobPm = pmUpdates.filter((p) => p.jobId === calViewJob.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const jobCrew = updates.filter((u) => u.jobId === calViewJob.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const latestStatus = jobCrew.length > 0 ? jobCrew[0].status : "not_started";
        const statusObj = STATUS_OPTIONS.find((s) => s.value === latestStatus);
        return (
          <Modal title="Job Details" onClose={() => setCalViewJob(null)}>
            <div style={{ marginBottom: "18px" }}>
              <div style={{ fontWeight: 600, color: t.text, fontSize: "17px" }}>{calViewJob.builder || "No Customer Listed"}</div>
              <div style={{ fontSize: "13.5px", color: t.textMuted, marginTop: "3px" }}>{calViewJob.address}</div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "8px", flexWrap: "wrap" }}>
                <Badge color={statusObj.color} bg={statusObj.bg}>{statusObj.label}</Badge>
                <span style={{ fontSize: "12.5px", color: t.textMuted }}>{calViewJob.type}</span>
                {calViewJob.jobCategory && <span style={{ fontSize: "12.5px", fontWeight: 600, color: calViewJob.jobCategory === "Retro" ? "#15803d" : "#dc2626" }}>{calViewJob.jobCategory}</span>}
                <span style={{ fontSize: "12.5px", color: t.textMuted }}>{new Date(calViewJob.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
              </div>
              {(() => {
                // Show crew who actually submitted updates; fall back to assigned crewMemberIds
                const updaterNames = [...new Set(jobCrew.map(u => u.submittedBy).filter(Boolean))];
                const assignedNames = (calViewJob.crewMemberIds || []).filter(Boolean).map(id => members.find(m => m.id === id)?.name).filter(Boolean);
                const crewNames = updaterNames.length > 0 ? updaterNames : assignedNames;
                return crewNames.length > 0 ? (
                  <div style={{ fontSize: "12.5px", color: t.textMuted, marginTop: "6px" }}>Crew: {crewNames.join(" and ")}</div>
                ) : null;
              })()}
              {calViewJob.notes && <div style={{ fontSize: "13px", color: t.textSecondary, background: t.bg, padding: "10px 12px", borderRadius: "6px", marginTop: "10px", borderLeft: "3px solid " + t.accent }}>Office: {calViewJob.notes}</div>}
            </div>

            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px", paddingBottom: "6px", borderBottom: "1px solid " + t.borderLight }}>Project Manager Updates</div>
              <div style={{ fontSize: "12.5px", marginBottom: "8px" }}>
                <div style={{ fontWeight: 600, color: "#dc2626", marginBottom: "4px" }}>Job Checked</div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ fontWeight: 600, color: t.textSecondary }}>AM:</span><span style={{ fontWeight: 600, color: calViewJob.jobCheckedAM === "Yes" ? "#15803d" : t.textMuted }}>{calViewJob.jobCheckedAM || "No"}</span></span>
                  <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ fontWeight: 600, color: t.textSecondary }}>PM:</span><span style={{ fontWeight: 600, color: calViewJob.jobCheckedPM === "Yes" ? "#15803d" : t.textMuted }}>{calViewJob.jobCheckedPM || "No"}</span></span>
                </div>
              </div>
              {jobPm.length === 0 ? <div style={{ fontSize: "12.5px", color: t.textMuted }}>No PM notes.</div> : jobPm.map((p) => (
                <div key={p.id} style={{ fontSize: "12.5px", padding: "6px 0", borderBottom: "1px solid " + t.borderLight, color: t.textSecondary }}>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <span style={{ color: t.textMuted }}>{p.timeStr}</span>
                    <strong style={{ color: t.text }}>{p.user}</strong>
                  </div>
                  <div style={{ marginTop: "3px", color: t.text }}>{p.note}</div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "12px", fontWeight: 600, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px", paddingBottom: "6px", borderBottom: "1px solid " + t.borderLight }}>Crew Updates</div>
              {jobCrew.length === 0 ? <div style={{ fontSize: "12.5px", color: t.textMuted }}>No crew updates.</div> : jobCrew.map((u) => {
                const uStatus = STATUS_OPTIONS.find((s) => s.value === u.status);
                return (
                  <div key={u.id} style={{ fontSize: "12.5px", padding: "6px 0", borderBottom: "1px solid " + t.borderLight, color: t.textSecondary }}>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ color: t.textMuted }}>{u.timeStr}</span>
                      <strong style={{ color: t.text }}>{u.crewName}</strong>
                      <Badge color={uStatus?.color} bg={uStatus?.bg}>{uStatus?.label}</Badge>
                      {u.eta && <span>— ETA: {u.eta}</span>}
                    </div>
                    {u.notes && <div style={{ marginTop: "3px", color: t.textMuted }}>{u.notes}</div>}
                  </div>
                );
              })}
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, display: "block", marginBottom: 4 }}>Move Job Date</label>
              <input type="date" defaultValue={calViewJob.date} onChange={async (e) => { if (e.target.value) { await onEditJob(calViewJob.id, { ...calViewJob, date: e.target.value }); setCalViewJob(null); }}} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid " + t.border, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <Button variant="secondary" onClick={() => setCalViewJob(null)} style={{ flex: 1 }}>Close</Button>
              <Button onClick={() => { setPmJob(calViewJob); setPmCheckedAM(calViewJob.jobCheckedAM || "No"); setPmCheckedPM(calViewJob.jobCheckedPM || "No"); setCalViewJob(null); }} style={{ flex: 1 }}>PM Note</Button>
              <Button onClick={() => { openEditJob(calViewJob); setCalViewJob(null); }} style={{ flex: 1 }}>Edit</Button>
              <Button variant="secondary" onClick={async () => { await onEditJob(calViewJob.id, { ...calViewJob, onHold: true }); setCalViewJob(null); }} style={{ flex: 1 }}>Hold</Button>
              <Button variant="danger" onClick={async () => { if (confirm("Delete this job?")) { await onDeleteJob(calViewJob.id); setCalViewJob(null); }}} style={{ flex: 1 }}>Delete</Button>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
// ─── Main App ───
export default function App() {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);
  const [launcherDismissed, setLauncherDismissed] = useState(false);
  const [crewSession, setCrewSession] = useState(null);
  const [adminName, setAdminName] = useState(null);
  const [trucks, setTrucks] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  const [returnLog, setReturnLog] = useState([]);
  const [loadLog, setLoadLog] = useState([]);
  const [pmUpdates, setPmUpdates] = useState([]);
  const [members, setMembers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [truckInventory, setTruckInventory] = useState({});

  useEffect(() => {
    const unsubTrucks = onSnapshot(collection(db, "trucks"), (snap) => { setTrucks(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); });
    const unsubJobs = onSnapshot(collection(db, "jobs"), (snap) => { setJobs(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); });
    const unsubUpdates = onSnapshot(collection(db, "updates"), (snap) => { setUpdates(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); });
    const unsubTickets = onSnapshot(collection(db, "tickets"), (snap) => { setTickets(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false); });
    const unsubLog = onSnapshot(collection(db, "activityLog"), (snap) => { setActivityLog(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); });
    const unsubPm = onSnapshot(collection(db, "pmUpdates"), (snap) => { setPmUpdates(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); });
    const unsubMembers = onSnapshot(collection(db, "crewMembers"), (snap) => { setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); });
    const unsubInv = onSnapshot(collection(db, "inventory"), (snap) => { setInventory(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); });
    const unsubTruckInv = onSnapshot(collection(db, "truckInventory"), (snap) => { const m = {}; snap.docs.forEach(d => { m[d.id] = d.data(); }); setTruckInventory(m); });
    const unsubReturnLog = onSnapshot(collection(db, "returnLog"), (snap) => { setReturnLog(snap.docs.map(d => ({ id: d.id, ...d.data() }))); });
    const unsubLoadLog = onSnapshot(collection(db, "loadLog"), (snap) => { setLoadLog(snap.docs.map(d => ({ id: d.id, ...d.data() }))); });
    return () => { unsubTrucks(); unsubJobs(); unsubUpdates(); unsubTickets(); unsubLog(); unsubPm(); unsubMembers(); unsubInv(); unsubTruckInv(); unsubReturnLog(); };
  }, []);

  const handleAddTruck = async (data) => { await addDoc(collection(db, "trucks"), data); };
  const handleDeleteTruck = async (id) => { await deleteDoc(doc(db, "trucks", id)); };
  const handleReorderTruck = async (id, newOrder) => { await updateDoc(doc(db, "trucks", id), { order: newOrder }); };
  const handleAddJob = async (data) => { await addDoc(collection(db, "jobs"), data); };
  const handleDeleteJob = async (id) => {
    await deleteDoc(doc(db, "jobs", id));
    const updatesSnap = await getDocs(query(collection(db, "updates"), where("jobId", "==", id)));
    updatesSnap.forEach(async (d) => { await deleteDoc(doc(db, "updates", d.id)); });
    const pmSnap = await getDocs(query(collection(db, "pmUpdates"), where("jobId", "==", id)));
    pmSnap.forEach(async (d) => { await deleteDoc(doc(db, "pmUpdates", d.id)); });
  };
  const handleSubmitUpdate = async (data) => { await addDoc(collection(db, "updates"), { ...data, createdAt: serverTimestamp() }); };
  const handleEditJob = async (id, data) => { await updateDoc(doc(db, "jobs", id), data); };
  const handleSubmitTicket = async (data) => { await addDoc(collection(db, "tickets"), { ...data, createdAt: serverTimestamp() }); };
  const handleUpdateTicket = async (id, data) => { await updateDoc(doc(db, "tickets", id), data); };
  const handleLogAction = async (action) => { await addDoc(collection(db, "activityLog"), { user: adminName, action, timestamp: new Date().toISOString(), createdAt: serverTimestamp() }); };
  const handleSubmitPmUpdate = async (data) => { await addDoc(collection(db, "pmUpdates"), { ...data, createdAt: serverTimestamp() }); };
  const handleUpdateInventory = async (itemId, qty) => {
    const existing = inventory.find(r => r.itemId === itemId);
    if (existing) { await updateDoc(doc(db, "inventory", existing.id), { qty }); }
    else { await addDoc(collection(db, "inventory"), { itemId, qty, updatedAt: new Date().toISOString() }); }
  };
  // Deduct job materials from truck. usedMap = { itemId: qty } (tubes and loose pcs as entered by crew).
  // Reads fresh from Firestore, computes remaining, writes back.
  const handleDeductFromTruck = async (truckId, usedMap) => {
    if (!truckId || !usedMap || Object.keys(usedMap).length === 0) return;
    const truckRef = doc(db, "truckInventory", truckId);
    const snap = await getDoc(truckRef);
    const state = snap.exists() ? { ...snap.data() } : {};
    // Process each tube item that was used
    INVENTORY_ITEMS.filter(i => !i.isPieces).forEach(item => {
      const used = parseFloat(usedMap[item.id]) || 0;
      if (item.pcsPerTube) {
        // For tube items: convert everything to pieces, deduct, convert back
        const pcsItem = INVENTORY_ITEMS.find(p => p.parentId === item.id);
        const usedLoose = pcsItem ? (parseFloat(usedMap[pcsItem.id]) || 0) : 0;
        if (used === 0 && usedLoose === 0) return; // nothing used for this item
        const curTubes = state[item.id] || 0;
        const curLoose = pcsItem ? (state[pcsItem.id] || 0) : 0;
        const totalPcsOnTruck = curTubes * item.pcsPerTube + curLoose;
        const totalPcsUsed = used * item.pcsPerTube + usedLoose;
        const remaining = Math.max(0, totalPcsOnTruck - totalPcsUsed);
        const newTubes = Math.floor(remaining / item.pcsPerTube);
        const newLoose = remaining % item.pcsPerTube;
        if (newTubes > 0) { state[item.id] = newTubes; } else { delete state[item.id]; }
        if (pcsItem) {
          if (newLoose > 0) { state[pcsItem.id] = newLoose; } else { delete state[pcsItem.id]; }
        }
      } else {
        if (used === 0) return;
        // Simple item (bags, foam already converted to barrels)
        const cur = state[item.id] || 0;
        const remaining = Math.max(0, Math.round((cur - used) * 100) / 100);
        if (remaining > 0) { state[item.id] = remaining; } else { delete state[item.id]; }
      }
    });
    await setDoc(truckRef, state);
  };
  // Adjust truck inventory by delta between old and new used quantities.
  // Positive delta (used more) deducts from truck; negative (used less) adds back.
  const handleDeltaAdjustTruck = async (truckId, oldUsed, newUsed) => {
    if (!truckId) return;
    const truckRef = doc(db, "truckInventory", truckId);
    const snap = await getDoc(truckRef);
    const state = snap.exists() ? { ...snap.data() } : {};
    INVENTORY_ITEMS.filter(i => !i.isPieces).forEach(item => {
      const pcsItem = INVENTORY_ITEMS.find(p => p.parentId === item.id);
      const oldTubes = parseFloat(oldUsed[item.id]) || 0;
      const newTubes = parseFloat(newUsed[item.id]) || 0;
      const oldLoose = pcsItem ? (parseFloat(oldUsed[pcsItem.id]) || 0) : 0;
      const newLoose = pcsItem ? (parseFloat(newUsed[pcsItem.id]) || 0) : 0;
      if (item.pcsPerTube) {
        const delta = (newTubes * item.pcsPerTube + newLoose) - (oldTubes * item.pcsPerTube + oldLoose);
        if (delta === 0) return;
        const curTubes = state[item.id] || 0;
        const curLoose = pcsItem ? (state[pcsItem.id] || 0) : 0;
        const remaining = Math.max(0, curTubes * item.pcsPerTube + curLoose - delta);
        const newT = Math.floor(remaining / item.pcsPerTube);
        const newL = remaining % item.pcsPerTube;
        if (newT > 0) { state[item.id] = newT; } else { delete state[item.id]; }
        if (pcsItem) { if (newL > 0) { state[pcsItem.id] = newL; } else { delete state[pcsItem.id]; } }
      } else {
        const delta = newTubes - oldTubes;
        if (delta === 0) return;
        const cur = state[item.id] || 0;
        const remaining = Math.max(0, Math.round((cur - delta) * 100) / 100);
        if (remaining > 0) { state[item.id] = remaining; } else { delete state[item.id]; }
      }
    });
    await setDoc(truckRef, state);
  };
  const handleReturnMaterial = async (materials, truckId, returnMode = "unload") => {
    if (!truckId) return;
    const truckRef = doc(db, "truckInventory", truckId);
    // Add stillHave quantities back to warehouse
    const logItems = {};
    for (const m of materials) {
      const stillHave = m.stillHave || 0;
      if (stillHave > 0) {
        const rec = inventory.find(r => r.itemId === m.itemId);
        const current = rec?.qty || 0;
        await handleUpdateInventory(m.itemId, Math.round((current + stillHave) * 100) / 100);
        logItems[m.itemId] = stillHave;
      }
    }
    if (Object.keys(logItems).length > 0) {
      await addDoc(collection(db, "returnLog"), { truckId, items: logItems, timestamp: new Date().toISOString() });
    }
    await setDoc(truckRef, {});
  };
  const handleCloseOutJob = async (jobId, materialsUsed) => {
    if (jobId) await updateDoc(doc(db, "jobs", jobId), { closedOut: true, materialsUsed: materialsUsed || null, closedAt: new Date().toISOString() });
  };
  const handleSaveJobMaterials = async (jobId, materialsUsed) => {
    if (jobId) await updateDoc(doc(db, "jobs", jobId), { materialsUsed: materialsUsed || null });
  };
  const handleLogDailyMaterials = async (jobId, entry, upsert = false) => {
    if (!jobId) return;
    const jobRef = doc(db, "jobs", jobId);
    const snap = await getDoc(jobRef);
    const existing = snap.exists() ? (snap.data().dailyMaterialLogs || []) : [];
    const updated = upsert
      ? [...existing.filter(e => e.date !== entry.date), entry]
      : [...existing, entry];
    await updateDoc(jobRef, { dailyMaterialLogs: updated });
  };
  const handleLoadTruck = async (itemsLoaded, truckId) => {
    const truckRef = doc(db, "truckInventory", truckId);
    const updatedTruck = {};
    const logItems = {};
    for (const m of itemsLoaded) {
      if (m.qty > 0) {
        const rec = inventory.find(r => r.itemId === m.itemId);
        const current = rec?.qty || 0;
        await handleUpdateInventory(m.itemId, Math.max(0, current - m.qty));
        updatedTruck[m.itemId] = m.qty;
        logItems[m.itemId] = m.qty;
      }
    }
    await setDoc(truckRef, updatedTruck);
    if (Object.keys(logItems).length > 0) {
      await addDoc(collection(db, "loadLog"), { truckId, items: logItems, timestamp: new Date().toISOString() });
    }
  };
  const handleCrewLogin = (member, truck) => {
    setCrewSession({ memberId: member.id, crewName: member.name, truckId: truck?.id || null });
    setRole("crew");
  };
  const handleAdminLogin = (name) => { setAdminName(name); setRole("admin"); addDoc(collection(db, "activityLog"), { user: name, action: "Signed in", timestamp: new Date().toISOString(), createdAt: serverTimestamp() }); };

  const isAuthScreen = !role || (role === "admin" && !adminName) || (role === "crew" && !crewSession) || (role === "admin" && ["Johnny","Skip","Jordan"].includes(adminName) && !launcherDismissed);

  if (isAuthScreen) {
    let screen;
    if (!role) screen = <RoleSelect key="role-select" onSelect={setRole} />;
    else if (role === "admin" && !adminName) screen = <AdminLogin key="admin-login" onLogin={handleAdminLogin} onBack={() => setRole(null)} />;
    else if (role === "crew" && !crewSession) screen = <CrewLogin key="crew-login" trucks={trucks} onLogin={handleCrewLogin} onBack={() => setRole(null)} />;
    else screen = null; // launcher handled below inside this block
    if (screen) return (
      <div style={{ position: "fixed", inset: 0, overflow: "hidden" }}>
        <style>{kbStyles}</style>
        <img className="kb-img" src="/tulsa.jpg" alt="" />
        <div className="kb-overlay" />
        {screen}
      </div>
    );
  }

  if (role === "crew" && crewSession) {
    const truck = trucks.find((tr) => tr.id === crewSession.truckId) || null;
    if (!truck) return (
      <div style={{ minHeight: "100dvh", background: t.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", fontFamily: "inherit" }}>
        <div style={{ maxWidth: 360, textAlign: "center" }}>
          
          <div style={{ fontSize: 20, fontWeight: 700, color: t.text, marginBottom: 8 }}>Not Assigned to a Truck</div>
          <div style={{ fontSize: 14, color: t.textMuted, marginBottom: 24 }}>Ask the office to assign you to a crew in the Roster tab.</div>
          <button onClick={() => { setCrewSession(null); setRole(null); }} style={{ background: "none", border: "1px solid " + t.border, color: t.textMuted, padding: "10px 20px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 14 }}>← Back</button>
        </div>
      </div>
    );
    return <CrewDashboard truck={truck} crewName={crewSession.crewName} crewMemberId={crewSession.memberId} jobs={jobs} updates={updates} tickets={tickets} inventory={inventory} truckInventory={truckInventory[truck?.id] || {}} onSubmitUpdate={handleSubmitUpdate} onSubmitTicket={handleSubmitTicket} onCloseOutJob={handleCloseOutJob} onSaveJobMaterials={handleSaveJobMaterials} onLoadTruck={handleLoadTruck} onReturnMaterial={handleReturnMaterial} onDeductFromTruck={handleDeductFromTruck} onDeltaAdjustTruck={handleDeltaAdjustTruck} onLogDailyMaterials={handleLogDailyMaterials} onLogout={() => { setCrewSession(null); setRole(null); }} />;
  }
  if (role === "admin" && ["Johnny","Skip","Jordan"].includes(adminName) && !launcherDismissed) return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden" }}>
      <style>{kbStyles}</style>
      <img className="kb-img" src="/tulsa.jpg" alt="" />
      <div className="kb-overlay" />
      <AuthShell centered>
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "3px", textTransform: "uppercase", color: "rgba(255,255,255,0.6)" }}>IST Operations</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginTop: 8 }}>Where to, {adminName}?</div>
        <div style={{ width: 40, height: 2, background: t.accent, margin: "12px auto 0", borderRadius: 1 }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <button onClick={() => setLauncherDismissed(true)} className="kb-card" style={{ padding: "20px 24px", borderRadius: 14, border: "none", color: "#fff", fontWeight: 700, fontSize: 17, cursor: "pointer", fontFamily: "inherit", textAlign: "left", width: "100%" }}>
          Dispatch
          <div style={{ fontSize: 12, fontWeight: 400, opacity: 0.75, marginTop: 4 }}>Manage crews, jobs &amp; schedule</div>
        </button>
        <a href="https://isttakeoff.com" className="kb-card" style={{ padding: "20px 24px", borderRadius: 14, color: "#fff", fontWeight: 700, fontSize: 17, cursor: "pointer", fontFamily: "inherit", textAlign: "left", textDecoration: "none", display: "block" }}>
          Quote Builder
          <div style={{ fontSize: 12, fontWeight: 400, opacity: 0.75, marginTop: 4 }}>Build and send customer quotes</div>
        </a>
        <a href="https://istintel.com" className="kb-card" style={{ padding: "20px 24px", borderRadius: 14, color: "#fff", fontWeight: 700, fontSize: 17, cursor: "pointer", fontFamily: "inherit", textAlign: "left", textDecoration: "none", display: "block" }}>
          IST Intel
          <div style={{ fontSize: 12, fontWeight: 400, opacity: 0.75, marginTop: 4 }}>Permits and intelligence</div>
        </a>
      </div>
      <button onClick={() => { setAdminName(null); setRole(null); setLauncherDismissed(false); }} style={{ marginTop: 24, background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer", fontFamily: "inherit", width: "100%" }}>Sign Out</button>
    </AuthShell>
    </div>
  );
  if (role === "admin") return <AdminDashboard adminName={adminName} trucks={trucks} jobs={jobs} updates={updates} tickets={tickets} activityLog={activityLog} pmUpdates={pmUpdates} members={members} inventory={inventory} truckInventory={truckInventory} returnLog={returnLog} loadLog={loadLog} onAddTruck={handleAddTruck} onDeleteTruck={handleDeleteTruck} onReorderTruck={handleReorderTruck} onAddJob={handleAddJob} onEditJob={handleEditJob} onDeleteJob={handleDeleteJob} onUpdateTicket={handleUpdateTicket} onSubmitTicket={handleSubmitTicket} onLogAction={handleLogAction} onSubmitPmUpdate={handleSubmitPmUpdate} onUpdateInventory={handleUpdateInventory} onLogout={() => { setAdminName(null); setRole(null); setLauncherDismissed(false); }} />;
  return null;
}
