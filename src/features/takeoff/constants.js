export const COMPANY = {
  name: "Insulation Services of Tulsa",
  tagline: "Serving Northeastern Oklahoma",
  phone: "1 (918) 232-9055",
};

export const SALESMAN_INFO = {
  Johnny: { fullName: "Johnny Casper", phone: "918-550-2396", email: "Johnny@istulsa.com" },
  Jordan: { fullName: "Jordan Beard", phone: "918-625-7820", email: "Jordan@istulsa.com" },
  Skip: { fullName: "Skip Owen", phone: "918-219-7890", email: "Skip@istulsa.com" },
};

export const LOCATIONS = [
  { id: "band_joist", label: "Band Joist Blocking", short: "Band Joist", type: "area", group: "Porch / Blocking" },
  { id: "ext_walls_house", label: "Boxed Exterior Walls of House", short: "Ext Walls House", type: "wall", group: "Walls" },
  { id: "ext_walls_garage", label: "Boxed Exterior Walls of Garage", short: "Ext Walls Garage", type: "wall", group: "Walls" },
  { id: "garage_common", label: "Garage Common Wall", short: "Garage Common", type: "wall", group: "Walls" },
  { id: "open_attic_walls", label: "Open Attic Walls", short: "Attic Walls", type: "wall", group: "Walls" },
  { id: "ext_slopes", label: "Boxed Exterior Slopes", short: "Ext Slopes", type: "slope", group: "Attic" },
  { id: "ext_kneewall", label: "Boxed Exterior Kneewall", short: "Ext Kneewall", type: "wall", group: "Attic" },
  { id: "attic_slopes", label: "Open Attic Slopes", short: "Attic Slopes", type: "area", group: "Attic" },
  { id: "attic_kneewall", label: "Open Attic Kneewall", short: "Attic Kneewall", type: "wall", group: "Attic" },
  { id: "flat_ceiling", label: "Flat Ceiling", short: "Flat Ceiling", type: "area", group: "Attic" },
  { id: "attic_area_house", label: "Open Attic Area of House", short: "Attic House", type: "area", group: "Attic" },
  { id: "attic_area_garage", label: "Open Attic Area of Garage", short: "Attic Garage", type: "area", group: "Attic" },
  { id: "gable_end", label: "Gable End", short: "Gable End", type: "area", group: "Roofline" },
  { id: "porch", label: "Porch", short: "Porch", type: "area", group: "Porch / Blocking" },
  { id: "porch_blocking", label: "Porch Blocking", short: "Porch Blocking", type: "area", group: "Porch / Blocking" },
  { id: "roofline", label: "Roofline", short: "Roofline", type: "roofline", group: "Roofline" },
  { id: "roofline_garage", label: "Roofline of Garage", short: "Roofline Garage", type: "roofline", group: "Roofline" },
  { id: "roofline_house", label: "Roofline of House", short: "Roofline House", type: "roofline", group: "Roofline" },
  { id: "custom", label: "Custom", short: "Custom", type: "area", group: "Other" },
];

export const GROUP_ORDER = ["Walls", "Attic", "Porch / Blocking", "Roofline", "Other"];

export const FIBERGLASS_MATERIALS = [
  "Blown Fiberglass",
  "R11 Fiberglass Batts",
  "R13 Fiberglass Batts",
  "R15 Fiberglass Batts",
  "R19 Fiberglass Batts",
  "R22 Blown Fiberglass",
  "R26 Blown Fiberglass",
  "R30 Fiberglass Batts",
  "R38 Fiberglass Batts",
  "Blown Cellulose",
  "Blown Rockwool",
  "Rockwool",
  '6" Rockwool',
  "Lambswool",
];

export const OPEN_CELL_MATERIALS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6].map(
  (n) => `${n}" Open Cell Foam`,
);

export const CLOSED_CELL_MATERIALS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6].map(
  (n) => `${n}" Closed Cell Foam`,
);

export const PITCH_FACTORS = {
  "Flat (0/12)": 1.0,
  "1/12": 1.003,
  "2/12": 1.014,
  "3/12": 1.031,
  "4/12": 1.054,
  "5/12": 1.083,
  "6/12": 1.118,
  "7/12": 1.158,
  "8/12": 1.202,
  "9/12": 1.25,
  "10/12": 1.302,
  "11/12": 1.357,
  "12/12": 1.414,
};

export const WALL_HEIGHTS = [
  { label: "8' walls (10.00 sq ft each)", sqftPer: 10 },
  { label: "9' walls (11.25 sq ft each)", sqftPer: 11.25 },
  { label: "10' walls (12.50 sq ft each)", sqftPer: 12.5 },
  { label: "11' walls (13.75 sq ft each)", sqftPer: 13.75 },
  { label: "12' walls (15.00 sq ft each)", sqftPer: 15 },
];

export const CAVITY_WIDTHS = [
  { value: "", label: "— Cavity Width —" },
  { value: "2x4", label: "2x4" },
  { value: "2x6", label: "2x6" },
  { value: "2x8", label: "2x8" },
];

export const Q_STATUS_CONFIG = {
  draft: { label: "Draft", color: "#6b7280", bg: "#f3f4f6" },
  quoted: { label: "Quoted", color: "#1a56db", bg: "#eef2ff" },
  pending: { label: "Pending", color: "#b45309", bg: "#fef3c7" },
  sold: { label: "Sold", color: "#15803d", bg: "#dcfce7" },
  lost: { label: "Lost", color: "#b91c1c", bg: "#fee2e2" },
};
