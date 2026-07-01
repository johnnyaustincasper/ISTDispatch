import { readFileSync } from "node:fs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const functionSource = readFileSync(new URL("../functions/index.js", import.meta.url), "utf8");

assert(appSource.includes("buildWorkOrderScanPayload"), "client has work order scan payload helper");
assert(appSource.includes("canvas.toDataURL(\"image/jpeg\", 0.72)"), "client compresses scanned work order images before upload");
assert(appSource.includes("new File([photoBlob]") && appSource.includes("type: \"image/jpeg\""), "client stores the compressed JPEG for the job-card photo instead of the original camera file");
assert(appSource.includes("httpsCallable(fns, 'scanWorkOrder', { timeout: 120000 })"), "client callable timeout is extended for scanWorkOrder");
assert(appSource.includes("describeScanError"), "client shows friendlier scan errors");
assert(appSource.includes("e.target.value = \"\""), "client clears file input after scan so retrying same image works");
assert(appSource.includes("scannedWorkOrderFile:  payload.photoFile"), "scanned work-order image is retained as the compressed JPEG until the job is created");
assert(appSource.includes("Work order photo will attach to the job card"), "add-job modal confirms scanned work order will attach");
assert(appSource.includes("type: \"workOrder\"") && appSource.includes("label: \"Scanned Work Order\""), "created job stores scanned work order in job photos");
assert(appSource.includes("jobs/${jobId}/photos/${filename}"), "scanned work order uploads into the job photos folder");
assert(appSource.includes("const [addJobSaving, setAddJobSaving] = useState(false)"), "add-job submit has saving state to prevent dead taps/double submits");
assert(appSource.includes("Add job failed") && appSource.includes("addJobError"), "add-job submit surfaces write failures in the modal");
assert(appSource.includes("Add-job activity log failed"), "activity-log failures do not block successful job creation");
assert(appSource.includes("Enter either a Builder / Customer or a Job Address first"), "add-job submit validates blank form with a visible error instead of disabling the button");
assert(appSource.includes("disabled={addJobSaving}"), "add-job button remains clickable when builder/customer is filled but address is blank");
assert(appSource.includes("await setDoc(jobRef, jobData);\n    if (scannedWorkOrderFile?.type?.startsWith"), "job is created before any scanned work-order photo upload starts");
assert(appSource.includes("arrayUnion(photo)"), "scanned work-order photo update appends to job photos instead of overwriting with stale photo state");
assert(appSource.includes("Storage upload unavailable; saving inline job-card photo") && appSource.includes("data:${scannedWorkOrderFile.type"), "scanned work-order photo falls back to an inline job-card image when Firebase Storage is unavailable");
assert(appSource.includes("uploadScannedWorkOrderPhoto(jobRef.id") && !appSource.includes("await uploadScannedWorkOrderPhoto(jobRef.id") && appSource.includes("Scanned work-order photo upload failed after job creation"), "scanned work-order photo attach is kicked off after job creation without blocking Add Job");

assert(functionSource.includes("timeoutSeconds: 120"), "scanWorkOrder cloud function timeout is extended");
assert(functionSource.includes("memory: '1GiB'"), "scanWorkOrder cloud function has extra memory");
assert(functionSource.includes("response_format: { type: 'json_object' }"), "scanWorkOrder asks OpenAI for JSON mode");
assert(functionSource.includes("detail: 'low'"), "scanWorkOrder uses lower-detail vision for faster work-order extraction");

console.log("work-order scan regression checks passed");
