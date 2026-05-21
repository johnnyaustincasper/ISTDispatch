export const CREW_JOB_STATUS_META = Object.freeze({
  not_started: {
    label: "Not Started",
    tone: "neutral",
    color: "#475569",
    bg: "#f8fafc",
    border: "#e2e8f0",
    eyebrow: "Ready when you are",
  },
  in_progress: {
    label: "In Progress",
    tone: "warning",
    color: "#b45309",
    bg: "#fffbeb",
    border: "#fde68a",
    eyebrow: "Started",
  },
  completed: {
    label: "Completed",
    tone: "success",
    color: "#15803d",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    eyebrow: "Wrapped up",
  },
  issue: {
    label: "Needs Help",
    tone: "danger",
    color: "#b91c1c",
    bg: "#fef2f2",
    border: "#fecaca",
    eyebrow: "Office help needed",
  },
});

export const getCrewJobStatusMeta = (status = "not_started") => (
  CREW_JOB_STATUS_META[status] || CREW_JOB_STATUS_META.not_started
);

export const buildCrewJobActionModel = ({ status = "not_started", hasTodayMaterials = false, missingMaterialDays = [] } = {}) => {
  const missingCount = missingMaterialDays.length;
  const materialsLabel = hasTodayMaterials ? "Edit Materials" : "Log Materials";

  if (status === "completed") {
    return {
      primary: { key: "reopen", label: "Reopen Job", status: "in_progress", tone: "outline" },
      secondary: [
        { key: "materials", label: materialsLabel, tone: "neutral" },
        { key: "details", label: "Photos & Activity", tone: "neutral" },
      ],
      prompt: hasTodayMaterials ? "Completed with today’s materials logged." : "Completed — add materials if anything was missed.",
    };
  }

  if (status === "not_started") {
    return {
      primary: { key: "start", label: "Start Job", status: "in_progress", tone: "primary" },
      secondary: [
        { key: "materials", label: materialsLabel, tone: "neutral" },
        { key: "issue", label: "Need Help", status: "issue", tone: "danger" },
      ],
      prompt: missingCount ? `${missingCount} prior material day${missingCount === 1 ? "" : "s"} need attention.` : "Start the job when you arrive on site.",
    };
  }

  return {
    primary: { key: "complete", label: "Finish Job", status: "completed", tone: "success" },
    secondary: [
      { key: "materials", label: materialsLabel, tone: hasTodayMaterials ? "success" : "neutral" },
      { key: "update", label: "Send Update", tone: "neutral" },
      ...(status === "issue" ? [] : [{ key: "issue", label: "Need Help", status: "issue", tone: "danger" }]),
    ],
    prompt: hasTodayMaterials ? "Materials are logged for today. Finish when the work is done." : "Before leaving, log today’s materials and finish the job.",
  };
};
