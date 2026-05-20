const TRUE_VALUES = new Set(["1", "true", "yes", "on", "enabled"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off", "disabled"]);

export const FEATURE_FLAG_DEFINITIONS = Object.freeze({
  diagnostics: {
    envName: "VITE_FEATURE_DIAGNOSTICS",
    defaultValue: true,
    description: "Shows admin diagnostics/debug snapshot tooling.",
  },
  inventoryParity: {
    envName: "VITE_FEATURE_INVENTORY_PARITY",
    defaultValue: true,
    description: "Enables inventory parity health checks in diagnostics.",
  },
  debugExports: {
    envName: "VITE_FEATURE_DEBUG_EXPORTS",
    defaultValue: true,
    description: "Enables client-side debug snapshot copy/export actions.",
  },
});

export const parseFeatureFlagValue = (value, defaultValue = false) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value !== "string") return Boolean(defaultValue);

  const normalized = value.trim().toLowerCase();
  if (!normalized) return Boolean(defaultValue);
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return Boolean(defaultValue);
};

export const getFeatureFlags = (env = {}) => Object.fromEntries(
  Object.entries(FEATURE_FLAG_DEFINITIONS).map(([name, definition]) => [
    name,
    parseFeatureFlagValue(env[definition.envName], definition.defaultValue),
  ]),
);

export const summarizeFeatureFlags = (env = {}) => ({
  total: Object.keys(FEATURE_FLAG_DEFINITIONS).length,
  enabled: Object.values(getFeatureFlags(env)).filter(Boolean).length,
  flags: Object.fromEntries(
    Object.entries(FEATURE_FLAG_DEFINITIONS).map(([name, definition]) => [
      name,
      {
        enabled: parseFeatureFlagValue(env[definition.envName], definition.defaultValue),
        envName: definition.envName,
        defaultValue: definition.defaultValue,
        configured: Object.prototype.hasOwnProperty.call(env, definition.envName),
        description: definition.description,
      },
    ]),
  ),
});
