# IST Dispatch Performance + Organization Modernization Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Improve app performance and make IST Dispatch easier to maintain, upgrade, and extend by splitting the 14,770-line `App.jsx` into stable feature modules, adding tests around risky business logic, and code-splitting heavyweight routes/features.

**Architecture:** Keep behavior unchanged first. Extract pure constants/helpers/tests before moving UI. Use strangler-style refactors: create feature modules that export the same functions/components currently embedded in `App.jsx`, then replace the inline code with imports. After behavior is protected, add lazy-loaded route/view boundaries for quote builder, diagnostics, redesign mocks, and PDF/export-heavy features.

**Tech Stack:** Vite, React, Firebase/Firestore, jsPDF, Node script tests.

---

## Baseline captured 2026-05-22

- Branch: `fix/edit-material-log-inventory`
- Last commit: `d532de5 feat: refresh crew job card UI`
- Build command: `npm run build`
- Analyze command: `npm run build:analyze`
- Build status: passes.
- `src/App.jsx`: 1,055,669 bytes, 14,770 lines.
- Largest chunks:
  - `assets/index-*.js`: ~656 KiB / ~160 KiB gzip
  - `assets/vendor-pdf-export-*.js`: ~556 KiB / ~166 KiB gzip
  - `assets/vendor-firebase-*.js`: ~395 KiB / ~97 KiB gzip
  - `assets/vendor-misc-*.js`: ~206 KiB / ~70 KiB gzip
- Existing feature modules:
  - `src/features/inventory/MaterialsGrid.jsx`
  - `src/features/diagnostics/AdminDiagnosticsView.jsx`
  - `src/features/crew/jobCardPresentation.js`
  - `src/features/admin/adminNavigation.js`

## Guiding rules

1. Preserve behavior before improving behavior.
2. No visual redesign during extraction unless required to avoid bugs.
3. Add tests before moving calculation or persistence logic.
4. One small seam per commit.
5. Prefer pure helper modules over global variables.
6. Keep imports acyclic: shared utilities must not import `App.jsx`.
7. After each task: run the smallest relevant test, then `npm run build`.

---

## Phase 1 — Safety harness for takeoff/quote/work-order logic

### Task 1: Create takeoff feature folder and pure constants module

**Objective:** Copy quote/takeoff constants out of `App.jsx` into a reusable module without changing runtime behavior yet.

**Files:**
- Create: `src/features/takeoff/constants.js`
- Test: `scripts/test-takeoff-constants.mjs`
- Modify: `package.json`

**Step 1: Create constants module**

Move/copy these data sets from the quote/takeoff module into `src/features/takeoff/constants.js`:

- `COMPANY`
- `SALESMAN_INFO`
- `LOCATIONS`
- `GROUP_ORDER`
- `FIBERGLASS_MATERIALS`
- `OPEN_CELL_MATERIALS`
- `CLOSED_CELL_MATERIALS`
- `PITCH_FACTORS`
- `WALL_HEIGHTS`
- `CAVITY_WIDTHS`
- `Q_STATUS_CONFIG` if still needed

Do not remove inline definitions from `App.jsx` in this task. This is a safe copy first.

**Step 2: Add constants smoke test**

Create `scripts/test-takeoff-constants.mjs`:

```js
import {
  LOCATIONS,
  GROUP_ORDER,
  PITCH_FACTORS,
  WALL_HEIGHTS,
  SALESMAN_INFO,
} from "../src/features/takeoff/constants.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(LOCATIONS.some((l) => l.id === "ext_walls_house" && l.type === "wall"), "missing exterior wall location");
assert(GROUP_ORDER.includes("Walls"), "missing Walls group");
assert(PITCH_FACTORS["12/12"] === 1.414, "12/12 pitch factor changed");
assert(WALL_HEIGHTS.find((h) => h.label.includes("8'") && h.sqftPer === 10), "8 foot wall factor changed");
assert(SALESMAN_INFO.Johnny?.email === "Johnny@istulsa.com", "Johnny salesman contact changed");

console.log("takeoff constants ok");
```

**Step 3: Add npm script**

Add to `package.json` scripts:

```json
"test:takeoff-constants": "node scripts/test-takeoff-constants.mjs"
```

Also add it to the main `test` script after config tests.

**Step 4: Verify**

Run:

```bash
npm run test:takeoff-constants
npm run build
```

Expected:

- `takeoff constants ok`
- Vite build passes.

**Step 5: Commit**

```bash
git add src/features/takeoff/constants.js scripts/test-takeoff-constants.mjs package.json package-lock.json
git commit -m "test: add takeoff constants safety checks"
```

---

### Task 2: Extract pure measurement math helpers

**Objective:** Put wall/area/pitch math in testable pure functions.

**Files:**
- Create: `src/features/takeoff/measurementMath.js`
- Test: `scripts/test-takeoff-measurement-math.mjs`
- Modify: `package.json`

**Step 1: Create helper module**

Create functions:

```js
import { PITCH_FACTORS, WALL_HEIGHTS } from "./constants.js";

export function calculateWallCountSqft(cavityCount, wallHeightIndex) {
  const count = parseInt(cavityCount, 10) || 0;
  const height = WALL_HEIGHTS[parseInt(wallHeightIndex, 10)];
  return count * (height ? height.sqftPer : 0);
}

export function calculateRectangleSqft(length, widthOrHeight) {
  return (parseFloat(length) || 0) * (parseFloat(widthOrHeight) || 0);
}

export function applyPitchFactor(sqft, pitch) {
  return (parseFloat(sqft) || 0) * (PITCH_FACTORS[pitch] || 1);
}

export function roundSqft(sqft) {
  return Math.round(parseFloat(sqft) || 0);
}
```

**Step 2: Add tests**

Create tests covering:

- 10 cavities × 8' = 100 sqft
- 8 cavities × 10' = 100 sqft
- L×H: 12 × 9 = 108
- direct zero/empty handling
- 100 sqft at 12/12 rounds to 141

**Step 3: Verify**

Run:

```bash
npm run test:takeoff-measurement-math
npm run build
```

**Step 4: Commit**

```bash
git add src/features/takeoff/measurementMath.js scripts/test-takeoff-measurement-math.mjs package.json package-lock.json
git commit -m "test: cover takeoff measurement math"
```

---

### Task 3: Extract quote total math helpers

**Objective:** Protect quote pricing behavior before UI extraction.

**Files:**
- Create: `src/features/takeoff/quoteMath.js`
- Test: `scripts/test-quote-math.mjs`
- Modify: `package.json`

**Step 1: Implement helpers**

```js
export function getOptionLineItemsTotal(option) {
  return (option.items || []).reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0);
}

export function getPsoCredit(option) {
  return (option.pso ? 600 : 0) + (option.psoKw ? 525 : 0);
}

export function getOptionAdjustmentsTotal(option) {
  const extraLabor = option.extraLabor ? (parseFloat(option.extraLaborAmt) || 0) : 0;
  const tripCharge = option.tripCharge ? (parseFloat(option.tripChargeAmt) || 0) : 0;
  const energySeal = option.energySeal ? (parseFloat(option.energySealAmt) || 0) : 0;
  const dumpster = option.dumpster ? (parseFloat(option.dumpsterAmt) || 0) : 0;
  const customItems = (option.customItems || []).reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
  return extraLabor + tripCharge + energySeal + dumpster + customItems;
}

export function getCalculatedOptionTotal(option) {
  return getOptionLineItemsTotal(option) - getPsoCredit(option) + getOptionAdjustmentsTotal(option);
}

export function getFinalOptionTotal(option) {
  return option.overrideTotal !== "" && option.overrideTotal != null
    ? (parseFloat(option.overrideTotal) || 0)
    : getCalculatedOptionTotal(option);
}
```

**Step 2: Add tests**

Cover:

- line item sum
- PSO attic credit
- PSO kneewall credit
- extra labor/trip/energy seal/dumpster/custom item additions
- override total wins
- empty strings do not create `NaN`

**Step 3: Verify**

```bash
npm run test:quote-math
npm run build
```

**Step 4: Commit**

```bash
git add src/features/takeoff/quoteMath.js scripts/test-quote-math.mjs package.json package-lock.json
git commit -m "test: cover quote total math"
```

---

## Phase 2 — Split takeoff/quote code into feature modules

### Task 4: Extract takeoff storage helpers

**Objective:** Move Firestore persistence for saved takeoff jobs/autosave into one module.

**Files:**
- Create: `src/features/takeoff/takeoffStorage.js`
- Modify: `src/App.jsx`
- Test: existing build

**Exports:**

- `saveTakeoffJob(savedBy, jobName, jobData)`
- `loadTakeoffJobs(savedBy)`
- `loadAllTakeoffJobs(teamMembers)`
- `deleteTakeoffJob(id)`
- `saveTakeoffAutosave(savedBy, data)`
- `loadTakeoffAutosave(savedBy)`

**Notes:**

- Import `db` from `../../firebase.js` or the existing Firebase module path.
- Preserve collection names exactly:
  - `takeoffJobs`
  - `takeoffAutosave`
- Preserve timestamp field names:
  - `created_at`
  - `updated_at`

**Verification:**

```bash
npm run build
```

Manual smoke after deploy/local run:

- Save named takeoff job.
- Reload jobs panel.
- Load the saved job.
- Delete test job.

---

### Task 5: Extract PDF helpers into `takeoffPdf.js`

**Objective:** Move jsPDF code out of `App.jsx` and prepare it for deeper lazy-loading.

**Files:**
- Create: `src/features/takeoff/takeoffPdf.js`
- Modify: `src/App.jsx`

**Move/export:**

- `buildQuotePdf`
- `buildTakeOffPdf`
- `shareQuote`
- `shareTakeOff`
- `printTakeOff`
- `generatePDF`
- `printQuoteAndTakeOff`
- any PDF-only helper needed by those functions

**Important:**

- Keep `import("jspdf")` dynamic inside this module.
- Do not convert to static `import { jsPDF } from "jspdf"`; that would hurt initial bundle.

**Verification:**

```bash
npm run build
```

Manual smoke:

- Print Take Off.
- Share Take Off on a supported mobile browser.
- Print Quote.
- Print Quote and Take Off.

---

### Task 6: Extract takeoff UI components

**Objective:** Move takeoff measurement UI out of `App.jsx` while preserving behavior.

**Files:**
- Create: `src/features/takeoff/components/Inputs.jsx`
- Create: `src/features/takeoff/components/MeasurementFields.jsx`
- Create: `src/features/takeoff/components/CustomerInfo.jsx`
- Create: `src/features/takeoff/TakeOff.jsx`
- Modify: `src/App.jsx`

**Move/export:**

- `QV_Input`
- `AppSelect`
- `Row`
- `Col`
- `StepLabel` if still used
- `ToggleButtons`
- `GreenBtn`
- `WallMeasurement`
- `AreaMeasurement`
- `LocationGrid`
- `StepBar`
- `MeasurementForm`
- `MaterialTabs` if still used
- `CustomerInfo`
- `TakeOff`

**Verification:**

```bash
npm run build
```

Manual smoke:

- Add wall-count measurement.
- Add L×H measurement.
- Add direct sqft measurement.
- Add custom location.
- Add foam material.
- Delete measurement.

---

### Task 7: Extract quote builder UI

**Objective:** Move quote option/pricing UI into its own module.

**Files:**
- Create: `src/features/takeoff/quoteOptions.js`
- Create: `src/features/takeoff/QuoteBuilderSection.jsx`
- Modify: `src/App.jsx`

**Move/export:**

- `newOption`
- `QuoteBuilderSection`

**Use:**

- Import quote math helpers from `quoteMath.js` rather than recalculating totals inline where safe.
- Keep rendered totals identical.

**Verification:**

```bash
npm run build
npm run test:quote-math
```

Manual smoke:

- Send measurements to quote.
- Price imported measurement.
- Add manual item.
- Add option.
- Rename option.
- Add PSO credit.
- Override total.
- Generate quote PDF.

---

### Task 8: Extract saved jobs and work order

**Objective:** Complete takeoff module extraction by moving saved jobs and work order sections.

**Files:**
- Create: `src/features/takeoff/SavedJobsPanel.jsx`
- Create: `src/features/takeoff/WorkOrderSection.jsx`
- Modify: `src/App.jsx`

**Move/export:**

- `SavedJobsPanel`
- `WorkOrderSection`
- work-order row building helpers if separated naturally

**Verification:**

```bash
npm run build
```

Manual smoke:

- Save current job.
- Load saved job.
- Generate work order.
- Verify material rows and R-values still derive correctly.

---

### Task 9: Extract `QuoteView` shell

**Objective:** Make the quote builder feature independently understandable and importable.

**Files:**
- Create: `src/features/takeoff/QuoteView.jsx`
- Modify: `src/App.jsx`

**Move/export:**

- `QuoteView`
- any small shell-only helpers

**Verification:**

```bash
npm run build
npm run test
```

Manual smoke:

- Open admin launcher.
- Enter Quote Builder.
- Navigate all four tabs.
- Return to Dispatch.

---

## Phase 3 — Code-splitting and initial-load performance

### Task 10: Lazy-load the quote builder view

**Objective:** Keep quote/takeoff code out of the initial dispatch bundle until the user opens Quote Builder.

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/features/takeoff/QuoteView.jsx`

**Implementation:**

Use React lazy/Suspense near app-level routing:

```js
const QuoteView = React.lazy(() => import("./features/takeoff/QuoteView.jsx"));
```

Render with a small loading fallback:

```jsx
<Suspense fallback={<div style={{ padding: 24 }}>Loading quote builder…</div>}>
  <QuoteView ... />
</Suspense>
```

**Verification:**

```bash
npm run build:analyze
```

Expected:

- Main `index-*.js` chunk decreases.
- New takeoff/quote chunk appears.
- Quote builder still loads when selected.

---

### Task 11: Lazy-load PDF generation path more aggressively

**Objective:** Ensure jsPDF and PDF helper code load only when printing/sharing.

**Files:**
- Modify: `src/features/takeoff/QuoteBuilderSection.jsx`
- Modify: `src/features/takeoff/TakeOff.jsx`
- Modify: `src/features/takeoff/takeoffPdf.js`

**Approach:**

Instead of importing PDF helper functions statically into always-rendered components, use dynamic import inside button handlers:

```js
const { generatePDF } = await import("./takeoffPdf.js");
await generatePDF(...);
```

**Verification:**

```bash
npm run build:analyze
```

Expected:

- PDF helper code separates from quote view code if not already separated.
- `vendor-pdf-export` remains async-only.

---

### Task 12: Add route/view-level loading diagnostics

**Objective:** Make future performance regressions visible.

**Files:**
- Modify: `scripts/analyze-build.mjs` or create `scripts/check-build-budget.mjs`
- Modify: `package.json`

**Budget targets to start:**

- Total gzip <= current + 5% during refactor.
- Main index gzip should trend downward after lazy loading.
- Warn if `assets/index-*.js` gzip exceeds 170 KiB.

**Verification:**

```bash
npm run build:analyze
```

---

## Phase 4 — Dispatch/import bridge cleanup

### Task 13: Decide and implement quote summary persistence

**Objective:** Fix the mismatch where dispatch import reads `quotes`, but quote builder currently saves named jobs in `takeoffJobs` and does not appear to populate `quotes`.

**Files:**
- Create/modify: `src/features/takeoff/quoteStorage.js`
- Modify: `src/features/takeoff/QuoteBuilderSection.jsx`
- Modify: dispatch add-job import logic in `src/App.jsx` or extracted dispatch module

**Decision needed before implementation:**

Choose one:

1. Quote builder writes a summary document to `quotes` when quote is printed/shared/saved.
2. Dispatch import reads from `takeoffJobs` and derives quote summaries from `job_data.quoteOpts`.

**Recommended:** option 1, because `quotes` can be a clean scheduling/import index.

**Suggested `quotes` document shape:**

```js
{
  customerName,
  address,
  jobAddress,
  phone,
  email,
  salesman,
  totalPrice,
  optionName,
  status: "quoted",
  sourceTakeoffJobId: null,
  quoteOptsSummary,
  createdAt,
  updatedAt
}
```

**Verification:**

- Create quote.
- Confirm quote appears in dispatch `Import from Takeoff` modal.
- Import quote into job form.

---

## Phase 5 — Broader app organization after takeoff is stable

### Task 14: Extract dispatch/admin feature shell

**Objective:** Reduce `App.jsx` to app composition, session state, and top-level data subscriptions.

**Target modules:**

- `src/features/dispatch/AdminDispatchView.jsx`
- `src/features/dispatch/CrewView.jsx`
- `src/features/dispatch/components/*`
- `src/features/dispatch/jobForms.js`
- `src/features/dispatch/jobReports.js`

**Rule:** only extract after takeoff feature extraction is complete and build/test is green.

---

### Task 15: Move Firestore subscriptions into hooks

**Objective:** Make data loading easier to maintain and reduce `App()` complexity.

**Files:**
- Create: `src/features/app/useIstFirestoreData.js`
- Modify: `src/App.jsx`

**Hook returns:**

- subscribed collection arrays/objects
- listener diagnostics
- client errors
- derived inventory maps

**Verification:**

- Existing listener diagnostics still work.
- `npm run test:firestore-listeners`
- `npm run build`

---

## Phase 6 — Optional performance wins after organization

### Task 16: Defer login background image on non-login views

**Objective:** Avoid loading `tulsa.jpg` unless the login screen is shown.

**Files:**
- Modify extracted login/auth component or `App.jsx`

**Verification:**

- Login still shows background.
- Authenticated dispatch view does not request it unnecessarily.

---

### Task 17: Memoize expensive derived reports/lists

**Objective:** Reduce re-render cost in dispatch dashboard after structure is cleaner.

**Targets:**

- Calendar/job summaries
- inventory parity maps
- employee/job report aggregations
- quote/takeoff grouped rows

**Rule:** profile/observe first; only memoize expensive derived values that change infrequently.

---

## Final acceptance checklist

- `npm run test` passes.
- `npm run build` passes.
- `npm run build:analyze` shows main bundle reduced after lazy loading.
- `src/App.jsx` is substantially smaller and no longer contains the takeoff/quote module.
- Quote builder behavior unchanged:
  - takeoff measurement
  - quote pricing
  - saved jobs
  - autosave
  - PDFs
  - work orders
- Dispatch import path is either intentionally connected to `quotes` or intentionally changed to read takeoff jobs.
- Future feature work can target feature modules instead of editing 14k-line `App.jsx`.
