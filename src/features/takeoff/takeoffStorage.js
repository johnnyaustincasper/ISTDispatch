import { db } from "../../firebase.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

export function createTakeoffStorageHelpers({
  db: firestoreDb,
  addDoc: addDocument = addDoc,
  collection: collectionRef = collection,
  deleteDoc: deleteDocument = deleteDoc,
  doc: docRef = doc,
  getDoc: getDocument = getDoc,
  getDocs: getDocuments = getDocs,
  query: buildQuery = query,
  setDoc: setDocument = setDoc,
  updateDoc: updateDocument = updateDoc,
  where: whereClause = where,
  now = () => new Date().toISOString(),
} = {}) {
  async function saveTakeoffJob(savedBy, jobName, jobData) {
    try {
      const q = buildQuery(collectionRef(firestoreDb, "takeoffJobs"), whereClause("job_name", "==", jobName), whereClause("saved_by", "==", savedBy));
      const snap = await getDocuments(q);
      if (!snap.empty) {
        await updateDocument(snap.docs[0].ref, { job_data: jobData, updated_at: now() });
        return { id: snap.docs[0].id, error: null };
      }
      const ref = await addDocument(collectionRef(firestoreDb, "takeoffJobs"), { job_name: jobName, saved_by: savedBy, job_data: jobData, updated_at: now(), created_at: now() });
      return { id: ref?.id || null, error: null };
    } catch (e) { return { id: null, error: e }; }
  }

  async function loadTakeoffJobs(savedBy) {
    try {
      const q = buildQuery(collectionRef(firestoreDb, "takeoffJobs"), whereClause("saved_by", "==", savedBy));
      const snap = await getDocuments(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => d.job_name !== "__autosave__").sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));
      return { data, error: null };
    } catch (e) { return { data: [], error: e }; }
  }

  async function loadAllTakeoffJobs(teamMembers) {
    try {
      const results = [];
      for (const member of teamMembers) {
        const r = await loadTakeoffJobs(member);
        if (r.data) results.push(...r.data);
      }
      return results;
    } catch (e) { return []; }
  }

  async function deleteTakeoffJob(id) {
    try { await deleteDocument(docRef(firestoreDb, "takeoffJobs", id)); return { error: null }; }
    catch (e) { return { error: e }; }
  }

  async function saveTakeoffAutosave(savedBy, data) {
    try {
      await setDocument(docRef(firestoreDb, "takeoffAutosave", savedBy), { job_data: data, updated_at: now() }, { merge: true });
      return { error: null };
    } catch (e) { return { error: e }; }
  }

  async function loadTakeoffAutosave(savedBy) {
    try {
      const snap = await getDocument(docRef(firestoreDb, "takeoffAutosave", savedBy));
      if (!snap.exists()) return null;
      return snap.data().job_data;
    } catch (e) { return null; }
  }

  return {
    saveTakeoffJob,
    loadTakeoffJobs,
    loadAllTakeoffJobs,
    deleteTakeoffJob,
    saveTakeoffAutosave,
    loadTakeoffAutosave,
  };
}

export const {
  saveTakeoffJob,
  loadTakeoffJobs,
  loadAllTakeoffJobs,
  deleteTakeoffJob,
  saveTakeoffAutosave,
  loadTakeoffAutosave,
} = createTakeoffStorageHelpers({ db });
