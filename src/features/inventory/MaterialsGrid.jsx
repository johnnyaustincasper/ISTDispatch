import React from "react";

import { shortInventoryItemName } from "../../inventoryDisplay.js";

// One-screen warehouse board — dense by design so inventory is visible without scrolling
export default function MaterialsGrid({
  inventory,
  inventoryItems,
  onUpdateInventory,
  stockStatus,
  stockColors,
  isFoam,
  bblToGals,
  galsToBbl,
  sortAllItems,
  statusFilterFn,
  searchLower,
  InventoryEditCellComponent,
}) {
  const getQty = (itemId) => (inventory.find(r => r.itemId === itemId)?.qty || 0);
  const getGroup = (item) => {
    const hay = `${item.name || ""} ${item.category || ""}`.toLowerCase();
    if (item.unit === "bbl" || hay.includes("foam")) return "Foam";
    if (hay.includes("blown") || hay.includes("cellulose") || hay.includes("rockwool") || hay.includes("lambswool")) return "Blown/Other";
    if (hay.includes("r11")) return "R11";
    if (hay.includes("r13") || hay.includes("r15")) return "R13/R15";
    if (hay.includes("r19") || hay.includes("r22") || hay.includes("r26")) return "R19+";
    if (hay.includes("r30") || hay.includes("r38")) return "R30+";
    return "Other";
  };
  const shortName = shortInventoryItemName;
  const GROUPS = ["Foam", "Blown/Other", "R11", "R13/R15", "R19+", "R30+", "Other"];
  const allVisible = sortAllItems(
    inventoryItems
      .filter(i => !i.isPieces)
      .filter(statusFilterFn)
      .filter(i => !searchLower || i.name.toLowerCase().includes(searchLower) || (i.category || "").toLowerCase().includes(searchLower))
  );
  const groups = GROUPS.map(group => {
    const items = allVisible.filter(item => getGroup(item) === group);
    return { group, items: group === "Blown/Other" ? items : [...items].sort((a, b) => getQty(b.id) - getQty(a.id)) };
  }).filter(section => section.items.length);
  const boardColors = { Foam: "#2563eb", "Blown/Other": "#16a34a", R11: "#7c3aed", "R13/R15": "#0f766e", "R19+": "#ea580c", "R30+": "#be123c", Other: "#64748b" };
  const formatQty = (item, qty) => isFoam(item.id) ? qty.toFixed(2) : String(qty);
  const formatUnit = (item) => isFoam(item.id) ? "bbl" : item.unit;
  const formatValue = (item, qty) => `$${((item.cost || 0) * qty).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  const formatSqft = (value) => Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });

  if (!allVisible.length) {
    return <div style={{ flex: 1, display: "grid", placeItems: "center", color: "#94a3b8", fontSize: 14, background: "#f8fafc" }}>No materials match those filters.</div>;
  }

  return (
    <div className="materials-board-wrap" style={{ flex: 1, overflow: "hidden", background: "#f8fafc", padding: 8 }}>
      <div className="materials-board-grid" style={{ height: "100%", display: "grid", gridTemplateColumns: `repeat(${groups.length}, minmax(0, 1fr))`, gap: 6 }}>
        {groups.map(({ group, items }) => (
          <section key={group} className="materials-board-section" style={{ minWidth: 0, background: "#ffffff", border: "1px solid #dbe3ef", borderRadius: 10, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div className="materials-board-header" style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 7px", background: boardColors[group], color: "#fff" }}>
              <span style={{ fontSize: 11, fontWeight: 950, letterSpacing: "0.02em" }}>{group}</span>
              <span style={{ fontSize: 10, fontWeight: 900, opacity: 0.9 }}>{items.length}</span>
            </div>
            <div className="materials-board-rows" style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateRows: `repeat(${Math.max(items.length, 1)}, minmax(0, 1fr))` }}>
              {items.map((item, idx) => {
                const qty = getQty(item.id);
                const status = stockStatus(qty);
                const sc = stockColors[status];
                const pcsItem = item.hasPieces ? inventoryItems.find(i => i.parentId === item.id) : null;
                const pcsQty = pcsItem ? getQty(pcsItem.id) : 0;
                const lineValue = formatValue(item, qty);
                const sqftPerTube = Number(item.sqftPerTube || 0);
                const totalSqft = sqftPerTube > 0 ? sqftPerTube * qty : 0;
                return (
                  <div key={item.id} className="materials-board-row" style={{ minHeight: 0, display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", alignItems: "center", gap: 4, padding: "2px 5px", borderBottom: idx < items.length - 1 ? "1px solid #edf2f7" : "none", background: status === "out" ? "#fff1f2" : status === "low" ? "#fffbeb" : "#fff" }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="materials-item-name" title={item.name} style={{ fontSize: 11, fontWeight: 900, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.05 }}>{shortName(item)}</div>
                      <div className="materials-item-meta" style={{ display: "flex", gap: 3, alignItems: "center", minWidth: 0, marginTop: 1, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 8.5, fontWeight: 900, color: sc.badgeColor, lineHeight: 1 }}>{sc.label || "OK"}</span>
                        <span style={{ fontSize: 8.5, color: "#15803d", fontWeight: 900, lineHeight: 1 }}>{lineValue}</span>
                        {sqftPerTube > 0 && <span title={`${formatSqft(sqftPerTube)} square feet per tube`} style={{ fontSize: 8.5, color: "#0369a1", fontWeight: 900, lineHeight: 1 }}>{formatSqft(sqftPerTube)} sf/tube</span>}
                        {totalSqft > 0 && <span title={`${formatSqft(totalSqft)} total square feet on hand`} style={{ fontSize: 8.5, color: "#7c2d12", fontWeight: 900, lineHeight: 1 }}>{formatSqft(totalSqft)} sf</span>}
                        {pcsItem && pcsQty > 0 && <span style={{ fontSize: 8.5, color: "#4f46e5", fontWeight: 900, lineHeight: 1 }}>+{pcsQty}pc</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                      <div className="materials-qty-stack" style={{ textAlign: "right", minWidth: 26 }}>
                        <div style={{ fontSize: 15, fontWeight: 950, color: sc.text, lineHeight: 1, letterSpacing: "-0.5px" }}>{formatQty(item, qty)}</div>
                        <div style={{ fontSize: 8.5, color: "#64748b", fontWeight: 800, lineHeight: 1 }}>{formatUnit(item)}</div>
                      </div>
                      <InventoryEditCellComponent itemId={item.id} qty={qty} isFoam={isFoam(item.id)} bblToGals={bblToGals} galsToBbl={galsToBbl} pcsItem={pcsItem} pcsQty={pcsQty} onUpdateInventory={onUpdateInventory} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
