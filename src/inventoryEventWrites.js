import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { buildCanonicalInventoryEventId } from "./inventoryEvents.js";

export const INVENTORY_EVENTS_COLLECTION = "inventoryEvents";
export const INVENTORY_EVENT_AUDIT_COLLECTION = "inventoryEventAuditRecords";
export const INVENTORY_EVENT_WRITE_SCHEMA_VERSION = 2;

const stableStringify = (value) => {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
};

const hashString = (value = "") => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

export const buildInventoryAuditRecordId = ({ eventId, writeSource, event }) => {
  const payloadHash = hashString(stableStringify(event));
  return [eventId || "inventory-event", writeSource || "inventory-dual-write", payloadHash].join("__");
};

export const buildInventoryEventWriteEntries = (events = [], options = {}) => {
  const {
    collectionName = INVENTORY_EVENTS_COLLECTION,
    auditCollectionName = INVENTORY_EVENT_AUDIT_COLLECTION,
    idFactory = buildCanonicalInventoryEventId,
    auditIdFactory = buildInventoryAuditRecordId,
    writeSource = "inventory-dual-write",
    createdAtValue = serverTimestamp(),
    auditCreatedAtValue = createdAtValue,
    includeAuditRecords = true,
  } = options;

  return (Array.isArray(events) ? events : [])
    .filter((event) => event && typeof event === "object")
    .map((event, index) => {
      const eventId = idFactory(event, index);
      const projectionPayload = {
        ...event,
        id: event.id || eventId,
        writeMeta: {
          source: writeSource,
          mode: "projection_upsert",
          schemaVersion: INVENTORY_EVENT_WRITE_SCHEMA_VERSION,
        },
        createdAt: createdAtValue,
      };
      const auditRecordId = auditIdFactory({ eventId, writeSource, event: projectionPayload, index });

      return {
        eventId,
        collectionName,
        payload: projectionPayload,
        auditRecord: includeAuditRecords
          ? {
              auditRecordId,
              collectionName: auditCollectionName,
              payload: {
                schemaVersion: INVENTORY_EVENT_WRITE_SCHEMA_VERSION,
                recordType: "inventory_event_write",
                id: auditRecordId,
                projectionEventId: eventId,
                writeSource,
                writeMeta: {
                  mode: "append_only_audit",
                  schemaVersion: INVENTORY_EVENT_WRITE_SCHEMA_VERSION,
                },
                createdAt: auditCreatedAtValue,
                event: projectionPayload,
              },
            }
          : null,
      };
    });
};

export const writeInventoryEvents = async (db, events = [], options = {}) => {
  if (!db) throw new Error("writeInventoryEvents requires db");

  const entries = buildInventoryEventWriteEntries(events, options);
  if (entries.length === 0) return [];

  const batch = writeBatch(db);
  const coll = collection(db, options.collectionName || INVENTORY_EVENTS_COLLECTION);
  const auditColl = collection(db, options.auditCollectionName || INVENTORY_EVENT_AUDIT_COLLECTION);

  entries.forEach(({ eventId, payload, auditRecord }) => {
    batch.set(doc(coll, eventId), payload, { merge: true });
    if (auditRecord) {
      batch.set(doc(auditColl, auditRecord.auditRecordId), auditRecord.payload);
    }
  });

  await batch.commit();
  return entries.map(({ eventId, auditRecord }) => ({
    eventId,
    auditRecordId: auditRecord?.auditRecordId || null,
  }));
};
