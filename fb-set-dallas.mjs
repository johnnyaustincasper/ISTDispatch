import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBvL6M_2kPGt8XrcgpPHfL-bwU9BAH57Qk",
  authDomain: "insulation-services-da91a.firebaseapp.com",
  projectId: "insulation-services-da91a",
  storageBucket: "insulation-services-da91a.firebasestorage.app",
  messagingSenderId: "761459419108",
  appId: "1:761459419108:web:25235ad8b067eddb96c9f1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Dallas truck ID: wmMarb8swAWdeYLuj75Z
// OC = 48 gal/bbl
const oc_a = Math.round(43 / 48 * 100) / 100; // 0.90 bbl
const oc_b = Math.round(49 / 48 * 100) / 100; // 1.02 bbl

await setDoc(doc(db, 'truckInventory', 'wmMarb8swAWdeYLuj75Z'), {
  oc_a,
  oc_b,
  rw_4_t: 1,
});

console.log(`Done. OC A: ${oc_a} bbl, OC B: ${oc_b} bbl, Rockwool 4": 1 tube`);
process.exit(0);
