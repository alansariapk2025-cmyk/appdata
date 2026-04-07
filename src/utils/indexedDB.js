// utils/indexedDB.js
const DB_NAME = "productsDB";
const STORE = "products";

export const initDB = () =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

export const saveProductsToDB = async products => {
  const db = await initDB();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  products.forEach(p => store.put(p));
  return tx.complete;
};

export const getProductsFromDB = async () => {
  const db = await initDB();
  const tx = db.transaction(STORE, "readonly");
  const store = tx.objectStore(STORE);

  return new Promise(resolve => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
  });
};

export const clearDB = async () => {
  const db = await initDB();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).clear();
};