// ==========================================
// app.js : LE CŒUR DE L'APPLICATION (Logique & État)
// ==========================================
import { firebaseApp, db, auth, saveToCloud, loadFromCloud } from './firebase.js';
import { UI } from './ui.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// --- CONFIGURATIONS DE BASE ---
const APP_VERSION = "1.7.4";

const getDefaultSettings = () => ({ times: [15, 30, 60, 120], locations: ['Maison', 'Boulot', 'Ordi', 'Jardin'] });
const getDefaultCategories = () => ([{ id: 'c1', name: 'Business', note: '' }, { id: 'c2', name: 'Famille', note: '' }]);

const getTodayString = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

// --- L'ÉTAT GLOBAL (AppState) ---
const AppState = {
    currentUser: null, 
    authMode: 'login', 
    authError: '', 
    authMessage: '', 
    showPassword: false, 
    
    activeTab: 'calendar', 
    selectedDate: getTodayString(), 
    
    settings: getDefaultSettings(), 
    categories: [], 
    projects: [], 
    tasks: [], 
    availabilities: [], 
    
    homeTime: 30, 
    homeLocations: [], 
    homeSuggestions: [], 
    homeSearched: false,
    expandedCategoryIds: [], 
    expandedProjectId: null, 
    
    // UI Modals & Popups
    showAddProject: false, 
    showAddCategory: false,
    activeMenu: null, 
    deletePrompt: null, 
    editPrompt: null, 
    notePrompt: null, 
    taskModal: null, 
    taskNoteView: null, 
    availabilityModal: false, 
    showUpdateModal: false, 
    updateModalMode: null, 
    lastSeenVersion: null, 
    missedTasksNotif: [] 
};

// --- LE MOTEUR (App) ---
const App = {
    // Raccourci pour sauvegarder sur Firebase
    async save() {
        UI.renderContent(AppState); // On met à jour l'écran
        await saveToCloud(AppState); // On sauvegarde sur le Cloud
    },

    setTab(tab) { 
        AppState.activeTab = tab; 
        UI.renderNavbar(AppState.activeTab);
        UI.renderContent(AppState); 
    },

    // Méthode appelée au lancement de l'application
    init() {
        UI.renderLoading();
        
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                AppState.currentUser = user;
                
                // Chargement des données depuis firebase.js
                const data = await loadFromCloud(user.uid);
                if (data) {
                    AppState.categories = data.categories || [];
                    AppState.projects = data.projects || [];
                    AppState.tasks = data.tasks || [];
                    AppState.settings = data.settings || AppState.settings;
                    AppState.availabilities = data.availabilities || [];
                } else {
                    await saveToCloud(AppState);
                }
                
                UI.renderNavbar(AppState.activeTab);
                UI.renderContent(AppState);
            } else {
                AppState.currentUser = null;
                // Si l'utilisateur n'est pas connecté, on afficherait normalement le formulaire de login ici (à venir dans ui.js)
                const content = document.getElementById('app-content');
                if (content) content.innerHTML = `<h2 class="text-xl font-bold text-white text-center mt-10">Veuillez vous connecter.</h2>`;
            }
        });
    }
};

// Permettre au HTML de déclencher les fonctions (ex: onclick="App.setTab('home')")
window.App = App;
window.AppState = AppState;

// Démarrage direct de l'application
App.init();

