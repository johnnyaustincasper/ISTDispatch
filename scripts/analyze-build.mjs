#!/usr/bin/env node

import { readdir, stat, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const DEFAULT_DIST = 'dist';

function createDistMissingError(distPath) {
  const error = new Error(`Build output directory not found: ${distPath}. Run \`npm run build\` before analyzing.`);
  error.code = 'DIST_MISSING';
  return error;
}

async function collectFiles(rootPath, currentPath = rootPath) {
  const entries = await readdir(currentPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(currentPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(rootPath, entryPath));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KiB', 'MiB', 'GiB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** index);

  if (index === 0) return `${bytes} B`;
  return `${value.toFixed(2)} ${units[index]}`;
}

export async function analyzeDist(distPath = path.resolve(process.cwd(), DEFAULT_DIST)) {
  const resolvedDistPath = path.resolve(distPath);

  if (!existsSync(resolvedDistPath) || !(await stat(resolvedDistPath)).isDirectory()) {
    throw createDistMissingError(resolvedDistPath);
  }

  const filePaths = await collectFiles(resolvedDistPath);
  const assets = await Promise.all(filePaths.map(async (filePath) => {
    const buffer = await readFile(filePath);
    const relativePath = path.relative(resolvedDistPath, filePath).split(path.sep).join('/');

    return {
      path: relativePath,
      ext: path.extname(filePath).toLowerCase() || '(none)',
      bytes: buffer.byteLength,
      gzipBytes: gzipSync(buffer).byteLength,
    };
  }));

  assets.sort((a, b) => b.bytes - a.bytes || a.path.localeCompare(b.path));

  const jsAssets = assets.filter((asset) => asset.ext === '.js');
  const totalBytes = assets.reduce((sum, asset) => sum + asset.bytes, 0);
  const totalGzipBytes = assets.reduce((sum, asset) => sum + asset.gzipBytes, 0);
  const largestJs = jsAssets[0] ?? null;

  return {
    distPath: resolvedDistPath,
    generatedAt: new Date().toISOString(),
    assetCount: assets.length,
    chunkCount: jsAssets.length,
    totalBytes,
    totalGzipBytes,
    largestJs,
    assets,
    jsAssets,
  };
}

export function formatReport(analysis) {
  const largestJs = analysis.largestJs
    ? `${analysis.largestJs.path} - ${formatBytes(analysis.largestJs.bytes)} (${formatBytes(analysis.largestJs.gzipBytes)} gzip)`
    : 'none';

  const lines = [
    `Build analysis for ${analysis.distPath}`,
    `Generated: ${analysis.generatedAt}`,
    `Assets: ${analysis.assetCount}`,
    `JavaScript chunks: ${analysis.chunkCount}`,
    `Largest JS: ${largestJs}`,
    `Total size: ${formatBytes(analysis.totalBytes)} (${formatBytes(analysis.totalGzipBytes)} gzip)`,
    '',
    'Assets by size:',
    'Path | Size | Gzip | Type',
  ];

  for (const asset of analysis.assets) {
    lines.push(`${asset.path} | ${formatBytes(asset.bytes)} | ${formatBytes(asset.gzipBytes)} | ${asset.ext}`);
  }

  return lines.join('\n');
}

function parseArgs(argv) {
  const options = {
    distPath: path.resolve(process.cwd(), DEFAULT_DIST),
    json: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--json') {
      options.json = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--dist') {
      const value = argv[index + 1];
      if (!value) throw new Error('Missing value for --dist');
      options.distPath = path.resolve(process.cwd(), value);
      index += 1;
    } else if (arg.startsWith('--dist=')) {
      options.distPath = path.resolve(process.cwd(), arg.slice('--dist='.length));
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function printHelp() {
  console.log(`Usage: node scripts/analyze-build.mjs [--dist dist] [--json]\n\nReads Vite build output and reports asset sizes, gzip sizes, JavaScript chunk count, and largest JavaScript file.\n\nOptions:\n  --dist <path>  Build output directory to analyze (default: dist)\n  --json         Print raw JSON instead of the human-readable report\n  -h, --help     Show this help message`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  const analysis = await analyzeDist(options.distPath);

  if (options.json) {
    console.log(JSON.stringify(analysis, null, 2));
  } else {
    console.log(formatReport(analysis));
  }
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isCli) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
