import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactDOM from "react-dom";

import { db, storage } from "./firebase.js";
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
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { jsPDF } from "jspdf";

// ─── Constants ───
const JOB_TYPES = ["Foam","Fiberglass","Removal","Energy Seal"];
const ES_JOB_TYPES = ["Energy Seal","Air Seal","Weatherization","Other"];
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

  { id: "oc_r13_15_8_t",   name: "Owens Corning R13 x 15\" x 93\" (8ft)", pcsPerTube: 13, sqftPerTube: 125.94, unit: "tubes", category: "Owens Corning R13", hasPieces: true },
  { id: "oc_r13_15_8_pcs", name: "Owens Corning R13 x 15\" x 93\" (8ft)", unit: "pcs",   category: "Owens Corning R13", isPieces: true, parentId: "oc_r13_15_8_t" },

  { id: "oc_r19_15_8_t",   name: "Owens Corning R19 x 15\" x 93\" (8ft)", pcsPerTube: 9,  sqftPerTube: 87.19, unit: "tubes", category: "Owens Corning R19", hasPieces: true },
  { id: "oc_r19_15_8_pcs", name: "Owens Corning R19 x 15\" x 93\" (8ft)", unit: "pcs",   category: "Owens Corning R19", isPieces: true, parentId: "oc_r19_15_8_t" },
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
const FOAM_GUN_PARTS = [
  // ── Drill Bits ──
  { id: "fgp_drill_47",        name: "#47 Drill Bits",              unit: "pcs",   category: "Drill Bits" },
  { id: "fgp_drill_52",        name: "#52 Drill Bits",              unit: "pcs",   category: "Drill Bits" },
  // ── Repair Kits ──
  { id: "fgp_kit_246355",      name: "246355 Rebuild Kit",          unit: "units", category: "Repair Kits" },
  { id: "fgp_kit_248212_open", name: "248212 T1 Pump Repair Kit (Opened)", unit: "units", category: "Repair Kits" },
  { id: "fgp_kit_t1_unopened", name: "T1 Repair Kit (Unopened)",   unit: "units", category: "Repair Kits" },
  { id: "fgp_kit_lower_t1",    name: "Lower Repair Kit T1",         unit: "units", category: "Repair Kits" },
  // ── O-Rings & Seals ──
  { id: "fgp_oring_00043b",    name: "00043B O-Rings",             unit: "pcs",   category: "O-Rings & Seals" },
  { id: "fgp_ring_backcap",    name: "Back Cap Ring",              unit: "pcs",   category: "O-Rings & Seals" },
  { id: "fgp_oring_fluid_hsg", name: "Fluid Housing O-Ring",       unit: "pcs",   category: "O-Rings & Seals" },
  { id: "fgp_ring_white_misc", name: "Misc White Rings",           unit: "pcs",   category: "O-Rings & Seals" },
  { id: "fgp_oring_small",     name: "Small O-Ring",              unit: "pcs",   category: "O-Rings & Seals" },
  { id: "fgp_seal_side_black", name: "Side Seals (Black)",         unit: "pcs",   category: "O-Rings & Seals" },
  { id: "fgp_seal_side_white", name: "Side Seals (White)",         unit: "pcs",   category: "O-Rings & Seals" },
  { id: "fgp_oring_trigger",   name: "Trigger O-Rings",           unit: "pcs",   category: "O-Rings & Seals" },
  // ── Parts & Valves ──
  { id: "fgp_part_202248",     name: "202248",                    unit: "units", category: "Parts & Valves" },
  { id: "fgp_part_248129",     name: "248129",                    unit: "units", category: "Parts & Valves" },
  { id: "fgp_part_248133",     name: "248133",                    unit: "units", category: "Parts & Valves" },
  { id: "fgp_valve_check",     name: "Check Valve",               unit: "units", category: "Parts & Valves" },
  { id: "fgp_valve_spring",    name: "Check Valve Spring",        unit: "units", category: "Parts & Valves" },
];

const PROJECT_TOOLS_ITEMS = [
  // ── Power Tools ──
  { id: "pt_drill_dewalt",      name: "DeWalt Drill w/ Batteries x2 + Charger", unit: "units", category: "Power Tools" },
  { id: "pt_drill_mitool",      name: "Mitool Drill w/ Battery + Charger",       unit: "units", category: "Power Tools" },
  { id: "pt_drill_hilti",       name: "Hilti Drill",                             unit: "units", category: "Power Tools" },
  { id: "pt_drill_kobalt",      name: "Corded Drill Kobalt (Paint Mixer)",       unit: "units", category: "Power Tools" },
  { id: "pt_saw_hilti",         name: "Hilti Skill Saw",                         unit: "units", category: "Power Tools" },
  { id: "pt_saw_foam",          name: "Foam Wall Saw",                           unit: "units", category: "Power Tools" },
  { id: "pt_foamzall",          name: "Foamzall (Rebuilt)",                      unit: "units", category: "Power Tools" },
  { id: "pt_grinder_dewalt",    name: "DeWalt Grinder",                         unit: "units", category: "Power Tools" },
  { id: "pt_hilti_dx5",         name: "Hilti DX5",                              unit: "units", category: "Power Tools" },
  { id: "pt_hilti_nuron_chgr",  name: "Hilti Nuron Charger",                    unit: "units", category: "Power Tools" },
  { id: "pt_light_dewalt",      name: "DeWalt Light",                           unit: "units", category: "Power Tools" },
  { id: "pt_pump_rebuild",      name: "Pump (Needs Rebuild)",                   unit: "units", category: "Power Tools" },
  // ── Hand Tools ──
  { id: "pt_knife_utility_box", name: "Box Utility Knives",                     unit: "units", category: "Hand Tools" },
  { id: "pt_hammer_framing",    name: "Framing Hammer",                         unit: "units", category: "Hand Tools" },
  { id: "pt_level",             name: "Level",                                  unit: "units", category: "Hand Tools" },
  { id: "pt_nut_driver",        name: "Nut Driver",                             unit: "units", category: "Hand Tools" },
  { id: "pt_socket_set",        name: "Socket Set (Craftsman)",                 unit: "units", category: "Hand Tools" },
  { id: "pt_speed_square",      name: "Speed Square",                           unit: "units", category: "Hand Tools" },
  // ── Tape & Caulk ──
  { id: "pt_tape_caution",      name: "Caution Tape",                           unit: "rolls", category: "Tape & Caulk" },
  { id: "pt_tape_duct",         name: "Duct Tape",                              unit: "rolls", category: "Tape & Caulk" },
  { id: "pt_tape_painter_125",  name: "Painters Tape 1-1/4\"",                  unit: "rolls", category: "Tape & Caulk" },
  { id: "pt_tape_painter_2in",  name: "Painters Tape 2\"",                      unit: "rolls", category: "Tape & Caulk" },
  { id: "pt_tape_vinyl_red",    name: "Red Vinyl Tape",                         unit: "rolls", category: "Tape & Caulk" },
  { id: "pt_caulk_bigstretch",  name: "Big Stretch Caulk",                     unit: "tubes", category: "Tape & Caulk" },
  // ── PPE ──
  { id: "pt_ppe_3m_filters",    name: "3M Triangular Filters",                 unit: "units", category: "PPE" },
  { id: "pt_ppe_bullard_filt",  name: "Bullard Filters",                       unit: "units", category: "PPE" },
  { id: "pt_ppe_bullard_resp",  name: "Bullard Respirator",                    unit: "units", category: "PPE" },
  { id: "pt_ppe_curry_comb",    name: "Curry Combs",                           unit: "units", category: "Hand Tools" },
  { id: "pt_ppe_earplugs",      name: "Ear Plugs (case)",                      unit: "cases", category: "PPE" },
  { id: "pt_ppe_head_socks",    name: "Head Socks Black (box)",                unit: "boxes", category: "PPE" },
  { id: "pt_ppe_honeywell",     name: "Honeywell Filters",                     unit: "units", category: "PPE" },
  { id: "pt_ppe_prosuits_2xl",  name: "2XL Prosuits",                          unit: "units", category: "PPE" },
  // ── Chemicals & Fluids ──
  { id: "pt_chem_chemtrend",    name: "Chemtrend Release",                     unit: "units", category: "Chemicals & Fluids" },
  { id: "pt_chem_def",          name: "Diesel Exhaust Fluid (DEF)",            unit: "jugs",  category: "Chemicals & Fluids" },
  { id: "pt_chem_dynasolve",    name: "Dynasolve",                             unit: "units", category: "Chemicals & Fluids" },
  { id: "pt_chem_frothpack",    name: "Frothpack",                             unit: "units", category: "Chemicals & Fluids" },
  { id: "pt_chem_serum1000",    name: "Serum 1000",                            unit: "units", category: "Chemicals & Fluids" },
  { id: "pt_chem_sterofab",     name: "Sterofab",                              unit: "units", category: "Chemicals & Fluids" },
  // ── Supplies & Accessories ──
  { id: "pt_sup_batteries_aaa", name: "AAA Batteries",                         unit: "pcs",   category: "Supplies & Accessories" },
  { id: "pt_sup_air_chutes",    name: "Air Chutes (bundle)",                   unit: "bundles", category: "Supplies & Accessories" },
  { id: "pt_sup_locks_keys",    name: "BX Locks & Keys (Interior Door)",       unit: "sets",  category: "Supplies & Accessories" },
  { id: "pt_sup_energy_seal",   name: "Energy Seal (cans)",                    unit: "cans",  category: "Supplies & Accessories" },
  { id: "pt_sup_ext_cord_100",  name: "Extension Cord 100ft",                 unit: "units", category: "Supplies & Accessories" },
  { id: "pt_sup_air_hose",      name: "Fresh Air Hoses",                       unit: "units", category: "Supplies & Accessories" },
  { id: "pt_sup_garbage_bags",  name: "Hefty Garbage Bags",                    unit: "boxes", category: "Supplies & Accessories" },
  { id: "pt_sup_headlamps",     name: "Headlamps",                             unit: "units", category: "Supplies & Accessories" },
  { id: "pt_sup_poly_10mil",    name: "Poly 10mil (rolls)",                   unit: "rolls", category: "Supplies & Accessories" },
  { id: "pt_sup_poly_2mil",     name: "Poly 2mil (sheets)",                   unit: "units", category: "Supplies & Accessories" },
  // ── Fasteners ──
  { id: "pt_fast_shots",        name: "Shots",                                 unit: "units", category: "Fasteners" },
  { id: "pt_fast_bolts_plastic", name: "Plastic Bolts",                        unit: "units", category: "Fasteners" },
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
  return <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: "99px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.3px", textTransform: "uppercase", color: color || t.accent, background: bg || t.accentBg, whiteSpace: "nowrap" }}>{children}</span>;
}

function Button({ children, onClick, variant = "primary", style: s, disabled }) {
  const base = { padding: "11px 20px", border: "none", borderRadius: "9px", fontWeight: 600, fontSize: "14px", cursor: disabled ? "not-allowed" : "pointer", transition: "all 0.15s ease", opacity: disabled ? 0.45 : 1, fontFamily: "inherit", minHeight: "44px", display: "inline-flex", alignItems: "center", justifyContent: "center" };
  const v = {
    primary: { background: t.accent, color: "#fff", boxShadow: "0 1px 4px rgba(26,86,219,0.3)" },
    secondary: { background: t.bg, color: t.textSecondary, border: "1px solid " + t.border },
    danger: { background: t.dangerBg, color: t.danger, border: "1px solid #fecaca" },
    ghost: { background: "transparent", color: t.textMuted, padding: "8px 12px", minHeight: "36px" },
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...v[variant], ...s }}>{children}</button>;
}

function Input({ label, ...props }) {
  return (
    <div style={{ marginBottom: "16px" }}>
      {label && <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: t.textSecondary, marginBottom: "5px" }}>{label}</label>}
      <input {...props} style={{ width: "100%", padding: "9px 12px", background: "#fff", border: "1px solid " + t.border, borderRadius: "6px", color: t.text, fontSize: "14px", fontFamily: "inherit", outline: "none", boxSizing: "border-box", ...(props.style || {}) }} onFocus={(e) => { e.target.style.borderColor = t.accent; setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "nearest" }), 320); }} onBlur={(e) => e.target.style.borderColor = t.border} />
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
      <textarea {...props} style={{ width: "100%", padding: "9px 12px", background: "#fff", border: "1px solid " + t.border, borderRadius: "6px", color: t.text, fontSize: "14px", fontFamily: "inherit", outline: "none", resize: "vertical", minHeight: "80px", boxSizing: "border-box", ...(props.style || {}) }} onFocus={(e) => { e.target.style.borderColor = t.accent; setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "nearest" }), 320); }} onBlur={(e) => e.target.style.borderColor = t.border} />
    </div>
  );
}

function Card({ children, style: s, onClick }) {
  return (
    <div onClick={onClick} style={{ background: t.card, border: "1px solid " + t.border, borderRadius: "12px", padding: "16px 18px", marginBottom: "12px", cursor: onClick ? "pointer" : "default", transition: "all 0.15s ease", boxShadow: t.shadow, ...s }}
      onMouseEnter={(e) => { if (onClick) { e.currentTarget.style.borderColor = s?.borderColor || t.accent; e.currentTarget.style.boxShadow = t.shadowMd; } }}
      onMouseLeave={(e) => { if (onClick) { e.currentTarget.style.borderColor = s?.borderColor || t.border; e.currentTarget.style.boxShadow = t.shadow; } }}>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children, footer }) {
  return (
    <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", justifyContent: "center", zIndex: 1000 }} onClick={onClose}>
      <div className="modal-container" style={{ background: t.card, border: "1px solid " + t.border, padding: "16px", maxWidth: "480px", width: "100%", maxHeight: "85dvh", display: "flex", flexDirection: "column", boxShadow: t.shadowMd }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", paddingBottom: "14px", borderBottom: "1px solid " + t.border, flexShrink: 0 }}>
          <h2 style={{ fontSize: "17px", fontWeight: 600, color: t.text, margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: t.surface, border: "1px solid " + t.border, color: t.textMuted, minWidth: "44px", minHeight: "44px", width: "44px", height: "44px", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", flexShrink: 0 }}>✕</button>
        </div>
        <div style={{ overflowY: "auto", flex: 1, paddingBottom: footer ? "0" : "env(safe-area-inset-bottom, 8px)" }}>
          {children}
        </div>
        {footer && (
          <div style={{ flexShrink: 0, paddingTop: "12px", borderTop: "1px solid " + t.border, paddingBottom: "env(safe-area-inset-bottom, 12px)", background: t.card }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ title, right }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", flexWrap: "wrap", gap: "10px" }}>
      <h2 style={{ fontSize: "20px", fontWeight: 800, color: t.text, margin: 0, letterSpacing: "-0.3px" }}>{title}</h2>
      {right && <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>{right}</div>}
    </div>
  );
}

function EmptyState({ text, sub }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 24px", borderRadius: "12px", border: "2px dashed " + t.border, background: t.surface, marginBottom: "12px" }}>
      <div style={{ fontSize: "32px", marginBottom: "12px", opacity: 0.4 }}>📋</div>
      <div style={{ color: t.textSecondary, fontSize: "15px", fontWeight: 600 }}>{text}</div>
      {sub && <div style={{ color: t.textMuted, fontSize: "13px", marginTop: "6px", lineHeight: 1.5 }}>{sub}</div>}
    </div>
  );
}

// ─── Screens ───

// ─── Avatar helpers ───
const AVATAR_COLORS = [
  "#e11d48","#7c3aed","#2563eb","#0891b2","#059669",
  "#d97706","#dc2626","#db2777","#16a34a","#9333ea"
];
const nameToColor = (name) => {
  let h = 0;
  const s = (name || "").toLowerCase();
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
};
const getInitials = (name) => {
  const parts = (name || "").trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (name || "?").slice(0, 2).toUpperCase();
};

function AvatarButton({ name, onClick, disabled, badge }) {
  const color = nameToColor(name);
  const initials = getInitials(name);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="avatar-btn"
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: "8px",
        background: "transparent", border: "none", cursor: disabled ? "wait" : "pointer",
        padding: "8px 4px", borderRadius: "12px", fontFamily: "inherit",
        opacity: disabled ? 0.5 : 1, transition: "opacity 0.15s",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <div style={{
        width: 68, height: 68, borderRadius: "50%",
        background: "rgba(255,255,255,0.15)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.3)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 22, fontWeight: 800, color: "#fff",
        boxShadow: `0 4px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.3), 0 0 20px ${color}66`,
        position: "relative",
        transition: "box-shadow 0.2s, transform 0.2s",
        textShadow: "0 1px 4px rgba(0,0,0,0.4)",
      }}>
        {initials}
        {badge && (
          <span style={{
            position: "absolute", top: -3, right: -3,
            background: "#2563eb", color: "#fff",
            fontSize: 9, fontWeight: 700, borderRadius: "99px",
            padding: "2px 5px", whiteSpace: "nowrap",
            border: "2px solid rgba(0,0,0,0.3)",
          }}>{badge}</span>
        )}
      </div>
      <span style={{ fontSize: 12, color: "#ffffff", textAlign: "center", lineHeight: 1.3, maxWidth: 80, wordBreak: "break-word" }}>{name}</span>
    </button>
  );
}

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
  @keyframes tabFadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes badgePulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.15); }
  }
  @keyframes toastSlide {
    from { opacity: 0; transform: translateX(40px); }
    to { opacity: 1; transform: translateX(0); }
  }
  .kb-img { position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;animation:kenburns 20s ease-in-out infinite;transform-origin:center center; }
  .kb-overlay { position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,0.55) 0%,rgba(0,0,0,0.35) 50%,rgba(0,0,0,0.65) 100%); }
  .kb-content { animation: authFadeIn 0.45s cubic-bezier(0.16,1,0.3,1) both; }
  .kb-back-btn { background:rgba(255,255,255,0.35)!important;border:1px solid rgba(255,255,255,0.4)!important;color:#0f172a!important;backdrop-filter:blur(8px); }
  .kb-card { background:rgba(255,255,255,0.1)!important;-webkit-backdrop-filter:blur(16px)!important;backdrop-filter:blur(16px)!important;border:1px solid rgba(255,255,255,0.22)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,0.15), 0 4px 24px rgba(0,0,0,0.35)!important;transition:background 0.2s,transform 0.2s!important; }
  .kb-card:hover { background:rgba(255,255,255,0.18)!important;transform:translateY(-2px);border-color:rgba(255,255,255,0.35)!important; }
  .kb-input { background:rgba(255,255,255,0.12)!important;border:1px solid rgba(255,255,255,0.25)!important;color:#fff!important; }
  .kb-input::placeholder { color:rgba(255,255,255,0.4)!important; }
  .kb-input:focus { border-color:rgba(255,255,255,0.6)!important; }
  .tab-view-enter { animation: tabFadeIn 0.18s cubic-bezier(0.16,1,0.3,1) both; }
  .nav-tab-btn:active { transform: scale(0.94); }
  .crew-tab-btn:active { opacity: 0.75; transform: scale(0.96); }
  * { -webkit-tap-highlight-color: transparent; }
  .glass-card { background: rgba(255,255,255,0.07) !important; -webkit-backdrop-filter: blur(12px) !important; backdrop-filter: blur(12px) !important; border: 1px solid rgba(255,255,255,0.12) !important; }
  .glass-card:hover { background: rgba(255,255,255,0.12) !important; border-color: rgba(255,255,255,0.22) !important; }
  .glass-header { background: rgba(15,23,42,0.7) !important; -webkit-backdrop-filter: blur(20px) !important; backdrop-filter: blur(20px) !important; border-bottom: 1px solid rgba(255,255,255,0.08) !important; }
  .glass-nav { background: rgba(15,23,42,0.8) !important; -webkit-backdrop-filter: blur(16px) !important; backdrop-filter: blur(16px) !important; border-top: 1px solid rgba(255,255,255,0.08) !important; }
  .compact-form > div { margin-bottom: 10px !important; }
  .compact-form label { font-size: 11px !important; margin-bottom: 3px !important; }
  .compact-form input, .compact-form select, .compact-form textarea { padding: 6px 10px !important; font-size: 13px !important; }
  .auth-glow { position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 40%, rgba(37,99,235,0.18) 0%, transparent 70%); pointer-events: none; z-index: 0; }
  .avatar-btn:hover > div { transform: scale(1.08); box-shadow: 0 6px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.4), 0 0 32px rgba(255,255,255,0.25)!important; }
  .avatar-btn:active > div { transform: scale(0.95); box-shadow: 0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.3)!important; }
  .avatar-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(80px,1fr)); gap:16px; width:100%; box-sizing:border-box; }
  .avatar-search { width:100%; padding:10px 14px; background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.25); border-radius:10px; color:#fff; font-size:14px; font-family:inherit; outline:none; box-sizing:border-box; margin-bottom:16px; }
  .avatar-search::placeholder { color:rgba(255,255,255,0.4); }
  .avatar-search:focus { border-color:rgba(255,255,255,0.6); }
`;

function AuthShell({ children, centered = false, wide = false, kiosk = false }) {
  return (
    <div style={{ minHeight: "100dvh", width: "100%", maxWidth: "100vw", boxSizing: "border-box", position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: centered ? "center" : "flex-start", padding: centered ? "20px" : kiosk ? "calc(env(safe-area-inset-top,0px) + 16px) 16px calc(env(safe-area-inset-bottom,0px) + 40px)" : "calc(env(safe-area-inset-top,0px) + 10vh) 16px calc(env(safe-area-inset-bottom,0px) + 40px)", overflowX: "hidden", overflowY: "auto" }}>
      <div className="auth-glow" />
      <div className="kb-content" style={{ position: "relative", zIndex: 1, maxWidth: wide ? "680px" : "420px", width: "100%", boxSizing: "border-box" }}>
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
          <button onClick={() => { setSelected(null); setMode(null); }} style={{ background: "none", border: "none", color: "#0f172a", fontSize: "13px", cursor: "pointer", marginBottom: "24px", padding: 0, fontFamily: "inherit" }}>← Back</button>
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
          <button onClick={() => { setSelected(null); setMode(null); }} style={{ background: "none", border: "none", color: "#0f172a", fontSize: "13px", cursor: "pointer", marginBottom: "24px", padding: 0, fontFamily: "inherit" }}>← Back</button>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "8px", background: "rgba(255,255,255,0.2)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: 700 }}>{selected[0]}</div>
            <div style={{ fontSize: "18px", fontWeight: 600, color: t.text }}>{selected}</div>
          </div>
          <p style={{ color: "rgba(0,0,0,0.5)", fontSize: "13.5px", margin: "0 0 20px" }}>First time? Set up a 4-digit PIN.</p>
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
    <AuthShell wide kiosk>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#0f172a", fontSize: "13px", cursor: "pointer", marginBottom: "24px", padding: 0, fontFamily: "inherit" }}>← Back</button>
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "#fff", letterSpacing: "-0.3px" }}>Who are you?</div>
          <div style={{ color: "rgba(0,0,0,0.5)", fontSize: "13.5px", marginTop: "6px" }}>Select your name to log in</div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", justifyContent: "center", width: "100%" }}>
          {[...OFFICE_PROFILES].map((name) => (
            <AvatarButton
              key={name}
              name={name}
              onClick={() => handleSelect(name)}
              disabled={loadingPin}
              badge={loadingPin && selected === name ? "…" : null}
            />
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
  const [crewSearch, setCrewSearch] = useState("");

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
  const title = step === "pick" ? null : step === "setup" ? "Create your PIN" : step === "confirm" ? "Confirm your PIN" : step === "email" ? "One more thing" : `Hi, ${selectedMember?.name?.split(" ")[0]} 👋`;
  const subtitle = step === "pick" ? null : step === "setup" ? "You'll use this every time you log in" : step === "confirm" ? "Enter your PIN again to confirm" : step === "email" ? "Add your email for job alerts (optional)" : "Enter your PIN";

  return (
    <AuthShell wide kiosk>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#0f172a", fontSize: "13px", cursor: "pointer", marginBottom: "24px", padding: 0, fontFamily: "inherit" }}>← Back</button>
        {step === "pick" ? (
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <div style={{ fontSize: "24px", fontWeight: 800, color: "#fff", letterSpacing: "-0.3px" }}>Who are you?</div>
            <div style={{ color: "rgba(0,0,0,0.5)", fontSize: "13.5px", marginTop: "6px" }}>Tap your name to get started</div>
          </div>
        ) : (
          <>
            <h1 style={{ fontSize: "22px", fontWeight: 600, color: "#fff", margin: "0 0 6px" }}>{title}</h1>
            <p style={{ color: "rgba(0,0,0,0.5)", fontSize: "13.5px", margin: "0 0 24px" }}>{subtitle}</p>
          </>
        )}

        {step === "pick" && (
          loadingMembers ? <EmptyState text="Loading..." /> :
          members.length === 0 ? <EmptyState text="No crew members yet." sub="Ask the office to add you to the roster." /> :
          <>
            <input
              className="avatar-search"
              type="text"
              placeholder="🔍  Search name..."
              value={crewSearch}
              onChange={e => setCrewSearch(e.target.value)}
              autoComplete="off"
            />
            {(() => {
              const filtered = members
                .filter(m => !crewSearch.trim() || m.name.toLowerCase().includes(crewSearch.toLowerCase()))
                .sort((a, b) => {
                  // Members WITH a pin come first; those without come last
                  const aHasPin = !!(a.pin);
                  const bHasPin = !!(b.pin);
                  if (aHasPin !== bHasPin) return aHasPin ? -1 : 1;
                  // Within each group, sort alphabetically
                  return a.name.localeCompare(b.name);
                });
              if (filtered.length === 0) return <div style={{ textAlign: "center", color: "rgba(255,255,255,0.55)", fontSize: 13, padding: "24px 0" }}>No match for "{crewSearch}"</div>;
              return (
                <div className="avatar-grid">
                  {filtered.map(m => (
                    <AvatarButton
                      key={m.id}
                      name={m.name}
                      onClick={() => handleSelectMember(m)}
                      badge={!m.pin ? "NEW" : null}
                    />
                  ))}
                </div>
              );
            })()}
          </>
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
// Compute which crew members were assigned to a job on a specific day.
// Starts with crewMemberIds at job creation, then applies crew_added/crew_removed
// events from jobUpdates up to and including that day.
function computeAssignedCrew(job, jobUpdates, dayStr) {
  const crew = new Set((job.crewMemberIds || []).filter(Boolean));
  (jobUpdates || [])
    .filter(u => u.jobId === job.id && u.date <= dayStr)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
    .forEach(u => {
      if (u.type === "crew_added" && u.addedMemberId) crew.add(u.addedMemberId);
      if (u.type === "crew_removed" && u.removedMemberId) crew.delete(u.removedMemberId);
    });
  return [...crew];
}

// Build a map: { [dateStr]: [job, ...] } for a specific employee.
// A job appears for employee on day X only if:
//   1. They are assigned on that day (via crewMemberIds + crew_added/removed events)
//   2. The job had an in_progress or completed status update on day X
//   3. Day X falls within the requested week range
function buildDayJobMap(jobs, updates, jobUpdates, memberId, mon, sat) {
  const map = {};

  // Generate set of week days (YYYY-MM-DD) in range
  const weekDaySet = new Set();
  for (let d = new Date(mon); d <= sat; d.setDate(d.getDate() + 1)) {
    weekDaySet.add(d.toLocaleDateString("en-CA"));
  }

  // Group updates by jobId
  const updatesByJob = {};
  (updates || []).forEach(u => {
    if (!updatesByJob[u.jobId]) updatesByJob[u.jobId] = [];
    updatesByJob[u.jobId].push(u);
  });

  (jobs || []).forEach(job => {
    if (!job.id) return;

    const jobUpds = updatesByJob[job.id] || [];

    // Find which days this job was active (had in_progress or completed update)
    const activeDays = new Set(
      jobUpds
        .filter(u => u.status === "in_progress" || u.status === "completed")
        .map(u => tsToCST(u.timestamp))
        .filter(d => weekDaySet.has(d))
    );

    if (activeDays.size === 0) return;

    activeDays.forEach(dayStr => {
      // Compute who was assigned on this specific day
      const assignedOnDay = computeAssignedCrew(job, jobUpdates, dayStr);
      if (!assignedOnDay.includes(memberId)) return;

      if (!map[dayStr]) map[dayStr] = [];
      if (!map[dayStr].find(x => x.id === job.id)) map[dayStr].push(job);
    });
  });

  return map;
}

// Build a summary map for all employees: { employeeId: { [dateStr]: [job, ...] } }
// Used in daily crew summary and roster views.
function buildAllEmployeeDayJobMap(jobs, updates, jobUpdates, weekDaySet) {
  const allMap = {};

  const updatesByJob = {};
  (updates || []).forEach(u => {
    if (!updatesByJob[u.jobId]) updatesByJob[u.jobId] = [];
    updatesByJob[u.jobId].push(u);
  });

  (jobs || []).forEach(job => {
    if (!job.id) return;
    const jobUpds = updatesByJob[job.id] || [];
    const activeDays = new Set(
      jobUpds
        .filter(u => u.status === "in_progress" || u.status === "completed")
        .map(u => tsToCST(u.timestamp))
        .filter(d => weekDaySet.has(d))
    );
    if (activeDays.size === 0) return;

    activeDays.forEach(dayStr => {
      const assignedOnDay = computeAssignedCrew(job, jobUpdates, dayStr);
      assignedOnDay.forEach(memberId => {
        if (!allMap[memberId]) allMap[memberId] = {};
        if (!allMap[memberId][dayStr]) allMap[memberId][dayStr] = [];
        if (!allMap[memberId][dayStr].find(x => x.id === job.id)) {
          allMap[memberId][dayStr].push(job);
        }
      });
    });
  });

  return allMap;
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

function CrewTimesheetTab({ crewMemberId, crewName, jobs, updates, jobUpdates, weekOffset, setWeekOffset }) {
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

  const dayJobMap = buildDayJobMap(jobs, updates, jobUpdates || [], crewMemberId, mon, sat);

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

function CrewDashboard({ truck, crewName, crewMemberId, jobs, updates, jobUpdates, tickets, inventory, truckInventory, tools, toolCheckouts, loadLog, returnLog, onSubmitUpdate, onSubmitTicket, onCloseOutJob, onSaveJobMaterials, onLoadTruck, onReturnMaterial, onDeductFromTruck, onDeltaAdjustTruck, onLogDailyMaterials, onToolCheckout, onToolReturn, onLogout }) {
  const myJobs = jobs.filter((j) => {
    if (j.onHold) return false;
    const assignedByMember = crewMemberId && (j.crewMemberIds || []).includes(crewMemberId);
    if (!assignedByMember) return false;
    const latest = updates.filter((u) => u.jobId === j.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
    return !latest || latest.status !== "completed";
  });
  const myTickets = tickets.filter((tk) => tk.truckId === truck.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const [crewView, setCrewView] = useState("home");
  const [truckTab, setTruckTab] = useState("truck"); // "truck" | "loadHistory"
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

  const crewTabStyle = (active) => ({
    padding: "9px 14px",
    background: active ? t.accent : "transparent",
    color: active ? "#fff" : t.textSecondary,
    border: "none",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: active ? 700 : 500,
    cursor: "pointer",
    fontFamily: "inherit",
    position: "relative",
    flexShrink: 0,
    minHeight: "38px",
    transition: "all 0.15s ease",
    letterSpacing: active ? "-0.2px" : "0",
    boxShadow: active ? "0 2px 8px rgba(26,86,219,0.25)" : "none",
  });
  const openTicketCount = myTickets.filter((tk) => tk.status !== "resolved").length;

  return (
    <div style={{ minHeight: "100dvh", background: t.bg, paddingTop: crewView !== "home" ? "calc(116px + env(safe-area-inset-top, 0px))" : "calc(64px + env(safe-area-inset-top, 0px))" }}>
      <div className="glass-header" style={{ padding: "12px 16px", paddingTop: "calc(12px + env(safe-area-inset-top, 0px))", position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, boxShadow: "0 2px 12px rgba(0,0,0,0.18)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
          <svg width="130" height="36" viewBox="0 0 360 100" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
            <rect width="360" height="100" fill="#0f172a" rx="8"/>
            <rect x="18" y="14" width="4" height="72" fill="#2563eb" rx="2"/>
            <text x="32" y="80" fontFamily="Arial Black,sans-serif" fontSize="72" fontWeight="900" fill="white" letterSpacing="-3">IST</text>
            <line x1="168" y1="16" x2="168" y2="84" stroke="#1e3a5f" strokeWidth="1.5"/>
            <text x="180" y="38" fontFamily="Arial,sans-serif" fontSize="12" fontWeight="700" fill="#3b82f6" letterSpacing="3">INSULATION</text>
            <text x="180" y="56" fontFamily="Arial,sans-serif" fontSize="12" fontWeight="700" fill="#3b82f6" letterSpacing="3">SERVICES</text>
            <text x="180" y="74" fontFamily="Arial,sans-serif" fontSize="12" fontWeight="700" fill="#3b82f6" letterSpacing="3">OF TULSA</text>
          </svg>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>{crewName}</div>
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.55)", marginTop: "2px" }}>{truck.name}</div>
            </div>
            <Button variant="ghost" onClick={onLogout} style={{ fontSize: "12px", color: "#0f172a" }}>Log Out</Button>
          </div>
        </div>
        {crewView !== "home" && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
            <button onClick={() => setCrewView("home")} style={{ display: "flex", alignItems: "center", gap: "4px", background: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.4)", color: "#0f172a", padding: "8px 16px", fontSize: "15px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "opacity 0.15s ease", minHeight: "44px", borderRadius: "20px" }}>
              ‹ Back
            </button>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "#fff" }}>
              {crewView === "jobs" ? "Jobs" : crewView === "truck" ? "My Truck" : crewView === "history" ? "Calendar" : crewView === "timesheet" ? "Timesheet" : crewView === "tickets" ? "Tickets" : crewView === "tools" ? "Tools" : ""}
            </span>
          </div>
        )}
      </div>

      <div style={{ padding: "16px 16px 32px", maxWidth: "600px", margin: "0 auto" }}>
        {crewView === "home" && (() => {
          const now = new Date();
          const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
          const firstName = crewName ? crewName.split(" ")[0] : crewName;
          const crewNavIcons = {
            jobs: (
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                <line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>
              </svg>
            ),
            truck: (
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="3" width="15" height="13" rx="1"/>
                <path d="M16 8h4l3 5v4h-7V8z"/>
                <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
              </svg>
            ),
            history: (
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
                <rect x="7" y="14" width="3" height="3" rx="0.5"/>
              </svg>
            ),
            timesheet: (
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            ),
            tickets: (
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 9a1 1 0 0 1 1-1h18a1 1 0 0 1 1 1v2a2 2 0 0 0 0 4v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-2a2 2 0 0 0 0-4V9z"/>
                <line x1="9" y1="8" x2="9" y2="16" strokeDasharray="2 2"/>
              </svg>
            ),
            tools: (
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
              </svg>
            ),
          };
          const navItems = [
            { key: "jobs",        label: "Jobs",          sub: myJobs.length > 0 ? `${myJobs.length} active` : "No active jobs" },
            { key: "truck",       label: "My Truck",      sub: "Inventory & load" },
            { key: "history",     label: "Calendar",      sub: "Job history" },
            { key: "timesheet",   label: "Timesheet",     sub: "Track your time" },
            { key: "tickets",     label: "Tickets",       sub: openTicketCount > 0 ? `${openTicketCount} open` : "Submit a request", badge: openTicketCount > 0 ? openTicketCount : null },
            { key: "tools",       label: "Tools",         sub: "Checkout & return" },
          ];
          return (
            <div className="tab-view-enter">
              <div style={{ marginBottom: "24px", paddingTop: "4px" }}>
                <div style={{ fontSize: "22px", fontWeight: 800, color: t.text, letterSpacing: "-0.3px" }}>Hey {firstName} 👋</div>
                <div style={{ fontSize: "13px", color: t.textMuted, marginTop: "4px" }}>{dateStr}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
                {navItems.map(item => (
                  <button key={item.key} onClick={() => setCrewView(item.key)}
                    style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", padding: "24px 16px 20px", background: "rgba(255,255,255,0.72)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.8)", borderRadius: "16px", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 16px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.95)", transition: "all 0.15s ease", textAlign: "center", minHeight: "120px" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.88)"; e.currentTarget.style.borderColor = t.accent; e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(26,86,219,0.12), inset 0 1px 0 rgba(255,255,255,0.95)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.72)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.8)"; e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.95)"; }}
                    onTouchStart={e => { e.currentTarget.style.background = "rgba(255,255,255,0.88)"; e.currentTarget.style.borderColor = t.accent; }}
                    onTouchEnd={e => { e.currentTarget.style.background = "rgba(255,255,255,0.72)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.8)"; }}>
                    {item.badge && (
                      <span style={{ position: "absolute", top: "12px", right: "12px", background: t.danger, color: "#fff", fontSize: "11px", fontWeight: 700, borderRadius: "99px", padding: "2px 7px", minWidth: "20px", textAlign: "center" }}>{item.badge}</span>
                    )}
                    <span style={{ lineHeight: 1, color: t.accent, opacity: 0.85 }}>{crewNavIcons[item.key]}</span>
                    <span style={{ fontSize: "15px", fontWeight: 700, color: t.text }}>{item.label}</span>
                    <span style={{ fontSize: "12px", color: t.textMuted, lineHeight: 1.3 }}>{item.sub}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })()}
        {crewView === "jobs" && (
          <div className="tab-view-enter">
            <SectionHeader title="Your Jobs" />
            {myJobs.length === 0 ? <EmptyState text="No active jobs assigned to you." sub="Check back or contact the office." /> : myJobs.map((job) => {
              const latestStatus = getLatestStatus(job.id);
              const statusObj = STATUS_OPTIONS.find((s) => s.value === latestStatus);
              const jobStatusList = getJobUpdates(job.id);
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
                  {jobStatusList.length > 0 && (
                    <div style={{ marginBottom: "10px" }}>
                      <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", color: t.textMuted, marginBottom: "6px", fontWeight: 600 }}>Update Log</div>
                      {jobStatusList.slice(0, 3).map((u) => {
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
                  {/* Photos section for crew */}
                  <JobPhotosSection job={job} canDelete={false} uploaderName={crewName} />
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
          </div>
        )}

        {/* ── LOAD TRUCK MODAL ── */}
        {crewView === "history" && (() => { // eslint-disable-line no-extra-parens
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
            <div className="tab-view-enter">
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
                        {(() => {
                          const hasDailyLogs = (job.dailyMaterialLogs || []).length > 0;
                          const hasMU = Object.keys(job.materialsUsed || {}).length > 0;
                          if (hasDailyLogs) return (
                            <div style={{ marginTop: 6 }}>
                              {(job.dailyMaterialLogs || []).map((log, li) => (
                                <div key={li} style={{ marginBottom: 6 }}>
                                  <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 3 }}>{log.date} — {log.loggedBy}</div>
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                    {Object.entries(log.materials || {}).map(([itemId, qty]) => {
                                      const item = INVENTORY_ITEMS.find(i => i.id === itemId);
                                      if (!item) return null;
                                      const display = isFoam(itemId) ? Math.round(qty * (["cc_a","cc_b","env_cc_a","env_cc_b"].includes(itemId) ? 50 : 48)) + " gal" : qty + " " + item.unit;
                                      return <span key={itemId} style={{ fontSize: 12, background: t.accentBg, color: t.accent, padding: "2px 8px", borderRadius: 5, fontWeight: 600 }}>{item.name}: {display}</span>;
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                          if (hasMU) return (
                            <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
                              {Object.entries(job.materialsUsed || {}).map(([itemId, qty]) => {
                                const item = INVENTORY_ITEMS.find(i => i.id === itemId);
                                if (!item) return null;
                                const display = isFoam(itemId) ? Math.round(qty * (["cc_a","cc_b","env_cc_a","env_cc_b"].includes(itemId) ? 50 : 48)) + " gal" : qty + " " + item.unit;
                                return <span key={itemId} style={{ fontSize: 12, background: t.accentBg, color: t.accent, padding: "2px 8px", borderRadius: 5, fontWeight: 600 }}>{item.name}: {display}</span>;
                              })}
                            </div>
                          );
                          return <div style={{ fontSize: 12, color: t.textMuted, fontStyle: "italic", marginTop: 6 }}>No materials logged</div>;
                        })()}
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
                  ? <button onClick={async () => {
                      // Everything they entered = total leaving on truck today, all deducted from warehouse
                      const allItems = INVENTORY_ITEMS.filter(i => (loadQtys[i.id] || 0) > 0).map(i => ({ itemId: i.id, name: i.name, unit: i.unit, qty: loadQtys[i.id] }));
                      await onLoadTruck(allItems, truck?.id);
                      setLoadTruckMode(false); setLoadQtys({}); setCarriedQtys({});
                    }} style={{ width: "100%", padding: "14px", borderRadius: 12, background: "#1e40af", border: "none", color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer", fontFamily: "inherit", marginTop: 12 }}>
                      Confirm Load Out
                    </button>
                  : <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, textAlign: "center", marginBottom: 2 }}>What are you doing with the remaining material?</div>
                      <button onClick={async () => {
                        const returning = [
                          ...INVENTORY_ITEMS.filter(i => !i.isPieces && (truckInventory[i.id] || 0) > 0).map(i => ({ itemId: i.id, name: i.name, unit: i.unit, stillHave: loadQtys[i.id] || 0 })),
                          ...INVENTORY_ITEMS.filter(i => i.isPieces && (loadQtys[i.id] || 0) > 0).map(i => ({ itemId: i.id, name: i.name, unit: i.unit, stillHave: loadQtys[i.id] || 0 })),
                        ];
                        await onReturnMaterial(returning, truck?.id, "unload");
                        setLoadTruckMode(false); setLoadQtys({});
                      }} style={{ width: "100%", padding: "14px", borderRadius: 12, background: "#15803d", border: "none", color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                        Unload to Warehouse
                        <div style={{ fontSize: 12, fontWeight: 400, marginTop: 3, opacity: 0.85 }}>Return remaining material — truck inventory zeroes out</div>
                      </button>
                      <button onClick={async () => {
                        const keeping = [
                          ...INVENTORY_ITEMS.filter(i => !i.isPieces && (truckInventory[i.id] || 0) > 0).map(i => ({ itemId: i.id, name: i.name, unit: i.unit, stillHave: loadQtys[i.id] || 0 })),
                          ...INVENTORY_ITEMS.filter(i => i.isPieces).map(i => ({ itemId: i.id, name: i.name, unit: i.unit, stillHave: loadQtys[i.id] || 0 })),
                        ];
                        await onReturnMaterial(keeping, truck?.id, "keep");
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
            <div className="tab-view-enter" style={{ padding: "0" }}>
              {/* Sub-tab switcher */}
              <div style={{ display: "flex", gap: 8, marginBottom: 20, background: t.surface, borderRadius: 12, padding: 4 }}>
                {[{ key: "truck", label: "My Truck" }, { key: "loadHistory", label: "Load History" }].map(tab => (
                  <button key={tab.key} onClick={() => setTruckTab(tab.key)} style={{ flex: 1, padding: "10px 0", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 700, transition: "all 0.15s", background: truckTab === tab.key ? t.accent : "transparent", color: truckTab === tab.key ? "#fff" : t.textMuted }}>
                    {tab.label}
                  </button>
                ))}
              </div>
              {truckTab === "loadHistory" && (() => {
                const isFoam = (id) => ["oc_a","oc_b","cc_a","cc_b","env_oc_a","env_oc_b","env_cc_a","env_cc_b","free_env_oc_a","free_env_oc_b"].includes(id);
                const truckLoads = (loadLog || []).filter(r => r.truckId === truck.id);
                const truckReturns = (returnLog || []).filter(r => r.truckId === truck.id);
                const allEntries = [
                  ...truckLoads.map(r => ({ ...r, actionType: "load" })),
                  ...truckReturns.map(r => ({ ...r, actionType: "return" })),
                ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                if (allEntries.length === 0) {
                  return (
                    <div style={{ textAlign: "center", padding: "48px 24px", borderRadius: "12px", border: "2px dashed " + t.border, background: t.surface }}>
                      <div style={{ fontSize: "32px", marginBottom: "12px", opacity: 0.4 }}>📦</div>
                      <div style={{ color: t.textSecondary, fontSize: "15px", fontWeight: 600 }}>No load history yet</div>
                      <div style={{ color: t.textMuted, fontSize: "13px", marginTop: "6px" }}>Your loads and warehouse returns will appear here.</div>
                    </div>
                  );
                }
                return allEntries.map((entry, idx) => {
                  const isLoad = entry.actionType === "load";
                  const labelColor = isLoad ? "#1e40af" : "#15803d";
                  const labelBg = isLoad ? "#dbeafe" : "#dcfce7";
                  const labelText = isLoad ? "Loaded to Truck" : "Returned to Warehouse";
                  const items = entry.items || {};
                  const itemEntries = Object.entries(items).filter(([, qty]) => qty > 0);
                  const fmtTimestamp = (ts) => {
                    try {
                      return new Date(ts).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
                    } catch { return ts; }
                  };
                  return (
                    <Card key={entry.id || idx} style={{ borderLeft: "4px solid " + labelColor }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                        <div>
                          <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: "99px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3px", color: labelColor, background: labelBg }}>{labelText}</span>
                          <div style={{ fontSize: "12px", color: t.textMuted, marginTop: "4px" }}>{fmtTimestamp(entry.timestamp)}</div>
                        </div>
                      </div>
                      {itemEntries.length === 0 ? (
                        <div style={{ fontSize: "13px", color: t.textMuted, fontStyle: "italic" }}>No items recorded</div>
                      ) : (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                          {itemEntries.map(([itemId, qty]) => {
                            const item = INVENTORY_ITEMS.find(i => i.id === itemId);
                            const name = item ? item.name : itemId;
                            const display = isFoam(itemId)
                              ? Math.round(qty * (["cc_a","cc_b","env_cc_a","env_cc_b"].includes(itemId) ? 50 : 48)) + " gal"
                              : qty + " " + (item ? item.unit : "");
                            return (
                              <span key={itemId} style={{ fontSize: "12px", background: t.bg, border: "1px solid " + t.border, color: t.text, padding: "3px 10px", borderRadius: "6px", fontWeight: 600 }}>
                                {name}: {display}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </Card>
                  );
                });
              })()}
              {truckTab === "truck" && <><SectionHeader title="Truck Inventory" />
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
              </>}
            </div>
          );
        })()}

        {crewView === "timesheet" && <div className="tab-view-enter"><CrewTimesheetTab crewMemberId={crewMemberId} crewName={crewName} jobs={jobs} updates={updates} jobUpdates={jobUpdates} weekOffset={tsWeekOffset} setWeekOffset={setTsWeekOffset} /></div>}
        {crewView === "tools" && (
          <ToolsView
            isOffice={false}
            tools={tools || []}
            toolCheckouts={toolCheckouts || []}
            onAddTool={() => {}}
            onEditTool={() => {}}
            onDeleteTool={() => {}}
            onCheckout={onToolCheckout}
            onReturn={onToolReturn || (() => {})}
            adminName={crewName}
            crewMembers={[]}
            crewMemberId={crewMemberId}
            crewMemberName={crewName}
          />
        )}



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
        const jobType = (dailyMaterialsJob.type || "").toLowerCase();
        const tubeItems = INVENTORY_ITEMS.filter(i => !i.isPieces && (
          (truckInventory[i.id] || 0) > 0 ||
          (i.hasPieces && (truckInventory[INVENTORY_ITEMS.find(p => p.parentId === i.id)?.id] || 0) > 0) ||
          existingDailyEntry[i.id] ||
          (i.hasPieces && existingDailyEntry[INVENTORY_ITEMS.find(p => p.parentId === i.id)?.id]) ||
          (jobType === "fiberglass" && (i.category === "Certainteed" || i.category === "JM" || i.category === "Rockwool" || i.category === "Blown")) ||
          (jobType === "foam" && i.category === "Foam") ||
          (jobType === "removal" && i.category === "Removal")
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
              <Button onClick={async () => {
                const used = {};
                INVENTORY_ITEMS.forEach(i => {
                  const raw = dailyMaterialQtys[i.id];
                  if (raw && parseFloat(raw) > 0) {
                    used[i.id] = isFoam(i.id) ? Math.round(parseFloat(raw) / (["cc_a","cc_b","env_cc_a","env_cc_b"].includes(i.id) ? 50 : 48) * 100) / 100 : parseFloat(raw);
                  }
                });
                if (Object.keys(used).length === 0) {
                  alert("No materials entered. Please enter at least one quantity before saving.");
                  return;
                }
                // Validate truck qty only for foam — fiberglass doesn't use truck loading flow
                let valid = true;
                if (jobType === "foam") {
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
                }
                if (!valid) return;
                // Delta adjust if editing existing entry, full deduct if new
                if (isEditing) {
                  await onDeltaAdjustTruck(truck?.id, existingDailyEntry, used);
                } else {
                  await onDeductFromTruck(truck?.id, used);
                }
                // Save log entry — await so we know it worked before closing
                await onLogDailyMaterials(dailyMaterialsJob.id, { date: today, materials: used, loggedBy: crewName, timestamp: new Date().toISOString() }, true);
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
              <Button onClick={async () => {
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
                if (Object.keys(used).length === 0) { alert("No materials entered."); return; }
                // Delta adjust truck and save log — await both
                await onDeltaAdjustTruck(truck?.id, existing, used);
                await onLogDailyMaterials(editMaterialsJob.id, { date: today, materials: used, loggedBy: crewName, timestamp: new Date().toISOString() }, true);
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

// ─── Tools View ───
const TOOL_CATEGORIES = ["Hand Tools", "Power Tools", "Spray Equipment", "Safety", "Cleaning", "Measuring", "Other"];
const TOOL_STATUSES = [
  { value: "available", label: "Available", color: "#15803d", bg: "#dcfce7" },
  { value: "checked_out", label: "Checked Out", color: "#b45309", bg: "#fef3c7" },
  { value: "maintenance", label: "Maintenance", color: "#b91c1c", bg: "#fee2e2" },
];

const RETURN_STATUSES = [
  { value: "good", label: "✅ Returned Good", color: "#15803d", bg: "#dcfce7" },
  { value: "broken", label: "🔧 Returned Broken", color: "#b45309", bg: "#fef3c7" },
  { value: "lost", label: "❌ Lost / Written Off", color: "#b91c1c", bg: "#fee2e2" },
];

function getReturnStatusBadge(status) {
  const rs = RETURN_STATUSES.find(r => r.value === status);
  if (!rs) return null;
  return <Badge color={rs.color} bg={rs.bg}>{rs.label}</Badge>;
}

function calcEmployeeFlag(stats) {
  const { broken, lost } = stats;
  if (lost > 2 || (broken + lost) > 4) return "flagged";
  if (lost > 1 || (broken + lost) > 2) return "warning";
  return null;
}

function EmployeeFlagBadge({ flag }) {
  if (!flag) return null;
  if (flag === "flagged") return <span title="FLAGGED — high loss/damage pattern" style={{ fontSize: 14, cursor: "default" }}>🚨</span>;
  if (flag === "warning") return <span title="WARNING — some loss/damage history" style={{ fontSize: 14, cursor: "default" }}>⚠️</span>;
  return null;
}

function ToolsView({ isOffice, tools, toolCheckouts, onAddTool, onEditTool, onDeleteTool, onCheckout, onReturn, adminName, crewMembers, employeeFlags, onSetFlag, crewMemberId, crewMemberName }) {
  const [tab, setTab] = useState("inventory");
  const [showAddTool, setShowAddTool] = useState(false);
  const [editingTool, setEditingTool] = useState(null);
  const [showCheckoutModal, setShowCheckoutModal] = useState(null);
  const [returnModal, setReturnModal] = useState(null); // checkout record awaiting return status
  const [toolForm, setToolForm] = useState({ name: "", category: TOOL_CATEGORIES[0], quantity: 1, conditionNotes: "", status: "available" });
  const [checkoutForm, setCheckoutForm] = useState({ employeeName: "", quantity: 1 });
  const [filterCat, setFilterCat] = useState("All");
  const [toolSearch, setToolSearch] = useState("");
  const [collapsedCats, setCollapsedCats] = useState({});
  const [historyTool, setHistoryTool] = useState(null);
  const [empDetailName, setEmpDetailName] = useState(null); // employee name for detail modal
  const [flagModalEmp, setFlagModalEmp] = useState(null); // { name, currentFlag, autoFlag }
  const [flagNote, setFlagNote] = useState("");
  const [flagOverride, setFlagOverride] = useState(null); // "clear" | "warning" | "flagged"

  const activeCheckouts = toolCheckouts.filter(c => !c.returnedAt);
  const toolHistory = historyTool ? toolCheckouts.filter(c => c.toolId === historyTool.id).sort((a, b) => new Date(b.checkedOutAt) - new Date(a.checkedOutAt)) : [];

  // Build per-employee stats from all checkouts
  const employeeStats = (() => {
    const stats = {};
    toolCheckouts.forEach(co => {
      const name = co.employeeName;
      if (!name) return;
      if (!stats[name]) stats[name] = { name, total: 0, good: 0, broken: 0, lost: 0, currentOut: 0 };
      stats[name].total += 1;
      if (!co.returnedAt) {
        stats[name].currentOut += (co.quantity || 1);
      } else {
        if (co.returnStatus === "broken") stats[name].broken += 1;
        else if (co.returnStatus === "lost") stats[name].lost += 1;
        else stats[name].good += 1;
      }
    });
    return Object.values(stats).sort((a, b) => a.name.localeCompare(b.name));
  })();

  const getEmpFlag = (empName) => {
    const flagDoc = (employeeFlags || []).find(f => f.employeeName === empName);
    if (flagDoc?.override === "clear") return null;
    if (flagDoc?.override === "warning") return "warning";
    if (flagDoc?.override === "flagged") return "flagged";
    const stats = employeeStats.find(s => s.name === empName);
    if (!stats) return null;
    return calcEmployeeFlag(stats);
  };

  const getToolAvailableQty = (tool) => {
    const checkedOut = activeCheckouts.filter(c => c.toolId === tool.id).reduce((sum, c) => sum + (c.quantity || 1), 0);
    return Math.max(0, (tool.quantity || 1) - checkedOut);
  };

  const getToolStatus = (tool) => {
    if (tool.status === "maintenance") return "maintenance";
    const avail = getToolAvailableQty(tool);
    if (avail === 0) return "checked_out";
    return "available";
  };

  const filteredTools = tools.filter(t2 => filterCat === "All" || t2.category === filterCat);

  const resetToolForm = () => setToolForm({ name: "", category: TOOL_CATEGORIES[0], quantity: 1, conditionNotes: "", status: "available" });

  const handleSaveTool = async () => {
    if (!toolForm.name.trim()) return;
    if (editingTool) {
      await onEditTool(editingTool.id, toolForm);
      setEditingTool(null);
    } else {
      await onAddTool(toolForm);
      setShowAddTool(false);
    }
    resetToolForm();
  };

  const handleDeleteTool = async (tool) => {
    if (!window.confirm(`Delete "${tool.name}"? This cannot be undone.`)) return;
    await onDeleteTool(tool.id);
  };

  const handleCheckout = async () => {
    if (!checkoutForm.employeeName.trim()) return;
    const avail = getToolAvailableQty(showCheckoutModal);
    if ((checkoutForm.quantity || 1) > avail) { alert("Not enough available."); return; }
    await onCheckout({
      toolId: showCheckoutModal.id,
      toolName: showCheckoutModal.name,
      employeeName: checkoutForm.employeeName.trim(),
      quantity: checkoutForm.quantity || 1,
      
      checkedOutAt: new Date().toISOString(),
      checkedOutBy: adminName || checkoutForm.employeeName,
    });
    setShowCheckoutModal(null);
    setCheckoutForm({ employeeName: "", quantity: 1 });
  };

  const handleReturn = (checkout) => {
    setReturnModal(checkout);
  };

  const handleConfirmReturn = async (returnStatus) => {
    if (!returnModal) return;
    await onReturn(returnModal.id, returnStatus);
    setReturnModal(null);
  };

  const handleSaveFlag = async () => {
    if (!flagModalEmp || !onSetFlag) return;
    await onSetFlag(flagModalEmp.name, flagOverride, flagNote.trim());
    setFlagModalEmp(null);
    setFlagNote("");
    setFlagOverride(null);
  };

  const tabStyle = (active) => ({
    padding: "9px 18px", borderRadius: "8px", fontSize: "13px", fontWeight: active ? 700 : 500,
    background: active ? t.accent : "transparent",
    color: active ? "#fff" : t.textSecondary,
    border: "none",
    cursor: "pointer", fontFamily: "inherit",
    boxShadow: active ? "0 2px 8px rgba(26,86,219,0.25)" : "none",
    transition: "all 0.15s ease",
    minHeight: "40px",
  });

  const cats = ["All", ...TOOL_CATEGORIES.filter(c => tools.some(tl => tl.category === c))];

  // Employee detail checkouts
  const empDetailHistory = empDetailName ? toolCheckouts.filter(c => c.employeeName === empDetailName).sort((a, b) => new Date(b.checkedOutAt) - new Date(a.checkedOutAt)) : [];

  return (
    <div>
      <SectionHeader title="Tools" right={
        <div style={{ display: "flex", gap: 8 }}>
          {isOffice && tab === "inventory" && <Button onClick={() => { resetToolForm(); setShowAddTool(true); }}>+ Add Tool</Button>}
        </div>
      } />

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, marginBottom: 16, flexWrap: "wrap", background: t.bg, borderRadius: "10px", padding: "4px" }}>
        <button style={tabStyle(tab === "inventory")} onClick={() => setTab("inventory")}>Inventory</button>
        <button style={tabStyle(tab === "checkouts")} onClick={() => setTab("checkouts")}>
          Checkouts {activeCheckouts.length > 0 && <span style={{ background: tab === "checkouts" ? "rgba(255,255,255,0.3)" : "#fef3c7", color: tab === "checkouts" ? "#fff" : "#b45309", borderRadius: 99, padding: "1px 6px", fontSize: 11, fontWeight: 700, marginLeft: 5 }}>{activeCheckouts.length}</span>}
        </button>
        {isOffice && <button style={tabStyle(tab === "report")} onClick={() => setTab("report")}>Employee Report</button>}
      </div>

      {/* INVENTORY TAB */}
      {tab === "inventory" && (() => {
        const searchLower = toolSearch.trim().toLowerCase();
        const searchFiltered = tools.filter(tl =>
          (filterCat === "All" || tl.category === filterCat) &&
          (!searchLower || tl.name.toLowerCase().includes(searchLower))
        );

        // Group by category when "All" is selected, otherwise single group
        const groups = filterCat === "All"
          ? TOOL_CATEGORIES
              .filter(c => searchFiltered.some(tl => tl.category === c))
              .map(c => ({ cat: c, items: searchFiltered.filter(tl => tl.category === c).sort((a, b) => a.name.localeCompare(b.name)) }))
          : [{ cat: filterCat, items: searchFiltered.sort((a, b) => a.name.localeCompare(b.name)) }];

        return (
          <>
            {/* Search bar */}
            <div style={{ position: "relative", marginBottom: 12 }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: t.textMuted, fontSize: 15, pointerEvents: "none" }}>🔍</span>
              <input
                type="text"
                placeholder="Search tools..."
                value={toolSearch}
                onChange={e => setToolSearch(e.target.value)}
                style={{ width: "100%", padding: "10px 12px 10px 36px", background: "#fff", border: "1px solid " + t.border, borderRadius: "8px", color: t.text, fontSize: "14px", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
                onFocus={e => e.target.style.borderColor = t.accent}
                onBlur={e => e.target.style.borderColor = t.border}
              />
              {toolSearch && (
                <button onClick={() => setToolSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: t.textMuted, fontSize: 16, lineHeight: 1, padding: 2 }}>✕</button>
              )}
            </div>

            {/* Category filter pills */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
              {cats.map(c => (
                <button key={c} onClick={() => setFilterCat(c)} style={{ padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: filterCat === c ? 700 : 500, background: filterCat === c ? t.accent : t.bg, color: filterCat === c ? "#fff" : t.textSecondary, border: "1px solid " + (filterCat === c ? t.accent : t.border), cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s" }}>{c}</button>
              ))}
            </div>

            {tools.length === 0 ? (
              <EmptyState text="No tools yet." sub={isOffice ? "Tap '+ Add Tool' to add your first tool." : "No tools in inventory."} />
            ) : searchFiltered.length === 0 ? (
              <EmptyState text="No tools match your search." sub="Try a different name or category." />
            ) : (
              groups.map(({ cat, items }) => (
                <div key={cat} style={{ marginBottom: 24 }}>
                  {/* Category header */}
                  <button
                    onClick={() => setCollapsedCats(prev => ({ ...prev, [cat]: !prev[cat] }))}
                    style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", padding: "6px 0 10px", cursor: "pointer", fontFamily: "inherit" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: t.accent, textTransform: "uppercase", letterSpacing: "1px" }}>{cat}</span>
                      <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 500 }}>{items.length} tool{items.length !== 1 ? "s" : ""}</span>
                    </div>
                    <span style={{ fontSize: 14, color: t.textMuted, transform: collapsedCats[cat] ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.2s", display: "inline-block" }}>▾</span>
                  </button>

                  {!collapsedCats[cat] && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
                      {items.map(tool => {
                        const status = getToolStatus(tool);
                        const statusObj = TOOL_STATUSES.find(s => s.value === status);
                        const avail = getToolAvailableQty(tool);
                        const total = tool.quantity || 1;
                        const checkedOutQty = total - avail;
                        const availColor = status === "maintenance" ? "#b91c1c" : avail > 0 ? "#15803d" : "#b91c1c";

                        return (
                          <div key={tool.id} style={{
                            background: t.card,
                            border: "1px solid " + t.border,
                            borderRadius: "8px",
                            padding: "10px",
                            boxShadow: t.shadow,
                            display: "flex",
                            flexDirection: "column",
                            gap: 0,
                            transition: "box-shadow 0.15s, border-color 0.15s",
                          }}
                          onMouseEnter={e => { e.currentTarget.style.boxShadow = t.shadowMd; e.currentTarget.style.borderColor = t.accent; }}
                          onMouseLeave={e => { e.currentTarget.style.boxShadow = t.shadow; e.currentTarget.style.borderColor = t.border; }}
                          >
                            {/* Status badge row */}
                            <div style={{ marginBottom: 4 }}>
                              <Badge color={statusObj?.color} bg={statusObj?.bg}>{statusObj?.label}</Badge>
                            </div>

                            {/* Tool name */}
                            <div style={{ fontWeight: 700, fontSize: 13, color: t.text, lineHeight: 1.2, marginBottom: 6 }}>{tool.name}</div>

                            {/* Availability */}
                            <div style={{ background: t.bg, borderRadius: 6, padding: "4px 8px", marginBottom: 6, textAlign: "center" }}>
                              <div style={{ fontSize: 16, fontWeight: 700, color: availColor, lineHeight: 1 }}>{avail}<span style={{ fontSize: 12, fontWeight: 500, color: t.textMuted }}> / {total}</span></div>
                              <div style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: t.textMuted, marginTop: 1 }}>available</div>
                            </div>

                            {/* Condition notes */}
                            {tool.conditionNotes && (
                              <div style={{ fontSize: 10, color: t.textSecondary, fontStyle: "italic", marginBottom: 6, lineHeight: 1.3 }}>{tool.conditionNotes}</div>
                            )}

                            {/* Action buttons */}
                            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: "auto" }}>
                              {avail > 0 && status !== "maintenance" && (
                                <button
                                  onClick={() => { setShowCheckoutModal(tool); setCheckoutForm({ employeeName: "", quantity: 1 }); }}
                                  style={{ width: "100%", padding: "5px 0", background: t.accent, border: "none", borderRadius: 5, color: "#fff", fontWeight: 600, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}
                                >
                                  Check Out
                                </button>
                              )}
                              <div style={{ display: "flex", gap: 4 }}>
                                <button
                                  onClick={() => setHistoryTool(tool)}
                                  style={{ flex: 1, padding: "4px 0", background: t.bg, border: "1px solid " + t.border, borderRadius: 5, color: t.textSecondary, fontWeight: 500, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}
                                >
                                  History
                                </button>
                                {isOffice && (
                                  <>
                                    <button
                                      onClick={() => { setEditingTool(tool); setToolForm({ name: tool.name, category: tool.category, quantity: tool.quantity || 1, conditionNotes: tool.conditionNotes || "", status: tool.status || "available" }); }}
                                      style={{ flex: 1, padding: "4px 0", background: t.bg, border: "1px solid " + t.border, borderRadius: 5, color: t.textSecondary, fontWeight: 500, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleDeleteTool(tool)}
                                      style={{ flex: 1, padding: "4px 0", background: t.dangerBg, border: "1px solid #fecaca", borderRadius: 5, color: t.danger, fontWeight: 500, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}
                                    >
                                      Del
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))
            )}
          </>
        );
      })()}

      {/* CHECKOUTS TAB */}
      {tab === "checkouts" && (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 12 }}>Active Checkouts</div>
          {(() => {
            // Crew sees only their own checkouts; office sees all
            const visibleCheckouts = isOffice
              ? activeCheckouts
              : activeCheckouts.filter(c => c.employeeName === crewMemberName);
            return visibleCheckouts.length === 0
              ? <EmptyState text="No active checkouts." />
              : visibleCheckouts.sort((a, b) => new Date(b.checkedOutAt) - new Date(a.checkedOutAt)).map(co => {
                  const tool = tools.find(t2 => t2.id === co.toolId);
                  const empFlag = getEmpFlag(co.employeeName);
                  return (
                    <Card key={co.id} style={{ borderLeft: "3px solid #b45309" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 14, color: t.text }}>{co.toolName}</div>
                          <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
                            <span style={{ marginRight: 6 }}><strong>{co.employeeName}</strong></span>
                            {isOffice && <EmployeeFlagBadge flag={empFlag} />}
                            <span style={{ marginLeft: 8, marginRight: 12 }}>Qty: {co.quantity || 1}</span>
                            <span>Out: {new Date(co.checkedOutAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                          </div>
                          {tool?.category && <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>{tool.category}</div>}
                        </div>
                        {isOffice && (
                          <Button variant="secondary" onClick={() => handleReturn(co)} style={{ fontSize: 12, padding: "6px 10px", color: "#15803d", borderColor: "#86efac" }}>Mark Returned</Button>
                        )}
                        {!isOffice && (
                          <button
                            onClick={() => handleReturn(co)}
                            style={{ flexShrink: 0, padding: "8px 12px", background: "#1e293b", border: "1px solid #475569", borderRadius: 8, color: "#f8fafc", fontWeight: 600, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}
                          >
                            Return / Report
                          </button>
                        )}
                      </div>
                    </Card>
                  );
                });
          })()}

          <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginTop: 24, marginBottom: 12 }}>Return History</div>
          {toolCheckouts.filter(c => c.returnedAt).length === 0
            ? <EmptyState text="No completed checkouts yet." />
            : toolCheckouts.filter(c => c.returnedAt).sort((a, b) => new Date(b.returnedAt) - new Date(a.returnedAt)).slice(0, 30).map(co => (
                <Card key={co.id} style={{ opacity: 0.85 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: t.text }}>{co.toolName}</div>
                      <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
                        <strong>{co.employeeName}</strong>
                        {" · "}Qty: {co.quantity || 1}
                        {" · "}Out: {new Date(co.checkedOutAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        {" → "}Returned: {new Date(co.returnedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </div>
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      {co.returnStatus ? getReturnStatusBadge(co.returnStatus) : <Badge color="#15803d" bg="#dcfce7">Returned</Badge>}
                    </div>
                  </div>
                </Card>
              ))
          }
        </>
      )}

      {/* EMPLOYEE REPORT TAB */}
      {tab === "report" && isOffice && (
        <>
          <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 16 }}>
            Employee accountability — click a row to see full history.
          </div>
          {employeeStats.length === 0
            ? <EmptyState text="No checkout history yet." />
            : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid " + t.border }}>
                      {["Employee", "Total", "Good", "Broken", "Lost", "Out Now", "Risk"].map(h => (
                        <th key={h} style={{ padding: "8px 10px", textAlign: h === "Employee" ? "left" : "center", fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {employeeStats.map(emp => {
                      const autoFlag = calcEmployeeFlag(emp);
                      const flagDoc = (employeeFlags || []).find(f => f.employeeName === emp.name);
                      const effectiveFlag = flagDoc?.override === "clear" ? null : flagDoc?.override || autoFlag;
                      return (
                        <tr key={emp.name} onClick={() => setEmpDetailName(emp.name)}
                          style={{ borderBottom: "1px solid " + t.borderLight, cursor: "pointer", background: "transparent", transition: "background 0.1s" }}
                          onMouseEnter={e => e.currentTarget.style.background = t.bg}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                          <td style={{ padding: "10px 10px", fontWeight: 600, color: t.text }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <EmployeeFlagBadge flag={effectiveFlag} />
                              {emp.name}
                            </div>
                          </td>
                          <td style={{ padding: "10px", textAlign: "center", color: t.textSecondary }}>{emp.total}</td>
                          <td style={{ padding: "10px", textAlign: "center", color: "#15803d", fontWeight: emp.good > 0 ? 600 : 400 }}>{emp.good}</td>
                          <td style={{ padding: "10px", textAlign: "center", color: emp.broken > 0 ? "#b45309" : t.textMuted, fontWeight: emp.broken > 0 ? 700 : 400 }}>{emp.broken}</td>
                          <td style={{ padding: "10px", textAlign: "center", color: emp.lost > 0 ? "#b91c1c" : t.textMuted, fontWeight: emp.lost > 0 ? 700 : 400 }}>{emp.lost}</td>
                          <td style={{ padding: "10px", textAlign: "center", color: emp.currentOut > 0 ? t.accent : t.textMuted, fontWeight: emp.currentOut > 0 ? 700 : 400 }}>{emp.currentOut}</td>
                          <td style={{ padding: "10px", textAlign: "center" }}>
                            {effectiveFlag === "flagged" && <span style={{ fontSize: 16 }}>🚨</span>}
                            {effectiveFlag === "warning" && <span style={{ fontSize: 16 }}>⚠️</span>}
                            {!effectiveFlag && <span style={{ fontSize: 11, color: t.textMuted }}>—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          }
          <div style={{ marginTop: 16, fontSize: 12, color: t.textMuted, background: t.bg, padding: "10px 12px", borderRadius: 8, border: "1px solid " + t.borderLight }}>
            <strong>Risk scoring:</strong> ⚠️ WARNING — broken + lost &gt; 2, or lost alone &gt; 1 &nbsp;|&nbsp; 🚨 FLAGGED — broken + lost &gt; 4, or lost &gt; 2
          </div>
        </>
      )}

      {/* Return Status Modal */}
      {returnModal && (
        <Modal title={isOffice ? "Mark Tool Returned" : "Return / Report Tool"} onClose={() => setReturnModal(null)}>
          <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 4 }}>{returnModal.toolName}</div>
          {isOffice && <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 20 }}>Checked out by <strong>{returnModal.employeeName}</strong></div>}
          <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 12 }}>{isOffice ? "What condition was it returned in?" : "What happened with this tool?"}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {RETURN_STATUSES.map(rs => (
              <button key={rs.value} onClick={() => handleConfirmReturn(rs.value)}
                style={{ padding: "14px 18px", borderRadius: 8, border: "2px solid " + rs.color, background: rs.bg, color: rs.color, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                {rs.label}
              </button>
            ))}
          </div>
          <Button variant="secondary" onClick={() => setReturnModal(null)} style={{ width: "100%", marginTop: 14 }}>Cancel</Button>
        </Modal>
      )}

      {/* Add/Edit Tool Modal */}
      {(showAddTool || editingTool) && (
        <Modal title={editingTool ? "Edit Tool" : "Add Tool"} onClose={() => { setShowAddTool(false); setEditingTool(null); resetToolForm(); }}>
          <Input label="Tool Name" placeholder="e.g. Staple Hammer, Box Knife, Caulk Gun" value={toolForm.name} onChange={e => setToolForm({ ...toolForm, name: e.target.value })} />
          <Select label="Category" value={toolForm.category} onChange={e => setToolForm({ ...toolForm, category: e.target.value })} options={TOOL_CATEGORIES.map(c => ({ value: c, label: c }))} />
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: t.textSecondary, marginBottom: 5 }}>Total Quantity</label>
            <input type="number" min="1" value={toolForm.quantity} onChange={e => setToolForm(f => ({ ...f, quantity: Math.max(1, parseInt(e.target.value) || 1) }))} style={{ width: "100%", padding: "9px 12px", background: "#fff", border: "1px solid " + t.border, borderRadius: "6px", color: t.text, fontSize: "14px", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
          </div>
          <TextArea label="Condition Notes (optional)" placeholder="e.g. Blade slightly dull, works fine" value={toolForm.conditionNotes} onChange={e => setToolForm({ ...toolForm, conditionNotes: e.target.value })} />
          <Select label="Status" value={toolForm.status} onChange={e => setToolForm({ ...toolForm, status: e.target.value })} options={TOOL_STATUSES.map(s => ({ value: s.value, label: s.label }))} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <Button variant="secondary" onClick={() => { setShowAddTool(false); setEditingTool(null); resetToolForm(); }} style={{ flex: 1 }}>Cancel</Button>
            <Button onClick={handleSaveTool} disabled={!toolForm.name.trim()} style={{ flex: 1 }}>{editingTool ? "Save" : "Add Tool"}</Button>
          </div>
        </Modal>
      )}

      {/* Checkout Modal */}
      {showCheckoutModal && (
        <Modal title={`Check Out — ${showCheckoutModal.name}`} onClose={() => setShowCheckoutModal(null)}>
          <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 14 }}>
            Available: <strong style={{ color: "#15803d" }}>{getToolAvailableQty(showCheckoutModal)}</strong> of {showCheckoutModal.quantity || 1}
          </div>
          <Input label="Employee Name" placeholder="Who is checking this out?" value={checkoutForm.employeeName} onChange={e => setCheckoutForm({ ...checkoutForm, employeeName: e.target.value })} />
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: t.textSecondary, marginBottom: 5 }}>Quantity</label>
            <input type="number" min="1" max={getToolAvailableQty(showCheckoutModal)} value={checkoutForm.quantity} onChange={e => setCheckoutForm(f => ({ ...f, quantity: Math.max(1, Math.min(getToolAvailableQty(showCheckoutModal), parseInt(e.target.value) || 1)) }))} style={{ width: "100%", padding: "9px 12px", background: "#fff", border: "1px solid " + t.border, borderRadius: "6px", color: t.text, fontSize: "14px", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <Button variant="secondary" onClick={() => setShowCheckoutModal(null)} style={{ flex: 1 }}>Cancel</Button>
            <Button onClick={handleCheckout} disabled={!checkoutForm.employeeName.trim()} style={{ flex: 1 }}>Check Out</Button>
          </div>
        </Modal>
      )}

      {/* History Modal */}
      {historyTool && (
        <Modal title={`History — ${historyTool.name}`} onClose={() => setHistoryTool(null)}>
          {toolHistory.length === 0
            ? <div style={{ fontSize: 13, color: t.textMuted, fontStyle: "italic" }}>No checkout history yet.</div>
            : toolHistory.map(co => (
                <div key={co.id} style={{ padding: "10px 0", borderBottom: "1px solid " + t.borderLight }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: t.text }}>{co.employeeName}</div>
                      <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
                        Qty: {co.quantity || 1}
                        {" · "}Out: {new Date(co.checkedOutAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        {co.returnedAt && <> {" → "} Returned: {new Date(co.returnedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</>}
                      </div>
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      {co.returnedAt
                        ? (co.returnStatus ? getReturnStatusBadge(co.returnStatus) : <Badge color="#15803d" bg="#dcfce7">Returned</Badge>)
                        : <Badge color="#b45309" bg="#fef3c7">Out</Badge>
                      }
                    </div>
                  </div>
                </div>
              ))
          }
        </Modal>
      )}

      {/* Employee Detail Modal */}
      {empDetailName && (
        <Modal title={`History — ${empDetailName}`} onClose={() => setEmpDetailName(null)}>
          {isOffice && (
            <div style={{ marginBottom: 16 }}>
              {(() => {
                const stats = employeeStats.find(s => s.name === empDetailName);
                const autoFlag = stats ? calcEmployeeFlag(stats) : null;
                const flagDoc = (employeeFlags || []).find(f => f.employeeName === empDetailName);
                const effectiveFlag = flagDoc?.override === "clear" ? null : flagDoc?.override || autoFlag;
                return (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, background: t.bg, padding: "10px 12px", borderRadius: 8, border: "1px solid " + t.borderLight }}>
                    <div style={{ flex: 1 }}>
                      {stats && <div style={{ fontSize: 12, color: t.textMuted }}>Total: {stats.total} · Good: <span style={{ color: "#15803d" }}>{stats.good}</span> · Broken: <span style={{ color: "#b45309" }}>{stats.broken}</span> · Lost: <span style={{ color: "#b91c1c" }}>{stats.lost}</span> · Out: {stats.currentOut}</div>}
                      {flagDoc?.note && <div style={{ fontSize: 12, color: "#7c3aed", marginTop: 4 }}>Note: {flagDoc.note}</div>}
                    </div>
                    {effectiveFlag && <EmployeeFlagBadge flag={effectiveFlag} />}
                    <Button variant="secondary" onClick={() => { setFlagModalEmp({ name: empDetailName, autoFlag }); setFlagNote(flagDoc?.note || ""); setFlagOverride(flagDoc?.override || null); }} style={{ fontSize: 11, padding: "5px 10px" }}>
                      {flagDoc?.override ? "Edit Flag" : "Set Flag"}
                    </Button>
                  </div>
                );
              })()}
            </div>
          )}
          {empDetailHistory.length === 0
            ? <div style={{ fontSize: 13, color: t.textMuted, fontStyle: "italic" }}>No checkout history yet.</div>
            : empDetailHistory.map(co => (
                <div key={co.id} style={{ padding: "10px 0", borderBottom: "1px solid " + t.borderLight }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: t.text }}>{co.toolName}</div>
                      <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
                        Qty: {co.quantity || 1}
                        {" · "}Out: {new Date(co.checkedOutAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        {co.returnedAt && <> · Returned: {new Date(co.returnedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</>}
                      </div>
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      {co.returnedAt
                        ? (co.returnStatus ? getReturnStatusBadge(co.returnStatus) : <Badge color="#15803d" bg="#dcfce7">Returned</Badge>)
                        : <Badge color="#b45309" bg="#fef3c7">Out</Badge>
                      }
                    </div>
                  </div>
                </div>
              ))
          }
        </Modal>
      )}

      {/* Flag Override Modal */}
      {flagModalEmp && (
        <Modal title={`Flag Override — ${flagModalEmp.name}`} onClose={() => { setFlagModalEmp(null); setFlagNote(""); setFlagOverride(null); }}>
          <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 16 }}>Auto-calculated flag: <strong>{flagModalEmp.autoFlag ? (flagModalEmp.autoFlag === "flagged" ? "🚨 FLAGGED" : "⚠️ WARNING") : "None"}</strong></div>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 10 }}>Manual override:</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {[{ value: null, label: "Use auto-calculated (no override)" }, { value: "clear", label: "✅ Clear flag (mark as OK)" }, { value: "warning", label: "⚠️ Set WARNING" }, { value: "flagged", label: "🚨 Set FLAGGED" }].map(opt => (
              <button key={String(opt.value)} onClick={() => setFlagOverride(opt.value)}
                style={{ padding: "10px 14px", borderRadius: 8, border: "2px solid " + (flagOverride === opt.value ? t.accent : t.border), background: flagOverride === opt.value ? t.accentBg : "transparent", color: flagOverride === opt.value ? t.accent : t.text, fontWeight: flagOverride === opt.value ? 700 : 400, fontSize: 13, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                {opt.label}
              </button>
            ))}
          </div>
          <TextArea label="Note (optional)" placeholder="Reason for override..." value={flagNote} onChange={e => setFlagNote(e.target.value)} style={{ minHeight: 60 }} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <Button variant="secondary" onClick={() => { setFlagModalEmp(null); setFlagNote(""); setFlagOverride(null); }} style={{ flex: 1 }}>Cancel</Button>
            <Button onClick={handleSaveFlag} style={{ flex: 1 }}>Save</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Toast Notification System ───
function ToastContainer({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;
  return ReactDOM.createPortal(
    <div style={{ position: "fixed", bottom: 24, right: 16, zIndex: 9999, display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end", pointerEvents: "none" }}>
      {toasts.map(toast => (
        <div key={toast.id} style={{ pointerEvents: "auto", background: "#1e293b", color: "#f1f5f9", borderRadius: 12, padding: "12px 16px", minWidth: 260, maxWidth: 340, boxShadow: "0 8px 32px rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", gap: 12, alignItems: "flex-start", animation: "toastSlide 0.25s ease" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#93c5fd", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.5px" }}>Job Update</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9", marginBottom: 2 }}>{toast.crewName}</div>
            <div style={{ fontSize: 12, color: "#cbd5e1", marginBottom: 2 }}>{toast.address}</div>
            <div style={{ fontSize: 12 }}>
              <span style={{ padding: "2px 8px", borderRadius: 20, fontWeight: 700, fontSize: 11, background: toast.statusBg || "#374151", color: toast.statusColor || "#fff" }}>{toast.statusLabel}</span>
            </div>
          </div>
          <button onClick={() => onDismiss(toast.id)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 0, flexShrink: 0 }}>✕</button>
        </div>
      ))}
    </div>,
    document.body
  );
}

function useJobUpdateToasts(updates, jobs) {
  const [toasts, setToasts] = useState([]);
  const seenRef = useRef(new Set());
  const mountedRef = useRef(false);

  useEffect(() => {
    // On first mount, seed seenRef with all existing updates so we don't toast on load
    if (!mountedRef.current) {
      (updates || []).forEach(u => seenRef.current.add(u.id));
      mountedRef.current = true;
      return;
    }
    const today = todayCST();
    (updates || []).forEach(u => {
      if (!u.id || seenRef.current.has(u.id)) return;
      if (!u.timestamp || !u.status || !u.crewName) return;
      // Only show for today's updates
      const updateDate = tsToCST(u.timestamp);
      if (updateDate !== today) { seenRef.current.add(u.id); return; }
      if (!["in_progress","completed","issue"].includes(u.status)) { seenRef.current.add(u.id); return; }
      seenRef.current.add(u.id);
      const job = jobs.find(j => j.id === u.jobId);
      const statusObj = STATUS_OPTIONS.find(s => s.value === u.status);
      const toast = {
        id: u.id,
        crewName: u.crewName,
        address: job ? (job.address || job.builder || "Unknown job") : "Unknown job",
        statusLabel: statusObj ? statusObj.label : u.status,
        statusColor: statusObj ? statusObj.color : "#fff",
        statusBg: statusObj ? statusObj.bg : "#374151",
      };
      setToasts(prev => {
        const next = [...prev.slice(-2), toast]; // max 3
        return next;
      });
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== u.id)), 6000);
    });
  }, [updates]);

  const dismiss = useCallback((id) => setToasts(prev => prev.filter(t => t.id !== id)), []);
  return [toasts, dismiss];
}

// ─── EOD Summary Modal ───
function EodSummaryModal({ jobs, updates, tickets, members, loadLog, returnLog, onClose }) {
  const today = todayCST();
  const isFoam = (id) => ["oc_a","oc_b","cc_a","cc_b","env_oc_a","env_oc_b","env_cc_a","env_cc_b","free_env_oc_a","free_env_oc_b"].includes(id);

  // Jobs with any activity today
  const todayJobs = jobs.filter(j => {
    return updates.some(u => u.jobId === j.id && tsToCST(u.timestamp) === today);
  });

  // Status per job (latest)
  const getJobStatus = (jobId) => {
    const u = updates.filter(u => u.jobId === jobId).sort((a,b) => new Date(b.timestamp)-new Date(a.timestamp))[0];
    return u ? u.status : "not_started";
  };

  const completedJobs = todayJobs.filter(j => getJobStatus(j.id) === "completed");
  const inProgressJobs = todayJobs.filter(j => getJobStatus(j.id) === "in_progress");
  const notStartedJobs = todayJobs.filter(j => !["completed","in_progress"].includes(getJobStatus(j.id)));

  // Crew who worked today
  const crewNamesSet = new Set();
  updates.filter(u => tsToCST(u.timestamp) === today && u.crewName).forEach(u => crewNamesSet.add(u.crewName));
  const crewNames = [...crewNamesSet].sort();

  // Flags/tickets submitted today
  const todayTickets = tickets.filter(tk => tsToCST(tk.timestamp) === today);

  const fmtMaterials = (mats) => {
    if (!mats || Object.keys(mats).length === 0) return null;
    return Object.entries(mats).map(([itemId, qty]) => {
      const item = INVENTORY_ITEMS.find(i => i.id === itemId);
      if (!item) return null;
      const display = isFoam(itemId)
        ? Math.round(qty * (["cc_a","cc_b","env_cc_a","env_cc_b"].includes(itemId) ? 50 : 48)) + " gal"
        : qty + " " + item.unit;
      return <span key={itemId} style={{ display: "inline-block", margin: "2px 4px 2px 0", padding: "2px 8px", background: "#eef2ff", color: "#3730a3", borderRadius: 5, fontSize: 11, fontWeight: 600 }}>{item.name}: {display}</span>;
    }).filter(Boolean);
  };

  const getAllMaterials = (job) => {
    const mats = {};
    (job.dailyMaterialLogs || []).forEach(log => {
      if (log.date === today) {
        Object.entries(log.materials || {}).forEach(([id, qty]) => { mats[id] = (mats[id] || 0) + qty; });
      }
    });
    if (Object.keys(mats).length === 0 && job.materialsUsed) {
      Object.entries(job.materialsUsed).forEach(([id, qty]) => { mats[id] = (mats[id] || 0) + qty; });
    }
    return mats;
  };

  const handlePrint = () => {
    window.print();
  };

  const prioColors = { low: "#1d4ed8", medium: "#b45309", high: "#b91c1c", critical: "#991b1b" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1100, overflow: "auto", display: "flex", justifyContent: "center", padding: "20px" }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 24, maxWidth: 640, width: "100%", boxShadow: "0 8px 40px rgba(0,0,0,0.2)", alignSelf: "flex-start" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, paddingBottom: 14, borderBottom: "2px solid #1e293b" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: "#64748b" }}>Insulation Services of Tulsa</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", marginTop: 2 }}>End-of-Day Summary</div>
            <div style={{ fontSize: 13, color: "#64748b" }}>{new Date(today + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handlePrint} style={{ padding: "8px 14px", borderRadius: 8, background: "#1e293b", color: "#fff", border: "none", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Print</button>
            <button onClick={onClose} style={{ background: "#f1f5f9", border: "none", color: "#64748b", width: 32, height: 32, borderRadius: 6, cursor: "pointer", fontSize: 16 }}>✕</button>
          </div>
        </div>

        {/* Crew */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#64748b", marginBottom: 8 }}>Crew Working Today</div>
          {crewNames.length === 0 ? <div style={{ fontSize: 13, color: "#94a3b8", fontStyle: "italic" }}>No crew updates today</div> : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {crewNames.map(n => <span key={n} style={{ padding: "4px 12px", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 20, fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{n}</span>)}
            </div>
          )}
        </div>

        {/* Job Status Summary */}
        <div style={{ marginBottom: 20, display: "flex", gap: 10 }}>
          {[
            { label: "Completed", count: completedJobs.length, bg: "#dcfce7", color: "#15803d" },
            { label: "In Progress", count: inProgressJobs.length, bg: "#fef3c7", color: "#b45309" },
            { label: "Not Started", count: notStartedJobs.length, bg: "#f1f5f9", color: "#64748b" },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, background: s.bg, borderRadius: 10, padding: "12px", textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.count}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: s.color, textTransform: "uppercase", letterSpacing: "0.3px" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Jobs detail */}
        {todayJobs.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#64748b", marginBottom: 10 }}>Jobs</div>
            {[...completedJobs, ...inProgressJobs, ...notStartedJobs].map(job => {
              const status = getJobStatus(job.id);
              const statusObj = STATUS_OPTIONS.find(s => s.value === status);
              const mats = getAllMaterials(job);
              const matEls = fmtMaterials(mats);
              return (
                <div key={job.id} style={{ marginBottom: 10, padding: "12px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0", borderLeft: "4px solid " + (statusObj?.color || "#94a3b8") }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: matEls?.length ? 8 : 0 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>{job.builder || "No Customer"}</div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>{job.address}{job.type ? " — " + job.type : ""}</div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: statusObj?.bg || "#f1f5f9", color: statusObj?.color || "#64748b" }}>{statusObj?.label || status}</span>
                  </div>
                  {matEls?.length > 0 && <div style={{ marginTop: 6 }}><span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px", marginRight: 4 }}>Materials:</span>{matEls}</div>}
                </div>
              );
            })}
          </div>
        )}

        {/* Flags/tickets */}
        {todayTickets.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#64748b", marginBottom: 8 }}>Tickets & Flags ({todayTickets.length})</div>
            {todayTickets.map(tk => (
              <div key={tk.id} style={{ padding: "10px 12px", background: "#fef9f0", borderRadius: 8, border: "1px solid #fed7aa", marginBottom: 6, borderLeft: "3px solid " + (prioColors[tk.priority] || "#94a3b8") }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontWeight: 600, fontSize: 12, color: prioColors[tk.priority] || "#64748b" }}>{tk.priority?.toUpperCase()}</span>
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>{tk.submittedBy}</span>
                </div>
                <div style={{ fontSize: 13, color: "#0f172a" }}>{tk.description}</div>
              </div>
            ))}
          </div>
        )}

        {todayJobs.length === 0 && crewNames.length === 0 && todayTickets.length === 0 && (
          <div style={{ textAlign: "center", padding: "32px", color: "#94a3b8", fontSize: 14 }}>No activity recorded today yet.</div>
        )}
      </div>
    </div>
  );
}

// ─── Truck Reconciliation View ───
function TruckReconcileView({ trucks, loadLog, returnLog, jobs, updates, truckInventory }) {
  const today = todayCST();
  const isFoam = (id) => ["oc_a","oc_b","cc_a","cc_b","env_oc_a","env_oc_b","env_cc_a","env_cc_b","free_env_oc_a","free_env_oc_b"].includes(id);

  const fmtQty = (itemId, qty) => {
    if (isFoam(itemId)) return Math.round(qty * (["cc_a","cc_b","env_cc_a","env_cc_b"].includes(itemId) ? 50 : 48)) + " gal";
    const item = INVENTORY_ITEMS.find(i => i.id === itemId);
    return qty + (item ? " " + item.unit : "");
  };

  // Sum items from a log entry's items object
  const sumItems = (logs) => {
    const totals = {};
    logs.forEach(entry => {
      Object.entries(entry.items || {}).forEach(([id, qty]) => {
        totals[id] = (totals[id] || 0) + (parseFloat(qty) || 0);
      });
    });
    return totals;
  };

  const reconcileData = trucks.map(truck => {
    const todayLoads = loadLog.filter(r => r.truckId === truck.id && tsToCST(r.timestamp) === today);
    const todayReturns = returnLog.filter(r => r.truckId === truck.id && tsToCST(r.timestamp) === today);

    const loaded = sumItems(todayLoads);
    const returned = sumItems(todayReturns);

    // Materials used on completed jobs today
    const materialsUsed = {};
    jobs.filter(j => {
      const completedUpd = updates.filter(u => u.jobId === j.id && u.status === "completed")
        .sort((a,b) => new Date(b.timestamp)-new Date(a.timestamp))[0];
      return completedUpd && tsToCST(completedUpd.timestamp) === today && j.truckId === truck.id;
    }).forEach(j => {
      (j.dailyMaterialLogs || []).filter(l => l.date === today).forEach(log => {
        Object.entries(log.materials || {}).forEach(([id, qty]) => {
          materialsUsed[id] = (materialsUsed[id] || 0) + (parseFloat(qty) || 0);
        });
      });
      if (!(j.dailyMaterialLogs || []).some(l => l.date === today) && j.materialsUsed) {
        Object.entries(j.materialsUsed).forEach(([id, qty]) => {
          materialsUsed[id] = (materialsUsed[id] || 0) + (parseFloat(qty) || 0);
        });
      }
    });

    // Discrepancy: loaded - returned - materialsUsed
    const allItemIds = new Set([...Object.keys(loaded), ...Object.keys(returned), ...Object.keys(materialsUsed)]);
    const discrepancies = {};
    allItemIds.forEach(id => {
      const l = loaded[id] || 0;
      const r = returned[id] || 0;
      const u = materialsUsed[id] || 0;
      const disc = l - r - u;
      // Round to avoid float noise
      const discRounded = Math.round(disc * 1000) / 1000;
      if (discRounded > 0.001) discrepancies[id] = discRounded;
    });

    const hasFlaggedDiscrepancy = Object.keys(discrepancies).length > 0;
    const hasActivity = Object.keys(loaded).length > 0 || Object.keys(returned).length > 0;

    return { truck, loaded, returned, materialsUsed, discrepancies, hasFlaggedDiscrepancy, hasActivity };
  }).filter(r => r.hasActivity);

  if (reconcileData.length === 0) {
    return <div style={{ textAlign: "center", padding: "32px 24px", color: "#64748b", fontSize: 14, borderRadius: 10, border: "2px dashed #e2e8f0", background: "#f8fafc" }}>No truck loads recorded today yet.</div>;
  }

  return (
    <div>
      {reconcileData.map(({ truck, loaded, returned, materialsUsed, discrepancies, hasFlaggedDiscrepancy }) => (
        <div key={truck.id} style={{ marginBottom: 16, border: "1px solid " + (hasFlaggedDiscrepancy ? "#fca5a5" : "#bbf7d0"), borderRadius: 12, overflow: "hidden", background: hasFlaggedDiscrepancy ? "#fff7f7" : "#f0fdf4" }}>
          <div style={{ padding: "12px 16px", background: hasFlaggedDiscrepancy ? "#fee2e2" : "#dcfce7", borderBottom: "1px solid " + (hasFlaggedDiscrepancy ? "#fca5a5" : "#86efac"), display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: hasFlaggedDiscrepancy ? "#991b1b" : "#14532d" }}>
              {hasFlaggedDiscrepancy ? "⚠️ " : "✅ "}{truck.members || truck.name}
            </div>
            {hasFlaggedDiscrepancy && (
              <span style={{ fontSize: 11, fontWeight: 700, background: "#dc2626", color: "#fff", padding: "2px 10px", borderRadius: 20 }}>DISCREPANCY</span>
            )}
          </div>
          <div style={{ padding: "12px 16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: Object.keys(discrepancies).length > 0 ? 12 : 0 }}>
              {[
                { label: "Loaded Out", items: loaded, color: "#1d4ed8" },
                { label: "Returned", items: returned, color: "#15803d" },
                { label: "Job Materials", items: materialsUsed, color: "#7c3aed" },
              ].map(section => (
                <div key={section.label}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: section.color, marginBottom: 6 }}>{section.label}</div>
                  {Object.keys(section.items).length === 0
                    ? <div style={{ fontSize: 12, color: "#94a3b8", fontStyle: "italic" }}>—</div>
                    : Object.entries(section.items).map(([id, qty]) => {
                        const item = INVENTORY_ITEMS.find(i => i.id === id);
                        return <div key={id} style={{ fontSize: 11, color: "#374151", marginBottom: 2 }}>{item?.name || id}: <strong>{fmtQty(id, qty)}</strong></div>;
                      })
                  }
                </div>
              ))}
            </div>
            {Object.keys(discrepancies).length > 0 && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Unexplained Discrepancy</div>
                {Object.entries(discrepancies).map(([id, qty]) => {
                  const item = INVENTORY_ITEMS.find(i => i.id === id);
                  return <div key={id} style={{ fontSize: 12, color: "#b91c1c", fontWeight: 600 }}>• {item?.name || id}: {fmtQty(id, qty)} unaccounted</div>;
                })}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Admin Dashboard ───
// ─── Roster View ─────────────────────────────────────────────────────────────
function TimesheetModal({ member, jobs, updates, jobUpdates, weekOffset, setWeekOffset, onClose }) {
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
  const [dayNotes, setDayNotes] = useState({});
  const [editingNoteDay, setEditingNoteDay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [addingDay, setAddingDay] = useState(null); // dayStr when picker is open
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(doc(db, "timesheets", tsDocId), snap => {
      if (snap.exists() && snap.data().jobEntries) {
        setJobEntries(snap.data().jobEntries);
        setDayNotes(snap.data().dayNotes || {});
        setLoading(false);
      } else {
        // Seed from dynamic job assignments — include all assigned jobs, not just completed
        const seeded = {};
        const dayMap = buildDayJobMap(jobs || [], updates || [], jobUpdates || [], member.id, mon, sat);
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

  const saveNote = async (dayStr, text) => {
    const next = { ...dayNotes, [dayStr]: text };
    setDayNotes(next);
    await setDoc(doc(db, "timesheets", tsDocId), { dayNotes: next, memberId: member.id, memberName: member.name, weekStart: weekKey }, { merge: true });
    setEditingNoteDay(null);
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: (dayJobs.length > 0 || dayNotes[dayStr]) ? 8 : 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: t.text }}>{fmtDay(day)}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => { setEditingNoteDay(dayStr); }} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid #7c3aed', background: editingNoteDay === dayStr ? '#7c3aed' : 'transparent', color: editingNoteDay === dayStr ? '#fff' : '#7c3aed', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                  📝 Note
                </button>
                <button onClick={() => setAddingDay(isAdding ? null : dayStr)} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid '+t.accent, background: isAdding ? t.accent : 'transparent', color: isAdding ? '#fff' : t.accent, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                  {isAdding ? '✕ Cancel' : '+ Add Job'}
                </button>
              </div>
            </div>
            {editingNoteDay === dayStr && (
              <div style={{ marginBottom: 8 }}>
                <textarea defaultValue={dayNotes[dayStr] || ''} id={'note-'+dayStr} rows={2} placeholder="e.g. Stayed at shop, helped load trucks, inventory work..." style={{ width: '100%', padding: '8px', fontSize: 12, borderRadius: 6, border: '1px solid #7c3aed', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <button onClick={() => { const el = document.getElementById('note-'+dayStr); saveNote(dayStr, el ? el.value : ''); }} style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, border: 'none', background: '#7c3aed', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>Save</button>
                  <button onClick={() => setEditingNoteDay(null)} style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, border: '1px solid '+t.border, background: 'transparent', color: t.textMuted, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                  {dayNotes[dayStr] && <button onClick={() => saveNote(dayStr, '')} style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontFamily: 'inherit' }}>Clear</button>}
                </div>
              </div>
            )}
            {dayNotes[dayStr] && editingNoteDay !== dayStr && (
              <div onClick={() => setEditingNoteDay(dayStr)} style={{ marginBottom: 8, padding: '6px 10px', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 6, fontSize: 12, color: '#5b21b6', cursor: 'pointer' }}>
                📝 {dayNotes[dayStr]}
              </div>
            )}

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
function RosterView({ trucks, jobs, updates, jobUpdates }) {
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
      const memberDayMap = buildDayJobMap(allStartedJobs, updates, jobUpdates || [], member.id, mon, sat);
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

      {timesheetMember && <TimesheetModal member={timesheetMember} jobs={jobs} updates={updates} jobUpdates={jobUpdates} weekOffset={tsWeekOffset} setWeekOffset={setTsWeekOffset} onClose={() => setTimesheetMember(null)} />}

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
      <button onClick={open} style={{ fontSize: 10, fontWeight: 700, color: "#2563eb", background: "rgba(37,99,235,0.12)", border: "none", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", letterSpacing: "0.3px" }}>
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


// ─── Truck Detail Modal ───
// ─── 3D Truck Viewer ───

function TruckDetailModal({ truck, truckInventory: ti = {}, loadLog, returnLog, jobs, members, onClose, onUpdateTruck, onAdminSetLoadout, onAdminUnload, onOpenCalendar }) {
  const [tab, setTab] = useState("info"); // info | loadout | history
  const [infoForm, setInfoForm] = useState({ description: truck.description || "", year: truck.year || "", make: truck.make || "", model: truck.model || "", notes: truck.notes || "" });
  const [savingInfo, setSavingInfo] = useState(false);
  const [loadoutEditMode, setLoadoutEditMode] = useState(false);
  const [loadoutEdits, setLoadoutEdits] = useState({});
  const [addItemName, setAddItemName] = useState("");
  const [addItemQty, setAddItemQty] = useState("");
  const [addItemUnit, setAddItemUnit] = useState("units");
  const [showUnloadForm, setShowUnloadForm] = useState(false);
  const [unloadQtys, setUnloadQtys] = useState({});
  const [unloadNotes, setUnloadNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Build a normalized loadout: merge INVENTORY_ITEMS with custom items stored in ti._custom
  const inventoryLoadout = INVENTORY_ITEMS.filter(i => !i.isPieces && (ti[i.id] || 0) > 0).map(i => ({ key: i.id, name: i.name, qty: ti[i.id], unit: i.unit, isCustom: false }));
  const customItems = (ti._custom || []);
  const allLoadout = [...inventoryLoadout, ...customItems.map(c => ({ key: "custom_" + c.name, name: c.name, qty: c.qty, unit: c.unit, isCustom: true }))];

  const isFoamId = (id) => ["oc_a","oc_b","cc_a","cc_b","env_oc_a","env_oc_b","env_cc_a","env_cc_b","free_env_oc_a","free_env_oc_b"].includes(id);
  const fmtQty = (key, qty) => {
    if (isFoamId(key)) return Math.round(qty * (["cc_a","cc_b","env_cc_a","env_cc_b"].includes(key) ? 50 : 48)) + " gal";
    const u = INVENTORY_ITEMS.find(i => i.id === key)?.unit || "";
    return qty + (u ? " " + u : "");
  };

  // Build history timeline from loadLog + returnLog
  const toCST = (ts) => new Date(ts).toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  const truckLoads = (loadLog || []).filter(r => r.truckId === truck.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const truckReturns = (returnLog || []).filter(r => r.truckId === truck.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  // Build sorted timeline
  const timeline = [
    ...truckLoads.map(r => ({ type: "loaded", date: toCST(r.timestamp), timestamp: r.timestamp, items: r.items || {} })),
    ...truckReturns.map(r => ({ type: "unloaded", date: toCST(r.timestamp), timestamp: r.timestamp, items: r.items || {} })),
  ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const saveInfo = async () => {
    setSavingInfo(true);
    await onUpdateTruck(truck.id, infoForm);
    setSavingInfo(false);
  };

  const saveLoadoutEdits = async () => {
    setSaving(true);
    // Build new truckInventory state
    const newState = { ...ti };
    delete newState._custom;
    // Apply edits to standard items
    inventoryLoadout.forEach(item => {
      const edited = parseFloat(loadoutEdits[item.key]);
      if (!isNaN(edited)) {
        if (edited <= 0) delete newState[item.key];
        else newState[item.key] = edited;
      }
    });
    // Custom items
    const newCustom = customItems.map(c => {
      const edited = parseFloat(loadoutEdits["custom_" + c.name]);
      if (!isNaN(edited)) return { ...c, qty: edited };
      return c;
    }).filter(c => c.qty > 0);
    if (newCustom.length > 0) newState._custom = newCustom;
    await onAdminSetLoadout(truck.id, newState, "adjusted", "Admin manual adjustment");
    setLoadoutEditMode(false);
    setLoadoutEdits({});
    setSaving(false);
  };

  const addCustomItem = async () => {
    if (!addItemName || !addItemQty) return;
    const qty = parseFloat(addItemQty);
    if (isNaN(qty) || qty <= 0) return;
    const newState = { ...ti };
    const custom = [...(ti._custom || [])];
    const existing = custom.findIndex(c => c.name.toLowerCase() === addItemName.toLowerCase());
    if (existing >= 0) custom[existing] = { ...custom[existing], qty };
    else custom.push({ name: addItemName, qty, unit: addItemUnit });
    newState._custom = custom;
    await onAdminSetLoadout(truck.id, newState, "adjusted", "Added item: " + addItemName);
    setAddItemName(""); setAddItemQty(""); setAddItemUnit("units");
  };

  const doUnload = async () => {
    if (saving) return;
    setSaving(true);
    const itemsToUnload = allLoadout.filter(item => {
      const q = parseFloat(unloadQtys[item.key]);
      return !isNaN(q) && q > 0;
    });
    if (itemsToUnload.length === 0) { setSaving(false); return; }
    await onAdminUnload(truck.id, itemsToUnload, unloadQtys, unloadNotes);
    setShowUnloadForm(false);
    setUnloadQtys({});
    setUnloadNotes("");
    setSaving(false);
  };

  const tabBtn = (key, label) => (
    <button onClick={() => setTab(key)} style={{ flex: 1, padding: "8px 4px", borderRadius: 8, border: "none", background: tab === key ? t.accent : "none", color: tab === key ? "#fff" : t.textMuted, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>{label}</button>
  );

  return (
    <Modal title={(truck.members || truck.name)} onClose={onClose}>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, background: t.surface, borderRadius: 10, padding: 4, marginBottom: 16 }}>
        {tabBtn("loadout", "📦 Loadout")}
        {tabBtn("history", "📋 History")}
      </div>

      {/* LOADOUT TAB */}
      {tab === "loadout" && (
        <div>
          {allLoadout.length === 0 && !loadoutEditMode && (
            <div style={{ fontSize: 13, color: t.textMuted, fontStyle: "italic", marginBottom: 12 }}>Nothing loaded on this truck.</div>
          )}
          {allLoadout.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.5, padding: "4px 6px", borderBottom: "1px solid " + t.border }}>Item</th>
                  <th style={{ textAlign: "right", fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.5, padding: "4px 6px", borderBottom: "1px solid " + t.border }}>Qty</th>
                  {loadoutEditMode && <th style={{ width: 80, padding: "4px 6px", borderBottom: "1px solid " + t.border }} />}
                </tr>
              </thead>
              <tbody>
                {allLoadout.map(item => (
                  <tr key={item.key}>
                    <td style={{ padding: "6px 6px", fontSize: 13, color: t.text, borderBottom: "1px solid " + t.borderLight }}>{item.name}</td>
                    <td style={{ padding: "6px 6px", fontSize: 13, fontWeight: 700, color: t.accent, textAlign: "right", borderBottom: "1px solid " + t.borderLight }}>
                      {loadoutEditMode
                        ? <input type="number" value={loadoutEdits[item.key] !== undefined ? loadoutEdits[item.key] : item.qty} onChange={e => setLoadoutEdits(v => ({ ...v, [item.key]: e.target.value }))} style={{ width: 70, padding: "4px 6px", borderRadius: 6, border: "1px solid " + t.border, background: t.bg, color: t.text, fontSize: 13, fontFamily: "inherit", textAlign: "right" }} />
                        : <span>{isFoamId(item.key) ? fmtQty(item.key, item.qty) : item.qty + " " + item.unit}</span>
                      }
                    </td>
                    {loadoutEditMode && <td style={{ padding: "4px 6px", borderBottom: "1px solid " + t.borderLight, textAlign: "right" }}><button onClick={() => setLoadoutEdits(v => ({ ...v, [item.key]: 0 }))} style={{ background: "#fee2e2", color: "#b91c1c", border: "none", borderRadius: 5, padding: "2px 7px", cursor: "pointer", fontSize: 11, fontFamily: "inherit", fontWeight: 700 }}>✕</button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Add custom item */}
          {loadoutEditMode && (
            <div style={{ background: t.surface, borderRadius: 8, padding: 10, marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Add Custom Item</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <input value={addItemName} onChange={e => setAddItemName(e.target.value)} placeholder="Item name" style={{ flex: 2, minWidth: 120, padding: "7px 9px", borderRadius: 7, border: "1px solid " + t.border, background: t.bg, color: t.text, fontSize: 13, fontFamily: "inherit" }} />
                <input value={addItemQty} onChange={e => setAddItemQty(e.target.value)} placeholder="Qty" type="number" style={{ width: 70, padding: "7px 9px", borderRadius: 7, border: "1px solid " + t.border, background: t.bg, color: t.text, fontSize: 13, fontFamily: "inherit" }} />
                <input value={addItemUnit} onChange={e => setAddItemUnit(e.target.value)} placeholder="Unit" style={{ width: 70, padding: "7px 9px", borderRadius: 7, border: "1px solid " + t.border, background: t.bg, color: t.text, fontSize: 13, fontFamily: "inherit" }} />
                <button onClick={addCustomItem} style={{ padding: "7px 12px", borderRadius: 7, background: t.accent, color: "#fff", border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>+ Add</button>
              </div>
            </div>
          )}

          {/* Edit / Save buttons */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {!loadoutEditMode
              ? <button onClick={() => { setLoadoutEditMode(true); setLoadoutEdits({}); }} style={{ flex: 1, padding: "9px", borderRadius: 8, background: "none", border: "1px solid " + t.border, color: t.text, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>✏️ Edit Loadout</button>
              : <>
                  <button onClick={saveLoadoutEdits} disabled={saving} style={{ flex: 1, padding: "9px", borderRadius: 8, background: t.accent, color: "#fff", border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>{saving ? "Saving…" : "Save Changes"}</button>
                  <button onClick={() => { setLoadoutEditMode(false); setLoadoutEdits({}); }} style={{ padding: "9px 14px", borderRadius: 8, background: "none", border: "1px solid " + t.border, color: t.textMuted, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                </>
            }
          </div>

          {/* Unload to Warehouse */}
          {allLoadout.length > 0 && !loadoutEditMode && (
            <>
              {!showUnloadForm
                ? <button onClick={() => { setShowUnloadForm(true); const d = {}; allLoadout.forEach(i => { d[i.key] = i.qty; }); setUnloadQtys(d); }} style={{ width: "100%", padding: "10px", borderRadius: 8, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#15803d", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>🏭 Unload to Warehouse</button>
                : (
                  <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#15803d", marginBottom: 8 }}>Unload quantities to warehouse:</div>
                    {allLoadout.map(item => (
                      <div key={item.key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <div style={{ flex: 1, fontSize: 13, color: t.text }}>{item.name}</div>
                        <input type="number" value={unloadQtys[item.key] !== undefined ? unloadQtys[item.key] : item.qty} onChange={e => setUnloadQtys(v => ({ ...v, [item.key]: e.target.value }))} style={{ width: 80, padding: "5px 7px", borderRadius: 6, border: "1px solid #86efac", background: "#fff", color: t.text, fontSize: 13, fontFamily: "inherit", textAlign: "right" }} />
                        <span style={{ fontSize: 12, color: t.textMuted, minWidth: 30 }}>{item.unit}</span>
                      </div>
                    ))}
                    <textarea value={unloadNotes} onChange={e => setUnloadNotes(e.target.value)} placeholder="Notes (optional)" rows={2} style={{ width: "100%", padding: "7px 9px", borderRadius: 7, border: "1px solid #86efac", background: "#fff", color: t.text, fontSize: 12, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", marginTop: 4, marginBottom: 8 }} />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={doUnload} disabled={saving} style={{ flex: 1, padding: "9px", borderRadius: 8, background: "#16a34a", color: "#fff", border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>{saving ? "Unloading…" : "Confirm Unload"}</button>
                      <button onClick={() => setShowUnloadForm(false)} style={{ padding: "9px 14px", borderRadius: 8, background: "none", border: "1px solid " + t.border, color: t.textMuted, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                    </div>
                  </div>
                )
              }
            </>
          )}
        </div>
      )}

      {/* HISTORY TAB */}
      {tab === "history" && (
        <div>
          {timeline.length === 0 && <div style={{ fontSize: 13, color: t.textMuted, fontStyle: "italic" }}>No load/unload history yet.</div>}
          {timeline.map((entry, idx) => {
            const isLoad = entry.type === "loaded";
            const color = isLoad ? "#1d4ed8" : "#15803d";
            const bg = isLoad ? "#eff6ff" : "#f0fdf4";
            const border = isLoad ? "#bfdbfe" : "#bbf7d0";
            const icon = isLoad ? "🔵" : "🟢";
            const label = isLoad ? "LOADED" : "UNLOADED to warehouse";
            const dateLabel = new Date(entry.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
            const timeLabel = new Date(entry.timestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/Chicago" });
            return (
              <div key={idx} style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 3 }}>
                  <div style={{ fontSize: 16 }}>{icon}</div>
                  {idx < timeline.length - 1 && <div style={{ width: 2, flex: 1, background: t.borderLight, marginTop: 4 }} />}
                </div>
                <div style={{ flex: 1, background: bg, border: "1px solid " + border, borderRadius: 8, padding: "9px 11px", marginBottom: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color, marginBottom: 4 }}>{dateLabel} — {label} <span style={{ fontWeight: 400, opacity: 0.7 }}>at {timeLabel}</span></div>
                  {Object.entries(entry.items).map(([itemId, qty]) => {
                    const item = INVENTORY_ITEMS.find(i => i.id === itemId);
                    const name = item ? item.name : itemId;
                    return <div key={itemId} style={{ fontSize: 12, color: t.text, marginBottom: 2 }}>• {name}: <strong>{item ? fmtQty(itemId, qty) : qty}</strong></div>;
                  })}
                  {entry.notes && <div style={{ fontSize: 11, color: t.textMuted, marginTop: 4, fontStyle: "italic" }}>{entry.notes}</div>}
                </div>
              </div>
            );
          })}
          <button onClick={onOpenCalendar} style={{ marginTop: 4, width: "100%", padding: "9px", borderRadius: 8, background: "none", border: "1px solid " + t.border, color: t.textMuted, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>📅 Full Calendar View</button>
        </div>
      )}
    </Modal>
  );
}


// ─── Job Photos Section ───
function JobPhotosSection({ job, canDelete, uploaderName, emptyText }) {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [lightboxIdx, setLightboxIdx] = useState(null);
  const photos = job.photos || [];

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    try {
      const newPhotos = [...photos];
      for (const file of files) {
        const filename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const path = `jobs/${job.id}/photos/${filename}`;
        const sRef = storageRef(storage, path);
        await uploadBytes(sRef, file);
        const url = await getDownloadURL(sRef);
        newPhotos.push({
          url,
          filename,
          uploadedBy: uploaderName || "Unknown",
          uploadedAt: new Date().toISOString(),
        });
      }
      await updateDoc(doc(db, "jobs", job.id), { photos: newPhotos });
    } catch (err) {
      alert("Upload failed: " + err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (photo, idx) => {
    if (!window.confirm("Delete this photo?")) return;
    setDeleting(idx);
    try {
      const path = `jobs/${job.id}/photos/${photo.filename}`;
      const sRef = storageRef(storage, path);
      await deleteObject(sRef).catch(() => {});
      const newPhotos = photos.filter((_, i) => i !== idx);
      await updateDoc(doc(db, "jobs", job.id), { photos: newPhotos });
    } catch (err) {
      alert("Delete failed: " + err.message);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div style={{ marginBottom: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", paddingBottom: "6px", borderBottom: "1px solid " + t.borderLight }}>
        <div style={{ fontSize: "12px", fontWeight: 600, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>📷 Photos {photos.length > 0 ? `(${photos.length})` : ""}</div>
        <label style={{ cursor: "pointer", padding: "5px 12px", background: t.accent, color: "#fff", borderRadius: "6px", fontSize: "12px", fontWeight: 600, opacity: uploading ? 0.6 : 1, pointerEvents: uploading ? "none" : "auto" }}>
          {uploading ? "Uploading…" : "+ Add Photo"}
          <input type="file" accept="image/*" multiple onChange={handleUpload} style={{ display: "none" }} />
        </label>
      </div>
      {photos.length === 0 ? (
        <div style={{ fontSize: "12px", color: t.textMuted, fontStyle: "italic" }}>{emptyText || "No photos yet."}</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: "8px" }}>
          {photos.map((photo, idx) => (
            <div key={idx} style={{ position: "relative", borderRadius: "8px", overflow: "hidden", aspectRatio: "1", background: t.bg, cursor: "pointer" }} onClick={() => setLightboxIdx(idx)}>
              <img src={photo.url} alt={photo.filename} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              {canDelete && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(photo, idx); }}
                  disabled={deleting === idx}
                  style={{ position: "absolute", top: "4px", right: "4px", background: "rgba(220,38,38,0.85)", border: "none", color: "#fff", borderRadius: "50%", width: "22px", height: "22px", cursor: "pointer", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}
                >✕</button>
              )}
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.5)", padding: "2px 4px" }}>
                <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.8)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{photo.uploadedBy}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxIdx !== null && photos[lightboxIdx] && (() => {
        const photo = photos[lightboxIdx];
        const total = photos.length;
        const fmt = (iso) => { try { return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }); } catch { return iso; } };
        return (
          <div onClick={() => setLightboxIdx(null)} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.88)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "16px" }}>
            {/* Close */}
            <button onClick={() => setLightboxIdx(null)} style={{ position: "absolute", top: "16px", right: "20px", background: "none", border: "none", color: "#fff", fontSize: "28px", cursor: "pointer", lineHeight: 1 }}>✕</button>

            {/* Counter */}
            <div style={{ position: "absolute", top: "18px", left: "50%", transform: "translateX(-50%)", color: "rgba(255,255,255,0.6)", fontSize: "13px" }}>{lightboxIdx + 1} / {total}</div>

            {/* Nav + image row */}
            <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: "16px", width: "100%", maxWidth: "900px" }}>
              <button onClick={() => setLightboxIdx((lightboxIdx - 1 + total) % total)} style={{ background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", borderRadius: "50%", width: "44px", height: "44px", fontSize: "22px", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>‹</button>
              <img src={photo.url} alt={photo.filename} style={{ flex: 1, maxHeight: "70vh", objectFit: "contain", borderRadius: "8px", display: "block" }} />
              <button onClick={() => setLightboxIdx((lightboxIdx + 1) % total)} style={{ background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", borderRadius: "50%", width: "44px", height: "44px", fontSize: "22px", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>›</button>
            </div>

            {/* Meta */}
            <div onClick={(e) => e.stopPropagation()} style={{ marginTop: "14px", textAlign: "center" }}>
              <div style={{ color: "#fff", fontSize: "13px", fontWeight: 600 }}>{photo.uploadedBy}</div>
              {photo.uploadedAt && <div style={{ color: "rgba(255,255,255,0.55)", fontSize: "12px", marginTop: "3px" }}>{fmt(photo.uploadedAt)}</div>}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Job Completion PDF ───
function generateJobPDF(job, updates, pmUpdates, members) {
  const doc2 = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210;
  const margin = 16;
  let y = 0;

  // Header background
  doc2.setFillColor(15, 23, 42);
  doc2.rect(0, 0, W, 38, "F");

  // IST accent stripe
  doc2.setFillColor(37, 99, 235);
  doc2.rect(margin, 10, 3, 18, "F");

  // Company name
  doc2.setTextColor(255, 255, 255);
  doc2.setFontSize(22);
  doc2.setFont("helvetica", "bold");
  doc2.text("IST", margin + 7, 22);
  doc2.setFontSize(8);
  doc2.setFont("helvetica", "normal");
  doc2.setTextColor(147, 197, 253);
  doc2.text("INSULATION SERVICES OF TULSA", margin + 7, 28);
  doc2.setTextColor(255, 255, 255);
  doc2.setFontSize(11);
  doc2.setFont("helvetica", "bold");
  doc2.text("Job Completion Report", W - margin, 23, { align: "right" });
  doc2.setFontSize(8);
  doc2.setFont("helvetica", "normal");
  doc2.setTextColor(147, 197, 253);
  doc2.text(new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }), W - margin, 29, { align: "right" });

  y = 48;

  // Job Details Section
  doc2.setTextColor(17, 24, 39);
  doc2.setFontSize(13);
  doc2.setFont("helvetica", "bold");
  doc2.text(job.builder || "No Customer Listed", margin, y);
  y += 7;
  doc2.setFontSize(10);
  doc2.setFont("helvetica", "normal");
  doc2.setTextColor(75, 85, 99);
  doc2.text(job.address || "", margin, y);
  y += 5;
  doc2.text(`Job Type: ${job.type || "—"}   |   Date: ${job.date ? new Date(job.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}`, margin, y);
  y += 5;

  // Crew
  const assignedNames = (job.crewMemberIds || []).map(id => members.find(m => m.id === id)?.name).filter(Boolean);
  if (assignedNames.length > 0) {
    doc2.text(`Crew: ${assignedNames.join(", ")}`, margin, y);
    y += 5;
  }

  // Completed at
  const completedUpd = (updates || []).filter(u => u.jobId === job.id && u.status === "completed").sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
  if (completedUpd) {
    const completedDate = new Date(completedUpd.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
    doc2.text(`Completed: ${completedDate}`, margin, y);
    y += 5;
  }
  if (job.closedAt) {
    const closedDate = new Date(job.closedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    doc2.text(`Closed out: ${closedDate}`, margin, y);
    y += 5;
  }

  y += 4;

  // Materials Section
  const hasMaterials = (job.dailyMaterialLogs || []).length > 0 || Object.keys(job.materialsUsed || {}).length > 0;
  if (hasMaterials) {
    doc2.setFillColor(238, 242, 255);
    doc2.roundedRect(margin, y, W - margin * 2, 7, 2, 2, "F");
    doc2.setTextColor(26, 86, 219);
    doc2.setFontSize(9);
    doc2.setFont("helvetica", "bold");
    doc2.text("MATERIALS USED", margin + 4, y + 5);
    y += 11;

    doc2.setFont("helvetica", "normal");
    doc2.setTextColor(17, 24, 39);
    doc2.setFontSize(9);

    const isFoamId = id => ["oc_a","oc_b","cc_a","cc_b","env_oc_a","env_oc_b","env_cc_a","env_cc_b","free_env_oc_a","free_env_oc_b"].includes(id);

    const renderMaterials = (mats) => {
      Object.entries(mats || {}).forEach(([itemId, qty]) => {
        const item = INVENTORY_ITEMS.find(i => i.id === itemId);
        if (!item) return;
        const display = isFoamId(itemId)
          ? Math.round(qty * (["cc_a","cc_b","env_cc_a","env_cc_b"].includes(itemId) ? 50 : 48)) + " gal"
          : qty + " " + item.unit;
        doc2.text(`• ${item.name}: ${display}`, margin + 4, y);
        y += 5;
      });
    };

    if ((job.dailyMaterialLogs || []).length > 0) {
      (job.dailyMaterialLogs || []).forEach(log => {
        doc2.setTextColor(75, 85, 99);
        doc2.text(`${log.date} — logged by ${log.loggedBy}`, margin + 4, y);
        y += 5;
        doc2.setTextColor(17, 24, 39);
        renderMaterials(log.materials);
      });
    } else {
      renderMaterials(job.materialsUsed);
    }
    y += 4;
  }

  // PM Notes Section
  const jobPm = (pmUpdates || []).filter(p => p.jobId === job.id).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  if (jobPm.length > 0) {
    doc2.setFillColor(254, 243, 199);
    doc2.roundedRect(margin, y, W - margin * 2, 7, 2, 2, "F");
    doc2.setTextColor(180, 83, 9);
    doc2.setFontSize(9);
    doc2.setFont("helvetica", "bold");
    doc2.text("PROJECT MANAGER NOTES", margin + 4, y + 5);
    y += 11;
    doc2.setFont("helvetica", "normal");
    doc2.setTextColor(17, 24, 39);
    doc2.setFontSize(9);
    jobPm.forEach(p => {
      const lines = doc2.splitTextToSize(`${p.user} (${p.timeStr || ""}): ${p.note}`, W - margin * 2 - 8);
      lines.forEach(line => {
        doc2.text(`• ${line}`, margin + 4, y);
        y += 5;
      });
    });
    y += 4;
  }

  // Completion Notes
  if (completedUpd?.notes) {
    doc2.setFont("helvetica", "bold");
    doc2.setFontSize(9);
    doc2.setTextColor(75, 85, 99);
    doc2.text("COMPLETION NOTES:", margin, y);
    y += 5;
    doc2.setFont("helvetica", "normal");
    doc2.setTextColor(17, 24, 39);
    const lines = doc2.splitTextToSize(completedUpd.notes, W - margin * 2);
    lines.forEach(line => { doc2.text(line, margin, y); y += 5; });
    y += 4;
  }

  // Photos note
  const photos = job.photos || [];
  if (photos.length > 0) {
    doc2.setFont("helvetica", "bold");
    doc2.setFontSize(9);
    doc2.setTextColor(75, 85, 99);
    doc2.text(`PHOTOS: ${photos.length} photo${photos.length > 1 ? "s" : ""} attached in IST Dispatch.`, margin, y);
    y += 8;
  }

  // Footer
  const footerY = 285;
  doc2.setDrawColor(226, 229, 234);
  doc2.line(margin, footerY - 4, W - margin, footerY - 4);
  doc2.setTextColor(156, 163, 175);
  doc2.setFontSize(8);
  doc2.setFont("helvetica", "normal");
  doc2.text("Insulation Services of Tulsa  |  918-232-9055  |  istulsa.com", W / 2, footerY, { align: "center" });
  doc2.text(`Generated ${new Date().toLocaleString("en-US", { timeZone: "America/Chicago" })} CST`, W / 2, footerY + 5, { align: "center" });

  const safeName = (job.builder || "Job").replace(/[^a-zA-Z0-9]/g, "_");
  doc2.save(`IST_Report_${safeName}_${job.date || "unknown"}.pdf`);
}

function AdminDashboard({  adminName, trucks, jobs, updates, jobUpdates, tickets, activityLog, pmUpdates, members, inventory, truckInventory, returnLog, loadLog, tools, toolCheckouts, employeeFlags, onAddTool, onEditTool, onDeleteTool, onCheckout, onReturn, onSetFlag, onAddTruck, onDeleteTruck, onReorderTruck, onAddJob, onEditJob, onDeleteJob, onUpdateTicket, onSubmitTicket, onLogAction, onSubmitPmUpdate, onUpdateInventory, onAddJobUpdate, onUpdateTruck, onAdminSetLoadout, onAdminUnload, onLogout, foamPartsInventory, projectToolsInventory, onUpdateFoamParts, onUpdateProjectTools }) {
  const [view, setView] = useState("schedule");
  const [scheduleView, setScheduleView] = useState("insulation"); // "insulation" | "energySeal"
  const [showAddJob, setShowAddJob] = useState(false);
  const [expandedJobs, setExpandedJobs] = useState({});
  const toggleJobExpand = (id) => setExpandedJobs(prev => ({ ...prev, [id]: !prev[id] }));
  const [showAddTruck, setShowAddTruck] = useState(false);
  const [truckHistoryView, setTruckHistoryView] = useState(null);
  const [truckDetailView, setTruckDetailView] = useState(null);
  const [showAdminTicketForm, setShowAdminTicketForm] = useState(false);
  const [adminTicketForm, setAdminTicketForm] = useState({ truckId: "", description: "", priority: "medium", ticketType: "equipment" });
  const [jobForm, setJobForm] = useState({ address: "", builder: "", type: JOB_TYPES[0], truckId: "", crewMemberIds: [], date: todayStr(), notes: "", jobCategory: "" });
  const [addCrewSearch, setAddCrewSearch] = useState("");
  const [truckForm, setTruckForm] = useState({ name: "", members: "" });
  const [activeTicket, setActiveTicket] = useState(null);
  const [ticketStatus, setTicketStatus] = useState("acknowledged");
  const [ticketNote, setTicketNote] = useState("");
  const [ticketFilter, setTicketFilter] = useState("active");
  const [ticketTypeTab, setTicketTypeTab] = useState("equipment");
  const [editingJob, setEditingJob] = useState(null);
  const [editForm, setEditForm] = useState({ address: "", builder: "", type: "", truckId: "", crewMemberIds: [], date: "", notes: "", jobCategory: "" });
  const [editCrewSearch, setEditCrewSearch] = useState("");
  const [truckFilter, setTruckFilter] = useState(null);
  const [showUncheckedOnly, setShowUncheckedOnly] = useState(false);
  const [showOngoing, setShowOngoing] = useState(false);
  const [showCheckHistory, setShowCheckHistory] = useState(false);
  const [needsCheckExpanded, setNeedsCheckExpanded] = useState(false);
  const [checkPanelTab, setCheckPanelTab] = useState("needs"); // "needs" | "recent"
  const [recentlyCheckedExpanded, setRecentlyCheckedExpanded] = useState(false);
  const [pmJob, setPmJob] = useState(null);
  const [pmNote, setPmNote] = useState("");
  const [pmCheckToast, setPmCheckToast] = useState("");
  const [pmCheckedAM, setPmCheckedAM] = useState("No");
  const [pmCheckedPM, setPmCheckedPM] = useState("No");
  const [pmLocation, setPmLocation] = useState(null); // { lat, lng, accuracy }
  const [pmLocationStatus, setPmLocationStatus] = useState("idle"); // idle | loading | granted | denied
  const [calViewJobId, setCalViewJobId] = useState(null);
  const calViewJob = calViewJobId ? (jobs.find(j => j.id === calViewJobId) || null) : null;
  const setCalViewJob = (job) => setCalViewJobId(job ? job.id : null);
  const [calDayView, setCalDayView] = useState(null); // { dateStr, jobs }
  const [editMatLogIdx, setEditMatLogIdx] = useState(null); // index into dailyMaterialLogs
  const [editMatLogQtys, setEditMatLogQtys] = useState({});
  const [invSearch, setInvSearch] = useState("");
  const [invCatFilter, setInvCatFilter] = useState(null);
  const [invSort, setInvSort] = useState("category");
  const [invStatusFilter, setInvStatusFilter] = useState("all");
  const [invTab, setInvTab] = useState("materials");
  const [foamPartsQtys, setFoamPartsQtys] = useState({});
  const [projectToolsQtys, setProjectToolsQtys] = useState({});
  const [showEodSummary, setShowEodSummary] = useState(false);
  const [showReconcile, setShowReconcile] = useState(false);
  const [toasts, dismissToast] = useJobUpdateToasts(updates, jobs);

  const deptTruckIds = new Set(
    trucks.filter(tr => scheduleView === "energySeal" ? tr.department === "energySeal" : (tr.department !== "energySeal"))
          .map(tr => tr.id)
  );
  const activeJobs = jobs.filter((j) => {
    if (j.onHold) return false;
    const latest = updates.filter((u) => u.jobId === j.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
    const isCompleted = latest && latest.status === "completed";
    const truckMatch = !truckFilter || j.truckId === truckFilter;
    const deptMatch = j.truckId ? deptTruckIds.has(j.truckId) : (scheduleView === "insulation");
    return !isCompleted && truckMatch && deptMatch;
  });
  const onHoldJobs = jobs.filter((j) => j.onHold);

  // Jobs completed in last 48h that haven't been fully checked — shown even after completion
  const now48h = Date.now() - 48 * 60 * 60 * 1000;
  const needsCheckJobs = jobs.filter((j) => {
    if (j.onHold) return false;
    const completedUpd = updates.filter((u) => u.jobId === j.id && u.status === "completed").sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
    if (!completedUpd) return false;
    if (new Date(completedUpd.timestamp).getTime() < now48h) return false;
    const isFullyChecked = j.jobCheckedAM === "Yes" && j.jobCheckedPM === "Yes";
    return !isFullyChecked;
  });

  // Jobs checked (fully) in last 48h — "Recently Checked" tab
  const recentlyCheckedJobs = jobs.filter((j) => {
    if (!j.checkedAt) return false;
    return new Date(j.checkedAt).getTime() >= now48h;
  }).sort((a, b) => new Date(b.checkedAt) - new Date(a.checkedAt));

  // All jobs completed in last 7 days — for check history
  const now7d = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const checkHistoryJobs = jobs.filter((j) => {
    const completedUpd = updates.filter((u) => u.jobId === j.id && u.status === "completed").sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
    if (!completedUpd) return false;
    return new Date(completedUpd.timestamp).getTime() >= now7d;
  }).sort((a, b) => {
    const aUpd = updates.filter(u => u.jobId === a.id && u.status === "completed").sort((x,y) => new Date(y.timestamp)-new Date(x.timestamp))[0];
    const bUpd = updates.filter(u => u.jobId === b.id && u.status === "completed").sort((x,y) => new Date(y.timestamp)-new Date(x.timestamp))[0];
    return new Date(bUpd?.timestamp || 0) - new Date(aUpd?.timestamp || 0);
  });
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
  const sortedTrucks = [...trucks].filter(tr => scheduleView === "energySeal" ? tr.department === "energySeal" : tr.department !== "energySeal").sort(orderSort);
  const isFoam = (id) => ["oc_a","oc_b","cc_a","cc_b","env_oc_a","env_oc_b","env_cc_a","env_cc_b","free_env_oc_a","free_env_oc_b"].includes(id);

  const getLatestUpdate = (jobId) => { const u = updates.filter((u) => u.jobId === jobId).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); return u.length > 0 ? u[0] : null; };
  const handleAddJob = () => { const cleanCrew = (jobForm.crewMemberIds || []).filter(Boolean); onAddJob({ ...jobForm, crewMemberIds: cleanCrew }); onLogAction("Added job: " + jobForm.address + " (" + jobForm.type + ") — Crew: " + (cleanCrew.map(id => members.find(m => m.id === id)?.name).filter(Boolean).join(", ") || "none")); setJobForm({ address: "", builder: "", type: JOB_TYPES[0], truckId: "", crewMemberIds: [], date: todayStr(), notes: "", jobCategory: "" }); setAddCrewSearch(""); setShowAddJob(false); };
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
  const openEditJob = (job) => { setEditingJob(job); setEditCrewSearch(""); setEditForm({ address: job.address, builder: job.builder || "", type: job.type, truckId: job.truckId || "", crewMemberIds: (job.crewMemberIds || []).filter(Boolean), date: job.date, notes: job.notes || "", jobCategory: job.jobCategory || "" }); };
  const handleSaveEdit = async () => {
    const cleanCrew = (editForm.crewMemberIds || []).filter(Boolean);
    const oldCrew = (editingJob.crewMemberIds || []).filter(Boolean);
    const todayDate = todayCST();
    // Check if job is currently in_progress
    const latestUpd = updates.filter(u => u.jobId === editingJob.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
    const isInProgress = latestUpd && (latestUpd.status === "in_progress" || latestUpd.status === "completed");
    if (isInProgress && onAddJobUpdate) {
      // Log crew_added for new members
      for (const id of cleanCrew) {
        if (!oldCrew.includes(id)) {
          await onAddJobUpdate({ jobId: editingJob.id, type: "crew_added", addedMemberId: id, date: todayDate, timestamp: new Date().toISOString() });
        }
      }
      // Log crew_removed for removed members
      for (const id of oldCrew) {
        if (!cleanCrew.includes(id)) {
          await onAddJobUpdate({ jobId: editingJob.id, type: "crew_removed", removedMemberId: id, date: todayDate, timestamp: new Date().toISOString() });
        }
      }
    }
    await onEditJob(editingJob.id, { ...editForm, crewMemberIds: cleanCrew });
    onLogAction("Edited job: " + editForm.address);
    setEditingJob(null);
  };
  const handleRemoveJob = (job) => { onDeleteJob(job.id); onLogAction("Removed job: " + job.address + " (" + job.type + ")"); };
  const handlePmSubmit = () => {
    if (pmLocationStatus !== "granted" || !pmLocation) return; // guard: location required
    const jobLabel = pmJob.builder || pmJob.address;
    const jobId = pmJob.id;
    const prevAM = pmJob.jobCheckedAM || "No";
    const prevPM = pmJob.jobCheckedPM || "No";
    const changes = {};
    const geoTag = { lat: pmLocation.lat, lng: pmLocation.lng, accuracy: pmLocation.accuracy };
    if (pmCheckedAM !== prevAM) { changes.jobCheckedAM = pmCheckedAM; changes.amCheckedAt = new Date().toISOString(); changes.amGeoTag = geoTag; onLogAction("AM Check: " + pmCheckedAM + " on " + jobLabel); }
    if (pmCheckedPM !== prevPM) { changes.jobCheckedPM = pmCheckedPM; changes.pmCheckedAt = new Date().toISOString(); changes.pmGeoTag = geoTag; onLogAction("PM Check: " + pmCheckedPM + " on " + jobLabel); }
    // When both are checked, record who checked and when
    const bothChecked = pmCheckedAM === "Yes" && pmCheckedPM === "Yes";
    if (bothChecked) { changes.checkedAt = new Date().toISOString(); changes.checkedBy = adminName || "Admin"; changes.checkedLat = pmLocation.lat; changes.checkedLng = pmLocation.lng; changes.checkedGeoAccuracy = pmLocation.accuracy; }
    if (pmNote.trim()) { onSubmitPmUpdate({ jobId, user: adminName, note: pmNote, timestamp: new Date().toISOString(), timeStr: timeStr() }); onLogAction("PM note on " + jobLabel + ": \"" + pmNote.trim().slice(0, 80) + (pmNote.trim().length > 80 ? "..." : "") + "\""); }
    onEditJob(jobId, { jobCheckedAM: pmCheckedAM, jobCheckedPM: pmCheckedPM, ...changes });
    setPmJob(null); setPmNote(""); setPmCheckedAM("No"); setPmCheckedPM("No");
    setPmCheckToast("✅ Checked!"); setTimeout(() => setPmCheckToast(""), 2500);
  };
  // Auto-request geolocation when PM check modal opens
  useEffect(() => {
    if (pmJob) {
      setPmLocation(null);
      setPmLocationStatus("loading");
      if (!navigator.geolocation) {
        setPmLocationStatus("denied");
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPmLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) });
          setPmLocationStatus("granted");
        },
        () => { setPmLocationStatus("denied"); },
        { timeout: 15000, maximumAge: 0, enableHighAccuracy: true }
      );
    } else {
      setPmLocation(null);
      setPmLocationStatus("idle");
    }
  }, [pmJob]);

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
      const jobStatusUpds = updates.filter(u => u.jobId === j.id).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      // Must have at least one in_progress or completed update to appear on calendar
      const startedUpdate = jobStatusUpds.find(u => u.status === "in_progress" || u.status === "completed");
      if (!startedUpdate) return false;
      const startedDate = tsToCST(startedUpdate.timestamp);
      const completedUpdate = jobStatusUpds.find(u => u.status === "completed");
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
    tools: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
  };
  const NAV_ITEMS = [
    { key: "schedule", label: "Schedule", badge: needsCheckJobs.length },
    { key: "calendar", label: "Calendar" },
    { key: "tickets", label: "Tickets", badge: openTicketCount },
    { key: "trucks", label: "Trucks" },
    { key: "tools", label: "Tools" },
    { key: "inventory", label: "Inventory" },
    { key: "roster", label: "Roster" },
    { key: "log", label: "Log" },
  ];

  return (
    <div style={{ minHeight: "100dvh", background: t.bg, paddingBottom: "calc(84px + env(safe-area-inset-bottom, 0px))", paddingTop: "calc(64px + env(safe-area-inset-top, 0px))" }}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      {showEodSummary && <EodSummaryModal jobs={jobs} updates={updates} tickets={tickets} members={members} loadLog={loadLog} returnLog={returnLog} onClose={() => setShowEodSummary(false)} />}
      {/* Top header — title + logout only */}
      <div className="glass-header" style={{ padding: "12px 20px", paddingTop: "calc(12px + env(safe-area-inset-top, 0px))", position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, boxShadow: "0 2px 12px rgba(0,0,0,0.18)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <svg width="180" height="50" viewBox="0 0 360 100" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
            <rect width="360" height="100" fill="#0f172a" rx="8"/>
            <rect x="18" y="14" width="4" height="72" fill="#2563eb" rx="2"/>
            <text x="32" y="80" fontFamily="Arial Black,sans-serif" fontSize="72" fontWeight="900" fill="white" letterSpacing="-3">IST</text>
            <line x1="168" y1="16" x2="168" y2="84" stroke="#1e3a5f" strokeWidth="1.5"/>
            <text x="180" y="38" fontFamily="Arial,sans-serif" fontSize="12" fontWeight="700" fill="#3b82f6" letterSpacing="3">INSULATION</text>
            <text x="180" y="56" fontFamily="Arial,sans-serif" fontSize="12" fontWeight="700" fill="#3b82f6" letterSpacing="3">SERVICES</text>
            <text x="180" y="74" fontFamily="Arial,sans-serif" fontSize="12" fontWeight="700" fill="#3b82f6" letterSpacing="3">OF TULSA</text>
          </svg>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "12.5px", color: "rgba(255,255,255,0.6)" }}>{adminName}</span>
            <Button variant="ghost" onClick={onLogout} style={{ fontSize: "12px", color: "#0f172a" }}>Log Out</Button>
          </div>
        </div>
      </div>

      {/* Bottom nav */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 200, display: "flex", flexDirection: "column", background: t.surface, borderTop: "1px solid " + t.border, boxShadow: "0 -4px 20px rgba(0,0,0,0.18)" }}>
        <div style={{ display: "flex", padding: "4px 4px 0" }}>
        {NAV_ITEMS.map(item => {
          const isActive = view === item.key;
          return (
            <button key={item.key}
              className="nav-tab-btn"
              onClick={() => { if (item.key === "schedule" || item.key === "tickets") setTruckFilter(null); setView(item.key); }}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: isActive ? "7px 2px 8px" : "8px 2px 8px",
                background: isActive ? "rgba(37,99,235,0.25)" : "none",
                border: "none",
                borderRadius: "10px",
                cursor: "pointer",
                fontFamily: "inherit",
                position: "relative",
                gap: "3px",
                transition: "all 0.15s ease",
                margin: "0 1px",
                minHeight: "56px",
              }}>
              <span style={{ lineHeight: 1, color: isActive ? t.accent : "#94a3b8", transform: isActive ? "scale(1.15)" : "scale(1)", display: "block", transition: "all 0.15s ease", filter: isActive ? "drop-shadow(0 0 4px #2563eb)" : "none" }}>{NAV_ICONS[item.key]}</span>
              <span style={{ fontSize: "10px", fontWeight: isActive ? 700 : 500, color: isActive ? t.accent : "#94a3b8", transition: "all 0.15s", letterSpacing: isActive ? "-0.2px" : "0" }}>{item.label}</span>
              <span style={{ display: "block", width: "4px", height: "4px", borderRadius: "50%", background: isActive ? t.accent : "transparent", marginTop: "1px", transition: "background 0.15s", boxShadow: isActive ? "0 0 4px #2563eb" : "none" }} />
              {item.badge > 0 && <span style={{ position: "absolute", top: "5px", right: "calc(50% - 18px)", background: t.danger, color: "#fff", fontSize: "9px", fontWeight: 700, borderRadius: "99px", padding: "1px 4px", minWidth: "15px", height: "15px", display: "flex", alignItems: "center", justifyContent: "center", animation: "badgePulse 1.8s ease-in-out infinite" }}>{item.badge}</span>}
            </button>
          );
        })}
        </div>
        <div style={{ height: "env(safe-area-inset-bottom, 0px)", background: "transparent" }} />
      </div>

      <div style={{ padding: "20px", maxWidth: "1400px", margin: "0 auto" }}>

        {view === "schedule" && (
          <>
            {/* Department toggle */}
            <div style={{ display: "flex", gap: 0, marginBottom: 16, borderRadius: 8, overflow: "hidden", border: "1px solid " + t.border, width: "fit-content" }}>
              {[{key:"insulation",label:"🏠 Insulation"},{key:"energySeal",label:"⚡ Energy Seal"}].map(({key,label}) => (
                <button key={key} onClick={() => { setScheduleView(key); setTruckFilter(null); }} style={{ padding: "9px 20px", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: scheduleView === key ? 700 : 500, background: scheduleView === key ? t.accent : t.surface, color: scheduleView === key ? "#fff" : t.textMuted, transition: "all 0.15s" }}>{label}</button>
              ))}
            </div>

            {/* ─── MOBILE: Needs Check / Recently Checked tabs at top ─── */}
            {!showCheckHistory && (needsCheckJobs.length > 0 || recentlyCheckedJobs.length > 0) && window.innerWidth < 768 && (() => {
              return (
                <div style={{ marginBottom: 12 }}>
                  {/* Tab switcher */}
                  <div style={{ display: "flex", gap: 0, marginBottom: 0 }}>
                    <button onClick={() => { setCheckPanelTab("needs"); setNeedsCheckExpanded(p => checkPanelTab !== "needs" ? true : !p); }}
                      style={{ flex: 1, padding: "10px 8px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", border: "2px solid #f87171", borderRight: "1px solid #f87171", borderRadius: "10px 0 0 0", background: checkPanelTab === "needs" ? "#fff1f2" : "#ffeaea", color: "#b91c1c", borderBottom: checkPanelTab === "needs" && needsCheckExpanded ? "none" : "2px solid #f87171" }}>
                      ⚠️ Needs Check {needsCheckJobs.length > 0 && <span style={{ background: "#dc2626", color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 11, marginLeft: 4 }}>{needsCheckJobs.length}</span>}
                    </button>
                    <button onClick={() => { setCheckPanelTab("recent"); setRecentlyCheckedExpanded(p => checkPanelTab !== "recent" ? true : !p); }}
                      style={{ flex: 1, padding: "10px 8px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", border: "2px solid #f87171", borderLeft: "1px solid #f87171", borderRadius: "0 10px 0 0", background: checkPanelTab === "recent" ? "#f0fdf4" : "#e8faf0", color: "#15803d", borderBottom: checkPanelTab === "recent" && recentlyCheckedExpanded ? "none" : "2px solid #f87171" }}>
                      ✅ Recently Checked {recentlyCheckedJobs.length > 0 && <span style={{ background: "#15803d", color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 11, marginLeft: 4 }}>{recentlyCheckedJobs.length}</span>}
                    </button>
                  </div>
                  {/* Needs Check panel */}
                  {checkPanelTab === "needs" && needsCheckExpanded && (
                    <div style={{ border: "2px solid #f87171", borderTop: "none", borderRadius: "0 0 10px 10px", background: "#fff" }}>
                      {needsCheckJobs.length === 0
                        ? <div style={{ padding: "16px 14px", fontSize: 13, color: "#6b7280" }}>No jobs need checking right now.</div>
                        : needsCheckJobs.map((job) => {
                          const completedUpd = updates.filter(u => u.jobId === job.id && u.status === "completed").sort((a,b) => new Date(b.timestamp)-new Date(a.timestamp))[0];
                          const hoursAgo = completedUpd ? Math.floor((Date.now() - new Date(completedUpd.timestamp)) / 3600000) : null;
                          return (
                            <div key={job.id} style={{ padding: "12px 14px", borderBottom: "1px solid #fecaca" }}>
                              {job.builder && <div style={{ fontWeight: 700, fontSize: 15, color: "#111", marginBottom: 2 }}>{job.builder}</div>}
                              {job.address && <div style={{ fontSize: 14, fontWeight: 600, color: "#1d4ed8", marginBottom: 3 }}><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb", textDecoration: "underline", cursor: "pointer" }}>📍 {job.address}</a></div>}
                              {hoursAgo !== null && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 2 }}>Completed {hoursAgo}h ago</div>}
                              <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
                                <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: job.jobCheckedAM === "Yes" ? "#dcfce7" : "#fee2e2", color: job.jobCheckedAM === "Yes" ? "#15803d" : "#dc2626" }}>AM {job.jobCheckedAM === "Yes" ? "✓" : "✗"}</span>
                                <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: job.jobCheckedPM === "Yes" ? "#dcfce7" : "#fee2e2", color: job.jobCheckedPM === "Yes" ? "#15803d" : "#dc2626" }}>PM {job.jobCheckedPM === "Yes" ? "✓" : "✗"}</span>
                              </div>
                              <button onClick={() => { setPmJob(job); setPmCheckedAM(job.jobCheckedAM || "No"); setPmCheckedPM(job.jobCheckedPM || "No"); setPmNote(""); }} style={{ marginTop: 8, width: "100%", minHeight: 48, padding: "10px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>✓ Mark as Checked</button>
                            </div>
                          );
                        })
                      }
                    </div>
                  )}
                  {/* Recently Checked panel */}
                  {checkPanelTab === "recent" && recentlyCheckedExpanded && (
                    <div style={{ border: "2px solid #86efac", borderTop: "none", borderRadius: "0 0 10px 10px", background: "#f0fdf4" }}>
                      {recentlyCheckedJobs.length === 0
                        ? <div style={{ padding: "16px 14px", fontSize: 13, color: "#6b7280" }}>No jobs checked in the last 48 hours.</div>
                        : recentlyCheckedJobs.map((job) => {
                          const checkedTime = new Date(job.checkedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
                          return (
                            <div key={job.id} style={{ padding: "12px 14px", borderBottom: "1px solid #bbf7d0" }}>
                              {job.builder && <div style={{ fontWeight: 700, fontSize: 15, color: "#14532d", marginBottom: 2 }}>{job.builder}</div>}
                              {job.address && <div style={{ fontSize: 14, fontWeight: 600, color: "#15803d", marginBottom: 3 }}><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb", textDecoration: "underline", cursor: "pointer" }}>📍 {job.address}</a></div>}
                              <div style={{ fontSize: 11, color: "#166534", marginTop: 2 }}>✅ Checked by <strong>{job.checkedBy || "—"}</strong> · {checkedTime}</div>
                              {job.checkedLat && job.checkedLng
                                ? <div style={{ fontSize: 11, marginTop: 3 }}><a href={`https://www.google.com/maps?q=${job.checkedLat},${job.checkedLng}`} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb", textDecoration: "underline" }}>📍 View Check Location</a></div>
                                : <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3 }}>📍 Location not recorded</div>
                              }
                              <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: job.jobCheckedAM === "Yes" ? "#dcfce7" : "#fee2e2", color: job.jobCheckedAM === "Yes" ? "#15803d" : "#dc2626" }}>AM {job.jobCheckedAM === "Yes" ? "✓" : "✗"}</span>
                                <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: job.jobCheckedPM === "Yes" ? "#dcfce7" : "#fee2e2", color: job.jobCheckedPM === "Yes" ? "#15803d" : "#dc2626" }}>PM {job.jobCheckedPM === "Yes" ? "✓" : "✗"}</span>
                              </div>
                            </div>
                          );
                        })
                      }
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ─── TWO-COLUMN LAYOUT WRAPPER (desktop/iPad: schedule + needs-check side by side) ─── */}
            <div style={{ display: "grid", gridTemplateColumns: (!showCheckHistory && (needsCheckJobs.length > 0 || recentlyCheckedJobs.length > 0) && window.innerWidth >= 768) ? "1fr 320px" : "1fr", gap: 20, alignItems: "start" }}>
              {/* ─── LEFT COLUMN: everything except Needs Check ─── */}
              <div>

            {/* ─── CHECK HISTORY VIEW ─── */}
            {showCheckHistory && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <button onClick={() => setShowCheckHistory(false)} style={{ background: t.surface, border: "1px solid " + t.border, borderRadius: 6, padding: "6px 12px", cursor: "pointer", color: t.text, fontSize: 13, fontFamily: "inherit", fontWeight: 600 }}>← Back</button>
                  <div style={{ fontSize: 17, fontWeight: 700, color: t.text }}>Check History — Last 7 Days</div>
                </div>
                {checkHistoryJobs.length === 0
                  ? <div style={{ fontSize: 14, color: t.textMuted, padding: "20px 0" }}>No completed jobs in the last 7 days.</div>
                  : (
                    <div style={{ background: t.surface, border: "1px solid " + t.border, borderRadius: 10, overflow: "hidden" }}>
                      {/* Header row */}
                      <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1.2fr 1fr 1.5fr", gap: 8, padding: "10px 14px", background: t.bg, fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid " + t.border }}>
                        <div>Job</div><div>Address</div><div>Completed</div><div>Checked?</div><div>Checked By</div>
                      </div>
                      {checkHistoryJobs.map((job) => {
                        const completedUpd = updates.filter(u => u.jobId === job.id && u.status === "completed").sort((a,b) => new Date(b.timestamp)-new Date(a.timestamp))[0];
                        const completedDate = completedUpd ? new Date(completedUpd.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";
                        const isChecked = job.jobCheckedAM === "Yes" && job.jobCheckedPM === "Yes";
                        const checkedAt = job.checkedAt ? new Date(job.checkedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : (job.amCheckedAt || job.pmCheckedAt) ? new Date(job.pmCheckedAt || job.amCheckedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
                        return (
                          <div key={job.id} style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1.2fr 1fr 1.5fr", gap: 8, padding: "12px 14px", fontSize: 13, color: t.text, borderBottom: "1px solid " + t.borderLight, alignItems: "center", background: isChecked ? "#f0fdf4" : "#fff9f9" }}>
                            <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{job.builder || "No Customer"}</div>
                            <div style={{ color: t.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12 }}>{job.address?.split(",")[0]}</div>
                            <div style={{ color: t.textMuted, fontSize: 12 }}>{completedDate}</div>
                            <div>
                              {isChecked
                                ? <span style={{ color: "#15803d", fontWeight: 700, fontSize: 15 }}>✅</span>
                                : <span style={{ color: "#dc2626", fontWeight: 700, fontSize: 13 }}>⚠️ No</span>}
                            </div>
                            <div style={{ color: t.textMuted, fontSize: 12 }}>
                              {isChecked ? (job.checkedBy || "—") : "—"}
                              {isChecked && checkedAt && <div style={{ fontSize: 10, color: t.textMuted }}>{checkedAt}</div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                }
              </div>
            )}

            {(() => { const uncheckedCount = activeJobs.filter((j) => j.jobCheckedAM !== "Yes" || j.jobCheckedPM !== "Yes").length; return (
            <SectionHeader title={scheduleView === "energySeal" ? "Energy Seal Schedule" : "Schedule"} right={<>
              {uncheckedCount > 0 && <button onClick={() => setShowUncheckedOnly(!showUncheckedOnly)} style={{ padding: "6px 12px", border: "1px solid " + (showUncheckedOnly ? t.danger : t.border), borderRadius: "6px", fontSize: "12px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit", background: showUncheckedOnly ? t.dangerBg : "#fff", color: showUncheckedOnly ? t.danger : t.textMuted }}>{showUncheckedOnly ? "Show All" : uncheckedCount + " Unchecked"}</button>}
              <button onClick={() => setShowOngoing(o => !o)} style={{ padding: "6px 12px", border: "1px solid " + (showOngoing ? t.accent : t.border), borderRadius: "6px", fontSize: "12px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit", background: showOngoing ? t.accentBg : "#fff", color: showOngoing ? t.accent : t.textMuted, position: "relative" }}>On-going Jobs{onHoldJobs.length > 0 && <span style={{ position: "absolute", top: -5, right: -5, background: t.accent, color: "#fff", fontSize: 9, fontWeight: 700, borderRadius: "50%", width: 15, height: 15, display: "flex", alignItems: "center", justifyContent: "center" }}>{onHoldJobs.length}</span>}</button>
              <Button variant="secondary" onClick={() => setShowEodSummary(true)} style={{ fontSize: 12 }}>📋 EOD Summary</Button>
              <Button onClick={() => { setJobForm({ ...jobForm, date: todayStr(), type: scheduleView === "energySeal" ? "Energy Seal" : jobForm.type }); setShowAddJob(true); }}>+ Add Job</Button>
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
                          <div style={{ fontSize: 11, color: t.textMuted }}>{job.address?.split(",")[0]} · {new Date(job.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
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
              const unassignedCrew = displayJobs.filter((j) => !(j.crewMemberIds || []).filter(Boolean).length);
              // Group jobs by their assigned crew member combo (sorted IDs joined as key)
              const crewGroupMap = {};
              displayJobs.forEach((j) => {
                const ids = (j.crewMemberIds || []).filter(Boolean).sort();
                const key = ids.length > 0 ? ids.join(",") : "_unassigned";
                if (!crewGroupMap[key]) {
                  const names = ids.map(id => members.find(m => m.id === id)?.name).filter(Boolean);
                  crewGroupMap[key] = { key, names, jobs: [] };
                }
                crewGroupMap[key].jobs.push(j);
              });
              const crewGroups = Object.values(crewGroupMap).sort((a, b) => {
                if (a.key === "_unassigned") return 1;
                if (b.key === "_unassigned") return -1;
                return (a.names[0] || "").localeCompare(b.names[0] || "");
              }).filter((g) => !truckFilter || g.jobs.some(j => j.truckId === truckFilter));
              return <>
                {unassignedCrew.length > 0 && (
                  <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: "8px", padding: "10px 14px", marginBottom: "14px", display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "18px" }}>⚠️</span>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "#92400e" }}>{unassignedCrew.length} job{unassignedCrew.length !== 1 ? "s" : ""} with no employees assigned</div>
                      <div style={{ fontSize: "11px", color: "#78350f", marginTop: "2px" }}>{unassignedCrew.map(j => j.builder || j.address).join(", ")}</div>
                    </div>
                  </div>
                )}
                {crewGroups.map((group) => (
                <div key={group.key} style={{ marginBottom: "20px" }}>
                  {(() => {
                    const headerName = group.names.length > 0 ? group.names.join(" and ") : "Unassigned";
                    return (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", paddingBottom: "6px", borderBottom: "2px solid " + t.accent }}>
                        <div style={{ fontSize: "15px", fontWeight: 600, color: t.text }}>{headerName}</div>

                        <Badge>{group.jobs.length} job{group.jobs.length !== 1 ? "s" : ""}</Badge>
                      </div>
                    );
                  })()}
                  {group.jobs.map((job) => {
                    const latest = getLatestUpdate(job.id);
                    const statusObj = latest ? STATUS_OPTIONS.find((s) => s.value === latest.status) : STATUS_OPTIONS[0];
                    const jobStatusUpdates = updates.filter((u) => u.jobId === job.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                    const jobPmUpds = pmUpdates.filter((p) => p.jobId === job.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
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
                                {jobStatusUpdates.length === 0 ? <div style={{ fontSize: "12.5px", color: t.textMuted }}>Nothing.</div> : jobStatusUpdates.map((u) => {
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
                                {jobPmUpds.length === 0 ? <div style={{ fontSize: "12.5px", color: t.textMuted }}>Nothing.</div> : jobPmUpds.map((p) => (
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

                            {/* Quick crew assignment */}
                            {(() => {
                              const assignedIds = (job.crewMemberIds || []).filter(Boolean);
                              const latestUpd = jobStatusUpdates[0];
                              const isActive = latestUpd && (latestUpd.status === "in_progress" || latestUpd.status === "completed");
                              return (
                                <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px solid " + t.borderLight }}>
                                  <div style={{ fontSize: "11px", fontWeight: 600, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>Assigned Crew</div>
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                                    {assignedIds.map(id => {
                                      const m = members.find(mb => mb.id === id);
                                      return m ? (
                                        <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: 600, background: t.accentBg, color: t.accent, padding: "3px 8px", borderRadius: "14px", border: "1px solid #bfdbfe" }}>
                                          {m.name}
                                          <button onClick={async () => {
                                            const newIds = assignedIds.filter(i => i !== id);
                                            if (isActive && onAddJobUpdate) await onAddJobUpdate({ jobId: job.id, type: "crew_removed", removedMemberId: id, date: todayCST(), timestamp: new Date().toISOString() });
                                            await onEditJob(job.id, { ...job, crewMemberIds: newIds });
                                          }} style={{ background: "none", border: "none", cursor: "pointer", color: "#93c5fd", fontSize: "12px", lineHeight: 1, padding: 0, fontFamily: "inherit" }} title="Remove from job">×</button>
                                        </span>
                                      ) : null;
                                    })}
                                    {members.filter(m => !assignedIds.includes(m.id)).map(m => (
                                      <button key={m.id} onClick={async () => {
                                        const newIds = [...assignedIds, m.id];
                                        if (isActive && onAddJobUpdate) await onAddJobUpdate({ jobId: job.id, type: "crew_added", addedMemberId: m.id, date: todayCST(), timestamp: new Date().toISOString() });
                                        await onEditJob(job.id, { ...job, crewMemberIds: newIds });
                                      }} style={{ fontSize: "11px", fontWeight: 500, background: "transparent", color: t.textMuted, padding: "3px 8px", borderRadius: "14px", border: "1px dashed " + t.border, cursor: "pointer", fontFamily: "inherit" }} title={"Add " + m.name}>+ {m.name.split(" ")[0]}</button>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}
                            {/* Photos section */}
                            <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px solid " + t.borderLight }}>
                              <JobPhotosSection job={job} canDelete={["Johnny","Jordan","Skip","Duck","Carolyn"].includes(adminName)} uploaderName={adminName} emptyText="No photos yet — crew will upload from their jobs" />
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
              ))}</>
            })()}
              </div>{/* end left column */}

              {/* ─── RIGHT COLUMN: Needs Check / Recently Checked panel (desktop/iPad only) ─── */}
              {!showCheckHistory && (needsCheckJobs.length > 0 || recentlyCheckedJobs.length > 0) && window.innerWidth >= 768 && (() => {
                return (
                  <div style={{ position: "sticky", top: 80 }}>
                    {/* Tab switcher */}
                    <div style={{ display: "flex", gap: 0, marginBottom: 0 }}>
                      <button onClick={() => setCheckPanelTab("needs")}
                        style={{ flex: 1, padding: "9px 8px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", border: "2px solid #f87171", borderRight: "1px solid #f87171", borderRadius: "10px 0 0 0", background: checkPanelTab === "needs" ? "#fff1f2" : "#ffe4e4", color: "#b91c1c", borderBottom: checkPanelTab === "needs" ? "none" : "2px solid #f87171" }}>
                        ⚠️ Needs Check {needsCheckJobs.length > 0 && <span style={{ background: "#dc2626", color: "#fff", borderRadius: 10, padding: "1px 5px", fontSize: 10, marginLeft: 3 }}>{needsCheckJobs.length}</span>}
                      </button>
                      <button onClick={() => setCheckPanelTab("recent")}
                        style={{ flex: 1, padding: "9px 8px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", border: "2px solid #86efac", borderLeft: "1px solid #86efac", borderRadius: "0 10px 0 0", background: checkPanelTab === "recent" ? "#f0fdf4" : "#e5faf0", color: "#15803d", borderBottom: checkPanelTab === "recent" ? "none" : "2px solid #86efac" }}>
                        ✅ Recently Checked {recentlyCheckedJobs.length > 0 && <span style={{ background: "#15803d", color: "#fff", borderRadius: 10, padding: "1px 5px", fontSize: 10, marginLeft: 3 }}>{recentlyCheckedJobs.length}</span>}
                      </button>
                    </div>

                    {/* Needs Check panel */}
                    {checkPanelTab === "needs" && (
                      <div style={{ background: "#fff1f2", border: "2px solid #f87171", borderTop: "none", borderRadius: "0 0 12px 12px", overflow: "hidden" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid #fca5a5" }}>
                          <div style={{ fontSize: 11, color: "#ef4444", fontWeight: 600 }}>{needsCheckJobs.length} job{needsCheckJobs.length !== 1 ? "s" : ""} waiting review</div>
                          <button onClick={() => setShowCheckHistory(true)} style={{ fontSize: 11, color: "#b91c1c", background: "none", border: "1px solid #f87171", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>History</button>
                        </div>
                        <div style={{ maxHeight: "60vh", overflowY: "auto", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                          {needsCheckJobs.length === 0
                            ? <div style={{ fontSize: 13, color: "#6b7280", padding: "8px 0" }}>No jobs need checking.</div>
                            : needsCheckJobs.map((job) => {
                              const completedUpd = updates.filter(u => u.jobId === job.id && u.status === "completed").sort((a,b) => new Date(b.timestamp)-new Date(a.timestamp))[0];
                              const completedTime = completedUpd ? new Date(completedUpd.timestamp).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Unknown";
                              const completedBy = completedUpd?.crewName || "Unknown";
                              const isFullyChecked = job.jobCheckedAM === "Yes" && job.jobCheckedPM === "Yes";
                              return (
                                <div key={job.id} style={{ background: "#fff", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 5 }}>
                                  {job.builder && <div style={{ fontSize: 14, fontWeight: 800, color: "#111" }}>{job.builder}</div>}
                                  {job.address && <div style={{ fontSize: 13, fontWeight: 700, color: "#1d4ed8" }}><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb", textDecoration: "underline", cursor: "pointer" }}>📍 {job.address}</a></div>}
                                  <div style={{ fontSize: 11, color: "#b91c1c" }}>By <strong>{completedBy}</strong> · {completedTime}</div>
                                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                                    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 20, background: job.jobCheckedAM === "Yes" ? "#dcfce7" : "#fee2e2", color: job.jobCheckedAM === "Yes" ? "#15803d" : "#dc2626" }}>AM {job.jobCheckedAM === "Yes" ? "✓" : "✗"}</span>
                                    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 20, background: job.jobCheckedPM === "Yes" ? "#dcfce7" : "#fee2e2", color: job.jobCheckedPM === "Yes" ? "#15803d" : "#dc2626" }}>PM {job.jobCheckedPM === "Yes" ? "✓" : "✗"}</span>
                                  </div>
                                  <button onClick={() => { setPmJob(job); setPmCheckedAM(job.jobCheckedAM || "No"); setPmCheckedPM(job.jobCheckedPM || "No"); }} style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", textAlign: "center" }}>✓ Mark as Checked</button>
                                </div>
                              );
                            })
                          }
                        </div>
                      </div>
                    )}

                    {/* Recently Checked panel */}
                    {checkPanelTab === "recent" && (
                      <div style={{ background: "#f0fdf4", border: "2px solid #86efac", borderTop: "none", borderRadius: "0 0 12px 12px", overflow: "hidden" }}>
                        <div style={{ padding: "10px 14px", borderBottom: "1px solid #bbf7d0" }}>
                          <div style={{ fontSize: 11, color: "#15803d", fontWeight: 600 }}>{recentlyCheckedJobs.length} job{recentlyCheckedJobs.length !== 1 ? "s" : ""} checked in last 48h</div>
                        </div>
                        <div style={{ maxHeight: "60vh", overflowY: "auto", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                          {recentlyCheckedJobs.length === 0
                            ? <div style={{ fontSize: 13, color: "#6b7280", padding: "8px 0" }}>No jobs checked in the last 48 hours.</div>
                            : recentlyCheckedJobs.map((job) => {
                              const checkedTime = new Date(job.checkedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
                              return (
                                <div key={job.id} style={{ background: "#fff", border: "1px solid #86efac", borderRadius: 8, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 5 }}>
                                  {job.builder && <div style={{ fontSize: 14, fontWeight: 800, color: "#14532d" }}>{job.builder}</div>}
                                  {job.address && <div style={{ fontSize: 13, fontWeight: 700, color: "#15803d" }}><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb", textDecoration: "underline", cursor: "pointer" }}>📍 {job.address}</a></div>}
                                  <div style={{ fontSize: 11, color: "#166534" }}>✅ Checked by <strong>{job.checkedBy || "—"}</strong> · {checkedTime}</div>
                                  {job.checkedLat && job.checkedLng
                                    ? <div style={{ fontSize: 11 }}><a href={`https://www.google.com/maps?q=${job.checkedLat},${job.checkedLng}`} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb", textDecoration: "underline" }}>📍 View Check Location</a></div>
                                    : <div style={{ fontSize: 11, color: "#9ca3af" }}>📍 Location not recorded</div>
                                  }
                                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                                    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 20, background: job.jobCheckedAM === "Yes" ? "#dcfce7" : "#fee2e2", color: job.jobCheckedAM === "Yes" ? "#15803d" : "#dc2626" }}>AM {job.jobCheckedAM === "Yes" ? "✓" : "✗"}</span>
                                    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 20, background: job.jobCheckedPM === "Yes" ? "#dcfce7" : "#fee2e2", color: job.jobCheckedPM === "Yes" ? "#15803d" : "#dc2626" }}>PM {job.jobCheckedPM === "Yes" ? "✓" : "✗"}</span>
                                  </div>
                                </div>
                              );
                            })
                          }
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>{/* end two-column grid */}
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
            <SectionHeader title="Trucks" right={<Button onClick={() => setShowAddTruck(true)}>+ Add {scheduleView === "energySeal" ? "Technician" : "Truck"}</Button>} />
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
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontWeight: 600, color: t.accent, fontSize: "14.5px", cursor: "pointer", textDecoration: "underline" }} onClick={() => setTruckDetailView(tr)}>{tr.members || tr.name}</span>
                          {tr.department === "energySeal" && <span style={{ fontSize: 10, fontWeight: 700, background: "#fef3c7", color: "#d97706", borderRadius: 4, padding: "1px 6px", border: "1px solid #fde68a" }}>⚡ ES</span>}
                        </div>
                        <div style={{ fontSize: 11, color: t.textMuted }}>Info, loadout &amp; history</div>
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
                              {(() => {
                                const ocS       = Math.min(ti["oc_a"]||0, ti["oc_b"]||0);
                                const ccS       = Math.min(ti["cc_a"]||0, ti["cc_b"]||0);
                                const envOcS    = Math.min(ti["env_oc_a"]||0, ti["env_oc_b"]||0);
                                const envCcS    = Math.min(ti["env_cc_a"]||0, ti["env_cc_b"]||0);
                                const freeEnvOcS= Math.min(ti["free_env_oc_a"]||0, ti["free_env_oc_b"]||0);
                                return <>
                                  {ocS > 0        && <span style={{ fontSize: 12, fontWeight: 600, background: t.accentBg, color: t.accent, padding: "3px 9px", borderRadius: 6 }}>Ambit Open Cell — {ocS.toFixed(2)} sets</span>}
                                  {ccS > 0        && <span style={{ fontSize: 12, fontWeight: 600, background: t.accentBg, color: t.accent, padding: "3px 9px", borderRadius: 6 }}>Ambit Closed Cell — {ccS.toFixed(2)} sets</span>}
                                  {envOcS > 0     && <span style={{ fontSize: 12, fontWeight: 600, background: t.accentBg, color: t.accent, padding: "3px 9px", borderRadius: 6 }}>Enverge Open Cell — {envOcS.toFixed(2)} sets</span>}
                                  {envCcS > 0     && <span style={{ fontSize: 12, fontWeight: 600, background: t.accentBg, color: t.accent, padding: "3px 9px", borderRadius: 6 }}>Enverge Closed Cell — {envCcS.toFixed(2)} sets</span>}
                                  {freeEnvOcS > 0 && <span style={{ fontSize: 12, fontWeight: 600, background: "#f0fdf4", color: "#16a34a", padding: "3px 9px", borderRadius: 6 }}>FREE Enverge OC — {freeEnvOcS.toFixed(2)} sets</span>}
                                </>;
                              })()}
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
          <RosterView trucks={trucks} jobs={jobs} updates={updates} jobUpdates={jobUpdates} />
        )}

        {view === "tools" && (
          <ToolsView
            isOffice={true}
            tools={tools}
            toolCheckouts={toolCheckouts}
            onAddTool={onAddTool}
            onEditTool={onEditTool}
            onDeleteTool={onDeleteTool}
            onCheckout={onCheckout}
            onReturn={onReturn}
            adminName={adminName}
            crewMembers={members}
            employeeFlags={employeeFlags}
            onSetFlag={onSetFlag}
          />
        )}

        {view === "inventory" && (() => {
          const categories = [...new Set(INVENTORY_ITEMS.map(i => i.category))];
          const getQty = (itemId) => (inventory.find(r => r.itemId === itemId)?.qty || 0);
          const galsToBbl = (g, id) => Math.round(g / (id && ["cc_a","cc_b","env_cc_a","env_cc_b"].includes(id) ? 50 : 48) * 100) / 100;
          const bblToGals = (b, id) => Math.round(b * (id && ["cc_a","cc_b","env_cc_a","env_cc_b"].includes(id) ? 50 : 48));
          const searchLower = invSearch.toLowerCase();
          const sortItems = (arr) => [...arr].sort((a,b) => { const isMP = s => s.unit==='MP'||s.unit==='master packs'; if(isMP(a)!==isMP(b)) return isMP(a)?-1:1; const base = s => s.name.replace(/ *(MP|Tubes).*$/i,'').trim(); return base(a).localeCompare(base(b)); });
          const stockStatus = (qty) => qty === 0 ? "out" : qty <= 2 ? "low" : "ok";
          const stockColors = {
            out: { text: "#ef4444", bar: "#ef4444", label: "OUT", badgeBg: "rgba(239,68,68,0.15)", badgeColor: "#ef4444" },
            low: { text: "#f59e0b", bar: "#f59e0b", label: "LOW", badgeBg: "rgba(245,158,11,0.15)", badgeColor: "#f59e0b" },
            ok:  { text: "#22c55e", bar: "#22c55e", label: null, badgeBg: "rgba(34,197,94,0.15)", badgeColor: "#22c55e" },
          };

          // Compute stats for summary bar
          const allMainItems = INVENTORY_ITEMS.filter(i => !i.isPieces);
          const totalSKUs = allMainItems.length;
          const outItems = allMainItems.filter(i => getQty(i.id) === 0);
          const lowItems = allMainItems.filter(i => { const q = getQty(i.id); return q > 0 && q <= 2; });
          const inStockItems = allMainItems.filter(i => getQty(i.id) > 2);
          const lastUpdatedTs = inventory.reduce((best, r) => r.updatedAt && r.updatedAt > best ? r.updatedAt : best, "");
          const lastUpdatedStr = lastUpdatedTs ? new Date(lastUpdatedTs).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/Chicago" }) : "—";

          // Max qty per unit for stock bar
          const getMax = (item) => {
            if (item.unit === "bags") return 30;
            if (item.unit === "bbl") return 20;
            if (item.unit === "tubes") return 40;
            return 20;
          };


          // Light theme color constants for inventory view
          const lk = {
            bg: "#f8fafc",
            cardBg: "#ffffff",
            cardBorder: "1px solid #e2e8f0",
            cardShadow: "0 1px 4px rgba(0,0,0,0.06)",
            text: "#1e293b",
            textMuted: "#64748b",
            textDim: "#94a3b8",
            accent: "#2563eb",
            accentBg: "rgba(37,99,235,0.08)",
            separator: "#f1f5f9",
            inputBg: "#ffffff",
            inputBorder: "#e2e8f0",
            headerBg: "#ffffff",
            headerBorder: "#e2e8f0",
            rowHover: "#f1f5f9",
          };

          // Apply status filter
          const statusFilterFn = (item) => {
            if (invStatusFilter === "all") return true;
            const qty = getQty(item.id);
            if (invStatusFilter === "out") return qty === 0;
            if (invStatusFilter === "low") return qty > 0 && qty <= 2;
            if (invStatusFilter === "ok") return qty > 2;
            return true;
          };

          // Sort items across all categories for flat sort modes
          const sortAllItems = (arr) => {
            if (invSort === "name") return [...arr].sort((a, b) => a.name.localeCompare(b.name));
            if (invSort === "qty_asc") return [...arr].sort((a, b) => getQty(a.id) - getQty(b.id));
            if (invSort === "qty_desc") return [...arr].sort((a, b) => getQty(b.id) - getQty(a.id));
            return [...arr].sort((a, b) => { const isMP = s => s.unit==='MP'||s.unit==='master packs'; if(isMP(a)!==isMP(b)) return isMP(a)?-1:1; const base = s => s.name.replace(/ *(MP|Tubes).*$/i,'').trim(); return base(a).localeCompare(base(b)); });
          };

          // Compute which categories match search / status filter
          const visibleCats2 = categories.filter(cat => {
            if (invCatFilter && invCatFilter !== cat) return false;
            const items = INVENTORY_ITEMS.filter(i => i.category === cat && !i.isPieces).filter(statusFilterFn);
            return items.length > 0 && (!searchLower || items.some(i => i.name.toLowerCase().includes(searchLower)));
          });

          const StatFilterBtn = ({ id, label, count, color, activeBg, activeBorder }) => {
            const isActive = invStatusFilter === id;
            return (
              <button onClick={() => setInvStatusFilter(isActive ? "all" : id)} style={{
                padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: isActive ? 800 : 600,
                border: "1px solid " + (isActive ? activeBorder : "#e2e8f0"),
                background: isActive ? activeBg : "#ffffff",
                color: isActive ? color : "#64748b",
                cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5,
                boxShadow: isActive ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s",
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
                {label} ({count})
              </button>
            );
          };

          // Simple flat inventory list for foam gun parts & project tools (with category grouping)
          const SimpleInvList = ({ items, invData, onUpdate }) => {
            const getQ = (id) => invData.find(r => r.itemId === id)?.qty || 0;
            const [editing, setEditing] = React.useState(null);
            const [editVal, setEditVal] = React.useState("");
            const dotColor = (q) => q === 0 ? "#ef4444" : q === 1 ? "#f59e0b" : "#22c55e";
            const qtyColor = (q) => q === 0 ? "#ef4444" : q === 1 ? "#f59e0b" : "#22c55e";
            // Group by category if items have category field
            const hasCategories = items.some(i => i.category);
            const groups = hasCategories
              ? items.reduce((acc, item) => {
                  const cat = item.category || "Other";
                  if (!acc[cat]) acc[cat] = [];
                  acc[cat].push(item);
                  return acc;
                }, {})
              : { "": items };
            const renderItem = (item) => {
              const qty = getQ(item.id);
              const isEditing = editing === item.id;
              return (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "#fff", borderRadius: 8, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor(qty), flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 12.5, fontWeight: 500, color: "#1e293b" }}>{item.name}</span>
                  <span style={{ fontSize: 11, color: "#94a3b8", marginRight: 4 }}>{item.unit}</span>
                  {isEditing ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <button onClick={() => { const v = Math.max(0, (parseInt(editVal)||0)-1); setEditVal(String(v)); }} style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", fontSize: 14, fontFamily: "inherit", color: "#1e293b", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                      <input value={editVal} onChange={e => setEditVal(e.target.value)} style={{ width: 40, textAlign: "center", border: "1px solid #2563eb", borderRadius: 6, fontSize: 13, padding: "2px 4px", fontFamily: "inherit", outline: "none" }} />
                      <button onClick={() => { const v = Math.max(0, (parseInt(editVal)||0)+1); setEditVal(String(v)); }} style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", fontSize: 14, fontFamily: "inherit", color: "#1e293b", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                      <button onClick={() => { const v = parseInt(editVal); if (!isNaN(v) && v >= 0) onUpdate(item.id, v); setEditing(null); }} style={{ padding: "2px 8px", borderRadius: 6, border: "none", background: "#2563eb", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>✓</button>
                      <button onClick={() => setEditing(null)} style={{ padding: "2px 6px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: qtyColor(qty), minWidth: 20, textAlign: "right" }}>{qty}</span>
                      <button onClick={() => { setEditing(item.id); setEditVal(String(qty)); }} style={{ padding: "3px 9px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#475569", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Edit</button>
                    </div>
                  )}
                </div>
              );
            };
            return (
              <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
                {Object.entries(groups).map(([cat, catItems]) => (
                  <React.Fragment key={cat}>
                    {cat && (
                      <div style={{ padding: "5px 8px", background: "#f1f5f9", borderRadius: 6, marginTop: 4, marginBottom: 2 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>{cat}</span>
                      </div>
                    )}
                    {catItems.map(renderItem)}
                  </React.Fragment>
                ))}
              </div>
            );
          };

          return (
            <div style={{ display: "flex", flexDirection: "column", height: "calc(100dvh - 168px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))", overflow: "hidden", margin: "0 -20px -20px", padding: 0, background: lk.bg }}>

              {/* ── Inventory sub-tab nav ── */}
              <div style={{ flexShrink: 0, padding: "8px 12px 0", background: lk.headerBg, borderBottom: "1px solid " + lk.headerBorder, display: "flex", gap: 4 }}>
                {[
                  { id: "materials",    label: "Materials" },
                  { id: "foam_parts",   label: "Foam Gun Parts" },
                  { id: "project_tools", label: "Tools & Accessories" },
                ].map(tab => {
                  const active = invTab === tab.id;
                  return (
                    <button key={tab.id} onClick={() => setInvTab(tab.id)} style={{
                      padding: "6px 12px", borderRadius: "8px 8px 0 0", fontSize: 12, fontWeight: active ? 700 : 500,
                      border: "1px solid " + (active ? "#2563eb" : "#e2e8f0"),
                      borderBottom: active ? "1px solid #fff" : "1px solid " + lk.headerBorder,
                      background: active ? "#ffffff" : "transparent",
                      color: active ? "#2563eb" : "#64748b",
                      cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                      marginBottom: active ? -1 : 0,
                      transition: "all 0.15s",
                    }}>{tab.label}</button>
                  );
                })}
              </div>

              {invTab === "foam_parts" && (
                <SimpleInvList items={FOAM_GUN_PARTS} invData={foamPartsInventory || []} onUpdate={onUpdateFoamParts} />
              )}
              {invTab === "project_tools" && (
                <SimpleInvList items={PROJECT_TOOLS_ITEMS} invData={projectToolsInventory || []} onUpdate={onUpdateProjectTools} />
              )}

              {/* ── Materials tab content ── */}
              {invTab === "materials" && <>
              {/* ── Stat filter buttons row ── */}
              <div style={{ flexShrink: 0, padding: "8px 12px", display: "flex", alignItems: "center", gap: 6, borderBottom: "1px solid " + lk.headerBorder, background: lk.headerBg, overflowX: "auto" }}>
                <button onClick={() => setInvStatusFilter("all")} style={{
                  padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: invStatusFilter === "all" ? 800 : 600,
                  border: "1px solid " + (invStatusFilter === "all" ? "#2563eb" : "#e2e8f0"),
                  background: invStatusFilter === "all" ? "#2563eb" : "#ffffff",
                  color: invStatusFilter === "all" ? "#ffffff" : "#64748b",
                  cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                  boxShadow: invStatusFilter === "all" ? "0 1px 3px rgba(37,99,235,0.2)" : "none",
                  transition: "all 0.15s",
                }}>All SKUs ({totalSKUs})</button>
                <StatFilterBtn id="ok" label="In Stock" count={inStockItems.length} color="#16a34a" activeBg="#f0fdf4" activeBorder="#bbf7d0" />
                <StatFilterBtn id="low" label="Low Stock" count={lowItems.length} color="#d97706" activeBg="#fffbeb" activeBorder="#fde68a" />
                <StatFilterBtn id="out" label="Out of Stock" count={outItems.length} color="#dc2626" activeBg="#fef2f2" activeBorder="#fecaca" />
                <div style={{ flex: 1 }} />
                <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                  <span style={{ fontSize: 9, color: "#22c55e", fontWeight: 700, letterSpacing: 0.5 }}>● LIVE</span>
                  <span style={{ fontSize: 10, color: lk.textMuted, fontWeight: 500 }}>Updated {lastUpdatedStr}</span>
                </div>
              </div>



              {/* ── Search bar ── */}
              <div style={{ flexShrink: 0, padding: "6px 12px", background: lk.headerBg, borderBottom: "1px solid " + lk.headerBorder, display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="text"
                  placeholder="Search inventory…"
                  value={invSearch}
                  onChange={e => setInvSearch(e.target.value)}
                  style={{ flex: 1, padding: "5px 10px", border: "1px solid " + lk.inputBorder, borderRadius: 8, fontSize: 12, fontFamily: "inherit", background: lk.inputBg, color: lk.text, outline: "none" }}
                />
                {invSearch && (
                  <button onClick={() => setInvSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: lk.textMuted, fontSize: 16, lineHeight: 1, padding: "2px 4px", fontFamily: "inherit" }}>×</button>
                )}
              </div>

              {/* ── Single-column manufacturer groups ── */}
              {(() => {
                // Map each item to a manufacturer group
                const getManufacturer = (item) => {
                  const cat = item.category || "";
                  if (item.unit === "bbl") return "Foam";
                  if (cat.includes("Certainteed")) return "Certainteed";
                  if (cat.includes("Owens Corning")) return "Owens Corning";
                  if (cat.includes("Johns Manville") || cat.includes("JM")) return "Johns Manville";
                  if (cat.toLowerCase().includes("blown") || cat.toLowerCase().includes("cellulose")) return "Blown";
                  return "Other";
                };

                const MFG_ORDER = ["Certainteed", "Owens Corning", "Johns Manville", "Foam", "Blown", "Other"];

                // Extract R-value from category string for sorting
                const getRVal = (cat) => { const m = cat.match(/R(\d+)/i); return m ? parseInt(m[1]) : 999; };

                // Build groups
                const mfgGroups = MFG_ORDER.map(mfg => {
                  const items = sortAllItems(
                    INVENTORY_ITEMS
                      .filter(i => !i.isPieces && getManufacturer(i) === mfg)
                      .filter(statusFilterFn)
                      .filter(i => !searchLower || i.name.toLowerCase().includes(searchLower) || i.category.toLowerCase().includes(searchLower))
                  ).sort((a, b) => getRVal(a.category) - getRVal(b.category));
                  return { mfg, items };
                }).filter(g => g.items.length > 0);

                const allEmpty = mfgGroups.length === 0;

                const renderItemRow = (item) => {
                  const qty = getQty(item.id);
                  const pcsItem = item.hasPieces ? INVENTORY_ITEMS.find(i => i.parentId === item.id) : null;
                  const pcsQty = pcsItem ? getQty(pcsItem.id) : 0;
                  const status = stockStatus(qty);
                  const sc = stockColors[status];
                  const displayQty = isFoam(item.id) ? qty.toFixed(2) : qty;
                  const subInfo = isFoam(item.id) && qty > 0
                    ? `${bblToGals(qty, item.id)}g`
                    : (item.sqftPerTube && qty > 0 ? `${(item.sqftPerTube * qty).toFixed(0)} sqft` : "");
                  return (
                    <React.Fragment key={item.id}>
                      <div
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderTop: "1px solid " + lk.separator, minHeight: 30, transition: "background 0.1s" }}
                        onMouseEnter={e => e.currentTarget.style.background = lk.rowHover}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      >
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: sc.bar, flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: lk.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={item.name}>{item.name}</span>
                        {subInfo ? <span style={{ fontSize: 9, color: lk.textMuted, flexShrink: 0, whiteSpace: "nowrap" }}>{subInfo}</span> : null}
                        {pcsItem && pcsQty > 0 ? <span style={{ fontSize: 9.5, fontWeight: 700, color: "#6366f1", background: "#ede9fe", borderRadius: 5, padding: "1px 4px", flexShrink: 0 }}>{pcsQty}pc</span> : null}
                        <span style={{ fontSize: 12, fontWeight: 700, color: sc.text, minWidth: 26, textAlign: "right", flexShrink: 0, whiteSpace: "nowrap" }}>
                          {displayQty} <span style={{ fontSize: 9, fontWeight: 500, color: lk.textMuted }}>{item.unit}</span>
                        </span>
                        <div style={{ flexShrink: 0 }}>
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
                        </div>
                      </div>
                      {pcsItem && pcsQty > 0 && (
                        <div style={{ padding: "2px 10px 2px 23px", background: "#f8fafc", borderTop: "1px solid " + lk.separator }}>
                          <span style={{ fontSize: 10, color: "#6366f1", fontWeight: 600 }}>{pcsQty} loose pcs</span>
                        </div>
                      )}
                    </React.Fragment>
                  );
                };

                return (
                  <div style={{ flex: 1, overflow: "auto", padding: "8px 10px" }}>
                    {allEmpty ? (
                      <div style={{ textAlign: "center", padding: "48px 16px", color: lk.textMuted, fontSize: 13 }}>No items match your current filters</div>
                    ) : mfgGroups.map(({ mfg, items }) => {
                      const outCount = items.filter(i => getQty(i.id) === 0).length;
                      const lowCount = items.filter(i => { const q = getQty(i.id); return q > 0 && q <= 2; }).length;
                      return (
                        <div key={mfg} style={{ marginBottom: 8 }}>
                          {/* Manufacturer header */}
                          <div style={{ padding: "5px 10px", background: "#e8edf5", borderRadius: "6px 6px 0 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 11, fontWeight: 800, color: "#334155", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                              {mfg} <span style={{ fontWeight: 500, fontSize: 10, color: "#64748b", textTransform: "none", letterSpacing: 0 }}>({items.length})</span>
                            </span>
                            <span style={{ display: "flex", gap: 4 }}>
                              {outCount > 0 && <span style={{ fontSize: 9, fontWeight: 700, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 99, padding: "1px 5px" }}>{outCount} OUT</span>}
                              {lowCount > 0 && <span style={{ fontSize: 9, fontWeight: 700, background: "#fffbeb", color: "#d97706", border: "1px solid #fde68a", borderRadius: 99, padding: "1px 5px" }}>{lowCount} LOW</span>}
                            </span>
                          </div>
                          <div style={{ border: "1px solid #e2e8f0", borderTop: "none", borderRadius: "0 0 6px 6px", overflow: "hidden", background: lk.cardBg }}>
                            {items.map(item => renderItemRow(item))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* ─── Truck Reconciliation ─── */}
              <div style={{ flexShrink: 0, borderTop: "1px solid #e2e8f0", background: "#fff" }}>
                <button
                  onClick={() => setShowReconcile(r => !r)}
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "12px 16px", borderBottom: showReconcile ? "1px solid #e2e8f0" : "none" }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>🚛 Today's Truck Reconciliation</span>
                  <span style={{ fontSize: 12, color: "#94a3b8", marginLeft: "auto" }}>{showReconcile ? "▲ Hide" : "▼ Show"}</span>
                </button>
                {showReconcile && (
                  <div style={{ padding: "12px 16px", maxHeight: 320, overflowY: "auto" }}>
                    <TruckReconcileView trucks={trucks} loadLog={loadLog} returnLog={returnLog} jobs={jobs} updates={updates} truckInventory={truckInventory} />
                  </div>
                )}
              </div>
              </>}
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
        <Modal title="Add Job" onClose={() => setShowAddJob(false)} footer={<Button onClick={handleAddJob} disabled={!jobForm.address.trim()} style={{ width: "100%" }}>Add Job to Schedule</Button>}>
          <div className="compact-form">
          <Input label="Builder / Customer" placeholder="e.g. Smith Residence, ABC Builders" value={jobForm.builder} onChange={(e) => setJobForm({ ...jobForm, builder: e.target.value })} inputMode="text" autoComplete="off" />
          <Input label="Job Address" placeholder="e.g. 1234 E 91st St, Tulsa" value={jobForm.address} onChange={(e) => setJobForm({ ...jobForm, address: e.target.value })} inputMode="text" autoComplete="street-address" />
          <Select label="Job Type" value={jobForm.type} onChange={(e) => setJobForm({ ...jobForm, type: e.target.value })} options={(scheduleView === "energySeal" ? ES_JOB_TYPES : JOB_TYPES.filter(t => t !== "Energy Seal")).map((jt) => ({ value: jt, label: jt }))} />
          <Select label="Truck (logistics only — does not set crew)" value={jobForm.truckId} onChange={(e) => setJobForm({ ...jobForm, truckId: e.target.value })} options={[{ value: "", label: "— No Truck Assigned —" }, ...sortedTrucks.map((tr) => ({ value: tr.id, label: tr.members || tr.name }))]} />
          {/* Employee tap-to-toggle — source of truth for timesheet */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: t.textSecondary, marginBottom: "8px" }}>Assign Crew <span style={{ fontWeight: 400, color: t.textMuted }}>(timesheet source of truth)</span></label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {members.map(m => {
                const selected = (jobForm.crewMemberIds || []).includes(m.id);
                const firstName = m.name.split(" ")[0];
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      if (selected) setJobForm({ ...jobForm, crewMemberIds: jobForm.crewMemberIds.filter(i => i !== m.id) });
                      else setJobForm({ ...jobForm, crewMemberIds: [...(jobForm.crewMemberIds || []), m.id] });
                    }}
                    style={{
                      padding: "8px 14px", borderRadius: 99, fontSize: 13, fontWeight: 600,
                      background: selected ? "#2563eb" : "#f1f5f9",
                      color: selected ? "#ffffff" : "#64748b",
                      border: selected ? "1px solid #2563eb" : "1px dashed #cbd5e1",
                      cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                    }}
                  >
                    {selected ? `✓ ${firstName}` : firstName}
                  </button>
                );
              })}
            </div>
          </div>
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
          </div>
        </Modal>
      )}

      {/* ── TRUCK UNLOAD HISTORY MODAL ── */}
      {truckDetailView && (
        <TruckDetailModal
          truck={truckDetailView}
          truckInventory={truckInventory[truckDetailView.id] || {}}
          loadLog={loadLog}
          returnLog={returnLog}
          jobs={jobs}
          members={members}
          onClose={() => setTruckDetailView(null)}
          onUpdateTruck={onUpdateTruck}
          onAdminSetLoadout={onAdminSetLoadout}
          onAdminUnload={onAdminUnload}
          onOpenCalendar={() => { setTruckHistoryView({ truck: truckDetailView, calMonth: new Date().getMonth(), calYear: new Date().getFullYear(), selectedDate: null }); setTruckDetailView(null); }}
        />
      )}

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
        <Modal title={scheduleView === "energySeal" ? "Add Energy Seal Technician" : "Add Crew"} onClose={() => setShowAddTruck(false)}>
          <Input label={scheduleView === "energySeal" ? "Technician Name" : "Crew Name"} placeholder={scheduleView === "energySeal" ? "e.g. Mike Rodriguez" : "e.g. Alex & Juan, Harold Sr. & Jr."} value={truckForm.name} onChange={(e) => setTruckForm({ ...truckForm, name: e.target.value })} />
          <Input label="Notes (optional)" placeholder={scheduleView === "energySeal" ? "e.g. Lead tech, specializes in blower door" : "e.g. Fiberglass crew, Foam rig, etc."} value={truckForm.members} onChange={(e) => setTruckForm({ ...truckForm, members: e.target.value })} />
          <Button onClick={() => { const maxOrder = trucks.reduce((m, tr) => Math.max(m, tr.order ?? 0), 0); onAddTruck({ ...truckForm, order: maxOrder + 1, department: scheduleView === "energySeal" ? "energySeal" : "insulation" }); onLogAction("Added " + (scheduleView === "energySeal" ? "ES tech" : "crew") + ": " + truckForm.name); setTruckForm({ name: "", members: "" }); setShowAddTruck(false); }} disabled={!truckForm.name.trim()} style={{ width: "100%" }}>{scheduleView === "energySeal" ? "Add Technician" : "Add Crew"}</Button>
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
        <Modal title="Edit Job" onClose={() => setEditingJob(null)} footer={<div style={{ display: "flex", gap: "10px" }}><Button variant="secondary" onClick={() => setEditingJob(null)} style={{ flex: 1 }}>Cancel</Button><Button onClick={handleSaveEdit} disabled={!editForm.address.trim()} style={{ flex: 1 }}>Save Changes</Button></div>}>
          <Input label="Builder / Customer" value={editForm.builder} onChange={(e) => setEditForm({ ...editForm, builder: e.target.value })} />
          <Input label="Job Address" value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
          <Select label="Job Type" value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })} options={JOB_TYPES.map((jt) => ({ value: jt, label: jt }))} />
          <Select label="Truck (logistics only — does not set crew)" value={editForm.truckId} onChange={(e) => setEditForm({ ...editForm, truckId: e.target.value })} options={[{ value: "", label: "— No Truck Assigned —" }, ...sortedTrucks.map((tr) => ({ value: tr.id, label: tr.members || tr.name }))]} />
          {/* Employee tap-to-toggle for edit form */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: t.textSecondary, marginBottom: "8px" }}>
              Assign Crew <span style={{ fontWeight: 400, color: t.textMuted }}>(timesheet source of truth)</span>
              {(() => { const latUpd = updates.filter(u => u.jobId === editingJob?.id).sort((a,b) => new Date(b.timestamp)-new Date(a.timestamp))[0]; return latUpd?.status === "in_progress" ? <span style={{ marginLeft: 8, color: "#b45309", background: "#fef3c7", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10, border: "1px solid #fde68a" }}>In Progress — changes will be logged</span> : null; })()}
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {members.map(m => {
                const selected = (editForm.crewMemberIds || []).includes(m.id);
                const firstName = m.name.split(" ")[0];
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      if (selected) setEditForm({ ...editForm, crewMemberIds: editForm.crewMemberIds.filter(i => i !== m.id) });
                      else setEditForm({ ...editForm, crewMemberIds: [...(editForm.crewMemberIds || []), m.id] });
                    }}
                    style={{
                      padding: "8px 14px", borderRadius: 99, fontSize: 13, fontWeight: 600,
                      background: selected ? "#2563eb" : "#f1f5f9",
                      color: selected ? "#ffffff" : "#64748b",
                      border: selected ? "1px solid #2563eb" : "1px dashed #cbd5e1",
                      cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                    }}
                  >
                    {selected ? `✓ ${firstName}` : firstName}
                  </button>
                );
              })}
            </div>
          </div>
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
        </Modal>
      )}

      {pmJob && (
        <Modal title="Job Check-Off" onClose={() => { setPmJob(null); setPmNote(""); setPmCheckedAM("No"); setPmCheckedPM("No"); setPmLocation(null); setPmLocationStatus("idle"); }}>
          {/* Job name + address — big and clear */}
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: t.text, lineHeight: 1.2 }}>{pmJob.builder || "No Customer"}</div>
            <div style={{ fontSize: 14, color: t.textMuted, marginTop: 4 }}>{pmJob.address}</div>
            {pmJob.type && <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>{pmJob.type}</div>}
          </div>

          {/* AM Check YES/NO */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 8, textAlign: "center" }}>AM Check ✓</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setPmCheckedAM("Yes")}
                style={{ flex: 1, minHeight: 52, fontSize: 16, fontWeight: 800, borderRadius: 10, border: "3px solid " + (pmCheckedAM === "Yes" ? "#16a34a" : "#d1d5db"), background: pmCheckedAM === "Yes" ? "#16a34a" : "#f9fafb", color: pmCheckedAM === "Yes" ? "#fff" : "#374151", cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}
              >YES</button>
              <button
                onClick={() => setPmCheckedAM("No")}
                style={{ flex: 1, minHeight: 52, fontSize: 16, fontWeight: 800, borderRadius: 10, border: "3px solid " + (pmCheckedAM === "No" ? "#dc2626" : "#d1d5db"), background: pmCheckedAM === "No" ? "#dc2626" : "#f9fafb", color: pmCheckedAM === "No" ? "#fff" : "#374151", cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}
              >NO</button>
            </div>
          </div>

          {/* PM Check YES/NO */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 8, textAlign: "center" }}>PM Check ✓</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setPmCheckedPM("Yes")}
                style={{ flex: 1, minHeight: 52, fontSize: 16, fontWeight: 800, borderRadius: 10, border: "3px solid " + (pmCheckedPM === "Yes" ? "#16a34a" : "#d1d5db"), background: pmCheckedPM === "Yes" ? "#16a34a" : "#f9fafb", color: pmCheckedPM === "Yes" ? "#fff" : "#374151", cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}
              >YES</button>
              <button
                onClick={() => setPmCheckedPM("No")}
                style={{ flex: 1, minHeight: 52, fontSize: 16, fontWeight: 800, borderRadius: 10, border: "3px solid " + (pmCheckedPM === "No" ? "#dc2626" : "#d1d5db"), background: pmCheckedPM === "No" ? "#dc2626" : "#f9fafb", color: pmCheckedPM === "No" ? "#fff" : "#374151", cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}
              >NO</button>
            </div>
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 18 }}>
            <textarea
              placeholder="Any notes..."
              value={pmNote}
              onChange={(e) => setPmNote(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", minHeight: 72, fontSize: 14, padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontFamily: "inherit", resize: "vertical", outline: "none" }}
            />
          </div>

          {/* Geo status */}
          <div style={{ marginBottom: 14, borderRadius: 8, padding: "10px 14px", textAlign: "center", fontSize: 13, fontWeight: 600,
            background: pmLocationStatus === "granted" ? "#f0fdf4" : pmLocationStatus === "denied" ? "#fef2f2" : "#fffbeb",
            color: pmLocationStatus === "granted" ? "#15803d" : pmLocationStatus === "denied" ? "#dc2626" : "#92400e",
            border: "1px solid " + (pmLocationStatus === "granted" ? "#bbf7d0" : pmLocationStatus === "denied" ? "#fecaca" : "#fde68a")
          }}>
            {pmLocationStatus === "loading" && "📍 Getting your location…"}
            {pmLocationStatus === "granted" && `📍 Location captured (±${pmLocation?.accuracy}m)`}
            {pmLocationStatus === "denied" && (
              <span>🚫 Location access denied — enable location to submit
                <button onClick={() => { setPmLocationStatus("loading"); navigator.geolocation && navigator.geolocation.getCurrentPosition((pos) => { setPmLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) }); setPmLocationStatus("granted"); }, () => setPmLocationStatus("denied"), { timeout: 15000, maximumAge: 0, enableHighAccuracy: true }); }} style={{ marginLeft: 10, fontSize: 12, padding: "3px 8px", borderRadius: 6, border: "1px solid #dc2626", background: "#fff", color: "#dc2626", cursor: "pointer", fontFamily: "inherit" }}>Retry</button>
              </span>
            )}
            {pmLocationStatus === "idle" && "📍 Requesting location…"}
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => { setPmJob(null); setPmNote(""); setPmCheckedAM("No"); setPmCheckedPM("No"); setPmLocation(null); setPmLocationStatus("idle"); }} style={{ flex: 1, minHeight: 48, fontSize: 15, fontWeight: 600, borderRadius: 10, border: "2px solid #d1d5db", background: "#f9fafb", color: "#374151", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
            <button onClick={handlePmSubmit} disabled={pmLocationStatus !== "granted"} style={{ flex: 2, minHeight: 48, fontSize: 16, fontWeight: 800, borderRadius: 10, border: "none", background: pmLocationStatus === "granted" ? "#16a34a" : "#9ca3af", color: "#fff", cursor: pmLocationStatus === "granted" ? "pointer" : "not-allowed", fontFamily: "inherit", letterSpacing: 0.3 }}>💾 Save Check</button>
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
                {calViewJob.checkedAt && (
                  <div style={{ fontSize: "12px", color: t.textMuted, marginTop: "4px" }}>
                    Checked from:{" "}
                    {calViewJob.checkedLat && calViewJob.checkedLng
                      ? <a href={`https://www.google.com/maps?q=${calViewJob.checkedLat},${calViewJob.checkedLng}`} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb", textDecoration: "underline" }}>View on Map</a>
                      : <span style={{ color: t.textMuted }}>Location not recorded</span>
                    }
                  </div>
                )}
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

            {/* Crew Change Log — shows crew_added/crew_removed events */}
            {(() => {
              const crewChangeLog = (jobUpdates || []).filter(u => u.jobId === calViewJob.id && (u.type === "crew_added" || u.type === "crew_removed")).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
              if (crewChangeLog.length === 0) return null;
              return (
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#b45309", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px", paddingBottom: "6px", borderBottom: "1px solid " + t.borderLight }}>Crew Change Log</div>
                  {crewChangeLog.map((u, idx) => {
                    const memberId = u.addedMemberId || u.removedMemberId;
                    const memberName = members.find(m => m.id === memberId)?.name || memberId;
                    const isAdd = u.type === "crew_added";
                    return (
                      <div key={idx} style={{ fontSize: "12px", padding: "5px 0", borderBottom: "1px solid " + t.borderLight, display: "flex", gap: "8px", alignItems: "center" }}>
                        <span style={{ color: t.textMuted, fontSize: "11px" }}>{u.date}</span>
                        <span style={{ fontSize: "14px" }}>{isAdd ? "➕" : "➖"}</span>
                        <span style={{ fontWeight: 600, color: isAdd ? "#15803d" : "#dc2626" }}>{memberName}</span>
                        <span style={{ fontSize: "11px", color: t.textMuted }}>{isAdd ? "added to job" : "removed from job"}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {((calViewJob.dailyMaterialLogs || []).length > 0 || Object.keys(calViewJob.materialsUsed || {}).length > 0) && (
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "12px", fontWeight: 600, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px", paddingBottom: "6px", borderBottom: "1px solid " + t.borderLight }}>Materials Logged</div>
                {Object.keys(calViewJob.materialsUsed || {}).length > 0 && (calViewJob.dailyMaterialLogs || []).length === 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 6 }}>Logged at closeout</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {Object.entries(calViewJob.materialsUsed || {}).map(([itemId, qty]) => {
                        const item = INVENTORY_ITEMS.find(i => i.id === itemId);
                        if (!item) return null;
                        const isFoamId = ["oc_a","oc_b","cc_a","cc_b","env_oc_a","env_oc_b","env_cc_a","env_cc_b","free_env_oc_a","free_env_oc_b"].includes(itemId);
                        const display = isFoamId ? Math.round(qty * (["cc_a","cc_b","env_cc_a","env_cc_b"].includes(itemId) ? 50 : 48)) + " gal" : qty + " " + item.unit;
                        return <span key={itemId} style={{ fontSize: 12, background: t.accentBg, color: t.accent, padding: "3px 9px", borderRadius: 6, fontWeight: 600 }}>{item.name}: {display}</span>;
                      })}
                    </div>
                  </div>
                )}
                {(calViewJob.dailyMaterialLogs || []).map((log, idx) => {
                  const isFoamId = id => ["oc_a","oc_b","cc_a","cc_b","env_oc_a","env_oc_b","env_cc_a","env_cc_b","free_env_oc_a","free_env_oc_b"].includes(id);
                  const bblToGal = (qty, id) => Math.round(qty * (["cc_a","cc_b","env_cc_a","env_cc_b"].includes(id) ? 50 : 48));
                  const isEditing = editMatLogIdx === idx;
                  return (
                    <div key={idx} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: idx < calViewJob.dailyMaterialLogs.length - 1 ? "1px solid " + t.borderLight : "none" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>{log.date} — <span style={{ fontWeight: 400, color: t.textMuted }}>{log.loggedBy}</span></div>
                        <button onClick={() => { if (isEditing) { setEditMatLogIdx(null); setEditMatLogQtys({}); } else { const init = {}; Object.entries(log.materials||{}).forEach(([id,qty]) => { init[id] = isFoamId(id) ? String(bblToGal(qty,id)) : String(qty); }); setEditMatLogQtys(init); setEditMatLogIdx(idx); } }} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, border: "1px solid " + t.border, background: isEditing ? "#fef2f2" : t.surface, color: isEditing ? "#dc2626" : t.textMuted, cursor: "pointer", fontFamily: "inherit" }}>{isEditing ? "Cancel" : "Edit"}</button>
                      </div>
                      {isEditing ? (
                        <div>
                          {INVENTORY_ITEMS.filter(i => !i.isPieces && (editMatLogQtys[i.id] !== undefined || (log.materials||{})[i.id])).map(item => (
                            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                              <label style={{ fontSize: 12, flex: 1, color: t.text }}>{item.name}</label>
                              <input type="number" min="0" value={editMatLogQtys[item.id] || ""} onChange={e => setEditMatLogQtys(q => ({...q, [item.id]: e.target.value}))} placeholder={isFoamId(item.id) ? "gal" : item.unit} style={{ width: 80, padding: "5px 8px", borderRadius: 6, border: "1px solid " + t.border, fontSize: 12, fontFamily: "inherit" }} />
                              <span style={{ fontSize: 11, color: t.textMuted, width: 30 }}>{isFoamId(item.id) ? "gal" : item.unit}</span>
                            </div>
                          ))}
                          <Button onClick={async () => {
                            const newMats = {};
                            Object.entries(editMatLogQtys).forEach(([id, raw]) => {
                              const qty = parseFloat(raw);
                              if (!isNaN(qty) && qty > 0) {
                                newMats[id] = isFoamId(id) ? Math.round(qty / (["cc_a","cc_b","env_cc_a","env_cc_b"].includes(id) ? 50 : 48) * 10000) / 10000 : qty;
                              }
                            });
                            const newLogs = (calViewJob.dailyMaterialLogs || []).map((l, i) => i === idx ? {...l, materials: newMats} : l);
                            await onEditJob(calViewJob.id, { ...calViewJob, dailyMaterialLogs: newLogs });
                            setEditMatLogIdx(null); setEditMatLogQtys({});
                          }} style={{ marginTop: 6, width: "100%" }}>Save Changes</Button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                          {Object.entries(log.materials || {}).map(([itemId, qty]) => {
                            const item = INVENTORY_ITEMS.find(i => i.id === itemId);
                            if (!item) return null;
                            const display = isFoamId(itemId) ? bblToGal(qty, itemId) + " gal" : qty + " " + item.unit;
                            return <span key={itemId} style={{ fontSize: 12, background: t.accentBg, color: t.accent, padding: "3px 9px", borderRadius: 6, fontWeight: 600 }}>{item.name}: {display}</span>;
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* 📷 Photos Section */}
            <JobPhotosSection job={calViewJob} canDelete={["Johnny","Jordan","Skip","Duck","Carolyn"].includes(adminName)} uploaderName={adminName} />

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, display: "block", marginBottom: 4 }}>Move Job Date</label>
              <input type="date" defaultValue={calViewJob.date} onChange={async (e) => { if (e.target.value) { await onEditJob(calViewJob.id, { ...calViewJob, date: e.target.value }); setCalViewJob(null); }}} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid " + t.border, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <Button variant="secondary" onClick={() => setCalViewJob(null)} style={{ flex: 1, minWidth: "80px" }}>Close</Button>
              <Button onClick={() => { setPmJob(calViewJob); setPmCheckedAM(calViewJob.jobCheckedAM || "No"); setPmCheckedPM(calViewJob.jobCheckedPM || "No"); setCalViewJob(null); }} style={{ flex: 1, minWidth: "80px" }}>PM Note</Button>
              <Button onClick={() => { openEditJob(calViewJob); setCalViewJob(null); }} style={{ flex: 1, minWidth: "80px" }}>Edit</Button>
              <Button variant="secondary" onClick={async () => { await onEditJob(calViewJob.id, { ...calViewJob, onHold: true }); setCalViewJob(null); }} style={{ flex: 1, minWidth: "80px" }}>Hold</Button>
              <Button variant="danger" onClick={async () => { if (confirm("Delete this job?")) { await onDeleteJob(calViewJob.id); setCalViewJob(null); }}} style={{ flex: 1, minWidth: "80px" }}>Delete</Button>
            </div>
            {latestStatus === "completed" && (
              <Button
                variant="secondary"
                onClick={() => generateJobPDF(calViewJob, updates, pmUpdates, members)}
                style={{ width: "100%", marginTop: "10px", borderColor: "#15803d", color: "#15803d" }}
              >📄 Generate Completion Report (PDF)</Button>
            )}
          </Modal>
        );
      })()}

      {/* ─── PM Check Toast ─── */}
      {pmCheckToast && (
        <div style={{ position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)", background: "#16a34a", color: "#fff", padding: "14px 28px", borderRadius: 12, fontSize: 18, fontWeight: 800, zIndex: 9999, boxShadow: "0 4px 24px rgba(0,0,0,0.25)", pointerEvents: "none", fontFamily: "inherit", whiteSpace: "nowrap" }}>
          {pmCheckToast}
        </div>
      )}
    </div>
  );
}
// ════════════════════════════════════════════════════════
// ─── QUOTE / TAKEOFF MODULE ──────────────────────────
// ════════════════════════════════════════════════════════

const Q_COMPANY = { name: "Insulation Services of Tulsa", tagline: "Serving Northeastern Oklahoma", phone: "1 (918) 232-9055" };
const Q_SALESMAN_INFO = {
  "Johnny": { fullName: "Johnny Casper", phone: "918-550-2396", email: "Johnny@istulsa.com" },
  "Jordan": { fullName: "Jordan Beard", phone: "918-625-7820", email: "Jordan@istulsa.com" },
  "Skip":   { fullName: "Skip Owen",    phone: "918-219-7890", email: "Skip@istulsa.com" },
};
const Q_LOCATIONS = [
  { id: "band_joist",       label: "Band Joist Blocking",            short: "Band Joist",       type: "area",    group: "Porch / Blocking" },
  { id: "ext_walls_house",  label: "Boxed Exterior Walls of House",  short: "Ext Walls House",  type: "wall",    group: "Walls" },
  { id: "ext_walls_garage", label: "Boxed Exterior Walls of Garage", short: "Ext Walls Garage", type: "wall",    group: "Walls" },
  { id: "garage_common",    label: "Garage Common Wall",             short: "Garage Common",    type: "wall",    group: "Walls" },
  { id: "open_attic_walls", label: "Open Attic Walls",               short: "Attic Walls",      type: "wall",    group: "Walls" },
  { id: "ext_slopes",       label: "Boxed Exterior Slopes",          short: "Ext Slopes",       type: "slope",   group: "Attic" },
  { id: "ext_kneewall",     label: "Boxed Exterior Kneewall",        short: "Ext Kneewall",     type: "wall",    group: "Attic" },
  { id: "attic_slopes",     label: "Open Attic Slopes",              short: "Attic Slopes",     type: "area",    group: "Attic" },
  { id: "attic_kneewall",   label: "Open Attic Kneewall",            short: "Attic Kneewall",   type: "wall",    group: "Attic" },
  { id: "flat_ceiling",     label: "Flat Ceiling",                   short: "Flat Ceiling",     type: "area",    group: "Attic" },
  { id: "attic_area_house", label: "Open Attic Area of House",       short: "Attic House",      type: "area",    group: "Attic" },
  { id: "attic_area_garage",label: "Open Attic Area of Garage",      short: "Attic Garage",     type: "area",    group: "Attic" },
  { id: "gable_end",        label: "Gable End",                      short: "Gable End",        type: "area",    group: "Roofline" },
  { id: "porch",            label: "Porch",                          short: "Porch",            type: "area",    group: "Porch / Blocking" },
  { id: "porch_blocking",   label: "Porch Blocking",                 short: "Porch Blocking",   type: "area",    group: "Porch / Blocking" },
  { id: "roofline",         label: "Roofline",                       short: "Roofline",         type: "roofline",group: "Roofline" },
  { id: "roofline_garage",  label: "Roofline of Garage",             short: "Roofline Garage",  type: "roofline",group: "Roofline" },
  { id: "roofline_house",   label: "Roofline of House",              short: "Roofline House",   type: "roofline",group: "Roofline" },
  { id: "custom",           label: "Custom",                         short: "Custom",           type: "area",    group: "Other" },
];
const Q_PITCH_FACTORS = { "Flat (0/12)":1.0,"1/12":1.003,"2/12":1.014,"3/12":1.031,"4/12":1.054,"5/12":1.083,"6/12":1.118,"7/12":1.158,"8/12":1.202,"9/12":1.25,"10/12":1.302,"11/12":1.357,"12/12":1.414 };
const Q_WALL_HEIGHTS = [
  { label: "8' walls (10.00 sq ft each)",  sqftPer: 10    },
  { label: "9' walls (11.25 sq ft each)",  sqftPer: 11.25 },
  { label: "10' walls (12.50 sq ft each)", sqftPer: 12.5  },
  { label: "11' walls (13.75 sq ft each)", sqftPer: 13.75 },
  { label: "12' walls (15.00 sq ft each)", sqftPer: 15    },
];
const Q_GROUP_ORDER = ["Walls","Attic","Porch / Blocking","Roofline","Other"];
const Q_STATUS_CONFIG = {
  draft:   { label: "Draft",   color: "#6b7280", bg: "#f3f4f6" },
  quoted:  { label: "Quoted",  color: "#1a56db", bg: "#eef2ff" },
  pending: { label: "Pending", color: "#b45309", bg: "#fef3c7" },
  sold:    { label: "Sold",    color: "#15803d", bg: "#dcfce7" },
  lost:    { label: "Lost",    color: "#b91c1c", bg: "#fee2e2" },
};

// ── Quote PDF helpers ──────────────────────────────────
function qSharePdfBlob(blob, filename) {
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], filename, { type: "application/pdf" })] })) {
    navigator.share({ files: [new File([blob], filename, { type: "application/pdf" })], title: filename }).catch(err => { if (err.name !== "AbortError") alert("Share failed: " + err.message); });
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}


// ── Real QuoteView from ist-quote-builder (verbatim port) ──────────


var COMPANY = {
  name: "Insulation Services of Tulsa",
  tagline: "Serving Northeastern Oklahoma",
  phone: "1 (918) 232-9055",
};

var SALESMAN_INFO = {
  "Johnny": { fullName: "Johnny Casper", phone: "918-550-2396", email: "Johnny@istulsa.com" },
  "Jordan": { fullName: "Jordan Beard", phone: "918-625-7820", email: "Jordan@istulsa.com" },
  "Skip": { fullName: "Skip Owen", phone: "918-219-7890", email: "Skip@istulsa.com" },
};

var LOCATIONS = [
  { id: "band_joist",       label: "Band Joist Blocking",           short: "Band Joist",        type: "area",    group: "Porch / Blocking" },
  { id: "ext_walls_house",  label: "Boxed Exterior Walls of House", short: "Ext Walls House",   type: "wall",    group: "Walls" },
  { id: "ext_walls_garage", label: "Boxed Exterior Walls of Garage",short: "Ext Walls Garage",  type: "wall",    group: "Walls" },
  { id: "garage_common",    label: "Garage Common Wall",            short: "Garage Common",     type: "wall",    group: "Walls" },
  { id: "open_attic_walls", label: "Open Attic Walls",              short: "Attic Walls",       type: "wall",    group: "Walls" },
  { id: "ext_slopes",       label: "Boxed Exterior Slopes",         short: "Ext Slopes",        type: "slope",   group: "Attic" },
  { id: "ext_kneewall",     label: "Boxed Exterior Kneewall",       short: "Ext Kneewall",      type: "wall",    group: "Attic" },
  { id: "attic_slopes",     label: "Open Attic Slopes",             short: "Attic Slopes",      type: "area",    group: "Attic" },
  { id: "attic_kneewall",   label: "Open Attic Kneewall",           short: "Attic Kneewall",    type: "wall",    group: "Attic" },
  { id: "flat_ceiling",     label: "Flat Ceiling",                  short: "Flat Ceiling",      type: "area",    group: "Attic" },
  { id: "attic_area_house", label: "Open Attic Area of House",      short: "Attic House",       type: "area",    group: "Attic" },
  { id: "attic_area_garage",label: "Open Attic Area of Garage",     short: "Attic Garage",      type: "area",    group: "Attic" },
  { id: "gable_end",        label: "Gable End",                     short: "Gable End",         type: "area",    group: "Roofline" },
  { id: "porch",            label: "Porch",                         short: "Porch",             type: "area",    group: "Porch / Blocking" },
  { id: "porch_blocking",   label: "Porch Blocking",                short: "Porch Blocking",    type: "area",    group: "Porch / Blocking" },
  { id: "roofline",         label: "Roofline",                      short: "Roofline",          type: "roofline",group: "Roofline" },
  { id: "roofline_garage",  label: "Roofline of Garage",            short: "Roofline Garage",   type: "roofline",group: "Roofline" },
  { id: "roofline_house",   label: "Roofline of House",             short: "Roofline House",    type: "roofline",group: "Roofline" },
  { id: "custom",           label: "Custom",                        short: "Custom",            type: "area",    group: "Other" },
];

var FIBERGLASS_MATERIALS = [
  "Blown Fiberglass", "R11 Fiberglass Batts", "R13 Fiberglass Batts", "R15 Fiberglass Batts",
  "R19 Fiberglass Batts", "R22 Blown Fiberglass", "R26 Blown Fiberglass", "R30 Fiberglass Batts", "R38 Fiberglass Batts",
  "Blown Cellulose", "Blown Rockwool", "Rockwool", '6" Rockwool', "Lambswool",
];

var OPEN_CELL_MATERIALS = [];
[0.5,1,1.5,2,2.5,3,3.5,4,4.5,5,5.5,6].forEach(function(n){ OPEN_CELL_MATERIALS.push(n+'" Open Cell Foam'); });

var CLOSED_CELL_MATERIALS = [];
[0.5,1,1.5,2,2.5,3,3.5,4,4.5,5,5.5,6].forEach(function(n){ CLOSED_CELL_MATERIALS.push(n+'" Closed Cell Foam'); });

var ALL_MATERIALS = FIBERGLASS_MATERIALS.concat(OPEN_CELL_MATERIALS).concat(CLOSED_CELL_MATERIALS);

var PITCH_FACTORS = {"Flat (0/12)":1.0,"1/12":1.003,"2/12":1.014,"3/12":1.031,"4/12":1.054,"5/12":1.083,"6/12":1.118,"7/12":1.158,"8/12":1.202,"9/12":1.25,"10/12":1.302,"11/12":1.357,"12/12":1.414};

var WALL_HEIGHTS = [
  {label:"8' walls (10.00 sq ft each)",sqftPer:10},{label:"9' walls (11.25 sq ft each)",sqftPer:11.25},
  {label:"10' walls (12.50 sq ft each)",sqftPer:12.5},{label:"11' walls (13.75 sq ft each)",sqftPer:13.75},
  {label:"12' walls (15.00 sq ft each)",sqftPer:15},
];

var GROUP_ORDER = ["Walls","Attic","Porch / Blocking","Roofline","Other"];

var C = {
  bg:"linear-gradient(135deg, #e8eef8 0%, #dde6f5 40%, #cdd9f0 100%)",
  bgSolid:"#e8eef8",
  card:"rgba(255,255,255,0.65)",
  cardHover:"rgba(255,255,255,0.8)",
  glass:"rgba(255,255,255,0.6)",
  glassBorder:"rgba(255,255,255,0.8)",
  glassStrong:"rgba(255,255,255,0.75)",
  accent:"#2563eb",
  accentHover:"#1d4ed8",
  accentBg:"rgba(37,99,235,0.08)",
  accentGlow:"0 0 20px rgba(37,99,235,0.2)",
  text:"#0f172a",
  textSec:"#475569",
  dim:"#94a3b8",
  border:"rgba(0,0,0,0.08)",
  borderLight:"rgba(0,0,0,0.04)",
  input:"rgba(255,255,255,0.7)",
  inputBorder:"rgba(0,0,0,0.12)",
  danger:"#dc2626",
  dangerBg:"rgba(220,38,38,0.06)",
  green:"#16a34a",
  blue:"#2563eb",
  shadow:"0 4px 24px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9)",
  shadowMd:"0 8px 32px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.9)",
};

/* ──────── STORAGE HELPERS (Firebase) ──────── */

async function saveJob(savedBy, jobName, jobData) {
  try {
    const q = query(collection(db, "takeoffJobs"), where("job_name","==",jobName), where("saved_by","==",savedBy));
    const snap = await getDocs(q);
    if (!snap.empty) {
      await updateDoc(snap.docs[0].ref, { job_data: jobData, updated_at: new Date().toISOString() });
    } else {
      await addDoc(collection(db, "takeoffJobs"), { job_name: jobName, saved_by: savedBy, job_data: jobData, updated_at: new Date().toISOString(), created_at: new Date().toISOString() });
    }
    return { error: null };
  } catch(e) { return { error: e }; }
}
async function loadJobs(savedBy) {
  try {
    const q = query(collection(db, "takeoffJobs"), where("saved_by","==",savedBy));
    const snap = await getDocs(q);
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => d.job_name !== "__autosave__").sort((a,b) => (b.updated_at||"").localeCompare(a.updated_at||""));
    return { data, error: null };
  } catch(e) { return { data: [], error: e }; }
}
async function loadAllJobs() {
  try {
    const results = [];
    for (const member of TEAM_MEMBERS) {
      const r = await loadJobs(member);
      if (r.data) results.push(...r.data);
    }
    return results;
  } catch(e) { return []; }
}
async function deleteJob(id) {
  try { await deleteDoc(doc(db, "takeoffJobs", id)); return { error: null }; }
  catch(e) { return { error: e }; }
}
async function saveAutosave(savedBy, data) {
  try {
    await setDoc(doc(db, "takeoffAutosave", savedBy), { job_data: data, updated_at: new Date().toISOString() }, { merge: true });
    return { error: null };
  } catch(e) { return { error: e }; }
}
async function loadAutosave(savedBy) {
  try {
    const snap = await getDoc(doc(db, "takeoffAutosave", savedBy));
    if (!snap.exists()) return null;
    return snap.data().job_data;
  } catch(e) { return null; }
}

/* ──────── UI COMPONENTS ──────── */

var glassInput={width:"100%",padding:"10px 12px",background:"rgba(255,255,255,0.7)",border:"1px solid rgba(0,0,0,0.1)",borderRadius:8,color:"#0f172a",fontSize:15,fontFamily:"'Inter',sans-serif",outline:"none",boxSizing:"border-box",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",transition:"border-color 0.15s, box-shadow 0.15s"};
var _numpadBlurTimer=null;
var _numpadActiveSet=null;
function _numpadOpen(setShow){
  clearTimeout(_numpadBlurTimer);
  if(_numpadActiveSet&&_numpadActiveSet!==setShow){_numpadActiveSet(false);}
  _numpadActiveSet=setShow;
  setShow(true);
}
function _numpadClose(setShow){
  _numpadBlurTimer=setTimeout(function(){
    if(_numpadActiveSet===setShow){_numpadActiveSet=null;}
    setShow(false);
  },120);
}
function QV_Input(p){
  var isNum=!p.type||p.type==="number";
  var sp=React.useState(false),showPad=sp[0],setShowPad=sp[1];
  function padPress(v){
    var cur=String(p.value||"");
    if(v==="⌫"){p.onChange(cur.slice(0,-1));}
    else if(v==="."&&cur.includes(".")){return;}
    else{p.onChange(cur+v);}
  }
  var padNums=["7","8","9","4","5","6","1","2","3",".","0","⌫"];
  return(<div style={{position:"relative"}}>
    <label style={{fontSize:11,fontWeight:600,color:C.textSec,marginBottom:5,display:"block",textTransform:"uppercase",letterSpacing:"0.08em"}}>{p.label}</label>
    <input className={p.pulse?"ist-pulse":""} style={Object.assign({},glassInput,{caretColor:isNum?"transparent":"auto"})}
      onFocus={function(e){e.target.style.borderColor=C.accent;e.target.style.boxShadow="0 0 0 3px rgba(37,99,235,0.15)";if(isNum)_numpadOpen(setShowPad);}}
      onBlur={function(e){e.target.style.borderColor="rgba(0,0,0,0.1)";e.target.style.boxShadow="none";if(isNum)_numpadClose(setShowPad);}}
      readOnly={isNum} inputMode={isNum?"none":undefined}
      type={isNum?"text":p.type} value={p.value}
      onChange={isNum?function(){}:function(e){p.onChange(e.target.value);}}
      placeholder={p.placeholder} step={p.step}/>
    {isNum&&showPad&&ReactDOM.createPortal(
      (<div onMouseDown={function(e){e.preventDefault();}} style={{position:"fixed",zIndex:9999,bottom:0,left:0,right:0,background:"#f1f5f9",boxShadow:"0 -2px 16px rgba(0,0,0,0.18)",borderTop:"2px solid #2563eb",padding:"10px 16px 24px"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:8,maxWidth:400,margin:"0 auto 8px"}}>
          {padNums.map(function(v){return(<button key={v} onMouseDown={function(e){e.preventDefault();padPress(v);}} style={{padding:"14px 0",borderRadius:10,border:"1px solid #cbd5e1",background:v==="⌫"?"#fee2e2":"#fff",color:v==="⌫"?"#dc2626":"#0f172a",fontSize:18,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",boxShadow:"0 1px 3px rgba(0,0,0,0.1)"}}>{v}</button>);})}
        </div>
        <button onMouseDown={function(e){e.preventDefault();clearTimeout(_numpadBlurTimer);_numpadActiveSet=null;setShowPad(false);}} style={{display:"block",maxWidth:400,width:"100%",margin:"0 auto",padding:"13px",borderRadius:10,border:"none",background:"#2563eb",color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",letterSpacing:"0.06em",textTransform:"uppercase"}}>Done</button>
      </div>),
      document.body
    )}
  </div>);}


function AppSelect(p){return(<div><label style={{fontSize:11,fontWeight:600,color:C.textSec,marginBottom:5,display:"block",textTransform:"uppercase",letterSpacing:"0.08em"}}>{p.label}</label><select className={p.pulse?"ist-pulse":""} style={Object.assign({},glassInput,{WebkitAppearance:"none"})} onFocus={function(e){e.target.style.borderColor=C.accent;e.target.style.boxShadow="0 0 0 3px rgba(37,99,235,0.15)";}} onBlur={function(e){e.target.style.borderColor="rgba(0,0,0,0.1)";e.target.style.boxShadow="none";}} value={p.value} onChange={function(e){p.onChange(e.target.value);}}>{p.options.map(function(o){var v=typeof o==="string"?o:o.value;var l=typeof o==="string"?o:o.label;return(<option key={v} value={v} style={{background:"#fff",color:"#0f172a"}}>{l}</option>);})}</select></div>);}

function Row(p){return <div style={{display:"flex",gap:10,marginBottom:10}}>{p.children}</div>;}
function Col(p){return <div style={{flex:1}}>{p.children}</div>;}
function StepLabel(p){return(<label style={{fontSize:11,fontWeight:700,color:C.accent,marginBottom:5,display:"block",textTransform:"uppercase",letterSpacing:"0.08em"}}>{p.children}</label>);}

function ToggleButtons(p){return(<div style={{display:"flex",gap:2,background:"rgba(0,0,0,0.05)",padding:3,borderRadius:8,marginBottom:12,border:"1px solid rgba(0,0,0,0.07)"}}>{p.options.map(function(o){return(<button key={o.id} onClick={function(){p.setMode(o.id);}} style={{flex:1,padding:"8px 6px",borderRadius:6,fontSize:12,fontWeight:600,cursor:"pointer",border:p.mode===o.id?"1px solid rgba(37,99,235,0.3)":"1px solid transparent",fontFamily:"'Inter',sans-serif",textTransform:"uppercase",letterSpacing:"0.04em",background:p.mode===o.id?"rgba(255,255,255,0.9)":"transparent",color:p.mode===o.id?C.accent:C.textSec,boxShadow:p.mode===o.id?"0 1px 4px rgba(0,0,0,0.1)":"none",transition:"all 0.15s"}}>{o.label}</button>);})}</div>);}

function GreenBtn(p){return(<button onClick={p.onClick} className={p.pulse?"ist-pulse":""} style={{width:"100%",padding:"13px 20px",borderRadius:8,border:"1px solid rgba(37,99,235,0.3)",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"'Inter',sans-serif",textTransform:"uppercase",letterSpacing:"0.06em",background:"rgba(37,99,235,0.12)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",color:"#1d4ed8",marginTop:p.mt||0,boxShadow:"0 2px 12px rgba(37,99,235,0.15), inset 0 1px 0 rgba(255,255,255,0.8)",transition:"all 0.15s"}} onMouseOver={function(e){e.currentTarget.style.background="rgba(37,99,235,0.2)";e.currentTarget.style.boxShadow="0 4px 20px rgba(37,99,235,0.25), inset 0 1px 0 rgba(255,255,255,0.9)";}} onMouseOut={function(e){e.currentTarget.style.background="rgba(37,99,235,0.12)";e.currentTarget.style.boxShadow="0 2px 12px rgba(37,99,235,0.15), inset 0 1px 0 rgba(255,255,255,0.8)";}}>{p.children}</button>);}

/* ──────── MEASUREMENTS ──────── */

var CAVITY_WIDTHS=[{value:"",label:"— Cavity Width —"},{value:"2x4",label:"2x4"},{value:"2x6",label:"2x6"},{value:"2x8",label:"2x8"}];

function WallMeasurement(p){
  var s1=useState(p.lhOnly?"lh":"count"),mode=s1[0],setMode=s1[1];
  // sqft direct mode
  var sd=useState(""),ds=sd[0],setDs=sd[1];
  var s2=useState(""),wc=s2[0],setWc=s2[1];
  var s3=useState("0"),wi=s3[0],setWi=s3[1];
  var s4=useState(""),ln=s4[0],setLn=s4[1];
  var s5=useState(""),ht=s5[0],setHt=s5[1];
  var s6=useState(""),cw=s6[0],setCw=s6[1];
  var sq=mode==="count"?(parseInt(wc)||0)*(WALL_HEIGHTS[parseInt(wi)]?WALL_HEIGHTS[parseInt(wi)].sqftPer:0):(parseFloat(ln)||0)*(parseFloat(ht)||0);
  function notify(sqftVal,wiVal,wcVal,lnVal,htVal,modeVal,cwVal){
    var heightLabel=null;var dimStr="";
    var m=modeVal||mode;
    if(m==="count"){var h=WALL_HEIGHTS[parseInt(wiVal!==undefined?wiVal:wi)];if(h)heightLabel=h.label;var cavities=parseInt(wcVal!==undefined?wcVal:wc)||0;if(cavities>0&&heightLabel){heightLabel=cavities+" cavities @ "+heightLabel;dimStr=heightLabel;}}
    else{var l=lnVal!==undefined?lnVal:ln;var ht2=htVal!==undefined?htVal:ht;if(l&&ht2)dimStr=l+"×"+ht2;}
    var cavity=cwVal!==undefined?cwVal:cw;
    p.onSqftChange(sqftVal,heightLabel,cavity||null,dimStr||null);
  }
  return(<div>
    <ToggleButtons mode={mode} setMode={function(v){setMode(v);}} options={p.lhOnly?[{id:"lh",label:"L × H"},{id:"sqft",label:"Sq Ft"}]:[{id:"count",label:"Wall Count"},{id:"lh",label:"L × H"},{id:"sqft",label:"Sq Ft"}]}/>
    {mode==="count"&&(<Row><Col><QV_Input pulse={p.pulse} label="# of Cavities" value={wc} placeholder="0" onChange={function(v){setWc(v);var s=(parseInt(v)||0)*(WALL_HEIGHTS[parseInt(wi)]?WALL_HEIGHTS[parseInt(wi)].sqftPer:0);notify(s,wi,v,ln,ht,"count",cw);}}/></Col><Col><AppSelect pulse={p.pulse} label="Wall Height" value={wi} onChange={function(v){setWi(v);var s=(parseInt(wc)||0)*(WALL_HEIGHTS[parseInt(v)]?WALL_HEIGHTS[parseInt(v)].sqftPer:0);notify(s,v,wc,ln,ht,"count",cw);}} options={WALL_HEIGHTS.map(function(w,i){return{value:String(i),label:w.label};})}/></Col></Row>)}
    {mode==="lh"&&(<Row><Col><QV_Input pulse={p.pulse} label="Length (ft)" value={ln} placeholder="0" onChange={function(v){setLn(v);notify((parseFloat(v)||0)*(parseFloat(ht)||0),wi,wc,v,ht,"lh",cw);}}/></Col><Col><QV_Input pulse={p.pulse} label="Height (ft)" value={ht} placeholder="0" onChange={function(v){setHt(v);notify((parseFloat(ln)||0)*(parseFloat(v)||0),wi,wc,ln,v,"lh",cw);}}/></Col></Row>)}
    {mode==="sqft"&&(<div style={{marginBottom:10}}><QV_Input pulse={p.pulse} label="Total Sq Ft" value={ds} placeholder="0" onChange={function(v){setDs(v);p.onSqftChange(parseFloat(v)||0,null,null,v?v+" sf":null);}}/></div>)}
    {mode!=="sqft"&&<div style={{marginBottom:8}}><AppSelect pulse={p.pulse} label="Cavity Width" value={cw} onChange={function(v){setCw(v);notify(sq,wi,wc,ln,ht,mode,v);}} options={CAVITY_WIDTHS}/></div>}
    {(sq>0||parseFloat(ds)>0)&&(<div style={{fontSize:13,color:C.accent,fontWeight:600,marginBottom:8}}>{Math.round(mode==="sqft"?parseFloat(ds)||0:sq)+" sq ft"+(cw&&mode!=="sqft"?" · "+cw:"")}</div>)}
  </div>);
}

function AreaMeasurement(p){
  var s1=useState("dims"),mode=s1[0],setMode=s1[1];
  var s2=useState(""),ln=s2[0],setLn=s2[1];
  var s3=useState(""),wd=s3[0],setWd=s3[1];
  var s4=useState(""),ds=s4[0],setDs=s4[1];
  var sq=mode==="dims"?(parseFloat(ln)||0)*(parseFloat(wd)||0):(parseFloat(ds)||0);
  return(<div>
    <ToggleButtons mode={mode} setMode={setMode} options={[{id:"dims",label:"L × W"},{id:"sqft",label:"Sq Ft"}]}/>
    {mode==="dims"?(<Row><Col><QV_Input pulse={p.pulse} label="Length (ft)" value={ln} placeholder="0" onChange={function(v){setLn(v);var sq2=(parseFloat(v)||0)*(parseFloat(wd)||0);p.onSqftChange(sq2,null,null,(v&&wd)?v+"×"+wd:null);}}/></Col><Col><QV_Input pulse={p.pulse} label="Width (ft)" value={wd} placeholder="0" onChange={function(v){setWd(v);var sq2=(parseFloat(ln)||0)*(parseFloat(v)||0);p.onSqftChange(sq2,null,null,(ln&&v)?ln+"×"+v:null);}}/></Col></Row>):(<div style={{marginBottom:10}}><QV_Input pulse={p.pulse} label="Total Sq Ft" value={ds} placeholder="0" onChange={function(v){setDs(v);p.onSqftChange(parseFloat(v)||0,null,null,v?v+" sf":null);}}/></div>)}
    {sq>0&&(<div style={{fontSize:13,color:C.accent,fontWeight:600,marginBottom:8}}>{Math.round(sq)+" sq ft"}</div>)}
  </div>);
}

function LocationGrid(p){
  var groups=GROUP_ORDER.filter(function(g){return LOCATIONS.some(function(l){return l.group===g&&l.id!=="custom";});});
  return(<div style={{marginBottom:4}}>
    {groups.map(function(g){
      var locs=LOCATIONS.filter(function(l){return l.group===g&&l.id!=="custom";});
      return(<div key={g} style={{marginBottom:10}}>
        <div style={{fontSize:10,fontWeight:700,color:C.dim,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:5}}>{g}</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {locs.map(function(loc){
            var active=p.value===loc.id;
            return(<button key={loc.id} onClick={function(){p.onChange(loc.id);}} className={(p.pulse&&!p.value)?"ist-pulse":active?"ist-pulse-selected":""}
              style={{padding:"8px 13px",borderRadius:8,border:active?"2px solid "+C.accent:"1px solid rgba(0,0,0,0.08)",background:active?"rgba(37,99,235,0.1)":"rgba(255,255,255,0.6)",color:active?C.accent:C.text,fontSize:13,fontWeight:active?700:500,cursor:"pointer",fontFamily:"'Inter',sans-serif",transition:"all 0.12s",lineHeight:1.2,backdropFilter:"blur(8px)",boxShadow:active?"0 0 0 3px rgba(37,99,235,0.1)":"0 1px 3px rgba(0,0,0,0.06)"}}>
              {loc.short}
            </button>);
          })}
        </div>
      </div>);
    })}
    <button onClick={function(){p.onChange("custom");}}
      style={{padding:"8px 13px",borderRadius:8,border:p.value==="custom"?"2px solid "+C.accent:"1px dashed rgba(0,0,0,0.2)",background:p.value==="custom"?"rgba(37,99,235,0.08)":"rgba(255,255,255,0.4)",color:p.value==="custom"?C.accent:C.dim,fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
      + Custom
    </button>
  </div>);
}

function StepBar(p){
  var steps=p.steps;
  return(<div style={{display:"flex",alignItems:"center",gap:0,marginBottom:18}}>
    {steps.map(function(s,i){
      var done=i<p.current;var active=i===p.current;
      var bg=done?C.accent:active?C.accent:"transparent";
      var col=done||active?"#fff":C.dim;
      var borderCol=done||active?C.accent:C.border;
      return(<div key={i} style={{display:"flex",alignItems:"center",flex:i<steps.length-1?1:"none"}}>
        <div style={{display:"flex",alignItems:"center",gap:7,padding:"7px 12px",borderRadius:20,background:bg,border:"1.5px solid "+borderCol,transition:"all 0.15s"}}>
          <span style={{fontSize:12,fontWeight:800,color:col}}>{done?"✓":(i+1)}</span>
          <span style={{fontSize:12,fontWeight:600,color:col,whiteSpace:"nowrap"}}>{s}</span>
        </div>
        {i<steps.length-1&&(<div style={{flex:1,height:2,background:done?C.accent:C.borderLight,margin:"0 4px"}}/>)}
      </div>);
    })}
  </div>);
}

function MeasurementForm(p){
  var mats=p.tab==="opencell"?OPEN_CELL_MATERIALS:p.tab==="closedcell"?CLOSED_CELL_MATERIALS:FIBERGLASS_MATERIALS;
  var isFoam=p.tab==="opencell"||p.tab==="closedcell";
  var hp=p.hasPrice;
  // Allow external lid/cl state (for split layout)
  var s1=useState(""),_lid=s1[0],_setLid=s1[1];
  var s2=useState(""),_cl=s2[0],_setCl=s2[1];
  var lid=p.lid!==undefined?p.lid:_lid;
  var setLid=p.setLid||_setLid;
  var cl=p.cl!==undefined?p.cl:_cl;
  var setCl=p.setCl||_setCl;
  var s3=useState(mats[0]||""),mat=s3[0],setMat=s3[1];
  var s4=useState(0),sqft=s4[0],setSqft=s4[1];
  var s4b=useState(null),wallHeightLabel=s4b[0],setWallHeightLabel=s4b[1];
  var s4c=useState(null),cavityWidth=s4c[0],setCavityWidth=s4c[1];
  var s4d=useState(null),dimStr=s4d[0],setDimStr=s4d[1];
  var s5=useState(""),price=s5[0],setPrice=s5[1];
  var s6=useState("Flat (0/12)"),pitch=s6[0],setPitch=s6[1];
  var s7=useState(0),mk=s7[0],setMk=s7[1];
  var s8=useState(false),isRemoval=s8[0],setIsRemoval=s8[1];
  var s9=useState(""),matNote=s9[0],setMatNote=s9[1];
  var s10=useState(""),tmpMat=s10[0],setTmpMat=s10[1];
  var loc=LOCATIONS.find(function(x){return x.id===lid;});
  var locLabel=loc?(loc.id==="custom"?cl:loc.label):"";
  var locGroup=loc?(loc.id==="custom"?"Other":loc.group):"Other";
  var needsPitch=loc&&loc.type==="roofline"&&(!hp||isFoam);
  var measType=loc?(loc.type==="wall"?"wall":loc.type==="slope"?"slope":"area"):null;
  var pf=needsPitch?(PITCH_FACTORS[pitch]||1):1;
  var adj=sqft*pf;var fin=Math.round(adj);
  var ss={width:"100%",padding:"10px 12px",background:C.input,border:"1px solid "+C.inputBorder,borderRadius:6,color:C.text,fontSize:14,fontFamily:"'Inter',sans-serif",outline:"none",boxSizing:"border-box",WebkitAppearance:"none",transition:"border-color 0.15s"};
  var tabLabel=p.tab==="opencell"?"Open Cell":p.tab==="closedcell"?"Closed Cell":"Fiberglass";
  // Step tracking
  var stepLabels = hp ? ["Location","Material","Measure","Price"] : ["Location","Measure","Material","Add"];
  var stepCurrent = !lid ? 0 : (fin<=0) ? 1 : (!hp&&!matNote.trim()) ? 2 : 3;
  React.useEffect(function(){
    setSqft(0);setWallHeightLabel(null);setCavityWidth(null);setDimStr(null);setMk(function(k){return k+1;});setMatNote("");setTmpMat("");
  },[lid]);
  React.useEffect(function(){
    if(document.getElementById("ist-pulse-style"))return;
    var s=document.createElement("style");s.id="ist-pulse-style";
    s.textContent="@keyframes ist-pulse{0%{box-shadow:0 0 0 0 rgba(37,99,235,0.9),0 0 0 0 rgba(37,99,235,0.5)}60%{box-shadow:0 0 0 6px rgba(37,99,235,0.3),0 0 0 12px rgba(37,99,235,0)}100%{box-shadow:0 0 0 0 rgba(37,99,235,0),0 0 0 0 rgba(37,99,235,0)}}.ist-pulse{animation:ist-pulse 1.3s ease-in-out infinite !important;border-radius:8px;outline:2px solid rgba(37,99,235,0.6);outline-offset:1px;}.ist-pulse-selected{animation:ist-pulse 1.3s ease-in-out infinite !important;}";
    document.head.appendChild(s);
  },[]);
  function handleAdd(){
    var pr=hp?(parseFloat(price)||0):0;if(fin<=0||!locLabel)return;if(hp&&pr<=0)return;if(!hp&&!matNote.trim()){alert("Please select a material first.");return;}
    var useMat=hp?mat:"(material TBD)";
    var desc=hp?("Install "+mat.toLowerCase()+" in "+locLabel.toLowerCase()):(locLabel+" — "+fin.toLocaleString()+" sq ft");
    p.onAdd({type:isFoam?"Foam":"Fiberglass",material:useMat,location:locLabel,locationId:loc?loc.id:"custom",group:locGroup,sqft:fin,pitch:needsPitch?pitch:null,pricePerUnit:pr,total:hp?Math.ceil(fin*pr):0,description:desc,isRemoval:!hp&&isRemoval,wallHeightLabel:(!hp&&wallHeightLabel)||null,cavityWidth:(!hp&&cavityWidth)||null,matNote:(!hp&&matNote.trim())||null,dimStr:dimStr||null});
    setSqft(0);setWallHeightLabel(null);setCavityWidth(null);setDimStr(null);setPrice("");setPitch("Flat (0/12)");setMk(function(k){return k+1;});setIsRemoval(false);setMatNote("");setTmpMat("");
  }
  return(<div style={{background:"rgba(255,255,255,0.65)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",borderRadius:12,padding:18,border:"1px solid rgba(255,255,255,0.8)",boxShadow:"0 4px 24px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.9)"}}>
    <StepBar steps={stepLabels} current={stepCurrent}/>
    {/* STEP 1: Location grid */}
    {!p.hideLocation&&(<div style={{marginBottom:16}}>
      <div style={{fontSize:11,fontWeight:700,color:C.textSec,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>{"① Location"}</div>
      <LocationGrid pulse={!hp&&stepCurrent===0} value={lid} onChange={function(v){setLid(v);setSqft(0);setMk(function(k){return k+1;});}}/>
      {lid==="custom"&&(<div style={{marginTop:8}}><QV_Input label="Custom Location Name" value={cl} onChange={setCl} type="text" placeholder="e.g. Bonus room walls"/></div>)}
    </div>)}
    {loc&&(<div>
      {hp&&(<div style={{marginBottom:14}}>
        <div style={{fontSize:11,fontWeight:700,color:C.textSec,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>{"② Material"}{!mat&&(<span style={{color:C.danger,marginLeft:4}}>{"*"}</span>)}</div>
        {(function(){
          var HPBTNS=[
            {id:"R11",label:"R11",value:"R11 Fiberglass Batts",sub:null},
            {id:"R13",label:"R13",value:null,sub:[{id:"x15",label:"x15",value:"R13 x15 Fiberglass Batts"},{id:"x24",label:"x24",value:"R13 x24 Fiberglass Batts"}]},
            {id:"R19",label:"R19",value:null,sub:[{id:"x15",label:"x15",value:"R19 x15 Fiberglass Batts"},{id:"x24",label:"x24",value:"R19 x24 Fiberglass Batts"}]},
            {id:"R30",label:"R30",value:null,sub:[{id:"x15",label:"x15",value:"R30 x15 Fiberglass Batts"},{id:"x24",label:"x24",value:"R30 x24 Fiberglass Batts"}]},
            {id:"opencell",label:"Open Cell",value:null,sub:["2\"","3\"","4\"","5\"","6\""].map(function(v){return{id:v,label:v,value:v+' Open Cell Foam'};})},
            {id:"closedcell",label:"Closed Cell",value:null,sub:["1\"","2\"","3\""].map(function(v){return{id:v,label:v,value:v+' Closed Cell Foam'};})},
            {id:"blownfg",label:"Blown Fiberglass",value:null,sub:["R13","R15","R19","R22","R26","R30","R38","R44","R49","R60"].map(function(r){return{id:r,label:r,value:"Blown Fiberglass "+r};})},
            {id:"blowncel",label:"Blown Cellulose",value:null,sub:["R13","R15","R19","R22","R26","R30","R38","R44","R49","R60"].map(function(r){return{id:r,label:r,value:"Blown Cellulose "+r};})},
          ];
          var hpBtnStyle=function(active){return{padding:"8px 13px",borderRadius:8,border:active?"2px solid "+C.accent:"1px solid rgba(0,0,0,0.08)",background:active?"rgba(37,99,235,0.1)":"rgba(255,255,255,0.6)",color:active?C.accent:C.text,fontSize:13,fontWeight:active?700:500,cursor:"pointer",fontFamily:"'Inter',sans-serif",transition:"all 0.12s",backdropFilter:"blur(8px)",boxShadow:active?"0 0 0 3px rgba(37,99,235,0.1)":"0 1px 3px rgba(0,0,0,0.06)"};};
          var activePrimary=HPBTNS.find(function(b){return mat&&(b.value===mat||b.sub&&b.sub.some(function(s){return s.value===mat;}));});
          var activePrimaryId=activePrimary?activePrimary.id:"";
          return React.createElement("div",null,
            React.createElement("div",{style:{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}},
              HPBTNS.map(function(b){
                var active=activePrimaryId===b.id;
                return React.createElement("button",{key:b.id,onClick:function(){if(b.value){setMat(b.value);}else{setMat("");}setTmpMat(b.id);},style:hpBtnStyle(active)},b.label);
              })
            ),
            activePrimary&&activePrimary.sub&&React.createElement("div",{style:{display:"flex",flexWrap:"wrap",gap:6,marginTop:4,paddingLeft:8,borderLeft:"3px solid "+C.accent}},
              activePrimary.sub.map(function(s){
                var subActive=mat===s.value;
                return React.createElement("button",{key:s.id,onClick:function(){setMat(s.value);},style:hpBtnStyle(subActive)},s.label);
              })
            )
          );
        })()}
        {mat&&(<div style={{marginTop:6,fontSize:12,color:C.accent,fontWeight:600}}>{"✓ "+mat}</div>)}
      </div>)}
      <div style={{marginBottom:4}}>
        <div style={{fontSize:11,fontWeight:700,color:C.textSec,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>{(hp?"③":"②")+" Measurements"}</div>
      </div>
      {measType==="wall"?(<WallMeasurement key={"w-"+mk} pulse={!hp&&stepCurrent===1} lhOnly={lid==="ext_kneewall"||lid==="attic_kneewall"} onSqftChange={function(s,h,cw,ds){setSqft(s);setWallHeightLabel(h||null);setCavityWidth(cw||null);setDimStr(ds||null);}}/>):measType==="slope"?(<WallMeasurement key={"w-"+mk} pulse={!hp&&stepCurrent===1} onSqftChange={function(s,h,cw,ds){setSqft(s);setDimStr(ds||null);}} lhOnly/>):(<AreaMeasurement key={"a-"+mk} pulse={!hp&&stepCurrent===1} onSqftChange={function(s,h,cw,ds){setSqft(s);setDimStr(ds||null);}}/>)}
      {needsPitch&&(<div style={{marginBottom:10}}><AppSelect label="Roof Pitch" value={pitch} onChange={setPitch} options={Object.keys(PITCH_FACTORS)}/></div>)}
      {!hp&&(<div style={{marginBottom:12}}>
        <div style={{fontSize:11,fontWeight:700,color:C.accent,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>{"③ Material"}{!matNote.trim()&&(<span style={{color:C.danger,marginLeft:4}}>{"*"}</span>)}</div>
        {(function(){
          var BTNS=[
            {id:"R11",label:"R11",value:"R11 Fiberglass Batts",sub:null},
            {id:"R13",label:"R13",value:null,sub:[{id:"x15",label:"x15",value:"R13 x15 Fiberglass Batts"},{id:"x24",label:"x24",value:"R13 x24 Fiberglass Batts"}]},
            {id:"R19",label:"R19",value:null,sub:[{id:"x15",label:"x15",value:"R19 x15 Fiberglass Batts"},{id:"x24",label:"x24",value:"R19 x24 Fiberglass Batts"}]},
            {id:"R30",label:"R30",value:null,sub:[{id:"x15",label:"x15",value:"R30 x15 Fiberglass Batts"},{id:"x24",label:"x24",value:"R30 x24 Fiberglass Batts"}]},
            {id:"opencell",label:"Open Cell",value:null,sub:["1\"","2\"","3\"","4\"","5\"","6\"","7\"","8\"","9\"","10\""].map(function(v){return{id:v,label:v,value:v+' Open Cell Foam'};})},
            {id:"closedcell",label:"Closed Cell",value:null,sub:["1\"","1.5\"","2\"","2.5\"","3\"","3.5\"","4\"","4.5\"","5\"","5.5\"","6\""].map(function(v){return{id:v,label:v,value:v+' Closed Cell Foam'};})},
            {id:"blownfg",label:"Blown Fiberglass",value:null,sub:["R13","R15","R19","R22","R26","R30","R38","R44","R49","R60"].map(function(r){return{id:r,label:r,value:"Blown Fiberglass "+r};})},
            {id:"blowncel",label:"Blown Cellulose",value:null,sub:["R13","R15","R19","R22","R26","R30","R38","R44","R49","R60"].map(function(r){return{id:r,label:r,value:"Blown Cellulose "+r};})},
            {id:"removal",label:"Removal",value:"Removal",sub:null,isRemoval:true},
          ];
          var btnStyle=function(active,rem){return{padding:"8px 13px",borderRadius:8,border:active?(rem?"2px solid "+C.danger:"2px solid "+C.accent):"1px solid rgba(0,0,0,0.08)",background:active?(rem?"rgba(220,38,38,0.1)":"rgba(37,99,235,0.1)"):"rgba(255,255,255,0.6)",color:active?(rem?C.danger:C.accent):C.text,fontSize:13,fontWeight:active?700:500,cursor:"pointer",fontFamily:"'Inter',sans-serif",transition:"all 0.12s",backdropFilter:"blur(8px)",boxShadow:active?(rem?"0 0 0 3px rgba(220,38,38,0.1)":"0 0 0 3px rgba(37,99,235,0.1)"):"0 1px 3px rgba(0,0,0,0.06)"};};
          var matPulse=stepCurrent===2;
          var activeBtn=BTNS.find(function(b){return b.id===tmpMat;});
          var subPulse=matPulse&&activeBtn&&activeBtn.sub&&!matNote.trim();
          return React.createElement("div",null,
            React.createElement("div",{style:{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}},
              BTNS.map(function(b){
                var active=tmpMat===b.id;
                var shouldPulse=matPulse&&!tmpMat;
                return React.createElement("button",{key:b.id,className:shouldPulse||active?"ist-pulse":"",onClick:function(){
                  setTmpMat(b.id);
                  if(b.value){setMatNote(b.value);}else{setMatNote("");}
                  setIsRemoval(!!b.isRemoval);
                },style:btnStyle(active,b.isRemoval)},b.label);
              })
            ),
            activeBtn&&activeBtn.sub&&React.createElement("div",{style:{display:"flex",flexWrap:"wrap",gap:6,marginTop:4,paddingLeft:8,borderLeft:"3px solid "+C.accent}},
              activeBtn.sub.map(function(s){
                var subActive=matNote===s.value;
                return React.createElement("button",{key:s.id,className:subPulse||subActive?"ist-pulse":"",onClick:function(){setMatNote(s.value);},style:btnStyle(subActive)},s.label);
              })
            )
          );
        })()}
        {matNote.trim()&&(<div style={{marginTop:8,fontSize:12,color:C.accent,fontWeight:600}}>{"✓ "+matNote}</div>)}
      </div>)}
      {hp&&(<div style={{marginBottom:14}}>
        <div style={{fontSize:11,fontWeight:700,color:C.textSec,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>{(hp?"④":"③")+" Price"}</div>
        <QV_Input label="Price per Sq Ft" value={price} onChange={setPrice} placeholder="$0.00" step="0.01"/>
      </div>)}
      {fin>0&&(<div style={{background:C.accentBg,borderRadius:6,padding:12,marginBottom:12,fontSize:13,color:C.textSec,border:"1px solid "+C.borderLight}}>
        <div style={{fontWeight:600,color:C.text,marginBottom:4,fontSize:14}}>{hp?("Install "+mat.toLowerCase()+" in "+locLabel.toLowerCase()):(locLabel+" — "+fin.toLocaleString()+" sq ft")}</div>
        <div>{"Total: "}<span style={{color:C.text,fontWeight:600}}>{fin.toLocaleString()+" sq ft"}</span>{needsPitch&&sqft!==adj&&(<span>{" (adj. from "+Math.round(sqft)+" w/ "+pitch+")"}</span>)}</div>
        {hp&&(parseFloat(price)||0)>0&&(<div>{"Line Total: "}<span style={{color:C.accent,fontWeight:700}}>{"$"+Math.ceil(fin*(parseFloat(price)||0)).toLocaleString()+".00"}</span></div>)}
      </div>)}
      {!hp&&fin>0&&false&&(<label style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",marginBottom:8,cursor:"pointer"}}>
        <input type="checkbox" checked={isRemoval} onChange={function(e){setIsRemoval(e.target.checked);}} style={{width:18,height:18,accentColor:C.accent,cursor:"pointer"}}/>
        <span style={{fontSize:13,fontWeight:600,color:C.text}}>{"Removal"}</span>
      </label>)}
      <GreenBtn pulse={!hp&&stepCurrent===3} onClick={handleAdd}>{"+ "+(hp?"Add to Quote":"Add Measurement")}</GreenBtn>
    </div>)}
  </div>);
}

function MaterialTabs(p){return(<div style={{display:"flex",gap:0,borderRadius:6,overflow:"hidden",border:"1px solid "+C.border,marginBottom:16}}>{[{id:"fiberglass",label:"FIBERGLASS"},{id:"opencell",label:"OPEN CELL"},{id:"closedcell",label:"CLOSED CELL"}].map(function(t){return(<button key={t.id} onClick={function(){p.setActiveTab(t.id);}} style={{flex:1,padding:"12px 4px",border:"none",cursor:"pointer",fontFamily:"'Inter',sans-serif",fontSize:11,fontWeight:700,letterSpacing:"0.04em",textTransform:"uppercase",background:p.activeTab===t.id?C.accent:C.card,color:p.activeTab===t.id?"#fff":C.dim}}>{t.label}</button>);})}</div>);}

function getSavedCustomers(salesman){try{return JSON.parse(localStorage.getItem("ist-customers-"+salesman)||"[]");}catch(e){return[];}}
function setSavedCustomers(salesman,list){localStorage.setItem("ist-customers-"+salesman,JSON.stringify(list));}

function SavedDropdown({label, icon, color, bg, items, onSelect, onDelete}){
  var s1=useState(false),open=s1[0],setOpen=s1[1];
  var s2=useState(""),q=s2[0],setQ=s2[1];
  var sorted=items.filter(function(c){return!q||c.name.toLowerCase().indexOf(q.toLowerCase())>=0;}).sort(function(a,b){return a.name.localeCompare(b.name);});
  return(
    <div style={{flex:1,position:"relative"}}>
      {open&&<div onClick={function(){setOpen(false);setQ("");}} style={{position:"fixed",inset:0,zIndex:998}}/>}
      <button onClick={function(){setOpen(!open);}} style={{width:"100%",padding:"9px 12px",borderRadius:6,border:"1px solid "+color,background:open?color:bg,color:open?"#fff":color,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",display:"flex",justifyContent:"space-between",alignItems:"center",gap:4}}>
        <span>{icon} {label} ({items.length})</span><span style={{fontSize:11}}>{open?"▲":"▼"}</span>
      </button>
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,background:"rgba(255,255,255,0.92)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",border:"1px solid rgba(0,0,0,0.1)",borderRadius:8,boxShadow:"0 8px 32px rgba(0,0,0,0.15)",zIndex:9999,minWidth:200}}>
          <input autoFocus value={q} onChange={function(e){setQ(e.target.value);}} placeholder={"Search "+label+"..."} style={{width:"100%",padding:"8px 12px",border:"none",borderBottom:"1px solid #e5e7eb",borderRadius:"8px 8px 0 0",fontSize:13,fontFamily:"'Inter',sans-serif",boxSizing:"border-box",outline:"none"}}/>
          <div style={{maxHeight:220,overflowY:"auto"}}>
            {sorted.length===0
              ?<div style={{padding:"12px",fontSize:13,color:"#9ca3af"}}>No {label.toLowerCase()} saved</div>
              :sorted.map(function(c){return(
                <div key={c.name} onClick={function(){onSelect(c);setOpen(false);setQ("");}} style={{padding:"10px 12px",borderBottom:"1px solid #f3f4f6",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:"#111"}}>{c.name}</div>
                    {c.address&&<div style={{fontSize:11,color:"#6b7280"}}>{c.address}</div>}
                    {c.phone&&<div style={{fontSize:11,color:"#6b7280"}}>{c.phone}</div>}
                  </div>
                  <button onClick={function(e){e.stopPropagation();onDelete(c.name);}} style={{padding:"3px 7px",borderRadius:4,border:"1px solid #fca5a5",background:"#fef2f2",color:"#dc2626",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",flexShrink:0,marginLeft:8}}>✕</button>
                </div>
              );})}
          </div>
        </div>
      )}
    </div>
  );
}

function CustomerInfo(p){
  var user=p.currentUser||"default";
  var s1=useState(false),showForm=s1[0],setShowForm=s1[1];
  var s2=useState(""),search=s2[0],setSearch=s2[1];
  var s3=useState(false),showDrop=s3[0],setShowDrop=s3[1];
  var s4=useState(getSavedCustomers(user)),saved=s4[0],setSaved=s4[1];
  var s5=useState("Individual"),custType=s5[0],setCustType=s5[1];

  var s4=useState(getSavedCustomers(user)),saved=s4[0],setSaved=s4[1];
  var s5=useState("Individual"),custType=s5[0],setCustType=s5[1];

  var builders=saved.filter(function(c){return(c.type||"Individual")==="Builder";});
  var individuals=saved.filter(function(c){return(c.type||"Individual")==="Individual";});

  function load(c){p.setCustName(c.name||"");p.setCustAddr(c.address||"");p.setCustPhone(c.phone||"");p.setCustEmail(c.email||"");p.setJobAddr(c.jobAddress||"");setCustType(c.type||"Individual");}

  function del(name){
    if(!confirm("Remove "+name+"?"))return;
    var list=getSavedCustomers(user).filter(function(c){return c.name!==name;});
    setSavedCustomers(user,list);setSaved(list);
  }

  function save(){
    if(!p.custName.trim()){alert("Enter a customer name first.");return;}
    var entry={name:p.custName.trim(),address:p.custAddr,phone:p.custPhone,email:p.custEmail,jobAddress:p.jobAddr,type:custType};
    var list=getSavedCustomers(user);
    var idx=list.findIndex(function(c){return c.name.toLowerCase()===entry.name.toLowerCase();});
    if(idx>=0){if(!confirm("Update saved info for "+entry.name+"?"))return;list[idx]=entry;}else{list.push(entry);}
    setSavedCustomers(user,list);setSaved(list);
    alert(entry.name+" saved!");
  }

  var s6=useState(false),open=s6[0],setOpen=s6[1];
  return(<div style={{padding:"0 16px 12px"}}>
    <div style={{background:"rgba(255,255,255,0.65)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",borderRadius:12,border:"1px solid rgba(255,255,255,0.8)",boxShadow:"0 4px 24px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.9)",marginBottom:10,overflow:"visible"}}>
      <button onClick={function(){setOpen(!open);}} style={{width:"100%",padding:"10px 14px",background:"#1e293b",display:"flex",justifyContent:"space-between",alignItems:"center",borderRadius:open?"8px 8px 0 0":"8px",border:"none",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
        <span style={{fontSize:12,fontWeight:800,color:"#fff",textTransform:"uppercase",letterSpacing:0.8}}>👤 Customer Info</span>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {p.custName&&<span style={{fontSize:13,fontWeight:600,color:"#93c5fd"}}>{p.custName}</span>}
          <span style={{fontSize:13,color:"rgba(255,255,255,0.6)"}}>{open?"▲":"▼"}</span>
        </div>
      </button>

      {open&&<>{/* Two dropdowns side by side */}
      <div style={{padding:"10px 12px",display:"flex",gap:8,borderBottom:"1px solid "+C.border}}>
        <SavedDropdown label="Builders" icon="🏗️" color="#2563eb" bg="#eff6ff" items={builders} onSelect={load} onDelete={del}/>
        <SavedDropdown label="Individuals" icon="👤" color="#7c3aed" bg="#f5f3ff" items={individuals} onSelect={load} onDelete={del}/>
      </div>

      {/* Always-visible form */}
      <div style={{padding:14}}>
        <div style={{marginBottom:10}}><QV_Input label="Customer Name" value={p.custName} onChange={p.setCustName} type="text" placeholder="John Doe"/></div>
        <div style={{marginBottom:10}}>
          <QV_Input label="Address" value={p.custAddr} onChange={p.setCustAddr} type="text" placeholder="123 Main St, Tulsa OK"/>
          <button onClick={function(){var addr=(p.custAddr||"").trim();if(!addr){alert("Enter an address first.");return;}window.open("https://assessor.tulsacounty.org/Property/Search?terms="+encodeURIComponent(addr),"_blank");}} style={{marginTop:6,padding:"6px 12px",borderRadius:6,border:"1px solid #2563eb",background:"#eff6ff",color:"#2563eb",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>Look Up on Tulsa County Assessor</button>
        </div>
        <Row><Col><QV_Input label="Phone" value={p.custPhone} onChange={p.setCustPhone} type="tel" placeholder="(918) 555-0000"/></Col><Col><QV_Input label="Email" value={p.custEmail} onChange={p.setCustEmail} type="email" placeholder="john@email.com"/></Col></Row>
        <div style={{marginTop:10}}><QV_Input label="Job Site (if different)" value={p.jobAddr} onChange={p.setJobAddr} type="text" placeholder="456 Oak Ave"/></div>

        {/* Save controls — optional */}
        <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid "+C.border}}>
          <label style={{fontSize:10,fontWeight:700,color:C.textSec,textTransform:"uppercase",letterSpacing:"0.08em",display:"block",marginBottom:6}}>Save to List (Optional)</label>
          <div style={{display:"flex",gap:8}}>
            {["Builder","Individual"].map(function(type){return(
              <button key={type} onClick={function(){setCustType(type);}} style={{flex:1,padding:"7px",borderRadius:6,border:"1px solid "+(custType===type?(type==="Builder"?"#2563eb":"#7c3aed"):C.border),background:custType===type?(type==="Builder"?"#eff6ff":"#f5f3ff"):"transparent",color:custType===type?(type==="Builder"?"#2563eb":"#7c3aed"):C.dim,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
                {type==="Builder"?"🏗️ Builder":"👤 Individual"}
              </button>
            );})}
            <button onClick={save} style={{flex:1,padding:"7px",borderRadius:6,border:"1px solid #16a34a",background:"#f0fdf4",color:"#16a34a",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>💾 Save</button>
            <button onClick={function(){if(confirm("Clear?")){p.setCustName("");p.setCustAddr("");p.setCustPhone("");p.setCustEmail("");p.setJobAddr("");}}} style={{padding:"7px 12px",borderRadius:6,border:"1px solid "+C.danger,background:"transparent",color:C.danger,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>✕</button>
          </div>
        </div>
      </div>
      </>}
    </div>
  </div>);
}

function groupMeasurements(items){var g={};items.forEach(function(m){var k=m.group||"Other";if(!g[k])g[k]=[];g[k].push(m);});return g;}

/* ──────── PRINT / DOWNLOAD FUNCTIONS ──────── */

function buildSalesmanBlock(salesman){
  var s=SALESMAN_INFO[salesman];if(!s)return "";
  return '<div style="margin-top:30px;display:inline-block;padding:10px 16px;background:#f5f5f5;border:2px solid #222;border-radius:6px"><div style="font-size:9px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px">Your Sales Representative</div><div style="font-size:16px;font-weight:800;color:#111;margin-bottom:4px">'+s.fullName+'</div><div style="font-size:13px;color:#111;font-weight:600;margin-bottom:2px">📞 '+s.phone+'</div><div style="font-size:13px;color:#111;font-weight:600">✉ '+s.email+'</div></div>';
}

function buildTakeOffHtml(customer,jobNotes,measurements,salesman,quoteOpts){
  var groups=groupMeasurements(measurements);var sorted=GROUP_ORDER.filter(function(g){return groups[g];});
  var total=measurements.reduce(function(s,m){return s+m.sqft;},0);
  var today=new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});
  var notesHtml=jobNotes?'<div style="margin-bottom:20px;padding:12px 14px;background:#f9f9f9;border:1px solid #ddd;border-radius:6px"><div style="font-size:10px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px">Job Notes</div><div style="font-size:13px;color:#333;white-space:pre-wrap;line-height:1.5">'+jobNotes.replace(/</g,"&lt;").replace(/>/g,"&gt;")+'</div></div>':"";
  var ghtml=sorted.map(function(gn){var gt=groups[gn].reduce(function(s,m){return s+m.sqft;},0);
    var rows=groups[gn].map(function(item){return '<tr style="border-bottom:1px solid #e0e0e0"><td style="padding:8px 10px;font-size:13px;color:#333">'+item.location+'</td><td style="padding:8px 10px;font-size:13px;color:#333;text-align:right;font-weight:600">'+item.sqft.toLocaleString()+' sf</td></tr>';}).join("");
    return '<div style="margin-bottom:20px"><div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:#f5f5f5;border:1px solid #ddd;border-bottom:2px solid #333;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#333"><span>'+gn+'</span><span>'+gt.toLocaleString()+' sq ft</span></div><table style="width:100%;border-collapse:collapse"><tbody>'+rows+'</tbody></table></div>';}).join("");
  var si=SALESMAN_INFO[salesman];
  var salesHtml=si?'<div style="text-align:right"><div style="font-size:10px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px">Your Sales Rep</div><div style="font-size:15px;font-weight:800;color:#111;margin-bottom:2px">'+si.fullName+'</div><div style="font-size:13px;color:#111;font-weight:600;margin-bottom:1px">'+si.phone+'</div><div style="font-size:13px;color:#111;font-weight:600">'+si.email+'</div></div>':'';
  var totalRow=measurements.length>0?'<div style="margin-top:24px;padding-top:16px;border-top:2px solid #111;display:flex;justify-content:space-between;align-items:center"><div style="font-size:14px;font-weight:800;text-transform:uppercase;color:#111">Total</div><div style="font-size:18px;font-weight:800;color:#111">'+total.toLocaleString()+' sq ft</div></div>':'';
  return '<div style="font-family:Arial,sans-serif;color:#1a1a1a;padding:24px;max-width:100%;margin:0;width:100%;box-sizing:border-box">'+
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid #111"><div><h1 style="font-size:22px;font-weight:800;color:#111;margin-bottom:2px">'+COMPANY.name+'</h1><p style="font-size:12px;color:#888">'+COMPANY.tagline+'</p></div><div style="text-align:right"><div style="font-size:18px;font-weight:800;color:#111;text-transform:uppercase">Take Off</div><div style="font-size:12px;color:#888;margin-top:2px">'+today+'</div></div></div>'+
    '<div style="display:flex;justify-content:space-between;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid #ddd"><div style="flex:1"><div style="font-size:10px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px">Customer</div><div style="font-size:15px;font-weight:600">'+(customer.name||"—")+'</div><div style="font-size:13px;color:#666">'+(customer.address||"")+'</div><div style="font-size:13px;color:#666">'+(customer.phone||"")+'</div><div style="font-size:13px;color:#666">'+(customer.email||"")+'</div></div><div style="flex:1"><div style="font-size:10px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px">Job Site</div><div style="font-size:15px;font-weight:600">'+(customer.jobAddress||customer.address||"—")+'</div></div>'+salesHtml+'</div>'+
    notesHtml+
    ghtml+totalRow+
    (function(){
      if(!quoteOpts||quoteOpts.length===0)return"";
      var rows=quoteOpts.map(function(opt,idx){
        var lines=[];
        // Line items with price per sq ft
        if(opt.items&&opt.items.length>0){
          opt.items.forEach(function(item){
            if(!item.sqft||!item.pricePerUnit)return;
            lines.push('<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:5px 0;border-bottom:1px solid #eee"><span style="font-size:13px;color:#333">'+item.location+(item.description?' <span style="color:#666;font-size:11px">('+item.description+')</span>':'')+'</span><span style="font-size:13px;font-weight:700;color:#333;text-align:right;white-space:nowrap;margin-left:12px">'+item.sqft.toLocaleString()+' sf @ $'+parseFloat(item.pricePerUnit).toFixed(2)+'/sf = $'+Math.ceil(item.sqft*item.pricePerUnit).toLocaleString()+'</span></div>');
          });
          if(lines.length>0)lines.push('<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:2px solid #d1d5db;margin-bottom:4px"><span style="font-size:12px;font-weight:700;color:#666">Total before adders</span><span style="font-size:13px;font-weight:800;color:#111">$'+(opt.overrideTotal?parseFloat(opt.overrideTotal).toLocaleString():opt.items.reduce(function(s,i){return s+i.total;},0).toLocaleString())+'</span></div>');
        }
        if(opt.pso)lines.push('<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #eee"><span style="font-size:13px;color:#333">PSO Credit Attic</span><span style="font-size:13px;font-weight:700;color:#dc2626">-$600</span></div>');
        if(opt.psoKw)lines.push('<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #eee"><span style="font-size:13px;color:#333">PSO Credit KW</span><span style="font-size:13px;font-weight:700;color:#dc2626">-$525</span></div>');
        if(opt.extraLabor&&opt.extraLaborAmt)lines.push('<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #eee"><span style="font-size:13px;color:#333">Extra Labor</span><span style="font-size:13px;font-weight:700;color:#333">$'+parseFloat(opt.extraLaborAmt).toFixed(0)+'</span></div>');
        if(opt.tripCharge&&opt.tripChargeAmt)lines.push('<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #eee"><span style="font-size:13px;color:#333">Trip Charge</span><span style="font-size:13px;font-weight:700;color:#333">$'+parseFloat(opt.tripChargeAmt).toFixed(0)+'</span></div>');
        if(opt.energySeal&&opt.energySealAmt)lines.push('<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #eee"><span style="font-size:13px;color:#333">Energy Seal & Plates</span><span style="font-size:13px;font-weight:700;color:#333">$'+parseFloat(opt.energySealAmt).toFixed(0)+'</span></div>');
        if(opt.dumpster&&opt.dumpsterAmt)lines.push('<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #eee"><span style="font-size:13px;color:#333">Dumpster</span><span style="font-size:13px;font-weight:700;color:#333">$'+parseFloat(opt.dumpsterAmt).toFixed(0)+'</span></div>');
        if(lines.length===0)return"";
        var header=quoteOpts.length>1?'<div style="font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px">'+opt.name+'</div>':"";
        return header+lines.join("");
      }).join("");
      if(!rows)return"";
      return '<div style="margin-top:24px;padding:14px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px"><div style="font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:10px">⚠ Internal Adders — Do Not Share With Customer</div>'+rows+'</div>';
    })()+
    '<div style="margin-top:20px;padding-top:16px;border-top:1px solid #ddd;font-size:11px;color:#999;text-align:center">'+COMPANY.name+' &bull; '+COMPANY.phone+'<br/>Helping Oklahoma stay energy efficient—one home at a time.</div></div>';
}

function sharePdfBlob(blob,filename){
  if(navigator.share&&navigator.canShare&&navigator.canShare({files:[new File([blob],filename,{type:"application/pdf"})]})){
    navigator.share({files:[new File([blob],filename,{type:"application/pdf"})],title:filename}).catch(function(err){
      if(err.name!=="AbortError")alert("Share failed: "+err.message);
    });
  }else{
    var url=URL.createObjectURL(blob);
    var a=document.createElement("a");a.href=url;a.download=filename;a.click();
    setTimeout(function(){URL.revokeObjectURL(url);},1000);
  }
}

function buildQuotePdf(customer,opts,salesman,outputMode,showProductInfo){
  // outputMode: "blob" -> returns Promise<Blob>, "save" -> downloads directly
  return import("jspdf").then(function(mod){
    var jsPDF=mod.jsPDF||mod.default;
    var doc=new jsPDF({unit:"pt",format:"letter"});
    var W=612,M=36,x=M,RW=W-M*2;
    var si=SALESMAN_INFO[salesman];
    var today=new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});
    var qn="IST-"+Date.now().toString(36).toUpperCase();
    var optsWithItems=opts.filter(function(o){return o.items&&o.items.length>0;});
    // Brand colors
    var NAVY=[15,30,70],BLUE=[37,99,235],LIGHTBLUE=[219,234,254],GRAY=[100,116,139],LIGHTGRAY=[248,250,252],WHITE=[255,255,255],BLACK=[15,23,42];

    // ── HEADER BAND ──
    doc.setFillColor(NAVY[0],NAVY[1],NAVY[2]);
    doc.rect(0,0,W,72,"F");
    // Accent stripe
    doc.setFillColor(BLUE[0],BLUE[1],BLUE[2]);
    doc.rect(0,68,W,4,"F");
    // Company name
    doc.setTextColor(WHITE[0],WHITE[1],WHITE[2]);
    doc.setFontSize(20);doc.setFont("helvetica","bold");
    doc.text("INSULATION SERVICES OF TULSA",M,30);
    // Tagline
    doc.setFontSize(9);doc.setFont("helvetica","normal");
    doc.setTextColor(180,200,240);
    doc.text("Serving Northeastern Oklahoma  •  1 (918) 232-9055",M,46);
    // QUOTE label top right
    doc.setTextColor(LIGHTBLUE[0],LIGHTBLUE[1],LIGHTBLUE[2]);
    doc.setFontSize(11);doc.setFont("helvetica","bold");
    doc.text("QUOTE",W-M,24,{align:"right"});
    doc.setFontSize(8);doc.setFont("helvetica","normal");doc.setTextColor(180,200,240);
    doc.text(qn,W-M,36,{align:"right"});
    doc.text(today,W-M,48,{align:"right"});

    var y=90;

    // ── INFO CARDS ──
    var cardH=80;var col=RW/3+4;
    // Card 1: Prepared For
    doc.setFillColor(LIGHTGRAY[0],LIGHTGRAY[1],LIGHTGRAY[2]);
    doc.roundedRect(x,y,col-8,cardH,4,4,"F");
    doc.setFillColor(BLUE[0],BLUE[1],BLUE[2]);doc.rect(x,y,4,cardH,"F");
    doc.setTextColor(GRAY[0],GRAY[1],GRAY[2]);doc.setFontSize(7);doc.setFont("helvetica","bold");
    doc.text("PREPARED FOR",x+12,y+13);
    doc.setTextColor(BLACK[0],BLACK[1],BLACK[2]);doc.setFontSize(11);doc.setFont("helvetica","bold");
    doc.text(customer.name||"—",x+12,y+27,{maxWidth:col-24});
    doc.setFontSize(8);doc.setFont("helvetica","normal");doc.setTextColor(GRAY[0],GRAY[1],GRAY[2]);
    var cy=y+40;
    if(customer.address){var al=doc.splitTextToSize(customer.address,col-24);doc.text(al,x+12,cy);cy+=al.length*11;}
    if(customer.phone){doc.text(customer.phone,x+12,cy);cy+=11;}
    if(customer.email){doc.text(customer.email,x+12,cy);}

    // Card 2: Job Site
    var c2x=x+col;
    doc.setFillColor(LIGHTGRAY[0],LIGHTGRAY[1],LIGHTGRAY[2]);
    doc.roundedRect(c2x,y,col-8,cardH,4,4,"F");
    doc.setFillColor(BLUE[0],BLUE[1],BLUE[2]);doc.rect(c2x,y,4,cardH,"F");
    doc.setTextColor(GRAY[0],GRAY[1],GRAY[2]);doc.setFontSize(7);doc.setFont("helvetica","bold");
    doc.text("JOB SITE",c2x+12,y+13);
    doc.setTextColor(BLACK[0],BLACK[1],BLACK[2]);doc.setFontSize(10);doc.setFont("helvetica","bold");
    var jsAddr=customer.jobAddress||customer.address||"—";
    var jsal=doc.splitTextToSize(jsAddr,col-24);
    doc.text(jsal,c2x+12,y+27);
    doc.setFontSize(8);doc.setFont("helvetica","normal");doc.setTextColor(GRAY[0],GRAY[1],GRAY[2]);
    doc.text("Valid for 30 days from quote date",c2x+12,y+66);

    // Card 3: Sales Rep
    var c3x=x+col*2;
    if(si){
      doc.setFillColor(NAVY[0],NAVY[1],NAVY[2]);
      doc.roundedRect(c3x,y,col-8,cardH,4,4,"F");
      doc.setFillColor(BLUE[0],BLUE[1],BLUE[2]);doc.rect(c3x,y,4,cardH,"F");
      doc.setTextColor(LIGHTBLUE[0],LIGHTBLUE[1],LIGHTBLUE[2]);doc.setFontSize(7);doc.setFont("helvetica","bold");
      doc.text("YOUR SALES REP",c3x+12,y+13);
      doc.setTextColor(WHITE[0],WHITE[1],WHITE[2]);doc.setFontSize(11);doc.setFont("helvetica","bold");
      doc.text(si.fullName,c3x+12,y+27);
      doc.setFontSize(8);doc.setFont("helvetica","normal");doc.setTextColor(180,200,240);
      doc.text(si.phone,c3x+12,y+40);
      doc.text(si.email,c3x+12,y+53);
    }

    y+=cardH+20;

    // ── OPTIONS ──
    optsWithItems.forEach(function(opt,oi){
      var sortedItems=opt.items.slice().sort(function(a,b){
        var aFoam=a.type==="Foam"||/foam/i.test(a.material||"");
        var bFoam=b.type==="Foam"||/foam/i.test(b.material||"");
        if(aFoam&&!bFoam)return -1;if(!aFoam&&bFoam)return 1;
        var aR=parseInt((a.material||"").match(/R(\d+)/i)||[0,0])||0;
        var bR=parseInt((b.material||"").match(/R(\d+)/i)||[0,0])||0;
        return aR-bR;
      });

      if(optsWithItems.length>1){
        if(y>680){doc.addPage();y=40;}
        doc.setFillColor(BLUE[0],BLUE[1],BLUE[2]);doc.rect(x,y,RW,22,"F");
        doc.setTextColor(WHITE[0],WHITE[1],WHITE[2]);doc.setFontSize(11);doc.setFont("helvetica","bold");
        doc.text(opt.name.toUpperCase(),x+10,y+15);
        y+=30;
      }

      // Table header
      doc.setFillColor(NAVY[0],NAVY[1],NAVY[2]);doc.rect(x,y,RW,18,"F");
      doc.setTextColor(LIGHTBLUE[0],LIGHTBLUE[1],LIGHTBLUE[2]);doc.setFontSize(8);doc.setFont("helvetica","bold");
      doc.text("SCOPE OF WORK",x+10,y+12);
      y+=18;

      // Rows
      var allItems=sortedItems.slice();
      if(opt.energySeal)allItems.push({description:"Energy seal and plates per city code."});
      (opt.customItems||[]).forEach(function(ci){allItems.push({description:ci.description,customPrice:parseFloat(ci.price)||0});});
      allItems.forEach(function(item,i){
        if(y>710){doc.addPage();y=40;}
        doc.setFont("helvetica","normal");doc.setFontSize(9.5);
        var desc=doc.splitTextToSize(item.description||"",RW-26);
        var rowH=Math.max(20,desc.length*13+10);
        // Alternating bg
        doc.setFillColor(i%2===0?248:255,i%2===0?250:255,i%2===0?252:255);
        doc.rect(x,y,RW,rowH,"F");
        // Left accent dot centered vertically
        doc.setFillColor(BLUE[0],BLUE[1],BLUE[2]);
        doc.circle(x+7,y+rowH/2,2.5,"F");
        doc.setTextColor(BLACK[0],BLACK[1],BLACK[2]);
        doc.text(desc,x+16,y+13,{lineHeightFactor:1.4});
        // Bottom border
        doc.setDrawColor(226,232,240);doc.setLineWidth(0.4);doc.line(x,y+rowH,x+RW,y+rowH);
        y+=rowH;
      });

      // Total section
      var lineTotal=opt.items.reduce(function(s,i){return s+(i.total||0);},0);
      var psoCredit=((opt.pso||false)?600:0)+((opt.psoKw||false)?525:0);
      var el=opt.extraLabor?(parseFloat(opt.extraLaborAmt)||0):0;
      var tc=opt.tripCharge?(parseFloat(opt.tripChargeAmt)||0):0;
      var es=opt.energySeal?(parseFloat(opt.energySealAmt)||0):0;
      var du=opt.dumpster?(parseFloat(opt.dumpsterAmt)||0):0;
      var ciTotal=(opt.customItems||[]).reduce(function(s,x){return s+(parseFloat(x.price)||0);},0);
      var sub=lineTotal+el+tc+es+du+ciTotal;
      var total=opt.overrideTotal!==""?(parseFloat(opt.overrideTotal)||0):(sub-psoCredit);

      y+=8;
      // PSO credits
      if(opt.pso||opt.psoKw){
        doc.setFontSize(9);doc.setFont("helvetica","normal");
        doc.setTextColor(GRAY[0],GRAY[1],GRAY[2]);
        doc.text("Subtotal",x,y);doc.text("$"+Math.ceil(sub).toLocaleString(),W-M,y,{align:"right"});y+=14;
        if(opt.pso){doc.setTextColor(180,30,30);doc.text("Less PSO Credit — Attic",x,y);doc.text("-$600",W-M,y,{align:"right"});y+=14;}
        if(opt.psoKw){doc.setTextColor(180,30,30);doc.text("Less PSO Credit — Kneewall",x,y);doc.text("-$525",W-M,y,{align:"right"});y+=14;}
        doc.setDrawColor(220,220,230);doc.setLineWidth(0.5);doc.line(x,y,W-M,y);
        y+=8;
      }

      // Total box
      if(y>700){doc.addPage();y=40;}
      doc.setFillColor(BLUE[0],BLUE[1],BLUE[2]);
      doc.roundedRect(W-M-160,y,160,34,4,4,"F");
      doc.setTextColor(WHITE[0],WHITE[1],WHITE[2]);doc.setFontSize(18);doc.setFont("helvetica","bold");
      doc.text("$"+Math.ceil(total).toLocaleString(),W-M-80,y+22,{align:"center"});
      y+=50;
    });

    y+=8;

    // ── PRODUCT INFO (bottom of last page) ──
    if(showProductInfo){
      var colW=(RW-16)/2;
      var leftX=M,rightX=M+colW+16;
      var py=y;

      // ── FIBERGLASS BOX ──
      var FG_TITLE="Johns Manville & CertainTeed";
      var FG_SUB="";
      var FG_INTRO="IST uses a mix of both brands based on availability. They are virtually identical in performance and quality:";
      var FG_BULLETS=["Formaldehyde-free with built-in kraft paper vapor retarder","Available in R-11 through R-49 for walls, floors, and attics","Class A fire rated — won't rot, mildew, or deteriorate","GREENGUARD Gold Certified for indoor air quality","Reduces sound transmission between rooms","Pre-cut batts for standard 16\" and 24\" framing"];
      var FG_FOOTER="Both meet the same ASTM C665 industry standards — no difference in protection regardless of which brand is installed.";

      // ── FOAM BOX ──
      var FM_TITLE="Enverge® Spray Foam Systems";
      var FM_SUB="";
      var FM_BULLETS=["OPEN CELL — EasySeal .5:  R-3.8/in · 0.5 lb/ft³ · air barrier at 3.5\" · UL Certified · ENERGY STAR® qualified","CLOSED CELL — NexSeal:  R-7.2/in (R-28 @ 4\") · 2.1 lb/ft³ · adds structural rigidity · built-in Class II vapor retarder at 1.6\"","Both: Class 1 (Class A) fire rated — Flame Spread <25, Smoke Developed <450","Both: Low VOC — CA Section 01350 compliant · Fungi resistant (ASTM C-1338)","Both: Service temp range: -40°F to 180°F (220°F intermittent)","Closed cell water absorption <0.3% by volume — moisture resistant"];

      function drawProductBox(bx,by,bw,title,sub,intro,bullets,footer){
        var lh=10;var fs=7;
        doc.setFont("helvetica","normal");doc.setFontSize(fs);
        var introLines=intro?doc.splitTextToSize(intro,bw-16).length:0;
        var bulletLines=bullets.reduce(function(n,b){return n+doc.splitTextToSize(b,bw-24).length;},0);
        var footerLines=footer?doc.splitTextToSize(footer,bw-16).length:0;
        var bh=8+10+7+4+(introLines?introLines*lh+5:0)+(bulletLines*lh+bullets.length*2)+(footerLines?footerLines*lh+8:0)+8;
        doc.setFillColor(248,250,255);doc.roundedRect(bx,by,bw,bh,4,4,"F");

        doc.setDrawColor(210,220,240);doc.setLineWidth(0.4);doc.roundedRect(bx,by,bw,bh,4,4,"S");
        var ty=by+9;
        doc.setFont("helvetica","bold");doc.setFontSize(8.5);doc.setTextColor(NAVY[0],NAVY[1],NAVY[2]);
        doc.text(title,bx+9,ty);ty+=10;
        if(sub){doc.setFont("helvetica","bold");doc.setFontSize(fs);doc.setTextColor(BLUE[0],BLUE[1],BLUE[2]);doc.text(sub,bx+9,ty);ty+=7;}
        if(intro){
          doc.setFont("helvetica","italic");doc.setFontSize(fs);doc.setTextColor(GRAY[0],GRAY[1],GRAY[2]);
          var il=doc.splitTextToSize(intro,bw-16);doc.text(il,bx+9,ty);ty+=il.length*lh+5;
        }
        doc.setFont("helvetica","normal");doc.setFontSize(fs);doc.setTextColor(BLACK[0],BLACK[1],BLACK[2]);
        bullets.forEach(function(b){
          var bl=doc.splitTextToSize(b,bw-24);
          doc.setFillColor(BLUE[0],BLUE[1],BLUE[2]);doc.circle(bx+14,ty-2,1.5,"F");
          doc.text(bl,bx+20,ty);ty+=bl.length*lh+2;
        });
        if(footer){
          ty+=3;doc.setDrawColor(210,220,240);doc.setLineWidth(0.3);doc.line(bx+9,ty,bx+bw-9,ty);ty+=6;
          doc.setFont("helvetica","italic");doc.setFontSize(6.5);doc.setTextColor(GRAY[0],GRAY[1],GRAY[2]);
          var fl=doc.splitTextToSize(footer,bw-16);doc.text(fl,bx+9,ty);
        }
        return by+bh;
      }

      // Section label
      doc.setFont("helvetica","bold");doc.setFontSize(8);doc.setTextColor(GRAY[0],GRAY[1],GRAY[2]);
      doc.text("PRODUCT INFORMATION",leftX,py+10);
      doc.setDrawColor(BLUE[0],BLUE[1],BLUE[2]);doc.setLineWidth(0.5);doc.line(leftX,py+13,x+RW,py+13);
      py+=20;
      drawProductBox(leftX,py,colW,FG_TITLE,FG_SUB,FG_INTRO,FG_BULLETS,FG_FOOTER);
      drawProductBox(rightX,py,colW,FM_TITLE,FM_SUB,"",FM_BULLETS,"");
    }

    // ── FOOTER ──
    doc.setFillColor(NAVY[0],NAVY[1],NAVY[2]);
    doc.rect(0,756,W,36,"F");
    doc.setFillColor(BLUE[0],BLUE[1],BLUE[2]);doc.rect(0,756,W,3,"F");
    doc.setTextColor(180,200,240);doc.setFontSize(8);doc.setFont("helvetica","normal");
    doc.text("Insulation Services of Tulsa  •  1 (918) 232-9055  •  Helping Oklahoma stay energy efficient — one home at a time.",W/2,771,{align:"center"});
    doc.setTextColor(100,130,180);doc.setFontSize(7);
    doc.text("Licensed & Insured  •  Proudly serving Tulsa and Northeastern Oklahoma",W/2,782,{align:"center"});

    var filename="Quote"+(customer.jobAddress||customer.address?" - "+(customer.jobAddress||customer.address):"")+".pdf";
    if(outputMode==="save"){doc.save(filename);return null;}
    return doc.output("blob");
  });
}

function shareQuote(customer,opts,salesman,showProductInfo){
  buildQuotePdf(customer,opts,salesman,"blob",showProductInfo).then(function(blob){
    if(blob){
      var filename="Quote"+(customer.jobAddress||customer.address?" - "+(customer.jobAddress||customer.address):"")+".pdf";
      sharePdfBlob(blob,filename);
    }
  }).catch(function(err){alert("PDF error: "+err.message);});
}

function buildTakeOffPdf(customer,jobNotes,measurements,salesman,quoteOpts,outputMode){
  return import("jspdf").then(function(mod){
    var jsPDF=mod.jsPDF||mod.default;
    var doc=new jsPDF({unit:"pt",format:"letter"});
    var W=612,M=36,x=M,RW=W-M*2;
    var today=new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});
    var NAVY=[15,30,70],BLUE=[37,99,235],LIGHTBLUE=[219,234,254],GRAY=[100,116,139],WHITE=[255,255,255],BLACK=[15,23,42];

    // ── HEADER ──
    doc.setFillColor(NAVY[0],NAVY[1],NAVY[2]);doc.rect(0,0,W,56,"F");
    doc.setFillColor(BLUE[0],BLUE[1],BLUE[2]);doc.rect(0,52,W,4,"F");
    doc.setTextColor(WHITE[0],WHITE[1],WHITE[2]);doc.setFontSize(16);doc.setFont("helvetica","bold");
    doc.text("INSULATION SERVICES OF TULSA",M,30);
    doc.setFontSize(9);doc.setFont("helvetica","normal");doc.setTextColor(180,200,240);
    doc.text((customer.name||"")+(customer.jobAddress||customer.address?" — "+(customer.jobAddress||customer.address):""),M,46);
    doc.setTextColor(LIGHTBLUE[0],LIGHTBLUE[1],LIGHTBLUE[2]);doc.setFontSize(9);doc.setFont("helvetica","bold");
    doc.text("TAKE OFF  •  "+today,W-M,38,{align:"right"});

    var y=72;

    // ── MEASUREMENTS TABLE ──
    var hasMeasurements=measurements&&measurements.some(function(r){return parseFloat(r.sqft)>0;});
    if(hasMeasurements){
      // Columns: LOCATION | MATERIAL | SQ FT | $/SQ FT
      var c1=x+10,c2=x+180,c3=x+340,c4=x+420;
      doc.setFillColor(NAVY[0],NAVY[1],NAVY[2]);doc.rect(x,y,RW,18,"F");
      doc.setTextColor(LIGHTBLUE[0],LIGHTBLUE[1],LIGHTBLUE[2]);doc.setFontSize(8);doc.setFont("helvetica","bold");
      doc.text("LOCATION",c1,y+12);doc.text("MATERIAL",c2,y+12);doc.text("SQ FT",c3,y+12);doc.text("$/SQ FT",c4,y+12);
      y+=18;
      // Group by location+material+cavityWidth
      var groups2=[];
      measurements.forEach(function(r){
        var sqft=parseFloat(r.sqft)||0;if(!sqft)return;
        var matLabel=(r.matNote&&r.matNote.trim())||r.material||"";
        var key=(r.locationId||r.location)+"|"+matLabel+"|"+(r.cavityWidth||"");
        var g=groups2.find(function(gg){return gg.key===key;});
        if(g){g.entries.push(r);g.totalSqft+=sqft;}
        else groups2.push({key:key,location:(r.location||"")+(r.cavityWidth?" ("+r.cavityWidth+")":""),material:matLabel,pricePerUnit:r.pricePerUnit,entries:[r],totalSqft:sqft});
      });
      // Sort: foam first (no R-number), then by R-value, attics last
      var atticLocIds=["attic_area_garage","attic_area_house"];
      function takeoffR(g){var m=String(g.material||"");var n=m.match(/(\d+)/);return n?parseInt(n[1],10):0;}
      function isFoamG(g){return /foam|open cell|closed cell/i.test(g.material||"");}
      function isAtticG(g){return atticLocIds.some(function(id){return (g.entries[0]&&g.entries[0].locationId===id);});}
      groups2.sort(function(a,b){
        var aAttic=isAtticG(a),bAttic=isAtticG(b);
        if(aAttic!==bAttic) return aAttic?1:-1;
        var aFoam=isFoamG(a),bFoam=isFoamG(b);
        if(aFoam!==bFoam) return aFoam?-1:1;
        return takeoffR(a)-takeoffR(b);
      });

      groups2.forEach(function(g,gi){
        var DIM_H=14;
        // Measure how many lines the location text needs
        doc.setFont("helvetica","bold");doc.setFontSize(9.5);
        var locLines=doc.splitTextToSize(g.location,164).length;
        var ROW_H=Math.max(20,locLines*12+8);
        var groupH=ROW_H+g.entries.length*DIM_H+4;
        if(y+groupH>720){doc.addPage();y=40;}
        doc.setFillColor(gi%2===0?242:250,gi%2===0?246:252,gi%2===0?255:255);
        doc.rect(x,y,RW,groupH,"F");
        doc.setFillColor(BLUE[0],BLUE[1],BLUE[2]);doc.rect(x,y,3,groupH,"F");
        // Header row
        doc.setTextColor(BLACK[0],BLACK[1],BLACK[2]);doc.setFont("helvetica","bold");doc.setFontSize(9.5);
        doc.text(g.location,c1+4,y+13,{maxWidth:164,lineHeightFactor:1.4});
        doc.text(g.material,c2,y+13,{maxWidth:154});
        doc.text(g.totalSqft.toLocaleString(),c3,y+13);
        var ppu=parseFloat(g.pricePerUnit)||0;
        if(ppu)doc.text("$"+ppu.toFixed(2),c4,y+13);
        y+=ROW_H;
        // Individual dim entries
        g.entries.forEach(function(r){
          doc.setFont("helvetica","normal");doc.setFontSize(8.5);doc.setTextColor(GRAY[0],GRAY[1],GRAY[2]);
          var dimLabel=r.dimStr||(r.wallHeightLabel)||"";
          var sqftLabel=(parseFloat(r.sqft)||0).toLocaleString()+" sf";
          doc.text(dimLabel?dimLabel+" = "+sqftLabel:sqftLabel,c1+12,y+10);
          y+=DIM_H;
        });
        doc.setDrawColor(210,220,240);doc.setLineWidth(0.5);doc.line(x,y+2,x+RW,y+2);
        y+=6;
      });
    }

    // ── JOB NOTES ──
    if(jobNotes&&jobNotes.trim()){
      y+=8;
      var noteLines=doc.splitTextToSize(jobNotes.trim(),RW-24);
      var noteBlockH=noteLines.length*13+20;
      if(y+noteBlockH>720){doc.addPage();y=40;}
      doc.setFillColor(249,249,249);doc.rect(x,y,RW,noteBlockH,"F");
      doc.setDrawColor(200,210,230);doc.setLineWidth(0.5);doc.rect(x,y,RW,noteBlockH,"S");
      doc.setFillColor(NAVY[0],NAVY[1],NAVY[2]);doc.rect(x,y,3,noteBlockH,"F");
      doc.setTextColor(GRAY[0],GRAY[1],GRAY[2]);doc.setFontSize(8);doc.setFont("helvetica","bold");
      doc.text("JOB NOTES",x+10,y+12);
      doc.setFont("helvetica","normal");doc.setFontSize(9);doc.setTextColor(BLACK[0],BLACK[1],BLACK[2]);
      doc.text(noteLines,x+10,y+24);
      y+=noteBlockH+6;
    }

    var filename="TakeOff"+(customer.jobAddress||customer.address?" - "+(customer.jobAddress||customer.address):"")+".pdf";
    if(outputMode==="save"){doc.save(filename);return null;}
    return doc.output("blob");
  });
}

function shareTakeOff(customer,jobNotes,measurements,salesman,quoteOpts){
  buildTakeOffPdf(customer,jobNotes,measurements,salesman,quoteOpts,"blob").then(function(blob){
    if(blob){
      var filename="TakeOff"+(customer.jobAddress||customer.address?" - "+(customer.jobAddress||customer.address):"")+".pdf";
      sharePdfBlob(blob,filename);
    }
  }).catch(function(err){alert("PDF error: "+err.message);});
}

function printTakeOff(customer,jobNotes,measurements,salesman,quoteOpts){
  buildTakeOffPdf(customer,jobNotes,measurements,salesman,quoteOpts,"save").catch(function(err){alert("PDF error: "+err.message);});
}

function buildQuoteHtml(customer,opts,salesman){try{return _buildQuoteHtml(customer,opts,salesman);}catch(e){alert("Quote error: "+e.message);return "";}}
function _buildQuoteHtml(customer,opts,salesman){
  var today=new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});var qn="IST-"+Date.now().toString(36).toUpperCase();
  var si=SALESMAN_INFO[salesman];
  var salesHtml=si?'<div style="flex:1;text-align:right"><div style="font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px">Your Sales Rep</div><div style="font-size:15px;font-weight:800;color:#111;margin-bottom:3px">'+si.fullName+'</div><div style="font-size:13px;color:#111;font-weight:600;margin-bottom:1px">'+si.phone+'</div><div style="font-size:13px;color:#111;font-weight:600">'+si.email+'</div></div>':'';
  var optsWithItems=opts.filter(function(o){return o.items.length>0;});
  var optSections=optsWithItems.map(function(opt,oi){
    var sortedItems=opt.items.slice().sort(function(a,b){
      var aFoam=a.type==="Foam"||/foam/i.test(a.material||"");
      var bFoam=b.type==="Foam"||/foam/i.test(b.material||"");
      if(aFoam&&!bFoam)return -1;
      if(!aFoam&&bFoam)return 1;
      if(aFoam&&bFoam){
        var aIn=parseFloat((a.material||"").match(/^([\d.]+)/)||[0,0])||0;
        var bIn=parseFloat((b.material||"").match(/^([\d.]+)/)||[0,0])||0;
        return aIn-bIn;
      }
      var aR=parseInt((a.material||"").match(/R(\d+)/i)||[0,0])||0;
      var bR=parseInt((b.material||"").match(/R(\d+)/i)||[0,0])||0;
      return aR-bR;
    });
    var rows=sortedItems.map(function(item,i){return '<tr style="border-bottom:1px solid #ddd"><td style="padding:6px 8px;font-size:13px">'+(i+1)+'</td><td style="padding:6px 8px;font-size:13px">'+item.description+'</td></tr>';}).join("");
    var energySealRow=opt.energySeal?'<tr style="border-bottom:1px solid #ddd"><td style="padding:6px 8px;font-size:13px">'+(opt.items.length+1)+'</td><td style="padding:6px 8px;font-size:13px">Energy seal and plates per city code.</td></tr>':"";
    var customRows=(opt.customItems||[]).map(function(ci,ci_i){return '<tr style="border-bottom:1px solid #ddd"><td style="padding:6px 8px;font-size:13px">'+(opt.items.length+(opt.energySeal?1:0)+ci_i+1)+'</td><td style="padding:6px 8px;font-size:13px">'+ci.description+'</td></tr>';}).join("");
    var lineTotal=opt.items.reduce(function(s,i){return s+i.total;},0);
    var psoCredit=((opt.pso||false)?600:0)+((opt.psoKw||false)?525:0);
    var el=opt.extraLabor?(parseFloat(opt.extraLaborAmt)||0):0;
    var tc=opt.tripCharge?(parseFloat(opt.tripChargeAmt)||0):0;
    var es=opt.energySeal?(parseFloat(opt.energySealAmt)||0):0;
    var du=opt.dumpster?(parseFloat(opt.dumpsterAmt)||0):0;
    var ciTotal=(opt.customItems||[]).reduce(function(s,x){return s+(parseFloat(x.price)||0);},0);
    var sub=lineTotal+el+tc+es+du+ciTotal;
    var total=opt.overrideTotal!==""?(parseFloat(opt.overrideTotal)||0):(sub-psoCredit);
    var header=optsWithItems.length>1?'<div style="font-size:16px;font-weight:800;color:#111;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #111">'+opt.name+'</div>':"";
    var totalLabel=optsWithItems.length>1?opt.name+" Total":"Total";
    var totalHtml="";
    var creditRows="";
    if(opt.psoKw)creditRows+='<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:14px;font-weight:600;color:#dc2626;border-bottom:1px solid #ddd"><span>Less PSO Credit KW</span><span>-$525</span></div>';
    if(opt.pso)creditRows+='<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:14px;font-weight:600;color:#dc2626;border-bottom:1px solid #ddd"><span>Less PSO Credit Attic</span><span>-$600</span></div>';
    if(opt.pso||opt.psoKw){
      totalHtml='<div style="display:flex;justify-content:flex-end;margin-bottom:'+(oi<optsWithItems.length-1?"20":"0")+'px"><div style="width:260px">'+
        '<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:14px;font-weight:600;color:#333"><span>Price</span><span>$'+Math.ceil(sub).toLocaleString()+'</span></div>'+
        creditRows+
        '<div style="display:flex;justify-content:space-between;padding:8px 0;font-size:18px;font-weight:800;color:#111"><span>'+totalLabel+'</span><span>$'+Math.ceil(total).toLocaleString()+'</span></div>'+
        '</div></div>';
    }else{
      totalHtml='<div style="display:flex;justify-content:flex-end;margin-bottom:'+(oi<optsWithItems.length-1?"20":"0")+'px"><div style="width:260px"><div style="display:flex;justify-content:space-between;padding:8px 0;font-size:18px;font-weight:800;color:#111"><span>'+totalLabel+'</span><span>$'+Math.ceil(total).toLocaleString()+'</span></div></div></div>';
    }
    return header+'<table style="width:100%;border-collapse:collapse;margin-bottom:10px"><thead><tr style="background:#111"><th style="padding:7px 8px;font-size:11px;font-weight:700;text-transform:uppercase;text-align:left;color:#fff">#</th><th style="padding:7px 8px;font-size:11px;font-weight:700;text-transform:uppercase;text-align:left;color:#fff">Description</th></tr></thead><tbody>'+rows+energySealRow+customRows+'</tbody></table>'+totalHtml;
  }).join("");
  return '<div style="font-family:Arial,sans-serif;color:#1a1a1a;padding:24px;max-width:100%;margin:0;width:100%;box-sizing:border-box">'+
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;padding-bottom:14px;border-bottom:3px solid #222"><div><h1 style="font-size:22px;font-weight:800;color:#111;margin-bottom:3px">'+COMPANY.name+'</h1><p style="font-size:12px;color:#666">'+COMPANY.tagline+'</p><p style="font-size:12px;color:#666">'+COMPANY.phone+'</p></div><div style="text-align:right"><div style="font-size:19px;font-weight:700;color:#111">QUOTE</div><div style="font-size:12px;color:#666;margin-top:3px">'+qn+'</div><div style="font-size:12px;color:#666">'+today+'</div></div></div>'+
    '<div style="display:flex;gap:20px;margin-bottom:18px"><div style="flex:1"><div style="font-size:10px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px">Prepared For</div><div style="font-size:14px;font-weight:600">'+(customer.name||"—")+'</div><div style="font-size:12px;color:#666">'+(customer.address||"")+'</div><div style="font-size:12px;color:#666">'+(customer.phone||"")+'</div><div style="font-size:12px;color:#666">'+(customer.email||"")+'</div></div><div style="flex:1"><div style="font-size:10px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px">Project</div><div style="font-size:12px;color:#666">Job Site: '+(customer.jobAddress||customer.address||"—")+'</div><div style="font-size:12px;color:#666">Valid 30 days from quote date</div></div>'+salesHtml+'</div>'+
    optSections+
    '<div style="margin-top:14px;padding-top:12px;border-top:1px solid #ddd;font-size:11px;color:#999;text-align:center">'+COMPANY.name+' &bull; '+COMPANY.phone+'<br/>Helping Oklahoma stay energy efficient—one home at a time.</div></div>';
}

function generatePDF(customer,opts,salesman,showProductInfo){
  buildQuotePdf(customer,opts,salesman,"save",showProductInfo).catch(function(err){alert("PDF error: "+err.message);});
}

function printQuoteAndTakeOff(customer,opts,salesman,jobNotes,measurements,quoteOpts,showProductInfo){
  // Build both PDFs then merge pages into one jsPDF doc
  Promise.all([
    buildQuotePdf(customer,opts,salesman,"blob",showProductInfo),
    buildTakeOffPdf(customer,jobNotes,measurements,salesman,quoteOpts,"blob")
  ]).then(function(blobs){
    // Open quote PDF first, then takeoff as separate share — or just share both
    var quoteName="Quote"+(customer.jobAddress||customer.address?" - "+(customer.jobAddress||customer.address):"")+".pdf";
    var takeoffName="TakeOff"+(customer.jobAddress||customer.address?" - "+(customer.jobAddress||customer.address):"")+".pdf";
    var files=[];
    if(blobs[0])files.push(new File([blobs[0]],quoteName,{type:"application/pdf"}));
    if(blobs[1])files.push(new File([blobs[1]],takeoffName,{type:"application/pdf"}));
    if(navigator.canShare&&navigator.canShare({files:files})){
      navigator.share({files:files,title:"Quote & Take Off"}).catch(function(){});
    } else {
      // fallback: download both
      files.forEach(function(f){
        var url=URL.createObjectURL(f);var a=document.createElement("a");a.href=url;a.download=f.name;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(url);document.body.removeChild(a);},1000);
      });
    }
  }).catch(function(err){alert("PDF error: "+err.message);});
}

/* ══════════ TAKE OFF ══════════ */

function TakeOff(p){
  var ls=useState(""),lid=ls[0],setLid=ls[1];
  var cs=useState(""),cl=cs[0],setCl=cs[1];
  function addM(item){
    p.setMeasurements(function(prev){
      return prev.concat([Object.assign({},item,{id:Date.now()+Math.random()})]);
    });
  }
  function removeM(id){p.setMeasurements(function(prev){return prev.filter(function(m){return m.id!==id;});});}
  var regularItems=p.measurements.filter(function(m){return !m.isRemoval;});
  var removalItems=p.measurements.filter(function(m){return m.isRemoval;});
  var groups=groupMeasurements(regularItems);var sorted=GROUP_ORDER.filter(function(g){return groups[g];});
  var total=p.measurements.reduce(function(s,m){return s+m.sqft;},0);
  var removalTotal=removalItems.reduce(function(s,m){return s+m.sqft;},0);
  return(<div>
    <CustomerInfo custName={p.custName} setCustName={p.setCustName} custAddr={p.custAddr} setCustAddr={p.setCustAddr} custPhone={p.custPhone} setCustPhone={p.setCustPhone} custEmail={p.custEmail} setCustEmail={p.setCustEmail} jobAddr={p.jobAddr} setJobAddr={p.setJobAddr} currentUser={p.currentUser}/>
    {/* Row 1: Location (left) | Measurement inputs (right) */}
    <div className="ist-2col" style={{marginBottom:0}}>
      <div className="ist-col-form">
        <div style={{padding:"0 16px 12px"}}>
          <div style={{fontSize:11,fontWeight:700,color:C.accent,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>{"① Location"}</div>
          <LocationGrid pulse={!lid} value={lid} onChange={function(v){setLid(v);}}/>
          {lid==="custom"&&(<div style={{marginTop:8}}><QV_Input label="Custom Location Name" value={cl} onChange={setCl} type="text" placeholder="e.g. Bonus room walls"/></div>)}
        </div>
      </div>
      <div className="ist-col-results">
        <div style={{padding:"0 16px 12px"}}>
          <div style={{fontSize:11,fontWeight:700,color:C.accent,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>{"② Measure & Add"}</div>
          <MeasurementForm key={"to-takeoff"} lid={lid} setLid={setLid} cl={cl} setCl={setCl} tab={"fiberglass"} onAdd={addM} hasPrice={false} hideLocation/>
        </div>
      </div>
    </div>

    {/* Row 2: Job Notes (left) | Takeoff list (right) */}
    <div className="ist-2col" style={{alignItems:"flex-start"}}>

      {/* Left: Job Notes + Print/Share */}
      <div className="ist-col-form">
        <div style={{padding:"0 16px 12px"}}>
          <div style={{fontSize:11,fontWeight:700,color:C.accent,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>{"Job Notes"}</div>
          <textarea style={{width:"100%",padding:"10px 12px",background:C.input,border:"1px solid "+C.inputBorder,borderRadius:6,color:C.text,fontSize:14,fontFamily:"'Inter',sans-serif",outline:"none",boxSizing:"border-box",minHeight:80,resize:"vertical",transition:"border-color 0.15s"}} onFocus={function(e){e.target.style.borderColor=C.accent;}} onBlur={function(e){e.target.style.borderColor=C.inputBorder;}} value={p.jobNotes} onChange={function(e){p.setJobNotes(e.target.value);}} placeholder="e.g. 2-story, 4/12 pitch, no garage..."/>
        </div>
        <div style={{padding:"0 16px"}}>
          <GreenBtn onClick={function(){var cust={name:p.custName,address:p.custAddr,phone:p.custPhone,email:p.custEmail,jobAddress:p.jobAddr||p.custAddr};printTakeOff(cust,p.jobNotes,p.measurements,p.currentUser,p.quoteOpts);}}>{"Print Take Off"}</GreenBtn>
          <GreenBtn mt={8} onClick={function(){var cust={name:p.custName,address:p.custAddr,phone:p.custPhone,email:p.custEmail,jobAddress:p.jobAddr||p.custAddr};shareTakeOff(cust,p.jobNotes,p.measurements,p.currentUser,p.quoteOpts);}}>{"Share Take Off"}</GreenBtn>
          {p.measurements.length>0&&(<>
            <GreenBtn mt={8} onClick={p.onSendToQuote}>{"Send to Quote Builder"}</GreenBtn>
            <GreenBtn mt={8} onClick={p.onSendToWorkOrder}>{"Send to Work Order"}</GreenBtn>
            <button onClick={function(){if(confirm("Clear all measurements?"))p.setMeasurements([]);}} style={{width:"100%",marginTop:8,padding:"10px",borderRadius:6,border:"1px solid "+C.danger,background:"transparent",color:C.danger,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'Inter',sans-serif",textTransform:"uppercase"}}>{"Clear All"}</button>
          </>)}
        </div>
      </div>

      {/* Right: Takeoff list */}
      <div className="ist-col-results">
        <div style={{padding:"0 16px"}}>
        {p.measurements.length>0&&(<div>
          <div style={{fontSize:12,fontWeight:700,color:C.accent,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:14}}>{"Take Off ("+p.measurements.length+" items · "+total.toLocaleString()+" sq ft)"}</div>
          {sorted.map(function(gn){var gt=groups[gn].reduce(function(s,m){return s+m.sqft;},0);
            return(<div key={gn} style={{marginBottom:16}}>
              <div style={{fontSize:11,fontWeight:700,color:C.dim,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8,paddingBottom:6,borderBottom:"1px solid "+C.border}}>{gn}<span style={{color:C.accent,marginLeft:8}}>{gt.toLocaleString()+" sq ft"}</span></div>
              <div style={{background:"rgba(255,255,255,0.06)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",borderRadius:10,border:"1px solid rgba(255,255,255,0.1)",overflow:"hidden",boxShadow:"0 4px 24px rgba(0,0,0,0.4)"}}>
                {groups[gn].map(function(item,idx){return(<div key={item.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",borderBottom:idx<groups[gn].length-1?"1px solid "+C.borderLight:"none"}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:600,lineHeight:1.3,color:C.text}}>{item.location}</div>
                    {item.wallHeightLabel&&(<div style={{fontSize:12,color:C.accent,marginTop:2,fontWeight:500}}>{"↳ "+item.wallHeightLabel}</div>)}
                    {item.cavityWidth&&(<div style={{fontSize:12,color:C.textSec,marginTop:2,fontWeight:500}}>{"↳ "+item.cavityWidth+" cavity"}</div>)}
                    {item.matNote&&(<div style={{fontSize:12,color:C.dim,marginTop:2}}>{"📋 "+item.matNote}</div>)}
                    {item.pitch&&(<div style={{fontSize:12,color:C.dim,marginTop:2}}>{item.pitch}</div>)}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:12,marginLeft:12}}><div style={{fontSize:14,fontWeight:700,color:C.text}}>{item.sqft.toLocaleString()+" sf"}</div><button onClick={function(){removeM(item.id);}} style={{background:"none",border:"none",color:C.danger,fontSize:11,cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:600}}>{"Remove"}</button></div>
                </div>);})}
              </div>
            </div>);
          })}
          {removalItems.length>0&&(<div style={{marginBottom:16}}>
            <div style={{fontSize:11,fontWeight:700,color:C.danger,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8,paddingBottom:6,borderBottom:"1px solid "+C.danger}}>{"Removal"}<span style={{color:C.danger,marginLeft:8}}>{removalTotal.toLocaleString()+" sq ft"}</span></div>
            <div style={{background:C.card,borderRadius:6,border:"1px solid "+C.danger,overflow:"hidden",boxShadow:C.shadow}}>
              {removalItems.map(function(item,idx){return(<div key={item.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",borderBottom:idx<removalItems.length-1?"1px solid "+C.borderLight:"none"}}>
                <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,lineHeight:1.3,color:C.text}}>{item.location}</div></div>
                <div style={{display:"flex",alignItems:"center",gap:12,marginLeft:12}}><div style={{fontSize:14,fontWeight:700,color:C.text}}>{item.sqft.toLocaleString()+" sf"}</div><button onClick={function(){removeM(item.id);}} style={{background:"none",border:"none",color:C.danger,fontSize:11,cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:600}}>{"Remove"}</button></div>
              </div>);})}
            </div>
          </div>)}
        </div>)}
        {p.measurements.length===0&&(<div style={{textAlign:"center",padding:"40px 16px",color:C.dim}}><div style={{fontSize:14}}>{"Start measuring — add locations above"}</div></div>)}
        </div>
      </div>
    </div>{/* end row 2 */}
  </div>);
}

/* ══════════ QUOTE BUILDER ══════════ */

function newOption(name){return{name:name,items:[],pso:false,psoKw:false,extraLabor:false,extraLaborAmt:"",tripCharge:false,tripChargeAmt:"",energySeal:false,energySealAmt:"",dumpster:false,dumpsterAmt:"",customItems:[],overrideTotal:""};}

function QuoteBuilderSection(p){
  var s1=useState("fiberglass"),matTab=s1[0],setMatTab=s1[1];
  var s2=useState(null),pricingId=s2[0],setPricingId=s2[1];
  var s3=useState(""),pricingPrice=s3[0],setPricingPrice=s3[1];
  var s12=useState(""),pricingMat=s12[0],setPricingMat=s12[1];
  var s13=useState(0),activeIdx=s13[0],setActiveIdx=s13[1];
  var s14=useState(false),editingName=s14[0],setEditingName=s14[1];
  var ls=useState(""),lid=ls[0],setLid=ls[1];
  var cs=useState(""),cl=cs[0],setCl=cs[1];

  var opts=p.quoteOpts;var setOpts=p.setQuoteOpts;
  if(activeIdx>=opts.length)setActiveIdx(0);
  var opt=opts[activeIdx]||newOption("Option 1");

  function updateOpt(changes){setOpts(function(prev){return prev.map(function(o,i){return i===activeIdx?Object.assign({},o,changes):o;});});}
  function addItem(item){
    var existing=opt.items.find(function(i){return i.description===item.description;});
    if(existing){
      var newSqft=existing.sqft+item.sqft;
      var newTotal=Math.ceil(newSqft*existing.pricePerUnit);
      updateOpt({items:opt.items.map(function(i){return i.id===existing.id?Object.assign({},i,{sqft:newSqft,total:newTotal}):i;}),overrideTotal:""});
    }else{
      updateOpt({items:opt.items.concat([Object.assign({},item,{id:Date.now()+Math.random()})]),overrideTotal:""});
    }
  }
  function removeItem(id){updateOpt({items:opt.items.filter(function(i){return i.id!==id;}),overrideTotal:""});}

  var unpriced=p.importedItems.filter(function(i){return!i.priced;});
  var lineItemsTotal=opt.items.reduce(function(s,i){return s+i.total;},0);
  var psoCredit=((opt.pso||false)?600:0)+((opt.psoKw||false)?525:0);
  var extraLabor=opt.extraLabor?(parseFloat(opt.extraLaborAmt)||0):0;
  var tripCharge=opt.tripCharge?(parseFloat(opt.tripChargeAmt)||0):0;
  var energySeal=opt.energySeal?(parseFloat(opt.energySealAmt)||0):0;
  var dumpster=opt.dumpster?(parseFloat(opt.dumpsterAmt)||0):0;
  var customItemsTotal=(opt.customItems||[]).reduce(function(s,ci){return s+(parseFloat(ci.price)||0);},0);
  var subtotal=lineItemsTotal-psoCredit+extraLabor+tripCharge+energySeal+dumpster+customItemsTotal;
  var finalTotal=opt.overrideTotal!==""?(parseFloat(opt.overrideTotal)||0):subtotal;
  var matSs={width:"100%",padding:"8px 10px",background:C.input,border:"1px solid "+C.inputBorder,borderRadius:6,color:C.text,fontSize:13,fontFamily:"'Inter',sans-serif",outline:"none",boxSizing:"border-box",WebkitAppearance:"none",marginBottom:8};

  function handlePriceImport(item){var pr=parseFloat(pricingPrice)||0;if(pr<=0||!pricingMat)return;
    var isRem=pricingMat==="Removal";
    var desc=isRem?("Remove existing insulation from "+item.location.toLowerCase()+"."):("Install "+pricingMat.toLowerCase()+" in "+item.location.toLowerCase());
    addItem(Object.assign({},item,{material:pricingMat,pricePerUnit:pr,total:Math.ceil(item.sqft*pr),description:desc}));
    p.setImportedItems(function(prev){return prev.map(function(i){return i.id===item.id?Object.assign({},i,{priced:true}):i;});});
    setPricingId(null);setPricingPrice("");setPricingMat("");}

  function addOption(){setOpts(function(prev){return prev.concat([newOption("Option "+(prev.length+1))]);});setActiveIdx(opts.length);}
  function removeOption(idx){if(opts.length<=1)return;setOpts(function(prev){return prev.filter(function(_,i){return i!==idx;});});if(activeIdx>=opts.length-1)setActiveIdx(Math.max(0,opts.length-2));}

  var qs1=useState(false),locOpen=qs1[0],setLocOpen=qs1[1];
  var cid1=useState(""),customDesc=cid1[0],setCustomDesc=cid1[1];
  var cid2=useState(""),customPrice=cid2[0],setCustomPrice=cid2[1];
  var accordionBtn=function(label,open,setOpen,badge){return(<button onClick={function(){setOpen(!open);}} style={{width:"100%",padding:"10px 14px",background:"#1e293b",display:"flex",justifyContent:"space-between",alignItems:"center",borderRadius:open?"8px 8px 0 0":"8px",border:"none",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
    <span style={{fontSize:12,fontWeight:800,color:"#fff",textTransform:"uppercase",letterSpacing:0.8}}>{label}</span>
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      {badge&&<span style={{fontSize:13,fontWeight:600,color:"#93c5fd"}}>{badge}</span>}
      <span style={{fontSize:13,color:"rgba(255,255,255,0.6)"}}>{open?"▲":"▼"}</span>
    </div>
  </button>);};

  return(<div>
    <CustomerInfo custName={p.custName} setCustName={p.setCustName} custAddr={p.custAddr} setCustAddr={p.setCustAddr} custPhone={p.custPhone} setCustPhone={p.setCustPhone} custEmail={p.custEmail} setCustEmail={p.setCustEmail} jobAddr={p.jobAddr} setJobAddr={p.setJobAddr} currentUser={p.currentUser}/>

    {/* ROW 1: Single collapsible — Location + Material & Measure side by side */}
    <div style={{padding:"0 16px 12px"}}>
      <div style={{background:"rgba(255,255,255,0.65)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",borderRadius:12,border:"1px solid rgba(255,255,255,0.8)",boxShadow:"0 4px 24px rgba(0,0,0,0.07)",overflow:"hidden"}}>
        {accordionBtn("📐 Add Item",locOpen,setLocOpen,lid&&LOCATIONS.find(function(l){return l.id===lid;})?(LOCATIONS.find(function(l){return l.id===lid;}).label):(lid==="custom"?cl:null))}
        {locOpen&&(<div className="ist-2col" style={{marginBottom:0}}>
          <div className="ist-col-form">
            <div style={{padding:"12px 14px"}}>
              <div style={{fontSize:11,fontWeight:700,color:C.accent,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>{"① Location"}</div>
              <LocationGrid value={lid} onChange={function(v){setLid(v);}}/>
              {lid==="custom"&&(<div style={{marginTop:8}}><QV_Input label="Custom Location Name" value={cl} onChange={setCl} type="text" placeholder="e.g. Bonus room walls"/></div>)}
            </div>
          </div>
          <div className="ist-col-results">
            <div style={{padding:"12px 14px"}}>
              <div style={{fontSize:11,fontWeight:700,color:C.accent,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>{"② Material & Measure"}</div>
              <MeasurementForm key={"qb-"+activeIdx} lid={lid} setLid={setLid} cl={cl} setCl={setCl} tab={matTab} onAdd={function(item){addItem(item);setLocOpen(false);}} hasPrice={true} hideLocation/>
            </div>
          </div>
        </div>)}
      </div>
    </div>

    {/* ROW 2: Full-width quote summary */}
    <div style={{padding:"0 16px"}}>

    {/* OPTION TABS */}
    <div style={{marginBottom:12}}>
      <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
        {opts.map(function(o,idx){return(
          <button key={idx} onClick={function(){setActiveIdx(idx);setPricingId(null);}}
            style={{padding:"8px 14px",borderRadius:6,border:activeIdx===idx?"2px solid "+C.accent:"1px solid "+C.border,background:activeIdx===idx?C.accentBg:C.card,color:activeIdx===idx?C.accent:C.dim,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
            {o.name}{o.items.length>0?" ("+o.items.length+")":""}
          </button>
        );})}
        <button onClick={addOption} style={{padding:"8px 12px",borderRadius:6,border:"1px dashed "+C.dim,background:"transparent",color:C.dim,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>{"+"}</button>
        <div style={{display:"flex",alignItems:"center",gap:8,marginLeft:8}}>
          {editingName?(<div style={{display:"flex",gap:6}}>
            <input style={{padding:"6px 10px",background:C.input,border:"1px solid "+C.accent,borderRadius:6,color:C.text,fontSize:13,fontFamily:"'Inter',sans-serif",outline:"none"}}
              type="text" value={opt.name} onChange={function(e){updateOpt({name:e.target.value});}} autoFocus
              onKeyDown={function(e){if(e.key==="Enter")setEditingName(false);}}/>
            <button onClick={function(){setEditingName(false);}} style={{padding:"6px 10px",background:C.accent,border:"none",borderRadius:6,color:"#fff",fontWeight:600,fontSize:12,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>{"OK"}</button>
          </div>):(<div style={{display:"flex",alignItems:"center",gap:8}}>
            <button onClick={function(){setEditingName(true);}} style={{background:"none",border:"none",color:C.dim,fontSize:11,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>{"Rename"}</button>
            {opts.length>1&&(<button onClick={function(){if(confirm("Delete \""+opt.name+"\"?"))removeOption(activeIdx);}} style={{background:"none",border:"none",color:C.danger,fontSize:11,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>{"Delete"}</button>)}
          </div>)}
        </div>
      </div>
    </div>

    {/* FROM TAKE OFF */}
    {unpriced.length>0&&(<div style={{marginBottom:16}}>
      <div style={{fontSize:12,fontWeight:700,color:C.accent,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:10}}>{"From Take Off — Price These ("+unpriced.length+")"}</div>
      <div style={{background:C.card,borderRadius:6,border:"1px solid "+C.border,overflow:"hidden"}}>
        {unpriced.map(function(item,idx){return(<div key={item.id} style={{padding:"12px 14px",borderBottom:idx<unpriced.length-1?"1px solid "+C.border:"none"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:C.text}}>{item.isRemoval?(<span><span style={{fontSize:10,fontWeight:700,color:C.danger,background:C.dangerBg,padding:"2px 6px",borderRadius:4,marginRight:6}}>{"REMOVAL"}</span>{item.location}</span>):item.location}</div><div style={{fontSize:12,color:C.dim,marginTop:2}}>{item.sqft.toLocaleString()+" sq ft"}{item.pitch?" · "+item.pitch:""}</div></div>
            <div style={{display:"flex",alignItems:"center",gap:6,marginLeft:12}}>
              {pricingId!==item.id&&(<button onClick={function(){setPricingId(item.id);setPricingMat(item.matNote||"");setPricingPrice("");}} style={{padding:"6px 14px",background:"transparent",border:"1px solid "+C.accent,borderRadius:6,color:C.accent,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'Inter',sans-serif",textTransform:"uppercase"}}>{"Price"}</button>)}
              <button onClick={function(){p.setImportedItems(function(prev){return prev.filter(function(i){return i.id!==item.id;});});}} style={{padding:"4px 6px",background:"none",border:"none",color:C.danger,fontSize:11,cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:600}}>{"Remove"}</button>
            </div>
          </div>
          {pricingId===item.id&&(function(){
            var PMBTNS=[
              {id:"R11",label:"R11",value:"R11 Fiberglass Batts",sub:null},
              {id:"R13",label:"R13",value:null,sub:[{id:"x15",label:"x15",value:"R13 x15 Fiberglass Batts"},{id:"x24",label:"x24",value:"R13 x24 Fiberglass Batts"}]},
              {id:"R19",label:"R19",value:null,sub:[{id:"x15",label:"x15",value:"R19 x15 Fiberglass Batts"},{id:"x24",label:"x24",value:"R19 x24 Fiberglass Batts"}]},
              {id:"R30",label:"R30",value:null,sub:[{id:"x15",label:"x15",value:"R30 x15 Fiberglass Batts"},{id:"x24",label:"x24",value:"R30 x24 Fiberglass Batts"}]},
              {id:"opencell",label:"Open Cell",value:null,sub:["2\"","3\"","4\"","5\"","6\""].map(function(v){return{id:v,label:v,value:v+' Open Cell Foam'};})},
              {id:"closedcell",label:"Closed Cell",value:null,sub:["1\"","2\"","3\""].map(function(v){return{id:v,label:v,value:v+' Closed Cell Foam'};})},
              {id:"blownfg",label:"Blown Fiberglass",value:null,sub:["R13","R15","R19","R22","R26","R30","R38","R44","R49","R60"].map(function(r){return{id:r,label:r,value:"Blown Fiberglass "+r};})},
              {id:"blowncel",label:"Blown Cellulose",value:null,sub:["R13","R15","R19","R22","R26","R30","R38","R44","R49","R60"].map(function(r){return{id:r,label:r,value:"Blown Cellulose "+r};})},
              {id:"removal",label:"Removal",value:"Removal",sub:null},
            ];
            var bs=function(active){return{padding:"7px 11px",borderRadius:8,border:active?"2px solid "+C.accent:"1px solid rgba(0,0,0,0.08)",background:active?"rgba(37,99,235,0.1)":"rgba(255,255,255,0.6)",color:active?C.accent:C.text,fontSize:12,fontWeight:active?700:500,cursor:"pointer",fontFamily:"'Inter',sans-serif",transition:"all 0.12s"};};
            var activePrimary=PMBTNS.find(function(b){return pricingMat&&(b.value===pricingMat||(b.sub&&b.sub.some(function(s){return s.value===pricingMat;})));});
            var activePrimaryId=activePrimary?activePrimary.id:"";
            return(<div style={{marginTop:10,padding:12,background:C.bg,borderRadius:8,border:"1px solid "+C.border}}>
              <div style={{fontSize:11,color:C.accent,fontWeight:600,marginBottom:8}}>{"Adding to: "+opt.name}</div>
              <div style={{fontSize:10,fontWeight:700,color:C.textSec,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>{"Material"}{!pricingMat&&<span style={{color:C.danger,marginLeft:4}}>{"*"}</span>}</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:6}}>
                {PMBTNS.map(function(b){
                  var active=activePrimaryId===b.id;
                  return(<button key={b.id} onClick={function(){if(b.value){setPricingMat(b.value);}else{setPricingMat("");}}} style={bs(active)}>{b.label}</button>);
                })}
              </div>
              {activePrimary&&activePrimary.sub&&(<div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8,paddingLeft:8,borderLeft:"3px solid "+C.accent}}>
                {activePrimary.sub.map(function(s){
                  return(<button key={s.id} onClick={function(){setPricingMat(s.value);}} style={bs(pricingMat===s.value)}>{s.label}</button>);
                })}
              </div>)}
              {pricingMat&&<div style={{fontSize:11,color:C.accent,fontWeight:600,marginBottom:8}}>{"✓ "+pricingMat}</div>}
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                <div style={{flex:1}}><QV_Input label="$/sf" value={pricingPrice} onChange={setPricingPrice} placeholder="0.00" step="0.01"/></div>
                <button onClick={function(){handlePriceImport(item);}} style={{padding:"8px 14px",background:C.accent,border:"none",borderRadius:6,color:"#fff",fontWeight:600,fontSize:12,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>{"Add"}</button>
                <button onClick={function(){setPricingId(null);setPricingPrice("");setPricingMat("");}} style={{padding:"8px 10px",background:"none",border:"1px solid "+C.dim,borderRadius:6,color:C.dim,fontSize:12,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>{"Cancel"}</button>
              </div>
            </div>);
          })()}
        </div>);})}
      </div>

    </div>)}

    {/* ADD MANUALLY */}
    {/* QUOTE TOTAL — pinned card */}
    {opt.items.length>0&&(<div style={{padding:"0 16px 16px"}}>
      <div style={{background:C.accent,borderRadius:10,padding:"18px 22px",display:"flex",justifyContent:"space-between",alignItems:"center",boxShadow:"0 4px 16px rgba(37,99,235,0.18)"}}>
        <div>
          <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.75)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4}}>{opt.name+" · "+opt.items.length+" item"+(opt.items.length!==1?"s":"")}</div>
          <div style={{fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.85)"}}>{"Estimated Total"}</div>
        </div>
        <div style={{fontSize:38,fontWeight:900,color:"#fff",letterSpacing:"-0.02em"}}>
          {"$"+(opt.overrideTotal!==""?(parseFloat(opt.overrideTotal)||0).toLocaleString():((opt.items.reduce(function(s,i){return s+i.total;},0)-((opt.pso||false)?600:0)-((opt.psoKw||false)?525:0)+(opt.extraLabor?(parseFloat(opt.extraLaborAmt)||0):0)+(opt.tripCharge?(parseFloat(opt.tripChargeAmt)||0):0)+(opt.energySeal?(parseFloat(opt.energySealAmt)||0):0)+(opt.dumpster?(parseFloat(opt.dumpsterAmt)||0):0))).toLocaleString())}
        </div>
      </div>
    </div>)}
    {/* ITEMS FOR ACTIVE OPTION */}
    {opt.items.length>0&&(<div style={{padding:"0 16px 20px"}}>
      <div style={{fontSize:12,fontWeight:700,color:C.accent,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:12}}>{opt.name+" — Items ("+opt.items.length+")"}</div>
      <div style={{background:C.card,borderRadius:6,padding:16,border:"1px solid "+C.border,boxShadow:C.shadow}}>
        {opt.items.map(function(item,idx){return(<div key={item.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:idx<opt.items.length-1?"1px solid "+C.border:"none"}}>
          <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,lineHeight:1.3,color:C.text}}>{item.description}</div><div style={{fontSize:12,color:C.dim,marginTop:2}}>{item.sqft.toLocaleString()+" sq ft"}{item.pitch?" · "+item.pitch:""}</div></div>
          <div style={{marginLeft:12}}><button onClick={function(){removeItem(item.id);}} style={{background:"none",border:"none",color:C.danger,fontSize:11,cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:600}}>{"REMOVE"}</button></div>
        </div>);})}

        {/* ADJUSTMENTS */}
        <div style={{paddingTop:12,marginTop:8,borderTop:"1px solid "+C.borderLight}}>
          <label style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",cursor:"pointer"}}>
            <input type="checkbox" checked={opt.pso} onChange={function(e){updateOpt({pso:e.target.checked,overrideTotal:""});}}
              style={{width:18,height:18,accentColor:C.accent,cursor:"pointer"}}/>
            <span style={{fontSize:13,fontWeight:600,color:C.text}}>{"PSO Credit Attic"}</span>
            {opt.pso&&(<span style={{fontSize:13,fontWeight:700,color:C.danger,marginLeft:"auto"}}>{"-$600"}</span>)}
          </label>
          <label style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",cursor:"pointer"}}>
            <input type="checkbox" checked={opt.psoKw||false} onChange={function(e){updateOpt({psoKw:e.target.checked,overrideTotal:""});}}
              style={{width:18,height:18,accentColor:C.accent,cursor:"pointer"}}/>
            <span style={{fontSize:13,fontWeight:600,color:C.text}}>{"PSO Credit KW"}</span>
            {opt.psoKw&&(<span style={{fontSize:13,fontWeight:700,color:C.danger,marginLeft:"auto"}}>{"-$525"}</span>)}
          </label>
          <label style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",cursor:"pointer"}}>
            <input type="checkbox" checked={opt.extraLabor} onChange={function(e){updateOpt({extraLabor:e.target.checked,overrideTotal:""});}}
              style={{width:18,height:18,accentColor:C.accent,cursor:"pointer"}}/>
            <span style={{fontSize:13,fontWeight:600,color:C.text}}>{"Extra Labor"}</span>
            <span style={{fontSize:10,color:C.dim,fontStyle:"italic"}}>{"(not on quote)"}</span>
            {opt.extraLabor&&(
              <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:4}}>
                <span style={{fontSize:13,color:C.text}}>{"$"}</span>
                <input type="number" value={opt.extraLaborAmt} onChange={function(e){updateOpt({extraLaborAmt:e.target.value,overrideTotal:""});}}
                  style={{width:80,padding:"4px 8px",background:C.bg,border:"1px solid "+C.borderLight,borderRadius:6,color:C.text,fontSize:13,fontWeight:600,fontFamily:"'Inter',sans-serif",outline:"none",textAlign:"right"}} placeholder="0" step="1"/>
              </div>
            )}
          </label>
          <label style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",cursor:"pointer"}}>
            <input type="checkbox" checked={opt.tripCharge} onChange={function(e){updateOpt({tripCharge:e.target.checked,overrideTotal:""});}}
              style={{width:18,height:18,accentColor:C.accent,cursor:"pointer"}}/>
            <span style={{fontSize:13,fontWeight:600,color:C.text}}>{"Trip Charge"}</span>
            <span style={{fontSize:10,color:C.dim,fontStyle:"italic"}}>{"(not on quote)"}</span>
            {opt.tripCharge&&(
              <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:4}}>
                <span style={{fontSize:13,color:C.text}}>{"$"}</span>
                <input type="number" value={opt.tripChargeAmt} onChange={function(e){updateOpt({tripChargeAmt:e.target.value,overrideTotal:""});}}
                  style={{width:80,padding:"4px 8px",background:C.bg,border:"1px solid "+C.borderLight,borderRadius:6,color:C.text,fontSize:13,fontWeight:600,fontFamily:"'Inter',sans-serif",outline:"none",textAlign:"right"}} placeholder="0" step="1"/>
              </div>
            )}
          </label>
          <label style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",cursor:"pointer"}}>
            <input type="checkbox" checked={opt.energySeal||false} onChange={function(e){updateOpt({energySeal:e.target.checked,overrideTotal:""});}}
              style={{width:18,height:18,accentColor:C.accent,cursor:"pointer"}}/>
            <span style={{fontSize:13,fontWeight:600,color:C.text}}>{"Energy Seal & Plates"}</span>
            {opt.energySeal&&(
              <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:4}}>
                <span style={{fontSize:13,color:C.text}}>{"$"}</span>
                <input type="number" value={opt.energySealAmt||""} onChange={function(e){updateOpt({energySealAmt:e.target.value,overrideTotal:""});}}
                  style={{width:80,padding:"4px 8px",background:C.bg,border:"1px solid "+C.borderLight,borderRadius:6,color:C.text,fontSize:13,fontWeight:600,fontFamily:"'Inter',sans-serif",outline:"none",textAlign:"right"}} placeholder="0" step="1"/>
              </div>
            )}
          </label>
          {/* Dumpster — internal only, never on quote */}
          <label style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderTop:"1px solid "+C.borderLight,cursor:"pointer"}}>
            <input type="checkbox" checked={opt.dumpster||false} onChange={function(e){updateOpt({dumpster:e.target.checked});}}
              style={{width:18,height:18,accentColor:C.accent,cursor:"pointer"}}/>
            <span style={{fontSize:13,fontWeight:600,color:C.text}}>{"Dumpster"}</span>
            <span style={{fontSize:11,color:C.dim,marginLeft:2}}>{"(internal only)"}</span>
            {opt.dumpster&&(
              <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:4}}>
                <span style={{fontSize:13,color:C.text}}>{"$"}</span>
                <input type="number" value={opt.dumpsterAmt||""} onChange={function(e){updateOpt({dumpsterAmt:e.target.value});}}
                  style={{width:80,padding:"4px 8px",background:C.bg,border:"1px solid "+C.borderLight,borderRadius:6,color:C.text,fontSize:13,fontWeight:600,fontFamily:"'Inter',sans-serif",outline:"none",textAlign:"right"}} placeholder="0" step="1"/>
              </div>
            )}
          </label>
          {/* Custom Line Items */}
          <div style={{borderTop:"1px solid "+C.borderLight,paddingTop:10,marginTop:2}}>
            <div style={{fontSize:11,fontWeight:700,color:C.accent,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>{"+ Custom Line Items"}</div>
            {(opt.customItems||[]).map(function(ci){return(
              <div key={ci.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,padding:"8px 10px",background:C.accentBg,borderRadius:6,border:"1px solid "+C.borderLight}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,color:C.text,fontWeight:500}}>{ci.description}</div>
                  <div style={{fontSize:12,color:C.accent,fontWeight:700,marginTop:2}}>{"$"+(parseFloat(ci.price)||0).toLocaleString()}</div>
                </div>
                <button onClick={function(){updateOpt({customItems:(opt.customItems||[]).filter(function(x){return x.id!==ci.id;}),overrideTotal:""});}} style={{padding:"4px 10px",borderRadius:6,border:"1px solid "+C.danger,background:"transparent",color:C.danger,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>{"✕"}</button>
              </div>
            );})}
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              <input type="text" value={customDesc} onChange={function(e){setCustomDesc(e.target.value);}} placeholder="e.g. Treat top of sheetrock with Sterifab"
                onKeyDown={function(e){if(e.key==="Enter"&&customPrice){var d=customDesc.trim();var pr=parseFloat(customPrice)||0;if(d&&pr>0){updateOpt({customItems:(opt.customItems||[]).concat([{id:Date.now()+Math.random(),description:d,price:pr}]),overrideTotal:""});setCustomDesc("");setCustomPrice("");}}} }
                style={{width:"100%",padding:"8px 10px",background:C.input,border:"1px solid "+C.inputBorder,borderRadius:6,color:C.text,fontSize:13,fontFamily:"'Inter',sans-serif",outline:"none",boxSizing:"border-box"}}/>
              <div style={{display:"flex",gap:6}}>
                <div style={{display:"flex",alignItems:"center",gap:4,flex:1}}>
                  <span style={{fontSize:13,color:C.text,fontWeight:600}}>{"$"}</span>
                  <input type="number" value={customPrice} onChange={function(e){setCustomPrice(e.target.value);}} placeholder="Price"
                    style={{flex:1,padding:"8px 10px",background:C.input,border:"1px solid "+C.inputBorder,borderRadius:6,color:C.text,fontSize:13,fontFamily:"'Inter',sans-serif",outline:"none"}}/>
                </div>
                <button onClick={function(){var d=customDesc.trim();var pr=parseFloat(customPrice)||0;if(!d||pr<=0)return;updateOpt({customItems:(opt.customItems||[]).concat([{id:Date.now()+Math.random(),description:d,price:pr}]),overrideTotal:""});setCustomDesc("");setCustomPrice("");}}
                  style={{padding:"8px 16px",background:C.accent,border:"none",borderRadius:6,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>{"Add"}</button>
              </div>
            </div>
          </div>

          <label style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderTop:"1px solid "+C.borderLight,cursor:"pointer"}}>
            <input type="checkbox" checked={p.showProductInfo||false} onChange={function(e){p.setShowProductInfo(e.target.checked);}} style={{width:18,height:18,accentColor:C.accent,cursor:"pointer"}}/>
            <span style={{fontSize:13,fontWeight:600,color:C.text}}>{"Product Information"}</span>
            <span style={{fontSize:11,color:C.dim,marginLeft:2}}>{"(adds spec sheet to PDF)"}</span>
          </label>
        </div>

        {/* TOTAL */}
        <div style={{paddingTop:12,marginTop:4,borderTop:"1px solid "+C.borderLight}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0 0"}}>
            <span style={{fontSize:18,fontWeight:800,color:C.text}}>{"TOTAL"}</span>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:16,fontWeight:800,color:C.text}}>{"$"}</span>
              <input type="number" value={opt.overrideTotal!==""?opt.overrideTotal:subtotal.toFixed(0)} onChange={function(e){updateOpt({overrideTotal:e.target.value});}}
                style={{width:110,padding:"6px 10px",background:C.bg,border:"1px solid "+C.borderLight,borderRadius:6,color:C.text,fontSize:18,fontWeight:800,fontFamily:"'Inter',sans-serif",outline:"none",textAlign:"right"}} step="1"/>
            </div>
          </div>
          {opt.overrideTotal!==""&&parseFloat(opt.overrideTotal)!==subtotal&&(<div style={{fontSize:11,color:C.dim,textAlign:"right",marginTop:4}}>{"Calculated: $"+subtotal.toFixed(0)}</div>)}
        </div>
      </div>
      <button onClick={function(){if(confirm("Clear items from "+opt.name+"?"))updateOpt({items:[]});}} style={{width:"100%",marginTop:8,padding:"10px",borderRadius:6,border:"1px solid "+C.danger,background:"transparent",color:C.danger,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",textTransform:"uppercase"}}>{"Clear "+opt.name}</button>
    </div>)}

    {/* PRINT/SHARE */}
    {opts.some(function(o){return o.items.length>0;})&&(<div style={{marginBottom:16}}>
      <GreenBtn onClick={function(){generatePDF({name:p.custName,address:p.custAddr,phone:p.custPhone,email:p.custEmail,jobAddress:p.jobAddr},opts,p.currentUser,p.showProductInfo||false);}}>{"Print Quote"}</GreenBtn>
      <GreenBtn mt={8} onClick={function(){shareQuote({name:p.custName,address:p.custAddr,phone:p.custPhone,email:p.custEmail,jobAddress:p.jobAddr},opts,p.currentUser,p.showProductInfo||false);}}>{"Share Quote"}</GreenBtn>
      <GreenBtn mt={8} onClick={function(){var cust={name:p.custName,address:p.custAddr,phone:p.custPhone,email:p.custEmail,jobAddress:p.jobAddr};printQuoteAndTakeOff(cust,opts,p.currentUser,p.jobNotes,p.measurements,opts,p.showProductInfo||false);}}>{"Print Quote and Take Off"}</GreenBtn>
    </div>)}

    {opt.items.length===0&&unpriced.length===0&&(<div style={{textAlign:"center",padding:"40px 16px",color:C.dim}}><div style={{fontSize:14}}>{"Use Take Off to measure first, or add items manually"}</div></div>)}
    </div>{/* end bottom section */}
  </div>);
}

/* ══════════ TEAM ══════════ */

var TEAM_MEMBERS = ["Johnny", "Skip", "Jordan"];

/* ══════════ SAVED JOBS PANEL ══════════ */

function SavedJobsPanel(p) {
  var s1 = useState([]), jobs = s1[0], setJobs = s1[1];
  var s2 = useState(false), loading = s2[0], setLoading = s2[1];
  var s3 = useState(""), saveName = s3[0], setSaveName = s3[1];
  var s4 = useState(false), showSave = s4[0], setShowSave = s4[1];
  var s5 = useState(""), status = s5[0], setStatus = s5[1];
  var s6 = useState({}), openSections = s6[0], setOpenSections = s6[1];

  function refreshJobs() {
    setLoading(true);
    loadAllJobs().then(function(data) {
      setJobs(data || []);
      setLoading(false);
    });
  }

  useEffect(function() { refreshJobs(); }, []);

  function handleSave() {
    var name = saveName.trim();
    if (!name) { setStatus("⚠️ Enter a job name first."); return; }
    setStatus("Saving...");
    var jobData = {
      custName: p.custName, custAddr: p.custAddr, custPhone: p.custPhone, custEmail: p.custEmail, jobAddr: p.jobAddr, jobNotes: p.jobNotes,
      measurements: p.measurements, quoteOpts: p.quoteOpts, importedItems: p.importedItems, section: p.section,
    };
    saveJob(p.currentUser, name, jobData).then(function(ok) {
      if (ok) {
        setStatus("✓ Saved: " + name);
        setSaveName("");
        setShowSave(false);
        refreshJobs();
        setTimeout(function() { setStatus(""); }, 3000);
      } else {
        setStatus("❌ Save failed — check your connection and try again.");
        setTimeout(function() { setStatus(""); }, 4000);
      }
    }).catch(function(e) {
      setStatus("❌ Error: " + (e.message || "Unknown error"));
      setTimeout(function() { setStatus(""); }, 4000);
    });
  }

  function handleLoad(job) {
    if (!confirm("Load \"" + job.job_name + "\"? This will replace your current work.")) return;
    var d = job.job_data || {};
    p.setCustName(d.custName || "");
    p.setCustAddr(d.custAddr || "");
    p.setCustPhone(d.custPhone || "");
    p.setCustEmail(d.custEmail || "");
    p.setJobAddr(d.jobAddr || "");
    p.setJobNotes(d.jobNotes || "");
    p.setMeasurements(d.measurements || []);
    if (d.quoteOpts) p.setQuoteOpts(d.quoteOpts);
    else if (d.quoteItems && d.quoteItems.length > 0) p.setQuoteOpts([Object.assign(newOption("Option 1"),{items:d.quoteItems})]);
    else p.setQuoteOpts([newOption("Option 1")]);
    p.setImportedItems(d.importedItems || []);
    setStatus("Loaded: " + job.job_name);
    setTimeout(function() { setStatus(""); }, 2000);
  }

  function handleDelete(job) {
    if (!confirm("Delete \"" + job.job_name + "\"?")) return;
    deleteJob(job.id).then(function() { refreshJobs(); });
  }

  var hasWork = p.measurements.length > 0 || p.quoteOpts.some(function(o){return o.items.length>0;}) || (p.custName && p.custName.trim().length > 0) || (p.importedItems && p.importedItems.length > 0);

  return (
    <div style={{ padding: "0 16px 16px" }}>
      {hasWork && (
        <div style={{ marginBottom: 12 }}>
          {!showSave ? (
            <button onClick={function() { setShowSave(true); setSaveName(p.custName || ""); }}
              style={{ width: "100%", padding: "11px 16px", borderRadius: 6, border: "1px solid " + C.accent, background: "transparent", color: C.accent, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {"Save Current Job"}
            </button>
          ) : (
            <div style={{ background: C.card, borderRadius: 6, padding: 14, border: "1px solid " + C.accent, boxShadow: C.shadowMd }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, textTransform: "uppercase", marginBottom: 8 }}>{"Save Job As"}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input style={{ flex: 1, padding: "8px 12px", background: C.input, border: "1px solid " + C.inputBorder, borderRadius: 6, color: C.text, fontSize: 14, fontFamily: "'Inter', sans-serif", outline: "none", transition: "border-color 0.15s" }}
                  type="text" value={saveName} onChange={function(e) { setSaveName(e.target.value); }} placeholder="Job name (e.g. Smith Residence)" autoFocus
                  onKeyDown={function(e) { if (e.key === "Enter") handleSave(); }}
                  onFocus={function(e){e.target.style.borderColor=C.accent;}} onBlur={function(e){e.target.style.borderColor=C.inputBorder;}}
                />
                <button onClick={handleSave} style={{ padding: "8px 16px", background: C.accent, border: "none", borderRadius: 6, color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>{"Save"}</button>
                <button onClick={function() { setShowSave(false); }} style={{ padding: "8px 12px", background: "none", border: "1px solid " + C.dim, borderRadius: 6, color: C.dim, fontSize: 13, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>{"Cancel"}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {status && (<div style={{ padding: "8px 12px", background: C.accentBg, border: "1px solid " + C.accent, borderRadius: 6, fontSize: 13, color: C.accent, fontWeight: 600, marginBottom: 12, textAlign: "center" }}>{status}</div>)}

      {loading && (<div style={{ fontSize: 12, color: C.dim, textAlign: "center", padding: "16px 0" }}>{"Loading..."}</div>)}

      {!loading && TEAM_MEMBERS.map(function(member) {
        var memberJobs = jobs.filter(function(j) { return j.saved_by === member; });
        var isOpen = openSections[member];
        return (
          <div key={member} style={{ marginBottom: 10 }}>
            <button onClick={function() { setOpenSections(function(prev) { var n = Object.assign({}, prev); n[member] = !n[member]; return n; }); }}
              style={{ width: "100%", padding: "12px 16px", borderRadius: isOpen ? "6px 6px 0 0" : 6, border: "1px solid " + C.border, background: C.card, color: C.text, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: C.shadow }}>
              <span>{member + (memberJobs.length > 0 ? " (" + memberJobs.length + ")" : "")}</span>
              <span style={{ fontSize: 14, color: C.dim }}>{isOpen ? "▲" : "▼"}</span>
            </button>
            {isOpen && (
              <div style={{ background: C.card, borderRadius: "0 0 6px 6px", border: "1px solid " + C.border, borderTop: "none", overflow: "hidden" }}>
                {memberJobs.length === 0 && (
                  <div style={{ padding: "12px 14px", fontSize: 12, color: C.dim, textAlign: "center" }}>{"No saved jobs"}</div>
                )}
                {memberJobs.map(function(job, idx) {
                  var date = new Date(job.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
                  var d = job.job_data || {};
                  var measCount = (d.measurements || []).length;
                  var quoteCount = d.quoteOpts ? d.quoteOpts.reduce(function(s,o){return s+(o.items?o.items.length:0);},0) : (d.quoteItems||[]).length;
                  var info = [];
                  if (measCount > 0) info.push(measCount + " measurements");
                  if (quoteCount > 0) info.push(quoteCount + " quote items");
                  return (
                    <div key={job.id} style={{ padding: "12px 14px", borderBottom: idx < memberJobs.length - 1 ? "1px solid " + C.borderLight : "none" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{job.job_name}</div>
                          <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>
                            {date + (info.length > 0 ? " · " + info.join(", ") : "")}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={function() { handleLoad(job); }}
                            style={{ padding: "6px 12px", background: C.accent, border: "none", borderRadius: 6, color: "#fff", fontWeight: 600, fontSize: 11, cursor: "pointer", fontFamily: "'Inter', sans-serif", textTransform: "uppercase" }}>{"Load"}</button>
                          <button onClick={function() { handleDelete(job); }}
                            style={{ padding: "6px 8px", background: "none", border: "1px solid " + C.danger, borderRadius: 6, color: C.danger, fontSize: 11, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>{"Delete"}</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ══════════ LOGIN SCREEN ══════════ */

function PasscodeInput(p) {
  var s1 = useState(["","","",""]), digits = s1[0], setDigits = s1[1];
  function handleChange(idx, val) {
    if (val && !/^\d$/.test(val)) return;
    var next = digits.slice();
    next[idx] = val;
    setDigits(next);
    if (val && idx < 3) {
      var el = document.getElementById("pin-" + p.id + "-" + (idx + 1));
      if (el) el.focus();
    }
    if (val && idx === 3) {
      var code = next.join("");
      if (code.length === 4) setTimeout(function() { p.onSubmit(code); }, 100);
    }
  }
  function handleKeyDown(idx, e) {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) {
      var el = document.getElementById("pin-" + p.id + "-" + (idx - 1));
      if (el) el.focus();
    }
  }
  var boxStyle = { width: 48, height: 56, textAlign: "center", fontSize: 22, fontWeight: 700, fontFamily: "'Inter',sans-serif", border: "1px solid " + C.border, borderRadius: 6, outline: "none", background: C.card, color: C.text, transition: "border-color 0.15s", boxShadow: C.shadow };
  return (
    <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
      {[0,1,2,3].map(function(idx) {
        return (<input key={idx} id={"pin-" + p.id + "-" + idx} type="tel" inputMode="numeric" maxLength={1} value={digits[idx]}
          onChange={function(e) { handleChange(idx, e.target.value); }}
          onKeyDown={function(e) { handleKeyDown(idx, e); }}
          onFocus={function(e) { e.target.style.borderColor = C.accent; }}
          onBlur={function(e) { e.target.style.borderColor = C.border; }}
          style={boxStyle} autoFocus={idx === 0}/>);
      })}
    </div>
  );
}

function LoginScreen(p) {
  var s1 = useState(""), selectedUser = s1[0], setSelectedUser = s1[1];
  var s2 = useState("pick"), step = s2[0], setStep = s2[1];
  var s3 = useState(false), loading = s3[0], setLoading = s3[1];
  var s4 = useState(""), error = s4[0], setError = s4[1];
  var s5 = useState(""), firstCode = s5[0], setFirstCode = s5[1];
  var s6 = useState(0), pinKey = s6[0], setPinKey = s6[1];

  function handlePickUser(name) {
    setSelectedUser(name);
    setLoading(true);
    setError("");
    loadPasscode(name).then(function(code) {
      setLoading(false);
      if (code) {
        setStep("enter");
      } else {
        setStep("create");
      }
    });
  }

  function handleEnter(code) {
    setLoading(true);
    setError("");
    loadPasscode(selectedUser).then(function(stored) {
      setLoading(false);
      if (code === stored) {
        localStorage.setItem("ist-user", selectedUser);
        p.onLogin(selectedUser);
      } else {
        setError("Incorrect passcode");
        setPinKey(function(k) { return k + 1; });
      }
    });
  }

  function handleCreate(code) {
    if (!firstCode) {
      setFirstCode(code);
      setStep("confirm");
      setPinKey(function(k) { return k + 1; });
      return;
    }
    if (code !== firstCode) {
      setError("Passcodes don't match. Try again.");
      setFirstCode("");
      setStep("create");
      setPinKey(function(k) { return k + 1; });
      return;
    }
    setLoading(true);
    setError("");
    savePasscode(selectedUser, code).then(function() {
      setLoading(false);
      localStorage.setItem("ist-user", selectedUser);
      p.onLogin(selectedUser);
    });
  }

  function handleBack() {
    setSelectedUser("");
    setStep("pick");
    setError("");
    setFirstCode("");
    setPinKey(function(k) { return k + 1; });
  }

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", position: "fixed", inset: 0, overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        @keyframes kenburns { 0%{transform:scale(1.0) translate(0%,0%)} 50%{transform:scale(1.12) translate(-2%,-1%)} 100%{transform:scale(1.0) translate(0%,0%)} }
        @keyframes authFadeIn { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .kb-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;animation:kenburns 20s ease-in-out infinite;transform-origin:center center}
        .kb-overlay{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,0.55) 0%,rgba(0,0,0,0.35) 50%,rgba(0,0,0,0.65) 100%)}
        .kb-content{animation:authFadeIn 0.45s cubic-bezier(0.16,1,0.3,1) both;position:relative;z-index:1;width:100%;max-width:340px;padding:20px}
        .kb-btn{background:rgba(255,255,255,0.1)!important;backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.2)!important;color:#fff!important;box-shadow:0 4px 24px rgba(0,0,0,0.3)!important;transition:background 0.2s,transform 0.2s!important}
        .kb-btn:hover{background:rgba(255,255,255,0.18)!important;transform:translateY(-2px)}
      `}</style>
      <img className="kb-img" src="/tulsa.jpg" alt="" />
      <div className="kb-overlay" />
      <div className="kb-content">
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.65)", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 6 }}>{"Insulation Services of Tulsa"}</div>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: "#fff", letterSpacing: "0.04em", textTransform: "uppercase", margin: 0 }}>{"IST Takeoff"}</h1>
        <div style={{ width: 36, height: 2, background: C.accent, margin: "10px auto 0", borderRadius: 1 }} />
      </div>
      <div style={{ width: "100%" }}>

        {step === "pick" && (<div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12, textAlign: "center" }}>{"Who's working?"}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {TEAM_MEMBERS.map(function(name) {
              return (
                <button key={name} onClick={function() { handlePickUser(name); }} className="kb-btn"
                  style={{ width: "100%", padding: "16px 20px", borderRadius: 10, fontSize: 16, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif", textAlign: "center", border: "none" }}>
                  {name}
                </button>
              );
            })}
          </div>
        </div>)}

        {step === "enter" && (<div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 6 }}>{selectedUser}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 20 }}>{"Enter your passcode"}</div>
          {loading ? (<div style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>{"Verifying..."}</div>) : (<PasscodeInput key={pinKey} id="enter" onSubmit={handleEnter}/>)}
          {error && (<div style={{ marginTop: 12, fontSize: 13, color: C.danger, fontWeight: 600 }}>{error}</div>)}
          <button onClick={handleBack} style={{ marginTop: 20, background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 12, cursor: "pointer", fontFamily: "'Inter',sans-serif", fontWeight: 600 }}>{"Back"}</button>
        </div>)}

        {step === "create" && (<div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 6 }}>{selectedUser}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 20 }}>{"Create a 4-digit passcode"}</div>
          {loading ? (<div style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>{"Loading..."}</div>) : (<PasscodeInput key={pinKey} id="create" onSubmit={handleCreate}/>)}
          {error && (<div style={{ marginTop: 12, fontSize: 13, color: C.danger, fontWeight: 600 }}>{error}</div>)}
          <button onClick={handleBack} style={{ marginTop: 20, background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 12, cursor: "pointer", fontFamily: "'Inter',sans-serif", fontWeight: 600 }}>{"Back"}</button>
        </div>)}

        {step === "confirm" && (<div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 6 }}>{selectedUser}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 20 }}>{"Confirm your passcode"}</div>
          {loading ? (<div style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>{"Saving..."}</div>) : (<PasscodeInput key={pinKey} id="confirm" onSubmit={handleCreate}/>)}
          {error && (<div style={{ marginTop: 12, fontSize: 13, color: C.danger, fontWeight: 600 }}>{error}</div>)}
          <button onClick={handleBack} style={{ marginTop: 20, background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 12, cursor: "pointer", fontFamily: "'Inter',sans-serif", fontWeight: 600 }}>{"Back"}</button>
        </div>)}

      </div>
      </div>
    </div>
  );
}

/* ══════════ WORK ORDER ══════════ */
function WorkOrderSection({measurements, quoteOpts, custName, custAddr, currentUser}) {
  var today = new Date().toISOString().slice(0,10);

  // WO number
  var initWoNum = (function() {
    try { var n = parseInt(localStorage.getItem("ist-wo-counter") || "0"); return n > 0 ? n : 1; } catch(e) { return 1; }
  })();

  var [woNum, setWoNum] = React.useState(String(initWoNum));
  var [dateReady, setDateReady] = React.useState(today);
  var [dateFinished, setDateFinished] = React.useState("");
  var [doorCode, setDoorCode] = React.useState("");
  var [builder, setBuilder] = React.useState(custName || "");
  var [address, setAddress] = React.useState(custAddr || "");
  var [addition, setAddition] = React.useState("");
  var [salesman, setSalesman] = React.useState(currentUser || "");
  var [notes, setNotes] = React.useState("");

  // Sync builder/address/salesman if props change
  React.useEffect(function() { setBuilder(custName || ""); }, [custName]);
  React.useEffect(function() { setAddress(custAddr || ""); }, [custAddr]);
  React.useEffect(function() { setSalesman(currentUser || ""); }, [currentUser]);

  // Mat type mapping
  function matTypeLabel(m) {
    var id = m.locationId || "";
    var map = {
      "band_joist":       "BJ",
      "ext_kneewall":     "BOXED KW",
      "ext_slopes":       "BOXED SLOPES",
      "ext_walls_garage": "GARAGE EXTERIOR",
      "ext_walls_house":  "HOUSE EXTERIOR",
      "flat_ceiling":     "FLAT CEILING",
      "gable_end":        "GABLE",
      "garage_common":    "COMMON WALL",
      "attic_area_garage":"GARAGE ATTIC",
      "attic_area_house": "HOUSE ATTIC",
      "attic_kneewall":   "ATTIC KW",
      "attic_slopes":     "OPEN SLOPES",
      "open_attic_walls": "OPEN ATTIC WALLS",
      "porch":            "PORCH",
      "porch_blocking":   "PORCH BLOCK",
      "roofline":         "RL",
      "roofline_garage":  "GARAGE RL",
      "roofline_house":   "HOUSE RL",
      "custom":           m.customLocation || m.location || "CUSTOM",
    };
    return map[id] || (m.location || m.locationId || "OTHER").toUpperCase();
  }

  // Build initial mat rows from measurements
  var wallIds = ["ext_walls_house","ext_walls_garage","garage_common","ext_kneewall","open_attic_walls","attic_kneewall"];

  // Build a map of locationId → R-value (or inches for foam) from quote items
  function buildRValueMap() {
    var map = {};
    var allItems = (quoteOpts || []).flatMap(function(o) { return o.items || []; });
    allItems.forEach(function(item) {
      if (!item.locationId || map[item.locationId]) return;
      var mat = item.material || item.description || "";
      // Foam: extract inches e.g. '3" Open Cell Foam' → '3"'
      var foamMatch = mat.match(/^(\d+\.?\d*)"?\s*(Open Cell|Closed Cell)/i);
      if (foamMatch) {
        map[item.locationId] = foamMatch[1] + '"';
        return;
      }
      // Fiberglass: extract R-value e.g. "R-13"
      var rMatch = mat.match(/R-?(\d+)/i);
      if (rMatch) map[item.locationId] = "R-" + rMatch[1];
    });
    return map;
  }

  function shortRValue(mat) {
    if (!mat) return "";
    // "R13 x15 Fiberglass Batts" → "13x15"
    var batt = mat.match(/R(\d+)\s*x(\d+)/i);
    if (batt) return batt[1]+"x"+batt[2];
    // "R11 Fiberglass Batts" → "11"
    var simple = mat.match(/^R(\d+)\s+Fiberglass/i);
    if (simple) return simple[1];
    // '4" Open Cell Foam' → '4" OC'
    var oc = mat.match(/^([\d.]+)"\s*Open Cell/i);
    if (oc) return oc[1]+'" OC';
    // '3" Closed Cell Foam' → '3" CC'
    var cc = mat.match(/^([\d.]+)"\s*Closed Cell/i);
    if (cc) return cc[1]+'" CC';
    // bare "Open Cell Foam" / "Closed Cell Foam"
    if (/open cell/i.test(mat)) return "Open Cell";
    if (/closed cell/i.test(mat)) return "Closed Cell";
    // "Blown Fiberglass R30" → "BF R30"
    var bfg = mat.match(/Blown Fiberglass\s*R?(\d+)/i);
    if (bfg) return "BF R"+bfg[1];
    // "Blown Cellulose R30" → "BC R30"
    var bcel = mat.match(/Blown Cellulose\s*R?(\d+)/i);
    if (bcel) return "BC R"+bcel[1];
    return mat;
  }

  function buildMatRows(meas) {
    var rMap = buildRValueMap();
    var rows = (meas || []).map(function(m, i) {
      var isWall = wallIds.includes(m.locationId || "");
      var ht = "";
      if (isWall && m.wallHeightLabel) {
        var match = m.wallHeightLabel.match(/(\d+)['']/);
        ht = match ? match[1] : m.wallHeightLabel.match(/(\d+)/)?.[1] || "";
      }
      var rawMat = (m.matNote && m.matNote.trim()) ? m.matNote.trim() : (rMap[m.locationId] || m.rValue || "");
      var rValue = shortRValue(rawMat) || rawMat;
      return {
        id: "mr-" + i,
        locationId: m.locationId || "",
        matType: matTypeLabel(m),
        wallHeight: ht,
        rValue: rValue,
        width: m.width || "",
        sqft: m.sqft ? String(Math.round(m.sqft)) : "",
        matOut: "",
        matIn: "",
        count: "",
      };
    });
    var atticList=["attic_area_garage","attic_area_house"];
    function getR(s){var m=String(s||"").match(/(\d+)/);return m?parseInt(m[1],10):0;}
    function getR2(s){var m=String(s||"").match(/\d+x(\d+)/);return m?parseInt(m[1],10):0;}
    var sorted=rows.slice().sort(function(a,b){
      var aAttic=atticList.includes(a.locationId||"");
      var bAttic=atticList.includes(b.locationId||"");
      if(aAttic!==bAttic) return aAttic?1:-1;
      var aR=getR(a.rValue),bR=getR(b.rValue);
      if(aR!==bR) return aR-bR;
      return getR2(a.rValue)-getR2(b.rValue);
    });
    return sorted;
  }

  var [matRows, setMatRows] = React.useState(function() { return buildMatRows(measurements); });

  React.useEffect(function() {
    setMatRows(buildMatRows(measurements));
  }, [measurements]);

  // Employees
  var emptyEmp = function() { return {name:"",sqft:"",labor:""}; };
  var [employees, setEmployees] = React.useState([emptyEmp(),emptyEmp(),emptyEmp(),emptyEmp(),emptyEmp()]);

  // R-value summary costs
  // Derive R-value categories from matNote on measurements
  var rCats = (function() {
    var seen = {}, order = [];
    (measurements || []).forEach(function(m) {
      var mat = (m.matNote || "").trim();
      if (!mat) return;
      var label = shortRValue(mat) || mat;
      if (!seen[label]) { seen[label] = true; order.push(label); }
    });
    if (order.length === 0) return ["R-11","R-13","R-19","R-30","BW","E/S"];
    return order.slice().sort(function(a,b){
      var aR=parseInt((a).match(/(\d+)/)||[0,0])||0;
      var bR=parseInt((b).match(/(\d+)/)||[0,0])||0;
      return aR-bR;
    });
  })();

  var [rCosts, setRCosts] = React.useState({});

  // Sum sqft per matNote from measurements
  function getRFootage(cat) {
    return (measurements || []).reduce(function(sum, m) {
      var label = shortRValue((m.matNote||"").trim()) || (m.matNote||"").trim();
      if (label === cat) return sum + (parseFloat(m.sqft) || 0);
      return sum;
    }, 0);
  }

  var atticIds=["attic_area_garage","attic_area_house"];
  function sortedMatRows(rows){
    return rows.slice().sort(function(a,b){
      var aAttic=atticIds.includes(a.locationId||"");
      var bAttic=atticIds.includes(b.locationId||"");
      if(aAttic!==bAttic) return aAttic?1:-1;
      // Extract first number from short value e.g. "13x15" → 13, "Open Cell" → 0
      var aR=parseInt((a.rValue||"").match(/(\d+)/)||[0,0])||0;
      var bR=parseInt((b.rValue||"").match(/(\d+)/)||[0,0])||0;
      if(aR!==bR) return aR-bR;
      // Secondary sort by second number e.g. 13x15 vs 13x24
      var aR2=parseInt(((a.rValue||"").match(/\d+x(\d+)/)||[0,0])[1])||0;
      var bR2=parseInt(((b.rValue||"").match(/\d+x(\d+)/)||[0,0])[1])||0;
      return aR2-bR2;
    });
  }

  function totalLabor() {
    return employees.reduce(function(s,e){ return s+(parseFloat(e.labor)||0); }, 0);
  }

  function updateMatRow(id, field, val) {
    setMatRows(function(rows) { return rows.map(function(r){ return r.id===id ? Object.assign({},r,{[field]:val}) : r; }); });
  }
  function addMatRow() {
    setMatRows(function(rows) { return rows.concat([{id:"mr-new-"+Date.now(),matType:"",rValue:"",width:"",sqft:"",matOut:"",matIn:"",count:""}]); });
  }
  function deleteMatRow(id) {
    setMatRows(function(rows) { return rows.filter(function(r){ return r.id!==id; }); });
  }
  function updateEmp(i, field, val) {
    setEmployees(function(emps) { return emps.map(function(e,idx){ return idx===i ? Object.assign({},e,{[field]:val}) : e; }); });
  }

  var iStyle = {fontFamily:"'Inter',sans-serif",fontSize:12,padding:"4px 6px",border:"1px solid "+C.inputBorder,borderRadius:4,background:C.input,color:C.text,width:"100%",boxSizing:"border-box"};
  var thStyle = {padding:"6px 8px",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em",color:C.textSec,textAlign:"left",borderBottom:"2px solid "+C.border,whiteSpace:"nowrap"};
  var tdStyle = {padding:"4px 6px",fontSize:12,verticalAlign:"middle"};

  function handlePrint() {
    var rSummaryRows = rCats.map(function(cat) {
      var ft = getRFootage(cat);
      return '<tr><td style="padding:4px 8px;border:1px solid #ccc;font-size:12px;">'+cat+'</td><td style="padding:4px 8px;border:1px solid #ccc;font-size:12px;text-align:right;">'+(ft?ft.toLocaleString():"")+'</td><td style="padding:4px 8px;border:1px solid #ccc;font-size:12px;text-align:right;">'+(rCosts[cat]?"$"+rCosts[cat]:"")+'</td></tr>';
    }).join("");

    var matRowsHtml = sortedMatRows(matRows).map(function(r) {
      return '<tr><td style="padding:4px 8px;border:1px solid #ccc;font-size:12px;">'+r.matType+'</td><td style="padding:4px 8px;border:1px solid #ccc;font-size:12px;">'+r.rValue+'</td><td style="padding:4px 8px;border:1px solid #ccc;font-size:12px;color:'+(r.wallHeight?"#2563eb":"#999")+';">'+(r.wallHeight||r.width||"—")+'</td><td style="padding:4px 8px;border:1px solid #ccc;font-size:12px;text-align:right;">'+r.sqft+'</td><td style="padding:4px 8px;border:1px solid #ccc;font-size:12px;text-align:right;">'+r.matOut+'</td><td style="padding:4px 8px;border:1px solid #ccc;font-size:12px;text-align:right;">'+r.matIn+'</td><td style="padding:4px 8px;border:1px solid #ccc;font-size:12px;text-align:right;">'+r.count+'</td></tr>';
    }).join("");

    var empRowsHtml = employees.map(function(e) {
      return '<tr><td style="padding:4px 8px;border:1px solid #ccc;font-size:12px;">'+e.name+'</td><td style="padding:4px 8px;border:1px solid #ccc;font-size:12px;text-align:right;">'+e.sqft+'</td><td style="padding:4px 8px;border:1px solid #ccc;font-size:12px;text-align:right;">'+(e.labor?"$"+e.labor:"")+'</td></tr>';
    }).join("");

    var TH = 'padding:4px 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#dbeafe;text-align:left;background:#0f1e46;border:none;';
    var TD = 'padding:3px 8px;font-size:11px;border-bottom:1px solid #e2e8f0;color:#0f172a;vertical-align:middle;';
    var TD2 = 'padding:3px 8px;font-size:11px;border-bottom:1px solid #e2e8f0;color:#0f172a;text-align:right;vertical-align:middle;';
    var matRowsHtmlThemed = sortedMatRows(matRows).map(function(r,i){
      var bg = i%2===0?'#f8fafc':'#fff';
      return '<tr style="background:'+bg+'"><td style="'+TD+'">'+r.matType+'</td><td style="'+TD+'">'+r.rValue+'</td><td style="'+TD+';color:'+(r.wallHeight?'#2563eb':'#94a3b8')+';">'+(r.wallHeight||r.width||'—')+'</td><td style="'+TD2+'">'+r.sqft+'</td><td style="'+TD2+'">'+r.matOut+'</td><td style="'+TD2+'">'+r.matIn+'</td><td style="'+TD2+'">'+r.count+'</td></tr>';
    }).join('');
    var empRowsHtmlThemed = employees.map(function(e,i){
      var bg = i%2===0?'#f8fafc':'#fff';
      return '<tr style="background:'+bg+'"><td style="'+TD+'">'+e.name+'</td><td style="'+TD2+'">'+e.sqft+'</td><td style="'+TD2+'">'+(e.labor?'$'+e.labor:'')+'</td></tr>';
    }).join('');
    var rSummaryRowsThemed = rCats.map(function(cat,i){
      var bg = i%2===0?'#f8fafc':'#fff';
      return '<tr style="background:'+bg+'"><td style="'+TD+'">'+cat+'</td><td style="'+TD2+'"></td><td style="'+TD2+'"></td></tr>';
    }).join('');

    var html = '<!DOCTYPE html><html><head><title>Work Order #'+woNum+'</title>'
      +'<style>'
      +'*{box-sizing:border-box;margin:0;padding:0;}'
      +'body{font-family:\'Helvetica Neue\',Helvetica,Arial,sans-serif;background:#fff;color:#0f172a;}'
      +'table{border-collapse:collapse;width:100%;}'
      +'@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}button{display:none !important;}@page{size:letter;margin:0.35in;}}'
      +'</style></head><body>'

      // ── HEADER BAND ──
      +'<div style="background:#0f1e46;padding:10px 20px 8px;position:relative;">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;">'
      +'<div>'
      +'<div style="font-size:18px;font-weight:900;color:#fff;letter-spacing:0.04em;text-transform:uppercase;">Insulation Services of Tulsa</div>'
      +'<div style="font-size:9px;color:#b4c8f0;margin-top:3px;letter-spacing:0.06em;">Serving Northeastern Oklahoma  •  1 (918) 232-9055</div>'
      +'</div>'
      +'<div style="text-align:right;">'
      +'<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#dbeafe;">Work Order</div>'
      +'<div style="font-size:26px;font-weight:900;color:#fff;line-height:1.1;">#'+woNum+'</div>'
      +'</div>'
      +'</div>'
      +'</div>'
      // Blue accent stripe
      +'<div style="height:4px;background:#2563eb;"></div>'

      // ── JOB INFO CARDS ──
      +'<div style="display:flex;gap:8px;padding:6px 20px 0;">'

      // Card: Job Details
      +'<div style="flex:2;background:#f8fafc;border-radius:6px;padding:6px 12px;border-left:4px solid #2563eb;">'
      +'<div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;margin-bottom:4px;">Job Details</div>'
      +'<table style="width:100%;border:none;"><tr>'
      +'<td style="font-size:10px;font-weight:700;color:#64748b;white-space:nowrap;padding:1px 8px 1px 0;">Date Ready</td>'
      +'<td style="font-size:11px;color:#0f172a;padding:1px 12px 1px 0;">'+dateReady+'</td>'
      +'<td style="font-size:10px;font-weight:700;color:#64748b;white-space:nowrap;padding:1px 8px 1px 0;">Date Finished</td>'
      +'<td style="font-size:11px;color:#0f172a;padding:1px 0;">'+dateFinished+'</td>'
      +'</tr><tr>'
      +'<td style="font-size:10px;font-weight:700;color:#64748b;padding:1px 8px 1px 0;">Builder</td>'
      +'<td style="font-size:11px;color:#0f172a;padding:1px 12px 1px 0;">'+builder+'</td>'
      +'<td style="font-size:10px;font-weight:700;color:#64748b;padding:1px 8px 1px 0;">Addition</td>'
      +'<td style="font-size:11px;color:#0f172a;padding:1px 0;">'+addition+'</td>'
      +'</tr><tr>'
      +'<td style="font-size:10px;font-weight:700;color:#64748b;padding:1px 8px 1px 0;">Address</td>'
      +'<td style="font-size:11px;color:#0f172a;padding:1px 0;" colspan="3">'+address+'</td>'
      +'</tr></table>'
      +'</div>'

      // Card: Assignment
      +'<div style="flex:1;background:#f8fafc;border-radius:6px;padding:6px 12px;border-left:4px solid #2563eb;">'
      +'<div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;margin-bottom:4px;">Assignment</div>'
      +'<table style="width:100%;border:none;"><tr>'
      +'<td style="font-size:10px;font-weight:700;color:#64748b;padding:1px 8px 1px 0;">Salesman</td>'
      +'<td style="font-size:11px;color:#0f172a;">'+salesman+'</td>'
      +'</tr><tr>'
      +'<td style="font-size:10px;font-weight:700;color:#64748b;padding:1px 8px 1px 0;">Door Code</td>'
      +'<td style="font-size:11px;color:#0f172a;">'+doorCode+'</td>'
      +'</tr></table>'
      +'</div>'
      +'</div>'

      // ── MATERIALS TABLE ──
      +'<div style="padding:6px 20px 0;">'
      +'<div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#2563eb;margin-bottom:4px;">Materials</div>'
      +'<table style="border-radius:6px;overflow:hidden;border:1px solid #e2e8f0;">'
      +'<thead><tr>'
      +'<th style="'+TH+'">Mat Type</th>'
      +'<th style="'+TH+'">R-Value</th>'
      +'<th style="'+TH+'">Height</th>'
      +'<th style="'+TH+';text-align:right;">Sq Ft</th>'
      +'<th style="'+TH+';text-align:right;">Mat Out</th>'
      +'<th style="'+TH+';text-align:right;">Mat In</th>'
      +'<th style="'+TH+';text-align:right;">Count</th>'
      +'</tr></thead>'
      +'<tbody>'+matRowsHtmlThemed+'</tbody>'
      +'</table>'
      +'</div>'

      // ── EMPLOYEES + R-VALUE SUMMARY ──
      +'<div style="display:flex;gap:10px;padding:6px 20px 0;">'

      // Employees
      +'<div style="flex:1;">'
      +'<div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#2563eb;margin-bottom:6px;">Employees</div>'
      +'<table style="border-radius:6px;overflow:hidden;border:1px solid #e2e8f0;">'
      +'<thead><tr>'
      +'<th style="'+TH+'">Employee</th>'
      +'<th style="'+TH+';text-align:right;">Sq Ft</th>'
      +'<th style="'+TH+';text-align:right;">Labor ($)</th>'
      +'</tr></thead>'
      +'<tbody>'+empRowsHtmlThemed
      +'<tr style="background:#0f1e46;">'
      +'<td style="padding:6px 10px;font-size:12px;font-weight:700;color:#fff;">TOTAL</td>'
      +'<td style="padding:6px 10px;"></td>'
      +'<td style="padding:6px 10px;font-size:13px;font-weight:900;color:#fff;text-align:right;">$'+totalLabor().toFixed(2)+'</td>'
      +'</tr>'
      +'</tbody></table>'
      +'</div>'

      // R-Value Summary
      +'<div style="flex:1;">'
      +'<div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#2563eb;margin-bottom:6px;">R-Value Summary</div>'
      +'<table style="border-radius:6px;overflow:hidden;border:1px solid #e2e8f0;">'
      +'<thead><tr>'
      +'<th style="'+TH+'">R-Value</th>'
      +'<th style="'+TH+';text-align:right;">Footage</th>'
      +'<th style="'+TH+';text-align:right;">Cost</th>'
      +'</tr></thead>'
      +'<tbody>'+rSummaryRowsThemed+'</tbody>'
      +'</table>'
      +'</div>'
      +'</div>'

      +'<div style="text-align:center;font-size:10px;font-weight:700;color:#64748b;padding:8px 0;letter-spacing:0.06em;text-transform:uppercase;">Work Order Must Be Filled Out Completely</div>'

      +'</body></html>';

    var w = window.open("","_blank");
    w.document.write(html);
    w.document.close();
    w.print();
  }

  var secHead = function(label) {
    return React.createElement("div", {style:{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",color:C.accent,marginBottom:8,marginTop:20,borderBottom:"1px solid "+C.border,paddingBottom:4}}, label);
  };

  var FI = function(props) {
    return React.createElement("div", {style:{flex:1,minWidth:120}},
      React.createElement("label", {style:{fontSize:11,fontWeight:600,color:C.textSec,display:"block",marginBottom:3}}, props.label),
      React.createElement("input", {type:props.type||"text",value:props.value,onChange:function(e){props.onChange(e.target.value);},placeholder:props.placeholder||"",style:Object.assign({},iStyle,{width:"100%"})})
    );
  };

  return React.createElement("div", {style:{maxWidth:900,margin:"0 auto",padding:"16px"}},
    // Title + Print button
    React.createElement("div", {style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}},
      React.createElement("div", {style:{fontSize:16,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.06em",color:C.text}}, "Work Order"),
      React.createElement("button", {onClick:handlePrint,style:{background:C.accent,color:"#fff",border:"none",borderRadius:6,padding:"8px 18px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",letterSpacing:"0.06em",textTransform:"uppercase"}}, "🖨 Print / PDF")
    ),

    // Header fields
    secHead("Job Info"),
    React.createElement("div", {style:{display:"flex",flexWrap:"wrap",gap:10,marginBottom:8}},
      React.createElement(FI, {label:"WO #", value:woNum, onChange:function(v){setWoNum(v);try{localStorage.setItem("ist-wo-counter",v);}catch(e){}}}),
      React.createElement(FI, {label:"Date Ready", type:"date", value:dateReady, onChange:setDateReady}),
      React.createElement(FI, {label:"Date Finished", type:"date", value:dateFinished, onChange:setDateFinished}),
      React.createElement(FI, {label:"Door Code", value:doorCode, onChange:setDoorCode})
    ),
    React.createElement("div", {style:{display:"flex",flexWrap:"wrap",gap:10,marginBottom:8}},
      React.createElement(FI, {label:"Builder", value:builder, onChange:setBuilder}),
      React.createElement(FI, {label:"Address", value:address, onChange:setAddress}),
      React.createElement(FI, {label:"Addition", value:addition, onChange:setAddition}),
      React.createElement(FI, {label:"Salesman", value:salesman, onChange:setSalesman})
    ),

    // Materials table
    secHead("Materials"),
    React.createElement("div", {style:{overflowX:"auto"}},
      React.createElement("table", {style:{width:"100%",borderCollapse:"collapse",fontSize:12}},
        React.createElement("thead", null,
          React.createElement("tr", null,
            ["MAT TYPE","R-VALUE","HEIGHT","SQ FT","MAT OUT","MAT IN","COUNT",""].map(function(h,i) {
              return React.createElement("th", {key:i,style:thStyle}, h);
            })
          )
        ),
        React.createElement("tbody", null,
          sortedMatRows(matRows).map(function(r) {
            return React.createElement("tr", {key:r.id, style:{borderBottom:"1px solid "+C.borderLight}},
              React.createElement("td", {style:tdStyle}, React.createElement("input", {value:r.matType,onChange:function(e){updateMatRow(r.id,"matType",e.target.value);},style:Object.assign({},iStyle,{width:110})})),
              React.createElement("td", {style:tdStyle}, React.createElement("input", {value:r.rValue,onChange:function(e){updateMatRow(r.id,"rValue",e.target.value);},style:Object.assign({},iStyle,{width:70})})),
              React.createElement("td", {style:tdStyle}, React.createElement("input", {value:r.wallHeight||r.width||"",onChange:function(e){updateMatRow(r.id,"wallHeight",e.target.value);},placeholder:"—",style:Object.assign({},iStyle,{width:80,color:r.wallHeight?"#2563eb":undefined})})),

              React.createElement("td", {style:tdStyle}, React.createElement("input", {value:r.sqft,onChange:function(e){updateMatRow(r.id,"sqft",e.target.value);},style:Object.assign({},iStyle,{width:70})})),
              React.createElement("td", {style:tdStyle}, React.createElement("input", {type:"number",value:r.matOut,onChange:function(e){updateMatRow(r.id,"matOut",e.target.value);},style:Object.assign({},iStyle,{width:70})})),
              React.createElement("td", {style:tdStyle}, React.createElement("input", {type:"number",value:r.matIn,onChange:function(e){updateMatRow(r.id,"matIn",e.target.value);},style:Object.assign({},iStyle,{width:70})})),
              React.createElement("td", {style:tdStyle}, React.createElement("input", {type:"number",value:r.count,onChange:function(e){updateMatRow(r.id,"count",e.target.value);},style:Object.assign({},iStyle,{width:60})})),
              React.createElement("td", {style:tdStyle}, React.createElement("button", {onClick:function(){deleteMatRow(r.id);},style:{background:"none",border:"none",color:C.danger,fontSize:14,cursor:"pointer",fontWeight:700}}, "×"))
            );
          })
        )
      )
    ),
    React.createElement("button", {onClick:addMatRow,style:{marginTop:8,fontSize:11,fontWeight:700,background:"none",border:"1px dashed "+C.border,borderRadius:4,color:C.textSec,padding:"4px 14px",cursor:"pointer",fontFamily:"'Inter',sans-serif",textTransform:"uppercase",letterSpacing:"0.06em"}}, "+ Add Row"),

    secHead("Notes"),
    React.createElement("textarea", {value:notes,onChange:function(e){setNotes(e.target.value);},placeholder:"Job notes...",rows:3,style:{width:"100%",boxSizing:"border-box",padding:"8px",border:"1px solid "+C.inputBorder,borderRadius:6,fontSize:12,fontFamily:"'Inter',sans-serif",color:C.text,resize:"vertical"}}),


    React.createElement("div",{style:{textAlign:"center",fontSize:11,fontWeight:700,letterSpacing:"0.05em",color:C.dim,marginTop:24,paddingTop:12,borderTop:"1px solid "+C.border}},"Work Order Must Be Filled Out Completely")
  );
}

/* ══════════ MAIN APP ══════════ */

function QuoteView({ onBack, adminName }) {
  var currentUser = adminName;
  var s1 = useState("takeoff"), sec = s1[0], setSec = s1[1];
  var s2 = useState([]), meas = s2[0], setMeas = s2[1];
  var s3 = useState([newOption("Option 1")]), qOpts = s3[0], setQOpts = s3[1];
  var s4 = useState([]), ii = s4[0], setIi = s4[1];
  var spi = useState(false), showProductInfo = spi[0], setShowProductInfo = spi[1];
  var s5 = useState(""), cn = s5[0], setCn = s5[1];
  var s6 = useState(""), ca = s6[0], setCa = s6[1];
  var s7 = useState(""), cph = s7[0], setCph = s7[1];
  var s8 = useState(""), ce = s8[0], setCe = s8[1];
  var s9 = useState(""), ja = s9[0], setJa = s9[1];
  var s11 = useState(""), jn = s11[0], setJn = s11[1];
  var s10 = useState(true), initialLoad = s10[0], setInitialLoad = s10[1];

  // Auto-save current session to Supabase
  var autoSave = useCallback(function() {
    if (!currentUser) return;
    var data = { measurements: meas, quoteOpts: qOpts, importedItems: ii, custName: cn, custAddr: ca, custPhone: cph, custEmail: ce, jobAddr: ja, jobNotes: jn, section: sec };
    saveAutosave(currentUser, data);
  }, [meas, qOpts, ii, cn, ca, cph, ce, ja, jn, sec, currentUser]);

  useEffect(function() {
    if (initialLoad || !currentUser) return;
    var timer = setTimeout(autoSave, 2000);
    return function() { clearTimeout(timer); };
  }, [autoSave, initialLoad, currentUser]);

  // Load auto-saved session on login
  useEffect(function() {
    if (!currentUser) return;
    loadAutosave(currentUser).then(function(data) {
      if (data) {
        if (data.measurements) setMeas(data.measurements);
        if (data.quoteOpts) setQOpts(data.quoteOpts);
        else if (data.quoteItems && data.quoteItems.length > 0) setQOpts([Object.assign(newOption("Option 1"),{items:data.quoteItems})]);
        if (data.importedItems) setIi(data.importedItems);
        if (data.custName) setCn(data.custName);
        if (data.custAddr) setCa(data.custAddr);
        if (data.custPhone) setCph(data.custPhone);
        if (data.custEmail) setCe(data.custEmail);
        if (data.jobAddr) setJa(data.jobAddr);
        if (data.jobNotes) setJn(data.jobNotes);
        if (data.section) setSec(data.section);
      }
      setInitialLoad(false);
    });
  }, [currentUser]);

  useEffect(function(){
    var saved=localStorage.getItem("ist-session");
    if(saved){try{var obj=JSON.parse(saved);if(obj.user&&obj.ts&&(Date.now()-obj.ts)<7200000){setCurrentUser(obj.user);}}catch(e){}}
  },[]);

  

  function sendToWorkOrder() { setSec("workorder"); }

  function sendToQuote() {
    if (meas.length === 0) return;
    setIi(function(prev) { return prev.concat(meas.map(function(m) { return Object.assign({}, m, { priced: false }); })); });
    setSec("quote");
  }

  function handleNewJob() {
    var hasWork = meas.length > 0 || qOpts.some(function(o){return o.items.length>0;});
    if (hasWork && !confirm("Start a new job? Make sure you've saved first.")) return;
    setMeas([]); setQOpts([newOption("Option 1")]); setIi([]);
    setCn(""); setCa(""); setCph(""); setCe(""); setJa(""); setJn("");
    setSec("takeoff");
  }

  

  var cp2 = { custName: cn, setCustName: setCn, custAddr: ca, setCustAddr: setCa, custPhone: cph, setCustPhone: setCph, custEmail: ce, setCustEmail: setCe, jobAddr: ja, setJobAddr: setJa, jobNotes: jn, setJobNotes: setJn };

  return (
    <div className="ist-app" style={{ fontFamily: "'Inter', sans-serif", color: C.text, paddingBottom: 32 }}><div style={{ maxWidth: 1140, margin: "0 auto" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        html, body { background: linear-gradient(135deg, #e8eef8 0%, #dde6f5 40%, #cdd9f0 100%); margin: 0; min-height: 100vh; background-attachment: fixed; }
        .ist-app { background: transparent; min-height: 100vh; }
        .ist-app::before { content: ''; position: fixed; inset: 0; background: radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.5) 0%, transparent 70%); pointer-events: none; z-index: 0; }
        .ist-app > * { position: relative; z-index: 1; }
        .ist-2col { display: flex; flex-direction: column; }
        .ist-col-form { min-width: 0; }
        .ist-col-results { min-width: 0; }
        @media (min-width: 768px) {
          .ist-2col { flex-direction: row; align-items: flex-start; gap: 28px; padding: 16px 24px 0; }
          .ist-col-form { flex: 0 0 400px; }
          .ist-col-results { flex: 1 1 0; padding-top: 4px; }
        }
        @media (min-width: 1024px) { .ist-col-form { flex: 0 0 440px; } }
        .ist-clear-btn-inner { max-width: 1140px; margin: 0 auto; }
        input::placeholder, textarea::placeholder { color: rgba(100,116,139,0.5) !important; }
        input, textarea, select { color-scheme: light; }
        * { box-sizing: border-box; }
      `}</style>

      {/* HEADER */}
      <div style={{ background: "rgba(255,255,255,0.55)", backdropFilter: "blur(32px)", WebkitBackdropFilter: "blur(32px)", padding: "18px 20px 0", borderBottom: "none", borderRadius: "0 0 24px 24px", textAlign: "center", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 8px 40px rgba(180,200,240,0.25), inset 0 1px 0 rgba(255,255,255,0.9)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={function(){if(window.confirm("Clear everything?")){setMeas([]);setQOpts([newOption("Option 1")]);setIi([]);setCn("");setCa("");setCph("");setCe("");setJa("");setJn("");setSec("takeoff");}}} style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 6, color: C.danger, fontSize: 10, cursor: "pointer", fontFamily: "'Inter', sans-serif", fontWeight: 700, textTransform: "uppercase", padding: "5px 10px", letterSpacing: "0.04em" }}>{"🗑 Clear"}</button>
            
          </div>
        </div>
        <button onClick={onBack} style={{ position: "absolute", left: 16, top: 16, background: "none", border: "none", color: "#2563eb", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>← Dispatch</button>
        <h1 style={{ fontSize: 17, fontWeight: 800, color: C.text, letterSpacing: "0.05em", margin: 0, textTransform: "uppercase" }}>{"Insulation Services of Tulsa"}</h1>
        <div style={{ fontSize: 10, color: C.dim, marginTop: 3, letterSpacing: "0.14em", textTransform: "uppercase" }}>{COMPANY.tagline}</div>

        <div className="ist-nav-tabs" style={{ display: "flex", gap: 0, overflow: "hidden", borderTop: "1px solid rgba(0,0,0,0.06)", marginTop: 14 }}>
          {[
            { id: "takeoff", label: "TAKE OFF", badge: meas.length || null },
            { id: "quote", label: "QUOTE", badge: qOpts.reduce(function(s,o){return s+o.items.length;},0) || null },
            { id: "workorder", label: "WORK ORDER", badge: null },
            { id: "jobs", label: "JOBS", badge: null },
          ].map(function(t) {
            var active = sec === t.id;
            return (
              <button key={t.id} onClick={function() { setSec(t.id); }}
                style={{ flex: 1, padding: "10px 6px", border: "none", borderRight: "1px solid rgba(0,0,0,0.05)", cursor: "pointer", fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", background: active ? "rgba(255,255,255,0.5)" : "transparent", color: active ? C.accent : C.dim, transition: "all 0.15s ease", boxShadow: active ? "inset 0 -2px 0 "+C.accent : "none" }}>
                {t.label}
                {t.badge ? (<span style={{ display: "inline-block", marginLeft: 5, background: active ? C.accent : "rgba(0,0,0,0.08)", color: active ? "#fff" : C.textSec, fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 6, minWidth: 18, textAlign: "center" }}>{t.badge}</span>) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        {sec === "takeoff" && (<TakeOff measurements={meas} setMeasurements={setMeas} onSendToQuote={sendToQuote} onSendToWorkOrder={sendToWorkOrder} currentUser={currentUser} quoteOpts={qOpts} {...cp2} />)}
        {sec === "quote" && (<QuoteBuilderSection quoteOpts={qOpts} setQuoteOpts={setQOpts} importedItems={ii} setImportedItems={setIi} currentUser={currentUser} measurements={meas} showProductInfo={showProductInfo} setShowProductInfo={setShowProductInfo} {...cp2} />)}
        {sec === "workorder" && (<WorkOrderSection measurements={meas} quoteOpts={qOpts} custName={cn} custAddr={ca} currentUser={currentUser} jobAddr={ja} />)}
        {sec === "jobs" && (
          <div>
            <SavedJobsPanel
              measurements={meas} quoteOpts={qOpts} importedItems={ii}
              setMeasurements={setMeas} setQuoteOpts={setQOpts} setImportedItems={setIi}
              section={sec} setSection={setSec}
              currentUser={currentUser}
              {...cp2}
            />
            <div style={{ padding: "0 16px" }}>
              <button onClick={handleNewJob}
                style={{ width: "100%", padding: "12px 16px", borderRadius: 6, border: "1px solid " + C.borderLight, background: "transparent", color: C.text, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {"+ New Job"}
              </button>
            </div>
          </div>
        )}
      </div>


    </div></div>
  );
}


// ─── Main App ───
export default function App() {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);
  const [launcherDismissed, setLauncherDismissed] = useState(false);
  const [adminView, setAdminView] = useState("dispatch"); // "dispatch" | "quotes"
  const [crewSession, setCrewSession] = useState(null);
  const [adminName, setAdminName] = useState(null);
  const [trucks, setTrucks] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [jobUpdates, setJobUpdates] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  const [returnLog, setReturnLog] = useState([]);
  const [loadLog, setLoadLog] = useState([]);
  const [pmUpdates, setPmUpdates] = useState([]);
  const [members, setMembers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [truckInventory, setTruckInventory] = useState({});
  const [tools, setTools] = useState([]);
  const [toolCheckouts, setToolCheckouts] = useState([]);
  const [employeeFlags, setEmployeeFlags] = useState([]);

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
    const unsubJobUpdates = onSnapshot(collection(db, "jobUpdates"), (snap) => { setJobUpdates(snap.docs.map(d => ({ id: d.id, ...d.data() }))); });
    const unsubTools = onSnapshot(collection(db, "tools"), (snap) => { setTools(snap.docs.map(d => ({ id: d.id, ...d.data() }))); });
    const unsubToolCheckouts = onSnapshot(collection(db, "toolCheckouts"), (snap) => { setToolCheckouts(snap.docs.map(d => ({ id: d.id, ...d.data() }))); });
    const unsubEmpFlags = onSnapshot(collection(db, "employeeFlags"), (snap) => { setEmployeeFlags(snap.docs.map(d => ({ id: d.id, ...d.data() }))); });
    return () => { unsubTrucks(); unsubJobs(); unsubUpdates(); unsubTickets(); unsubLog(); unsubPm(); unsubMembers(); unsubInv(); unsubTruckInv(); unsubReturnLog(); unsubJobUpdates(); unsubTools(); unsubToolCheckouts(); unsubEmpFlags(); };
  }, []);

  const handleAddTruck = async (data) => { await addDoc(collection(db, "trucks"), data); };
  const handleDeleteTruck = async (id) => { await deleteDoc(doc(db, "trucks", id)); };
  const handleReorderTruck = async (id, newOrder) => { await updateDoc(doc(db, "trucks", id), { order: newOrder }); };
  const handleUpdateTruck = async (id, fields) => { await updateDoc(doc(db, "trucks", id), fields); };
  const handleAdminSetLoadout = async (truckId, newState, type = "adjusted", notes = "") => {
    const truckRef = doc(db, "truckInventory", truckId);
    await setDoc(truckRef, newState);
    // Log to loadLog or returnLog based on type
    const logItems = {};
    Object.entries(newState).forEach(([k, v]) => { if (k !== "_custom" && typeof v === "number" && v > 0) logItems[k] = v; });
    if (type === "loaded" && Object.keys(logItems).length > 0) {
      await addDoc(collection(db, "loadLog"), { truckId, items: logItems, notes, timestamp: new Date().toISOString() });
    }
  };
  const handleAdminUnload = async (truckId, itemsToUnload, unloadQtys, notes = "") => {
    const truckRef = doc(db, "truckInventory", truckId);
    const snap = await getDoc(truckRef);
    const state = snap.exists() ? { ...snap.data() } : {};
    const logItems = {};
    for (const item of itemsToUnload) {
      const qty = parseFloat(unloadQtys[item.key]) || 0;
      if (qty <= 0) continue;
      if (item.isCustom) {
        const custom = (state._custom || []).map(c => {
          if (c.name === item.name) return { ...c, qty: Math.max(0, c.qty - qty) };
          return c;
        }).filter(c => c.qty > 0);
        state._custom = custom;
        logItems["custom_" + item.name] = qty;
        // Add to warehouse inventory as a custom item (find or create)
        const existingInv = inventory.find(r => r.itemId === "custom_" + item.name);
        const curQty = existingInv?.qty || 0;
        await handleUpdateInventory("custom_" + item.name, curQty + qty);
      } else {
        const cur = state[item.key] || 0;
        const newQty = Math.max(0, Math.round((cur - qty) * 100) / 100);
        if (newQty > 0) state[item.key] = newQty; else delete state[item.key];
        logItems[item.key] = qty;
        // Add back to warehouse inventory
        const existingInv = inventory.find(r => r.itemId === item.key);
        const curQty = existingInv?.qty || 0;
        await handleUpdateInventory(item.key, Math.round((curQty + qty) * 100) / 100);
      }
    }
    await setDoc(truckRef, state);
    if (Object.keys(logItems).length > 0) {
      await addDoc(collection(db, "returnLog"), { truckId, items: logItems, notes, timestamp: new Date().toISOString() });
    }
  };
  const handleAddJob = async (data) => { await addDoc(collection(db, "jobs"), data); };
  const handleAddJobUpdate = async (data) => { await addDoc(collection(db, "jobUpdates"), { ...data, createdAt: serverTimestamp() }); };
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

  const [foamPartsInventory, setFoamPartsInventory] = React.useState([]);
  const [projectToolsInventory, setProjectToolsInventory] = React.useState([]);

  React.useEffect(() => {
    const unsub1 = onSnapshot(collection(db, "foamGunParts"), snap => {
      setFoamPartsInventory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsub2 = onSnapshot(collection(db, "projectToolsInventory"), snap => {
      setProjectToolsInventory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsub1(); unsub2(); };
  }, []);

  const handleUpdateFoamParts = async (itemId, qty) => {
    const existing = foamPartsInventory.find(r => r.itemId === itemId);
    if (existing) { await updateDoc(doc(db, "foamGunParts", existing.id), { qty, updatedAt: new Date().toISOString() }); }
    else { await addDoc(collection(db, "foamGunParts"), { itemId, qty, updatedAt: new Date().toISOString() }); }
  };

  const handleUpdateProjectTools = async (itemId, qty) => {
    const existing = projectToolsInventory.find(r => r.itemId === itemId);
    if (existing) { await updateDoc(doc(db, "projectToolsInventory", existing.id), { qty, updatedAt: new Date().toISOString() }); }
    else { await addDoc(collection(db, "projectToolsInventory"), { itemId, qty, updatedAt: new Date().toISOString() }); }
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
      await addDoc(collection(db, "returnLog"), { truckId, items: logItems, timestamp: new Date().toISOString(), crewMemberId: crewSession?.memberId || null, crewName: crewSession?.crewName || null });
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
      await addDoc(collection(db, "loadLog"), { truckId, items: logItems, timestamp: new Date().toISOString(), crewMemberId: crewSession?.memberId || null, crewName: crewSession?.crewName || null });
    }
  };
  const handleAddTool = async (data) => { await addDoc(collection(db, "tools"), { ...data, createdAt: new Date().toISOString() }); };
  const handleEditTool = async (id, data) => { await updateDoc(doc(db, "tools", id), data); };
  const handleDeleteTool = async (id) => { await deleteDoc(doc(db, "tools", id)); };
  const handleToolCheckout = async (data) => { await addDoc(collection(db, "toolCheckouts"), { ...data, returnedAt: null }); };
  const handleToolReturn = async (checkoutId, returnStatus) => { await updateDoc(doc(db, "toolCheckouts", checkoutId), { returnedAt: new Date().toISOString(), returnStatus: returnStatus || "good" }); };
  const handleSetEmployeeFlag = async (employeeName, override, note) => {
    const flagId = employeeName.toLowerCase().replace(/\s+/g, "_");
    await setDoc(doc(db, "employeeFlags", flagId), { employeeName, override, note: note || "", updatedAt: new Date().toISOString() }, { merge: true });
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
    return <CrewDashboard truck={truck} crewName={crewSession.crewName} crewMemberId={crewSession.memberId} jobs={jobs} updates={updates} jobUpdates={jobUpdates} tickets={tickets} inventory={inventory} truckInventory={truckInventory[truck?.id] || {}} tools={tools} toolCheckouts={toolCheckouts} loadLog={loadLog} returnLog={returnLog} onSubmitUpdate={handleSubmitUpdate} onSubmitTicket={handleSubmitTicket} onCloseOutJob={handleCloseOutJob} onSaveJobMaterials={handleSaveJobMaterials} onLoadTruck={handleLoadTruck} onReturnMaterial={handleReturnMaterial} onDeductFromTruck={handleDeductFromTruck} onDeltaAdjustTruck={handleDeltaAdjustTruck} onLogDailyMaterials={handleLogDailyMaterials} onToolCheckout={handleToolCheckout} onToolReturn={handleToolReturn} onLogout={() => { setCrewSession(null); setRole(null); }} />;
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
        <button onClick={() => { setLauncherDismissed(true); setAdminView("dispatch"); }} className="kb-card" style={{ padding: "20px 24px", borderRadius: 14, border: "none", color: "#fff", fontWeight: 700, fontSize: 17, cursor: "pointer", fontFamily: "inherit", textAlign: "left", width: "100%" }}>
          Dispatch
          <div style={{ fontSize: 12, fontWeight: 400, opacity: 0.75, marginTop: 4 }}>Manage crews, jobs &amp; schedule</div>
        </button>
        <button onClick={() => { setLauncherDismissed(true); setAdminView("quotes"); }} className="kb-card" style={{ padding: "20px 24px", borderRadius: 14, border: "none", color: "#fff", fontWeight: 700, fontSize: 17, cursor: "pointer", fontFamily: "inherit", textAlign: "left", width: "100%" }}>
          Quote Builder
          <div style={{ fontSize: 12, fontWeight: 400, opacity: 0.75, marginTop: 4 }}>Build and send customer quotes</div>
        </button>
        <a href="https://istintel.com" className="kb-card" style={{ padding: "20px 24px", borderRadius: 14, color: "#fff", fontWeight: 700, fontSize: 17, cursor: "pointer", fontFamily: "inherit", textAlign: "left", textDecoration: "none", display: "block" }}>
          IST Intel
          <div style={{ fontSize: 12, fontWeight: 400, opacity: 0.75, marginTop: 4 }}>Permits and intelligence</div>
        </a>
      </div>
      <button onClick={() => { setAdminName(null); setRole(null); setLauncherDismissed(false); }} style={{ marginTop: 24, background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer", fontFamily: "inherit", width: "100%" }}>Sign Out</button>
    </AuthShell>
    </div>
  );
  if (role === "admin" && adminView === "quotes") return <QuoteView adminName={adminName} onBack={() => setAdminView("dispatch")} onLogout={() => { setAdminName(null); setRole(null); setLauncherDismissed(false); setAdminView("dispatch"); }} />;
  if (role === "admin") return <AdminDashboard adminName={adminName} trucks={trucks} jobs={jobs} updates={updates} jobUpdates={jobUpdates} tickets={tickets} activityLog={activityLog} pmUpdates={pmUpdates} members={members} inventory={inventory} truckInventory={truckInventory} returnLog={returnLog} loadLog={loadLog} tools={tools} toolCheckouts={toolCheckouts} employeeFlags={employeeFlags} onAddTool={handleAddTool} onEditTool={handleEditTool} onDeleteTool={handleDeleteTool} onCheckout={handleToolCheckout} onReturn={handleToolReturn} onSetFlag={handleSetEmployeeFlag} onAddTruck={handleAddTruck} onDeleteTruck={handleDeleteTruck} onReorderTruck={handleReorderTruck} onAddJob={handleAddJob} onEditJob={handleEditJob} onDeleteJob={handleDeleteJob} onUpdateTicket={handleUpdateTicket} onSubmitTicket={handleSubmitTicket} onLogAction={handleLogAction} onSubmitPmUpdate={handleSubmitPmUpdate} onUpdateInventory={handleUpdateInventory} onAddJobUpdate={handleAddJobUpdate} onUpdateTruck={handleUpdateTruck} onAdminSetLoadout={handleAdminSetLoadout} onAdminUnload={handleAdminUnload} onLogout={() => { setAdminName(null); setRole(null); setLauncherDismissed(false); }} foamPartsInventory={foamPartsInventory} projectToolsInventory={projectToolsInventory} onUpdateFoamParts={handleUpdateFoamParts} onUpdateProjectTools={handleUpdateProjectTools} />;
  return null;
}
