import { collection, onSnapshot } from "firebase/firestore";

const docWithId = (docSnap) => ({ id: docSnap.id, ...docSnap.data() });

export const mapSnapshotToArray = (snap, mapDoc = docWithId) => snap.docs.map((docSnap) => mapDoc(docSnap));

export const mapSnapshotToObjectById = (snap, mapDoc = (docSnap) => docSnap.data()) => {
  const rows = {};
  snap.docs.forEach((docSnap) => {
    rows[docSnap.id] = mapDoc(docSnap);
  });
  return rows;
};

export const createInitialListenerDiagnostics = (collectionNames = []) => Object.fromEntries(
  collectionNames.map((name) => [name, {
    active: false,
    status: "never",
    docCount: 0,
    lastSnapshotAt: null,
    lastError: null,
  }]),
);

export const buildListenerStatus = (name, snap, extra = {}) => ({
  name,
  active: true,
  status: "fresh",
  docCount: snap?.size ?? snap?.docs?.length ?? 0,
  lastSnapshotAt: new Date().toISOString(),
  lastError: null,
  ...extra,
});

export const buildListenerErrorStatus = (name, error) => ({
  name,
  active: false,
  status: "error",
  docCount: 0,
  lastSnapshotAt: null,
  lastError: {
    name: error?.name || "Error",
    message: error?.message || String(error || "Unknown listener error"),
    code: error?.code || null,
  },
});

export function listenToQuery(queryRef, name, options = {}) {
  const {
    mapSnapshot = mapSnapshotToArray,
    mapDoc,
    onData,
    onStatus,
    onError,
  } = options;

  return onSnapshot(
    queryRef,
    (snap) => {
      const status = buildListenerStatus(name, snap);
      onStatus?.(status);
      try {
        const data = mapSnapshot(snap, mapDoc);
        Promise.resolve(onData?.(data, snap, status)).catch((error) => {
          const errStatus = { ...status, status: "error", lastError: { name: error?.name || "Error", message: error?.message || String(error), code: error?.code || null } };
          onStatus?.(errStatus);
          onError?.(error, errStatus);
        });
      } catch (error) {
        const errStatus = { ...status, status: "error", lastError: { name: error?.name || "Error", message: error?.message || String(error), code: error?.code || null } };
        onStatus?.(errStatus);
        onError?.(error, errStatus);
      }
    },
    (error) => {
      const status = buildListenerErrorStatus(name, error);
      onStatus?.(status);
      onError?.(error, status);
    },
  );
}

export function listenToCollection(db, name, options = {}) {
  return listenToQuery(collection(db, name), name, options);
}
