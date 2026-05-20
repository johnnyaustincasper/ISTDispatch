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
    snapshotCount: 0,
    totalDocsReceived: 0,
    subscribedAt: null,
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

export const buildListenerErrorStatus = (name, error, extra = {}) => ({
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
  ...extra,
});

export function listenToQuery(queryRef, name, options = {}) {
  const {
    mapSnapshot = mapSnapshotToArray,
    mapDoc,
    onData,
    onStatus,
    onError,
  } = options;
  const subscribedAt = new Date().toISOString();
  let snapshotCount = 0;
  let totalDocsReceived = 0;

  const metricExtra = (snap = null) => {
    const docCount = snap?.size ?? snap?.docs?.length ?? 0;
    return {
      subscribedAt,
      snapshotCount,
      totalDocsReceived,
      averageDocsPerSnapshot: snapshotCount > 0 ? Math.round((totalDocsReceived / snapshotCount) * 100) / 100 : 0,
      lastDocCount: docCount,
    };
  };

  onStatus?.({
    name,
    active: true,
    status: "subscribed",
    docCount: 0,
    subscribedAt,
    snapshotCount,
    totalDocsReceived,
    averageDocsPerSnapshot: 0,
    lastSnapshotAt: null,
    lastError: null,
  });

  return onSnapshot(
    queryRef,
    (snap) => {
      const docCount = snap?.size ?? snap?.docs?.length ?? 0;
      snapshotCount += 1;
      totalDocsReceived += docCount;
      const status = buildListenerStatus(name, snap, metricExtra(snap));
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
      const status = buildListenerErrorStatus(name, error, metricExtra());
      onStatus?.(status);
      onError?.(error, status);
    },
  );
}

export function listenToCollection(db, name, options = {}) {
  return listenToQuery(collection(db, name), name, options);
}
