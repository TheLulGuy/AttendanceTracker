import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

async function push(collection, uid, data) {
  const updatedAt = Date.now();
  await setDoc(doc(db, collection, uid), { data, updatedAt });
  return updatedAt;
}

function subscribe(collection, uid, callback) {
  return onSnapshot(doc(db, collection, uid), snap => callback(snap.exists() ? snap.data() : null));
}

export const pushState  = (uid, state)  => push('attendanceState', uid, state);
export const pushConfig = (uid, config) => push('semesterConfig', uid, config);
export const subscribeState  = (uid, cb) => subscribe('attendanceState', uid, cb);
export const subscribeConfig = (uid, cb) => subscribe('semesterConfig', uid, cb);
