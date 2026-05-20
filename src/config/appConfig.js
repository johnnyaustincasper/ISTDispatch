import { getFeatureFlags, summarizeFeatureFlags } from "./featureFlags.js";

export const REQUIRED_FIREBASE_ENV_VARS = Object.freeze([
  "VITE_FB_API_KEY",
  "VITE_FB_AUTH_DOMAIN",
  "VITE_FB_PROJECT_ID",
  "VITE_FB_STORAGE_BUCKET",
  "VITE_FB_MESSAGING_ID",
  "VITE_FB_APP_ID",
]);

const FIREBASE_FIELD_ENV_MAP = Object.freeze({
  apiKey: "VITE_FB_API_KEY",
  authDomain: "VITE_FB_AUTH_DOMAIN",
  projectId: "VITE_FB_PROJECT_ID",
  storageBucket: "VITE_FB_STORAGE_BUCKET",
  messagingSenderId: "VITE_FB_MESSAGING_ID",
  appId: "VITE_FB_APP_ID",
});

const getViteEnv = () => {
  try {
    return import.meta?.env || {};
  } catch {
    return {};
  }
};

const isPresent = (value) => value != null && String(value).trim() !== "";

export const getBuildMetadata = (env = getViteEnv()) => ({
  mode: env.MODE || env.NODE_ENV || null,
  dev: Boolean(env.DEV),
  prod: Boolean(env.PROD),
  ssr: Boolean(env.SSR),
  baseUrl: env.BASE_URL || null,
  version: env.VITE_APP_VERSION || env.VITE_VERSION || env.npm_package_version || null,
  commit: env.VITE_GIT_SHA || env.VITE_GIT_COMMIT || env.VITE_COMMIT_SHA || null,
  branch: env.VITE_GIT_BRANCH || null,
  builtAt: env.VITE_BUILD_TIME || env.VITE_BUILT_AT || null,
});

export const getEnvironmentName = (env = getViteEnv()) => (
  env.VITE_APP_ENV || env.VITE_ENVIRONMENT || env.MODE || env.NODE_ENV || "unknown"
);

export const validateRequiredEnv = (env = getViteEnv(), requiredNames = REQUIRED_FIREBASE_ENV_VARS) => {
  const present = requiredNames.filter((name) => isPresent(env[name]));
  const missing = requiredNames.filter((name) => !isPresent(env[name]));
  return {
    ok: missing.length === 0,
    required: [...requiredNames],
    present,
    missing,
    presentCount: present.length,
    missingCount: missing.length,
  };
};

export const getFirebaseConfig = (env = getViteEnv()) => Object.fromEntries(
  Object.entries(FIREBASE_FIELD_ENV_MAP).map(([field, envName]) => [field, env[envName] || ""]),
);

export const getFirebaseConfigEnvNames = () => ({ ...FIREBASE_FIELD_ENV_MAP });

export const createConfigHealthSummary = (env = getViteEnv()) => {
  const firebaseEnv = validateRequiredEnv(env);
  const featureFlags = summarizeFeatureFlags(env);
  return {
    ok: firebaseEnv.ok,
    environment: getEnvironmentName(env),
    build: getBuildMetadata(env),
    firebase: {
      ok: firebaseEnv.ok,
      required: firebaseEnv.required,
      present: firebaseEnv.present,
      missing: firebaseEnv.missing,
      presentCount: firebaseEnv.presentCount,
      missingCount: firebaseEnv.missingCount,
    },
    featureFlags,
  };
};

export const getAppConfig = (env = getViteEnv()) => ({
  environment: getEnvironmentName(env),
  build: getBuildMetadata(env),
  firebase: getFirebaseConfig(env),
  firebaseEnv: validateRequiredEnv(env),
  featureFlags: getFeatureFlags(env),
});

export const appConfig = getAppConfig();
