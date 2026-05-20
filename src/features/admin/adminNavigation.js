export const OFFICE_NAV_KEYS = Object.freeze({
  schedule: "schedule",
  calendar: "calendar",
  inventory: "inventory",
  foamPricing: "foamPricing",
  tickets: "tickets",
  trucks: "trucks",
  roster: "roster",
});

export const OFFICE_NAV_ITEMS = Object.freeze([
  { key: OFFICE_NAV_KEYS.schedule, label: "Schedule", badgeKey: null },
  { key: OFFICE_NAV_KEYS.calendar, label: "Calendar", badgeKey: null },
  { key: OFFICE_NAV_KEYS.inventory, label: "Inventory", badgeKey: "openChecklistShortageCount" },
  { key: OFFICE_NAV_KEYS.foamPricing, label: "Pricing", badgeKey: null },
  { key: OFFICE_NAV_KEYS.tickets, label: "Tickets", badgeKey: "openTicketCount" },
  { key: OFFICE_NAV_KEYS.trucks, label: "Trucks", badgeKey: null },
  { key: OFFICE_NAV_KEYS.roster, label: "Roster", badgeKey: null },
]);

const CLEAR_TRUCK_FILTER_KEYS = new Set([
  OFFICE_NAV_KEYS.schedule,
  OFFICE_NAV_KEYS.tickets,
]);

export const shouldClearTruckFilterForNav = (key) => CLEAR_TRUCK_FILTER_KEYS.has(key);

export const buildOfficeNavItems = (counts = {}) => OFFICE_NAV_ITEMS.map((item) => ({
  key: item.key,
  label: item.label,
  badge: item.badgeKey ? (counts[item.badgeKey] || 0) : 0,
}));
