import { addDoc, collection, getDocs, query, updateDoc, where } from "firebase/firestore";

import { db } from "../../firebase.js";

export function createQuoteStorageHelpers({
  db: firestoreDb,
  addDoc: addDocument = addDoc,
  collection: collectionRef = collection,
  getDocs: getDocuments = getDocs,
  query: buildQuery = query,
  updateDoc: updateDocument = updateDoc,
  where: whereClause = where,
} = {}) {
  async function saveQuoteSummary(summary) {
    const payload = { ...summary, updatedAt: summary.updatedAt || new Date().toISOString() };
    try {
      if (payload.sourceTakeoffJobId) {
        const q = buildQuery(collectionRef(firestoreDb, "quotes"), whereClause("sourceTakeoffJobId", "==", payload.sourceTakeoffJobId));
        const snap = await getDocuments(q);
        if (!snap.empty) {
          await updateDocument(snap.docs[0].ref, { ...payload, createdAt: snap.docs[0].data()?.createdAt || payload.createdAt });
          return { id: snap.docs[0].id, error: null };
        }
      }
      const ref = await addDocument(collectionRef(firestoreDb, "quotes"), payload);
      return { id: ref?.id || null, error: null };
    } catch (error) {
      return { id: null, error };
    }
  }

  return { saveQuoteSummary };
}

export const { saveQuoteSummary } = createQuoteStorageHelpers({ db });
