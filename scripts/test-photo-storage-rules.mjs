import { readFileSync } from "node:fs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const firebaseJson = JSON.parse(readFileSync(new URL("../firebase.json", import.meta.url), "utf8"));
const rules = readFileSync(new URL("../storage.rules", import.meta.url), "utf8");

assert(firebaseJson.storage?.rules === "storage.rules", "firebase.json wires Firebase Storage rules");
assert(rules.includes("service firebase.storage"), "storage.rules declares Firebase Storage rules");
assert(rules.includes("/jobs/{jobId}/photos/{fileName}"), "storage rules cover job photo uploads");
assert(rules.includes("request.resource.contentType.matches('image/.*')"), "job photo writes are limited to image content types");
assert(rules.includes("request.resource.size < 10 * 1024 * 1024"), "job photo writes have a 10 MiB size cap");
assert(!rules.includes("request.auth != null"), "job photo Storage writes do not require Firebase Auth because IST Dispatch does not sign users into Firebase Auth");
assert(rules.includes("allow read: if true;"), "job photos remain readable for app display");

console.log("photo storage rules checks passed");
