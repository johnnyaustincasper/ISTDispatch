#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { analyzeDist, formatBytes } from './analyze-build.mjs';

const DEFAULT_DIST = 'dist';

export const DEFAULT_BUDGETS = Object.freeze({
  totalGzipBytes: 819_356,
  mainGzipBytes: 174_080,
});

const VENDOR_PDF_EXPORT_CHUNK = 'vendor-pdf-export';

function normalizeAssetPath(assetPath) {
  return assetPath.replace(/^\.?\//, '').replace(/^\//, '');
}

function getIndexScriptPaths(indexHtml) {
  const scriptPaths = [];
  const scriptTagPattern = /<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  let match;

  while ((match = scriptTagPattern.exec(indexHtml)) !== null) {
    scriptPaths.push(normalizeAssetPath(match[1]));
  }

  return scriptPaths;
}

function findMainAsset(analysis, indexHtml) {
  const scriptPaths = getIndexScriptPaths(indexHtml);

  for (const scriptPath of scriptPaths) {
    const asset = analysis.jsAssets.find((candidate) => candidate.path === scriptPath);
    if (asset) return asset;
  }

  return analysis.jsAssets.find((asset) => /^assets\/(index|main)-.*\.js$/u.test(asset.path))
    ?? analysis.largestJs
    ?? null;
}

function hasVendorPdfExportPreload(indexHtml) {
  const linkTagPattern = /<link\b[^>]*>/gi;
  let match;

  while ((match = linkTagPattern.exec(indexHtml)) !== null) {
    const tag = match[0];
    if (/\brel=["']modulepreload["']/i.test(tag) && tag.includes(VENDOR_PDF_EXPORT_CHUNK)) {
      return true;
    }
  }

  return false;
}

function hasStaticVendorPdfExportImport(source) {
  const staticImportPattern = /(?:^|[;\n])\s*import(?!\s*\()[^;]*["'][^"']*vendor-pdf-export[^"']*["']/u;

  return staticImportPattern.test(source);
}

export async function checkBuildBudget(distPath = path.resolve(process.cwd(), DEFAULT_DIST), budgets = DEFAULT_BUDGETS) {
  const resolvedDistPath = path.resolve(distPath);
  const analysis = await analyzeDist(resolvedDistPath);
  const indexHtmlPath = path.join(resolvedDistPath, 'index.html');
  const indexHtml = await readFile(indexHtmlPath, 'utf8');
  const mainAsset = findMainAsset(analysis, indexHtml);
  const failures = [];
  const effectiveBudgets = {
    totalGzipBytes: budgets.totalGzipBytes ?? DEFAULT_BUDGETS.totalGzipBytes,
    mainGzipBytes: budgets.mainGzipBytes ?? DEFAULT_BUDGETS.mainGzipBytes,
  };

  if (analysis.totalGzipBytes > effectiveBudgets.totalGzipBytes) {
    failures.push({
      code: 'TOTAL_GZIP_BUDGET',
      message: `Total gzip size ${formatBytes(analysis.totalGzipBytes)} exceeds budget ${formatBytes(effectiveBudgets.totalGzipBytes)}.`,
      actualBytes: analysis.totalGzipBytes,
      budgetBytes: effectiveBudgets.totalGzipBytes,
    });
  }

  if (!mainAsset) {
    failures.push({
      code: 'MAIN_ASSET_MISSING',
      message: 'Could not identify the initial main JavaScript asset from dist/index.html.',
    });
  } else if (mainAsset.gzipBytes > effectiveBudgets.mainGzipBytes) {
    failures.push({
      code: 'MAIN_GZIP_BUDGET',
      message: `Main gzip size ${formatBytes(mainAsset.gzipBytes)} (${mainAsset.path}) exceeds budget ${formatBytes(effectiveBudgets.mainGzipBytes)}.`,
      actualBytes: mainAsset.gzipBytes,
      budgetBytes: effectiveBudgets.mainGzipBytes,
      assetPath: mainAsset.path,
    });
  }

  if (hasVendorPdfExportPreload(indexHtml)) {
    failures.push({
      code: 'VENDOR_PDF_EXPORT_PRELOAD',
      message: 'dist/index.html must not initially preload vendor-pdf-export; keep PDF export lazy-loaded.',
    });
  }

  if (mainAsset) {
    const mainSource = await readFile(path.join(resolvedDistPath, mainAsset.path), 'utf8');
    if (hasStaticVendorPdfExportImport(mainSource)) {
      failures.push({
        code: 'VENDOR_PDF_EXPORT_STATIC_IMPORT',
        message: `${mainAsset.path} must not statically import vendor-pdf-export; keep PDF export lazy-loaded.`,
        assetPath: mainAsset.path,
      });
    }
  }

  return {
    ok: failures.length === 0,
    distPath: resolvedDistPath,
    budgets: effectiveBudgets,
    analysis,
    mainAsset,
    failures,
  };
}

export function formatBudgetReport(result) {
  const lines = [
    result.ok ? 'Build budget check passed' : 'Build budget check failed',
    `Dist: ${result.distPath}`,
    `Total gzip: ${formatBytes(result.analysis.totalGzipBytes)} / ${formatBytes(result.budgets.totalGzipBytes)}`,
    `Main gzip: ${result.mainAsset ? `${formatBytes(result.mainAsset.gzipBytes)} (${result.mainAsset.path})` : 'not found'} / ${formatBytes(result.budgets.mainGzipBytes)}`,
  ];

  if (result.failures.length > 0) {
    lines.push('', 'Failures:');
    for (const failure of result.failures) {
      lines.push(`- [${failure.code}] ${failure.message}`);
    }
  }

  return lines.join('\n');
}

function parseByteOption(value, optionName) {
  const bytes = Number.parseInt(value, 10);
  if (!Number.isFinite(bytes) || bytes < 0) {
    throw new Error(`Invalid byte value for ${optionName}: ${value}`);
  }
  return bytes;
}

function parseArgs(argv) {
  const options = {
    distPath: path.resolve(process.cwd(), DEFAULT_DIST),
    budgets: { ...DEFAULT_BUDGETS },
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--dist') {
      const value = argv[index + 1];
      if (!value) throw new Error('Missing value for --dist');
      options.distPath = path.resolve(process.cwd(), value);
      index += 1;
    } else if (arg.startsWith('--dist=')) {
      options.distPath = path.resolve(process.cwd(), arg.slice('--dist='.length));
    } else if (arg === '--total-gzip-budget') {
      const value = argv[index + 1];
      if (!value) throw new Error('Missing value for --total-gzip-budget');
      options.budgets.totalGzipBytes = parseByteOption(value, '--total-gzip-budget');
      index += 1;
    } else if (arg.startsWith('--total-gzip-budget=')) {
      options.budgets.totalGzipBytes = parseByteOption(arg.slice('--total-gzip-budget='.length), '--total-gzip-budget');
    } else if (arg === '--main-gzip-budget') {
      const value = argv[index + 1];
      if (!value) throw new Error('Missing value for --main-gzip-budget');
      options.budgets.mainGzipBytes = parseByteOption(value, '--main-gzip-budget');
      index += 1;
    } else if (arg.startsWith('--main-gzip-budget=')) {
      options.budgets.mainGzipBytes = parseByteOption(arg.slice('--main-gzip-budget='.length), '--main-gzip-budget');
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function printHelp() {
  console.log(`Usage: node scripts/check-build-budget.mjs [--dist dist] [--total-gzip-budget bytes] [--main-gzip-budget bytes]\n\nChecks Vite build output against production build budgets.\n\nDefaults:\n  total gzip <= ${DEFAULT_BUDGETS.totalGzipBytes} bytes\n  main gzip <= ${DEFAULT_BUDGETS.mainGzipBytes} bytes\n  no vendor-pdf-export modulepreload in dist/index.html\n  no static vendor-pdf-export import from the initial main chunk\n\nOptions:\n  --dist <path>                 Build output directory to check (default: dist)\n  --total-gzip-budget <bytes>   Maximum total gzip size\n  --main-gzip-budget <bytes>    Maximum initial main chunk gzip size\n  -h, --help                    Show this help message`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  const result = await checkBuildBudget(options.distPath, options.budgets);
  console.log(formatBudgetReport(result));

  if (!result.ok) {
    process.exitCode = 1;
  }
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isCli) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
