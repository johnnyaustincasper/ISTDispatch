import { readFileSync } from "node:fs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const editModalStart = appSource.indexOf("function EditMaterialsModal");
assert(editModalStart >= 0, "edit materials modal is extracted from the giant app render path");
const editModalSource = appSource.slice(editModalStart, appSource.indexOf("// ─── Tools View ───", editModalStart));
assert(editModalSource.includes("useState({})"), "edit materials modal keeps draft input state locally");
assert(editModalSource.includes("onChange={e => setDraftQtys"), "edit material inputs update local modal state only");
assert(!editModalSource.includes("setEditMaterialQtys"), "edit material inputs do not update parent app state on every keystroke");
assert(appSource.includes("<EditMaterialsModal"), "crew app renders the extracted edit materials modal");

console.log("edit materials responsiveness checks passed");
