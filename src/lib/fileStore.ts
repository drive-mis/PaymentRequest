"use client";

// Attachment storage for the frontend-only build.
//
// Records live in localStorage, which is far too small (~5MB total) to hold
// scanned contracts and cheque photos. So the file *bytes* go to IndexedDB —
// which has a much larger quota and stores Blobs natively — and the request
// record keeps only a small reference string.
//
// Reference format: "<id>::<original filename>". Older seed data holds a bare
// filename with no id; that still displays, just without a View link.

const DB_NAME = "df_files";
const DB_VERSION = 1;
const STORE = "attachments";

const REF_SEPARATOR = "::";

export interface FileRef {
  id: string | null;
  name: string;
}

export function parseFileRef(value: string | null | undefined): FileRef | null {
  if (!value) return null;
  const idx = value.indexOf(REF_SEPARATOR);
  if (idx === -1) return { id: null, name: value };
  return { id: value.slice(0, idx), name: value.slice(idx + REF_SEPARATOR.length) };
}

export function buildFileRef(id: string, name: string): string {
  return `${id}${REF_SEPARATOR}${name}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Could not open the attachment database."));
  });
}

/** Persist a picked file and return the reference to store on the record. */
export async function saveFile(file: File): Promise<string> {
  const id = `f_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({ name: file.name, type: file.type, blob: file }, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Could not save the attachment."));
      tx.onabort = () => reject(tx.error ?? new Error("Saving the attachment was aborted."));
    });
  } finally {
    db.close();
  }
  return buildFileRef(id, file.name);
}

interface StoredFile {
  name: string;
  type: string;
  blob: Blob;
}

async function readFile(id: string): Promise<StoredFile | null> {
  const db = await openDb();
  try {
    return await new Promise<StoredFile | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => resolve((req.result as StoredFile) ?? null);
      req.onerror = () => reject(req.error ?? new Error("Could not read the attachment."));
    });
  } finally {
    db.close();
  }
}

/**
 * Open a stored attachment in a new tab. Returns false when the bytes aren't
 * available (seed data, or a file uploaded in a different browser), so the
 * caller can explain rather than silently doing nothing.
 */
export async function openStoredFile(ref: string): Promise<boolean> {
  const parsed = parseFileRef(ref);
  if (!parsed?.id) return false;

  const stored = await readFile(parsed.id);
  if (!stored) return false;

  const url = URL.createObjectURL(stored.blob);
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) {
    // Popup blocked — fall back to a download so the file still reaches them.
    const a = document.createElement("a");
    a.href = url;
    a.download = stored.name;
    a.click();
  }
  // Give the new tab time to load before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}
