// ==========================================
// 0. CONNEXION AU CLOUD FIREBASE & AUTHENTIFICATION
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

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

// ==========================================
// 1. CONFIGURATION DES MISES À JOUR
// ==========================================
const RELEASE_HISTORY = [
    {
        version: "1.7.4",
        title: "Timeblocking Avancé",
        notes: "• 🎯 Menu fluide : Un simple clic sur une tâche ouvre le menu (Modifier/Supprimer). Fini les 3 petits points !<br>• 🖱️ Drag & Drop : Glissez vos tâches non planifiées vers le calendrier pour les programmer instantanément.<br>• ⏱️ La ligne rouge de l'heure actuelle se place désormais au millimètre près dans votre chronologie."
    },
    {
        version: "1.7.3",
        title: "Navigation & Notes",
        notes: "• 📝 Les notes ont désormais leur propre fenêtre d'affichage sécurisée."
    },
    {
        version: "1.7.2",
        title: "Historique & Calendrier Interactif",
        notes: "• 📜 L'historique complet des mises à jour s'affiche dans les paramètres.<br>• ✅ Cases à cocher interactives dans le calendrier."
    },
    {
        version: "1.7.1",
        title: "Correctifs Calendrier",
        notes: "• 🗓️ Affichage des mois et scroll sur 90 jours.<br>• 🗑️ Bouton Gomme pour effacer la planification d'une tâche."
    },
    {
        version: "1.7.0",
        title: "Le Calendrier Chronologique",
        notes: "• 📅 Nouvel onglet Calendrier avec timeline."
    },
    {
        version: "1.6.4.1",
        title: "Nouveautés Intelligentes",
        notes: "• 🧠 Affichage dynamique des mises à jour (uniquement ce que vous n'avez pas encore vu)."
    },
    {
        version: "1.6.4",
        title: "Changement de Nom & UI",
        notes: "• 🏷️ OS de Vie devient officiellement <b>My Task</b> !"
    },
{
        version: "1.6.3",
        title: "PWA Plein Ecran",
        notes: "• 📱 L'application s'installe nativement sur l'écran d'accueil sans barre de recherche (Plus d'erreur 500)."
    },
    {
        version: "1.6.2",
        title: "Confort",
        notes: "• 👀 Bouton pour afficher/masquer le mot de passe.<br>• 📢 Fenêtre des nouveautés au démarrage."
    },
{
        version: "1.6.1",
        title: "Oubli de MDP",
        notes: "• 🔒 Ajout de la réinitialisation par email."
    },
    {
        version: "1.6.0",
        title: "Sécurité",
        notes: "• ☁️ Synchronisation Cloud via compte privé Firebase."
    }
];

const APP_VERSION = RELEASE_HISTORY[0].version;

// ==========================================
// 2. DONNÉES INITIALES 
// ==========================================
const getDefaultSettings = () => ({ times: [15, 30, 60, 120], locations: ['Maison', 'Boulot', 'Ordi', 'Jardin'] });
const getDefaultCategories = () => ([{ id: 'c1', name: 'Business', note: '' }, { id: 'c2', name: 'Famille', note: '' }]);

// ==========================================
// 3. ÉTAT GLOBAL DE L'APPLICATION
// ==========================================
const getTodayString = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

const AppState = {
    currentUser: null, authMode: 'login', authError: '', authMessage: '', showPassword: false, 
    activeTab: 'calendar', selectedDate: getTodayString(), 
    settings: getDefaultSettings(), categories: [], projects: [], tasks: [], availabilities: [], 
    homeTime: 30, homeLocations: [], homeSuggestions: [], homeSearched: false,
    expandedCategoryIds: [], expandedProjectId: null, showAddProject: false, showAddCategory: false,
    activeMenu: null, deletePrompt: null, editPrompt: null, notePrompt: null, taskModal: null, taskNoteView: null, 
    availabilityModal: false, showUpdateModal: false, updateModalMode: null, lastSeenVersion: null, missedTasksNotif: [] 
};

// ==========================================
// 4. MOTEUR DE L'APPLICATION
// ==========================================
const App = {
    lastTapTime: 0,
    
    // --- GESTION DU TEMPS & RETOUR EN BASE ---
    checkMissedTasks() {
        const now = new Date();
        const todayStr = getTodayString();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        let missed = []; let hasChanges = false;

        AppState.tasks = AppState.tasks.map(t => {
            if (t.status !== 'done' && t.scheduledDate) {
                const [tH, tM] = t.scheduledTime ? t.scheduledTime.split(':').map(Number) : [23, 59];
                if (t.scheduledDate < todayStr || (t.scheduledDate === todayStr && (tH * 60 + tM) < currentMinutes)) {
                    missed.push(t); hasChanges = true; return { ...t, scheduledDate: null, scheduledTime: null };
                }
            }
            if (t.subtasks && t.subtasks.length > 0) {
                let subChanged = false;
                const newSubs = t.subtasks.map(s => {
                    if (s.status !== 'done' && s.scheduledDate) {
                        const [sH, sM] = s.scheduledTime ? s.scheduledTime.split(':').map(Number) : [23, 59];
                        if (s.scheduledDate < todayStr || (s.scheduledDate === todayStr && (sH * 60 + sM) < currentMinutes)) {
                            missed.push({...s, parentName: t.name}); subChanged = true; return { ...s, scheduledDate: null, scheduledTime: null };
                        }
                    } return s;
                });
                if (subChanged) { hasChanges = true; return { ...t, subtasks: newSubs }; }
            }
            return t;
        });

        const oldAvailLength = AppState.availabilities.length;
        AppState.availabilities = AppState.availabilities.filter(a => {
            const [aH, aM] = a.end ? a.end.split(':').map(Number) : [23, 59];
            return !(a.date < todayStr || (a.date === todayStr && (aH * 60 + aM) < currentMinutes));
        });
        if (oldAvailLength !== AppState.availabilities.length) hasChanges = true;
        if (missed.length > 0) { AppState.missedTasksNotif = missed; }
        if (hasChanges && AppState.currentUser) { this.saveToCloud(); }
    },
    closeMissedTasksNotif() { AppState.missedTasksNotif = []; this.render(); },

    // --- AUTHENTIFICATION ---
    async handleAuth(event) {
        event.preventDefault();
        const email = document.getElementById('auth-email').value; const password = document.getElementById('auth-password').value;
        AppState.authError = ''; AppState.authMessage = ''; this.render();
        try {
            if (AppState.authMode === 'login') await signInWithEmailAndPassword(auth, email, password);
            else {
                await createUserWithEmailAndPassword(auth, email, password);
                AppState.settings = getDefaultSettings(); AppState.categories = getDefaultCategories();
                AppState.projects = []; AppState.tasks = []; AppState.availabilities = [];
                await this.saveToCloud();
            }
        } catch (error) { AppState.authError = "Erreur de connexion / Email invalide."; this.render(); }
    },
    toggleAuthMode() { AppState.authMode = AppState.authMode === 'login' ? 'register' : 'login'; this.render(); },
    togglePasswordVisibility() {
        AppState.showPassword = !AppState.showPassword;
        const pwdInput = document.getElementById('auth-password'); const btn = document.getElementById('toggle-pwd-btn');
        if (pwdInput) pwdInput.type = AppState.showPassword ? 'text' : 'password';
        if (btn) { btn.innerHTML = `<i data-lucide="${AppState.showPassword ? 'eye-off' : 'eye'}" class="w-5 h-5"></i>`; lucide.createIcons(); }
    },
    async resetPassword() {
        const email = document.getElementById('auth-email').value.trim();
        if (!email) { AppState.authError = "Veuillez taper votre adresse email d'abord."; this.render(); return; }
        try { await sendPasswordResetEmail(auth, email); AppState.authMessage = "Email de réinitialisation envoyé !"; this.render(); } 
        catch (error) { AppState.authError = "Aucun compte trouvé avec cet email."; this.render(); }
    },
    async logout() {
        if(confirm("Veux-tu vraiment te déconnecter ?")) {
            await signOut(auth); AppState.currentUser = null;
            AppState.categories = []; AppState.projects = []; AppState.tasks = []; AppState.availabilities = []; this.render();
        }
    },

    // --- SYNCHRONISATION ---
    async saveToCloud() {
        if (!AppState.currentUser) return; 
        const dataToSave = { categories: AppState.categories, projects: AppState.projects, tasks: AppState.tasks, settings: AppState.settings, availabilities: AppState.availabilities };
        try { await setDoc(doc(db, "users", AppState.currentUser.uid), dataToSave); } catch (e) { console.error("Erreur de sauvegarde Cloud:", e); }
    },
    save() { this.render(); this.saveToCloud(); },
    setTab(tab) { AppState.activeTab = tab; this.render(); },

    // --- GESTION DES NOTES ---
    openTaskNoteView(id, parentId = null) {
        let itemData = parentId ? AppState.tasks.find(t => t.id === parentId).subtasks.find(s => s.id === id) : AppState.tasks.find(t => t.id === id);
        AppState.taskNoteView = { id, parentId, note: itemData.note }; this.render();
    },
    closeTaskNoteView() { AppState.taskNoteView = null; this.render(); },
    deleteTaskNote() {
        if(confirm("Effacer cette note ?")) {
            const { id, parentId } = AppState.taskNoteView;
            if (parentId) AppState.tasks = AppState.tasks.map(t => t.id === parentId ? { ...t, subtasks: t.subtasks.map(s => s.id === id ? { ...s, note: '' } : s) } : t);
            else AppState.tasks = AppState.tasks.map(t => t.id === id ? { ...t, note: '' } : t);
            AppState.taskNoteView = null; this.save();
        }
    },
    editTaskNote() { const { id, parentId } = AppState.taskNoteView; AppState.taskNoteView = null; this.openTaskModal(id, parentId); },

    // --- FICHE TÂCHE UNIFIÉE ---
    openNewTaskModal(projectId = null) {
        const defDate = AppState.activeTab === 'calendar' ? AppState.selectedDate : null;
        AppState.taskModal = { id: Date.now().toString(), parentId: null, isNew: true, data: { name: '', projectId: projectId, duration: 15, locations: [], priority: 'Moyenne', note: '', scheduledDate: defDate, scheduledTime: '' } }; this.render();
    },
    openNewSubtaskModal(parentId) {
        AppState.taskModal = { id: Date.now().toString(), parentId: parentId, isNew: true, data: { name: '', duration: 15, locations: [], priority: 'Moyenne', note: '', scheduledDate: null, scheduledTime: '' } }; this.render();
    },
    openTaskModal(id, parentId = null) {
        let itemData = parentId ? AppState.tasks.find(t => t.id === parentId).subtasks.find(s => s.id === id) : AppState.tasks.find(t => t.id === id);
        AppState.taskModal = { id, parentId, isNew: false, data: JSON.parse(JSON.stringify(itemData)) }; this.render();
    },
    closeTaskModal() { AppState.taskModal = null; this.render(); },
    clearTaskSchedule() {
        const dInput = document.getElementById('modal-task-date'); const tInput = document.getElementById('modal-task-time');
        if(dInput) dInput.value = ''; if(tInput) tInput.value = '';
    },
    saveTaskModal(event) {
        event.preventDefault(); const form = event.target; const { id, parentId, isNew } = AppState.taskModal;
        const name = document.getElementById('modal-task-name').value;
        const duration = parseInt(document.getElementById('modal-task-duration').value);
        const locations = this.getFormLocations(form);
        const note = document.getElementById('modal-task-note').value;
        const priorityBtn = form.querySelector('.modal-priority-selected');
        const priority = priorityBtn ? priorityBtn.innerText.trim() : 'Moyenne';
        const scheduledDate = document.getElementById('modal-task-date').value || null;
        const scheduledTime = document.getElementById('modal-task-time').value || null;

        if (parentId) { 
            AppState.tasks = AppState.tasks.map(t => {
                if (t.id === parentId) {
                    if (isNew) return { ...t, subtasks: [...(t.subtasks || []), { id, name, duration, locations, priority, note, scheduledDate, scheduledTime, status: 'todo' }] };
                    else return { ...t, subtasks: t.subtasks.map(s => s.id === id ? { ...s, name, duration, locations, priority, note, scheduledDate, scheduledTime } : s) };
                } return t;
            });
        } else { 
            const projectId = document.getElementById('modal-task-project').value || null;
            if (isNew) AppState.tasks.unshift({ id, name, projectId, duration, locations, priority, note, scheduledDate, scheduledTime, status: 'todo', subtasks: [] });
            else AppState.tasks = AppState.tasks.map(t => t.id === id ? { ...t, name, projectId, duration, locations, priority, note, scheduledDate, scheduledTime } : t);
        }
        AppState.taskModal = null; this.save();
    },

    // --- MENUS UNIFIÉS ---
    openMenu(e, type, id, parentId = null) { 
        if (e) { e.preventDefault(); e.stopPropagation(); } 
        AppState.activeMenu = { type, id, parentId }; this.render(); 
    },
    closeMenu() { AppState.activeMenu = null; this.render(); },
    openEdit() {
        const { type, id, parentId } = AppState.activeMenu;
        if (type === 'task' || type === 'subtask') { AppState.activeMenu = null; this.openTaskModal(id, parentId); return; }
        let itemData = type === 'category' ? AppState.categories.find(c => c.id === id) : AppState.projects.find(p => p.id === id);
        AppState.editPrompt = { type, id, parentId: null, data: JSON.parse(JSON.stringify(itemData)) }; AppState.activeMenu = null; this.render();
    },
    closeEdit() { AppState.editPrompt = null; this.render(); },
    openDelete() { const { type, id, parentId } = AppState.activeMenu; AppState.deletePrompt = { type, id, parentId }; AppState.activeMenu = null; this.render(); },
    cancelDelete() { AppState.deletePrompt = null; this.render(); },
    confirmDelete() {
        const { type, id, parentId } = AppState.deletePrompt;
        if (type === 'category') { AppState.categories = AppState.categories.filter(c => c.id !== id); AppState.projects.forEach(p => { if (p.categoryId === id) p.categoryId = null; }); } 
        else if (type === 'project') { AppState.projects = AppState.projects.filter(p => p.id !== id); AppState.tasks = AppState.tasks.filter(t => t.projectId !== id); } 
        else if (type === 'task' || type === 'subtask') {
            if (parentId) AppState.tasks = AppState.tasks.map(t => t.id === parentId ? { ...t, subtasks: t.subtasks.filter(s => s.id !== id) } : t);
            else AppState.tasks = AppState.tasks.filter(t => t.id !== id);
        }
        AppState.deletePrompt = null; this.save();
    },

    // --- ACTIONS TÂCHES ---
    toggleTask(taskId){ AppState.tasks=AppState.tasks.map(t=>t.id===taskId ? {...t,status:t.status==='todo'?'done':'todo'} : t); if(AppState.homeSearched) this.generateAction(); this.save(); },
    toggleSubtask(taskId,subtaskId){ AppState.tasks=AppState.tasks.map(t=>t.id===taskId ? {...t,subtasks:t.subtasks.map(s=>s.id===subtaskId ? {...s,status:s.status==='todo'?'done':'todo'} : s)} : t); this.save(); },

    // --- LE CALENDRIER & DRAG DROP ---
    selectDate(dateStr) { AppState.selectedDate = dateStr; this.render(); },
    openAvailabilityModal() { AppState.availabilityModal = true; this.render(); },
    closeAvailabilityModal() { AppState.availabilityModal = false; this.render(); },
    
    addAvailability(event) {
        event.preventDefault(); const start = document.getElementById('plan-start').value; const end = document.getElementById('plan-end').value; const locations = this.getFormLocations(event.target);
        const [startH, startM] = start.split(':').map(Number); const [endH, endM] = end.split(':').map(Number);
        let duration = (endH * 60 + endM) - (startH * 60 + startM); if (duration <= 0) duration += 24 * 60;
        AppState.availabilities.push({ id: Date.now().toString(), date: AppState.selectedDate, start, end, duration, locations });
        AppState.availabilityModal = false; this.save();
    },
    removeAvailability(id) { if(confirm("Supprimer ce créneau libre ?")) { AppState.availabilities = AppState.availabilities.filter(a => a.id !== id); this.save(); } },

    handleDragStart(e, id, type, parentId = null) { e.dataTransfer.setData('text/plain', JSON.stringify({id, type, parentId})); e.currentTarget.classList.add('opacity-50'); },
    handleDragEnd(e) { e.currentTarget.classList.remove('opacity-50'); document.querySelectorAll('.bg-cyan-900\\/20').forEach(el => el.classList.remove('border-cyan-500', 'bg-cyan-900/20')); },
    
    handleCalDragOver(e) { e.preventDefault(); e.currentTarget.classList.add('border-cyan-500', 'bg-cyan-900/20'); },
    handleCalDragLeave(e) { e.currentTarget.classList.remove('border-cyan-500', 'bg-cyan-900/20'); },
    handleCalDrop(e, targetType, targetId, targetParentId = null) {
        e.preventDefault(); e.currentTarget.classList.remove('border-cyan-500', 'bg-cyan-900/20');
        try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            const taskId = data.id; const isSubtask = data.type === 'subtask'; const parentId = data.parentId;

            let taskToMove = isSubtask ? AppState.tasks.find(t => t.id === parentId).subtasks.find(s => s.id === taskId) : AppState.tasks.find(t => t.id === taskId);
            if (!taskToMove) return;

            let newTime = '08:00';
            if (targetType === 'slot') {
                const slot = AppState.availabilities.find(a => a.id === targetId);
                if (slot) newTime = slot.start;
            } else if (targetType === 'task') {
                let targetTask = targetParentId && targetParentId !== 'null' ? AppState.tasks.find(t => t.id === targetParentId).subtasks.find(s => s.id === targetId) : AppState.tasks.find(t => t.id === targetId);
                if (targetTask) {
                    const [tH, tM] = (targetTask.scheduledTime || '08:00').split(':').map(Number);
                    const totalM = tH * 60 + tM + (targetTask.duration || 15);
                    newTime = `${String(Math.floor(totalM / 60)).padStart(2,'0')}:${String(totalM % 60).padStart(2,'0')}`;
                }
            }

            if (isSubtask) AppState.tasks = AppState.tasks.map(t => t.id === parentId ? { ...t, subtasks: t.subtasks.map(s => s.id === taskId ? { ...s, scheduledDate: AppState.selectedDate, scheduledTime: newTime } : s) } : t);
            else AppState.tasks = AppState.tasks.map(t => t.id === taskId ? { ...t, scheduledDate: AppState.selectedDate, scheduledTime: newTime } : t);
            this.save();
        } catch(err) { console.error(err); }
    },

    getFlatActiveTasks() {
        let allActive = [];
        AppState.tasks.forEach(t => {
            let hasActiveSubtasks = false;
            if (t.subtasks && t.subtasks.length > 0) {
                t.subtasks.forEach(s => { if (s.status !== 'done') { hasActiveSubtasks = true; allActive.push({...s, isSubtask: true, parentId: t.id, parentName: t.name, projectId: t.projectId, originalTask: t}); } });
            }
            if (!hasActiveSubtasks && t.status !== 'done') allActive.push({...t, isSubtask: false, projectId: t.projectId});
        });
        return allActive;
    },

    // ==========================================
    // 5. RENDU VISUEL (HTML COMPONENTS)
    // ==========================================
    renderAuth() {
        return `
        <div class="flex flex-col items-center justify-center min-h-screen px-6 bg-[#0D0F12]">
            <div class="w-full max-w-sm bg-[#1A1D24] p-8 rounded-3xl border border-gray-800 shadow-2xl">
                <div class="flex justify-center mb-6"><div class="p-4 bg-cyan-500/20 rounded-full border border-cyan-500/30"><i data-lucide="zap" class="w-8 h-8 text-cyan-400 fill-cyan-400"></i></div></div>
                <h2 class="text-2xl font-black text-center text-white mb-2">${AppState.authMode === 'login' ? 'Connexion' : 'Créer un compte'}</h2>
                <p class="text-sm text-gray-500 text-center mb-8">My Task Cloud</p>
                ${AppState.authError ? `<div class="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 text-center font-bold">${AppState.authError}</div>` : ''}
                ${AppState.authMessage ? `<div class="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 text-center font-bold">${AppState.authMessage}</div>` : ''}
                <form onsubmit="App.handleAuth(event)" class="space-y-4">
                    <input type="email" id="auth-email" placeholder="Email" required class="w-full bg-[#0D0F12] rounded-xl px-4 py-3 text-white border border-gray-800 focus:border-cyan-500 focus:outline-none">
                    <div class="relative">
                        <input type="${AppState.showPassword ? 'text' : 'password'}" id="auth-password" placeholder="Mot de passe" required class="w-full bg-[#0D0F12] rounded-xl px-4 py-3 text-white border border-gray-800 focus:border-cyan-500 focus:outline-none pr-12">
                        <button type="button" id="toggle-pwd-btn" onclick="App.togglePasswordVisibility()" class="absolute right-4 top-3.5 text-gray-500 hover:text-cyan-400 focus:outline-none"><i data-lucide="${AppState.showPassword ? 'eye-off' : 'eye'}" class="w-5 h-5"></i></button>
                    </div>
                    ${AppState.authMode === 'login' ? `<button type="button" onclick="App.resetPassword()" class="text-[10px] text-gray-500 hover:text-cyan-400 mt-2 block w-full text-right transition-colors">Mot de passe oublié ?</button>` : ''}
                    <button type="submit" class="w-full py-3 mt-4 rounded-xl bg-cyan-500 text-black font-bold uppercase hover:bg-cyan-400 transition-colors shadow-[0_0_15px_rgba(6,182,212,0.3)]">${AppState.authMode === 'login' ? 'Se connecter' : 'S\'inscrire'}</button>
                </form>
                <div class="mt-6 text-center"><button onclick="App.toggleAuthMode()" class="text-xs text-gray-500 hover:text-cyan-400">${AppState.authMode === 'login' ? 'Pas de compte ? Crées-en un ici.' : 'Déjà un compte ? Connecte-toi.'}</button></div>
            </div>
        </div>`;
    },

    renderTask(task, minimal=false, parentId=null, parentName=null){
        const isDone = task.status === 'done'; const isSubtask = parentId !== null; const type = isSubtask ? 'subtask' : 'task';
        const argParent = isSubtask ? `, '${parentId}'` : ', null';
        const priorityColors = {'Urgence':'text-red-400 bg-red-500/10 border-red-500/30', 'Haute':'text-purple-400 bg-purple-500/10 border-purple-500/30','Moyenne':'text-amber-400 bg-amber-500/10 border-amber-500/30','Basse':'text-blue-400 bg-blue-500/10 border-blue-500/30'};
        let projectName = ''; if (task.projectId) { const proj = AppState.projects.find(p => p.id === task.projectId); if (proj) projectName = proj.name; }

        return `
        <div draggable="true" ondragstart="App.handleDragStart(event, '${task.id}', '${type}'${argParent})" ondragend="App.handleDragEnd(event)" onclick="App.openMenu(event, '${type}', '${task.id}'${argParent});" class="group flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all duration-300 border ${isDone?'bg-[#13161c] border-gray-800/30 opacity-60':'bg-[#1A1D24] border-gray-800 hover:border-gray-700'}">
            <div class="flex items-center gap-4 overflow-hidden flex-1">
                <button onclick="${isSubtask ? `App.toggleSubtask('${parentId}','${task.id}')` : `App.toggleTask('${task.id}')`}; event.stopPropagation();" class="shrink-0 focus:outline-none cursor-pointer p-1 -ml-1">
                    ${isDone?'<i data-lucide="check-circle-2" class="text-emerald-500"></i>':'<i data-lucide="circle" class="text-gray-600"></i>'}
                </button>
                <div class="flex-1 min-w-0">
                    <h4 class="font-bold truncate text-[15px] ${isDone?'text-gray-500 line-through':'text-gray-200'}">${task.name}</h4>
                    <div class="flex items-center gap-2 mt-1 text-xs font-semibold text-gray-500 flex-wrap">
                        <span class="flex items-center gap-1"><i data-lucide="clock" class="w-3 h-3"></i> ${task.duration}m</span>
                        <span class="px-2 py-0.5 rounded-md text-[10px] border font-bold ${priorityColors[task.priority || 'Moyenne']}">${task.priority || 'Moyenne'}</span>
                        ${task.scheduledDate ? `<span class="flex items-center gap-1 text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/30"><i data-lucide="calendar" class="w-3 h-3"></i> ${task.scheduledDate.substring(5)}</span>` : ''}
                        ${task.note && task.note.trim() !== '' ? `<span onclick="App.openTaskNoteView('${task.id}'${argParent}); event.stopPropagation();" class="flex items-center text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30 cursor-pointer hover:bg-amber-500/20 transition-colors"><i data-lucide="file-text" class="w-3 h-3"></i></span>` : ''}
                    </div>
                    ${projectName && !isSubtask ? `<div class="text-[10px] text-indigo-400/70 font-semibold flex items-center gap-1 mt-1 truncate"><i data-lucide="corner-down-right" class="w-3 h-3 shrink-0"></i> Tâche de : ${projectName}</div>` : ''}
                    ${isSubtask && parentName ? `<div class="text-[10px] text-indigo-400/70 font-semibold flex items-center gap-1 mt-1 truncate"><i data-lucide="corner-down-right" class="w-3 h-3 shrink-0"></i> Sous-tâche de : ${parentName}</div>` : ''}
                </div>
            </div>
            ${minimal && !isSubtask ? `<div class="shrink-0 ml-2"><button onclick="event.stopPropagation(); App.openNewSubtaskModal('${task.id}');" class="p-2 text-gray-400 hover:text-cyan-400"><i data-lucide="plus" class="w-4 h-4"></i></button></div>` : ''}
        </div>`;
    },

    renderCalendar() {
        const priorityColors = {'Urgence':'text-red-400 border-red-500/30', 'Haute':'text-purple-400 border-purple-500/30','Moyenne':'text-amber-400 border-amber-500/30','Basse':'text-blue-400 border-blue-500/30'};
        const dates = []; const todayDate = new Date(); const startDay = new Date(todayDate); startDay.setDate(todayDate.getDate() - 3);
        const months = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Aoû','Sep','Oct','Nov','Déc'];
        for (let i=0; i<90; i++) {
            const d = new Date(startDay); d.setDate(startDay.getDate() + i);
            const dStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            dates.push({ date: dStr, label: ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'][d.getDay()], num: d.getDate(), month: months[d.getMonth()], isToday: dStr === getTodayString() });
        }

        let datesHtml = `<div class="flex gap-2 overflow-x-auto pb-4 no-scrollbar scroll-smooth">`;
        dates.forEach(d => {
            const isSelected = d.date === AppState.selectedDate;
            datesHtml += `<div onclick="App.selectDate('${d.date}')" class="flex flex-col items-center justify-center min-w-[55px] p-2 rounded-2xl cursor-pointer transition-all border ${isSelected ? 'bg-cyan-500 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.4)]' : d.isToday ? 'bg-[#1A1D24] border-gray-600' : 'bg-[#0D0F12] border-gray-800 hover:border-gray-700'}"><span class="text-[10px] font-bold uppercase ${isSelected ? 'text-black' : d.isToday ? 'text-cyan-400' : 'text-gray-500'}">${d.label}</span><span class="text-lg font-black ${isSelected ? 'text-black' : 'text-white'}">${d.num}</span><span class="text-[9px] font-bold uppercase ${isSelected ? 'text-black' : 'text-gray-500'}">${d.month}</span></div>`;
        });
        datesHtml += `</div>`;

        let dayEvents = [];
        AppState.tasks.forEach(t => {
            if (t.scheduledDate === AppState.selectedDate) dayEvents.push({ ...t, type: 'task', isSubtask: false });
            if (t.subtasks) t.subtasks.forEach(s => { if (s.scheduledDate === AppState.selectedDate) dayEvents.push({ ...s, type: 'task', isSubtask: true, parentId: t.id, parentName: t.name }); });
        });
        AppState.availabilities.forEach(a => { if (a.date === AppState.selectedDate) dayEvents.push({ ...a, type: 'slot' }); });

        if (AppState.selectedDate === getTodayString()) {
            const now = new Date(); const currentMinutes = now.getHours() * 60 + now.getMinutes();
            const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
            dayEvents.push({ type: 'now', time: timeStr, isNow: true, absoluteMinutes: currentMinutes });
        }

        dayEvents.sort((a,b) => {
            const getMins = (ev) => {
                if (ev.isNow) return ev.absoluteMinutes;
                const t = ev.type === 'task' ? (ev.scheduledTime || '23:59') : (ev.type === 'slot' ? ev.start : '23:59');
                const [h, m] = t.split(':').map(Number);
                return h * 60 + m;
            };
            const minsA = getMins(a); const minsB = getMins(b);
            if (minsA === minsB) { if (a.isNow) return -1; if (b.isNow) return 1; }
            return minsA - minsB;
        });

        let timelineHtml = `<div class="relative space-y-3 mt-2 pl-2 border-l border-gray-800">`;
        if (dayEvents.length === 0) {
            timelineHtml += `<div class="py-10 text-center text-gray-500 text-sm font-semibold">Rien de prévu à cette date.</div>`;
        } else {
            dayEvents.forEach(ev => {
                if (ev.isNow) {
                    timelineHtml += `<div class="relative flex items-center mb-4 -ml-4 z-10 py-2 pointer-events-none"><div class="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div><div class="flex-1 h-px bg-red-500/50"></div><span class="absolute right-0 -top-1.5 text-[10px] font-black text-red-500 bg-[#0D0F12] pl-2">${ev.time}</span></div>`;
                } else if (ev.type === 'task') {
                    const isDone = ev.status === 'done'; const timeDisp = ev.scheduledTime || '--:--';
                    timelineHtml += `
                    <div class="relative pl-6 pb-2 transition-colors border border-transparent rounded-2xl" ondragover="App.handleCalDragOver(event)" ondragleave="App.handleCalDragLeave(event)" ondrop="App.handleCalDrop(event, 'task', '${ev.id}', ${ev.isSubtask ? `'${ev.parentId}'` : 'null'})">
                        <div class="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full ${isDone ? 'bg-emerald-500' : 'bg-cyan-500 border border-[#0D0F12]'}"></div>
                        <div class="bg-[#1A1D24] p-3 rounded-2xl border ${isDone ? 'border-gray-800/50 opacity-60' : 'border-gray-800'} cursor-pointer hover:border-gray-700" onclick="App.openMenu(event, '${ev.isSubtask ? 'subtask' : 'task'}', '${ev.id}', ${ev.isSubtask ? `'${ev.parentId}'` : 'null'})">
                            <div class="flex justify-between items-start mb-1">
                                <div class="flex items-center gap-2">
                                    <button onclick="event.stopPropagation(); ${ev.isSubtask ? `App.toggleSubtask('${ev.parentId}','${ev.id}')` : `App.toggleTask('${ev.id}')`}" class="p-1 -ml-1 text-gray-500 hover:text-emerald-400 focus:outline-none"><i data-lucide="${isDone ? 'check-circle-2' : 'circle'}" class="w-4 h-4 ${isDone ? 'text-emerald-500' : ''}"></i></button>
                                    <span class="text-xs font-black text-cyan-400 ${isDone ? 'text-gray-500 line-through' : ''}">${timeDisp}</span>
                                </div>
                                <span class="px-1.5 py-0.5 rounded text-[8px] border bg-[#0D0F12] ${priorityColors[ev.priority || 'Moyenne']}">${ev.priority || 'Moyenne'}</span>
                            </div>
                            <h4 class="text-sm font-bold text-white ${isDone ? 'line-through text-gray-500' : ''} ml-1">${ev.name}</h4>
                            <div class="flex items-center gap-2 mt-1.5 text-[10px] text-gray-500 ml-1">
                                <span><i data-lucide="clock" class="w-3 h-3 inline"></i> ${ev.duration}m</span>
                                ${ev.note && ev.note.trim() !== '' ? `<span onclick="App.openTaskNoteView('${ev.id}', ${ev.isSubtask ? `'${ev.parentId}'` : 'null'}); event.stopPropagation();" class="text-amber-400 cursor-pointer bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30 hover:bg-amber-500/20"><i data-lucide="file-text" class="w-3 h-3 inline"></i></span>` : ''}
                            </div>
                        </div>
                    </div>`;
                } else {
                    timelineHtml += `
                    <div class="relative pl-6 pb-2 transition-colors border border-transparent rounded-2xl" ondragover="App.handleCalDragOver(event)" ondragleave="App.handleCalDragLeave(event)" ondrop="App.handleCalDrop(event, 'slot', '${ev.id}')">
                        <div class="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-500 border border-[#0D0F12] animate-pulse"></div>
                        <div class="bg-indigo-500/10 p-3 rounded-2xl border border-indigo-500/30">
                            <div class="flex justify-between items-start mb-2">
                                <span class="text-xs font-black text-indigo-400">${ev.start} - ${ev.end}</span>
                                <button onclick="App.removeAvailability('${ev.id}')" class="text-gray-500 hover:text-red-400"><i data-lucide="x" class="w-4 h-4"></i></button>
                            </div>
                            <div class="text-[10px] text-indigo-300/70 font-semibold mb-2">Créneau libre (${ev.duration}m)</div>
                            <div class="flex justify-end"><button onclick="App.fillAvailability('${ev.id}')" class="bg-indigo-500 text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase shadow-[0_0_10px_rgba(99,102,241,0.4)]">Auto-Remplir</button></div>
                        </div>
                    </div>`;
                }
            });
        }
        timelineHtml += `</div>`;

        // Section Drag & Drop : Tâches non planifiées
        let unscheduledHtml = '';
        let allUnscheduled = this.getFlatActiveTasks().filter(t => !t.scheduledDate);
        if (allUnscheduled.length > 0) {
            unscheduledHtml = `
            <div class="mt-8 bg-[#1A1D24] p-4 rounded-3xl border border-gray-800 shadow-xl">
                <h3 class="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2"><i data-lucide="mouse-pointer-click" class="w-4 h-4 text-cyan-400"></i> À planifier (Drag & Drop)</h3>
                <div class="space-y-2 max-h-64 overflow-y-auto pr-1" style="scrollbar-width: thin; scrollbar-color: #374151 transparent;">
                    ${allUnscheduled.map(t => this.renderTask(t, false, t.isSubtask ? t.parentId : null, t.isSubtask ? t.parentName : null)).join('')}
                </div>
            </div>`;
        }

        return `
        <div class="space-y-4">
            <div class="px-1 flex justify-between items-center">
                <h2 class="text-xl font-black text-white flex items-center gap-2"><i data-lucide="calendar-days" class="text-cyan-400"></i> Calendrier</h2>
                <button onclick="App.openAvailabilityModal()" class="px-3 py-1.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-xs font-bold">+ Créneau</button>
            </div>
            ${datesHtml}
            <div class="bg-[#1A1D24] p-4 rounded-3xl border border-gray-800 shadow-xl min-h-[40vh]">
                <h3 class="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 border-b border-gray-800 pb-2">Timeline</h3>
                ${timelineHtml}
            </div>
            ${unscheduledHtml}
        </div>`;
    },

    renderHome() {
        let allActive = this.getFlatActiveTasks().filter(t => !t.scheduledDate); 
        const priorityWeights={'Urgence':4, 'Haute':3,'Moyenne':2,'Basse':1};
        const urgencies = [...allActive].sort((a, b) => {
            const pA = priorityWeights[a.priority || 'Moyenne']; const pB = priorityWeights[b.priority || 'Moyenne']; if (pA !== pB) return pB - pA;
            return (a.duration || 15) - (b.duration || 15);
        }).slice(0, 5);

        return `
        <div class="space-y-8">
            <section class="bg-[#1A1D24] rounded-3xl p-5 border border-gray-800/50 relative">
                <h2 class="text-lg font-bold text-white mb-4 flex items-center gap-2"><i data-lucide="play" class="text-cyan-400 fill-cyan-400 w-5 h-5"></i> Moteur d'Action</h2>
                <div class="space-y-4">
                    <div><label class="text-xs font-semibold text-gray-400 uppercase mb-2 block">Temps dispo (min)</label>
                        <div class="flex gap-2 flex-wrap">${AppState.settings.times.map(t=>`<button onclick="App.setHomeTime(${t})" class="flex-1 min-w-[50px] py-2 rounded-xl text-sm font-bold ${AppState.homeTime===t?'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50':'bg-[#0D0F12] text-gray-400 border border-transparent'}">${t}</button>`).join('')}</div>
                    </div>
                </div>
            </section>
            <section><h2 class="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 px-1 flex items-center gap-2"><i data-lucide="alert-circle" class="text-red-400 w-4 h-4"></i> Tâches Non Planifiées</h2><div class="space-y-2">${urgencies.length>0?urgencies.map(t=>this.renderTask(t, false, t.isSubtask ? t.parentId : null, t.isSubtask ? t.parentName : null)).join(''):`<div class="bg-[#1A1D24] rounded-2xl p-6 text-center border border-gray-800 border-dashed"><p class="text-gray-500 text-sm">Tout est planifié.</p></div>`}</div></section>
        </div>`;
    },

    renderProjects() {
        let html=`<div class="space-y-4">
            <div class="flex justify-between items-center mb-6 px-1">
                <h2 class="text-xl font-black text-white">Chantiers & Base</h2>
                <div class="flex gap-1.5">
                    <button onclick="App.toggleAddCategory()" class="h-8 px-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-[10px] font-bold">+ Dossier</button>
                    <button onclick="App.toggleAddProject()" class="h-8 px-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[10px] font-bold">+ Projet</button>
                    <button onclick="App.openNewTaskModal()" class="h-8 px-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">+ Tâche</button>
                </div>
            </div>`;
            
        if(AppState.showAddCategory) html += `<div class="bg-[#1A1D24] p-4 rounded-2xl border border-indigo-500/30 mb-4 flex gap-2"><input type="text" id="new-cat-name" placeholder="Nom du dossier..." class="flex-1 bg-[#0D0F12] rounded-lg px-3 py-2 text-sm text-white focus:outline-none border border-gray-800"><button onclick="App.addCategory()" class="bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-bold">OK</button></div>`;
        if(AppState.showAddProject) html += `<div class="bg-[#1A1D24] p-4 rounded-2xl border border-cyan-500/30 mb-4 flex flex-col gap-3"><input type="text" id="new-proj-name" placeholder="Nom du projet..." class="w-full bg-[#0D0F12] rounded-lg px-3 py-2 text-sm text-white focus:outline-none border border-gray-800"><div class="flex gap-2"><select id="new-proj-category" class="flex-1 bg-[#0D0F12] rounded-lg px-3 py-2 text-sm text-gray-300 border border-gray-800 focus:outline-none"><option value="">Dossier : Aucun</option>${AppState.categories.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}</select><button onclick="App.addProject()" class="bg-cyan-500 text-black px-4 py-2 rounded-lg text-sm font-bold">OK</button></div></div>`;

        AppState.categories.forEach(cat => {
            const catProjects = AppState.projects.filter(p => p.categoryId === cat.id);
            const isCatExpanded = AppState.expandedCategoryIds.includes(cat.id);
            html += `
            <div class="bg-[#1A1D24] rounded-2xl border border-gray-800 mb-4 shadow-sm">
                <div onclick="App.toggleCategoryExpand('${cat.id}')" class="p-4 cursor-pointer hover:bg-[#1f232b] transition-colors rounded-t-2xl ${!isCatExpanded ? 'rounded-b-2xl' : ''}">
                    <div class="flex justify-between items-center">
                        <div class="flex items-center gap-3">
                            <i data-lucide="folder" class="${isCatExpanded ? 'text-indigo-400 fill-indigo-400/20' : 'text-gray-500'} w-5 h-5 transition-colors"></i>
                            <h3 class="font-bold text-white text-md">${cat.name}</h3>
                        </div>
                        <div class="flex items-center gap-1">
                            <span class="text-[10px] font-bold text-gray-500 bg-[#0D0F12] px-2 py-0.5 rounded-md mr-1">${catProjects.length}</span>
                            <button onclick="App.openMenu(event, 'category', '${cat.id}')" class="p-1.5 text-gray-500 hover:text-indigo-400 rounded-lg"><i data-lucide="more-vertical" class="w-4 h-4"></i></button>
                            <i data-lucide="${isCatExpanded?'chevron-down':'chevron-right'}" class="text-gray-500 w-4 h-4"></i>
                        </div>
                    </div>
                </div>
                ${isCatExpanded ? `<div class="px-3 pb-3 pt-2 bg-[#1A1D24] border-t border-gray-800/50 rounded-b-2xl" onclick="event.stopPropagation()">${catProjects.length === 0 ? '<p class="text-xs text-gray-600 text-center py-4">Dossier vide.</p>' : catProjects.map(p => this.renderProjectItem(p)).join('')}</div>` : ''}
            </div>`;
        });

        const orphanedProjects = AppState.projects.filter(p => !p.categoryId);
        if (orphanedProjects.length > 0) {
            html += `<div class="mt-8 mb-2 px-1 flex items-center gap-2"><div class="h-px bg-gray-800 flex-1"></div><span class="text-xs font-bold text-gray-500 uppercase tracking-widest">Sans Dossier</span><div class="h-px bg-gray-800 flex-1"></div></div><div class="space-y-3">${orphanedProjects.map(p => this.renderProjectItem(p)).join('')}</div>`;
        }

        const isolatedTasks = AppState.tasks.filter(t => !t.projectId);
        if (isolatedTasks.length > 0) {
            html += `<div class="mt-8 mb-4 px-1 flex items-center gap-2"><div class="h-px bg-gray-800 flex-1"></div><span class="text-xs font-bold text-gray-500 uppercase tracking-widest">Tâches Isolées</span><div class="h-px bg-gray-800 flex-1"></div></div><div class="space-y-2">${isolatedTasks.map(t => this.renderTask(t, false)).join('')}</div>`;
        }
        return html+'</div>';
    },

    renderSettings() {
        const renderList = (type, placeholder, isNumber) => `<div class="bg-[#1A1D24] rounded-2xl p-5 border border-gray-800 mb-6"><h3 class="font-bold text-white mb-4 uppercase text-sm flex items-center gap-2">${type === 'times' ? '<i data-lucide="clock" class="text-cyan-400 w-4 h-4"></i> Temps disponibles (min)' : type === 'locations' ? '<i data-lucide="map-pin" class="text-emerald-400 w-4 h-4"></i> Filtres' : '<i data-lucide="tag" class="text-indigo-400 w-4 h-4"></i> Catégories'}</h3><div class="flex gap-2 mb-4"><input type="${isNumber ? 'number' : 'text'}" id="setting-input-${type}" placeholder="${placeholder}" class="flex-1 bg-[#0D0F12] rounded-xl px-3 py-2 text-sm text-white focus:outline-none border border-gray-800"><button onclick="App.addSetting('${type}', 'setting-input-${type}')" class="bg-cyan-500 text-black px-4 py-2 rounded-xl text-sm font-bold">+</button></div><div class="flex flex-wrap gap-2">${AppState.settings[type].map(item => `<div class="flex items-center gap-2 bg-[#0D0F12] border border-gray-800 px-3 py-1.5 rounded-lg text-sm text-gray-300"><span>${item}</span><button onclick="App.removeSetting('${type}', ${isNumber ? item : `'${item}'`})" class="text-gray-500 hover:text-red-500 ml-1"><i data-lucide="x" class="w-3.5 h-3.5"></i></button></div>`).join('')}</div></div>`;
        return `
        <div class="space-y-4">
            <div class="px-1 mb-6"><h2 class="text-xl font-black text-white flex items-center gap-2"><i data-lucide="settings" class="text-gray-400"></i> Paramètres</h2></div>
            ${renderList('times', 'Ex: 45', true)}
            <div class="mt-8 space-y-3 mb-4">
                <button onclick="App.openUpdateModal('all')" class="w-full py-4 rounded-xl bg-cyan-500/10 text-cyan-400 font-bold border border-cyan-500/30 hover:bg-cyan-500 hover:text-black transition-colors flex items-center justify-center gap-2"><i data-lucide="sparkles" class="w-5 h-5"></i> Historique des MAJ (v${APP_VERSION})</button>
                <button onclick="App.logout()" class="w-full py-4 rounded-xl bg-red-500/10 text-red-500 font-bold border border-red-500/30 hover:bg-red-500 hover:text-white transition-colors flex items-center justify-center gap-2"><i data-lucide="log-out" class="w-5 h-5"></i> Se déconnecter</button>
            </div>
        </div>`;
    },
    
    render() {
        const content = document.getElementById('app-content');
        if (!AppState.currentUser) { document.querySelector('nav')?.remove(); content.innerHTML = this.renderAuth(); lucide.createIcons(); return; }
        if (!document.querySelector('nav')) { document.getElementById('app-container').insertAdjacentHTML('beforeend', `<nav class="fixed bottom-0 w-full bg-[#13161c]/90 backdrop-blur-md border-t border-gray-800 px-2 py-4 flex justify-around items-center z-20 pb-8"><button onclick="App.setTab('home')" id="nav-home" class="flex flex-col items-center gap-1 transition-all text-gray-500"><i data-lucide="play-circle"></i><span class="text-[9px] font-bold tracking-wider uppercase">Action</span></button><button onclick="App.setTab('projects')" id="nav-projects" class="flex flex-col items-center gap-1 transition-all text-gray-500"><i data-lucide="folder"></i><span class="text-[9px] font-bold tracking-wider uppercase">Base</span></button><button onclick="App.setTab('calendar')" id="nav-calendar" class="flex flex-col items-center gap-1 transition-all text-gray-500"><i data-lucide="calendar"></i><span class="text-[9px] font-bold tracking-wider uppercase">Calendrier</span></button><button onclick="App.setTab('settings')" id="nav-settings" class="flex flex-col items-center gap-1 transition-all text-gray-500"><i data-lucide="settings"></i><span class="text-[9px] font-bold tracking-wider uppercase">Paramètres</span></button></nav>`); }

        if (AppState.activeTab === 'home') content.innerHTML = this.renderHome();
        else if (AppState.activeTab === 'calendar') content.innerHTML = this.renderCalendar();
        else if (AppState.activeTab === 'projects') content.innerHTML = this.renderProjects();
        else if (AppState.activeTab === 'settings') content.innerHTML = this.renderSettings();
        
        let modalContainer = document.getElementById('modal-container');
        if (!modalContainer) { modalContainer = document.createElement('div'); modalContainer.id = 'modal-container'; document.getElementById('app-container').appendChild(modalContainer); }
        
        if (AppState.missedTasksNotif.length > 0) {
            modalContainer.innerHTML = `
                <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center px-4" onclick="App.closeMissedTasksNotif()">
                    <div class="bg-[#1A1D24] border border-gray-800 w-full max-w-md rounded-3xl p-6 shadow-2xl transform transition-all animate-slide-up" onclick="event.stopPropagation()">
                        <div class="flex justify-center mb-4"><div class="p-3 bg-amber-500/20 rounded-full border border-amber-500/30"><i data-lucide="rotate-ccw" class="w-8 h-8 text-amber-400"></i></div></div>
                        <h3 class="text-xl font-black text-white text-center mb-2">Tâches en retard</h3>
                        <p class="text-sm text-gray-400 text-center mb-6">Non cochées à temps, elles ont été replacées dans la Base.</p>
                        <button onclick="App.closeMissedTasksNotif()" class="w-full py-4 rounded-xl bg-amber-500 text-black font-bold uppercase tracking-wider hover:bg-amber-400">J'ai compris</button>
                    </div>
                </div>`;
        } else if (AppState.showUpdateModal) {
            let htmlContent = ''; let title = AppState.updateModalMode === 'unseen' ? 'Depuis votre dernière visite...' : 'Historique des Mises à jour';
            for (let release of RELEASE_HISTORY) {
                if (AppState.updateModalMode === 'unseen' && release.version === AppState.lastSeenVersion) break;
                htmlContent += `<div class="mb-5 pb-4 border-b border-gray-800 last:border-0 last:pb-0"><span class="text-cyan-400 font-black tracking-widest text-xs uppercase mb-1 block">V${release.version} - ${release.title}</span><div class="text-gray-400 leading-relaxed">${release.notes}</div></div>`;
            }
            if (htmlContent === '' || (!AppState.lastSeenVersion && AppState.updateModalMode === 'unseen')) {
                htmlContent = `<div class="mb-5 pb-4 border-b border-gray-800 last:border-0 last:pb-0"><span class="text-cyan-400 font-black tracking-widest text-xs uppercase mb-1 block">V${RELEASE_HISTORY[0].version} - ${RELEASE_HISTORY[0].title}</span><div class="text-gray-400 leading-relaxed">${RELEASE_HISTORY[0].notes}</div></div>`;
            }
            modalContainer.innerHTML = `
                <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center px-4" onclick="App.closeUpdateModal()">
                    <div class="bg-[#1A1D24] border border-gray-800 w-full max-w-md rounded-3xl p-6 shadow-2xl transform transition-all animate-slide-up" onclick="event.stopPropagation()">
                        <div class="flex justify-between items-center mb-6"><h3 class="text-lg font-black text-white flex items-center gap-2"><i data-lucide="sparkles" class="text-cyan-400"></i> ${title}</h3><button onclick="App.closeUpdateModal()" class="text-gray-500 hover:text-white transition-colors p-1"><i data-lucide="x" class="w-5 h-5"></i></button></div>
                        <div class="text-sm space-y-2 max-h-[60vh] overflow-y-auto pr-2" style="scrollbar-width: thin; scrollbar-color: #374151 transparent;">${htmlContent}</div>
                        <button onclick="App.closeUpdateModal()" class="w-full mt-6 py-4 rounded-xl bg-cyan-500 text-black font-bold uppercase tracking-wider hover:bg-cyan-400">Génial !</button>
                    </div>
                </div>`;
        } else if (AppState.activeMenu) {
            const isTask = AppState.activeMenu.type === 'task' || AppState.activeMenu.type === 'subtask';
            modalContainer.innerHTML = `
                <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center pb-8 px-4" onclick="App.closeMenu()">
                    <div class="bg-[#1A1D24] border border-gray-800 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl transform transition-all animate-slide-up" onclick="event.stopPropagation()">
                        <div class="p-2 border-b border-gray-800/50">
                            <button onclick="App.openEdit()" class="w-full text-left px-6 py-4 text-white font-bold hover:bg-[#1f232b] flex items-center gap-3"><i data-lucide="pencil" class="text-cyan-400 w-5 h-5"></i> ${isTask ? 'Modifier' : 'Renommer'}</button>
                            ${!isTask ? `<button onclick="App.openNote('${AppState.activeMenu.type}', '${AppState.activeMenu.id}')" class="w-full text-left px-6 py-4 text-white font-bold hover:bg-[#1f232b] flex items-center gap-3"><i data-lucide="file-text" class="text-amber-400 w-5 h-5"></i> Gérer la note</button>` : ''}
                            <button onclick="App.openDelete()" class="w-full text-left px-6 py-4 text-red-500 font-bold hover:bg-[#1f232b] flex items-center gap-3"><i data-lucide="trash-2" class="w-5 h-5"></i> Supprimer</button>
                        </div>
                        <div class="p-2"><button onclick="App.closeMenu()" class="w-full text-center px-6 py-4 text-gray-500 font-bold hover:bg-[#1f232b] rounded-2xl">Annuler</button></div>
                    </div>
                </div>`;
        } else if (AppState.taskNoteView) {
            modalContainer.innerHTML = `
                <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center px-4" onclick="App.closeTaskNoteView()">
                    <div class="bg-[#1A1D24] border border-gray-800 w-full max-w-md rounded-3xl p-6 shadow-2xl transform transition-all animate-slide-up" onclick="event.stopPropagation()">
                        <h3 class="text-xl font-bold text-white mb-4 flex items-center gap-2"><i data-lucide="file-text" class="text-amber-400"></i> Note</h3>
                        <div class="text-sm text-gray-300 whitespace-pre-wrap mb-6 max-h-[50vh] overflow-y-auto bg-[#0D0F12] p-4 rounded-xl border border-gray-800">${AppState.taskNoteView.note}</div>
                        <div class="flex gap-3"><button onclick="App.deleteTaskNote()" class="flex-1 py-3 rounded-xl bg-[#0D0F12] text-red-500 font-bold border border-gray-800">Effacer</button><button onclick="App.editTaskNote()" class="flex-1 py-3 rounded-xl bg-amber-500 text-black font-bold">Modifier</button></div>
                    </div>
                </div>`;
        } else if (AppState.availabilityModal) {
            modalContainer.innerHTML = `
                <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center pb-8 px-4" onclick="App.closeAvailabilityModal()">
                    <div class="bg-[#1A1D24] border border-gray-800 w-full max-w-md rounded-3xl p-6 shadow-2xl transform transition-all animate-slide-up" onclick="event.stopPropagation()">
                        <h3 class="text-xl font-bold text-white mb-4 flex items-center gap-2"><i data-lucide="calendar-plus" class="text-indigo-400"></i> Créneau libre</h3>
                        <form onsubmit="App.addAvailability(event)" class="space-y-4">
                            <div class="flex gap-2 items-center"><input type="time" id="plan-start" required class="flex-1 bg-[#0D0F12] rounded-xl px-3 py-3 text-sm text-white border border-gray-800" value="14:00"><input type="time" id="plan-end" required class="flex-1 bg-[#0D0F12] rounded-xl px-3 py-3 text-sm text-white border border-gray-800" value="16:00"></div>
                            <div class="flex gap-3 pt-4"><button type="button" onclick="App.closeAvailabilityModal()" class="flex-1 py-3 rounded-xl bg-[#0D0F12] text-white font-bold border border-gray-700">Annuler</button><button type="submit" class="flex-1 py-3 rounded-xl bg-indigo-500 text-white font-bold">Ajouter</button></div>
                        </form>
                    </div>
                </div>`;
        } else if (AppState.taskModal) {
            const d = AppState.taskModal.data; const dLocs = d.locations || [];
            modalContainer.innerHTML = `
                <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center pb-8 px-4" onclick="App.closeTaskModal()">
                    <div class="bg-[#1A1D24] border border-gray-800 w-full max-w-md rounded-3xl p-6 shadow-2xl transform transition-all animate-slide-up overflow-y-auto max-h-[90vh]" onclick="event.stopPropagation()">
                        <h3 class="text-xl font-black text-white mb-4">${AppState.taskModal.isNew ? 'Nouvelle Tâche' : 'Fiche Tâche'}</h3>
                        <form onsubmit="App.saveTaskModal(event)" class="space-y-4">
                            <input type="text" id="modal-task-name" value="${d.name ? d.name.replace(/"/g, '&quot;') : ''}" required class="w-full bg-[#0D0F12] rounded-xl px-4 py-3 text-white border border-gray-800 focus:border-cyan-500">
                            ${!AppState.taskModal.parentId ? `<select id="modal-task-project" class="w-full bg-[#0D0F12] rounded-xl px-3 py-3 text-sm text-gray-300 border border-gray-800"><option value="">Isolée</option>${AppState.projects.map(p => `<option value="${p.id}" ${p.id === d.projectId ? 'selected' : ''}>${p.name}</option>`).join('')}</select>` : ''}
                            <div class="p-3 border border-gray-800 rounded-xl bg-[#0D0F12]">
                                <div class="flex justify-between items-center mb-2"><label class="text-[10px] text-cyan-400 uppercase font-bold flex items-center gap-1"><i data-lucide="calendar" class="w-3 h-3"></i> Planification</label><button type="button" onclick="App.clearTaskSchedule()" class="text-[10px] text-gray-500 hover:text-red-400"><i data-lucide="eraser" class="w-3 h-3 inline"></i> Effacer</button></div>
                                <div class="flex gap-2"><input type="date" id="modal-task-date" value="${d.scheduledDate || ''}" class="flex-1 bg-transparent text-sm text-white border border-gray-800 rounded-lg px-2 py-2"><input type="time" id="modal-task-time" value="${d.scheduledTime || ''}" class="w-24 bg-transparent text-sm text-white border border-gray-800 rounded-lg px-2 py-2 text-center"></div>
                            </div>
                            <select id="modal-task-duration" class="w-full bg-[#0D0F12] rounded-xl px-3 py-3 text-sm text-gray-300 border border-gray-800 text-center">${AppState.settings.times.map(t => `<option value="${t}" ${d.duration == t ? 'selected' : ''}>${t}m</option>`).join('')}</select>
                            <div class="flex gap-2 flex-wrap">${AppState.settings.locations.map(l => `<button type="button" onclick="App.toggleFormLocation(this)" data-loc="${l}" class="flex-1 min-w-[70px] py-2 rounded-xl text-xs font-bold ${dLocs.includes(l) ? 'loc-selected bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' : 'bg-[#0D0F12] text-gray-500 border border-transparent'}">${l}</button>`).join('')}</div>
                            <div class="flex gap-2 flex-wrap">${['Basse','Moyenne','Haute','Urgence'].map(p => `<button type="button" onclick="App.selectModalPriority(this)" class="flex-1 py-2 min-w-[60px] rounded-xl text-xs font-bold transition-colors ${p === (d.priority || 'Moyenne') ? `modal-priority-selected ${p==='Urgence'?'bg-red-500/20 text-red-400 border-red-500/50' : p==='Haute'?'bg-purple-500/20 text-purple-400 border-purple-500/50' : p==='Moyenne'?'bg-amber-500/20 text-amber-400 border-amber-500/50' : 'bg-blue-500/20 text-blue-400 border-blue-500/50'}` : 'bg-[#0D0F12] text-gray-500 border border-transparent'}">${p}</button>`).join('')}</div>
                            <textarea id="modal-task-note" rows="2" class="w-full bg-[#0D0F12] rounded-xl px-4 py-3 text-white border border-gray-800 placeholder-gray-600" placeholder="Ajouter une note...">${d.note || ''}</textarea>
                            <div class="flex gap-3 pt-2 pb-6"><button type="button" onclick="App.closeTaskModal()" class="flex-1 py-3 rounded-xl bg-[#0D0F12] text-white font-bold border border-gray-700">Annuler</button><button type="submit" class="flex-1 py-3 rounded-xl bg-cyan-500 text-black font-bold">Enregistrer</button></div>
                        </form>
                    </div>
                </div>`;
        } else { modalContainer.innerHTML = ''; }
        
        const tabs=[{id:'home',color:'text-cyan-400'},{id:'calendar',color:'text-amber-400'},{id:'projects',color:'text-indigo-400'},{id:'settings',color:'text-gray-200'}];
        tabs.forEach(tab=>{ const btn=document.getElementById('nav-'+tab.id); if(btn) btn.className=`flex flex-col items-center gap-1 transition-all ${AppState.activeTab===tab.id?tab.color:'text-gray-500'}`; });
        lucide.createIcons();
    },
    
    init() {
        const header = document.querySelector('header'); const container = document.getElementById('app-container');
        if (header && container) { header.style.display = 'none'; container.classList.remove('pt-12'); container.classList.add('pt-4'); }
        document.getElementById('app-content').innerHTML = `<div class="flex flex-col items-center justify-center h-full text-cyan-500"><i data-lucide="cloud-cog" class="w-12 h-12 animate-pulse mb-4"></i><span class="text-sm font-bold tracking-widest uppercase">Connexion...</span></div>`;
        lucide.createIcons();
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                AppState.currentUser = user;
                try {
                    const docRef = doc(db, "users", user.uid); const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const data = docSnap.data(); AppState.categories = data.categories || []; AppState.projects = data.projects || []; AppState.tasks = data.tasks || []; AppState.settings = data.settings || AppState.settings; AppState.availabilities = data.availabilities || [];
                    } else { await this.saveToCloud(); }
                } catch (e) {}
                this.checkMissedTasks();
                const lastSeenVersion = localStorage.getItem('osdevie_last_seen_version');
                if (lastSeenVersion !== APP_VERSION) { AppState.lastSeenVersion = lastSeenVersion; AppState.updateModalMode = 'unseen'; AppState.showUpdateModal = true; localStorage.setItem('osdevie_last_seen_version', APP_VERSION); }
                this.render();
            } else { AppState.currentUser = null; this.render(); }
        });
    }
};

window.App = App; window.AppState = AppState; window.onload = () => App.init();
