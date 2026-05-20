import assert from 'node:assert/strict';

import {
  REQUIRED_FIREBASE_ENV_VARS,
  createConfigHealthSummary,
  getAppConfig,
  getBuildMetadata,
  getEnvironmentName,
  getFirebaseConfig,
  getFirebaseConfigEnvNames,
  validateRequiredEnv,
} from '../src/config/appConfig.js';
import {
  FEATURE_FLAG_DEFINITIONS,
  getFeatureFlags,
  parseFeatureFlagValue,
  summarizeFeatureFlags,
} from '../src/config/featureFlags.js';

const completeEnv = {
  MODE: 'production',
  PROD: true,
  BASE_URL: '/',
  VITE_APP_ENV: 'staging',
  VITE_APP_VERSION: '2.0.0',
  VITE_GIT_SHA: 'abc123',
  VITE_BUILD_TIME: '2026-05-20T12:00:00.000Z',
  VITE_FB_API_KEY: 'api-key-value',
  VITE_FB_AUTH_DOMAIN: 'example.firebaseapp.com',
  VITE_FB_PROJECT_ID: 'ist-dispatch',
  VITE_FB_STORAGE_BUCKET: 'ist-dispatch.appspot.com',
  VITE_FB_MESSAGING_ID: '123456',
  VITE_FB_APP_ID: '1:123456:web:abcdef',
  VITE_FEATURE_DIAGNOSTICS: 'false',
  VITE_FEATURE_INVENTORY_PARITY: '1',
};

assert.deepEqual(REQUIRED_FIREBASE_ENV_VARS, [
  'VITE_FB_API_KEY',
  'VITE_FB_AUTH_DOMAIN',
  'VITE_FB_PROJECT_ID',
  'VITE_FB_STORAGE_BUCKET',
  'VITE_FB_MESSAGING_ID',
  'VITE_FB_APP_ID',
]);

assert.equal(parseFeatureFlagValue('true'), true);
assert.equal(parseFeatureFlagValue('0', true), false);
assert.equal(parseFeatureFlagValue('', true), true);
assert.equal(parseFeatureFlagValue('unexpected', false), false);

assert.equal(getEnvironmentName(completeEnv), 'staging');
assert.deepEqual(getBuildMetadata(completeEnv), {
  mode: 'production',
  dev: false,
  prod: true,
  ssr: false,
  baseUrl: '/',
  version: '2.0.0',
  commit: 'abc123',
  branch: null,
  builtAt: '2026-05-20T12:00:00.000Z',
});

const validation = validateRequiredEnv(completeEnv);
assert.equal(validation.ok, true);
assert.deepEqual(validation.missing, []);
assert.deepEqual(validation.present, REQUIRED_FIREBASE_ENV_VARS);

const incompleteValidation = validateRequiredEnv({ VITE_FB_API_KEY: 'present', VITE_FB_APP_ID: '   ' });
assert.equal(incompleteValidation.ok, false);
assert.deepEqual(incompleteValidation.present, ['VITE_FB_API_KEY']);
assert.deepEqual(incompleteValidation.missing, [
  'VITE_FB_AUTH_DOMAIN',
  'VITE_FB_PROJECT_ID',
  'VITE_FB_STORAGE_BUCKET',
  'VITE_FB_MESSAGING_ID',
  'VITE_FB_APP_ID',
]);

assert.deepEqual(getFirebaseConfigEnvNames(), {
  apiKey: 'VITE_FB_API_KEY',
  authDomain: 'VITE_FB_AUTH_DOMAIN',
  projectId: 'VITE_FB_PROJECT_ID',
  storageBucket: 'VITE_FB_STORAGE_BUCKET',
  messagingSenderId: 'VITE_FB_MESSAGING_ID',
  appId: 'VITE_FB_APP_ID',
});
assert.deepEqual(getFirebaseConfig(completeEnv), {
  apiKey: 'api-key-value',
  authDomain: 'example.firebaseapp.com',
  projectId: 'ist-dispatch',
  storageBucket: 'ist-dispatch.appspot.com',
  messagingSenderId: '123456',
  appId: '1:123456:web:abcdef',
});

const flags = getFeatureFlags(completeEnv);
assert.equal(flags.diagnostics, false);
assert.equal(flags.inventoryParity, true);
assert.equal(flags.debugExports, FEATURE_FLAG_DEFINITIONS.debugExports.defaultValue);

const flagSummary = summarizeFeatureFlags(completeEnv);
assert.equal(flagSummary.flags.diagnostics.configured, true);
assert.equal(flagSummary.flags.debugExports.configured, false);
assert.equal(flagSummary.total, Object.keys(FEATURE_FLAG_DEFINITIONS).length);

const health = createConfigHealthSummary(completeEnv);
assert.equal(health.ok, true);
assert.equal(health.firebase.missingCount, 0);
assert.equal(health.environment, 'staging');
assert.deepEqual(health.firebase.present, REQUIRED_FIREBASE_ENV_VARS);
assert.equal(health.featureFlags.flags.diagnostics.enabled, false);
assert.equal(JSON.stringify(health).includes('api-key-value'), false, 'health summary must not expose secret values');
assert.equal(JSON.stringify(health).includes('1:123456:web:abcdef'), false, 'health summary must not expose Firebase app id value');

const appConfig = getAppConfig(completeEnv);
assert.equal(appConfig.firebase.apiKey, 'api-key-value');
assert.equal(appConfig.firebaseEnv.ok, true);
assert.equal(appConfig.featureFlags.diagnostics, false);

console.log('config tests passed');
