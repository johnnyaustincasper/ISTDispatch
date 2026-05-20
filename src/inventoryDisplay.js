export const shortInventoryItemName = (item = {}) => {
  const cat = item.category || "";
  const raw = item.name || "";
  const brand = cat.includes("Certainteed") ? "CT" : cat.includes("Owens Corning") ? "OC" : cat.includes("Johns Manville") ? "JM" : cat.includes("Orkin") ? "Orkin" : "";
  if (item.unit === "bbl") return raw;
  if (cat === "Rockwool" || cat === "Lambswool") return raw;
  if (cat === "Blown") {
    return raw
      .replace(/Certainteed Blown Fiberglass/i, "CT Blown FG")
      .replace(/JM Blown Fiberglass/i, "JM Blown FG")
      .replace(/Blown Cellulose/i, "Cellulose");
  }
  const r = raw.match(/R\d+/i)?.[0] || cat.match(/R\d+/i)?.[0] || "";
  const dims = raw.match(/x\s*([\d.]+\")\s*x\s*([\d.]+\")/i);
  if (r && dims) return `${brand ? brand + " " : ""}${r} ${dims[1]}×${dims[2]}`;
  return raw
    .replace(/Fiberglass/gi, "FG")
    .replace(/Certainteed/gi, "CT")
    .replace(/Owens Corning/gi, "OC")
    .replace(/Johns Manville/gi, "JM")
    .replace(/Rockwool/gi, "RW")
    .replace(/Lambswool/gi, "LW")
    .replace(/\s+/g, " ")
    .trim();
};
