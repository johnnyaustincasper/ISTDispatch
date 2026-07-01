import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { checkBuildBudget, formatBudgetReport } from './check-build-budget.mjs';

const tmpRoot = await mkdtemp(path.join(tmpdir(), 'ist-build-budget-'));

async function makeDist(name, { indexHtml, indexJs = 'console.log("entry");', vendorJs = 'export const pdf = true;' } = {}) {
  const dist = path.join(tmpRoot, name);
  await mkdir(path.join(dist, 'assets'), { recursive: true });
  await writeFile(
    path.join(dist, 'index.html'),
    indexHtml ?? '<div id="root"></div><script type="module" crossorigin src="/assets/index-ok.js"></script>',
  );
  await writeFile(path.join(dist, 'assets', 'index-ok.js'), indexJs);
  await writeFile(path.join(dist, 'assets', 'vendor-pdf-export-abc123.js'), vendorJs);
  return dist;
}

try {
  const passingDist = await makeDist('passing', {
    indexJs: 'const loadPdf = () => import("./vendor-pdf-export-abc123.js"); console.log(loadPdf);',
  });
  const passing = await checkBuildBudget(passingDist, {
    totalGzipBytes: 50_000,
    mainGzipBytes: 50_000,
  });

  assert.equal(passing.ok, true);
  assert.deepEqual(passing.failures, []);
  assert.equal(passing.mainAsset.path, 'assets/index-ok.js');
  assert.match(formatBudgetReport(passing), /Build budget check passed/);

  const overBudget = await checkBuildBudget(passingDist, {
    totalGzipBytes: 1,
    mainGzipBytes: 1,
  });

  assert.equal(overBudget.ok, false);
  assert.ok(overBudget.failures.some((failure) => failure.code === 'TOTAL_GZIP_BUDGET'));
  assert.ok(overBudget.failures.some((failure) => failure.code === 'MAIN_GZIP_BUDGET'));
  assert.match(formatBudgetReport(overBudget), /Build budget check failed/);

  const preloadedVendorDist = await makeDist('preloaded-vendor', {
    indexHtml: '<link rel="modulepreload" href="/assets/vendor-pdf-export-abc123.js"><script type="module" src="/assets/index-ok.js"></script>',
  });
  const preloadedVendor = await checkBuildBudget(preloadedVendorDist, {
    totalGzipBytes: 50_000,
    mainGzipBytes: 50_000,
  });

  assert.equal(preloadedVendor.ok, false);
  assert.ok(preloadedVendor.failures.some((failure) => failure.code === 'VENDOR_PDF_EXPORT_PRELOAD'));

  const staticImportDist = await makeDist('static-import', {
    indexJs: 'import{exportPdf as p}from"./vendor-pdf-export-abc123.js"; console.log(p);',
  });
  const staticImport = await checkBuildBudget(staticImportDist, {
    totalGzipBytes: 50_000,
    mainGzipBytes: 50_000,
  });

  assert.equal(staticImport.ok, false);
  assert.ok(staticImport.failures.some((failure) => failure.code === 'VENDOR_PDF_EXPORT_STATIC_IMPORT'));
} finally {
  if (existsSync(tmpRoot)) {
    await rm(tmpRoot, { recursive: true, force: true });
  }
}

console.log('build-budget self-check passed');
