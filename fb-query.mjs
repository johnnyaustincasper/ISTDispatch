import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore';

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

const snap = await getDocs(collection(db, 'trucks'));
snap.docs.forEach(d => console.log(d.id, JSON.stringify(d.data())));
process.exit(0);
