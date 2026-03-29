#!/usr/bin/env node
/**
 * IST Dispatch — Daily Digest
 * Sends a 7 AM CST Telegram summary of the day's jobs.
 * Uses Firestore REST API (no service account needed — rules are open).
 */

const https = require("https");

// ─── Config ───
const FIREBASE_PROJECT = "insulation-services-da91a";
const FIREBASE_API_KEY = "AIzaSyBvL6M_2kPGt8XrcgpPHfL-bwU9BAH57Qk";
const TELEGRAM_TOKEN = "8645507155:AAH8VHaLZ0pyrKMohrhqE_k9kyPY";
const TELEGRAM_CHAT_ID = "6357466021"; // Johnny's Telegram ID

// ─── Firestore REST helpers ───
function firestoreGet(collection) {
  return new Promise((resolve, reject) => {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/${collection}?key=${FIREBASE_API_KEY}&pageSize=500`;
    https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.documents || []);
        } catch (e) {
          reject(e);
        }
      });
    }).on("error", reject);
  });
}

function parseField(field) {
  if (!field) return null;
  if (field.stringValue !== undefined) return field.stringValue;
  if (field.integerValue !== undefined) return parseInt(field.integerValue);
  if (field.doubleValue !== undefined) return parseFloat(field.doubleValue);
  if (field.booleanValue !== undefined) return field.booleanValue;
  if (field.timestampValue !== undefined) return field.timestampValue;
  if (field.arrayValue) return (field.arrayValue.values || []).map(parseField);
  if (field.mapValue) {
    const obj = {};
    Object.entries(field.mapValue.fields || {}).forEach(([k, v]) => { obj[k] = parseField(v); });
    return obj;
  }
  return null;
}

function parseDoc(doc) {
  if (!doc || !doc.fields) return null;
  const obj = { id: doc.name.split("/").pop() };
  Object.entries(doc.fields).forEach(([k, v]) => { obj[k] = parseField(v); });
  return obj;
}

// ─── Telegram ───
function sendTelegram(message) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: "HTML",
    });
    const options = {
      hostname: "api.telegram.org",
      path: `/bot${TELEGRAM_TOKEN}/sendMessage`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(JSON.parse(data)));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ─── Utilities ───
function todayCST() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
  });
}

// ─── Main ───
async function main() {
  console.log("📅 Fetching IST Dispatch data...");

  const [jobDocs, updateDocs, crewDocs] = await Promise.all([
    firestoreGet("jobs"),
    firestoreGet("updates"),
    firestoreGet("crewMembers"),
  ]);

  const jobs = jobDocs.map(parseDoc).filter(Boolean);
  const updates = updateDocs.map(parseDoc).filter(Boolean);
  const crewMembers = crewDocs.map(parseDoc).filter(Boolean);

  const today = todayCST();
  const now = Date.now();
  const OVERDUE_MS = 48 * 60 * 60 * 1000;

  // Build latest status per job
  const latestStatus = {};
  const latestTimestamp = {};
  updates.forEach((u) => {
    const prev = latestTimestamp[u.jobId];
    const ts = new Date(u.timestamp || u.createdAt || 0).getTime();
    if (!prev || ts > prev) {
      latestStatus[u.jobId] = u.status;
      latestTimestamp[u.jobId] = ts;
    }
  });

  // Today's scheduled jobs (date = today and not completed)
  const todayJobs = jobs.filter((j) => {
    if (j.onHold) return false;
    if (j.date !== today) return false;
    const ls = latestStatus[j.id];
    return ls !== "completed";
  });

  // Overdue jobs (In Progress or Scheduled for >48h with no update)
  const overdueJobs = jobs.filter((j) => {
    if (j.onHold) return false;
    const ls = latestStatus[j.id];
    if (ls === "completed" || ls === "not_started") return false;
    const lastTs = latestTimestamp[j.id];
    if (!lastTs) return false;
    return (now - lastTs) > OVERDUE_MS;
  });

  // Status counts
  const counts = { not_started: 0, in_progress: 0, completed: 0, issue: 0, total: 0 };
  jobs.forEach((j) => {
    if (j.onHold) return;
    counts.total++;
    const ls = latestStatus[j.id] || "not_started";
    if (ls in counts) counts[ls]++;
  });

  // Crew working today (assigned to today's jobs)
  const crewWorkingToday = new Set();
  todayJobs.forEach((j) => {
    (j.crewMemberIds || []).forEach((id) => {
      const member = crewMembers.find((m) => m.id === id);
      if (member) crewWorkingToday.add(member.name);
    });
  });

  // ─── Build message ───
  const lines = [];
  lines.push(`🏗️ <b>IST Dispatch — Daily Digest</b>`);
  lines.push(`📅 ${new Date().toLocaleDateString("en-US", { timeZone: "America/Chicago", weekday: "long", month: "long", day: "numeric", year: "numeric" })}`);
  lines.push("");

  // Job counts
  lines.push(`📊 <b>Fleet Status</b>`);
  lines.push(`• 🟡 Scheduled/Not Started: ${counts.not_started}`);
  lines.push(`• 🔵 In Progress: ${counts.in_progress}`);
  lines.push(`• 🟢 Completed: ${counts.completed}`);
  if (counts.issue > 0) lines.push(`• 🔴 Issues: ${counts.issue}`);
  lines.push("");

  // Today's jobs
  if (todayJobs.length === 0) {
    lines.push(`📋 <b>Today's Jobs</b>`);
    lines.push("• No jobs scheduled for today.");
  } else {
    lines.push(`📋 <b>Today's Jobs (${todayJobs.length})</b>`);
    todayJobs.forEach((j) => {
      const assignedNames = (j.crewMemberIds || [])
        .map((id) => crewMembers.find((m) => m.id === id)?.name)
        .filter(Boolean);
      lines.push(`• <b>${j.builder || "No Customer"}</b>`);
      lines.push(`  📍 ${j.address || "No address"}`);
      if (assignedNames.length) lines.push(`  👷 ${assignedNames.join(", ")}`);
      if (j.type) lines.push(`  🔧 ${j.type}`);
    });
  }
  lines.push("");

  // Crew assignments
  if (crewWorkingToday.size > 0) {
    lines.push(`👷 <b>Crew Working Today</b>`);
    [...crewWorkingToday].sort().forEach((name) => lines.push(`• ${name}`));
    lines.push("");
  }

  // Overdue jobs
  if (overdueJobs.length > 0) {
    lines.push(`⚠️ <b>Overdue / No Recent Update (${overdueJobs.length})</b>`);
    overdueJobs.forEach((j) => {
      const lastTs = latestTimestamp[j.id];
      const hoursAgo = lastTs ? Math.round((now - lastTs) / 3600000) : null;
      lines.push(`• <b>${j.builder || "No Customer"}</b> — ${j.address || ""}`);
      if (hoursAgo) lines.push(`  ⏱ Last update: ${hoursAgo}h ago`);
    });
    lines.push("");
  }

  lines.push(`<i>Sent automatically by IST Dispatch ✨</i>`);

  const message = lines.join("\n");
  console.log("📨 Sending Telegram digest...");
  const result = await sendTelegram(message);

  if (result.ok) {
    console.log("✅ Daily digest sent successfully.");
  } else {
    console.error("❌ Telegram error:", result);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("❌ Digest failed:", err);
  process.exit(1);
});
