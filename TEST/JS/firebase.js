// ../JS/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDCz9qb5SMWGRdr450dibSLcao6Jmy6FqU",
  authDomain: "asd-project-cd03e.firebaseapp.com",
  projectId: "asd-project-cd03e",
  storageBucket: "asd-project-cd03e.firebasestorage.app",
  messagingSenderId: "18786483617",
  appId: "1:18786483617:web:d21f07b00b94d9c7041fe0",
  measurementId: "G-PB6DRVZPPK"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);



console.log("Firebase connected ✅");
