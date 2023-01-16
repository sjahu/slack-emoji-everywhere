const DB_NAME = "emoji_cache";
const STORE_NAME = "cache";
const KEY_NAME = "name";

function getDB() {
  return new Promise((resolve, reject) => {
    let request = indexedDB.open(DB_NAME);
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject();
    request.onupgradeneeded = (e) => {
      let objectStore = e.target.result.createObjectStore(STORE_NAME, { keyPath: KEY_NAME })
      objectStore.createIndex("_timestamp", "_timestamp");
    }
  });
}

export function get(keys) { // promise returns object with properties for the cache entries that exist
  return getDB().then(
    (db) => new Promise((resolve) => {
      let objectStore = db.transaction(STORE_NAME).objectStore(STORE_NAME);

      Promise.all(
        keys.map((key) => new Promise((resolve) => { // create promises for each key lookup
          // if key doesn't exist onsuccess is called anyway but target.result is undefined
          objectStore.get(key).onsuccess = (e) => resolve(e.target.result);
        }))
      ).then((results) => resolve(results.filter((result) => result).reduce((acc, curr) => (acc[curr.name] = curr, acc), {}))); // wait for all key promises, then compact results
    }),
    () => [] // failed to get DB
  );
}

export function put(values) { // promise returns array with the keys of the inserted values
  return getDB().then(
    (db) => new Promise((resolve) => {
      let objectStore = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME);

      Promise.all(
        values.map((value) => new Promise((resolve) => {
          objectStore.put({ ...value, _timestamp: Date.now() }).onsuccess = (e) => resolve(e.target.result); // result is the key of the inserted value
        }))
      ).then((results) => resolve(results));
    }),
    () => [] // failed to get DB
  );
}

export function remove(keys) { // promise returns nothing
  return getDB().then(
    (db) => new Promise((resolve) => {
      let objectStore = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME);

      Promise.all(
        keys.map((key) => new Promise((resolve) => {
          objectStore.delete(key).onsuccess = (e) => resolve(); // result is undefined
        }))
      ).then((results) => resolve());
    }),
    () => [] // failed to get DB
  );
}

export function clear() { // promise returns nothing
  return getDB().then(
    (db) => new Promise((resolve) => {
      let objectStore = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME);
      objectStore.clear().onsuccess = (e) => resolve();
    }),
    () => [] // failed to get DB
  );
}

export function count() { // promise returns count
  return getDB().then(
    (db) => new Promise((resolve) => {
      let objectStore = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME);
      objectStore.count().onsuccess = (e) => resolve(e.target.result);
    }),
    () => [] // failed to get DB
  );
}
