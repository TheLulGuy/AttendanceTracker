import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * One local+cloud synced value (attendance state, or semester config). Both callers share this
 * exact lifecycle - previously it was duplicated by hand for state and config and drifted out of
 * sync between the two copies each time it needed a fix, which is how three separate data-loss
 * races made it to production. Single source of truth for the one invariant that actually
 * matters: never push to Firestore until the live listener has confirmed the real cloud state at
 * least once for this login. `syncReady` is only ever set true inside this hook, right after that
 * confirmation - nothing outside it can push early by construction.
 *
 * @param {string} storageKey - AsyncStorage key for the cached blob (synced-at key is derived: `${storageKey}-synced-at`)
 * @param {*} initial - value before local load resolves
 * @param {(parsed:any) => any|null} migrate - normalize a parsed local/cloud blob; return null to reject it
 * @param {(uid:string, data:any) => Promise<number>} push - writes to Firestore, resolves the updatedAt it used
 * @param {(uid:string, cb:(cloud:{data,updatedAt}|null)=>void) => (()=>void)} subscribe - live Firestore listener
 * @param {object|null} user - current Firebase user, or null when signed out
 * @param {boolean} tabLocked - suppress pushes while true (this device has another active tab)
 * @param {(user, current:any) => any} [seedFor] - value to seed the cloud with on first-ever sync (defaults to the current local value)
 * @param {(applied:boolean) => void} [onLoad] - called once local load resolves
 * @param {() => void} [onSaving] - called synchronously when a real (non-remote) change starts its debounce
 * @param {() => void} [onSaved] - called after a real (non-remote) change finishes its local save
 */
export function useCloudSync({
  storageKey, initial, migrate, push, subscribe, user, tabLocked,
  seedFor = (_user, current) => current,
  onLoad = () => {}, onSaving = () => {}, onSaved = () => {},
}) {
  const syncedAtKey = `${storageKey}-synced-at`;

  const [data, setData] = useState(initial);
  const [ready, setReady] = useState(false);       // local AsyncStorage load resolved
  const [syncReady, setSyncReady] = useState(false); // live listener's first snapshot resolved, for this login

  const dataRef = useRef(data);
  const lastAt = useRef(0);
  const suppressPush = useRef(false);
  const saveTimer = useRef(null);

  useEffect(() => { dataRef.current = data; }, [data]);

  // ── Local load, once on mount ──
  useEffect(() => {
    AsyncStorage.getItem(storageKey)
      .then(raw => {
        let applied = false;
        if (raw) {
          try {
            const migrated = migrate(JSON.parse(raw));
            if (migrated != null) { setData(migrated); applied = true; }
          } catch (_) {}
        }
        onLoad(applied);
        setReady(true);
      })
      .catch(() => setReady(true));
  }, []);

  // ── Debounced local cache + cloud push on every change ──
  useEffect(() => {
    if (!ready) return;
    const isRemote = suppressPush.current;
    suppressPush.current = false;
    if (!isRemote) onSaving();
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(storageKey, JSON.stringify(data))
        .then(() => {
          if (isRemote) return;
          onSaved();
          // The one invariant that matters: never push before the live listener has confirmed
          // the real cloud state at least once - otherwise a fresh/empty local value can race
          // ahead of it and overwrite real cloud data.
          if (user && !tabLocked && syncReady) {
            push(user.uid, data)
              .then(updatedAt => {
                lastAt.current = updatedAt;
                return AsyncStorage.setItem(syncedAtKey, String(updatedAt));
              })
              .catch(() => {});
          }
        })
        .catch(() => {});
    }, 400);
  }, [data, ready, user, tabLocked, syncReady]);

  // ── Live cloud subscription ──
  useEffect(() => {
    if (!user || !ready) return;
    let cancelled = false;
    let unsub = () => {};
    setSyncReady(false);

    (async () => {
      const localAt = await AsyncStorage.getItem(syncedAtKey);
      if (cancelled) return;
      lastAt.current = Number(localAt || 0);

      unsub = subscribe(user.uid, cloud => {
        if (cloud) {
          if (cloud.updatedAt > lastAt.current) {
            const migrated = migrate(cloud.data);
            if (migrated != null) {
              lastAt.current = cloud.updatedAt;
              suppressPush.current = true;
              setData(migrated);
              AsyncStorage.setItem(syncedAtKey, String(cloud.updatedAt)).catch(() => {});
            }
          }
          setSyncReady(true);
        } else if (lastAt.current === 0) {
          // No cloud doc at all yet - this is the very first sync ever for this account.
          const seed = seedFor(user, dataRef.current);
          if (seed !== dataRef.current) { suppressPush.current = true; setData(seed); }
          push(user.uid, seed)
            .then(updatedAt => {
              lastAt.current = updatedAt;
              setSyncReady(true);
              return AsyncStorage.setItem(syncedAtKey, String(updatedAt));
            })
            .catch(() => setSyncReady(true));
        } else {
          setSyncReady(true);
        }
      });
    })();

    return () => { cancelled = true; unsub(); };
  }, [user, ready]);

  function reset(newData) {
    lastAt.current = 0;
    setSyncReady(false);
    setData(newData);
    return AsyncStorage.multiRemove([storageKey, syncedAtKey]);
  }

  return { data, setData, ready, syncReady, reset };
}
