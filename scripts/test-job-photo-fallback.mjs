import { readFileSync } from "node:fs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const uploadStart = appSource.indexOf("  const handleUpload = async (e) => {");
const deleteStart = appSource.indexOf("  const handleDelete = async (photo, idx) => {");
const uploadSource = appSource.slice(uploadStart, deleteStart);

assert(appSource.includes("function JobPhotosSection"), "job photo section exists");
assert(appSource.includes("compressJobPhoto"), "manual job photos are compressed before upload/fallback");
assert(appSource.includes("canvas.toDataURL(\"image/jpeg\", 0.62)"), "manual job photos are converted to compact JPEG data URLs");
assert(appSource.includes("Job photo Storage upload unavailable; saving inline job-card photo"), "manual job photos fall back when Firebase Storage is unavailable");
assert(appSource.includes("storagePath: storageBacked ? path : \"\""), "manual job photos store Storage path only when Storage succeeds");
assert(appSource.includes("!String(photo.url || \"\").startsWith(\"data:\")"), "delete skips Firebase Storage delete for inline photos");
assert(uploadSource.includes("arrayUnion(...uploadedPhotos)"), "manual job photos append with arrayUnion instead of replacing stale photo arrays");
assert(!uploadSource.includes("photos: newPhotos"), "manual job upload must not rewrite the full stale photos array");

console.log("job photo fallback checks passed");
