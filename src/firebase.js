// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth"; // <-- Add this

const firebaseConfig = {
  apiKey: "AIzaSyAkirjtolBsuntou50eWn2bF9SHqwKUZS0",
  authDomain: "ansariapk-ff0d8.firebaseapp.com",
  projectId: "ansariapk-ff0d8",
  storageBucket: "ansariapk-ff0d8.appspot.com",
  messagingSenderId: "572236162041",
  appId: "1:572236162041:web:4489128e0ef11de288d328",
  measurementId: "G-TBWJY8NPTL"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app); // <-- Auth initialized

export { app, db, auth };
