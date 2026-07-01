# Photo System Stabilization Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Make IST Dispatch job photos and scanned work-order photos reliable across office, crew mobile, PDFs, and future acquisition/job documentation workflows.

**Architecture:** Move photo handling out of ad-hoc component code into a small photo service and data model. Prefer Firebase Storage URLs for all durable photos; keep inline data URLs only as an emergency/temporary fallback with strict size protection so job documents cannot exceed Firestore limits. Keep job cards reading `job.photos` initially for low-risk migration, then evolve toward a subcollection if needed.

**Tech Stack:** React/Vite, Firebase Firestore, Firebase Storage, Firebase Functions callable `scanWorkOrder`, existing script-based regression tests.

---

## Findings from current code

- Manual job photos live in `JobPhotosSection` inside `src/App.jsx:6483-6643`.
- Scanned work-order photo upload lives separately in `src/App.jsx:11766-11792`.
- Both write into `jobs/{jobId}.photos`, but manual upload rewrites the whole array while scan uses `arrayUnion`.
- Both try Firebase Storage first, then fall back to inline `data:` URLs in the job document.
- The repo has `firebase.json` with Firestore and Functions config, but no Storage rules entry and no `storage.rules` file.
- Vercel has the required Firebase public env vars configured for Production/Preview/Development.
- Current tests pass, but they are string-presence checks, not behavior tests.

## Primary risk/root-cause hypothesis

The photo system is not a single system yet; it is two duplicated upload paths with Storage best-effort fallback. If Storage is unavailable/misconfigured, the fallback can store base64 photos inside job documents. That works for a small number of compressed photos but is fragile because Firestore documents have a 1 MiB limit, arrays are rewritten, and PDFs/lightbox must fetch mixed URL types.

---

### Task 1: Add Firebase Storage rules to the repo

**Objective:** Make Storage configuration explicit and deployable with the app.

**Files:**
- Create: `storage.rules`
- Modify: `firebase.json`
- Test: `scripts/test-photo-system-config.mjs`

**Step 1: Create `storage.rules`**

Use a permissive-but-scoped first version while the app has no real Firebase Auth user model:

```js
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /jobs/{jobId}/photos/{fileName} {
      allow read: if true;
      allow write: if request.resource.size < 8 * 1024 * 1024
        && request.resource.contentType.matches('image/.*');
      allow delete: if true;
    }
  }
}
```

**Step 2: Wire rules into `firebase.json`**

Add:

```json
"storage": {
  "rules": "storage.rules"
}
```

**Step 3: Add config regression test**

Create `scripts/test-photo-system-config.mjs` to assert:
- `firebase.json` has `storage.rules`
- `storage.rules` contains `jobs/{jobId}/photos/{fileName}`
- `storage.rules` limits writes to images

**Step 4: Run tests**

Run:

```bash
npm run test:job-photo-fallback
npm run test:work-order-scan
node scripts/test-photo-system-config.mjs
npm run build
```

Expected: all pass.

---

### Task 2: Extract shared photo helpers

**Objective:** Remove duplicated upload/fallback logic from manual job photos and scanned work-order photos.

**Files:**
- Create: `src/features/photos/jobPhotos.js`
- Modify: `src/App.jsx`
- Test: `scripts/test-job-photo-helpers.mjs`

**Step 1: Create `src/features/photos/jobPhotos.js`**

Implement pure helpers:

```js
export const sanitizePhotoFileName = (name = 'job-photo.jpg') =>
  String(name || 'job-photo.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');

export const buildJobPhotoStoragePath = (jobId, filename) =>
  `jobs/${jobId}/photos/${filename}`;

export const buildJobPhotoRecord = ({ url, filename, storagePath = '', uploadedBy = 'Unknown', type = '', label = '' }) => ({
  url,
  filename,
  storagePath,
  uploadedBy,
  uploadedAt: new Date().toISOString(),
  ...(type ? { type } : {}),
  ...(label ? { label } : {}),
});

export const isInlinePhotoUrl = (url = '') => String(url || '').startsWith('data:');
```

**Step 2: Replace duplicate filename/path logic in `App.jsx`**

Use helpers in:
- `JobPhotosSection.handleUpload`
- `uploadScannedWorkOrderPhoto`
- `handleDelete`

**Step 3: Add helper tests**

Assert filename sanitization, path construction, work-order labels, and inline URL detection.

---

### Task 3: Protect Firestore from oversized inline fallback photos

**Objective:** Keep fallback useful without breaking job documents.

**Files:**
- Modify: `src/App.jsx` or helper module from Task 2
- Test: `scripts/test-job-photo-fallback.mjs`

**Step 1: Add maximum inline data URL size**

Set a constant:

```js
const MAX_INLINE_PHOTO_DATA_URL_CHARS = 450_000;
```

If Storage upload fails and compressed data URL exceeds the limit, show a clear error:

```js
throw new Error('Photo storage is unavailable and this image is too large to save inline. Please retry on Wi-Fi or contact office/Hermes to fix Firebase Storage.');
```

**Step 2: Add visible user feedback**

Manual photo upload should alert the user with the friendly message.
Scan attach should not block job creation, but it should log a clear warning and preserve the scan fields already extracted.

**Step 3: Update tests**

Make `test-job-photo-fallback.mjs` assert the size guard and friendly error string exist.

---

### Task 4: Make manual upload append safely

**Objective:** Avoid overwriting photos uploaded by another user while the local component had stale `photos` state.

**Files:**
- Modify: `src/App.jsx:6529-6554`
- Test: `scripts/test-job-photo-fallback.mjs`

**Step 1: Replace whole-array update**

Current manual upload builds `newPhotos = [...photos]` then writes `{ photos: newPhotos }`. Change to upload each photo and call:

```js
await updateDoc(doc(db, 'jobs', job.id), { photos: arrayUnion(photo) });
```

**Step 2: Preserve existing UI state behavior**

The listener will refresh `job.photos`; do not manually mutate local state.

**Step 3: Test**

Update the regression test to assert manual uploads use `arrayUnion(photo)` and no longer write stale `newPhotos`.

---

### Task 5: Add a photo diagnostics panel for admins

**Objective:** Let office quickly see why photos are not working.

**Files:**
- Modify/create under `src/features/diagnostics/`
- Modify: admin diagnostics view wiring
- Test: `scripts/test-diagnostics.mjs`

**Diagnostics to show:**
- Firebase `storageBucket` configured: yes/no
- Count of inline `data:` photos in current loaded jobs
- Count of Storage-backed photos
- Jobs with photo arrays over a warning threshold
- Last upload error, if any

---

### Task 6: Verify production path

**Objective:** Prove the system works after changes.

**Commands:**

```bash
npm run test
npm run build
vercel env ls
```

Then manually verify in deployed app:
- Add a small photo to a test job from office/admin.
- Add a photo from crew mobile.
- Scan a work order and create a job.
- Open job card lightbox.
- Generate job completion PDF with photos.

Expected: photos show on job card, persist after refresh, and appear in PDF where fetchable.
