import React, { useMemo } from "react";

import {
  createDebugSnapshotPayload,
  summarizeCollectionCounts,
  summarizeListenerFreshness,
  summarizeParity,
} from "../../diagnostics.js";

const cardStyle = (accent = "#2563eb") => ({
  background: "#fff",
  border: "1px solid #dbe3ef",
  borderRadius: 16,
  padding: 16,
  boxShadow: "0 10px 28px rgba(15,23,42,0.06)",
  borderTop: `4px solid ${accent}`,
});

const StatusPill = ({ status, children }) => {
  const palette = {
    fresh: ["#15803d", "#dcfce7"],
    stale: ["#b45309", "#fef3c7"],
    never: ["#64748b", "#f1f5f9"],
    error: ["#b91c1c", "#fee2e2"],
    ok: ["#15803d", "#dcfce7"],
    bad: ["#b91c1c", "#fee2e2"],
  };
  const [color, bg] = palette[status] || palette.never;
  return <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "4px 8px", fontSize: 11, fontWeight: 900, color, background: bg }}>{children || status}</span>;
};

export default function AdminDiagnosticsView({ collections = {}, listeners = {}, parity = {}, errors = [], context = {} }) {
  const collectionSummary = useMemo(() => summarizeCollectionCounts(collections), [collections]);
  const freshness = useMemo(() => summarizeListenerFreshness(listeners, { staleAfterMinutes: 5 }), [listeners]);
  const paritySummary = useMemo(() => summarizeParity(parity), [parity]);
  const payload = useMemo(() => createDebugSnapshotPayload({ collections, listeners, errors, context, ...parity }, { staleAfterMinutes: 5 }), [collections, listeners, errors, context, parity]);

  const exportJson = () => {
    const text = JSON.stringify(payload, null, 2);
    if (typeof window === "undefined") return;
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ist-dispatch-debug-${payload.generatedAt.replace(/[:.]/g, "-")}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const copyJson = async () => {
    const text = JSON.stringify(payload, null, 2);
    if (navigator?.clipboard?.writeText) await navigator.clipboard.writeText(text);
  };

  const listenerRows = Object.entries(freshness.listeners || {}).sort(([a], [b]) => a.localeCompare(b));
  const collectionRows = Object.entries(collectionSummary.collections || {}).sort(([a], [b]) => a.localeCompare(b));
  const truckParityRows = Object.entries(paritySummary.truckInventoryParity || {}).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.16em", textTransform: "uppercase", color: "#64748b" }}>Admin diagnostics</div>
          <h1 style={{ margin: "4px 0 0", color: "#0f172a", fontSize: "clamp(26px,4vw,42px)", letterSpacing: "-1.4px" }}>Live app health</h1>
          <div style={{ color: "#64748b", fontSize: 13, marginTop: 6 }}>Firestore counts, listener freshness, inventory parity, and client-side error export.</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={copyJson} style={{ border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", borderRadius: 12, padding: "10px 12px", fontWeight: 900, cursor: "pointer", fontFamily: "inherit" }}>Copy JSON</button>
          <button onClick={exportJson} style={{ border: "1px solid #0f172a", background: "#0f172a", color: "#fff", borderRadius: 12, padding: "10px 12px", fontWeight: 900, cursor: "pointer", fontFamily: "inherit" }}>Export Debug Snapshot</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
        <div style={cardStyle("#2563eb")}><div style={{ fontSize: 11, color: "#64748b", fontWeight: 900, textTransform: "uppercase" }}>Documents loaded</div><div style={{ fontSize: 30, fontWeight: 950, color: "#0f172a" }}>{collectionSummary.totalDocuments}</div><div style={{ fontSize: 12, color: "#64748b" }}>{collectionSummary.loadedCollections}/{collectionSummary.totalCollections} collections</div></div>
        <div style={cardStyle(freshness.errors ? "#dc2626" : freshness.stale ? "#f59e0b" : "#16a34a")}><div style={{ fontSize: 11, color: "#64748b", fontWeight: 900, textTransform: "uppercase" }}>Listeners</div><div style={{ fontSize: 30, fontWeight: 950, color: "#0f172a" }}>{freshness.fresh}/{freshness.total}</div><div style={{ fontSize: 12, color: "#64748b" }}>{freshness.errors} errors · {freshness.stale} stale · {freshness.never} never</div></div>
        <div style={cardStyle(paritySummary.ok === false ? "#dc2626" : "#16a34a")}><div style={{ fontSize: 11, color: "#64748b", fontWeight: 900, textTransform: "uppercase" }}>Parity checks</div><div style={{ fontSize: 30, fontWeight: 950, color: "#0f172a" }}>{paritySummary.passed}/{paritySummary.totalChecks}</div><div style={{ fontSize: 12, color: "#64748b" }}>{paritySummary.failed} failing</div></div>
        <div style={cardStyle(errors.length ? "#dc2626" : "#94a3b8")}><div style={{ fontSize: 11, color: "#64748b", fontWeight: 900, textTransform: "uppercase" }}>Client errors</div><div style={{ fontSize: 30, fontWeight: 950, color: "#0f172a" }}>{errors.length}</div><div style={{ fontSize: 12, color: "#64748b" }}>Captured this browser session</div></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 14 }}>
        <section style={cardStyle("#2563eb")}>
          <h2 style={{ margin: "0 0 10px", fontSize: 16, color: "#0f172a" }}>Collection counts</h2>
          <div style={{ display: "grid", gap: 7 }}>
            {collectionRows.map(([name, row]) => <div key={name} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, borderBottom: "1px solid #edf2f7", paddingBottom: 6 }}><span style={{ fontWeight: 800, color: "#0f172a" }}>{name}</span><span style={{ color: "#64748b" }}>{row.count} · {row.type}</span></div>)}
          </div>
        </section>

        <section style={cardStyle(freshness.errors ? "#dc2626" : "#16a34a")}>
          <h2 style={{ margin: "0 0 10px", fontSize: 16, color: "#0f172a" }}>Listener freshness</h2>
          <div style={{ display: "grid", gap: 7 }}>
            {listenerRows.map(([name, row]) => <div key={name} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, alignItems: "center", fontSize: 13, borderBottom: "1px solid #edf2f7", paddingBottom: 6 }}><div style={{ minWidth: 0 }}><div style={{ fontWeight: 800, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div><div style={{ color: "#64748b", fontSize: 11 }}>{row.lastSnapshotAt ? `${row.ageMinutes ?? 0} min ago` : "No snapshot"}{listeners[name]?.docCount != null ? ` · ${listeners[name].docCount} docs` : ""}</div>{row.error && <div style={{ color: "#b91c1c", fontSize: 11 }}>{row.error.message}</div>}</div><StatusPill status={row.status}>{row.status}</StatusPill></div>)}
          </div>
        </section>
      </div>

      <section style={cardStyle(paritySummary.ok === false ? "#dc2626" : "#16a34a")}>
        <h2 style={{ margin: "0 0 10px", fontSize: 16, color: "#0f172a" }}>Inventory parity</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
          <div><div style={{ fontSize: 11, color: "#64748b", fontWeight: 900 }}>Warehouse</div><StatusPill status={paritySummary.warehouseInventoryParity?.ok === false ? "bad" : "ok"}>{paritySummary.warehouseInventoryParity?.mismatchCount || 0} mismatches</StatusPill></div>
          <div><div style={{ fontSize: 11, color: "#64748b", fontWeight: 900 }}>Job usage</div><StatusPill status={paritySummary.jobUsageParitySummary?.ok === false ? "bad" : "ok"}>{paritySummary.jobUsageParitySummary?.mismatchCount || 0} mismatches</StatusPill></div>
          <div><div style={{ fontSize: 11, color: "#64748b", fontWeight: 900 }}>Truck checks</div><StatusPill status={paritySummary.failed ? "bad" : "ok"}>{truckParityRows.length} trucks</StatusPill></div>
        </div>
      </section>

      {errors.length > 0 && <section style={cardStyle("#dc2626")}><h2 style={{ margin: "0 0 10px", fontSize: 16, color: "#0f172a" }}>Recent client errors</h2><pre style={{ margin: 0, maxHeight: 260, overflow: "auto", whiteSpace: "pre-wrap", background: "#0f172a", color: "#e2e8f0", borderRadius: 12, padding: 12, fontSize: 11 }}>{JSON.stringify(errors.slice(-5), null, 2)}</pre></section>}
    </div>
  );
}
