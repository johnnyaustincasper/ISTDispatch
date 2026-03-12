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

await setDoc(doc(db, 'truckInventory', "QqPu7vll9n4ScTB4wWdU"), {
  r13_15_8_t: 3,
  r19_24_8_t: 1,
  r19_15_8_t: 1,
  r13_24_8_pcs: 8,
  blown_fg: 19,
});
console.log("Done.");
process.exit(0);
