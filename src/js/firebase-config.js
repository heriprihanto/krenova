import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// REPLACE THESE CONFIGURATION KEYS WITH YOUR FIREBASE PROJECT CONFIGURATION
const firebaseConfig = {
  apiKey: "AIzaSyCVrkZzet6KORlszbm1-0a7fMwkc_Saq70",
  authDomain: "krenova-kota-tegal.firebaseapp.com",
  projectId: "krenova-kota-tegal",
  storageBucket: "krenova-kota-tegal.firebasestorage.app",
  messagingSenderId: "220560453721",
  appId: "1:220560453721:web:881b63f68300df6a744148"
};

let app, auth, db, storage, isMock = false;

// Check if the user has filled in the configuration
const isConfigured = firebaseConfig.apiKey !== "YOUR_API_KEY" && firebaseConfig.projectId !== "YOUR_PROJECT_ID";

if (isConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    console.log("Firebase initialized successfully.");
  } catch (error) {
    console.error("Failed to initialize Firebase SDK:", error);
    isMock = true;
  }
} else {
  console.warn("Firebase config is not set. Running in MOCK MODE (LocalStorage Fallback) for local preview.");
  isMock = true;
}

// Global flag to let other files know if they should use mock data
window.isFirebaseMocked = isMock;

export { app, auth, db, storage, isMock };
