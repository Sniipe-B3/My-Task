// ==========================================
// 0. CONNEXION AU CLOUD FIREBASE & AUTHENTIFICATION
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { RELEASE_HISTORY } from "./history.js";

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
// L'historique complet est désormais stocké dans history.js !
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
    
    homeTime: 30, homeLocations: [], homeSuggestions: [], homeSearched: false,
    expandedCategoryIds: [], 
    expandedProjectId: null, 
    showAddProject: false, showAddCategory: false,
    
    activeMenu: null, deletePrompt: null, editPrompt: null, notePrompt: null,
    taskModal: null,
    availabilityModal: false,
    
    showUpdateModal: false,
    updateModalMode: null,
    lastSeenVersion: null,
    missedTasksNotif: [] 
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

        let missed = [];
        let hasChanges = false;

        AppState.tasks = AppState.tasks.map(t => {
            if (t.status !== 'done' && t.scheduledDate) {
                const [tH, tM] = t.scheduledTime ? t.scheduledTime.split(':').map(Number) : [23, 59];
                const isPastDate = t.scheduledDate < todayStr;
                const isPastTime = t.scheduledDate === todayStr && (tH * 60 + tM) < currentMinutes;

                if (isPastDate || isPastTime) {
                    missed.push(t);
                    hasChanges = true;
                    return { ...t, scheduledDate: null, scheduledTime: null };
                }
            }
            
            if (t.subtasks && t.subtasks.length > 0) {
                let subChanged = false;
                const newSubs = t.subtasks.map(s => {
                    if (s.status !== 'done' && s.scheduledDate) {
                        const [sH, sM] = s.scheduledTime ? s.scheduledTime.split(':').map(Number) : [23, 59];
                        if (s.scheduledDate < todayStr || (s.scheduledDate === todayStr && (sH * 60 + sM) < currentMinutes)) {
                            missed.push({...s, parentName: t.name});
                            subChanged = true;
                            return { ...s, scheduledDate: null, scheduledTime: null };
                        }
                    }
                    return s;
                });
                if (subChanged) {
                    hasChanges = true;
                    return { ...t, subtasks: newSubs };
                }
            }
            return t;
        });

        const oldAvailLength = AppState.availabilities.length;
        AppState.availabilities = AppState.availabilities.filter(a => {
            const [aH, aM] = a.end ? a.end.split(':').map(Number) : [23, 59];
            const isPastDate = a.date < todayStr;
            const isPastTime = a.date === todayStr && (aH * 60 + aM) < currentMinutes;
            return !(isPastDate || isPastTime);
        });
        if (oldAvailLength !== AppState.availabilities.length) hasChanges = true;

        if (missed.length > 0) { AppState.missedTasksNotif = missed; }
        if (hasChanges && AppState.currentUser) { this.saveToCloud(); }
    },

    closeMissedTasksNotif() {
        AppState.missedTasksNotif = [];
        this.render();
    },

    // --- AUTHENTIFICATION ---
    async handleAuth(event) {
        event.preventDefault();
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        AppState.authError = ''; AppState.authMessage = '';
        this.render();

        try {
            if (AppState.authMode === 'login') {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                await createUserWithEmailAndPassword(auth, email, password);
                AppState.settings = getDefaultSettings();
                AppState.categories = getDefaultCategories();
                AppState.projects = []; AppState.tasks = []; AppState.availabilities = [];
                await this.saveToCloud();
            }
        } catch (error) {
            AppState.authError = "Erreur de connexion / Email invalide.";
            this.render();
        }
    },

    toggleAuthMode() { AppState.authMode = AppState.authMode === 'login' ? 'register' : 'login'; this.render(); },
    togglePasswordVisibility() {
        AppState.showPassword = !AppState.showPassword;
        const pwdInput = document.getElementById('auth-password');
        const btn = document.getElementById('toggle-pwd-btn');
        if (pwdInput) pwdInput.type = AppState.showPassword ? 'text' : 'password';
        if (btn) { btn.innerHTML = `<i data-lucide="${AppState.showPassword ? 'eye-off' : 'eye'}" class="w-5 h-5"></i>`; lucide.createIcons(); }
    },
    async resetPassword() {
        const email = document.getElementById('auth-email').value.trim();
        if (!email) { AppState.authError = "Veuillez taper votre adresse email d'abord."; this.render(); return; }
        try {
            await sendPasswordResetEmail(auth, email);
            AppState.authMessage = "Email de réinitialisation envoyé !"; this.render();
        } catch (error) {
            AppState.authError = "Aucun compte trouvé avec cet email."; this.render();
        }
    },
    async logout() {
        if(confirm("Veux-tu vraiment te déconnecter ?")) {
            await signOut(auth);
            AppState.currentUser = null;
            AppState.categories = []; AppState.projects = []; AppState.tasks = []; AppState.availabilities = [];
            this.render();
        }
    },

    // --- SYNCHRONISATION ---
    async saveToCloud() {
        if (!AppState.currentUser) return; 
        const dataToSave = {
            categories: AppState.categories, projects: AppState.projects, tasks: AppState.tasks,
            settings: AppState.settings, availabilities: AppState.availabilities
        };
        try { await setDoc(doc(db, "users", AppState.currentUser.uid), dataToSave); } 
        catch (e) { console.error("Erreur de sauvegarde Cloud:", e); }
    },

    save() { this.render(); this.saveToCloud(); },
    setTab(tab) { AppState.activeTab = tab; this.render(); },

    // --- GESTION NOUVEAUTÉS & PARAMÈTRES ---
    openUpdateModal(mode = 'all') { 
        AppState.updateModalMode = mode; 
        AppState.showUpdateModal = true; 
        this.render(); 
    },
    closeUpdateModal() { 
        AppState.updateModalMode = null; 
        AppState.showUpdateModal = false; 
        this.render(); 
    },
    addSetting(type, inputId) {
        const input = document.getElementById(inputId); let val = input.value.trim();
        if (!val) return;
        if (type === 'times') { val = parseInt(val); if (isNaN(val) || val <= 0) return; }
        if (!AppState.settings[type].includes(val)) { AppState.settings[type].push(val); if (type === 'times') AppState.settings[type].sort((a,b) => a - b); this.save(); }
        input.value = '';
    },
    removeSetting(type, val) {
        AppState.settings[type] = AppState.settings[type].filter(item => item !== val);
        if (type === 'times' && AppState.homeTime === val) AppState.homeTime = AppState.settings.times[0] || 0;
        if (type === 'locations') AppState.homeLocations = AppState.homeLocations.filter(l => l !== val);
        this.save();
    },

    // --- DOSSIERS & PROJETS ---
    addCategory() {
        const name = document.getElementById('new-cat-name').value;
        if (!name.trim()) return;
        AppState.categories.push({ id: 'c_' + Date.now(), name, note: '' });
        AppState.showAddCategory = false; this.save();
    },
    toggleCategoryExpand(id) {
        AppState.expandedCategoryIds.includes(id) 
            ? AppState.expandedCategoryIds = AppState.expandedCategoryIds.filter(cId => cId !== id)
            : AppState.expandedCategoryIds.push(id);
        this.render();
    },
    addProject(){
        const name=document.getElementById('new-proj-name').value; if(!name.trim()) return;
        AppState.projects.push({id:Date.now().toString(), name, categoryId:document.getElementById('new-proj-category').value || null, note:''});
        AppState.showAddProject=false; this.save();
    },
    goToProject(projectId) { 
        AppState.expandedProjectId = projectId;
        const proj = AppState.projects.find(p => p.id === projectId);
        if (proj && proj.categoryId && !AppState.expandedCategoryIds.includes(proj.categoryId)) { AppState.expandedCategoryIds.push(proj.categoryId); }
        this.setTab('projects'); 
    },
    toggleProjectExpand(id) { AppState.expandedProjectId = AppState.expandedProjectId === id ? null : id; this.render(); },
    toggleAddProject() { AppState.showAddProject = !AppState.showAddProject; this.render(); },
    toggleAddCategory() { AppState.showAddCategory = !AppState.showAddCategory; this.render(); },

    // --- FICHE TÂCHE UNIFIÉE ---
    openNewTaskModal(projectId = null) {
        const defDate = AppState.activeTab === 'calendar' ? AppState.selectedDate : null;
        AppState.taskModal = { 
            id: Date.now().toString(), parentId: null, isNew: true,
            data: { name: '', projectId: projectId, duration: 15, locations: [], priority: 'Moyenne', note: '', scheduledDate: defDate, scheduledTime: '' } 
        };
        this.render();
    },
    openNewSubtaskModal(parentId) {
        AppState.taskModal = { 
            id: Date.now().toString(), parentId: parentId, isNew: true,
            data: { name: '', duration: 15, locations: [], priority: 'Moyenne', note: '', scheduledDate: null, scheduledTime: '' } 
        };
        this.render();
    },
    openTaskModal(id, parentId = null) {
        let itemData = parentId ? AppState.tasks.find(t => t.id === parentId).subtasks.find(s => s.id === id) : AppState.tasks.find(t => t.id === id);
        AppState.taskModal = { id, parentId, isNew: false, data: JSON.parse(JSON.stringify(itemData)) };
        this.render();
    },
    closeTaskModal() { AppState.taskModal = null; this.render(); },
    
    clearTaskSchedule() {
        const dateInput = document.getElementById('modal-task-date');
        const timeInput = document.getElementById('modal-task-time');
        if(dateInput) dateInput.value = '';
        if(timeInput) timeInput.value = '';
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
                }
                return t;
            });
        } else { 
            const projectId = document.getElementById('modal-task-project').value || null;
            if (isNew) AppState.tasks.unshift({ id, name, projectId, duration, locations, priority, note, scheduledDate, scheduledTime, status: 'todo', subtasks: [] });
            else AppState.tasks = AppState.tasks.map(t => t.id === id ? { ...t, name, projectId, duration, locations, priority, note, scheduledDate, scheduledTime } : t);
        }
        AppState.taskModal = null; this.save();
    },

    deleteFromTaskModal() {
        const { id, parentId } = AppState.taskModal;
        if (confirm("Supprimer définitivement cette tâche ?")) {
            if (parentId) AppState.tasks = AppState.tasks.map(t => t.id === parentId ? { ...t, subtasks: t.subtasks.filter(s => s.id !== id) } : t);
            else AppState.tasks = AppState.tasks.filter(t => t.id !== id);
            AppState.taskModal = null; this.save();
        }
    },

    // --- ANCIENS MENUS (Dossiers et Projets) ---
    openMenu(e, type, id, parentId = null) { 
        if (e) { e.preventDefault(); e.stopPropagation(); } 
        if (type === 'task' || type === 'subtask') { this.openTaskModal(id, parentId); return; }
        AppState.activeMenu = { type, id, parentId }; this.render(); 
    },
    closeMenu() { AppState.activeMenu = null; this.render(); },
    
    openEdit() {
        const { type, id } = AppState.activeMenu;
        let itemData = type === 'category' ? AppState.categories.find(c => c.id === id) : AppState.projects.find(p => p.id === id);
        AppState.editPrompt = { type, id, parentId: null, data: JSON.parse(JSON.stringify(itemData)) };
        AppState.activeMenu = null; this.render();
    },
    closeEdit() { AppState.editPrompt = null; this.render(); },
    
        openNote(type, id, parentId = null) {
        let itemData;
        if (type === 'category') itemData = AppState.categories.find(c => c.id === id);
        else if (type === 'project') itemData = AppState.projects.find(p => p.id === id);
        else if (type === 'task') {
            if (parentId && parentId !== 'null') {
                const parent = AppState.tasks.find(t => t.id === parentId);
                itemData = parent ? parent.subtasks.find(s => s.id === id) : null;
            } else {
                itemData = AppState.tasks.find(t => t.id === id);
            }
        }
        
        if (itemData) {
            const hasNote = itemData.note && itemData.note.trim() !== '';
            // Si la note existe, on la met en mode "view", sinon directement en "edit"
            AppState.notePrompt = { type, id, parentId, note: itemData.note || '', mode: hasNote ? 'view' : 'edit' };
            AppState.activeMenu = null; 
            this.render();
        }
    },

     editNote() {
        if (AppState.notePrompt) { AppState.notePrompt.mode = 'edit'; this.render(); }
    },

     deleteNote() {
        if (confirm("Supprimer cette note ?")) {
            const { type, id, parentId } = AppState.notePrompt;
            this.updateItemNote(type, id, parentId, '');
            AppState.notePrompt = null;
            this.save();
        }
    },

    closeNote() { AppState.notePrompt = null; this.render(); },
    
   saveNote(event) {
        event.preventDefault();
        const { type, id, parentId } = AppState.notePrompt;
        const noteText = document.getElementById('edit-note-text').value;
        this.updateItemNote(type, id, parentId, noteText);
        AppState.notePrompt = null; 
        this.save();
    },

    updateItemNote(type, id, parentId, noteText) {
        if (type === 'category') {
            AppState.categories = AppState.categories.map(c => c.id === id ? { ...c, note: noteText } : c);
        } else if (type === 'project') {
            AppState.projects = AppState.projects.map(p => p.id === id ? { ...p, note: noteText } : p);
        } else if (type === 'task') {
            if (parentId && parentId !== 'null') {
                AppState.tasks = AppState.tasks.map(t => t.id === parentId ? { ...t, subtasks: t.subtasks.map(s => s.id === id ? { ...s, note: noteText } : s) } : t);
            } else {
                AppState.tasks = AppState.tasks.map(t => t.id === id ? { ...t, note: noteText } : t);
            }
        }
    },

    saveEdit(event) {
        event.preventDefault(); 
        const { type, id } = AppState.editPrompt;
        const name = document.getElementById('edit-name').value;
        if (type === 'category') {
            AppState.categories = AppState.categories.map(c => c.id === id ? { ...c, name } : c);
        } else if (type === 'project') {
            AppState.projects = AppState.projects.map(p => p.id === id ? { ...p, name, categoryId: document.getElementById('edit-proj-category').value || null } : p);
        }
        AppState.editPrompt = null; this.save();
    },

    openDelete() { AppState.deletePrompt = { ...AppState.activeMenu }; AppState.activeMenu = null; this.render(); },
    cancelDelete() { AppState.deletePrompt = null; this.render(); },
    confirmDelete() {
        const { type, id } = AppState.deletePrompt;
        if (type === 'category') {
            AppState.categories = AppState.categories.filter(c => c.id !== id);
            AppState.projects.forEach(p => { if (p.categoryId === id) p.categoryId = null; });
        } else if (type === 'project') { 
            AppState.projects = AppState.projects.filter(p => p.id !== id); 
            AppState.tasks = AppState.tasks.filter(t => t.projectId !== id); 
        }
        AppState.deletePrompt = null; this.save();
    },

    // --- SELECTIONS VISUELLES ---
    toggleFormLocation(btn) {
        btn.classList.toggle('loc-selected');
        if (btn.classList.contains('loc-selected')) { btn.classList.replace('bg-[#0D0F12]', 'bg-emerald-500/20'); btn.classList.replace('text-gray-500', 'text-emerald-400'); btn.classList.replace('border-transparent', 'border-emerald-500/50'); } 
        else { btn.classList.replace('bg-emerald-500/20', 'bg-[#0D0F12]'); btn.classList.replace('text-emerald-400', 'text-gray-500'); btn.classList.replace('border-emerald-500/50', 'border-transparent'); }
    },
    getFormLocations(form) { return Array.from(form.querySelectorAll('.loc-selected')).map(b => b.getAttribute('data-loc')); },
    applyPriorityStyle(btn, className) {
        btn.parentElement.querySelectorAll('button').forEach(b => { b.className = "flex-1 py-2 min-w-[60px] rounded-xl text-xs font-bold bg-[#0D0F12] text-gray-500 border border-transparent transition-colors"; });
        const p = btn.innerText.trim();
        let colors = p === 'Urgence' ? 'bg-red-500/20 text-red-400 border-red-500/50' : p === 'Haute' ? 'bg-purple-500/20 text-purple-400 border-purple-500/50' : p === 'Moyenne' ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' : 'bg-blue-500/20 text-blue-400 border-blue-500/50';
        btn.className = `flex-1 py-2 min-w-[60px] rounded-xl text-xs font-bold border transition-colors ${className} ${colors}`;
    },
    selectModalPriority(btn) { this.applyPriorityStyle(btn, 'modal-priority-selected'); },
    setHomeTime(time) { AppState.homeTime=time; this.render(); },
    toggleHomeLocation(loc) { AppState.homeLocations.includes(loc) ? AppState.homeLocations = AppState.homeLocations.filter(l => l !== loc) : AppState.homeLocations.push(loc); this.render(); },

    // --- ACTIONS TÂCHES ---
    toggleTask(taskId){ AppState.tasks=AppState.tasks.map(t=>t.id===taskId ? {...t,status:t.status==='todo'?'done':'todo'} : t); if(AppState.homeSearched) this.generateAction(); this.save(); },
    toggleSubtask(taskId,subtaskId){ AppState.tasks=AppState.tasks.map(t=>t.id===taskId ? {...t,subtasks:t.subtasks.map(s=>s.id===subtaskId ? {...s,status:s.status==='todo'?'done':'todo'} : s)} : t); this.save(); },
    addProjectTask(projectId){
        const input = document.getElementById(`project-quick-task-${projectId}`); if(!input || !input.value.trim()) return;
        AppState.tasks.unshift({id:Date.now().toString(), name:input.value, projectId:projectId, duration:15, locations:[], priority:'Moyenne', status:'todo', subtasks:[], note:'', scheduledDate: null, scheduledTime: null});
        AppState.showProjectAddTaskModal = null; this.save();
    },
    
    // --- ALGORITHMES ACTION DIRECTE ---
    getFlatActiveTasks() {
        let allActive = [];
        AppState.tasks.forEach(t => {
            let hasActiveSubtasks = false;
            if (t.subtasks && t.subtasks.length > 0) {
                t.subtasks.forEach(s => {
                    if (s.status !== 'done') {
                        hasActiveSubtasks = true;
                        allActive.push({...s, isSubtask: true, parentId: t.id, parentName: t.name, projectId: t.projectId, originalTask: t});
                    }
                });
            }
            if (!hasActiveSubtasks && t.status !== 'done') allActive.push({...t, isSubtask: false, projectId: t.projectId});
        });
        return allActive;
    },

    generateAction() {
        const priorityWeights={'Urgence':4, 'Haute':3,'Moyenne':2,'Basse':1};
        let allAvailable = [];
        AppState.tasks.forEach(t => {
            let hasActiveSubtasks = false;
            if (t.subtasks && t.subtasks.length > 0) {
                t.subtasks.forEach(s => {
                    if (s.status !== 'done') {
                        hasActiveSubtasks = true;
                        const numSub = parseInt(s.name); let blocked = false;
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
        
        allAvailable.sort((a,b)=> {
            const pA = priorityWeights[a.priority || 'Moyenne']; const pB = priorityWeights[b.priority || 'Moyenne']; 
            if (pA !== pB) return pB - pA; 
            const dA = a.duration || 15; const dB = b.duration || 15; 
            if (dA !== dB) return dB - dA; 
            if (a.isSubtask && !b.isSubtask) return -1; if (!a.isSubtask && b.isSubtask) return 1; return 0;
        });
        AppState.homeSuggestions = allAvailable.slice(0,5); AppState.homeSearched=true; this.render();
    },

    // --- LE CALENDRIER ---
    selectDate(dateStr) { AppState.selectedDate = dateStr; this.render(); },
    openAvailabilityModal() { AppState.availabilityModal = true; this.render(); },
    closeAvailabilityModal() { AppState.availabilityModal = false; this.render(); },
    
    addAvailability(event) {
        event.preventDefault();
        const start = document.getElementById('plan-start').value;
        const end = document.getElementById('plan-end').value;
        const locations = this.getFormLocations(event.target);
        
        const [startH, startM] = start.split(':').map(Number);
        const [endH, endM] = end.split(':').map(Number);
        let duration = (endH * 60 + endM) - (startH * 60 + startM);
        if (duration <= 0) duration += 24 * 60;
        
        AppState.availabilities.push({ 
            id: Date.now().toString(), 
            date: AppState.selectedDate, 
            start, end, duration, locations 
        });
        AppState.availabilityModal = false;
        this.save();
    },
    
    removeAvailability(id) {
        if(confirm("Supprimer ce créneau libre ?")) {
            AppState.availabilities = AppState.availabilities.filter(a => a.id !== id);
            this.save();
        }
    },

    fillAvailability(slotId) {
        const slot = AppState.availabilities.find(a => a.id === slotId);
        if (!slot) return;

        const priorityWeights={'Urgence':4, 'Haute':3,'Moyenne':2,'Basse':1};
        let availableTasks = this.getFlatActiveTasks().filter(t => !t.scheduledDate); 

        availableTasks.sort((a,b) => {
            if (a.projectId && a.projectId === b.projectId) {
                const numA = parseInt(a.name); const numB = parseInt(b.name);
                if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB; 
            }
            const pA = priorityWeights[a.priority || 'Moyenne']; const pB = priorityWeights[b.priority || 'Moyenne'];
            if (pA !== pB) return pB - pA;
            return (b.duration || 15) - (a.duration || 15);
        });

        let currentUsedTime = 0;
        let [currentH, currentM] = slot.start.split(':').map(Number);

        let tasksChanged = false;

        for (let i = 0; i < availableTasks.length; i++) {
            const task = availableTasks[i];
            const numTask = parseInt(task.name);
            if (!isNaN(numTask) && numTask > 1) {
                const prevTask = availableTasks.find(t => t.projectId === task.projectId && parseInt(t.name) === (numTask - 1));
                if (prevTask) continue; 
            }

            if ((currentUsedTime + task.duration) <= slot.duration) {
                let matchLoc = true;
                if (slot.locations && slot.locations.length > 0) { 
                    matchLoc = (!task.locations || task.locations.length === 0) ? false : task.locations.some(l => slot.locations.includes(l)); 
                }
                
                if (matchLoc) {
                    const timeStr = `${String(currentH).padStart(2,'0')}:${String(currentM).padStart(2,'0')}`;
                    
                    if (task.isSubtask) {
                        AppState.tasks = AppState.tasks.map(t => t.id === task.parentId ? { ...t, subtasks: t.subtasks.map(s => s.id === task.id ? { ...s, scheduledDate: slot.date, scheduledTime: timeStr } : s) } : t);
                    } else {
                        AppState.tasks = AppState.tasks.map(t => t.id === task.id ? { ...t, scheduledDate: slot.date, scheduledTime: timeStr } : t);
                    }

                    currentUsedTime += task.duration;
                    currentM += task.duration;
                    while (currentM >= 60) { currentH += 1; currentM -= 60; }
                    tasksChanged = true;
                }
            }
        }

        if (tasksChanged) {
            AppState.availabilities = AppState.availabilities.filter(a => a.id !== slotId);
            this.save();
        } else {
            alert("Aucune tâche de la Base ne correspond aux filtres ou à la durée de ce créneau.");
        }
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

${task.note && task.note.trim() !== '' ? `<span onclick="App.openNote('task', '${task.id}', ${isSubtask ? `'${parentId}'` : 'null'}); event.stopPropagation();" class="flex items-center text-amber-400 hover:text-amber-300 transition-colors bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30 cursor-pointer" title="Voir la note"><i data-lucide="file-text" class="w-3 h-3"></i></span>` : ''}
        const isDone = task.status === 'done'; const isSubtask = parentId !== null;
        const argParent = isSubtask ? `, '${parentId}'` : '';
        const priorityColors = {'Urgence':'text-red-400 bg-red-500/10 border-red-500/30', 'Haute':'text-purple-400 bg-purple-500/10 border-purple-500/30','Moyenne':'text-amber-400 bg-amber-500/10 border-amber-500/30','Basse':'text-blue-400 bg-blue-500/10 border-blue-500/30'};
        const hasLocations = task.locations && task.locations.length > 0;
        let projectName = ''; if (task.projectId) { const proj = AppState.projects.find(p => p.id === task.projectId); if (proj) projectName = proj.name; }

        return `
        <div onclick="App.openTaskModal('${task.id}'${argParent}); event.stopPropagation();" class="group flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all duration-300 border ${isDone?'bg-[#13161c] border-gray-800/30 opacity-60':'bg-[#1A1D24] border-gray-800 hover:border-gray-700'}">
            <div class="flex items-center gap-4 overflow-hidden flex-1">
                <button onclick="${isSubtask ? `App.toggleSubtask('${parentId}','${task.id}')` : `App.toggleTask('${task.id}')`}; event.stopPropagation();" class="shrink-0 focus:outline-none cursor-pointer p-1 -ml-1">
                    ${isDone?'<i data-lucide="check-circle-2" class="text-emerald-500"></i>':'<i data-lucide="circle" class="text-gray-600"></i>'}
                </button>
                <div class="flex-1 min-w-0">
                    <h4 class="font-bold truncate text-[15px] ${isDone?'text-gray-500 line-through':'text-gray-200'}">${task.name}</h4>
                    <div class="flex items-center gap-2 mt-1 text-xs font-semibold text-gray-500 flex-wrap">
                        <span class="flex items-center gap-1"><i data-lucide="clock" class="w-3 h-3"></i> ${task.duration}m</span>
                        ${hasLocations ? `<span class="flex items-center gap-1"><i data-lucide="map-pin" class="w-3 h-3 text-emerald-400"></i> ${task.locations.join(', ')}</span>` : ''}
                        <span class="px-2 py-0.5 rounded-md text-[10px] border font-bold ${priorityColors[task.priority || 'Moyenne']}">${task.priority || 'Moyenne'}</span>
                        ${task.scheduledDate ? `<span class="flex items-center gap-1 text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/30"><i data-lucide="calendar" class="w-3 h-3"></i> ${task.scheduledDate.substring(5)}</span>` : ''}
                        ${task.note && task.note.trim() !== '' ? `<span class="flex items-center text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30"><i data-lucide="file-text" class="w-3 h-3"></i></span>` : ''}
                    </div>
                    ${projectName && !isSubtask ? `<div class="text-[10px] text-indigo-400/70 font-semibold flex items-center gap-1 mt-1 truncate"><i data-lucide="corner-down-right" class="w-3 h-3 shrink-0"></i> Tâche de : ${projectName}</div>` : ''}
                    ${isSubtask && parentName ? `<div class="text-[10px] text-indigo-400/70 font-semibold flex items-center gap-1 mt-1 truncate"><i data-lucide="corner-down-right" class="w-3 h-3 shrink-0"></i> Sous-tâche de : ${parentName}</div>` : ''}
                </div>
            </div>
            ${!isDone ? `<i data-lucide="chevron-right" class="w-5 h-5 text-gray-600"></i>` : ''}
        </div>`;
    },

    renderCalendar() {
        const priorityColors = {'Urgence':'text-red-400 border-red-500/30', 'Haute':'text-purple-400 border-purple-500/30','Moyenne':'text-amber-400 border-amber-500/30','Basse':'text-blue-400 border-blue-500/30'};

        const dates = [];
        const todayDate = new Date();
        const startDay = new Date(todayDate); startDay.setDate(todayDate.getDate() - 3);
        const months = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Aoû','Sep','Oct','Nov','Déc'];
        
        for (let i=0; i<90; i++) {
            const d = new Date(startDay); d.setDate(startDay.getDate() + i);
            const dStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            const dayName = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'][d.getDay()];
            const monthName = months[d.getMonth()];
            dates.push({ date: dStr, label: dayName, num: d.getDate(), month: monthName, isToday: dStr === getTodayString() });
        }

        let datesHtml = `<div class="flex gap-2 overflow-x-auto pb-4 no-scrollbar scroll-smooth" id="calendar-date-picker">`;
        dates.forEach(d => {
            const isSelected = d.date === AppState.selectedDate;
            datesHtml += `
            <div onclick="App.selectDate('${d.date}')" class="flex flex-col items-center justify-center min-w-[55px] p-2 rounded-2xl cursor-pointer transition-all border ${isSelected ? 'bg-cyan-500 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.4)]' : d.isToday ? 'bg-[#1A1D24] border-gray-600' : 'bg-[#0D0F12] border-gray-800 hover:border-gray-700'}">
                <span class="text-[10px] font-bold uppercase ${isSelected ? 'text-black' : d.isToday ? 'text-cyan-400' : 'text-gray-500'}">${d.label}</span>
                <span class="text-lg font-black ${isSelected ? 'text-black' : 'text-white'}">${d.num}</span>
                <span class="text-[9px] font-bold uppercase ${isSelected ? 'text-black' : 'text-gray-500'}">${d.month}</span>
            </div>`;
        });
        datesHtml += `</div>`;

        let dayEvents = [];
        
        AppState.tasks.forEach(t => {
            if (t.scheduledDate === AppState.selectedDate) {
                dayEvents.push({ ...t, type: 'task', isSubtask: false, parentName: null });
            }
            if (t.subtasks) {
                t.subtasks.forEach(s => {
                    if (s.scheduledDate === AppState.selectedDate) {
                        dayEvents.push({ ...s, type: 'task', isSubtask: true, parentId: t.id, parentName: t.name, projectId: t.projectId });
                    }
                });
            }
        });

        AppState.availabilities.forEach(a => {
            if (a.date === AppState.selectedDate) {
                dayEvents.push({ ...a, type: 'slot' });
            }
        });

        dayEvents.sort((a,b) => {
            const timeA = a.type === 'task' ? (a.scheduledTime || '23:59') : a.start;
            const timeB = b.type === 'task' ? (b.scheduledTime || '23:59') : b.start;
            return timeA.localeCompare(timeB);
        });

        let timelineHtml = `<div class="relative space-y-3 mt-2 pl-2 border-l border-gray-800">`;

        if (AppState.selectedDate === getTodayString()) {
            const now = new Date();
            const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
            timelineHtml += `
            <div class="relative flex items-center mb-4 -ml-4 z-10">
                <div class="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
                <div class="flex-1 h-px bg-red-500/50"></div>
                <span class="absolute right-0 -top-2.5 text-[10px] font-black text-red-500 bg-[#0D0F12] pl-2">${timeStr}</span>
            </div>`;
        }

        if (dayEvents.length === 0) {
            timelineHtml += `<div class="py-10 text-center text-gray-500 text-sm font-semibold">Rien de prévu à cette date.</div>`;
        } else {
            dayEvents.forEach(ev => {
                if (ev.type === 'task') {
                    const isDone = ev.status === 'done';
                    const timeDisp = ev.scheduledTime || '--:--';
                    timelineHtml += `
                    <div class="relative pl-6 pb-2">
                        <div class="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full ${isDone ? 'bg-emerald-500' : 'bg-cyan-500 border border-[#0D0F12]'}"></div>
                        <div class="bg-[#1A1D24] p-3 rounded-2xl border ${isDone ? 'border-gray-800/50 opacity-60' : 'border-gray-800'} cursor-pointer hover:border-gray-700 transition-colors" onclick="App.openTaskModal('${ev.id}'${ev.isSubtask ? `, '${ev.parentId}'` : ''})">
                            <div class="flex justify-between items-start mb-1">
                                <div class="flex items-center gap-2">
                                    <button onclick="event.stopPropagation(); ${ev.isSubtask ? `App.toggleSubtask('${ev.parentId}','${ev.id}')` : `App.toggleTask('${ev.id}')`}" class="p-1 -ml-1 text-gray-500 hover:text-emerald-400 focus:outline-none">
                                        <i data-lucide="${isDone ? 'check-circle-2' : 'circle'}" class="w-4 h-4 ${isDone ? 'text-emerald-500' : ''}"></i>
                                    </button>
                                    <span class="text-xs font-black text-cyan-400 ${isDone ? 'text-gray-500 line-through' : ''}">${timeDisp}</span>
                                </div>
                                <span class="px-1.5 py-0.5 rounded text-[8px] border bg-[#0D0F12] ${priorityColors[ev.priority || 'Moyenne']}">${ev.priority || 'Moyenne'}</span>
                            </div>
                            <h4 class="text-sm font-bold text-white ${isDone ? 'line-through text-gray-500' : ''} ml-1">${ev.name}</h4>
                            <div class="flex items-center gap-2 mt-1.5 text-[10px] text-gray-500 ml-1">
                                <span><i data-lucide="clock" class="w-3 h-3 inline"></i> ${ev.duration}m</span>
                                ${ev.locations && ev.locations.length > 0 ? `<span class="text-emerald-400"><i data-lucide="map-pin" class="w-3 h-3 inline"></i> ${ev.locations.join(', ')}</span>` : ''}
                                ${ev.note && ev.note.trim() !== '' ? `<span onclick="App.openNote('task', '${ev.id}', ${ev.isSubtask ? `'${ev.parentId}'` : 'null'}); event.stopPropagation();" class="text-amber-400 hover:text-amber-300 transition-colors cursor-pointer" title="Voir la note"><i data-lucide="file-text" class="w-3 h-3 inline"></i></span>` : ''}
                            </div>
                            ${ev.isSubtask && ev.parentName ? `<div class="text-[9px] text-indigo-400/70 font-semibold mt-1 ml-1"><i data-lucide="corner-down-right" class="w-3 h-3 inline"></i> ${ev.parentName}</div>` : ''}
                        </div>
                    </div>`;
                } else {
                    timelineHtml += `
                    <div class="relative pl-6 pb-2">
                        <div class="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-500 border border-[#0D0F12] animate-pulse"></div>
                        <div class="bg-indigo-500/10 p-3 rounded-2xl border border-indigo-500/30">
                            <div class="flex justify-between items-start mb-2">
                                <span class="text-xs font-black text-indigo-400">${ev.start} - ${ev.end}</span>
                                <button onclick="App.removeAvailability('${ev.id}')" class="text-gray-500 hover:text-red-400"><i data-lucide="x" class="w-4 h-4"></i></button>
                            </div>
                            <div class="flex justify-between items-center">
                                <div class="text-[10px] text-indigo-300/70 font-semibold">
                                    Créneau libre (${ev.duration}m)
                                    ${ev.locations && ev.locations.length > 0 ? `<br><i data-lucide="map-pin" class="w-3 h-3 inline"></i> ${ev.locations.join(', ')}` : ''}
                                </div>
                                <button onclick="App.fillAvailability('${ev.id}')" class="bg-indigo-500 text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase shadow-[0_0_10px_rgba(99,102,241,0.4)] hover:bg-indigo-400 transition-colors">Auto-Remplir</button>
                            </div>
                        </div>
                    </div>`;
                }
            });
        }
        timelineHtml += `</div>`;

        return `
        <div class="space-y-4">
            <div class="px-1 flex justify-between items-center">
                <h2 class="text-xl font-black text-white flex items-center gap-2"><i data-lucide="calendar-days" class="text-cyan-400"></i> Calendrier</h2>
                <button onclick="App.openAvailabilityModal()" class="px-3 py-1.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-xs font-bold">+ Créneau</button>
            </div>
            ${datesHtml}
            <div class="bg-[#1A1D24] p-4 rounded-3xl border border-gray-800 shadow-xl min-h-[50vh]">
                <h3 class="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 border-b border-gray-800 pb-2">Timeline</h3>
                ${timelineHtml}
            </div>
        </div>
        `;
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
                <p class="text-[10px] text-gray-500 mb-4 -mt-2">Recherche parmi les tâches non planifiées.</p>
                <div class="space-y-4">
                    <div><label class="text-xs font-semibold text-gray-400 uppercase mb-2 block">Temps dispo (min)</label>
                        <div class="flex gap-2 flex-wrap">${AppState.settings.times.map(t=>`<button onclick="App.setHomeTime(${t})" class="flex-1 min-w-[50px] py-2 rounded-xl text-sm font-bold ${AppState.homeTime===t?'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50':'bg-[#0D0F12] text-gray-400 border border-transparent'}">${t}</button>`).join('')}</div>
                    </div>
                    <div>
                        <label class="text-xs font-semibold text-gray-400 uppercase mb-2 flex items-center justify-between"><span>Filtre(s) possible(s)</span><span class="text-[10px] text-gray-500 font-normal">Vide = Partout</span></label>
                        <div class="flex gap-2 flex-wrap">${AppState.settings.locations.map(l=>`<button onclick="App.toggleHomeLocation('${l}')" class="flex-1 min-w-[70px] py-2 rounded-xl text-sm font-bold ${AppState.homeLocations.includes(l)?'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50':'bg-[#0D0F12] text-gray-400 border border-transparent'}">${l}</button>`).join('')}</div>
                    </div>
                    <button onclick="App.generateAction()" class="w-full py-4 mt-2 rounded-xl bg-cyan-500 text-black font-black text-lg uppercase transition-all shadow-[0_0_15px_rgba(6,182,212,0.4)]">Trouver quoi faire</button>
                </div>
                ${AppState.homeSearched?`<div class="mt-6 pt-4 border-t border-gray-800"><h3 class="text-xs font-bold text-gray-500 mb-3 uppercase">Résultats (${AppState.homeSuggestions.length})</h3>${AppState.homeSuggestions.length>0?`<div class="space-y-2">${AppState.homeSuggestions.map(t=>this.renderTask(t, false, t.isSubtask ? t.parentId : null, t.isSubtask ? t.parentName : null)).join('')}</div>`:`<p class="text-sm text-gray-500 text-center py-4">Aucune tâche non planifiée ne correspond.</p>`}</div>`:''}
            </section>
            
            <section><h2 class="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 px-1 flex items-center gap-2"><i data-lucide="alert-circle" class="text-red-400 w-4 h-4"></i> Priorités Non Planifiées</h2><div class="space-y-2">${urgencies.length>0?urgencies.map(t=>this.renderTask(t, false, t.isSubtask ? t.parentId : null, t.isSubtask ? t.parentName : null)).join(''):`<div class="bg-[#1A1D24] rounded-2xl p-6 text-center border border-gray-800 border-dashed"><p class="text-gray-500 text-sm">Tout est sous contrôle ou planifié.</p></div>`}</div></section>
        </div>`;
    },

    renderProjectItem(project) {
        const projectTasks = AppState.tasks.filter(t => t.projectId === project.id);
        let total=0, comp=0; 
        projectTasks.forEach(t=>{ total++; if(t.status==='done')comp++; if(t.subtasks){t.subtasks.forEach(s=>{total++;if(s.status==='done')comp++})} });
        const prog=total===0?0:Math.round((comp/total)*100); 
        const exp = AppState.expandedProjectId === project.id;
        
        return `
        <div class="bg-[#13161c] rounded-2xl border border-gray-800 overflow-hidden mb-3">
            <div onclick="App.toggleProjectExpand('${project.id}')" class="p-4 cursor-pointer hover:bg-[#1A1D24] transition-colors">
                <div class="flex justify-between items-start mb-2">
                    <div class="flex items-center gap-3 flex-1 min-w-0">
                        <div class="p-1.5 rounded-lg ${prog===100?'bg-emerald-500/20 text-emerald-400':'bg-cyan-500/20 text-cyan-400'} shrink-0"><i data-lucide="target" class="w-4 h-4"></i></div>
                        <div class="flex-1 min-w-0 flex items-center flex-wrap gap-y-1">
                            <h3 class="font-bold text-sm truncate ${prog===100?'text-gray-400 line-through':'text-white'}">${project.name}</h3>
                            ${project.note ? `<span onclick="App.openNote('project', '${project.id}'); event.stopPropagation();" class="text-amber-400 hover:text-amber-300 transition-colors bg-amber-500/10 p-1 rounded-md border border-amber-500/30 ml-2 cursor-pointer" title="Voir la note"><i data-lucide="file-text" class="w-3 h-3"></i></span>` : ''}
                        </div>
                    </div>
                    <div class="flex items-center gap-1 shrink-0 ml-2">
                        <button onclick="App.openMenu(event, 'project', '${project.id}')" class="p-1 text-gray-500 hover:text-cyan-400 rounded-lg"><i data-lucide="more-vertical" class="w-4 h-4"></i></button>
                        <i data-lucide="${exp?'chevron-down':'chevron-right'}" class="text-gray-500 w-4 h-4 ml-1"></i>
                    </div>
                </div>
                <div class="flex items-center gap-3"><div class="h-1.5 w-full bg-[#0D0F12] rounded-full overflow-hidden border border-gray-800/50"><div class="h-full rounded-full transition-all duration-1000 ${prog===100?'bg-emerald-400':'bg-gradient-to-r from-cyan-600 to-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.5)]'}" style="width:${prog}%"></div></div><span class="text-[10px] font-bold text-gray-500 w-8 text-right">${prog}%</span></div>
            </div>
            ${exp?`<div class="px-4 pb-4 border-t border-gray-800/50 pt-3 bg-[#0D0F12]" onclick="event.stopPropagation()">
                <div class="flex justify-between items-center mb-3">
                    <span class="text-[10px] font-bold text-gray-500 uppercase">Tâches</span>
                    <button onclick="App.openNewTaskModal('${project.id}')" class="flex items-center gap-1 text-[10px] text-cyan-400 bg-cyan-500/10 px-2 py-1 rounded-lg border border-cyan-500/30"><i data-lucide="plus" class="w-3 h-3"></i> Tâche</button>
                </div>
                ${projectTasks.length===0?'<p class="text-xs text-gray-600 text-center py-2">Aucune tâche.</p>':projectTasks.map(task=>`<div class="space-y-2 mb-2">${this.renderTask(task,true)}
                    ${task.subtasks&&task.subtasks.length>0?`<div class="ml-6 space-y-1.5 border-l border-gray-800 pl-3">${task.subtasks.map(sub=>this.renderTask(sub,true,task.id,task.name)).join('')}</div>`:''}
                </div>`).join('')}
            </div>`:''}
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
            
        if(AppState.showAddCategory) {
            html += `<div class="bg-[#1A1D24] p-4 rounded-2xl border border-indigo-500/30 mb-4 flex gap-2"><input type="text" id="new-cat-name" placeholder="Nom du dossier..." class="flex-1 bg-[#0D0F12] rounded-lg px-3 py-2 text-sm text-white focus:outline-none border border-gray-800"><button onclick="App.addCategory()" class="bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-bold">OK</button></div>`;
        }
        if(AppState.showAddProject) {
            html += `<div class="bg-[#1A1D24] p-4 rounded-2xl border border-cyan-500/30 mb-4 flex flex-col gap-3"><input type="text" id="new-proj-name" placeholder="Nom du projet..." class="w-full bg-[#0D0F12] rounded-lg px-3 py-2 text-sm text-white focus:outline-none border border-gray-800"><div class="flex gap-2"><select id="new-proj-category" class="flex-1 bg-[#0D0F12] rounded-lg px-3 py-2 text-sm text-gray-300 border border-gray-800 focus:outline-none"><option value="">Dossier : Aucun</option>${AppState.categories.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}</select><button onclick="App.addProject()" class="bg-cyan-500 text-black px-4 py-2 rounded-lg text-sm font-bold">OK</button></div></div>`;
        }

        AppState.categories.forEach(cat => {
            const catProjects = AppState.projects.filter(p => p.categoryId === cat.id);
            const isCatExpanded = AppState.expandedCategoryIds.includes(cat.id);
            
            html += `
            <div class="bg-[#1A1D24] rounded-2xl border border-gray-800 mb-4 shadow-sm" ondragover="App.handleCategoryDragOver(event)" ondragleave="App.handleCategoryDragLeave(event)" ondrop="App.handleCategoryDrop(event, '${cat.id}')">
                <div onclick="App.toggleCategoryExpand('${cat.id}')" class="p-4 cursor-pointer hover:bg-[#1f232b] transition-colors rounded-t-2xl ${!isCatExpanded ? 'rounded-b-2xl' : ''}">
                    <div class="flex justify-between items-center">
                        <div class="flex items-center gap-3">
                            <i data-lucide="folder" class="${isCatExpanded ? 'text-indigo-400 fill-indigo-400/20' : 'text-gray-500'} w-5 h-5 transition-colors"></i>
                            <h3 class="font-bold text-white text-md">${cat.name}</h3>
                            ${cat.note ? `<span onclick="App.openNote('category', '${cat.id}'); event.stopPropagation();" class="text-amber-400 hover:text-amber-300 transition-colors bg-amber-500/10 p-1 rounded-md border border-amber-500/30 ml-1 cursor-pointer"><i data-lucide="file-text" class="w-3 h-3"></i></span>` : ''}
                        </div>
                        <div class="flex items-center gap-1">
                            <span class="text-[10px] font-bold text-gray-500 bg-[#0D0F12] px-2 py-0.5 rounded-md mr-1">${catProjects.length}</span>
                            <button onclick="App.openMenu(event, 'category', '${cat.id}')" class="p-1.5 text-gray-500 hover:text-indigo-400 rounded-lg"><i data-lucide="more-vertical" class="w-4 h-4"></i></button>
                            <i data-lucide="${isCatExpanded?'chevron-down':'chevron-right'}" class="text-gray-500 w-4 h-4"></i>
                        </div>
                    </div>
                </div>
                ${isCatExpanded ? `
                <div class="px-3 pb-3 pt-2 bg-[#1A1D24] border-t border-gray-800/50 rounded-b-2xl" onclick="event.stopPropagation()">
                    ${catProjects.length === 0 ? '<p class="text-xs text-gray-600 text-center py-4">Dossier vide.</p>' : catProjects.map(p => this.renderProjectItem(p)).join('')}
                </div>
                ` : ''}
            </div>`;
        });

        const orphanedProjects = AppState.projects.filter(p => !p.categoryId);
        if (orphanedProjects.length > 0) {
            html += `<div class="mt-8 mb-2 px-1 flex items-center gap-2"><div class="h-px bg-gray-800 flex-1"></div><span class="text-xs font-bold text-gray-500 uppercase tracking-widest">Sans Dossier</span><div class="h-px bg-gray-800 flex-1"></div></div>`;
            html += `<div class="space-y-3" ondragover="App.handleCategoryDragOver(event)" ondragleave="App.handleCategoryDragLeave(event)" ondrop="App.handleCategoryDrop(event, 'null')">`;
            html += orphanedProjects.map(p => this.renderProjectItem(p)).join('');
            html += `</div>`;
        }

        const isolatedTasks = AppState.tasks.filter(t => !t.projectId);
        if (isolatedTasks.length > 0) {
            html += `<div class="mt-8 mb-4 px-1 flex items-center gap-2"><div class="h-px bg-gray-800 flex-1"></div><span class="text-xs font-bold text-gray-500 uppercase tracking-widest">Tâches Isolées</span><div class="h-px bg-gray-800 flex-1"></div></div>`;
            html += `<div class="space-y-2">`;
            html += isolatedTasks.map(t => this.renderTask(t, false)).join('');
            html += `</div>`;
        }

        return html+'</div>';
    },

    renderSettings() {
        const renderList = (type, placeholder, isNumber) => `<div class="bg-[#1A1D24] rounded-2xl p-5 border border-gray-800 mb-6"><h3 class="font-bold text-white mb-4 uppercase text-sm flex items-center gap-2">${type === 'times' ? '<i data-lucide="clock" class="text-cyan-400 w-4 h-4"></i> Temps disponibles (min)' : type === 'locations' ? '<i data-lucide="map-pin" class="text-emerald-400 w-4 h-4"></i> Filtres' : '<i data-lucide="tag" class="text-indigo-400 w-4 h-4"></i> Catégories'}</h3><div class="flex gap-2 mb-4"><input type="${isNumber ? 'number' : 'text'}" id="setting-input-${type}" placeholder="${placeholder}" class="flex-1 bg-[#0D0F12] rounded-xl px-3 py-2 text-sm text-white focus:outline-none border border-gray-800"><button onclick="App.addSetting('${type}', 'setting-input-${type}')" class="bg-cyan-500 text-black px-4 py-2 rounded-xl text-sm font-bold">+</button></div><div class="flex flex-wrap gap-2">${AppState.settings[type].map(item => `<div class="flex items-center gap-2 bg-[#0D0F12] border border-gray-800 px-3 py-1.5 rounded-lg text-sm text-gray-300"><span>${item}</span><button onclick="App.removeSetting('${type}', ${isNumber ? item : `'${item}'`})" class="text-gray-500 hover:text-red-500 ml-1"><i data-lucide="x" class="w-3.5 h-3.5"></i></button></div>`).join('')}</div></div>`;
        return `
        <div class="space-y-4">
            <div class="px-1 mb-6"><h2 class="text-xl font-black text-white flex items-center gap-2"><i data-lucide="settings" class="text-gray-400"></i> Paramètres</h2><p class="text-sm text-gray-500 mt-1">Personnalise les filtres de ton application.</p></div>
            
            ${renderList('times', 'Ex: 45', true)}
            ${renderList('locations', 'Ex: Garage, Fatigue...', false)}

            <div class="mt-8 mb-8">
                <button onclick="App.logout()" class="w-full py-4 rounded-xl bg-red-500/10 text-red-500 font-bold border border-red-500/30 hover:bg-red-500 hover:text-white transition-colors flex items-center justify-center gap-2">
                    <i data-lucide="log-out" class="w-5 h-5"></i> Se déconnecter
                </button>
            </div>
            
            <div class="mb-4 flex justify-center">
                <button onclick="App.openUpdateModal('all')" class="text-xs font-bold text-gray-500 bg-[#1A1D24] px-4 py-2 rounded-full border border-gray-800 hover:border-cyan-500/50 hover:text-cyan-400 transition-colors flex items-center gap-2 shadow-sm">
                    My Task v${APP_VERSION} <i data-lucide="info" class="w-3.5 h-3.5"></i>
                </button>
            </div>
        </div>`;
    },
    
    // ==========================================
    // 5. AFFICHAGE GLOBAL ET MODALS
    // ==========================================
    render() {
        const content = document.getElementById('app-content');
        
        if (!AppState.currentUser) {
            document.querySelector('nav')?.remove(); 
            content.innerHTML = this.renderAuth();
            lucide.createIcons();
            return;
        }

        if (!document.querySelector('nav')) {
            document.getElementById('app-container').insertAdjacentHTML('beforeend', `<nav class="fixed bottom-0 w-full bg-[#13161c]/90 backdrop-blur-md border-t border-gray-800 px-2 py-4 flex justify-around items-center z-20 pb-8"><button onclick="App.setTab('home')" id="nav-home" class="flex flex-col items-center gap-1 transition-all text-gray-500"><i data-lucide="play-circle"></i><span class="text-[9px] font-bold tracking-wider uppercase">Action</span></button><button onclick="App.setTab('projects')" id="nav-projects" class="flex flex-col items-center gap-1 transition-all text-gray-500"><i data-lucide="folder"></i><span class="text-[9px] font-bold tracking-wider uppercase">Base</span></button><button onclick="App.setTab('calendar')" id="nav-calendar" class="flex flex-col items-center gap-1 transition-all text-gray-500"><i data-lucide="calendar"></i><span class="text-[9px] font-bold tracking-wider uppercase">Calendrier</span></button><button onclick="App.setTab('settings')" id="nav-settings" class="flex flex-col items-center gap-1 transition-all text-gray-500"><i data-lucide="settings"></i><span class="text-[9px] font-bold tracking-wider uppercase">Paramètres</span></button></nav>`);
        }

        if (AppState.activeTab === 'home') content.innerHTML = this.renderHome();
        else if (AppState.activeTab === 'calendar') content.innerHTML = this.renderCalendar();
        else if (AppState.activeTab === 'projects') content.innerHTML = this.renderProjects();
        else if (AppState.activeTab === 'settings') content.innerHTML = this.renderSettings();
        
        let modalContainer = document.getElementById('modal-container');
        if (!modalContainer) { 
            modalContainer = document.createElement('div'); 
            modalContainer.id = 'modal-container'; 
            document.getElementById('app-container').appendChild(modalContainer); 
        }
        
        // MODALS
        if (AppState.missedTasksNotif.length > 0) {
            modalContainer.innerHTML = `
                <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center px-4" onclick="App.closeMissedTasksNotif()">
                    <div class="bg-[#1A1D24] border border-gray-800 w-full max-w-md rounded-3xl p-6 shadow-2xl transform transition-all animate-slide-up" onclick="event.stopPropagation()">
                        <div class="flex justify-center mb-4">
                            <div class="p-3 bg-amber-500/20 rounded-full border border-amber-500/30">
                                <i data-lucide="rotate-ccw" class="w-8 h-8 text-amber-400"></i>
                            </div>
                        </div>
                        <h3 class="text-xl font-black text-white text-center mb-2">Tâches en retard</h3>
                        <p class="text-sm text-gray-400 text-center mb-6">Les tâches suivantes n'ont pas été cochées à temps. Elles ont été replacées dans la Base pour ne pas polluer l'agenda.</p>
                        <div class="space-y-2 max-h-[40vh] overflow-y-auto mb-6">
                            ${AppState.missedTasksNotif.map(t => `<div class="bg-[#0D0F12] p-3 rounded-xl border border-gray-800 text-sm font-bold text-gray-300 flex justify-between items-center"><span>${t.name}</span> <span class="text-[10px] text-gray-500 px-2 py-0.5 rounded bg-gray-800">${t.parentName || 'Tâche'}</span></div>`).join('')}
                        </div>
                        <button onclick="App.closeMissedTasksNotif()" class="w-full py-4 rounded-xl bg-amber-500 text-black font-bold uppercase tracking-wider hover:bg-amber-400 transition-colors shadow-[0_0_15px_rgba(245,158,11,0.3)]">J'ai compris</button>
                    </div>
                </div>
            `;
        } else if (AppState.showUpdateModal) {
            let htmlContent = '';
            let title = AppState.updateModalMode === 'unseen' ? 'Depuis votre dernière visite...' : 'Historique des Mises à jour';
            
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
                        <div class="flex justify-between items-center mb-6">
                            <h3 class="text-lg font-black text-white flex items-center gap-2"><i data-lucide="sparkles" class="text-cyan-400"></i> ${title}</h3>
                            <button onclick="App.closeUpdateModal()" class="text-gray-500 hover:text-white transition-colors p-1"><i data-lucide="x" class="w-5 h-5"></i></button>
                        </div>
                        <div class="text-sm space-y-2 max-h-[60vh] overflow-y-auto pr-2" style="scrollbar-width: thin; scrollbar-color: #374151 transparent;">
                            ${htmlContent}
                        </div>
                        <button onclick="App.closeUpdateModal()" class="w-full mt-6 py-4 rounded-xl bg-cyan-500 text-black font-bold uppercase tracking-wider hover:bg-cyan-400 transition-colors shadow-[0_0_15px_rgba(6,182,212,0.3)]">Génial !</button>
                    </div>
                </div>
            `;
        } else if (AppState.availabilityModal) {
            modalContainer.innerHTML = `
                <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center pb-8 px-4" onclick="App.closeAvailabilityModal()">
                    <div class="bg-[#1A1D24] border border-gray-800 w-full max-w-md rounded-3xl p-6 shadow-2xl transform transition-all animate-slide-up" onclick="event.stopPropagation()">
                        <h3 class="text-xl font-bold text-white mb-4 flex items-center gap-2"><i data-lucide="calendar-plus" class="text-indigo-400"></i> Créneau libre</h3>
                        <p class="text-xs text-gray-500 mb-6">Ajouter un bloc de temps pour le ${AppState.selectedDate}</p>
                        <form onsubmit="App.addAvailability(event)" class="space-y-4">
                            <div class="flex gap-2 items-center">
                                <span class="text-xs text-gray-500 font-bold w-6">De</span>
                                <input type="time" id="plan-start" required class="flex-1 bg-[#0D0F12] rounded-xl px-3 py-3 text-sm text-white border border-gray-800" value="14:00">
                                <span class="text-xs text-gray-500 font-bold w-6 text-center">À</span>
                                <input type="time" id="plan-end" required class="flex-1 bg-[#0D0F12] rounded-xl px-3 py-3 text-sm text-white border border-gray-800" value="16:00">
                            </div>
                            <div>
                                <label class="text-[10px] text-gray-500 uppercase font-bold block mb-2">Filtres de ce créneau (Optionnel)</label>
                                <div class="flex gap-2 flex-wrap">
                                    ${AppState.settings.locations.map(l => `<button type="button" onclick="App.toggleFormLocation(this)" class="flex-1 min-w-[70px] py-2 rounded-xl text-xs font-bold bg-[#0D0F12] text-gray-500 border border-transparent" data-loc="${l}">${l}</button>`).join('')}
                                </div>
                            </div>
                            <div class="flex gap-3 pt-4">
                                <button type="button" onclick="App.closeAvailabilityModal()" class="flex-1 py-3 rounded-xl bg-[#0D0F12] text-white font-bold border border-gray-700">Annuler</button>
                                <button type="submit" class="flex-1 py-3 rounded-xl bg-indigo-500 text-white font-bold">Ajouter au Calendrier</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
        } else if (AppState.taskModal) {
            const d = AppState.taskModal.data; 
            const dLocs = d.locations || [];
            modalContainer.innerHTML = `
                <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center pb-8 px-4" onclick="App.closeTaskModal()">
                    <div class="bg-[#1A1D24] border border-gray-800 w-full max-w-md rounded-3xl p-6 shadow-2xl transform transition-all animate-slide-up overflow-y-auto max-h-[90vh]" onclick="event.stopPropagation()">
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="text-xl font-black text-white">${AppState.taskModal.isNew ? 'Nouvelle Tâche' : (AppState.taskModal.parentId ? 'Sous-tâche' : 'Fiche Tâche')}</h3>
                            ${!AppState.taskModal.isNew ? `<button onclick="App.deleteFromTaskModal()" class="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-colors"><i data-lucide="trash-2" class="w-5 h-5"></i></button>` : ''}
                        </div>
                        <form onsubmit="App.saveTaskModal(event)" class="space-y-4">
                            <div>
                                <label class="text-[10px] text-gray-500 uppercase font-bold">Nom</label>
                                <input type="text" id="modal-task-name" value="${d.name ? d.name.replace(/"/g, '&quot;') : ''}" required class="w-full bg-[#0D0F12] rounded-xl px-4 py-3 text-white border border-gray-800 focus:border-cyan-500 focus:outline-none">
                            </div>
                            
                            ${!AppState.taskModal.parentId ? `
                            <div>
                                <label class="text-[10px] text-gray-500 uppercase font-bold">Projet</label>
                                <select id="modal-task-project" class="w-full bg-[#0D0F12] rounded-xl px-3 py-3 text-sm text-gray-300 border border-gray-800 focus:outline-none">
                                    <option value="">Isolée (Aucun projet)</option>
                                    ${AppState.projects.map(p => `<option value="${p.id}" ${p.id === d.projectId ? 'selected' : ''}>${p.name}</option>`).join('')}
                                </select>
                            </div>` : ''}

                            <div class="p-3 border border-gray-800 rounded-xl bg-[#0D0F12]">
                                <div class="flex justify-between items-center mb-2">
                                    <label class="text-[10px] text-cyan-400 uppercase font-bold flex items-center gap-1"><i data-lucide="calendar" class="w-3 h-3"></i> Planification</label>
                                    <button type="button" onclick="App.clearTaskSchedule()" class="text-[10px] text-gray-500 hover:text-red-400 flex items-center gap-1 transition-colors"><i data-lucide="eraser" class="w-3 h-3"></i> Effacer</button>
                                </div>
                                <div class="flex gap-2">
                                    <input type="date" id="modal-task-date" value="${d.scheduledDate || ''}" class="flex-1 bg-transparent text-sm text-white focus:outline-none border border-gray-800 rounded-lg px-2 py-2">
                                    <input type="time" id="modal-task-time" value="${d.scheduledTime || ''}" class="w-24 bg-transparent text-sm text-white focus:outline-none border border-gray-800 rounded-lg px-2 py-2 text-center">
                                </div>
                            </div>

                            <div>
                                <label class="text-[10px] text-gray-500 uppercase font-bold">Durée</label>
                                <select id="modal-task-duration" class="w-full bg-[#0D0F12] rounded-xl px-3 py-3 text-sm text-gray-300 border border-gray-800 text-center focus:outline-none">
                                    ${AppState.settings.times.map(t => `<option value="${t}" ${d.duration == t ? 'selected' : ''}>${t}m</option>`).join('')}
                                </select>
                            </div>

                            <div>
                                <label class="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Filtres</label>
                                <div class="flex gap-2 flex-wrap">
                                    ${AppState.settings.locations.map(l => `<button type="button" onclick="App.toggleFormLocation(this)" data-loc="${l}" class="flex-1 min-w-[70px] py-2 rounded-xl text-xs font-bold ${dLocs.includes(l) ? 'loc-selected bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' : 'bg-[#0D0F12] text-gray-500 border border-transparent'}">${l}</button>`).join('')}
                                </div>
                            </div>

                            <div>
                                <label class="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Priorité</label>
                                <div class="flex gap-2 flex-wrap">
                                    ${['Basse','Moyenne','Haute','Urgence'].map(p => `<button type="button" onclick="App.selectModalPriority(this)" class="flex-1 py-2 min-w-[60px] rounded-xl text-xs font-bold transition-colors ${p === (d.priority || 'Moyenne') ? `modal-priority-selected ${p==='Urgence'?'bg-red-500/20 text-red-400 border-red-500/50' : p==='Haute'?'bg-purple-500/20 text-purple-400 border-purple-500/50' : p==='Moyenne'?'bg-amber-500/20 text-amber-400 border-amber-500/50' : 'bg-blue-500/20 text-blue-400 border-blue-500/50'}` : 'bg-[#0D0F12] text-gray-500 border border-transparent'}">${p}</button>`).join('')}
                                </div>
                            </div>

                            <div>
                                <label class="text-[10px] text-gray-500 uppercase font-bold">Notes</label>
                                <textarea id="modal-task-note" rows="2" class="w-full bg-[#0D0F12] rounded-xl px-4 py-3 text-white border border-gray-800 focus:border-cyan-500 focus:outline-none placeholder-gray-600" placeholder="Ajouter une note...">${d.note || ''}</textarea>
                            </div>

                            <div class="flex gap-3 pt-2 pb-6">
                                <button type="button" onclick="App.closeTaskModal()" class="flex-1 py-3 rounded-xl bg-[#0D0F12] text-white font-bold border border-gray-700">Annuler</button>
                                <button type="submit" class="flex-1 py-3 rounded-xl bg-cyan-500 text-black font-bold">Enregistrer</button>
                            </div>
                        </form>
                    </div>
                </div>`;
        } else if (AppState.activeMenu) {
            modalContainer.innerHTML = `<div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center pb-8 px-4" onclick="App.closeMenu()"><div class="bg-[#1A1D24] border border-gray-800 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl transform transition-all animate-slide-up" onclick="event.stopPropagation()"><div class="p-2 border-b border-gray-800/50"><button onclick="App.openEdit()" class="w-full text-left px-6 py-4 text-white font-bold hover:bg-[#1f232b] flex items-center gap-3"><i data-lucide="pencil" class="text-cyan-400 w-5 h-5"></i> Renommer</button><button onclick="App.openNote('${AppState.activeMenu.type}', '${AppState.activeMenu.id}')" class="w-full text-left px-6 py-4 text-white font-bold hover:bg-[#1f232b] flex items-center gap-3"><i data-lucide="file-text" class="text-amber-400 w-5 h-5"></i> Gérer la note</button><button onclick="App.openDelete()" class="w-full text-left px-6 py-4 text-red-500 font-bold hover:bg-[#1f232b] flex items-center gap-3"><i data-lucide="trash-2" class="w-5 h-5"></i> Supprimer</button></div><div class="p-2"><button onclick="App.closeMenu()" class="w-full text-center px-6 py-4 text-gray-500 font-bold hover:bg-[#1f232b] rounded-2xl">Annuler</button></div></div></div>`;
        } else if (AppState.notePrompt) {
            if (AppState.notePrompt.mode === 'view') {
                modalContainer.innerHTML = `
                <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center px-4" onclick="App.closeNote()">
                    <div class="bg-[#1A1D24] border border-gray-800 w-full max-w-md rounded-3xl p-6 shadow-2xl transform transition-all animate-slide-up" onclick="event.stopPropagation()">
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="text-xl font-bold text-white flex items-center gap-2"><i data-lucide="file-text" class="text-amber-400"></i> Note</h3>
                            <button onclick="App.closeNote()" class="text-gray-500 hover:text-white transition-colors p-1"><i data-lucide="x" class="w-5 h-5"></i></button>
                        </div>
                        <div class="bg-[#0D0F12] rounded-xl p-4 border border-gray-800 text-gray-300 text-sm whitespace-pre-wrap max-h-[50vh] overflow-y-auto mb-6 shadow-inner">
                            ${AppState.notePrompt.note}
                        </div>
                        <div class="flex gap-3">
                            <button onclick="App.deleteNote()" class="flex-1 py-3 rounded-xl bg-red-500/10 text-red-500 font-bold border border-red-500/30 hover:bg-red-500 hover:text-white transition-colors">Supprimer</button>
                            <button onclick="App.editNote()" class="flex-1 py-3 rounded-xl bg-amber-500 text-black font-bold hover:bg-amber-400 transition-colors shadow-[0_0_15px_rgba(245,158,11,0.2)]">Modifier</button>
                        </div>
                    </div>
                </div>`;
            } else {
                modalContainer.innerHTML = `
                <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center pb-8 px-4" onclick="App.closeNote()">
                    <div class="bg-[#1A1D24] border border-gray-800 w-full max-w-md rounded-3xl p-6 shadow-2xl transform transition-all animate-slide-up" onclick="event.stopPropagation()">
                        <h3 class="text-xl font-bold text-white mb-4 flex items-center gap-2"><i data-lucide="file-text" class="text-amber-400"></i> ${AppState.notePrompt.note ? 'Modifier la note' : 'Nouvelle note'}</h3>
                        <form onsubmit="App.saveNote(event)" class="space-y-4">
                            <textarea id="edit-note-text" rows="6" class="w-full bg-[#0D0F12] rounded-xl px-4 py-3 text-white border border-gray-800 focus:border-amber-500 focus:outline-none placeholder-gray-600">${AppState.notePrompt.note}</textarea>
                            <div class="flex gap-3 mt-4">
                                <button type="button" onclick="${AppState.notePrompt.note ? 'App.openNote(AppState.notePrompt.type, AppState.notePrompt.id, AppState.notePrompt.parentId)' : 'App.closeNote()'}" class="flex-1 py-3 rounded-xl bg-[#0D0F12] text-white font-bold border border-gray-700">Annuler</button>
                                <button type="submit" class="flex-1 py-3 rounded-xl bg-amber-500 text-black font-bold hover:bg-amber-400 transition-colors shadow-[0_0_15px_rgba(245,158,11,0.2)]">Enregistrer</button>
                            </div>
                        </form>
                    </div>
                </div>`;
            }
            } else if (AppState.editPrompt) {
            const d = AppState.editPrompt.data; const dCatId = d.categoryId || '';
            modalContainer.innerHTML = `
                <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center pb-8 px-4" onclick="App.closeEdit()">
                    <div class="bg-[#1A1D24] border border-gray-800 w-full max-w-md rounded-3xl p-6 shadow-2xl transform transition-all animate-slide-up" onclick="event.stopPropagation()">
                        <h3 class="text-xl font-bold text-white mb-4">Modifier</h3>
                        <form onsubmit="App.saveEdit(event)" class="space-y-4">
                            <input type="text" id="edit-name" value="${d.name.replace(/"/g, '&quot;')}" required class="w-full bg-[#0D0F12] rounded-xl px-4 py-3 text-white border border-gray-800 focus:border-cyan-500 focus:outline-none">
                            ${AppState.editPrompt.type === 'project' ? `<select id="edit-proj-category" class="w-full bg-[#0D0F12] rounded-xl px-3 py-3 text-sm text-gray-300 border border-gray-800 focus:outline-none"><option value="">Dossier : Aucun</option>${AppState.categories.map(c => `<option value="${c.id}" ${c.id === dCatId ? 'selected' : ''}>${c.name}</option>`).join('')}</select>` : ''}
                            <div class="flex gap-3 mt-6 pt-2"><button type="button" onclick="App.closeEdit()" class="flex-1 py-3 rounded-xl bg-[#0D0F12] text-white font-bold border border-gray-700">Annuler</button><button type="submit" class="flex-1 py-3 rounded-xl bg-cyan-500 text-black font-bold">Enregistrer</button></div>
                        </form>
                    </div>
                </div>`;
        } else if (AppState.deletePrompt) {
            let typeName = AppState.deletePrompt.type === 'category' ? 'ce dossier (les projets à l\'intérieur iront dans "Sans dossier")' : 'ce projet';
            modalContainer.innerHTML = `<div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center pb-8 px-4" onclick="App.cancelDelete()"><div class="bg-[#1A1D24] border border-gray-800 w-full max-w-md rounded-3xl p-6 shadow-2xl transform transition-all animate-slide-up" onclick="event.stopPropagation()"><div class="w-12 h-1.5 bg-gray-700 rounded-full mx-auto mb-6"></div><h3 class="text-xl font-bold text-white mb-2 flex items-center gap-2"><i data-lucide="trash-2" class="text-red-500"></i> Supprimer ${typeName} ?</h3><p class="text-gray-400 text-sm mb-8">Cette action est définitive.</p><div class="flex gap-3"><button onclick="App.cancelDelete()" class="flex-1 py-4 rounded-xl bg-[#0D0F12] text-white font-bold border border-gray-700">Annuler</button><button onclick="App.confirmDelete()" class="flex-1 py-4 rounded-xl bg-red-500/10 text-red-500 font-bold border border-red-500/50">Supprimer</button></div></div></div>`;
        } else { 
            modalContainer.innerHTML = ''; 
        }
        
        const tabs=[
            {id:'home',color:'text-cyan-400'},
            {id:'calendar',color:'text-amber-400'},
            {id:'projects',color:'text-indigo-400'},
            {id:'settings',color:'text-gray-200'}
        ];
        
        tabs.forEach(tab=>{
            const btn=document.getElementById('nav-'+tab.id);
            if(btn) btn.className=`flex flex-col items-center gap-1 transition-all ${AppState.activeTab===tab.id?tab.color:'text-gray-500'}`;
        });
        lucide.createIcons();
    },
    
    async init() {
        const header = document.querySelector('header');
        const container = document.getElementById('app-container');
        if (header && container) {
            header.style.display = 'none';
            container.classList.remove('pt-12');
            container.classList.add('pt-4');
        }

        document.getElementById('app-content').innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-cyan-500">
                <i data-lucide="cloud-cog" class="w-12 h-12 animate-pulse mb-4"></i>
                <span class="text-sm font-bold tracking-widest uppercase">Connexion...</span>
            </div>
        `;
        lucide.createIcons();

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
                        AppState.bufferPercent = data.bufferPercent || 85;
                    } else {
                        await this.saveToCloud();
                    }
                } catch (e) {
                    console.error("Mode hors-ligne, utilisation des données locales de secours.", e);
                }
                
                this.checkMissedTasks();

                const lastSeenVersion = localStorage.getItem('osdevie_last_seen_version');
                if (lastSeenVersion !== APP_VERSION) {
                    AppState.lastSeenVersion = lastSeenVersion;
                    AppState.updateModalMode = 'unseen';
                    AppState.showUpdateModal = true;
                    localStorage.setItem('osdevie_last_seen_version', APP_VERSION);
                }

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
window.onload = () => App.init();
