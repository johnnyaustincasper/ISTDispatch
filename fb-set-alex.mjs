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

await setDoc(doc(db, 'truckInventory', 'zkzNXhRTjw2kKhL5wj9p'), {
  r13_15_9_t: 2,
  r19_15_8_t: 1,
  r30_15_t: 14,
  r30_24_t: 4,
});
console.log("Done.");
process.exit(0);
