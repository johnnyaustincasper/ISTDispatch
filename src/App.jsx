import { useState, useEffect } from "react";
import { db } from "./firebase.js";
import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

// ─── Constants ───
const JOB_TYPES = [
  "Attic Removal",
  "Attic Recap",
  "New Construction",
  "Retrofit Wall Injection",
  "Crawl Space",
  "Commercial",
  "Spray Foam",
  "Batt Insulation",
];

const STATUS_OPTIONS = [
  { value: "not_started", label: "Not Started", color: "#64748b", bg: "#f1f5f9" },
  { value: "en_route", label: "En Route", color: "#2563eb", bg: "#dbeafe" },
  { value: "in_progress", label: "In Progress", color: "#d97706", bg: "#fef3c7" },
  { value: "wrapping_up", label: "Wrapping Up", color: "#7c3aed", bg: "#ede9fe" },
  { value: "completed", label: "Completed", color: "#16a34a", bg: "#dcfce7" },
  { value: "issue", label: "Issue / Need Help", color: "#dc2626", bg: "#fee2e2" },
];

const TICKET_PRIORITIES = [
  { value: "low", label: "Low — Can Wait", color: "#3b82f6", bg: "#dbeafe" },
  { value: "medium", label: "Medium — Needs Attention", color: "#f59e0b", bg: "#fef3c7" },
  { value: "high", label: "High — Affecting Work", color: "#ef4444", bg: "#fee2e2" },
  { value: "critical", label: "Critical — Truck Down", color: "#dc2626", bg: "#fecaca" },
];

const TICKET_STATUSES = [
  { value: "open", label: "Open", color: "#ef4444", bg: "#fee2e2" },
  { value: "acknowledged", label: "Acknowledged", color: "#f59e0b", bg: "#fef3c7" },
  { value: "in_repair", label: "In Repair", color: "#7c3aed", bg: "#ede9fe" },
  { value: "resolved", label: "Resolved", color: "#16a34a", bg: "#dcfce7" },
];

const todayStr = () => new Date().toISOString().split("T")[0];
const timeStr = () =>
  new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const dateStr = (iso) => {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch { return ""; }
};

const theme = {
  bg: "#0f1419",
  surface: "#1a2029",
  surfaceHover: "#222d3a",
  card: "#1e2a36",
  border: "#2a3a4a",
  accent: "#f59e0b",
  text: "#e2e8f0",
  textMuted: "#94a3b8",
  textDim: "#64748b",
  danger: "#ef4444",
  success: "#22c55e",
};

// ─── Reusable Components ───
function Badge({ children, color, bg }) {
  return (
    <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: "4px", fontSize: "11px", fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase", color: color || theme.accent, background: bg || "rgba(245,158,11,0.15)" }}>
      {children}
    </span>
  );
}

function Button({ children, onClick, variant = "primary", style: s, disabled }) {
  const base = { padding: "10px 20px", border: "none", borderRadius: "6px", fontWeight: 600, fontSize: "14px", cursor: disabled ? "not-allowed" : "pointer", transition: "all 0.15s ease", opacity: disabled ? 0.5 : 1, letterSpacing: "0.3px", fontFamily: "inherit" };
  const variants = {
    primary: { background: theme.accent, color: "#000" },
    secondary: { background: theme.surfaceHover, color: theme.text, border: "1px solid " + theme.border },
    danger: { background: "rgba(239,68,68,0.15)", color: theme.danger, border: "1px solid rgba(239,68,68,0.3)" },
    ghost: { background: "transparent", color: theme.textMuted, padding: "8px 12px" },
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...s }}>{children}</button>;
}

function Input({ label, ...props }) {
  return (
    <div style={{ marginBottom: "14px" }}>
      {label && <label style={{ display: "block", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px", color: theme.textMuted, marginBottom: "6px" }}>{label}</label>}
      <input {...props} style={{ width: "100%", padding: "10px 14px", background: theme.bg, border: "1px solid " + theme.border, borderRadius: "6px", color: theme.text, fontSize: "14px", fontFamily: "inherit", outline: "none", boxSizing: "border-box", ...(props.style || {}) }} />
    </div>
  );
}

function Select({ label, options, ...props }) {
  return (
    <div style={{ marginBottom: "14px" }}>
      {label && <label style={{ display: "block", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px", color: theme.textMuted, marginBottom: "6px" }}>{label}</label>}
      <select {...props} style={{ width: "100%", padding: "10px 14px", background: theme.bg, border: "1px solid " + theme.border, borderRadius: "6px", color: theme.text, fontSize: "14px", fontFamily: "inherit", outline: "none", boxSizing: "border-box", ...(props.style || {}) }}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function TextArea({ label, ...props }) {
  return (
    <div style={{ marginBottom: "14px" }}>
      {label && <label style={{ display: "block", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px", color: theme.textMuted, marginBottom: "6px" }}>{label}</label>}
      <textarea {...props} style={{ width: "100%", padding: "10px 14px", background: theme.bg, border: "1px solid " + theme.border, borderRadius: "6px", color: theme.text, fontSize: "14px", fontFamily: "inherit", outline: "none", resize: "vertical", minHeight: "80px", boxSizing: "border-box", ...(props.style || {}) }} />
    </div>
  );
}

function Card({ children, style: s, onClick }) {
  return (
    <div onClick={onClick} style={{ background: theme.card, border: "1px solid " + theme.border, borderRadius: "8px", padding: "18px", marginBottom: "12px", cursor: onClick ? "pointer" : "default", transition: "border-color 0.15s ease", ...s }}
      onMouseEnter={(e) => onClick && (e.currentTarget.style.borderColor = theme.accent)}
      onMouseLeave={(e) => onClick && (e.currentTarget.style.borderColor = theme.border)}>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }} onClick={onClose}>
      <div style={{ background: theme.surface, border: "1px solid " + theme.border, borderRadius: "12px", padding: "28px", maxWidth: "500px", width: "100%", maxHeight: "85vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: "22px", fontWeight: 600, color: theme.text, margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: theme.textMuted, fontSize: "24px", cursor: "pointer" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Role Selection ───
function RoleSelect({ onSelect }) {
  return (
    <div style={{ minHeight: "100vh", background: theme.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
      <div style={{ textAlign: "center", marginBottom: "48px" }}>
        <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: "42px", fontWeight: 700, color: theme.accent, letterSpacing: "3px" }}>IST</div>
        <div style={{ fontSize: "13px", color: theme.textMuted, letterSpacing: "3px", textTransform: "uppercase", marginTop: "6px" }}>Insulation Services of Tulsa</div>
        <div style={{ width: "60px", height: "3px", background: theme.accent, margin: "18px auto 0", borderRadius: "2px" }} />
      </div>
      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", justifyContent: "center", maxWidth: "500px" }}>
        <Card onClick={() => onSelect("admin")} style={{ flex: "1 1 200px", textAlign: "center", padding: "32px 24px", cursor: "pointer" }}>
          <div style={{ fontSize: "36px", marginBottom: "12px" }}>📋</div>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: "20px", fontWeight: 600, color: theme.text }}>OFFICE</div>
          <div style={{ fontSize: "13px", color: theme.textMuted, marginTop: "6px" }}>Schedule jobs & manage crews</div>
        </Card>
        <Card onClick={() => onSelect("crew")} style={{ flex: "1 1 200px", textAlign: "center", padding: "32px 24px", cursor: "pointer" }}>
          <div style={{ fontSize: "36px", marginBottom: "12px" }}>🚛</div>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: "20px", fontWeight: 600, color: theme.text }}>FIELD CREW</div>
          <div style={{ fontSize: "13px", color: theme.textMuted, marginTop: "6px" }}>View jobs & send updates</div>
        </Card>
      </div>
    </div>
  );
}

// ─── Crew Login ───
function CrewLogin({ trucks, onLogin, onBack }) {
  const [selected, setSelected] = useState("");
  const [crewName, setCrewName] = useState("");
  return (
    <div style={{ minHeight: "100vh", background: theme.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
      <div style={{ maxWidth: "400px", width: "100%" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: theme.textMuted, fontSize: "14px", cursor: "pointer", marginBottom: "24px", padding: 0, fontFamily: "inherit" }}>← Back</button>
        <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: "28px", fontWeight: 700, color: theme.text, margin: "0 0 8px" }}>CREW LOGIN</h1>
        <p style={{ color: theme.textMuted, fontSize: "14px", margin: "0 0 28px" }}>Select your truck and enter your name.</p>
        <Input label="Your Name" placeholder="e.g. Mike, Carlos..." value={crewName} onChange={(e) => setCrewName(e.target.value)} />
        {trucks.length === 0 ? (
          <Card style={{ textAlign: "center", padding: "32px" }}><div style={{ color: theme.textMuted, fontSize: "14px" }}>No trucks set up yet. Ask the office to add trucks.</div></Card>
        ) : (
          <>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px", color: theme.textMuted, marginBottom: "10px" }}>Select Your Truck</label>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "24px" }}>
              {trucks.map((t) => (
                <Card key={t.id} onClick={() => setSelected(t.id)} style={{ padding: "14px 18px", cursor: "pointer", borderColor: selected === t.id ? theme.accent : theme.border, background: selected === t.id ? "rgba(245,158,11,0.08)" : theme.card }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ fontSize: "22px" }}>🚛</span>
                    <div>
                      <div style={{ fontWeight: 600, color: theme.text, fontSize: "15px" }}>{t.name}</div>
                      {t.members && <div style={{ fontSize: "12px", color: theme.textMuted }}>{t.members}</div>}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
        <Button onClick={() => onLogin(selected, crewName)} disabled={!selected || !crewName.trim()} style={{ width: "100%" }}>LOG IN →</Button>
      </div>
    </div>
  );
}

// ─── Crew Dashboard ───
function CrewDashboard({ truck, crewName, jobs, updates, tickets, onSubmitUpdate, onSubmitTicket, onLogout }) {
  const today = todayStr();
  const myJobs = jobs.filter((j) => j.truckId === truck.id && j.date === today);
  const myTickets = tickets.filter((t) => t.truckId === truck.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
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

  const crewTabStyle = (active) => ({ padding: "10px 18px", background: active ? theme.accent : "transparent", color: active ? "#000" : theme.textMuted, border: "none", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "pointer", letterSpacing: "0.5px", textTransform: "uppercase", fontFamily: "inherit", position: "relative" });
  const openTicketCount = myTickets.filter((t) => t.status !== "resolved").length;

  return (
    <div style={{ minHeight: "100vh", background: theme.bg }}>
      <div style={{ background: theme.surface, borderBottom: "1px solid " + theme.border, padding: "14px 20px", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: "18px", fontWeight: 600, color: theme.accent }}>IST</div>
            <div style={{ fontSize: "12px", color: theme.textMuted }}>🚛 {truck.name} · {crewName}</div>
          </div>
          <Button variant="ghost" onClick={onLogout} style={{ fontSize: "12px" }}>LOG OUT</Button>
        </div>
        <div style={{ display: "flex", gap: "6px", marginTop: "12px" }}>
          <button style={crewTabStyle(crewView === "jobs")} onClick={() => setCrewView("jobs")}>Jobs</button>
          <button style={crewTabStyle(crewView === "tickets")} onClick={() => setCrewView("tickets")}>
            Truck Issues
            {openTicketCount > 0 && <span style={{ position: "absolute", top: "-4px", right: "-4px", background: theme.danger, color: "#fff", fontSize: "10px", fontWeight: 700, borderRadius: "50%", width: "18px", height: "18px", display: "flex", alignItems: "center", justifyContent: "center" }}>{openTicketCount}</span>}
          </button>
        </div>
      </div>

      <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
        {crewView === "jobs" && (
          <>
            <div style={{ marginBottom: "20px" }}>
              <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: "24px", fontWeight: 600, color: theme.text, margin: "0 0 4px" }}>TODAY'S JOBS</h2>
              <p style={{ color: theme.textMuted, fontSize: "13px", margin: 0 }}>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
            </div>
            {myJobs.length === 0 ? (
              <Card style={{ textAlign: "center", padding: "48px 24px" }}>
                <div style={{ fontSize: "36px", marginBottom: "12px" }}>📭</div>
                <div style={{ color: theme.textMuted, fontSize: "15px" }}>No jobs scheduled for today.</div>
              </Card>
            ) : myJobs.map((job) => {
              const latestStatus = getLatestStatus(job.id);
              const statusObj = STATUS_OPTIONS.find((s) => s.value === latestStatus);
              const jobUpdates = getJobUpdates(job.id);
              return (
                <Card key={job.id} style={{ padding: 0, overflow: "hidden" }}>
                  <div style={{ padding: "18px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                      <div>
                        <div style={{ fontWeight: 700, color: theme.text, fontSize: "16px", marginBottom: "4px" }}>{job.address}</div>
                        <div style={{ fontSize: "13px", color: theme.textMuted }}>{job.builder && (job.builder + " · ")}{job.type}</div>
                      </div>
                      <Badge color={statusObj.color} bg={statusObj.bg}>{statusObj.label}</Badge>
                    </div>
                    {job.notes && <div style={{ fontSize: "13px", color: theme.textMuted, background: theme.bg, padding: "10px 12px", borderRadius: "6px", marginBottom: "12px", borderLeft: "3px solid " + theme.accent }}><strong>Office Notes:</strong> {job.notes}</div>}
                    {jobUpdates.length > 0 && (
                      <div style={{ marginBottom: "12px" }}>
                        <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px", color: theme.textDim, marginBottom: "8px", fontWeight: 600 }}>Update Log</div>
                        {jobUpdates.slice(0, 3).map((u) => {
                          const uStatus = STATUS_OPTIONS.find((s) => s.value === u.status);
                          return (
                            <div key={u.id} style={{ fontSize: "13px", color: theme.textMuted, padding: "8px 0", borderBottom: "1px solid " + theme.border, display: "flex", gap: "8px" }}>
                              <span style={{ color: theme.textDim, flexShrink: 0 }}>{u.timeStr}</span>
                              <span>
                                <Badge color={uStatus?.color} bg={uStatus?.bg}>{uStatus?.label}</Badge>
                                {u.eta && <span style={{ marginLeft: "8px" }}>ETA: {u.eta}</span>}
                                {u.notes && <span style={{ display: "block", marginTop: "4px", color: theme.textDim }}>{u.notes}</span>}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <Button onClick={() => setActiveJob(job)} style={{ width: "100%" }}>SEND UPDATE</Button>
                  </div>
                </Card>
              );
            })}
          </>
        )}

        {crewView === "tickets" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div>
                <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: "24px", fontWeight: 600, color: theme.text, margin: "0 0 4px" }}>TRUCK ISSUES</h2>
                <p style={{ color: theme.textMuted, fontSize: "13px", margin: 0 }}>Report problems with equipment or the truck</p>
              </div>
              <Button onClick={() => setShowTicketForm(true)}>+ REPORT</Button>
            </div>
            {myTickets.length === 0 ? (
              <Card style={{ textAlign: "center", padding: "48px 24px" }}>
                <div style={{ fontSize: "36px", marginBottom: "12px" }}>✅</div>
                <div style={{ color: theme.textMuted, fontSize: "15px" }}>No issues reported for this truck.</div>
                <div style={{ color: theme.textDim, fontSize: "13px", marginTop: "6px" }}>Tap "+ Report" if something needs attention.</div>
              </Card>
            ) : myTickets.map((ticket) => {
              const prioObj = TICKET_PRIORITIES.find((p) => p.value === ticket.priority);
              const statObj = TICKET_STATUSES.find((s) => s.value === ticket.status);
              return (
                <Card key={ticket.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginBottom: "8px" }}>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      <Badge color={prioObj?.color} bg={prioObj?.bg}>{prioObj?.label?.split("—")[0]?.trim()}</Badge>
                      <Badge color={statObj?.color} bg={statObj?.bg}>{statObj?.label}</Badge>
                    </div>
                    <span style={{ fontSize: "12px", color: theme.textDim, flexShrink: 0 }}>{dateStr(ticket.timestamp)}</span>
                  </div>
                  <div style={{ fontSize: "14px", color: theme.text, lineHeight: 1.5 }}>{ticket.description}</div>
                  <div style={{ fontSize: "12px", color: theme.textDim, marginTop: "8px" }}>Submitted by {ticket.submittedBy}</div>
                  {ticket.adminNote && <div style={{ fontSize: "13px", color: theme.textMuted, background: theme.bg, padding: "10px 12px", borderRadius: "6px", marginTop: "10px", borderLeft: "3px solid " + theme.accent }}><strong>Office Response:</strong> {ticket.adminNote}</div>}
                </Card>
              );
            })}
          </>
        )}
      </div>

      {activeJob && (
        <Modal title="Job Update" onClose={() => setActiveJob(null)}>
          <div style={{ fontSize: "14px", color: theme.textMuted, marginBottom: "18px" }}><strong style={{ color: theme.text }}>{activeJob.address}</strong><br />{activeJob.type}</div>
          <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)} options={STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label }))} />
          <Input label="Time Estimate" placeholder="e.g. 2 more hours, done by 3pm..." value={eta} onChange={(e) => setEta(e.target.value)} />
          <TextArea label="Notes" placeholder="Any issues, material needs, progress details..." value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
            <Button variant="secondary" onClick={() => setActiveJob(null)} style={{ flex: 1 }}>Cancel</Button>
            <Button onClick={handleSubmit} style={{ flex: 1 }}>SUBMIT UPDATE</Button>
          </div>
        </Modal>
      )}

      {showTicketForm && (
        <Modal title="Report Truck Issue" onClose={() => setShowTicketForm(false)}>
          <div style={{ fontSize: "13px", color: theme.textMuted, marginBottom: "18px", background: theme.bg, padding: "12px", borderRadius: "6px" }}>🚛 Reporting for <strong style={{ color: theme.text }}>{truck.name}</strong></div>
          <TextArea label="What's the problem?" placeholder="Describe the issue... e.g. spray gun leaking at the tip, generator won't start, flat tire on rear passenger side, hose has a kink at 50ft mark..." value={ticketDesc} onChange={(e) => setTicketDesc(e.target.value)} style={{ minHeight: "120px" }} />
          <Select label="How urgent is this?" value={ticketPriority} onChange={(e) => setTicketPriority(e.target.value)} options={TICKET_PRIORITIES.map((p) => ({ value: p.value, label: p.label }))} />
          <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
            <Button variant="secondary" onClick={() => setShowTicketForm(false)} style={{ flex: 1 }}>Cancel</Button>
            <Button onClick={handleTicketSubmit} disabled={!ticketDesc.trim()} style={{ flex: 1 }}>SUBMIT TICKET</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Admin Dashboard ───
function AdminDashboard({ trucks, jobs, updates, tickets, onAddTruck, onDeleteTruck, onAddJob, onDeleteJob, onUpdateTicket, onLogout }) {
  const [view, setView] = useState("schedule");
  const [showAddJob, setShowAddJob] = useState(false);
  const [showAddTruck, setShowAddTruck] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [jobForm, setJobForm] = useState({ address: "", builder: "", type: JOB_TYPES[0], truckId: "", date: todayStr(), notes: "" });
  const [truckForm, setTruckForm] = useState({ name: "", members: "" });
  const [activeTicket, setActiveTicket] = useState(null);
  const [ticketStatus, setTicketStatus] = useState("acknowledged");
  const [ticketNote, setTicketNote] = useState("");
  const [ticketFilter, setTicketFilter] = useState("active");

  const todaysJobs = jobs.filter((j) => j.date === selectedDate);
  const openTicketCount = tickets.filter((t) => t.status === "open").length;
  const filteredTickets = ticketFilter === "active" ? tickets.filter((t) => t.status !== "resolved") : tickets;
  const sortedTickets = [...filteredTickets].sort((a, b) => {
    const prioOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    if (prioOrder[a.priority] !== prioOrder[b.priority]) return prioOrder[a.priority] - prioOrder[b.priority];
    return new Date(b.timestamp) - new Date(a.timestamp);
  });

  const getLatestUpdate = (jobId) => {
    const u = updates.filter((u) => u.jobId === jobId).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return u.length > 0 ? u[0] : null;
  };

  const handleAddJob = () => { onAddJob({ ...jobForm }); setJobForm({ address: "", builder: "", type: JOB_TYPES[0], truckId: "", date: selectedDate, notes: "" }); setShowAddJob(false); };
  const handleAddTruck = () => { onAddTruck({ ...truckForm }); setTruckForm({ name: "", members: "" }); setShowAddTruck(false); };
  const handleTicketUpdate = () => { onUpdateTicket(activeTicket.id, { status: ticketStatus, adminNote: ticketNote }); setActiveTicket(null); setTicketStatus("acknowledged"); setTicketNote(""); };

  const recentUpdates = [...updates].filter((u) => u.status !== "completed").sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 30);
  const tabStyle = (active) => ({ padding: "10px 18px", background: active ? theme.accent : "transparent", color: active ? "#000" : theme.textMuted, border: "none", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "pointer", letterSpacing: "0.5px", textTransform: "uppercase", fontFamily: "inherit", position: "relative" });

  return (
    <div style={{ minHeight: "100vh", background: theme.bg }}>
      <div style={{ background: theme.surface, borderBottom: "1px solid " + theme.border, padding: "14px 20px", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: "900px", margin: "0 auto" }}>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: "20px", fontWeight: 700, color: theme.accent }}>IST <span style={{ color: theme.textDim, fontWeight: 400, fontSize: "14px" }}>DISPATCH</span></div>
          <Button variant="ghost" onClick={onLogout} style={{ fontSize: "12px" }}>← SWITCH ROLE</Button>
        </div>
        <div style={{ display: "flex", gap: "6px", marginTop: "12px", maxWidth: "900px", margin: "12px auto 0", flexWrap: "wrap" }}>
          <button style={tabStyle(view === "schedule")} onClick={() => setView("schedule")}>Schedule</button>
          <button style={tabStyle(view === "feed")} onClick={() => setView("feed")}>Live Feed</button>
          <button style={tabStyle(view === "tickets")} onClick={() => setView("tickets")}>
            Tickets
            {openTicketCount > 0 && <span style={{ position: "absolute", top: "-4px", right: "-4px", background: theme.danger, color: "#fff", fontSize: "10px", fontWeight: 700, borderRadius: "50%", width: "18px", height: "18px", display: "flex", alignItems: "center", justifyContent: "center" }}>{openTicketCount}</span>}
          </button>
          <button style={tabStyle(view === "trucks")} onClick={() => setView("trucks")}>Trucks</button>
        </div>
      </div>

      <div style={{ padding: "20px", maxWidth: "900px", margin: "0 auto" }}>

        {view === "schedule" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
              <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: "24px", fontWeight: 600, color: theme.text, margin: 0 }}>SCHEDULE</h2>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={{ padding: "8px 12px", background: theme.card, border: "1px solid " + theme.border, borderRadius: "6px", color: theme.text, fontSize: "14px", fontFamily: "inherit", colorScheme: "dark" }} />
                <Button onClick={() => { setJobForm({ ...jobForm, date: selectedDate }); setShowAddJob(true); }}>+ ADD JOB</Button>
              </div>
            </div>
            {todaysJobs.length === 0 ? (
              <Card style={{ textAlign: "center", padding: "48px" }}><div style={{ fontSize: "36px", marginBottom: "12px" }}>📅</div><div style={{ color: theme.textMuted }}>No jobs scheduled for {selectedDate === todayStr() ? "today" : selectedDate}.</div></Card>
            ) : todaysJobs.map((job) => {
              const truck = trucks.find((t) => t.id === job.truckId);
              const latest = getLatestUpdate(job.id);
              const statusObj = latest ? STATUS_OPTIONS.find((s) => s.value === latest.status) : STATUS_OPTIONS[0];
              const jobUpdates = updates.filter((u) => u.jobId === job.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
              return (
                <Card key={job.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "8px" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: theme.text, fontSize: "16px" }}>{job.address}</div>
                      <div style={{ fontSize: "13px", color: theme.textMuted, marginTop: "2px" }}>{job.builder && (job.builder + " · ")}{job.type}</div>
                      <div style={{ fontSize: "13px", color: theme.textDim, marginTop: "4px" }}>{truck ? "🚛 " + truck.name : "⚠️ Unassigned"}</div>
                    </div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <Badge color={statusObj.color} bg={statusObj.bg}>{statusObj.label}</Badge>
                      <Button variant="danger" onClick={() => onDeleteJob(job.id)} style={{ padding: "6px 10px", fontSize: "12px" }}>✕</Button>
                    </div>
                  </div>
                  {job.notes && <div style={{ fontSize: "13px", color: theme.textDim, marginTop: "10px", fontStyle: "italic" }}>Notes: {job.notes}</div>}
                  {jobUpdates.length > 0 && (
                    <div style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px solid " + theme.border }}>
                      <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px", color: theme.textDim, marginBottom: "8px", fontWeight: 600 }}>Crew Updates</div>
                      {jobUpdates.map((u) => {
                        const uStatus = STATUS_OPTIONS.find((s) => s.value === u.status);
                        return (
                          <div key={u.id} style={{ fontSize: "13px", padding: "8px 0", borderBottom: "1px solid rgba(42,58,74,0.5)", color: theme.textMuted }}>
                            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                              <span style={{ color: theme.textDim }}>{u.timeStr}</span>
                              <strong style={{ color: theme.text }}>{u.crewName}</strong>
                              <Badge color={uStatus?.color} bg={uStatus?.bg}>{uStatus?.label}</Badge>
                              {u.eta && <span>· ETA: {u.eta}</span>}
                            </div>
                            {u.notes && <div style={{ marginTop: "4px", color: theme.textDim, paddingLeft: "4px" }}>{u.notes}</div>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              );
            })}
          </>
        )}

        {view === "feed" && (
          <>
            <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: "24px", fontWeight: 600, color: theme.text, margin: "0 0 20px" }}>LIVE FEED</h2>
            {recentUpdates.length === 0 ? (
              <Card style={{ textAlign: "center", padding: "48px" }}><div style={{ color: theme.textMuted }}>No crew updates yet.</div></Card>
            ) : recentUpdates.map((u) => {
              const job = jobs.find((j) => j.id === u.jobId);
              const truck = trucks.find((t) => t.id === u.truckId);
              const statusObj = STATUS_OPTIONS.find((s) => s.value === u.status);
              return (
                <Card key={u.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "6px" }}>
                    <div>
                      <div style={{ fontWeight: 700, color: theme.text, fontSize: "15px" }}>{u.crewName} — {truck?.name || "Unknown"}</div>
                      <div style={{ fontSize: "13px", color: theme.textMuted, marginTop: "2px" }}>{job?.address || "Unknown"} · {job?.type}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <Badge color={statusObj?.color} bg={statusObj?.bg}>{statusObj?.label}</Badge>
                      <div style={{ fontSize: "12px", color: theme.textDim, marginTop: "4px" }}>{u.timeStr}</div>
                    </div>
                  </div>
                  {u.eta && <div style={{ fontSize: "13px", color: theme.textMuted, marginTop: "8px" }}>⏱ ETA: {u.eta}</div>}
                  {u.notes && <div style={{ fontSize: "13px", color: theme.textDim, marginTop: "6px", fontStyle: "italic" }}>"{u.notes}"</div>}
                </Card>
              );
            })}
          </>
        )}

        {view === "tickets" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
              <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: "24px", fontWeight: 600, color: theme.text, margin: 0 }}>TRUCK TICKETS</h2>
              <div style={{ display: "flex", gap: "6px" }}>
                <button onClick={() => setTicketFilter("active")} style={{ padding: "8px 14px", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.5px", textTransform: "uppercase", background: ticketFilter === "active" ? theme.accent : theme.surfaceHover, color: ticketFilter === "active" ? "#000" : theme.textMuted }}>
                  Active ({tickets.filter((t) => t.status !== "resolved").length})
                </button>
                <button onClick={() => setTicketFilter("all")} style={{ padding: "8px 14px", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.5px", textTransform: "uppercase", background: ticketFilter === "all" ? theme.accent : theme.surfaceHover, color: ticketFilter === "all" ? "#000" : theme.textMuted }}>
                  All ({tickets.length})
                </button>
              </div>
            </div>
            {sortedTickets.length === 0 ? (
              <Card style={{ textAlign: "center", padding: "48px" }}><div style={{ fontSize: "36px", marginBottom: "12px" }}>✅</div><div style={{ color: theme.textMuted }}>{ticketFilter === "active" ? "No active tickets. All clear!" : "No tickets submitted yet."}</div></Card>
            ) : sortedTickets.map((ticket) => {
              const prioObj = TICKET_PRIORITIES.find((p) => p.value === ticket.priority);
              const statObj = TICKET_STATUSES.find((s) => s.value === ticket.status);
              return (
                <Card key={ticket.id} onClick={() => { setActiveTicket(ticket); setTicketStatus(ticket.status === "open" ? "acknowledged" : ticket.status); setTicketNote(ticket.adminNote || ""); }} style={{ cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginBottom: "10px", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                      <Badge color={prioObj?.color} bg={prioObj?.bg}>{prioObj?.label?.split("—")[0]?.trim()}</Badge>
                      <Badge color={statObj?.color} bg={statObj?.bg}>{statObj?.label}</Badge>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: theme.text }}>🚛 {ticket.truckName}</span>
                    </div>
                    <span style={{ fontSize: "12px", color: theme.textDim }}>{dateStr(ticket.timestamp)}</span>
                  </div>
                  <div style={{ fontSize: "14px", color: theme.text, lineHeight: 1.5 }}>{ticket.description}</div>
                  <div style={{ fontSize: "12px", color: theme.textDim, marginTop: "8px" }}>Submitted by {ticket.submittedBy}</div>
                  {ticket.adminNote && <div style={{ fontSize: "13px", color: theme.textMuted, background: theme.bg, padding: "10px 12px", borderRadius: "6px", marginTop: "10px", borderLeft: "3px solid " + theme.success }}><strong>Response:</strong> {ticket.adminNote}</div>}
                </Card>
              );
            })}
          </>
        )}

        {view === "trucks" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: "24px", fontWeight: 600, color: theme.text, margin: 0 }}>TRUCKS / CREWS</h2>
              <Button onClick={() => setShowAddTruck(true)}>+ ADD TRUCK</Button>
            </div>
            {trucks.length === 0 ? (
              <Card style={{ textAlign: "center", padding: "48px" }}><div style={{ color: theme.textMuted }}>No trucks yet. Add one to get started.</div></Card>
            ) : trucks.map((t) => {
              const truckJobs = jobs.filter((j) => j.truckId === t.id && j.date === todayStr());
              const truckTickets = tickets.filter((tk) => tk.truckId === t.id && tk.status !== "resolved");
              return (
                <Card key={t.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span style={{ fontSize: "24px" }}>🚛</span>
                      <div>
                        <div style={{ fontWeight: 700, color: theme.text, fontSize: "16px" }}>{t.name}</div>
                        {t.members && <div style={{ fontSize: "13px", color: theme.textMuted }}>{t.members}</div>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <Badge>{truckJobs.length} job{truckJobs.length !== 1 ? "s" : ""} today</Badge>
                      {truckTickets.length > 0 && <Badge color={theme.danger} bg="rgba(239,68,68,0.15)">{truckTickets.length} issue{truckTickets.length !== 1 ? "s" : ""}</Badge>}
                      <Button variant="danger" onClick={() => onDeleteTruck(t.id)} style={{ padding: "6px 10px", fontSize: "12px" }}>✕</Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </>
        )}
      </div>

      {showAddJob && (
        <Modal title="Add Job" onClose={() => setShowAddJob(false)}>
          <Input label="Job Address" placeholder="e.g. 1234 E 91st St, Tulsa" value={jobForm.address} onChange={(e) => setJobForm({ ...jobForm, address: e.target.value })} />
          <Input label="Builder / Customer" placeholder="e.g. Smith Residence, ABC Builders" value={jobForm.builder} onChange={(e) => setJobForm({ ...jobForm, builder: e.target.value })} />
          <Select label="Job Type" value={jobForm.type} onChange={(e) => setJobForm({ ...jobForm, type: e.target.value })} options={JOB_TYPES.map((t) => ({ value: t, label: t }))} />
          <Select label="Assign to Truck" value={jobForm.truckId} onChange={(e) => setJobForm({ ...jobForm, truckId: e.target.value })} options={[{ value: "", label: "— Unassigned —" }, ...trucks.map((t) => ({ value: t.id, label: t.name }))]} />
          <div style={{ marginBottom: "14px" }}>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px", color: theme.textMuted, marginBottom: "6px" }}>Date</label>
            <input type="date" value={jobForm.date} onChange={(e) => setJobForm({ ...jobForm, date: e.target.value })} style={{ width: "100%", padding: "10px 14px", background: theme.bg, border: "1px solid " + theme.border, borderRadius: "6px", color: theme.text, fontSize: "14px", fontFamily: "inherit", boxSizing: "border-box", colorScheme: "dark" }} />
          </div>
          <TextArea label="Office Notes (visible to crew)" placeholder="Special instructions, materials needed..." value={jobForm.notes} onChange={(e) => setJobForm({ ...jobForm, notes: e.target.value })} />
          <Button onClick={handleAddJob} disabled={!jobForm.address.trim()} style={{ width: "100%" }}>ADD JOB TO SCHEDULE</Button>
        </Modal>
      )}

      {showAddTruck && (
        <Modal title="Add Truck" onClose={() => setShowAddTruck(false)}>
          <Input label="Truck Name" placeholder="e.g. Truck 1, White F-150, Foam Rig" value={truckForm.name} onChange={(e) => setTruckForm({ ...truckForm, name: e.target.value })} />
          <Input label="Crew Members (optional)" placeholder="e.g. Mike, Carlos, David" value={truckForm.members} onChange={(e) => setTruckForm({ ...truckForm, members: e.target.value })} />
          <Button onClick={handleAddTruck} disabled={!truckForm.name.trim()} style={{ width: "100%" }}>ADD TRUCK</Button>
        </Modal>
      )}

      {activeTicket && (
        <Modal title="Respond to Ticket" onClose={() => setActiveTicket(null)}>
          <div style={{ background: theme.bg, padding: "14px", borderRadius: "8px", marginBottom: "18px" }}>
            <div style={{ display: "flex", gap: "6px", marginBottom: "10px", flexWrap: "wrap" }}>
              {(() => { const p = TICKET_PRIORITIES.find((p) => p.value === activeTicket.priority); return <Badge color={p?.color} bg={p?.bg}>{p?.label}</Badge>; })()}
            </div>
            <div style={{ fontSize: "13px", color: theme.textDim, marginBottom: "4px" }}>🚛 {activeTicket.truckName} · {activeTicket.submittedBy} · {dateStr(activeTicket.timestamp)}</div>
            <div style={{ fontSize: "15px", color: theme.text, lineHeight: 1.5 }}>{activeTicket.description}</div>
          </div>
          <Select label="Update Status" value={ticketStatus} onChange={(e) => setTicketStatus(e.target.value)} options={TICKET_STATUSES.map((s) => ({ value: s.value, label: s.label }))} />
          <TextArea label="Response Note (visible to crew)" placeholder="e.g. Parts ordered, will fix Saturday... Acknowledged, bring it in Friday..." value={ticketNote} onChange={(e) => setTicketNote(e.target.value)} />
          <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
            <Button variant="secondary" onClick={() => setActiveTicket(null)} style={{ flex: 1 }}>Cancel</Button>
            <Button onClick={handleTicketUpdate} style={{ flex: 1 }}>UPDATE TICKET</Button>
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
  const [trucks, setTrucks] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [tickets, setTickets] = useState([]);

  useEffect(() => {
    const unsubTrucks = onSnapshot(collection(db, "trucks"), (snap) => { setTrucks(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); });
    const unsubJobs = onSnapshot(collection(db, "jobs"), (snap) => { setJobs(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); });
    const unsubUpdates = onSnapshot(collection(db, "updates"), (snap) => { setUpdates(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); });
    const unsubTickets = onSnapshot(collection(db, "tickets"), (snap) => { setTickets(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false); });
    return () => { unsubTrucks(); unsubJobs(); unsubUpdates(); unsubTickets(); };
  }, []);

  const handleAddTruck = async (data) => { await addDoc(collection(db, "trucks"), data); };
  const handleDeleteTruck = async (id) => { await deleteDoc(doc(db, "trucks", id)); };
  const handleAddJob = async (data) => { await addDoc(collection(db, "jobs"), data); };
  const handleDeleteJob = async (id) => { await deleteDoc(doc(db, "jobs", id)); };
  const handleSubmitUpdate = async (data) => { await addDoc(collection(db, "updates"), { ...data, createdAt: serverTimestamp() }); };
  const handleSubmitTicket = async (data) => { await addDoc(collection(db, "tickets"), { ...data, createdAt: serverTimestamp() }); };
  const handleUpdateTicket = async (id, data) => { await updateDoc(doc(db, "tickets", id), data); };
  const handleCrewLogin = (truckId, crewName) => { setCrewSession({ truckId, crewName }); setRole("crew"); };

  if (loading) return <div style={{ minHeight: "100vh", background: theme.bg, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ fontFamily: "'Oswald', sans-serif", fontSize: "28px", color: theme.accent, letterSpacing: "4px" }}>IST</div></div>;

  if (!role) return <RoleSelect onSelect={setRole} />;
  if (role === "crew" && !crewSession) return <CrewLogin trucks={trucks} onLogin={handleCrewLogin} onBack={() => setRole(null)} />;
  if (role === "crew" && crewSession) {
    const truck = trucks.find((t) => t.id === crewSession.truckId);
    if (!truck) return <CrewLogin trucks={trucks} onLogin={handleCrewLogin} onBack={() => setRole(null)} />;
    return <CrewDashboard truck={truck} crewName={crewSession.crewName} jobs={jobs} updates={updates} tickets={tickets} onSubmitUpdate={handleSubmitUpdate} onSubmitTicket={handleSubmitTicket} onLogout={() => { setCrewSession(null); setRole(null); }} />;
  }
  if (role === "admin") return <AdminDashboard trucks={trucks} jobs={jobs} updates={updates} tickets={tickets} onAddTruck={handleAddTruck} onDeleteTruck={handleDeleteTruck} onAddJob={handleAddJob} onDeleteJob={handleDeleteJob} onUpdateTicket={handleUpdateTicket} onLogout={() => setRole(null)} />;
  return null;
}
