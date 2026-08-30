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
        notes: "• 📅 Nouvel onglet Calendrier avec timeline et créneaux intelligents."
    },
    {
        version: "1.6.4",
        title: "Changement de Nom & UI",
        notes: "• 🏷️ OS de Vie devient officiellement <b>My Task</b> !"
    },
    {
        version: "1.6.3",
        title: "PWA Plein Écran",
        notes: "• 📱 L'application s'installe nativement sur l'écran d'accueil sans barre de recherche (Plus d'erreur 500)."
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
    
    // UI Modals
    activeMenu: null, deletePrompt: null, editPrompt: null, notePrompt: null, 
    taskModal: null, taskNoteView: null, availabilityModal: false, 
    showUpdateModal: false, updateModalMode: null, lastSeenVersion: null, missedTasksNotif: [] 
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

    // --- MENUS UNIFIÉS & ÉDITION ---
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
    openNote(type, id) {
        let itemData = type === 'category' ? AppState.categories.find(c => c.id === id) : AppState.projects.find(p => p.id === id);
        AppState.notePrompt = { type, id, parentId: null, note: itemData.note || '' }; AppState.activeMenu = null; this.render();
    },
    closeNote() { AppState.notePrompt = null; this.render(); },
    saveNote(event) {
        event.preventDefault(); const { type, id } = AppState.notePrompt; const noteText = document.getElementById('edit-note-text').value;
        if (type === 'category') AppState.categories = AppState.categories.map(c => c.id === id ? { ...c, note: noteText } : c);
        else if (type === 'project') AppState.projects = AppState.projects.map(p => p.id === id ? { ...p, note: noteText } : p);
        AppState.notePrompt = null; this.save();
    },
    saveEdit(event) {
        event.preventDefault(); const { type, id } = AppState.editPrompt; const name = document.getElementById('edit-name').value;
        if (type === 'category') AppState.categories = AppState.categories.map(c => c.id === id ? { ...c, name } : c);
        else if (type === 'project') AppState.projects = AppState.projects.map(p => p.id === id ? { ...p, name, categoryId: document.getElementById('edit-proj-category').value || null } : p);
        AppState.editPrompt = null; this.save();
    },

    // --- LE CALENDRIER & DRAG DROP AVANCÉ ---
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

    // --- AUTRES ALGORITHMES ---
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
    fillAvailability(slotId) {
        const slot = AppState.availabilities.find(a => a.id === slotId); if (!slot) return;
        const priorityWeights={'Urgence':4, 'Haute':3,'Moyenne':2,'Basse':1};
        let availableTasks = this.getFlatActiveTasks().filter(t => !t.scheduledDate); 

        availableTasks.sort((a,b) => {
            if (a.projectId && a.projectId === b.projectId) { const numA = parseInt(a.name); const numB = parseInt(b.name); if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB; }
            const pA = priorityWeights[a.priority || 'Moyenne']; const pB = priorityWeights[b.priority || 'Moyenne']; if (pA !== pB) return pB - pA;
            return (b.duration || 15) - (a.duration || 15);
        });

        let currentUsedTime = 0; let [currentH, currentM] = slot.start.split(':').map(Number); let tasksChanged = false;

        for (let i = 0; i < availableTasks.length; i++) {
            const task = availableTasks[i]; const numTask = parseInt(task.name);
            if (!isNaN(numTask) && numTask > 1) { const prevTask = availableTasks.find(t => t.projectId === task.projectId && parseInt(t.name) === (numTask - 1)); if (prevTask) continue; }
            if ((currentUsedTime + task.duration) <= slot.duration) {
                let matchLoc = true;
                if (slot.locations && slot.locations.length > 0) { matchLoc = (!task.locations || task.locations.length === 0) ? false : task.locations.some(l => slot.locations.includes(l)); }
                if (matchLoc) {
                    const timeStr = `${String(currentH).padStart(2,'0')}:${String(currentM).padStart(2,'0')}`;
                    if (task.isSubtask) AppState.tasks = AppState.tasks.map(t => t.id === task.parentId ? { ...t, subtasks: t.subtasks.map(s => s.id === task.id ? { ...s, scheduledDate: slot.date, scheduledTime: timeStr } : s) } : t);
                    else AppState.tasks = AppState.tasks.map(t => t.id === task.id ? { ...t, scheduledDate: slot.date, scheduledTime: timeStr } : t);
                    currentUsedTime += task.duration; currentM += task.duration;
                    while (currentM >= 60) { currentH += 1; currentM -= 60; }
                    tasksChanged = true;
                }
            }
        }
        if (tasksChanged) { AppState.availabilities = AppState.availabilities.filter(a => a.id !== slotId); this.save(); } 
        else { alert("Aucune tâche ne correspond aux filtres ou à la durée de ce créneau."); }
    },
    openUpdateModal(mode = 'all') { AppState.updateModalMode = mode; AppState.showUpdateModal = true; this.render(); },
    closeUpdateModal() { AppState.updateModalMode = null; AppState.showUpdateModal = false; this.render(); },
    addCategory() { const name = document.getElementById('new-cat-name').value; if (!name.trim()) return; AppState.categories.push({ id: 'c_' + Date.now(), name, note: '' }); AppState.showAddCategory = false; this.save(); },
    toggleCategoryExpand(id) { AppState.expandedCategoryIds.includes(id) ? AppState.expandedCategoryIds = AppState.expandedCategoryIds.filter(cId => cId !== id) : AppState.expandedCategoryIds.push(id); this.render(); },
    addProject(){ const name=document.getElementById('new-proj-name').value; if(!name.trim()) return; AppState.projects.push({id:Date.now().toString(), name, categoryId:document.getElementById('new-proj-category').value || null, note:''}); AppState.showAddProject=false; this.save(); },
    goToProject(projectId) { AppState.expandedProjectId = projectId; const proj = AppState.projects.find(p => p.id === projectId); if (proj && proj.categoryId && !AppState.expandedCategoryIds.includes(proj.categoryId)) { AppState.expandedCategoryIds.push(proj.categoryId); } this.setTab('projects'); },
    toggleProjectExpand(id) { AppState.expandedProjectId = AppState.expandedProjectId === id ? null : id; this.render(); },
    toggleAddProject() { AppState.showAddProject = !AppState.showAddProject; this.render(); },
    toggleAddCategory() { AppState.showAddCategory = !AppState.showAddCategory; this.render(); },
    toggleFormLocation(btn) { btn.classList.toggle('loc-selected'); if (btn.classList.contains('loc-selected')) { btn.classList.replace('bg-[#0D0F12]', 'bg-emerald-500/20'); btn.classList.replace('text-gray-500', 'text-emerald-400'); btn.classList.replace('border-transparent', 'border-emerald-500/50'); } else { btn.classList.replace('bg-emerald-500/20', 'bg-[#0D0F12]'); btn.classList.replace('text-emerald-400', 'text-gray-500'); btn.classList.replace('border-emerald-500/50', 'border-transparent'); } },
    getFormLocations(form) { return Array.from(form.querySelectorAll('.loc-selected')).map(b => b.getAttribute('data-loc')); },
    applyPriorityStyle(btn, className) { btn.parentElement.querySelectorAll('button').forEach(b => { b.className = "flex-1 py-2 min-w-[60px] rounded-xl text-xs font-bold bg-[#0D0F12] text-gray-500 border border-transparent transition-colors"; }); const p = btn.innerText.trim(); let colors = p === 'Urgence' ? 'bg-red-500/20 text-red-400 border-red-500/50' : p === 'Haute' ? 'bg-purple-500/20 text-purple-400 border-purple-500/50' : p === 'Moyenne' ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' : 'bg-blue-500/20 text-blue-400 border-blue-500/50'; btn.className = `flex-1 py-2 min-w-[60px] rounded-xl text-xs font-bold border transition-colors ${className} ${colors}`; },
    selectModalPriority(btn) { this.applyPriorityStyle(btn, 'modal-priority-selected'); },
    setHomeTime(time) { AppState.homeTime=time; this.render(); },
    toggleHomeLocation(loc) { AppState.homeLocations.includes(loc) ? AppState.homeLocations = AppState.homeLocations.filter(l => l !== loc) : AppState.homeLocations.push(loc); this.render(); },
    toggleTask(taskId){ AppState.tasks=AppState.tasks.map(t=>t.id===taskId ? {...t,status:t.status==='todo'?'done':'todo'} : t); if(AppState.homeSearched) this.generateAction(); this.save(); },
    toggleSubtask(taskId,subtaskId){ AppState.tasks=AppState.tasks.map(t=>t.id===taskId ? {...t,subtasks:t.subtasks.map(s=>s.id===subtaskId ? {...s,status:s.status==='todo'?'done':'todo'} : s)} : t); this.save(); },
    generateAction() {
        const priorityWeights={'Urgence':4, 'Haute':3,'Moyenne':2,'Basse':1}; let allAvailable = [];
        AppState.tasks.forEach(t => {
            let hasActiveSubtasks = false;
            if (t.subtasks && t.subtasks.length > 0) {
                t.subtasks.forEach(s => {
                    if (s.status !== 'done') {
                        hasActiveSubtasks = true; const numSub = parseInt(s.name); let blocked = false;
                        if (!isNaN(numSub) && numSub > 1) blocked = t.subtasks.some(otherS => parseInt(otherS.name) === (numSub - 1) && otherS.status !== 'done');
                        if (!blocked && s.duration <= AppState.homeTime) {
                            let matchLoc = AppState.homeLocations.length === 0 || (s.locations && s.locations.some(l => AppState.homeLocations.includes(l)));
                            if (matchLoc) allAvailable.push({ ...s, isSubtask: true, parentId: t.id, parentName: t.name, projectId: t.projectId });
                        }
                    }
                });
            }
            if (!hasActiveSubtasks && t.status !== 'done') {
                const numTask = parseInt(t.name); let blocked = false;
                if (!isNaN(numTask) && numTask > 1) blocked = AppState.tasks.some(otherT => otherT.projectId === t.projectId && parseInt(otherT.name) === (numTask - 1) && otherT.status !== 'done');
                if (!blocked && t.duration <= AppState.homeTime) {
                    let matchLoc = AppState.homeLocations.length === 0 || (t.locations && t.locations.some(l => AppState.homeLocations.includes(l)));
                    if (matchLoc) allAvailable.push({ ...t, isSubtask: false, projectId: t.projectId });
                }
            }
        });
        allAvailable.sort((a,b)=> { const pA = priorityWeights[a.priority || 'Moyenne']; const pB = priorityWeights[b.priority || 'Moyenne']; if (pA !== pB) return pB - pA; const dA = a.duration || 15; const dB = b.duration || 15; if (dA !== dB) return dB - dA; if (a.isSubtask && !b.isSubtask) return -1; if (!a.isSubtask && b.isSubtask) return 1; return 0; });
        AppState.homeSuggestions = allAvailable.slice(0,5); AppState.homeSearched=true; this.render();
    },

    // --- INTERFACE ---
    renderAuth() {
        return `
        <div class="flex flex-col items-center justify-center min-h-[90vh] px-6 bg-[#0D0F12]">
            <div class="w-full max-w-sm bg-[#1A1D24] p-8 rounded-3xl border border-gray-800 shadow-2xl">
                <div class="flex justify-center mb-6">
                    <div class="p-4 bg-cyan-500/20 rounded-full border border-cyan-500/30">
                        <i data-lucide="zap" class="w-8 h-8 text-cyan-400 fill-cyan-400"></i>
                    </div>
                </div>
                <h2 class="text-2xl font-black text-center text-white mb-2">${AppState.authMode === 'login' ? 'Connexion' : 'Créer un compte'}</h2>
                <p class="text-sm text-gray-500 text-center mb-8">My Task Cloud</p>
                
                ${AppState.authError ? `<div class="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 text-center font-bold">${AppState.authError}</div>` : ''}
                ${AppState.authMessage ? `<div class="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 text-center font-bold">${AppState.authMessage}</div>` : ''}

                <form onsubmit="App.handleAuth(event)" class="space-y-4">
                    <div>
                        <input type="email" id="auth-email" placeholder="Email" required class="w-full bg-[#0D0F12] rounded-xl px-4 py-3 text-white border border-gray-800 focus:border-cyan-500 focus:outline-none">
                    </div>
                    <div>
                        <input type="password" id="auth-password" placeholder="Mot de passe" required class="w-full bg-[#0D0F12] rounded-xl px-4 py-3 text-white border border-gray-800 focus:border-cyan-500 focus:outline-none">
                        ${AppState.authMode === 'login' ? `<button type="button" onclick="App.resetPassword()" class="text-[10px] text-gray-500 hover:text-cyan-400 mt-2 block w-full text-right transition-colors">Mot de passe oublié ?</button>` : ''}
                    </div>
                    <button type="submit" class="w-full py-3 mt-2 rounded-xl bg-cyan-500 text-black font-bold uppercase hover:bg-cyan-400 transition-colors shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                        ${AppState.authMode === 'login' ? 'Se connecter' : 'S\'inscrire'}
                    </button>
                </form>
                <div class="mt-6 text-center">
                    <button onclick="App.toggleAuthMode()" class="text-xs text-gray-500 hover:text-cyan-400">
                        ${AppState.authMode === 'login' ? 'Pas de compte ? Crées-en un ici.' : 'Déjà un compte ? Connecte-toi.'}
                    </button>
                </div>
            </div>
        </div>
        `;
    },

    renderNavbar(activeTab) {
        let container = document.getElementById('app-container');
        let nav = document.getElementById('main-nav');
        if (!nav) {
            nav = document.createElement('nav');
            nav.id = 'main-nav';
            nav.className = "fixed bottom-0 w-full bg-[#13161c]/90 backdrop-blur-md border-t border-gray-800 px-2 py-4 flex justify-around items-center z-20 pb-8";
            container.appendChild(nav);
        }
        nav.innerHTML = `
            <button onclick="App.setTab('home')" class="flex flex-col items-center gap-1 transition-all ${activeTab === 'home' ? 'text-cyan-400' : 'text-gray-500'}">
                <i data-lucide="play-circle"></i><span class="text-[9px] font-bold tracking-wider uppercase">Action</span>
            </button>
            <button onclick="App.setTab('projects')" class="flex flex-col items-center gap-1 transition-all ${activeTab === 'projects' ? 'text-indigo-400' : 'text-gray-500'}">
                <i data-lucide="folder"></i><span class="text-[9px] font-bold tracking-wider uppercase">Projets</span>
            </button>
            <button onclick="App.setTab('calendar')" class="flex flex-col items-center gap-1 transition-all ${activeTab === 'calendar' ? 'text-amber-400' : 'text-gray-500'}">
                <i data-lucide="calendar"></i><span class="text-[9px] font-bold tracking-wider uppercase">Plan</span>
            </button>
            <button onclick="App.setTab('settings')" class="flex flex-col items-center gap-1 transition-all ${activeTab === 'settings' ? 'text-gray-200' : 'text-gray-500'}">
                <i data-lucide="settings"></i><span class="text-[9px] font-bold tracking-wider uppercase">Réglages</span>
            </button>
        `;
        if (window.lucide) lucide.createIcons();
    },

    renderContent(state) {
        const content = document.getElementById('app-content');
        if (!content) return;

        if (state.activeTab === 'home') {
            content.innerHTML = `<h2 class="text-xl font-bold text-white mb-4">Moteur d'Action (En construction)</h2>`;
        } else if (state.activeTab === 'projects') {
            content.innerHTML = `<h2 class="text-xl font-bold text-white mb-4">Projets & Tâches (En construction)</h2>`;
        } else if (state.activeTab === 'calendar') {
            content.innerHTML = `<h2 class="text-xl font-bold text-white mb-4">Calendrier (En construction)</h2>`;
        } else if (state.activeTab === 'settings') {
            content.innerHTML = `<h2 class="text-xl font-bold text-white mb-4">Paramètres (En construction)</h2>`;
        }
        
        let modalContainer = document.getElementById('modal-container');
        if (!modalContainer) { modalContainer = document.createElement('div'); modalContainer.id = 'modal-container'; document.getElementById('app-container').appendChild(modalContainer); }
        
        // --- GESTION DES MENUS ET MODALES ---
    if (AppState.activeMenu) {
            modalContainer.innerHTML = `
                <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center pb-8 px-4" onclick="App.closeMenu()">
                    <div class="bg-[#1A1D24] border border-gray-800 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl transform transition-all animate-slide-up" onclick="event.stopPropagation()">
                        <div class="p-2 border-b border-gray-800/50">
                            <button onclick="App.openEdit()" class="w-full text-left px-6 py-4 text-white font-bold hover:bg-[#1f232b] flex items-center gap-3"><i data-lucide="pencil" class="text-cyan-400 w-5 h-5"></i> Modifier</button>
                            <button onclick="App.openNote('${AppState.activeMenu.type}', '${AppState.activeMenu.id}')" class="w-full text-left px-6 py-4 text-white font-bold hover:bg-[#1f232b] flex items-center gap-3"><i data-lucide="file-text" class="text-amber-400 w-5 h-5"></i> Gérer la note</button>
                            <button onclick="App.openDelete()" class="w-full text-left px-6 py-4 text-red-500 font-bold hover:bg-[#1f232b] flex items-center gap-3"><i data-lucide="trash-2" class="w-5 h-5"></i> Supprimer</button>
                        </div>
                        <div class="p-2">
                            <button onclick="App.closeMenu()" class="w-full text-center px-6 py-4 text-gray-500 font-bold hover:bg-[#1f232b] rounded-2xl">Annuler</button>
                        </div>
                    </div>
                </div>`;
        } else if (AppState.notePrompt) {
            modalContainer.innerHTML = `
                <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center pb-8 px-4" onclick="App.closeNote()">
                    <div class="bg-[#1A1D24] border border-gray-800 w-full max-w-md rounded-3xl p-6 shadow-2xl transform transition-all animate-slide-up" onclick="event.stopPropagation()">
                        <h3 class="text-xl font-bold text-white mb-4 flex items-center gap-2"><i data-lucide="file-text" class="text-amber-400"></i> Note</h3>
                        <form onsubmit="App.saveNote(event)" class="space-y-4">
                            <textarea id="edit-note-text" rows="6" class="w-full bg-[#0D0F12] rounded-xl px-4 py-3 text-white border border-gray-800 focus:border-amber-500 focus:outline-none placeholder-gray-600" placeholder="Écris ta note ici...">${AppState.notePrompt.note}</textarea>
                            <div class="flex gap-3 mt-4">
                                <button type="button" onclick="App.closeNote()" class="flex-1 py-3 rounded-xl bg-[#0D0F12] text-white font-bold border border-gray-700">Annuler</button>
                                <button type="submit" class="flex-1 py-3 rounded-xl bg-amber-500 text-black font-bold">Enregistrer</button>
                            </div>
                        </form>
                    </div>
                </div>`;
        } else if (AppState.editPrompt) {
            const d = AppState.editPrompt.data; 
            modalContainer.innerHTML = `
                <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center pb-8 px-4" onclick="App.closeEdit()">
                    <div class="bg-[#1A1D24] border border-gray-800 w-full max-w-md rounded-3xl p-6 shadow-2xl transform transition-all animate-slide-up" onclick="event.stopPropagation()">
                        <h3 class="text-xl font-bold text-white mb-4">Modifier</h3>
                        <form onsubmit="App.saveEdit(event)" class="space-y-4">
                            <input type="text" id="edit-name" value="${d.name ? d.name.replace(/"/g, '&quot;') : ''}" required class="w-full bg-[#0D0F12] rounded-xl px-4 py-3 text-white border border-gray-800 focus:border-cyan-500 focus:outline-none">
                            ${AppState.editPrompt.type === 'project' ? `<select id="edit-proj-category" class="w-full bg-[#0D0F12] rounded-xl px-3 py-3 text-sm text-gray-300 border border-gray-800 focus:outline-none"><option value="">Catégorie : Aucune</option>${AppState.settings.categories ? AppState.settings.categories.map(c => `<option value="${c}">${c}</option>`).join('') : ''}</select>` : ''}
                            <div class="flex gap-3 mt-6 pt-2">
                                <button type="button" onclick="App.closeEdit()" class="flex-1 py-3 rounded-xl bg-[#0D0F12] text-white font-bold border border-gray-700">Annuler</button>
                                <button type="submit" class="flex-1 py-3 rounded-xl bg-cyan-500 text-black font-bold">Enregistrer</button>
                            </div>
                        </form>
                    </div>
                </div>`;
        } else if (AppState.deletePrompt) {
            let typeName = AppState.deletePrompt.type === 'project' ? 'ce projet' : (AppState.deletePrompt.type === 'task' ? 'cette tâche' : 'cet élément');
            modalContainer.innerHTML = `
                <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center pb-8 px-4" onclick="App.cancelDelete()">
                    <div class="bg-[#1A1D24] border border-gray-800 w-full max-w-md rounded-3xl p-6 shadow-2xl transform transition-all animate-slide-up" onclick="event.stopPropagation()">
                        <div class="w-12 h-1.5 bg-gray-700 rounded-full mx-auto mb-6"></div>
                        <h3 class="text-xl font-bold text-white mb-2 flex items-center gap-2"><i data-lucide="trash-2" class="text-red-500"></i> Supprimer ${typeName} ?</h3>
                        <p class="text-gray-400 text-sm mb-8">Cette action est définitive et supprimera tout le contenu associé.</p>
                        <div class="flex gap-3">
                            <button onclick="App.cancelDelete()" class="flex-1 py-4 rounded-xl bg-[#0D0F12] text-white font-bold border border-gray-700">Annuler</button>
                            <button onclick="App.confirmDelete()" class="flex-1 py-4 rounded-xl bg-red-500/10 text-red-500 font-bold border border-red-500/50">Supprimer</button>
                        </div>
                    </div>
                </div>`;
        } else {
            modalContainer.innerHTML = '';
        }

        if (window.lucide) lucide.createIcons();
    },

    renderLoading() {
        const content = document.getElementById('app-content');
        if (content) {
            content.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full text-cyan-500 mt-20">
                    <i data-lucide="cloud-cog" class="w-12 h-12 animate-pulse mb-4"></i>
                    <span class="text-sm font-bold tracking-widest uppercase">Synchronisation...</span>
                </div>
            `;
            if (window.lucide) lucide.createIcons();
        }
    },

    render() {
        if (!AppState.currentUser) {
            const nav = document.getElementById('main-nav');
            if (nav) nav.remove();
            const content = document.getElementById('app-content');
            if (content) content.innerHTML = this.renderAuth();
            if (window.lucide) lucide.createIcons();
            return;
        }

        this.renderNavbar(AppState.activeTab);
        this.renderContent(AppState);
    },

    init() {
        this.renderLoading();
        
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                AppState.currentUser = user;
                
                try {
                    const docRef = doc(db, "users", user.uid);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        AppState.categories = data.categories || [];
                        AppState.projects = data.projects || [];
                        AppState.tasks = data.tasks || [];
                        AppState.settings = data.settings || AppState.settings;
                        AppState.availabilities = data.availabilities || [];
                    } else {
                        await this.saveToCloud();
                    }
                } catch(e) {
                    console.error("Erreur, utilisation locale.", e);
                }
                
                this.checkMissedTasks();
                this.render();
            } else {
                AppState.currentUser = null;
                this.render();
            }
        });
    }
};

window.App = App;
window.AppState = AppState;

// Démarrage direct de l'application
App.init();
