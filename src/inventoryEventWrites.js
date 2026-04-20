import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { buildCanonicalInventoryEventId } from "./inventoryEvents.js";

export const INVENTORY_EVENTS_COLLECTION = "inventoryEvents";

export const buildInventoryEventWriteEntries = (events = [], options = {}) => {
  const {
    collectionName = INVENTORY_EVENTS_COLLECTION,
    idFactory = buildCanonicalInventoryEventId,
    writeSource = "inventory-dual-write",
    createdAtValue = serverTimestamp(),
  } = options;

  return (Array.isArray(events) ? events : [])
    .filter((event) => event && typeof event === "object")
    .map((event, index) => {
      const eventId = idFactory(event, index);
      return {
        eventId,
        collectionName,
        payload: {
          ...event,
          id: event.id || eventId,
          writeMeta: {
            source: writeSource,
            mode: "set",
          },
          createdAt: createdAtValue,
        },
      };
    });
};

export const writeInventoryEvents = async (db, events = [], options = {}) => {
  if (!db) throw new Error("writeInventoryEvents requires db");

  const entries = buildInventoryEventWriteEntries(events, options);
  if (entries.length === 0) return [];

  const batch = writeBatch(db);
  const coll = collection(db, options.collectionName || INVENTORY_EVENTS_COLLECTION);

  entries.forEach(({ eventId, payload }) => {
    batch.set(doc(coll, eventId), payload, { merge: true });
  });

  await batch.commit();
  return entries.map(({ eventId }) => eventId);
};
