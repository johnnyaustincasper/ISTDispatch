const ES_JOB_TYPES = new Set(["Energy Seal", "Air Seal", "Weatherization", "Other"]);

const normalizeEnergySealLabel = (label) => String(label || "").trim().toLowerCase() === "energy seal technician" ? "Energy Seal Van" : label;
const truckDisplayName = (truck) => normalizeEnergySealLabel(truck?.vehicleName || truck?.members || truck?.name) || "Truck";

const parseDate = (date) => new Date(`${date}T12:00:00`);
const formatLongDate = (date) => parseDate(date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
const formatShortDate = (date) => parseDate(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const toCstDate = (timestamp) => timestamp ? new Date(timestamp).toLocaleDateString("en-CA", { timeZone: "America/Chicago" }) : "";
const naturalTruckSort = (a, b) => (a.order ?? 999) - (b.order ?? 999) || truckDisplayName(a).localeCompare(truckDisplayName(b), undefined, { numeric: true, sensitivity: "base" });

const statusLabel = (status) => ({
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
  issue: "Needs Help",
}[status] || "Not Started");

const normalizeInsulationJobType = (type) => {
  const value = String(type || "").trim().toLowerCase();
  if (value.includes("foam")) return "Foam";
  if (value.includes("removal") || value.includes("remove") || value.includes("tear")) return "Removal";
  if (value.includes("fiberglass") || value.includes("blown") || value.includes("batt") || value.includes("attic") || value.includes("r-")) return "Fiberglass";
  return type || "Fiberglass";
};

const isEnergySealJob = (job, trucks = []) => {
  const truck = trucks.find((candidate) => candidate.id === job?.truckId);
  return truck?.department === "energySeal" || (!truck && ES_JOB_TYPES.has(job?.type));
};

const latestUpdateForJob = (updates = [], jobId) => (updates || [])
  .filter((update) => update.jobId === jobId)
  .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))[0] || null;

const latestUpdateForJobOnDate = (updates = [], jobId, date) => (updates || [])
  .filter((update) => update.jobId === jobId && toCstDate(update.timestamp) === date)
  .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))[0] || null;

const ACTIVE_STATUS_VALUES = new Set(["in_progress", "on_site", "started", "issue"]);

const memberNamesForJob = (job, members = []) => (job?.crewMemberIds || [])
  .map((id) => members.find((member) => member.id === id)?.name)
  .filter(Boolean);

export function buildDailyAgendaFileName(date, scheduleView = "insulation") {
  return `IST-${scheduleView === "energySeal" ? "energy-seal" : "insulation"}-agenda-${date}.png`;
}

export function buildDailyAgenda({ jobs = [], trucks = [], members = [], updates = [], date, scheduleView = "insulation", includeAllActiveJobs = false } = {}) {
  const targetDate = date || new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  const visibleTrucks = [...(trucks || [])]
    .filter((truck) => scheduleView === "energySeal" ? truck.department === "energySeal" : truck.department !== "energySeal")
    .sort(naturalTruckSort);
  const visibleTruckIds = new Set(visibleTrucks.map((truck) => truck.id));

  const agendaJobs = (jobs || [])
    .filter((job) => !job?.onHold)
    .filter((job) => scheduleView === "energySeal" ? isEnergySealJob(job, trucks) : !isEnergySealJob(job, trucks))
    .map((job) => {
      const latest = latestUpdateForJob(updates, job.id);
      const latestToday = latestUpdateForJobOnDate(updates, job.id, targetDate);
      const statusValue = latestToday?.status || "not_started";
      return { job, latest: latestToday || latest, statusValue };
    })
    .filter(({ job, latest, statusValue }) => {
      if (statusValue === "completed") return false;
      if (includeAllActiveJobs) return true;
      if (job.date === targetDate) return true;
      return ACTIVE_STATUS_VALUES.has(latest?.status) && toCstDate(latest?.timestamp) === targetDate;
    })
    .map(({ job, latest, statusValue }) => {
      const truck = trucks.find((candidate) => candidate.id === job.truckId) || null;
      const crewNames = memberNamesForJob(job, members);
      if (statusValue === "completed") return null;
      const displayType = scheduleView === "energySeal" ? (job.type || "Energy Seal") : normalizeInsulationJobType(job.type || job.jobCategory);
      return {
        id: job.id,
        date: job.date || targetDate,
        customer: job.builder || "No Customer Listed",
        destination: job.address || "No address",
        type: displayType,
        category: job.jobCategory || "",
        notes: latest?.notes || job.notes || "",
        truckId: job.truckId || "",
        truckName: truck ? truckDisplayName(truck) : "Unassigned",
        crew: crewNames.length ? crewNames.join(", ") : "Unassigned",
        crewShort: crewNames.length ? crewNames.map((name) => name.split(" ")[0]).join(" + ") : "Unassigned",
        status: statusLabel(statusValue),
        statusValue,
        statusLabel: statusLabel(statusValue),
        time: latest?.timeStr || (job.date ? formatShortDate(job.date) : "No date"),
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.statusValue === "completed") - (b.statusValue === "completed") || a.truckName.localeCompare(b.truckName, undefined, { numeric: true }) || a.customer.localeCompare(b.customer));

  const sectionMap = new Map();
  visibleTrucks.forEach((truck) => sectionMap.set(truck.id, {
    truckId: truck.id,
    truckName: truckDisplayName(truck),
    truckCrew: normalizeEnergySealLabel(truck.members || ""),
    order: truck.order ?? 999,
    jobs: [],
  }));

  agendaJobs.forEach((job) => {
    const key = job.truckId && visibleTruckIds.has(job.truckId) ? job.truckId : "_unassigned";
    if (!sectionMap.has(key)) {
      sectionMap.set(key, { truckId: "", truckName: "Unassigned", truckCrew: "", order: 9999, jobs: [] });
    }
    sectionMap.get(key).jobs.push(job);
  });

  const sections = [...sectionMap.values()]
    .filter((section) => section.jobs.length > 0 || visibleTruckIds.has(section.truckId))
    .sort((a, b) => a.order - b.order || a.truckName.localeCompare(b.truckName, undefined, { numeric: true }))
    .map((section) => ({
      ...section,
      crew: section.jobs.map((job) => job.crew).find((crew) => crew && crew !== "Unassigned") || section.truckCrew || "Unassigned",
    }));

  return {
    title: "IST Daily Agenda",
    subtitle: scheduleView === "energySeal" ? "Energy Seal Schedule" : "Insulation Schedule",
    date: targetDate,
    dateLabel: formatLongDate(targetDate),
    generatedAt: new Date().toLocaleString("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit", month: "short", day: "numeric" }),
    sections,
    summary: {
      trucks: sections.length,
      jobs: agendaJobs.length,
      unassignedJobs: agendaJobs.filter((job) => job.crew === "Unassigned" || job.truckName === "Unassigned").length,
    },
  };
}

const wrapText = (ctx, text, maxWidth) => {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) line = next;
    else { lines.push(line); line = word; }
  });
  if (line) lines.push(line);
  return lines;
};

const roundRect = (ctx, x, y, width, height, radius) => {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
};

const typeColor = (type = "") => {
  if (/foam/i.test(type)) return "#16a34a";
  if (/energy/i.test(type)) return "#10b981";
  if (/removal|tear/i.test(type)) return "#dc2626";
  return "#2563eb";
};

export function renderDailyAgendaCanvas(agenda, { width = 2400 } = {}) {
  if (typeof document === "undefined") throw new Error("Agenda image export requires a browser canvas.");
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const margin = 56;
  const headerHeight = 210;
  const footerHeight = 54;
  const tileGap = 26;
  const contentWidth = width - margin * 2;
  const sections = agenda.sections || [];
  const columns = sections.length <= 3 ? sections.length || 1 : sections.length <= 6 ? 3 : 4;
  const rows = Math.max(1, Math.ceil(Math.max(1, sections.length) / columns));
  const height = Math.max(1350, Math.min(1850, headerHeight + footerHeight + margin + rows * 610 + (rows - 1) * tileGap));
  const tileW = (contentWidth - (columns - 1) * tileGap) / columns;
  const tileH = (height - headerHeight - footerHeight - margin - (rows - 1) * tileGap) / rows;

  canvas.width = width;
  canvas.height = height;

  const gradient = ctx.createLinearGradient(0, 0, width, 225);
  gradient.addColorStop(0, "#07152d");
  gradient.addColorStop(0.62, "#123b93");
  gradient.addColorStop(1, "#2563eb");
  ctx.fillStyle = "#f6f8fc";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, headerHeight);

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 70px Inter, Arial, sans-serif";
  ctx.fillText(agenda.title, margin, 88);
  ctx.font = "850 32px Inter, Arial, sans-serif";
  ctx.fillStyle = "#dbeafe";
  ctx.fillText(`${agenda.subtitle} · ${agenda.dateLabel}`, margin, 138);
  ctx.font = "900 24px Inter, Arial, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.86)";
  ctx.fillText(`ONE-PAGE TRUCK BOARD · ${agenda.summary.jobs} jobs · ${agenda.summary.trucks} trucks · generated ${agenda.generatedAt}`, margin, 176);

  if (!sections.length) {
    ctx.fillStyle = "#64748b";
    ctx.font = "850 42px Inter, Arial, sans-serif";
    ctx.fillText("No jobs scheduled for this day.", margin, headerHeight + 110);
    return canvas;
  }

  const shrinkText = (text, maxChars) => {
    const value = String(text || "").trim();
    return value.length > maxChars ? `${value.slice(0, Math.max(0, maxChars - 1)).trim()}…` : value;
  };
  const pill = (label, x, yPos, w, fill, color = "#0f172a") => {
    ctx.fillStyle = fill;
    roundRect(ctx, x, yPos, w, 38, 999);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.font = "900 17px Inter, Arial, sans-serif";
    ctx.fillText(label, x + 16, yPos + 25);
  };

  sections.forEach((section, sectionIndex) => {
    const col = sectionIndex % columns;
    const row = Math.floor(sectionIndex / columns);
    const x = margin + col * (tileW + tileGap);
    const y = headerHeight + margin + row * (tileH + tileGap);
    const truckAccent = /f\s*\d|foam/i.test(section.truckName) ? "#16a34a" : /b\s*\d|blow/i.test(section.truckName) ? "#2563eb" : "#475569";

    roundRect(ctx, x, y, tileW, tileH, 30);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "#cfe0f6";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = truckAccent;
    roundRect(ctx, x, y, tileW, 86, 30);
    ctx.fill();
    ctx.fillRect(x, y + 43, tileW, 43);
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 44px Inter, Arial, sans-serif";
    ctx.fillText(section.truckName, x + 24, y + 55);
    ctx.font = "900 21px Inter, Arial, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    const crewLabel = shrinkText(section.crew || "Unassigned", 44);
    ctx.fillText(`${section.jobs.length} stop${section.jobs.length === 1 ? "" : "s"} · ${crewLabel}`, x + 24, y + 79);

    if (!section.jobs.length) {
      ctx.fillStyle = "#f1f5f9";
      roundRect(ctx, x + 22, y + 112, tileW - 44, 118, 22);
      ctx.fill();
      ctx.fillStyle = "#64748b";
      ctx.font = "900 30px Inter, Arial, sans-serif";
      ctx.fillText("No stops assigned", x + 44, y + 178);
      return;
    }

    const jobsAreaTop = y + 106;
    const jobsAreaBottom = y + tileH - 24;
    const jobGap = 16;
    const maxRows = Math.max(1, Math.floor((jobsAreaBottom - jobsAreaTop + jobGap) / 140));
    const visibleJobs = section.jobs.slice(0, maxRows);
    const jobH = Math.max(126, Math.min(220, (jobsAreaBottom - jobsAreaTop - (visibleJobs.length - 1) * jobGap) / visibleJobs.length));

    visibleJobs.forEach((job, jobIndex) => {
      const jobY = jobsAreaTop + jobIndex * (jobH + jobGap);
      const accent = typeColor(job.type);
      roundRect(ctx, x + 20, jobY, tileW - 40, jobH, 22);
      ctx.fillStyle = "#f8fafc";
      ctx.fill();
      ctx.strokeStyle = "#dbeafe";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.fillRect(x + 20, jobY + 16, 10, jobH - 32);

      const leftX = x + 46;
      const textW = tileW - 92;
      ctx.fillStyle = "#0f172a";
      ctx.font = "900 26px Inter, Arial, sans-serif";
      wrapText(ctx, `${jobIndex + 1}. ${job.customer}`, textW).slice(0, 1).forEach((line) => ctx.fillText(line, leftX, jobY + 36));

      ctx.fillStyle = "#1d4ed8";
      ctx.font = "900 17px Inter, Arial, sans-serif";
      ctx.fillText("WHERE THEY'RE GOING", leftX, jobY + 65);
      ctx.font = "900 23px Inter, Arial, sans-serif";
      const addressLineCount = jobH >= 172 ? 2 : 1;
      wrapText(ctx, `📍 ${job.destination}`, textW).slice(0, addressLineCount).forEach((line, idx) => {
        ctx.fillText(line, leftX, jobY + 94 + idx * 27);
      });

      const lowerY = jobY + jobH - 42;
      const statusFill = job.statusValue === "completed" ? "#dcfce7" : job.statusValue === "in_progress" ? "#fef3c7" : "#e2e8f0";
      const statusColor = job.statusValue === "completed" ? "#15803d" : job.statusValue === "in_progress" ? "#b45309" : "#475569";
      pill(job.statusLabel, leftX, lowerY, 142, statusFill, statusColor);
      ctx.fillStyle = "#64748b";
      ctx.font = "850 18px Inter, Arial, sans-serif";
      ctx.fillText(shrinkText(job.crewShort || job.crew || "Unassigned", 34), leftX + 158, lowerY + 25);
    });

    if (section.jobs.length > visibleJobs.length) {
      ctx.fillStyle = "#fee2e2";
      roundRect(ctx, x + tileW - 170, y + tileH - 70, 138, 42, 999);
      ctx.fill();
      ctx.fillStyle = "#991b1b";
      ctx.font = "900 18px Inter, Arial, sans-serif";
      ctx.fillText(`+${section.jobs.length - visibleJobs.length} more`, x + tileW - 146, y + tileH - 43);
    }
  });

  ctx.font = "900 20px Inter, Arial, sans-serif";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText("Insulation Services of Tulsa · one-page truck agenda export", margin, canvas.height - 24);
  return canvas;
}

export function downloadDataUrl(dataUrl, fileName) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function exportDailyAgendaImage(agenda, { fileName = buildDailyAgendaFileName(agenda.date), width = 2400 } = {}) {
  const canvas = renderDailyAgendaCanvas(agenda, { width });
  const dataUrl = canvas.toDataURL("image/png");
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (blob && typeof navigator !== "undefined" && navigator.canShare) {
    const file = new File([blob], fileName, { type: "image/png" });
    if (navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: agenda.title, text: `${agenda.subtitle} for ${agenda.dateLabel}` });
      return { dataUrl, fileName, shared: true };
    }
  }
  downloadDataUrl(dataUrl, fileName);
  return { dataUrl, fileName, shared: false };
}
