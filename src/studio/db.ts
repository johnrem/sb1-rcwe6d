import type { Piece, Project, Source, SyncedFolder, Version } from './types';

const DB_NAME = 'content-studio';
const DB_VERSION = 1;

export type StoreName = 'sources' | 'folders' | 'projects' | 'pieces' | 'versions';
type StoreValue = {
  sources: Source;
  folders: SyncedFolder;
  projects: Project;
  pieces: Piece;
  versions: Version;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('sources', { keyPath: 'id' });
      db.createObjectStore('folders', { keyPath: 'id' });
      db.createObjectStore('projects', { keyPath: 'id' });
      const pieces = db.createObjectStore('pieces', { keyPath: 'id' });
      pieces.createIndex('projectId', 'projectId');
      const versions = db.createObjectStore('versions', { keyPath: 'id' });
      versions.createIndex('pieceId', 'pieceId');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAll<S extends StoreName>(store: S): Promise<StoreValue[S][]> {
  const db = await open();
  return wrap(db.transaction(store).objectStore(store).getAll());
}

export async function getByIndex<S extends 'pieces' | 'versions'>(
  store: S,
  index: string,
  key: string,
): Promise<StoreValue[S][]> {
  const db = await open();
  return wrap(db.transaction(store).objectStore(store).index(index).getAll(key));
}

export async function put<S extends StoreName>(store: S, value: StoreValue[S]): Promise<void> {
  const db = await open();
  await wrap(db.transaction(store, 'readwrite').objectStore(store).put(value));
}

export async function putMany<S extends StoreName>(store: S, values: StoreValue[S][]): Promise<void> {
  if (!values.length) return;
  const db = await open();
  const tx = db.transaction(store, 'readwrite');
  const os = tx.objectStore(store);
  values.forEach((v) => os.put(v));
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function remove(store: StoreName, id: string): Promise<void> {
  const db = await open();
  await wrap(db.transaction(store, 'readwrite').objectStore(store).delete(id));
}

export async function removeMany(store: StoreName, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const db = await open();
  const tx = db.transaction(store, 'readwrite');
  const os = tx.objectStore(store);
  ids.forEach((id) => os.delete(id));
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
