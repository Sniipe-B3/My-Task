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
// 1. CONFIGURATION DES MISES À JOUR (MODIFIE ICI)
// ==========================================
const APP_VERSION = "1.6.4";
const RELEASE_NOTES = `
<b>V1.6.4 - Changement de Nom & UI</b><br>
• 🏷️ OS de Vie devient officiellement <b>My Task</b> !<br>
• 👁️ L'œil du mot de passe n'efface plus le texte tapé.<br>
• 🧹 Nettoyage de l'interface (Paramètres et Action).<br>
<br>
<i>V1.6.3 - PWA Plein Écran</i><br>
• 📱 L'application s'installe nativement sur l'écran d'accueil sans barre de recherche (Plus d'erreur 500).<br>
<br>
<i>V1.6.2 - Confort</i><br>
• 👀 Bouton pour afficher/masquer le mot de passe.<br>
• 📢 Fenêtre des nouveautés au démarrage.<br>
<br>
<i>V1.6.1 - Oubli de MDP</i><br>
• 🔒 Ajout de la réinitialisation par email.<br>
<br>
<i>V1.6.0 - Sécurité</i><br>
• ☁️ Synchronisation Cloud via compte privé Firebase.
`;

// ==========================================
// 2. DONNÉES INITIALES 
// ==========================================
const getDefaultSettings = () => ({ times: [15, 30, 60, 120], locations: ['Maison', 'Boulot', 'Ordi', 'Jardin'] });
const getDefaultCategories = () => ([{ id: 'c1', name: 'Business', note: '' }, { id: 'c2', name: 'Famille', note: '' }]);

// ==========================================
// 3. ÉTAT GLOBAL DE L'APPLICATION
// ==========================================
const AppState = {
    currentUser: null, 
    authMode: 'login', 
    authError: '',
    authMessage: '', 
    showPassword: false, 

    activeTab: 'planning',
    settings: getDefaultSettings(),
    categories: [],
    projects: [],
    tasks: [],
    availabilities: [],
    draftSchedule: null,
    validatedSchedule: null,
    bufferPercent: 85,
    daysOfWeek: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'],

    isEditingSchedule: false, 
    homeTime: 30, homeLocations: [], homeSuggestions: [], homeSearched: false,
    expandedCategoryIds: [], 
    expandedProjectId: null, 
    showAddProject: false, showAddCategory: false,
    showProjectAddTaskModal: null, showProjectAddSubtaskModal: null,
    
    activeMenu: null, deletePrompt: null, editPrompt: null, notePrompt: null,
    taskModal: null,
    showUpdateModal: false
};

// ==========================================
// 4. MOTEUR DE L'APPLICATION
// ==========================================
const App = {
    lastTapTime: 0,
    
    // --- AUTHENTIFICATION ---
    async handleAuth(event) {
        event.preventDefault();
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        AppState.authError = '';
        AppState.authMessage = '';
        this.render();

        try {
            if (AppState.authMode === 'login') {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                await createUserWithEmailAndPassword(auth, email, password);
                AppState.settings = getDefaultSettings();
                AppState.categories = getDefaultCategories();
                AppState.projects = [];
                AppState.tasks = [];
                await this.saveToCloud();
            }
        } catch (error) {
            console.error("Auth error:", error);
            AppState.authError = error.message.includes('invalid-credential') || error.message.includes('user-not-found') || error.message.includes('wrong-password') 
                ? "Email ou mot de passe incorrect." 
                : (error.message.includes('email-already-in-use') ? "Cet email est déjà utilisé." : "Erreur de connexion.");
            this.render();
        }
    },

    toggleAuthMode() {
        AppState.authMode = AppState.authMode === 'login' ? 'register' : 'login';
        AppState.authError = '';
        AppState.authMessage = '';
        AppState.showPassword = false;
        this.render();
    },

    togglePasswordVisibility() {
        AppState.showPassword = !AppState.showPassword;
        // Manipulation directe du DOM pour ne pas effacer le champ en rechargeant tout l'écran
        const pwdInput = document.getElementById('auth-password');
        const btn = document.getElementById('toggle-pwd-btn');
        if (pwdInput) {
            pwdInput.type = AppState.showPassword ? 'text' : 'password';
        }
        if (btn) {
            btn.innerHTML = `<i data-lucide="${AppState.showPassword ? 'eye-off' : 'eye'}" class="w-5 h-5"></i>`;
            lucide.createIcons();
        }
    },

    async resetPassword() {
        const email = document.getElementById('auth-email').value.trim();
        if (!email) {
            AppState.authError = "Veuillez taper votre adresse email d'abord.";
            AppState.authMessage = '';
            this.render();
            return;
        }
        try {
            await sendPasswordResetEmail(auth, email);
            AppState.authError = '';
            AppState.authMessage = "Email de réinitialisation envoyé ! Vérifiez vos spams.";
            this.render();
        } catch (error) {
            AppState.authMessage = '';
            AppState.authError = error.message.includes('user-not-found') || error.message.includes('invalid-email') 
                ? "Aucun compte trouvé avec cet email." : "Erreur lors de l'envoi de l'email.";
            this.render();
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
            categories: AppState.categories,
            projects: AppState.projects,
            tasks: AppState.tasks,
            settings: AppState.settings,
            availabilities: AppState.availabilities,
            draftSchedule: AppState.draftSchedule,
            validatedSchedule: AppState.validatedSchedule,
            bufferPercent: AppState.bufferPercent
        };
        try {
            await setDoc(doc(db, "users", AppState.currentUser.uid), dataToSave);
        } catch (e) {
            console.error("Erreur de sauvegarde Cloud:", e);
        }
    },

    save() {
        this.render();
        this.saveToCloud();
    },
    
    setTab(tab) { AppState.activeTab = tab; this.render(); },

    // --- GESTION DES NOUVEAUTÉS ---
    openUpdateModal() { AppState.showUpdateModal = true; this.render(); },
    closeUpdateModal() { AppState.showUpdateModal = false; this.render(); },

    // --- GESTION DES PARAMÈTRES ---
    addSetting(type, inputId) {
        const input = document.getElementById(inputId);
        let val = input.value.trim();
        if (!val) return;
        if (type === 'times') { val = parseInt(val); if (isNaN(val) || val <= 0) return; }
        if (!AppState.settings[type].includes(val)) {
            AppState.settings[type].push(val);
            if (type === 'times') AppState.settings[type].sort((a,b) => a - b);
            this.save();
        }
        input.value = '';
    },
    
    removeSetting(type, val) {
        AppState.settings[type] = AppState.settings[type].filter(item => item !== val);
        if (type === 'times' && AppState.homeTime === val) AppState.homeTime = AppState.settings.times[0] || 0;
        if (type === 'locations') AppState.homeLocations = AppState.homeLocations.filter(l => l !== val);
        this.save();
    },

    setBufferPercent(val) { AppState.bufferPercent = parseInt(val); this.save(); },

    // --- GESTION DES DOSSIERS ---
    addCategory() {
        const name = document.getElementById('new-cat-name').value;
        if (!name.trim()) return;
        AppState.categories.push({ id: 'c_' + Date.now(), name, note: '' });
        AppState.showAddCategory = false;
        this.save();
    },

    toggleCategoryExpand(id) {
        if (AppState.expandedCategoryIds.includes(id)) {
            AppState.expandedCategoryIds = AppState.expandedCategoryIds.filter(cId => cId !== id);
        } else {
            AppState.expandedCategoryIds.push(id);
        }
        this.render();
    },

    // --- FICHE TÂCHE UNIFIÉE (MODAL) ---
    openNewTaskModal(projectId = null) {
        AppState.taskModal = { 
            id: Date.now().toString(), parentId: null, isNew: true,
            data: { name: '', projectId: projectId, duration: 15, locations: [], priority: 'Moyenne', note: '' } 
        };
        this.render();
    },

    openNewSubtaskModal(parentId) {
        AppState.taskModal = { 
            id: Date.now().toString(), parentId: parentId, isNew: true,
            data: { name: '', duration: 15, locations: [], priority: 'Moyenne', note: '' } 
        };
        this.render();
    },

    openTaskModal(id, parentId = null) {
        let itemData = {};
        if (parentId) {
            itemData = AppState.tasks.find(t => t.id === parentId).subtasks.find(s => s.id === id);
        } else {
            itemData = AppState.tasks.find(t => t.id === id);
        }
        AppState.taskModal = { id, parentId, isNew: false, data: JSON.parse(JSON.stringify(itemData)) };
        this.render();
    },
    
    closeTaskModal() { AppState.taskModal = null; this.render(); },
    
    saveTaskModal(event) {
        event.preventDefault();
        const form = event.target;
        const { id, parentId, isNew } = AppState.taskModal;
        const name = document.getElementById('modal-task-name').value;
        const duration = parseInt(document.getElementById('modal-task-duration').value);
        const locations = this.getFormLocations(form);
        const note = document.getElementById('modal-task-note').value;
        const priorityBtn = form.querySelector('.modal-priority-selected');
        const priority = priorityBtn ? priorityBtn.innerText.trim() : 'Moyenne';

        if (parentId) { 
            AppState.tasks = AppState.tasks.map(t => {
                if (t.id === parentId) {
                    if (isNew) {
                        return { ...t, subtasks: [...(t.subtasks || []), { id, name, duration, locations, priority, note, status: 'todo' }] };
                    } else {
                        return { ...t, subtasks: t.subtasks.map(s => s.id === id ? { ...s, name, duration, locations, priority, note } : s) };
                    }
                }
                return t;
            });
        } else { 
            const projectId = document.getElementById('modal-task-project').value || null;
            if (isNew) {
                AppState.tasks.unshift({ id, name, projectId, duration, locations, priority, note, status: 'todo', subtasks: [] });
            } else {
                AppState.tasks = AppState.tasks.map(t => t.id === id ? { ...t, name, projectId, duration, locations, priority, note } : t);
            }
        }
        
        AppState.taskModal = null;
        this.save();
    },

    deleteFromTaskModal() {
        const { id, parentId } = AppState.taskModal;
        if (confirm("Supprimer définitivement cette tâche ?")) {
            if (parentId) { AppState.tasks = AppState.tasks.map(t => t.id === parentId ? { ...t, subtasks: t.subtasks.filter(s => s.id !== id) } : t); } 
            else { AppState.tasks = AppState.tasks.filter(t => t.id !== id); }
            AppState.taskModal = null;
            this.save();
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
    
    openNote(type, id) {
        let itemData = type === 'category' ? AppState.categories.find(c => c.id === id) : AppState.projects.find(p => p.id === id);
        AppState.notePrompt = { type, id, parentId: null, note: itemData.note || '' };
        AppState.activeMenu = null; this.render();
    },
    closeNote() { AppState.notePrompt = null; this.render(); },
    
    saveNote(event) {
        event.preventDefault();
        const { type, id } = AppState.notePrompt;
        const noteText = document.getElementById('edit-note-text').value;
        if (type === 'category') AppState.categories = AppState.categories.map(c => c.id === id ? { ...c, note: noteText } : c);
        else if (type === 'project') AppState.projects = AppState.projects.map(p => p.id === id ? { ...p, note: noteText } : p);
        AppState.notePrompt = null; this.save();
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
        if (btn.classList.contains('loc-selected')) {
            btn.classList.replace('bg-[#0D0F12]', 'bg-emerald-500/20'); btn.classList.replace('text-gray-500', 'text-emerald-400'); btn.classList.replace('border-transparent', 'border-emerald-500/50');
        } else {
            btn.classList.replace('bg-emerald-500/20', 'bg-[#0D0F12]'); btn.classList.replace('text-emerald-400', 'text-gray-500'); btn.classList.replace('border-emerald-500/50', 'border-transparent');
        }
    },
    getFormLocations(form) { return Array.from(form.querySelectorAll('.loc-selected')).map(b => b.getAttribute('data-loc')); },

    applyPriorityStyle(btn, className) {
        btn.parentElement.querySelectorAll('button').forEach(b => { 
            b.className = "flex-1 py-2 min-w-[60px] rounded-xl text-xs font-bold bg-[#0D0F12] text-gray-500 border border-transparent transition-colors";
        });
        const p = btn.innerText.trim();
        let colors = p === 'Urgence' ? 'bg-red-500/20 text-red-400 border-red-500/50' : 
                     p === 'Haute' ? 'bg-purple-500/20 text-purple-400 border-purple-500/50' : 
                     p === 'Moyenne' ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' : 
                     'bg-blue-500/20 text-blue-400 border-blue-500/50';
        
        btn.className = `flex-1 py-2 min-w-[60px] rounded-xl text-xs font-bold border transition-colors ${className} ${colors}`;
    },

    selectBankPriority(btn){ this.applyPriorityStyle(btn, 'priority-btn-selected'); },
    selectModalPriority(btn) { this.applyPriorityStyle(btn, 'modal-priority-selected'); },
    
    // --- ACTIONS TÂCHES ET PROJETS ---
    toggleTask(taskId){ AppState.tasks=AppState.tasks.map(t=>t.id===taskId ? {...t,status:t.status==='todo'?'done':'todo'} : t); if(AppState.homeSearched) this.generateAction(); this.save(); },
    toggleSubtask(taskId,subtaskId){ AppState.tasks=AppState.tasks.map(t=>t.id===taskId ? {...t,subtasks:t.subtasks.map(s=>s.id===subtaskId ? {...s,status:s.status==='todo'?'done':'todo'} : s)} : t); this.save(); },
    
    addProjectTask(projectId){
        const input = document.getElementById(`project-quick-task-${projectId}`); if(!input || !input.value.trim()) return;
        AppState.tasks.unshift({id:Date.now().toString(), name:input.value, projectId:projectId, duration:15, locations:[], priority:'Moyenne', status:'todo', subtasks:[], note:''});
        AppState.showProjectAddTaskModal = null; this.save();
    },
    addSubtask(taskId){
        const input = document.getElementById(`task-quick-subtask-${taskId}`); if(!input || !input.value.trim()) return;
        AppState.tasks = AppState.tasks.map(t => t.id === taskId ? {...t, subtasks: [...(t.subtasks||[]), {id: Date.now().toString(), name:input.value, duration: 15, locations: [], priority: 'Moyenne', status: 'todo', note: ''}]} : t);
        AppState.showProjectAddSubtaskModal = null; this.save();
    },
    addProject(){
        const name=document.getElementById('new-proj-name').value; if(!name.trim()) return;
        AppState.projects.push({id:Date.now().toString(), name, categoryId:document.getElementById('new-proj-category').value || null, note:''});
        AppState.showAddProject=false; this.save();
    },

    // --- NAVIGATION DANS LES VUES ---
    handleRowTap(projectId) {
        if (!projectId || projectId === 'null' || projectId === 'undefined') return;
        const now = new Date().getTime();
        if (now - this.lastTapTime < 300) this.goToProject(projectId);
        this.lastTapTime = now;
    },
    goToProject(projectId) { 
        AppState.expandedProjectId = projectId;
        const proj = AppState.projects.find(p => p.id === projectId);
        if (proj && proj.categoryId && !AppState.expandedCategoryIds.includes(proj.categoryId)) {
            AppState.expandedCategoryIds.push(proj.categoryId);
        }
        this.setTab('projects'); 
    },
    toggleProjectExpand(id) { AppState.expandedProjectId = AppState.expandedProjectId === id ? null : id; this.render(); },
    toggleAddProject() { AppState.showAddProject = !AppState.showAddProject; this.render(); },
    toggleAddCategory() { AppState.showAddCategory = !AppState.showAddCategory; this.render(); },
    setHomeTime(time) { AppState.homeTime=time; this.render(); },
    toggleHomeLocation(loc) { AppState.homeLocations.includes(loc) ? AppState.homeLocations = AppState.homeLocations.filter(l => l !== loc) : AppState.homeLocations.push(loc); this.render(); },

    // --- DRAG & DROP ---
    handleDragStart(e, id, type, parentId = null) { e.dataTransfer.setData('text/plain', JSON.stringify({id, type, parentId})); e.currentTarget.classList.add('dragging'); },
    handleDragEnd(e) { e.currentTarget.classList.remove('dragging'); document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over')); },
    handleDragOver(e) { e.preventDefault(); e.currentTarget.classList.add('drag-over'); },
    handleDragLeave(e) { e.currentTarget.classList.remove('drag-over'); },
    
    handleCategoryDragOver(e) { e.preventDefault(); e.currentTarget.classList.add('border-indigo-500'); },
    handleCategoryDragLeave(e) { e.currentTarget.classList.remove('border-indigo-500'); },
    handleCategoryDrop(e, catId) {
        e.preventDefault(); e.currentTarget.classList.remove('border-indigo-500');
        try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            if (data.type === 'project') {
                AppState.projects = AppState.projects.map(p => p.id === data.id ? {...p, categoryId: catId === 'null' ? null : catId} : p);
                this.save();
            }
        } catch(err) { console.error(err); }
    },

    handleDrop(e, targetId, type, parentId = null) {
        e.preventDefault(); e.currentTarget.classList.remove('drag-over');
        try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain')); if (data.type !== type) return;
            if (type === 'task') {
                const oldIndex = AppState.tasks.findIndex(t => t.id === data.id); const newIndex = AppState.tasks.findIndex(t => t.id === targetId);
                if (oldIndex !== -1 && newIndex !== -1) { const [moved] = AppState.tasks.splice(oldIndex, 1); AppState.tasks.splice(newIndex, 0, moved); this.save(); }
            } else if (type === 'subtask' && data.parentId === parentId) {
                AppState.tasks = AppState.tasks.map(t => {
                    if (t.id === parentId) {
                        const subs = [...t.subtasks]; const oldIndex = subs.findIndex(s => s.id === data.id); const newIndex = subs.findIndex(s => s.id === targetId);
                        if (oldIndex !== -1 && newIndex !== -1) { const [moved] = subs.splice(oldIndex, 1); subs.splice(newIndex, 0, moved); } return {...t, subtasks: subs};
                    } return t;
                }); this.save();
            }
        } catch(err) { console.error(err); }
    },

    handleScheduleDragStart(e, taskId, slotId) { e.dataTransfer.setData('text/plain', JSON.stringify({id: taskId, type: 'schedule-task', sourceSlot: slotId})); e.currentTarget.classList.add('opacity-50'); },
    handleScheduleDragEnd(e) { e.currentTarget.classList.remove('opacity-50'); },
    handleDraftDragStart(e, taskId, slotId) { e.dataTransfer.setData('text/plain', JSON.stringify({id: taskId, type: 'draft-task', sourceSlot: slotId})); e.currentTarget.classList.add('opacity-50'); },
    handleDraftDragEnd(e) { e.currentTarget.classList.remove('opacity-50'); },
    
    handleSlotDragOver(e) { e.preventDefault(); e.currentTarget.classList.add('border-cyan-500'); },
    handleSlotDragLeave(e) { e.currentTarget.classList.remove('border-cyan-500'); },
    handleSlotDrop(e, targetSlotId, isDraftMode) {
        e.preventDefault(); e.currentTarget.classList.remove('border-cyan-500');
        try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            if ((isDraftMode && data.type !== 'draft-task') || (!isDraftMode && data.type !== 'schedule-task')) return;
            if (data.sourceSlot === targetSlotId) return;

            const scheduleArray = isDraftMode ? AppState.draftSchedule : AppState.validatedSchedule;
            const sourceSlot = scheduleArray.find(s => s.slotId === data.sourceSlot);
            const targetSlot = scheduleArray.find(s => s.slotId === targetSlotId);
            const taskIndex = sourceSlot.tasks.findIndex(t => t.id === data.id);
            
            if (taskIndex !== -1) {
                const [task] = sourceSlot.tasks.splice(taskIndex, 1);
                targetSlot.tasks.push(task);
                sourceSlot.usedTime -= task.duration; targetSlot.usedTime += task.duration;
                this.save();
            }
        } catch(err) { console.error(err); }
    },

    handleTaskDragOver(e) { e.preventDefault(); e.stopPropagation(); e.currentTarget.style.borderTop = "2px solid #06b6d4"; },
    handleTaskDragLeave(e) { e.currentTarget.style.borderTop = ""; },
    handleTaskItemDrop(e, targetSlotId, targetTaskId) {
        e.preventDefault(); e.stopPropagation(); e.currentTarget.style.borderTop = "";
        try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            const isDraft = data.type === 'draft-task';
            if (data.type !== 'schedule-task' && !isDraft) return;

            const scheduleArray = isDraft ? AppState.draftSchedule : AppState.validatedSchedule;
            const sourceSlot = scheduleArray.find(s => s.slotId === data.sourceSlot);
            const targetSlot = scheduleArray.find(s => s.slotId === targetSlotId);
            
            const taskIndex = sourceSlot.tasks.findIndex(t => t.id === data.id);
            if (taskIndex !== -1) {
                const [task] = sourceSlot.tasks.splice(taskIndex, 1);
                const targetTaskIndex = targetSlot.tasks.findIndex(t => t.id === targetTaskId);
                
                if (targetTaskIndex !== -1) { targetSlot.tasks.splice(targetTaskIndex, 0, task); } 
                else { targetSlot.tasks.push(task); }
                
                if (sourceSlot.slotId !== targetSlot.slotId) {
                    sourceSlot.usedTime -= task.duration; targetSlot.usedTime += task.duration;
                }
                this.save();
            }
        } catch(err) { console.error(err); }
    },

    // --- ALGORITHMES (ACTION & PLANNING) ---
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
                        const numSub = parseInt(s.name);
                        let blockedByPrevSub = false;
                        if (!isNaN(numSub) && numSub > 1) {
                            blockedByPrevSub = t.subtasks.some(otherS => parseInt(otherS.name) === (numSub - 1) && otherS.status !== 'done');
                        }
                        
                        if (!blockedByPrevSub && s.duration <= AppState.homeTime) {
                            let matchLoc = true;
                            if (AppState.homeLocations.length > 0) matchLoc = (!s.locations || s.locations.length === 0) ? false : s.locations.some(l => AppState.homeLocations.includes(l));
                            if (matchLoc) allAvailable.push({ ...s, isSubtask: true, parentId: t.id, parentName: t.name, projectId: t.projectId });
                        }
                    }
                });
            }
            if (!hasActiveSubtasks && t.status !== 'done') {
                const numTask = parseInt(t.name);
                let blockedByPrevTask = false;
                if (!isNaN(numTask) && numTask > 1) {
                    blockedByPrevTask = AppState.tasks.some(otherT => otherT.projectId === t.projectId && parseInt(otherT.name) === (numTask - 1) && otherT.status !== 'done');
                }
                
                if (!blockedByPrevTask && t.duration <= AppState.homeTime) {
                    let matchLoc = true;
                    if (AppState.homeLocations.length > 0) matchLoc = (!t.locations || t.locations.length === 0) ? false : t.locations.some(l => AppState.homeLocations.includes(l));
                    if (matchLoc) allAvailable.push({ ...t, isSubtask: false, projectId: t.projectId });
                }
            }
        });
        
        allAvailable.sort((a,b)=> {
            const pA = priorityWeights[a.priority || 'Moyenne']; 
            const pB = priorityWeights[b.priority || 'Moyenne']; 
            if (pA !== pB) return pB - pA; 
            
            const dA = a.duration || 15; 
            const dB = b.duration || 15; 
            if (dA !== dB) return dB - dA; 
            
            if (a.isSubtask && !b.isSubtask) return -1; 
            if (!a.isSubtask && b.isSubtask) return 1; 
            return 0;
        });
        
        AppState.homeSuggestions = allAvailable.slice(0,5); AppState.homeSearched=true; this.render();
    },

    addAvailability(event) {
        event.preventDefault();
        const form = event.target;
        const day = document.getElementById('plan-day').value;
        const start = document.getElementById('plan-start').value;
        const end = document.getElementById('plan-end').value;
        const locations = this.getFormLocations(form);
        const [startH, startM] = start.split(':').map(Number);
        const [endH, endM] = end.split(':').map(Number);
        let duration = (endH * 60 + endM) - (startH * 60 + startM);
        if (duration <= 0) duration += 24 * 60;
        AppState.availabilities.push({ id: Date.now().toString(), day, start, end, duration, locations });
        this.save();
    },

    removeAvailability(id) { AppState.availabilities = AppState.availabilities.filter(a => a.id !== id); this.save(); },

    generateSchedule() {
        const priorityWeights={'Urgence':4, 'Haute':3,'Moyenne':2,'Basse':1};
        let availableTasks = this.getFlatActiveTasks();
        availableTasks.sort((a,b) => {
            if (a.projectId && a.projectId === b.projectId) {
                const numA = parseInt(a.name); const numB = parseInt(b.name);
                if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB; 
            }
            const pA = priorityWeights[a.priority || 'Moyenne']; const pB = priorityWeights[b.priority || 'Moyenne'];
            if (pA !== pB) return pB - pA;
            return (b.duration || 15) - (a.duration || 15);
        });

        let newSchedule = [];
        let usedTaskIds = new Set();

        AppState.availabilities.forEach(slot => {
            const maxTime = Math.floor(slot.duration * (AppState.bufferPercent / 100));
            let currentUsedTime = 0; let slotTasks = [];

            for (let i = 0; i < availableTasks.length; i++) {
                const task = availableTasks[i];
                const numTask = parseInt(task.name);
                if (!isNaN(numTask) && numTask > 1) {
                    const prevTask = availableTasks.find(t => t.projectId === task.projectId && parseInt(t.name) === (numTask - 1));
                    if (prevTask && !usedTaskIds.has(prevTask.id)) continue; 
                }

                if (!usedTaskIds.has(task.id) && (currentUsedTime + task.duration) <= maxTime) {
                    let matchLoc = true;
                    if (slot.locations && slot.locations.length > 0) { matchLoc = (!task.locations || task.locations.length === 0) ? false : task.locations.some(l => slot.locations.includes(l)); }
                    if (matchLoc) { slotTasks.push(task); currentUsedTime += task.duration; usedTaskIds.add(task.id); }
                }
            }
            newSchedule.push({ slotId: slot.id, day: slot.day, start: slot.start, end: slot.end, totalDuration: slot.duration, usedTime: currentUsedTime, tasks: slotTasks });
        });
        AppState.validatedSchedule = null; AppState.draftSchedule = newSchedule; this.save();
    },

    replaceScheduledTask(slotId, taskId) {
        const scheduleSlot = AppState.draftSchedule.find(s => s.slotId === slotId);
        const slotAvailability = AppState.availabilities.find(a => a.id === slotId);
        const taskIndex = scheduleSlot.tasks.findIndex(t => t.id === taskId);
        const oldTask = scheduleSlot.tasks[taskIndex];
        
        let usedTaskIds = new Set();
        AppState.draftSchedule.forEach(s => s.tasks.forEach(t => usedTaskIds.add(t.id)));
        usedTaskIds.delete(oldTask.id); 
        
        const timeRemaining = (scheduleSlot.totalDuration * (AppState.bufferPercent / 100)) - (scheduleSlot.usedTime - oldTask.duration);
        let availableTasks = this.getFlatActiveTasks();
        
        let replacement = null;
        for (let task of availableTasks) {
            if (!usedTaskIds.has(task.id) && task.id !== oldTask.id && task.duration <= timeRemaining) {
                let matchLoc = true;
                if (slotAvailability.locations && slotAvailability.locations.length > 0) matchLoc = (!task.locations || task.locations.length === 0) ? false : task.locations.some(l => slotAvailability.locations.includes(l));
                if (matchLoc) { replacement = task; break; }
            }
        }

        if (replacement) {
            scheduleSlot.tasks[taskIndex] = replacement;
            scheduleSlot.usedTime = (scheduleSlot.usedTime - oldTask.duration) + replacement.duration;
            this.save();
        } else {
            alert("Aucune autre tâche trouvée pour remplacer celle-ci dans le temps imparti et ce lieu.");
        }
    },

    toggleEditSchedule() { AppState.isEditingSchedule = !AppState.isEditingSchedule; this.render(); },

    removeTaskFromSchedule(slotId, taskId) {
        const slot = AppState.validatedSchedule.find(s => s.slotId === slotId);
        const taskIndex = slot.tasks.findIndex(t => t.id === taskId);
        if (taskIndex !== -1) {
            const task = slot.tasks[taskIndex];
            slot.tasks.splice(taskIndex, 1);
            slot.usedTime -= task.duration;
            this.save();
        }
    },

    removeTaskFromDraft(slotId, taskId) {
        const slot = AppState.draftSchedule.find(s => s.slotId === slotId);
        const taskIndex = slot.tasks.findIndex(t => t.id === taskId);
        if (taskIndex !== -1) {
            const task = slot.tasks[taskIndex];
            slot.tasks.splice(taskIndex, 1);
            slot.usedTime -= task.duration;
            this.save();
        }
    },

    validateSchedule() { AppState.validatedSchedule = AppState.draftSchedule; AppState.draftSchedule = null; AppState.isEditingSchedule = false; this.save(); },
    resetSchedule() { AppState.validatedSchedule = null; AppState.draftSchedule = null; AppState.isEditingSchedule = false; this.save(); },

    // ==========================================
    // 5. RENDU VISUEL (HTML COMPONENTS)
    // ==========================================
    renderAuth() {
        return `
        <div class="flex flex-col items-center justify-center min-h-screen px-6 bg-[#0D0F12]">
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
                    <div class="relative">
                        <input type="${AppState.showPassword ? 'text' : 'password'}" id="auth-password" placeholder="Mot de passe" required class="w-full bg-[#0D0F12] rounded-xl px-4 py-3 text-white border border-gray-800 focus:border-cyan-500 focus:outline-none pr-12">
                        <button type="button" id="toggle-pwd-btn" onclick="App.togglePasswordVisibility()" class="absolute right-4 top-3.5 text-gray-500 hover:text-cyan-400 focus:outline-none">
                            <i data-lucide="${AppState.showPassword ? 'eye-off' : 'eye'}" class="w-5 h-5"></i>
                        </button>
                    </div>
                    ${AppState.authMode === 'login' ? `<button type="button" onclick="App.resetPassword()" class="text-[10px] text-gray-500 hover:text-cyan-400 mt-2 block w-full text-right transition-colors">Mot de passe oublié ?</button>` : ''}
                    <button type="submit" class="w-full py-3 mt-4 rounded-xl bg-cyan-500 text-black font-bold uppercase hover:bg-cyan-400 transition-colors shadow-[0_0_15px_rgba(6,182,212,0.3)]">
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

    renderTask(task, minimal=false, parentId=null, parentName=null){
        const isDone = task.status === 'done'; const isSubtask = parentId !== null; const type = isSubtask ? 'subtask' : 'task';
        const argParent = isSubtask ? `, '${parentId}'` : '';
        const priorityColors = {'Urgence':'text-red-400 bg-red-500/10 border-red-500/30', 'Haute':'text-purple-400 bg-purple-500/10 border-purple-500/30','Moyenne':'text-amber-400 bg-amber-500/10 border-amber-500/30','Basse':'text-blue-400 bg-blue-500/10 border-blue-500/30'};
        const hasLocations = task.locations && task.locations.length > 0;
        let projectName = ''; if (task.projectId) { const proj = AppState.projects.find(p => p.id === task.projectId); if (proj) projectName = proj.name; }

        return `
        <div draggable="true" onclick="App.handleRowTap('${task.projectId}')" ondragstart="App.handleDragStart(event, '${task.id}', '${type}'${argParent})" ondragend="App.handleDragEnd(event)" ondragover="App.handleDragOver(event)" ondragleave="App.handleDragLeave(event)" ondrop="App.handleDrop(event, '${task.id}', '${type}'${argParent})" class="draggable-item group flex items-center justify-between p-4 rounded-2xl cursor-grab transition-all duration-300 border ${isDone?'bg-[#13161c] border-gray-800/30 opacity-60':'bg-[#1A1D24] border-gray-800 hover:border-gray-700'}">
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
                        ${task.note ? `<span onclick="App.openTaskModal('${task.id}'${argParent}); event.stopPropagation();" class="flex items-center text-amber-400 hover:text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30 cursor-pointer"><i data-lucide="file-text" class="w-3 h-3"></i></span>` : ''}
                    </div>
                    ${projectName && !isSubtask ? `<div class="text-[10px] text-cyan-500/70 font-semibold flex items-center gap-1 mt-1 truncate"><i data-lucide="corner-down-right" class="w-3 h-3 shrink-0"></i> Tâche du projet : ${projectName}</div>` : ''}
                    ${isSubtask && parentName ? `<div class="text-[10px] text-cyan-500/70 font-semibold flex items-center gap-1 mt-1 truncate"><i data-lucide="corner-down-right" class="w-3 h-3 shrink-0"></i> Sous-tâche de : ${parentName} ${projectName ? `(${projectName})` : ''}</div>` : ''}
                </div>
            </div>
            <div class="flex items-center gap-1 shrink-0 ml-2">
                ${minimal && !isSubtask ? `<button onclick="event.stopPropagation(); App.openNewSubtaskModal('${task.id}');" class="p-2 text-gray-400 hover:text-cyan-400"><i data-lucide="plus" class="w-4 h-4"></i></button>` : ''}
                <button onclick="App.openTaskModal('${task.id}'${argParent}); event.stopPropagation();" class="p-2 text-gray-500 hover:text-cyan-400 rounded-lg"><i data-lucide="more-vertical" class="w-4 h-4"></i></button>
            </div>
        </div>`;
    },

    renderScheduleTask(task, slotId) {
        const isEditing = AppState.isEditingSchedule;
        const priorityColors={'Urgence':'text-red-400 bg-red-500/10 border-red-500/30', 'Haute':'text-purple-400 bg-purple-500/10 border-purple-500/30','Moyenne':'text-amber-400 bg-amber-500/10 border-amber-500/30','Basse':'text-blue-400 bg-blue-500/10 border-blue-500/30'};
        return `
        <div onclick="App.handleRowTap('${task.projectId}')" ${isEditing ? `draggable="true" ondragstart="App.handleScheduleDragStart(event, '${task.id}', '${slotId}')" ondragend="App.handleScheduleDragEnd(event)" ondragover="App.handleTaskDragOver(event)" ondragleave="App.handleTaskDragLeave(event)" ondrop="App.handleTaskItemDrop(event, '${slotId}', '${task.id}')" class="flex items-center justify-between p-3 rounded-xl bg-[#13161c] border border-gray-600 cursor-grab"` : `class="flex items-center justify-between p-3 rounded-xl bg-[#13161c] border border-gray-800/50 cursor-pointer"`}>
            <div class="flex-1 min-w-0 pointer-events-none">
                <h4 class="font-bold text-sm text-gray-200 truncate">${task.name}</h4>
                <div class="flex items-center gap-2 mt-1 text-[10px] text-gray-500">
                    <span><i data-lucide="clock" class="w-3 h-3 inline"></i> ${task.duration}m</span>
                    <span class="px-1.5 py-0.5 rounded-md border ${priorityColors[task.priority || 'Moyenne']}">${task.priority || 'Moyenne'}</span>
                </div>
            </div>
            ${isEditing ? `<button onclick="event.stopPropagation(); App.removeTaskFromSchedule('${slotId}', '${task.id}')" class="shrink-0 p-2 text-gray-500 hover:text-red-500 bg-gray-800/50 rounded-lg ml-2 transition-colors"><i data-lucide="x" class="w-4 h-4"></i></button>` : ''}
        </div>`;
    },

    renderPlanning() {
        if (AppState.validatedSchedule) {
            return `
            <div class="space-y-6">
                <div class="flex justify-between items-center px-1">
                    <div>
                        <h2 class="text-xl font-black text-emerald-400 flex items-center gap-2"><i data-lucide="calendar-check"></i> Plan validé</h2>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="App.toggleEditSchedule()" class="text-xs ${AppState.isEditingSchedule ? 'bg-cyan-900/50 text-cyan-400' : 'bg-gray-800 text-gray-400'} px-3 py-1.5 rounded-lg hover:text-white transition-colors">
                            ${AppState.isEditingSchedule ? 'Terminer' : 'Modifier'}
                        </button>
                        <button onclick="App.resetSchedule()" class="text-xs bg-red-900/30 text-red-500 px-3 py-1.5 rounded-lg hover:text-white transition-colors">Reset</button>
                    </div>
                </div>
                ${AppState.isEditingSchedule ? '<p class="text-xs text-cyan-400 text-center animate-pulse mb-2">Glisse les tâches pour changer l\'ordre ou le créneau</p>' : ''}
                <div class="space-y-4">
                    ${AppState.validatedSchedule.map(slot => `
                        <div class="bg-[#1A1D24] rounded-2xl border ${AppState.isEditingSchedule ? 'border-dashed border-gray-600 transition-colors' : 'border-gray-800'} overflow-hidden"
                             ${AppState.isEditingSchedule ? `ondragover="App.handleSlotDragOver(event)" ondragleave="App.handleSlotDragLeave(event)" ondrop="App.handleSlotDrop(event, '${slot.slotId}', false)"` : ''}>
                            <div class="bg-gray-800/30 px-4 py-2 border-b border-gray-800 flex justify-between items-center pointer-events-none">
                                <span class="font-bold text-white text-sm">${slot.day} • ${slot.start} - ${slot.end}</span>
                                <span class="text-xs text-gray-500">${slot.usedTime}m / ${slot.totalDuration}m</span>
                            </div>
                            <div class="p-3 space-y-2 min-h-[60px]">
                                ${slot.tasks.length === 0 ? '<p class="text-xs text-gray-500 text-center py-2 pointer-events-none">Créneau vide</p>' : slot.tasks.map(t => this.renderScheduleTask(t, slot.slotId)).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>`;
        }

        if (AppState.draftSchedule) {
            return `
            <div class="space-y-6">
                <div class="px-1">
                    <h2 class="text-xl font-black text-amber-400 flex items-center gap-2"><i data-lucide="calendar-clock"></i> Brouillon généré</h2>
                    <p class="text-xs text-gray-500 mt-1">Glisse les tâches pour modifier l'ordre, supprime-les ou remplace-les avant de valider.</p>
                </div>
                <div class="space-y-4">
                    ${AppState.draftSchedule.map(slot => `
                        <div class="bg-[#1A1D24] rounded-2xl border border-amber-500/30 overflow-hidden relative transition-colors"
                             ondragover="App.handleSlotDragOver(event)" ondragleave="App.handleSlotDragLeave(event)" ondrop="App.handleSlotDrop(event, '${slot.slotId}', true)">
                            <div class="bg-amber-500/10 px-4 py-3 border-b border-amber-500/30 flex justify-between items-center pointer-events-none">
                                <span class="font-bold text-amber-500 text-sm">${slot.day} • ${slot.start} - ${slot.end}</span>
                                <div class="text-right">
                                    <div class="text-xs font-bold text-amber-400">${slot.usedTime}m prévus</div>
                                    <div class="text-[10px] text-gray-500">Marge: ${slot.totalDuration - slot.usedTime}m libres</div>
                                </div>
                            </div>
                            <div class="p-3 space-y-3 bg-[#0D0F12]/50 min-h-[60px]">
                                ${slot.tasks.length === 0 ? '<p class="text-xs text-gray-500 text-center py-2 pointer-events-none">Rien ne rentre ici.</p>' : slot.tasks.map(t => `
                                    <div class="flex items-stretch gap-2">
                                        <div class="flex-1">
                                            <div onclick="App.handleRowTap('${t.projectId}')" draggable="true" ondragstart="App.handleDraftDragStart(event, '${t.id}', '${slot.slotId}')" ondragend="App.handleDraftDragEnd(event)" ondragover="App.handleTaskDragOver(event)" ondragleave="App.handleTaskDragLeave(event)" ondrop="App.handleTaskItemDrop(event, '${slot.slotId}', '${t.id}')" class="flex items-center justify-between p-3 rounded-xl bg-[#13161c] border border-amber-500/30 cursor-grab">
                                                <div class="flex-1 min-w-0 pointer-events-none">
                                                    <h4 class="font-bold text-sm text-gray-200 truncate">${t.name}</h4>
                                                    <div class="flex items-center gap-2 mt-1 text-[10px] text-gray-500">
                                                        <span><i data-lucide="clock" class="w-3 h-3 inline"></i> ${t.duration}m</span>
                                                        <span class="px-1.5 py-0.5 rounded-md border text-amber-400 bg-amber-500/10 border-amber-500/30">${t.priority || 'Moyenne'}</span>
                                                    </div>
                                                </div>
                                                <div class="flex items-center shrink-0">
                                                    <button onclick="event.stopPropagation(); App.removeTaskFromDraft('${slot.slotId}', '${t.id}')" class="p-2 text-gray-500 hover:text-red-500 rounded-lg transition-colors" title="Supprimer">
                                                        <i data-lucide="x" class="w-4 h-4"></i>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        <button onclick="App.replaceScheduledTask('${slot.slotId}', '${t.id}')" class="shrink-0 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-xl px-3 flex flex-col items-center justify-center border border-gray-700 transition-colors">
                                            <i data-lucide="refresh-cw" class="w-4 h-4 mb-1"></i>
                                            <span class="text-[9px] uppercase font-bold">Changer</span>
                                        </button>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="flex gap-3 pt-4">
                    <button onclick="App.resetSchedule()" class="flex-1 py-4 rounded-xl bg-[#1A1D24] text-white font-bold border border-gray-800">Annuler</button>
                    <button onclick="App.validateSchedule()" class="flex-1 py-4 rounded-xl bg-emerald-500 text-black font-bold shadow-[0_0_15px_rgba(16,185,129,0.3)]">Valider le planning</button>
                </div>
            </div>`;
        }

        const sortedAvailabilities = [...AppState.availabilities].sort((a, b) => {
            const dayDiff = AppState.daysOfWeek.indexOf(a.day) - AppState.daysOfWeek.indexOf(b.day);
            if (dayDiff !== 0) return dayDiff;
            return a.start.localeCompare(b.start);
        });

        return `
        <div class="space-y-6">
            <section class="bg-gradient-to-br from-[#1A1D24] to-[#13161c] rounded-3xl p-5 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.1)]">
                <h2 class="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <i data-lucide="calendar-plus" class="w-4 h-4"></i> Ajouter un créneau libre
                </h2>
                <form onsubmit="App.addAvailability(event)" class="space-y-4">
                    <div class="flex gap-2">
                        <select id="plan-day" required class="flex-1 bg-[#0D0F12] rounded-xl px-3 py-3 text-sm text-gray-300 border border-gray-800">
                            ${AppState.daysOfWeek.map(d => `<option value="${d}">${d}</option>`).join('')}
                        </select>
                    </div>
                    <div class="flex gap-2 items-center">
                        <span class="text-xs text-gray-500 font-bold">De</span>
                        <input type="time" id="plan-start" required class="flex-1 bg-[#0D0F12] rounded-xl px-3 py-3 text-sm text-white border border-gray-800" value="14:00">
                        <span class="text-xs text-gray-500 font-bold">À</span>
                        <input type="time" id="plan-end" required class="flex-1 bg-[#0D0F12] rounded-xl px-3 py-3 text-sm text-white border border-gray-800" value="16:00">
                    </div>
                    <div>
                        <label class="text-[10px] text-gray-500 uppercase font-bold block mb-2">Filtres (Optionnel)</label>
                        <div class="flex gap-2 flex-wrap">
                            ${AppState.settings.locations.map(l => `<button type="button" onclick="App.toggleFormLocation(this)" class="flex-1 min-w-[70px] py-2 rounded-xl text-xs font-bold bg-[#0D0F12] text-gray-500 border border-transparent" data-loc="${l}">${l}</button>`).join('')}
                        </div>
                    </div>
                    <button type="submit" class="w-full py-3 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/50 font-bold uppercase hover:bg-cyan-500 hover:text-black transition-colors">Ajouter Disponibilité</button>
                </form>
            </section>
            <section>
                <h2 class="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 px-1">Tes Disponibilités (${sortedAvailabilities.length})</h2>
                <div class="space-y-2">
                    ${sortedAvailabilities.length === 0 ? '<div class="bg-[#1A1D24] rounded-2xl p-6 text-center border border-gray-800 border-dashed"><p class="text-gray-500 text-sm">Aucun créneau configuré.</p></div>' : ''}
                    ${sortedAvailabilities.map(slot => `
                        <div class="flex items-center justify-between p-3 rounded-xl bg-[#1A1D24] border border-gray-800">
                            <div>
                                <div class="font-bold text-white text-sm">${slot.day} : ${slot.start} - ${slot.end}</div>
                                <div class="text-xs text-gray-500 mt-1 flex items-center gap-2">
                                    <span><i data-lucide="clock" class="w-3 h-3 inline"></i> ${slot.duration} min</span>
                                    ${slot.locations.length > 0 ? `<span class="text-emerald-400"><i data-lucide="map-pin" class="w-3 h-3 inline"></i> ${slot.locations.join(', ')}</span>` : ''}
                                </div>
                            </div>
                            <button onclick="App.removeAvailability('${slot.id}')" class="p-2 text-gray-600 hover:text-red-500 rounded-lg"><i data-lucide="x" class="w-5 h-5"></i></button>
                        </div>
                    `).join('')}
                </div>
            </section>
            ${sortedAvailabilities.length > 0 ? `
                <div class="mt-6 bg-[#1A1D24] p-4 rounded-xl border border-gray-800">
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-xs font-bold text-gray-400 uppercase">Taux de remplissage</span>
                        <span class="text-xs font-bold text-cyan-400">${AppState.bufferPercent}%</span>
                    </div>
                    <input type="range" min="50" max="100" step="5" value="${AppState.bufferPercent}" onchange="App.setBufferPercent(this.value)" class="w-full accent-cyan-500">
                    <p class="text-[9px] text-gray-500 mt-1">Marge pour les imprévus. Moins de 100% laisse du temps libre.</p>
                </div>
                <button onclick="App.generateSchedule()" class="w-full py-5 rounded-2xl bg-cyan-500 text-black font-black text-lg uppercase transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] mt-4 sticky bottom-4">
                    Générer ma semaine
                </button>
            ` : ''}
        </div>`;
    },
    
    renderHome() {
        let allActive = []; 
        const priorityWeights={'Urgence':4, 'Haute':3,'Moyenne':2,'Basse':1};
        AppState.tasks.forEach(t => {
            let hasActiveSubtasks = false;
            if (t.subtasks && t.subtasks.length > 0) { t.subtasks.forEach(s => { if (s.status !== 'done') { hasActiveSubtasks = true; allActive.push({...s, isSubtask: true, parentId: t.id, parentName: t.name, projectId: t.projectId}); } }); }
            if (!hasActiveSubtasks && t.status !== 'done') allActive.push({...t, isSubtask: false, projectId: t.projectId});
        });

        const urgencies = allActive.sort((a, b) => {
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
                    <div>
                        <label class="text-xs font-semibold text-gray-400 uppercase mb-2 flex items-center justify-between"><span>Filtre(s) possible(s)</span><span class="text-[10px] text-gray-500 font-normal">Vide = Partout</span></label>
                        <div class="flex gap-2 flex-wrap">${AppState.settings.locations.map(l=>`<button onclick="App.toggleHomeLocation('${l}')" class="flex-1 min-w-[70px] py-2 rounded-xl text-sm font-bold ${AppState.homeLocations.includes(l)?'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50':'bg-[#0D0F12] text-gray-400 border border-transparent'}">${l}</button>`).join('')}</div>
                    </div>
                    <button onclick="App.generateAction()" class="w-full py-4 mt-2 rounded-xl bg-cyan-500 text-black font-black text-lg uppercase transition-all shadow-[0_0_15px_rgba(6,182,212,0.4)]">Trouver quoi faire</button>
                </div>
                ${AppState.homeSearched?`<div class="mt-6 pt-4 border-t border-gray-800"><h3 class="text-xs font-bold text-gray-500 mb-3 uppercase">Résultats (${AppState.homeSuggestions.length})</h3>${AppState.homeSuggestions.length>0?`<div class="space-y-2">${AppState.homeSuggestions.map(t=>this.renderTask(t, false, t.isSubtask ? t.parentId : null, t.isSubtask ? t.parentName : null)).join('')}</div>`:`<p class="text-sm text-gray-500 text-center py-4">Aucune tâche ne correspond.</p>`}</div>`:''}
            </section>
            
            <section><h2 class="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 px-1 flex items-center gap-2"><i data-lucide="alert-circle" class="text-red-400 w-4 h-4"></i> Priorités & Rapides</h2><div class="space-y-2">${urgencies.length>0?urgencies.map(t=>this.renderTask(t, false, t.isSubtask ? t.parentId : null, t.isSubtask ? t.parentName : null)).join(''):`<div class="bg-[#1A1D24] rounded-2xl p-6 text-center border border-gray-800 border-dashed"><p class="text-gray-500 text-sm">Tout est sous contrôle.</p></div>`}</div></section>
        </div>`;
    },

    renderProjectItem(project) {
        const projectTasks = AppState.tasks.filter(t => t.projectId === project.id);
        let total=0, comp=0; 
        projectTasks.forEach(t=>{ total++; if(t.status==='done')comp++; if(t.subtasks){t.subtasks.forEach(s=>{total++;if(s.status==='done')comp++})} });
        const prog=total===0?0:Math.round((comp/total)*100); 
        const exp = AppState.expandedProjectId === project.id;
        
        return `
        <div draggable="true" ondragstart="App.handleDragStart(event, '${project.id}', 'project')" class="bg-[#13161c] rounded-2xl border border-gray-800 overflow-hidden mb-3 draggable-item">
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
                    ${task.subtasks&&task.subtasks.length>0?`<div class="ml-6 space-y-1.5 border-l border-gray-800 pl-3">${task.subtasks.map(sub=>`<div draggable="true" onclick="App.handleRowTap('${task.projectId}')" ondragstart="App.handleDragStart(event, '${sub.id}', 'subtask', '${task.id}')" ondragend="App.handleDragEnd(event)" ondragover="App.handleDragOver(event)" ondragleave="App.handleDragLeave(event)" ondrop="App.handleDrop(event, '${sub.id}', 'subtask', '${task.id}')" class="draggable-item flex items-center justify-between py-1.5 px-2 rounded-lg bg-[#1A1D24] border border-gray-800/40 hover:bg-[#1f232b] transition-colors"><div class="flex items-center gap-2 flex-1 min-w-0"><button onclick="App.toggleSubtask('${task.id}','${sub.id}'); event.stopPropagation();" class="shrink-0 focus:outline-none cursor-pointer"><i data-lucide="${sub.status==='done'?'check-circle-2':'circle'}" class="${sub.status==='done'?'text-emerald-500':'text-gray-600'} w-3 h-3"></i></button><div class="flex-1 min-w-0"><span class="text-xs truncate block ${sub.status==='done'?'text-gray-600 line-through':'text-gray-300'}">${sub.name}</span></div></div><button onclick="App.openTaskModal('${sub.id}', '${task.id}'); event.stopPropagation();" class="p-1 text-gray-500 hover:text-cyan-400 shrink-0 ml-1 rounded-md"><i data-lucide="more-vertical" class="w-3 h-3"></i></button></div>`).join('')}</div>`:''}
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
            
            <div class="mt-8 space-y-3 mb-4">
                <button onclick="App.openUpdateModal()" class="w-full py-4 rounded-xl bg-cyan-500/10 text-cyan-400 font-bold border border-cyan-500/30 hover:bg-cyan-500 hover:text-black transition-colors flex items-center justify-center gap-2">
                    <i data-lucide="sparkles" class="w-5 h-5"></i> Nouveautés (v${APP_VERSION})
                </button>
                
                <button onclick="App.logout()" class="w-full py-4 rounded-xl bg-red-500/10 text-red-500 font-bold border border-red-500/30 hover:bg-red-500 hover:text-white transition-colors flex items-center justify-center gap-2">
                    <i data-lucide="log-out" class="w-5 h-5"></i> Se déconnecter
                </button>
            </div>
            
            <div class="mb-4 flex justify-center"><span class="text-xs font-bold text-gray-600 bg-[#1A1D24] px-4 py-2 rounded-full border border-gray-800">My Task v${APP_VERSION}</span></div>
        </div>`;
    },
    
    // ==========================================
    // 5. AFFICHAGE GLOBAL ET INITIALISATION CLOUD
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
            document.getElementById('app-container').insertAdjacentHTML('beforeend', `<nav class="fixed bottom-0 w-full bg-[#13161c]/90 backdrop-blur-md border-t border-gray-800 px-2 py-4 flex justify-around items-center z-20 pb-8"><button onclick="App.setTab('home')" id="nav-home" class="flex flex-col items-center gap-1 transition-all text-gray-500"><i data-lucide="play-circle"></i><span class="text-[9px] font-bold tracking-wider uppercase">Action</span></button><button onclick="App.setTab('projects')" id="nav-projects" class="flex flex-col items-center gap-1 transition-all text-gray-500"><i data-lucide="folder"></i><span class="text-[9px] font-bold tracking-wider uppercase">Chantiers</span></button><button onclick="App.setTab('planning')" id="nav-planning" class="flex flex-col items-center gap-1 transition-all text-gray-500"><i data-lucide="calendar"></i><span class="text-[9px] font-bold tracking-wider uppercase">Plan</span></button><button onclick="App.setTab('settings')" id="nav-settings" class="flex flex-col items-center gap-1 transition-all text-gray-500"><i data-lucide="settings"></i><span class="text-[9px] font-bold tracking-wider uppercase">Paramètres</span></button></nav>`);
        }

        if (AppState.activeTab === 'home') content.innerHTML = this.renderHome();
        else if (AppState.activeTab === 'planning') content.innerHTML = this.renderPlanning();
        else if (AppState.activeTab === 'projects') content.innerHTML = this.renderProjects();
        else if (AppState.activeTab === 'settings') content.innerHTML = this.renderSettings();
        
        let modalContainer = document.getElementById('modal-container');
        if (!modalContainer) { 
            modalContainer = document.createElement('div'); 
            modalContainer.id = 'modal-container'; 
            document.getElementById('app-container').appendChild(modalContainer); 
        }
        
        if (AppState.showUpdateModal) {
            modalContainer.innerHTML = `
                <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center px-4" onclick="App.closeUpdateModal()">
                    <div class="bg-[#1A1D24] border border-gray-800 w-full max-w-md rounded-3xl p-6 shadow-2xl transform transition-all animate-slide-up" onclick="event.stopPropagation()">
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="text-xl font-black text-white flex items-center gap-2"><i data-lucide="sparkles" class="text-cyan-400"></i> Nouveautés</h3>
                            <button onclick="App.closeUpdateModal()" class="text-gray-500 hover:text-white transition-colors"><i data-lucide="x" class="w-6 h-6"></i></button>
                        </div>
                        <div class="text-sm text-gray-300 space-y-2 max-h-60 overflow-y-auto pr-2" style="scrollbar-width: thin; scrollbar-color: #374151 transparent;">
                            ${RELEASE_NOTES}
                        </div>
                        <button onclick="App.closeUpdateModal()" class="w-full mt-6 py-4 rounded-xl bg-cyan-500 text-black font-bold uppercase tracking-wider hover:bg-cyan-400 transition-colors shadow-[0_0_15px_rgba(6,182,212,0.3)]">Génial !</button>
                    </div>
                </div>
            `;
        } else if (AppState.taskModal) {
            const d = AppState.taskModal.data; 
            const dLocs = d.locations || [];
            modalContainer.innerHTML = `
                <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center pb-8 px-4" onclick="App.closeTaskModal()">
                    <div class="bg-[#1A1D24] border border-gray-800 w-full max-w-md rounded-3xl p-6 shadow-2xl transform transition-all animate-slide-up" onclick="event.stopPropagation()">
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

                            <div class="flex gap-3 pt-2">
                                <button type="button" onclick="App.closeTaskModal()" class="flex-1 py-3 rounded-xl bg-[#0D0F12] text-white font-bold border border-gray-700">Annuler</button>
                                <button type="submit" class="flex-1 py-3 rounded-xl bg-cyan-500 text-black font-bold">Enregistrer</button>
                            </div>
                        </form>
                    </div>
                </div>`;
        } else if (AppState.activeMenu) {
            modalContainer.innerHTML = `<div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center pb-8 px-4" onclick="App.closeMenu()"><div class="bg-[#1A1D24] border border-gray-800 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl transform transition-all animate-slide-up" onclick="event.stopPropagation()"><div class="p-2 border-b border-gray-800/50"><button onclick="App.openEdit()" class="w-full text-left px-6 py-4 text-white font-bold hover:bg-[#1f232b] flex items-center gap-3"><i data-lucide="pencil" class="text-cyan-400 w-5 h-5"></i> Renommer</button><button onclick="App.openNote('${AppState.activeMenu.type}', '${AppState.activeMenu.id}')" class="w-full text-left px-6 py-4 text-white font-bold hover:bg-[#1f232b] flex items-center gap-3"><i data-lucide="file-text" class="text-amber-400 w-5 h-5"></i> Gérer la note</button><button onclick="App.openDelete()" class="w-full text-left px-6 py-4 text-red-500 font-bold hover:bg-[#1f232b] flex items-center gap-3"><i data-lucide="trash-2" class="w-5 h-5"></i> Supprimer</button></div><div class="p-2"><button onclick="App.closeMenu()" class="w-full text-center px-6 py-4 text-gray-500 font-bold hover:bg-[#1f232b] rounded-2xl">Annuler</button></div></div></div>`;
        } else if (AppState.notePrompt) {
            modalContainer.innerHTML = `<div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center pb-8 px-4" onclick="App.closeNote()"><div class="bg-[#1A1D24] border border-gray-800 w-full max-w-md rounded-3xl p-6 shadow-2xl transform transition-all animate-slide-up" onclick="event.stopPropagation()"><h3 class="text-xl font-bold text-white mb-4 flex items-center gap-2"><i data-lucide="file-text" class="text-amber-400"></i> Note</h3><form onsubmit="App.saveNote(event)" class="space-y-4"><textarea id="edit-note-text" rows="6" class="w-full bg-[#0D0F12] rounded-xl px-4 py-3 text-white border border-gray-800 focus:border-amber-500 focus:outline-none placeholder-gray-600">${AppState.notePrompt.note}</textarea><div class="flex gap-3 mt-4"><button type="button" onclick="App.closeNote()" class="flex-1 py-3 rounded-xl bg-[#0D0F12] text-white font-bold border border-gray-700">Annuler</button><button type="submit" class="flex-1 py-3 rounded-xl bg-amber-500 text-black font-bold">Enregistrer</button></div></form></div></div>`;
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
            {id:'planning',color:'text-amber-400'},
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
                        AppState.draftSchedule = data.draftSchedule || null;
                        AppState.validatedSchedule = data.validatedSchedule || null;
                        AppState.bufferPercent = data.bufferPercent || 85;
                    } else {
                        await this.saveToCloud();
                    }
                } catch (e) {
                    console.error("Mode hors-ligne, utilisation des données locales de secours.", e);
                }
                
                const lastSeenVersion = localStorage.getItem('osdevie_last_seen_version');
                if (lastSeenVersion !== APP_VERSION) {
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
