
// ==========================================
// firebase.js : GESTION DE LA BASE DE DONNÉES ET DE L'AUTHENTIFICATION
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyDInKtDR1g58e7OXkK3AgMROUXbHOdY7MU",
    authDomain: "my-task-20e5d.firebaseapp.com",
    projectId: "my-task-20e5d",
    storageBucket: "my-task-20e5d.firebasestorage.app",
    messagingSenderId: "8648826848",
    appId: "1:8648826848:web:1fe25c1b5a34e0deb55585"
};

// Initialisation de Firebase
export const firebaseApp = initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp);
export const auth = getAuth(firebaseApp);

// ==========================================
// FONCTIONS LIÉES À LA BASE DE DONNÉES
// ==========================================

// Fonction asynchrone pour sauvegarder les données de l'utilisateur vers Firestore.
export async function saveToCloud(state) {
    if (!state.currentUser) return; 
    const dataToSave = { 
        categories: state.categories, 
        projects: state.projects, 
        tasks: state.tasks, 
        settings: state.settings, 
        availabilities: state.availabilities 
    };
    try { 
        await setDoc(doc(db, "users", state.currentUser.uid), dataToSave); 
    } catch (e) { 
        console.error("Erreur de sauvegarde Cloud:", e); 
    }
}

// Fonction asynchrone pour récupérer les données de l'utilisateur depuis Firestore.
export async function loadFromCloud(uid) {
    try {
        const docRef = doc(db, "users", uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data();
        }
        return null; // Renvoie null si le document n'existe pas encore.
    } catch (e) {
        console.error("Erreur de chargement Cloud:", e);
        return null;
    }
}
