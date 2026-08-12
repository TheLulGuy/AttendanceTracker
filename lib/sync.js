import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

async function push(collection, uid, data) {
  await setDoc(doc(db, collection, uid), { data, updatedAt: Date.now() });
}

async function pull(collection, uid) {
  const snap = await getDoc(doc(db, collection, uid));
  return snap.exists() ? snap.data() : null;
}

export const pushState  = (uid, state)  => push('attendanceState', uid, state);
export const pushConfig = (uid, config) => push('semesterConfig', uid, config);
export const pullState  = uid => pull('attendanceState', uid);
export const pullConfig = uid => pull('semesterConfig', uid);
