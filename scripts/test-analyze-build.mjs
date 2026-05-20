import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { analyzeDist, formatBytes, formatReport } from './analyze-build.mjs';

const tmpRoot = await mkdtemp(path.join(tmpdir(), 'ist-build-analysis-'));

try {
  const missingDist = path.join(tmpRoot, 'missing-dist');
  await assert.rejects(
    () => analyzeDist(missingDist),
    (error) => {
      assert.equal(error.code, 'DIST_MISSING');
      assert.match(error.message, /Build output directory not found/);
      return true;
    },
  );

  const dist = path.join(tmpRoot, 'dist');
  await mkdir(path.join(dist, 'assets'), { recursive: true });
  await writeFile(path.join(dist, 'index.html'), '<div id="root"></div>');
  await writeFile(path.join(dist, 'assets', 'main-abc123.js'), 'console.log("main");'.repeat(100));
  await writeFile(path.join(dist, 'assets', 'vendor-def456.js'), 'export const vendor = true;'.repeat(50));
  await writeFile(path.join(dist, 'assets', 'style.css'), 'body{color:#111;}'.repeat(20));

  const analysis = await analyzeDist(dist);

  assert.equal(analysis.distPath, dist);
  assert.equal(analysis.assetCount, 4);
  assert.equal(analysis.chunkCount, 2);
  assert.equal(analysis.jsAssets.length, 2);
  assert.equal(analysis.largestJs.path, 'assets/main-abc123.js');
  assert.ok(analysis.totalBytes > 0);
  assert.ok(analysis.totalGzipBytes > 0);
  assert.ok(analysis.assets.every((asset) => Number.isInteger(asset.bytes)));
  assert.ok(analysis.assets.every((asset) => Number.isInteger(asset.gzipBytes)));

  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(1024), '1.00 KiB');

  const report = formatReport(analysis);
  assert.match(report, /Build analysis for/);
  assert.match(report, /JavaScript chunks: 2/);
  assert.match(report, /Largest JS: assets\/main-abc123\.js/);
  assert.match(report, /Gzip/);
} finally {
  if (existsSync(tmpRoot)) {
    await rm(tmpRoot, { recursive: true, force: true });
  }
}

console.log('analyze-build self-check passed');
