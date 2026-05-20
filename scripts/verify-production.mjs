#!/usr/bin/env node

const DEFAULT_PRODUCTION_URL = "https://www.istdispatch.com";
const MAX_REDIRECTS = 8;
const REQUEST_TIMEOUT_MS = 15000;

const startUrl = process.env.PRODUCTION_URL || DEFAULT_PRODUCTION_URL;
const expectedHost = process.env.EXPECTED_DEPLOYMENT_HOST || null;
const expectedAssetMarker = process.env.EXPECTED_ASSET_MARKER || null;

function sanitizeUrl(value) {
  const url = new URL(value);
  url.username = "";
  url.password = "";
  url.search = url.search ? "?…" : "";
  url.hash = "";
  return url.toString();
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "user-agent": "ISTDispatchProductionVerifier/1.0",
        ...(options.headers || {}),
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchFollowingRedirects(initialUrl) {
  let currentUrl = new URL(initialUrl);
  const redirects = [];

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const response = await fetchWithTimeout(currentUrl, { redirect: "manual" });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error(`Redirect response ${response.status} did not include a Location header`);
      }
      const nextUrl = new URL(location, currentUrl);
      redirects.push({ status: response.status, from: currentUrl.toString(), to: nextUrl.toString() });
      currentUrl = nextUrl;
      continue;
    }

    return { response, finalUrl: currentUrl, redirects };
  }

  throw new Error(`Too many redirects; exceeded ${MAX_REDIRECTS}`);
}

function extractScriptAssetUrls(html, pageUrl) {
  const scripts = new Set();
  const scriptRegex = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  let match;

  while ((match = scriptRegex.exec(html)) !== null) {
    const src = match[1]?.trim();
    if (!src || src.startsWith("data:") || src.startsWith("blob:")) continue;
    scripts.add(new URL(src, pageUrl).toString());
  }

  return [...scripts];
}

async function fetchTextAsset(assetUrl) {
  const response = await fetchWithTimeout(assetUrl, { redirect: "follow" });
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();

  return {
    url: assetUrl,
    status: response.status,
    ok: response.ok,
    contentType,
    bytes: Buffer.byteLength(text, "utf8"),
    text,
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const { response, finalUrl, redirects } = await fetchFollowingRedirects(startUrl);
  const html = await response.text();

  assert(response.status === 200, `Expected production page status 200, got ${response.status}`);

  if (expectedHost) {
    assert(
      finalUrl.hostname === expectedHost,
      `Expected final deployment host ${expectedHost}, got ${finalUrl.hostname}`
    );
  }

  const assetUrls = extractScriptAssetUrls(html, finalUrl);
  assert(assetUrls.length > 0, "No JavaScript assets were found in production HTML");

  const assets = await Promise.all(assetUrls.map(fetchTextAsset));
  const failedAssets = assets.filter((asset) => !asset.ok);
  assert(
    failedAssets.length === 0,
    `JavaScript asset fetch failed for ${failedAssets.length} asset(s): ${failedAssets
      .map((asset) => `${sanitizeUrl(asset.url)} -> ${asset.status}`)
      .join(", ")}`
  );

  const combinedText = `${html}\n${assets.map((asset) => asset.text).join("\n")}`;
  const requiredMarkers = [{ label: "IST Dispatch", marker: "IST Dispatch" }];
  if (expectedAssetMarker) {
    requiredMarkers.push({ label: "EXPECTED_ASSET_MARKER", marker: expectedAssetMarker });
  }

  const requiredMarkerResults = requiredMarkers.map(({ label, marker }) => ({
    label,
    found: combinedText.includes(marker),
  }));
  const missingRequired = requiredMarkerResults.filter((result) => !result.found);
  assert(
    missingRequired.length === 0,
    `Missing required marker(s): ${missingRequired.map((result) => result.label).join(", ")}`
  );

  const optionalMarkers = [
    "Admin diagnostics",
    "diagnostics",
    "config-health",
    "Config health",
  ];
  const optionalMarkerResults = optionalMarkers.map((marker) => ({
    marker,
    found: combinedText.includes(marker),
  }));

  console.log("Production verification passed");
  console.log(`URL: ${sanitizeUrl(startUrl)}`);
  console.log(`Final URL: ${sanitizeUrl(finalUrl)}`);
  console.log(`Status: ${response.status}`);
  console.log(`Redirects: ${redirects.length}`);
  if (redirects.length > 0) {
    for (const redirect of redirects) {
      console.log(`- ${redirect.status}: ${sanitizeUrl(redirect.from)} -> ${sanitizeUrl(redirect.to)}`);
    }
  }
  console.log(`JavaScript assets: ${assets.length}`);
  for (const asset of assets) {
    console.log(`- ${sanitizeUrl(asset.url)} (${asset.status}, ${asset.bytes} bytes, ${asset.contentType || "unknown content-type"})`);
  }
  console.log("Required markers:");
  for (const result of requiredMarkerResults) {
    console.log(`- ${result.label}: ${result.found ? "found" : "missing"}`);
  }
  console.log("Optional admin/diagnostics/config-health markers:");
  for (const result of optionalMarkerResults) {
    console.log(`- ${result.marker}: ${result.found ? "found" : "not present"}`);
  }
}

main().catch((error) => {
  console.error(`Production verification failed: ${error.message}`);
  process.exitCode = 1;
});
