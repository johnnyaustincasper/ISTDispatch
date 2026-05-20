# Performance build analysis

This project includes a repeatable Vite build analysis script for tracking production bundle size over time.

## How to run

```sh
npm run build
npm run analyze
```

Or run both steps together:

```sh
npm run build:analyze
```

The analyzer reads the built `dist/` directory and prints:

- total emitted asset count
- JavaScript chunk count
- largest JavaScript asset
- raw and gzip sizes for each emitted asset
- total raw and gzip size

For machine-readable output:

```sh
npm run analyze -- --json
```

To analyze a non-default build output directory:

```sh
npm run analyze -- --dist path/to/dist
```

The command exits nonzero if the build output directory is missing, which helps catch CI runs that forgot to build first.

## Baseline: 2026-05-20 before this pass

Captured on commit `d8391db` after running `npm run build`.

- Assets: 11
- JavaScript chunks: 5
- Largest JS: `assets/index-CBAuaT57.js` - 1.19 MiB (308.04 KiB gzip)
- Total size: 2.14 MiB (759.09 KiB gzip)

## Current optimized baseline: 2026-05-20

Captured after adding manual vendor chunks and lazy loading admin diagnostics/redesign mocks.

Build warning still observed because the main app and PDF vendor chunks are above Vite's default 500 kB threshold, but the initial app chunk is substantially smaller:

```text
(!) Some chunks are larger than 500 kB after minification.
```

Summary from `npm run analyze`:

- Assets: 13
- JavaScript chunks: 7
- Largest JS: `assets/index-DNxIQamk.js` - 652.34 KiB (158.60 KiB gzip)
- Total size: 2.15 MiB (760.79 KiB gzip)

Notable split chunks:

```text
assets/index-CGc0MRXS.js | 652.28 KiB | 158.54 KiB gzip | main app
assets/vendor-pdf-export-BhaZIHUG.js | 556.40 KiB | 165.91 KiB gzip | lazy PDF/export dependency group
assets/vendor-firebase-BqBEDoZy.js | 395.14 KiB | 97.23 KiB gzip | Firebase vendor group
assets/vendor-react-C03MFrLP.js | 139.74 KiB | 44.77 KiB gzip | React vendor group
assets/AdminDiagnosticsView-DR09yVAM.js | 9.92 KiB | 2.70 KiB gzip | lazy admin diagnostics view
assets/DispatchRedesignMocks-BQPYos4t.js | 14.26 KiB | 4.51 KiB gzip | lazy redesign mocks
```

## Interpreting changes

Use this baseline to compare future builds. Useful signals include:

- a new or larger largest JavaScript chunk
- increased JavaScript chunk count after intentional code splitting
- increased total gzip size
- movement of heavy dependencies into or out of the main app chunk

The current largest app-owned chunk is still above Vite's default 500 kB warning threshold, but the first pass reduced the main app chunk from about 1.19 MiB to about 652 KiB. Future performance work should focus on extracting more large `App.jsx` views, especially quote/takeoff/PDF/reporting workflows, into lazy-loaded modules.
