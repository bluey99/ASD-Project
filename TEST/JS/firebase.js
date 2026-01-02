// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDCz9qb5SMWGRdr450dibSLcao6Jmy6FqU",
  authDomain: "asd-project-cd03e.firebaseapp.com",
  projectId: "asd-project-cd03e",
  storageBucket: "asd-project-cd03e.firebasestorage.app",
  messagingSenderId: "18786483617",
  appId: "1:18786483617:web:d21f07b00b94d9c7041fe0",
  measurementId: "G-PB6DRVZPPK"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);