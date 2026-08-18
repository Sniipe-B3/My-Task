// ==========================================
// 1. DONNÉES INITIALES & MIGRATION
// ==========================================
const INITIAL_PROJECTS = [
    { id: 'p1', name: 'Poulailler', note: '', category: 'Business' },
    { id: 'p2', name: 'Entretien Peugeot', note: '', category: 'Famille' }
];

const INITIAL_TASKS = [
    { id: 't1', projectId: 'p1', name: '1. Acheter le bois', duration: 60, locations: ['Boulot'], priority: 'Haute', status: 'done', subtasks: [], note: '' },
    { id: 't2', projectId: 'p1', name: '2. Monter les murs', duration: 120, locations: ['Jardin', 'Maison'], priority: 'Moyenne', status: 'todo', note: 'Penser à vérifier le niveau', subtasks: [
        { id: 's1', name: 'Découper planches', duration: 30, locations: ['Jardin'], priority: 'Haute', status: 'todo', note: '' },
        { id: 's2', name: 'Visser', duration: 45, locations: ['Jardin'], priority: 'Basse', status: 'todo', note: '' }
    ]},
    { id: 't3', projectId: 'p2', name: 'Prendre rdv garage', duration: 15, locations: ['Ordi', 'Maison'], priority: 'Haute', status: 'todo', subtasks: [], note: '' }
];

const migrateProjects = (projects) => projects.map(p => ({ ...p, category: p.category || '' }));
const migrateTasks = (tasks) => tasks.map(t => ({ 
    ...t, locations: t.locations || [], note: t.note || '',
    subtasks: (t.subtasks || []).map(s => ({ ...s, locations: s.locations || [], note: s.note || '' }))
}));

// ==========================================
// 2. ÉTAT GLOBAL DE L'APPLICATION
// ==========================================
const AppState = {
    activeTab: 'planning',
    settings: JSON.parse(localStorage.getItem('osdevie_settings')) || {
        times: [15, 30, 60, 120],
        locations: ['Maison', 'Boulot', 'Ordi', 'Jardin'],
        categories: ['Business', 'Famille']
    },
    projects: migrateProjects(JSON.parse(localStorage.getItem('osdevie_projects')) || INITIAL_PROJECTS),
    tasks: migrateTasks(JSON.parse(localStorage.getItem('osdevie_tasks')) || INITIAL_TASKS),
    availabilities: JSON.parse(localStorage.getItem('osdevie_availabilities')) || [],
    draftSchedule: JSON.parse(localStorage.getItem('osdevie_draftSchedule')) || null,
    validatedSchedule: JSON.parse(localStorage.getItem('osdevie_validatedSchedule')) || null,
    daysOfWeek: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'],

    isEditingSchedule: false, 
    
    homeTime: 30, homeLocations: [], homeSuggestions: [], homeSearched: false,
    expandedProjectId: null, showAddProject: false,
    bankFilter: 'all', bankPriorityFilter: 'all',
    showProjectAddTaskModal: null, showProjectAddSubtaskModal: null,
    activeMenu: null, deletePrompt: null, editPrompt: null, notePrompt: null
};

// ==========================================
// 3. MOTEUR DE L'APPLICATION
// ==========================================
const App = {
    lastTapTime: 0,
    
    // --- SAUVEGARDE ET NAVIGATION ---
    save() {
        localStorage.setItem('osdevie_projects', JSON.stringify(AppState.projects));
        localStorage.setItem('osdevie_tasks', JSON.stringify(AppState.tasks));
        localStorage.setItem('osdevie_settings', JSON.stringify(AppState.settings));
        localStorage.setItem('osdevie_availabilities', JSON.stringify(AppState.availabilities));
        localStorage.setItem('osdevie_draftSchedule', JSON.stringify(AppState.draftSchedule));
        localStorage.setItem('osdevie_validatedSchedule', JSON.stringify(AppState.validatedSchedule));
        this.render();
    },
    
    setTab(tab) {
        AppState.activeTab = tab;
        this.render();
    },

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

    // --- MENUS MODAUX & FORMULAIRES ---
    openMenu(e, type, id, parentId = null) { 
        if (e) { e.preventDefault(); e.stopPropagation(); } 
        AppState.activeMenu = { type, id, parentId }; 
        this.render(); 
    },
    closeMenu() { AppState.activeMenu = null; this.render(); },
    
    openEdit() {
        const { type, id, parentId } = AppState.activeMenu;
        let itemData = {};
        if (type === 'project') itemData = AppState.projects.find(p => p.id === id);
        if (type === 'task') itemData = AppState.tasks.find(t => t.id === id);
        if (type === 'subtask') itemData = AppState.tasks.find(t => t.id === parentId).subtasks.find(s => s.id === id);
        AppState.editPrompt = { type, id, parentId, data: JSON.parse(JSON.stringify(itemData)) };
        AppState.activeMenu = null; this.render();
    },
    closeEdit() { AppState.editPrompt = null; this.render(); },
    
    openNote(type, id, parentId = null) {
        let itemData = {};
        if (type === 'project') itemData = AppState.projects.find(p => p.id === id);
        if (type === 'task') itemData = AppState.tasks.find(t => t.id === id);
        if (type === 'subtask') itemData = AppState.tasks.find(t => t.id === parentId).subtasks.find(s => s.id === id);
        AppState.notePrompt = { type, id, parentId, note: itemData.note || '' };
        AppState.activeMenu = null; this.render();
    },
    closeNote() { AppState.notePrompt = null; this.render(); },
    
    saveNote(event) {
        event.preventDefault();
        const { type, id, parentId } = AppState.notePrompt;
        const noteText = document.getElementById('edit-note-text').value;
        if (type === 'project') AppState.projects = AppState.projects.map(p => p.id === id ? { ...p, note: noteText } : p);
        else if (type === 'task') AppState.tasks = AppState.tasks.map(t => t.id === id ? { ...t, note: noteText } : t);
        else if (type === 'subtask') AppState.tasks = AppState.tasks.map(t => t.id === parentId ? { ...t, subtasks: t.subtasks.map(s => s.id === id ? { ...s, note: noteText } : s) } : t);
        AppState.notePrompt = null; this.save();
    },

    saveEdit(event) {
        event.preventDefault(); 
        const form = event.target; 
        const { type, id, parentId } = AppState.editPrompt;
        const name = document.getElementById('edit-name').value;
        if (type === 'project') {
            AppState.projects = AppState.projects.map(p => p.id === id ? { ...p, name, category: document.getElementById('edit-proj-category').value } : p);
        } else if (type === 'task') {
            const priorityBtn = form.querySelector('.edit-priority-selected');
            AppState.tasks = AppState.tasks.map(t => t.id === id ? { ...t, name, projectId: document.getElementById('edit-project').value || null, duration: parseInt(document.getElementById('edit-duration').value), locations: this.getFormLocations(form), priority: priorityBtn ? priorityBtn.innerText.trim() : 'Moyenne' } : t);
        } else if (type === 'subtask') {
            const priorityBtn = form.querySelector('.edit-sub-priority-selected');
            AppState.tasks = AppState.tasks.map(t => t.id === parentId ? { ...t, subtasks: t.subtasks.map(s => s.id === id ? { ...s, name, duration: parseInt(document.getElementById('edit-sub-duration').value), locations: this.getFormLocations(form), priority: priorityBtn ? priorityBtn.innerText.trim() : 'Moyenne' } : s) } : t);
        }
        AppState.editPrompt = null; this.save();
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

    selectEditPriority(btn) {
        btn.parentElement.querySelectorAll('button').forEach(b => { b.classList.remove('edit-priority-selected', 'bg-purple-500/20', 'text-purple-400', 'border-purple-500/50'); b.classList.add('bg-[#0D0F12]', 'text-gray-500', 'border-transparent'); });
        btn.classList.add('edit-priority-selected', 'bg-purple-500/20', 'text-purple-400', 'border-purple-500/50'); btn.classList.remove('bg-[#0D0F12]', 'text-gray-500', 'border-transparent');
    },
    selectSubEditPriority(btn) {
        btn.parentElement.querySelectorAll('button').forEach(b => { b.classList.remove('edit-sub-priority-selected', 'bg-purple-500/20', 'text-purple-400', 'border-purple-500/50'); b.classList.add('bg-[#0D0F12]', 'text-gray-500', 'border-transparent'); });
        btn.classList.add('edit-sub-priority-selected', 'bg-purple-500/20', 'text-purple-400', 'border-purple-500/50'); btn.classList.remove('bg-[#0D0F12]', 'text-gray-500', 'border-transparent');
    },
    selectBankPriority(btn){ 
        btn.parentElement.querySelectorAll('button').forEach(b=>{b.classList.remove('priority-btn-selected','bg-purple-500/20','text-purple-400','border-purple-500/50');b.classList.add('bg-[#0D0F12]','text-gray-500','border-transparent');}); 
        btn.classList.add('priority-btn-selected','bg-purple-500/20','text-purple-400','border-purple-500/50'); btn.classList.remove('bg-[#0D0F12]','text-gray-500','border-transparent'); 
    },

    // --- SUPPRESSION ---
    openDelete() { AppState.deletePrompt = { ...AppState.activeMenu }; AppState.activeMenu = null; this.render(); },
    cancelDelete() { AppState.deletePrompt = null; this.render(); },
    confirmDelete() {
        const { type, id, parentId } = AppState.deletePrompt;
        if (type === 'project') { AppState.projects = AppState.projects.filter(p => p.id !== id); AppState.tasks = AppState.tasks.filter(t => t.projectId !== id); }
        else if (type === 'task') { AppState.tasks = AppState.tasks.filter(t => t.id !== id); }
        else if (type === 'subtask') { AppState.tasks = AppState.tasks.map(t => t.id === parentId ? { ...t, subtasks: t.subtasks.filter(s => s.id !== id) } : t); }
        AppState.deletePrompt = null; this.save();
    },
    
    // --- ACTIONS TÂCHES ---
    toggleTask(taskId){ AppState.tasks=AppState.tasks.map(t=>t.id===taskId ? {...t,status:t.status==='todo'?'done':'todo'} : t); if(AppState.homeSearched) this.generateAction(); this.save(); },
    toggleSubtask(taskId,subtaskId){ AppState.tasks=AppState.tasks.map(t=>t.id===taskId ? {...t,subtasks:t.subtasks.map(s=>s.id===subtaskId ? {...s,status:s.status==='todo'?'done':'todo'} : s)} : t); this.save(); },
    
    addTask(event){
        event.preventDefault(); const form = event.target; const priorityBtn = form.querySelector('.priority-btn-selected');
        const name = document.getElementById('new-task-name').value;
        if(!name.trim()) return;
        AppState.tasks.unshift({id: Date.now().toString(), name, projectId: document.getElementById('new-task-project').value || null, duration: parseInt(document.getElementById('new-task-duration').value), locations: this.getFormLocations(form), priority: priorityBtn ? priorityBtn.innerText.trim() : 'Moyenne', status: 'todo', subtasks: [], note: ''});
        document.getElementById('new-task-name').value = ''; this.save();
    },
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
        AppState.projects.push({id:Date.now().toString(), name, category:document.getElementById('new-proj-category').value, note:''});
        AppState.showAddProject=false; this.save();
    },

    // --- NAVIGATION DANS LES VUES ---
    handleRowTap(projectId) {
        if (!projectId || projectId === 'null' || projectId === 'undefined') return;
        const now = new Date().getTime();
        if (now - this.lastTapTime < 300) this.goToProject(projectId);
        this.lastTapTime = now;
    },
    goToProject(projectId) { AppState.expandedProjectId = projectId; this.setTab('projects'); },
    toggleProjectExpand(id) { AppState.expandedProjectId = AppState.expandedProjectId === id ? null : id; this.render(); },
    toggleAddProject() { AppState.showAddProject = !AppState.showAddProject; this.render(); },
    setBankFilter(filter) { AppState.bankFilter = filter; this.render(); },
    setBankPriorityFilter(priority) { AppState.bankPriorityFilter = priority; this.render(); },
    setHomeTime(time) { AppState.homeTime=time; this.render(); },
    toggleHomeLocation(loc) { AppState.homeLocations.includes(loc) ? AppState.homeLocations = AppState.homeLocations.filter(l => l !== loc) : AppState.homeLocations.push(loc); this.render(); },

    // --- DRAG & DROP GÉNÉRAL (Banque/Projets) ---
    handleDragStart(e, id, type, parentId = null) { e.dataTransfer.setData('text/plain', JSON.stringify({id, type, parentId})); e.currentTarget.classList.add('dragging'); },
    handleDragEnd(e) { e.currentTarget.classList.remove('dragging'); document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over')); },
    handleDragOver(e) { e.preventDefault(); e.currentTarget.classList.add('drag-over'); },
    handleDragLeave(e) { e.currentTarget.classList.remove('drag-over'); },
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

    // --- DRAG & DROP SPÉCIFIQUE (Plan validé) ---
    handleScheduleDragStart(e, taskId, slotId) {
        e.dataTransfer.setData('text/plain', JSON.stringify({id: taskId, type: 'schedule-task', sourceSlot: slotId}));
        e.currentTarget.classList.add('opacity-50');
    },
    handleScheduleDragEnd(e) { e.currentTarget.classList.remove('opacity-50'); },
    handleScheduleDragOver(e) { e.preventDefault(); e.currentTarget.classList.add('border-cyan-500'); },
    handleScheduleDragLeave(e) { e.currentTarget.classList.remove('border-cyan-500'); },
    handleScheduleDrop(e, targetSlotId) {
        e.preventDefault(); e.currentTarget.classList.remove('border-cyan-500');
        try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            if (data.type !== 'schedule-task' || data.sourceSlot === targetSlotId) return;
            const sourceSlot = AppState.validatedSchedule.find(s => s.slotId === data.sourceSlot);
            const targetSlot = AppState.validatedSchedule.find(s => s.slotId === targetSlotId);
            const taskIndex = sourceSlot.tasks.findIndex(t => t.id === data.id);
            if (taskIndex !== -1) {
                const [task] = sourceSlot.tasks.splice(taskIndex, 1);
                targetSlot.tasks.push(task);
                sourceSlot.usedTime -= task.duration; targetSlot.usedTime += task.duration;
                this.save();
            }
        } catch(err) { console.error(err); }
    },

    // --- DRAG & DROP SPÉCIFIQUE (Brouillon) ---
    handleDraftDragStart(e, taskId, slotId) {
        e.dataTransfer.setData('text/plain', JSON.stringify({id: taskId, type: 'draft-task', sourceSlot: slotId}));
        e.currentTarget.classList.add('opacity-50');
    },
    handleDraftDragEnd(e) { e.currentTarget.classList.remove('opacity-50'); },
    handleDraftDragOver(e) { e.preventDefault(); e.currentTarget.classList.add('border-amber-500'); },
    handleDraftDragLeave(e) { e.currentTarget.classList.remove('border-amber-500'); },
    handleDraftDrop(e, targetSlotId) {
        e.preventDefault(); e.currentTarget.classList.remove('border-amber-500');
        try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            if (data.type !== 'draft-task' || data.sourceSlot === targetSlotId) return;
            const sourceSlot = AppState.draftSchedule.find(s => s.slotId === data.sourceSlot);
            const targetSlot = AppState.draftSchedule.find(s => s.slotId === targetSlotId);
            const taskIndex = sourceSlot.tasks.findIndex(t => t.id === data.id);
            if (taskIndex !== -1) {
                const [task] = sourceSlot.tasks.splice(taskIndex, 1);
                targetSlot.tasks.push(task);
                sourceSlot.usedTime -= task.duration; targetSlot.usedTime += task.duration;
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
        const priorityWeights={'Haute':3,'Moyenne':2,'Basse':1};
        let allAvailable = [];
        AppState.tasks.forEach(t => {
            let hasActiveSubtasks = false;
            if (t.subtasks && t.subtasks.length > 0) {
                t.subtasks.forEach(s => {
                    if (s.status !== 'done') {
                        hasActiveSubtasks = true;
                        if (s.duration <= AppState.homeTime) {
                            let matchLoc = true;
                            if (AppState.homeLocations.length > 0) matchLoc = (!s.locations || s.locations.length === 0) ? false : s.locations.some(l => AppState.homeLocations.includes(l));
                            if (matchLoc) allAvailable.push({ ...s, isSubtask: true, parentId: t.id, parentName: t.name, projectId: t.projectId });
                        }
                    }
                });
            }
            if (!hasActiveSubtasks && t.status !== 'done' && t.duration <= AppState.homeTime) {
                let matchLoc = true;
                if (AppState.homeLocations.length > 0) matchLoc = (!t.locations || t.locations.length === 0) ? false : t.locations.some(l => AppState.homeLocations.includes(l));
                if (matchLoc) allAvailable.push({ ...t, isSubtask: false, projectId: t.projectId });
            }
        });
        
        allAvailable.sort((a,b)=> {
            const dA = a.duration || 15; const dB = b.duration || 15; if (dA !== dB) return dB - dA;
            const pA = priorityWeights[a.priority || 'Moyenne']; const pB = priorityWeights[b.priority || 'Moyenne']; if (pA !== pB) return pB - pA;
            if (a.isSubtask && !b.isSubtask) return -1; if (!a.isSubtask && b.isSubtask) return 1; return 0;
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
        const priorityWeights={'Haute':3,'Moyenne':2,'Basse':1};
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
            const maxTime = Math.floor(slot.duration * 0.85); 
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
        
        const timeRemaining = (scheduleSlot.totalDuration * 0.85) - (scheduleSlot.usedTime - oldTask.duration);
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
    // 4. RENDU VISUEL (HTML COMPONENTS)
    // ==========================================
    
    renderTask(task, minimal=false, parentId=null, parentName=null){
        const isDone = task.status === 'done'; const isSubtask = parentId !== null; const type = isSubtask ? 'subtask' : 'task';
        const argParent = isSubtask ? `, '${parentId}'` : '';
        const priorityColors = {'Haute':'text-purple-400 bg-purple-500/10 border-purple-500/30','Moyenne':'text-amber-400 bg-amber-500/10 border-amber-500/30','Basse':'text-blue-400 bg-blue-500/10 border-blue-500/30'};
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
                        ${task.note ? `<span onclick="App.openNote('${type}', '${task.id}'${argParent}); event.stopPropagation();" class="flex items-center text-amber-400 hover:text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30 cursor-pointer"><i data-lucide="file-text" class="w-3 h-3"></i></span>` : ''}
                    </div>
                    ${projectName && !isSubtask ? `<div class="text-[10px] text-cyan-500/70 font-semibold flex items-center gap-1 mt-1 truncate"><i data-lucide="corner-down-right" class="w-3 h-3 shrink-0"></i> Tâche du projet : ${projectName}</div>` : ''}
                    ${isSubtask && parentName ? `<div class="text-[10px] text-cyan-500/70 font-semibold flex items-center gap-1 mt-1 truncate"><i data-lucide="corner-down-right" class="w-3 h-3 shrink-0"></i> Sous-tâche de : ${parentName} ${projectName ? `(${projectName})` : ''}</div>` : ''}
                </div>
            </div>
            <div class="flex items-center gap-1 shrink-0 ml-2">
                ${minimal && !isSubtask ? `<button onclick="event.stopPropagation(); AppState.showProjectAddSubtaskModal = '${task.id}'; App.render();" class="p-2 text-gray-400 hover:text-cyan-400"><i data-lucide="plus" class="w-4 h-4"></i></button>` : ''}
                <button onclick="App.openMenu(event, '${type}', '${task.id}'${argParent})" class="p-2 text-gray-500 hover:text-cyan-400 rounded-lg"><i data-lucide="more-vertical" class="w-4 h-4"></i></button>
            </div>
        </div>`;
    },

    renderScheduleTask(task, slotId) {
        const isEditing = AppState.isEditingSchedule;
        const priorityColors={'Haute':'text-purple-400 bg-purple-500/10 border-purple-500/30','Moyenne':'text-amber-400 bg-amber-500/10 border-amber-500/30','Basse':'text-blue-400 bg-blue-500/10 border-blue-500/30'};
        return `
        <div ${isEditing ? `draggable="true" ondragstart="App.handleScheduleDragStart(event, '${task.id}', '${slotId}')" ondragend="App.handleScheduleDragEnd(event)" class="flex items-center justify-between p-3 rounded-xl bg-[#13161c] border border-gray-600 cursor-grab"` : `class="flex items-center justify-between p-3 rounded-xl bg-[#13161c] border border-gray-800/50"`}>
            <div class="flex-1 min-w-0 pointer-events-none">
                <h4 class="font-bold text-sm text-gray-200 truncate">${task.name}</h4>
                <div class="flex items-center gap-2 mt-1 text-[10px] text-gray-500">
                    <span><i data-lucide="clock" class="w-3 h-3 inline"></i> ${task.duration}m</span>
                    <span class="px-1.5 py-0.5 rounded-md border ${priorityColors[task.priority || 'Moyenne']}">${task.priority || 'Moyenne'}</span>
                </div>
            </div>
            ${isEditing ? `<button onclick="App.removeTaskFromSchedule('${slotId}', '${task.id}')" class="shrink-0 p-2 text-gray-500 hover:text-red-500 bg-gray-800/50 rounded-lg ml-2 transition-colors"><i data-lucide="x" class="w-4 h-4"></i></button>` : ''}
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
                ${AppState.isEditingSchedule ? '<p class="text-xs text-cyan-400 text-center animate-pulse mb-2">Glisse les tâches pour les déplacer ou supprime les avec (X)</p>' : ''}
                <div class="space-y-4">
                    ${AppState.validatedSchedule.map(slot => `
                        <div class="bg-[#1A1D24] rounded-2xl border ${AppState.isEditingSchedule ? 'border-dashed border-gray-600 transition-colors' : 'border-gray-800'} overflow-hidden"
                             ${AppState.isEditingSchedule ? `ondragover="App.handleScheduleDragOver(event)" ondragleave="App.handleScheduleDragLeave(event)" ondrop="App.handleScheduleDrop(event, '${slot.slotId}')"` : ''}>
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
            const priorityColors={'Haute':'text-purple-400 bg-purple-500/10 border-purple-500/30','Moyenne':'text-amber-400 bg-amber-500/10 border-amber-500/30','Basse':'text-blue-400 bg-blue-500/10 border-blue-500/30'};
            return `
            <div class="space-y-6">
                <div class="px-1">
                    <h2 class="text-xl font-black text-amber-400 flex items-center gap-2"><i data-lucide="calendar-clock"></i> Brouillon généré</h2>
                    <p class="text-xs text-gray-500 mt-1">Glisse les tâches entre les créneaux, supprime-les ou remplace-les avant de valider.</p>
                </div>
                
                <div class="space-y-4">
                    ${AppState.draftSchedule.map(slot => `
                        <div class="bg-[#1A1D24] rounded-2xl border border-amber-500/30 overflow-hidden relative transition-colors"
                             ondragover="App.handleDraftDragOver(event)" ondragleave="App.handleDraftDragLeave(event)" ondrop="App.handleDraftDrop(event, '${slot.slotId}')">
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
                                            <div draggable="true" ondragstart="App.handleDraftDragStart(event, '${t.id}', '${slot.slotId}')" ondragend="App.handleDraftDragEnd(event)" class="flex items-center justify-between p-3 rounded-xl bg-[#13161c] border border-amber-500/30 cursor-grab">
                                                <div class="flex-1 min-w-0 pointer-events-none">
                                                    <h4 class="font-bold text-sm text-gray-200 truncate">${t.name}</h4>
                                                    <div class="flex items-center gap-2 mt-1 text-[10px] text-gray-500">
                                                        <span><i data-lucide="clock" class="w-3 h-3 inline"></i> ${t.duration}m</span>
                                                        <span class="px-1.5 py-0.5 rounded-md border text-amber-400 bg-amber-500/10 border-amber-500/30">${t.priority || 'Moyenne'}</span>
                                                    </div>
                                                </div>
                                                <div class="flex items-center shrink-0">
                                                    <button onclick="App.removeTaskFromDraft('${slot.slotId}', '${t.id}')" class="p-2 text-gray-500 hover:text-red-500 rounded-lg transition-colors" title="Supprimer">
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
                        <label class="text-[10px] text-gray-500 uppercase font-bold block mb-2">Contexte du lieu (Optionnel)</label>
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
                <button onclick="App.generateSchedule()" class="w-full py-5 rounded-2xl bg-cyan-500 text-black font-black text-lg uppercase transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] mt-6 sticky bottom-4">
                    Générer ma semaine
                </button>
            ` : ''}
        </div>`;
    },
    
    renderHome() {
        let allActive = []; 
        const priorityWeights={'Haute':3,'Moyenne':2,'Basse':1};
        AppState.tasks.forEach(t => {
            let hasActiveSubtasks = false;
            if (t.subtasks && t.subtasks.length > 0) { t.subtasks.forEach(s => { if (s.status !== 'done') { hasActiveSubtasks = true; allActive.push({...s, isSubtask: true, parentId: t.id, parentName: t.name, projectId: t.projectId}); } }); }
            if (!hasActiveSubtasks && t.status !== 'done') allActive.push({...t, isSubtask: false, projectId: t.projectId});
        });

        const urgencies = allActive.sort((a, b) => {
            const pA = priorityWeights[a.priority || 'Moyenne']; const pB = priorityWeights[b.priority || 'Moyenne']; if (pA !== pB) return pB - pA;
            return (a.duration || 15) - (b.duration || 15);
        }).slice(0, 5);

        const categoryStats = AppState.settings.categories.map(cat => {
            const catProjects = AppState.projects.filter(p => p.category === cat); const total = catProjects.length; let done = 0;
            catProjects.forEach(p => {
                const projectTasks = AppState.tasks.filter(t => t.projectId === p.id); let tTotal = 0, tComp = 0;
                projectTasks.forEach(t => { tTotal++; if (t.status === 'done') tComp++; if (t.subtasks) { t.subtasks.forEach(s => { tTotal++; if (s.status === 'done') tComp++; }); } });
                if (tTotal > 0 && tTotal === tComp) done++;
            });
            return { cat, total, done, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
        });

        return `
        <div class="space-y-8">
            <section class="bg-[#1A1D24] rounded-3xl p-5 border border-gray-800/50 relative">
                <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-emerald-500"></div>
                <h2 class="text-lg font-bold text-white mb-4 flex items-center gap-2"><i data-lucide="play" class="text-cyan-400 fill-cyan-400 w-5 h-5"></i> Moteur d'Action</h2>
                <div class="space-y-4">
                    <div><label class="text-xs font-semibold text-gray-400 uppercase mb-2 block">Temps dispo (min)</label>
                        <div class="flex gap-2 flex-wrap">${AppState.settings.times.map(t=>`<button onclick="App.setHomeTime(${t})" class="flex-1 min-w-[50px] py-2 rounded-xl text-sm font-bold ${AppState.homeTime===t?'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50':'bg-[#0D0F12] text-gray-400 border border-transparent'}">${t}</button>`).join('')}</div>
                    </div>
                    <div>
                        <label class="text-xs font-semibold text-gray-400 uppercase mb-2 flex items-center justify-between"><span>Lieu(x) possible(s)</span><span class="text-[10px] text-gray-500 font-normal">Vide = Partout</span></label>
                        <div class="flex gap-2 flex-wrap">${AppState.settings.locations.map(l=>`<button onclick="App.toggleHomeLocation('${l}')" class="flex-1 min-w-[70px] py-2 rounded-xl text-sm font-bold ${AppState.homeLocations.includes(l)?'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50':'bg-[#0D0F12] text-gray-400 border border-transparent'}">${l}</button>`).join('')}</div>
                    </div>
                    <button onclick="App.generateAction()" class="w-full py-4 mt-2 rounded-xl bg-cyan-500 text-black font-black text-lg uppercase transition-all shadow-[0_0_15px_rgba(6,182,212,0.4)]">Trouver quoi faire</button>
                </div>
                ${AppState.homeSearched?`<div class="mt-6 pt-4 border-t border-gray-800"><h3 class="text-xs font-bold text-gray-500 mb-3 uppercase">Résultats (${AppState.homeSuggestions.length})</h3>${AppState.homeSuggestions.length>0?`<div class="space-y-2">${AppState.homeSuggestions.map(t=>this.renderTask(t, false, t.isSubtask ? t.parentId : null, t.isSubtask ? t.parentName : null)).join('')}</div>`:`<p class="text-sm text-gray-500 text-center py-4">Aucune tâche ne correspond.</p>`}</div>`:''}
            </section>
            
            <section><h2 class="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 px-1 flex items-center gap-2"><i data-lucide="alert-circle" class="text-emerald-400 w-4 h-4"></i> Priorités & Rapides</h2><div class="space-y-2">${urgencies.length>0?urgencies.map(t=>this.renderTask(t, false, t.isSubtask ? t.parentId : null, t.isSubtask ? t.parentName : null)).join(''):`<div class="bg-[#1A1D24] rounded-2xl p-6 text-center border border-gray-800 border-dashed"><p class="text-gray-500 text-sm">Tout est sous contrôle.</p></div>`}</div></section>
            <section class="mt-8 pb-4"><h2 class="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 px-1 flex items-center gap-2"><i data-lucide="bar-chart-2" class="text-indigo-400 w-4 h-4"></i> Progression des Projets</h2><div class="space-y-3">${categoryStats.map(stat => `<div class="bg-[#1A1D24] rounded-2xl p-4 border border-gray-800"><div class="flex justify-between items-end mb-2"><span class="font-bold text-gray-200">${stat.cat}</span><span class="text-xs font-semibold text-gray-500">${stat.done}/${stat.total} (${stat.percent}%)</span></div><div class="h-2 w-full bg-[#0D0F12] rounded-full overflow-hidden border border-gray-800/50"><div class="h-full bg-indigo-500 rounded-full transition-all duration-1000" style="width: ${stat.percent}%"></div></div></div>`).join('')}</div></section>
        </div>`;
    },
    
    renderProjects() {
        let html=`<div class="space-y-4"><div class="flex justify-between items-center mb-6 px-1"><h2 class="text-xl font-black text-white">Grands Chantiers</h2><button onclick="App.toggleAddProject()" class="h-8 w-8 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30"><i data-lucide="plus" class="w-4 h-4"></i></button></div>`;
        if(AppState.showAddProject)html+=`<div class="bg-[#1A1D24] p-4 rounded-2xl border border-cyan-500/30 mb-4 flex flex-col gap-3"><input type="text" id="new-proj-name" placeholder="Nom du projet..." class="w-full bg-[#0D0F12] rounded-lg px-3 py-2 text-sm text-white focus:outline-none border border-gray-800"><div class="flex gap-2"><select id="new-proj-category" class="flex-1 bg-[#0D0F12] rounded-lg px-3 py-2 text-sm text-gray-300 border border-gray-800 focus:outline-none"><option value="">Catégorie : Aucune</option>${AppState.settings.categories.map(c=>`<option value="${c}">${c}</option>`).join('')}</select><button onclick="App.addProject()" class="bg-cyan-500 text-black px-4 py-2 rounded-lg text-sm font-bold">OK</button></div></div>`;
        html+=AppState.projects.map(project=>{
            const projectTasks=AppState.tasks.filter(t=>t.projectId===project.id);
            let total=0,comp=0; projectTasks.forEach(t=>{ total++;if(t.status==='done')comp++; if(t.subtasks){t.subtasks.forEach(s=>{total++;if(s.status==='done')comp++})} });
            const prog=total===0?0:Math.round((comp/total)*100); const exp=AppState.expandedProjectId===project.id;
            const priorityColors={'Haute':'text-purple-400 bg-purple-500/10 border-purple-500/30','Moyenne':'text-amber-400 bg-amber-500/10 border-amber-500/30','Basse':'text-blue-400 bg-blue-500/10 border-blue-500/30'};
            return `
            <div class="bg-[#1A1D24] rounded-2xl border border-gray-800 overflow-hidden">
                <div onclick="App.toggleProjectExpand('${project.id}')" class="p-5 cursor-pointer hover:bg-[#1f232b] transition-colors">
                    <div class="flex justify-between items-start mb-3">
                        <div class="flex items-center gap-3 flex-1 min-w-0">
                            <div class="p-2 rounded-xl ${prog===100?'bg-emerald-500/20 text-emerald-400':'bg-cyan-500/20 text-cyan-400'} shrink-0"><i data-lucide="folder" class="w-5 h-5 fill-current opacity-50"></i></div>
                            <div class="flex-1 min-w-0 flex items-center flex-wrap gap-y-1"><h3 class="font-bold text-lg truncate ${prog===100?'text-gray-400 line-through':'text-white'}">${project.name}</h3>${project.category ? `<span class="px-2 py-0.5 rounded text-[10px] border border-gray-700 bg-gray-800 text-gray-300 ml-2">${project.category}</span>` : ''}${project.note ? `<span onclick="App.openNote('project', '${project.id}'); event.stopPropagation();" class="text-amber-400 hover:text-amber-300 transition-colors bg-amber-500/10 p-1 rounded-md border border-amber-500/30 ml-2 cursor-pointer" title="Voir la note"><i data-lucide="file-text" class="w-3 h-3"></i></span>` : ''}</div>
                        </div>
                        <div class="flex items-center gap-1 shrink-0 ml-2"><button onclick="App.openMenu(event, 'project', '${project.id}')" class="p-1.5 text-gray-500 hover:text-cyan-400 rounded-lg"><i data-lucide="more-vertical" class="w-5 h-5"></i></button><i data-lucide="${exp?'chevron-down':'chevron-right'}" class="text-gray-500 w-5 h-5 ml-1"></i></div>
                    </div>
                    <div class="mt-4 flex items-center gap-3"><div class="h-2 w-full bg-[#0D0F12] rounded-full overflow-hidden border border-gray-800/50"><div class="h-full rounded-full transition-all duration-1000 ${prog===100?'bg-emerald-400':'bg-gradient-to-r from-cyan-600 to-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.5)]'}" style="width:${prog}%"></div></div><span class="text-xs font-bold text-gray-400 w-8 text-right">${prog}%</span></div>
                </div>
                ${exp?`<div class="px-5 pb-5 border-t border-gray-800/50 pt-4 bg-[#13161c]" onclick="event.stopPropagation()">
                    <div class="flex justify-between items-center mb-3"><span class="text-xs font-bold text-gray-400 uppercase">Tâches du projet</span><button onclick="AppState.showProjectAddTaskModal = '${project.id}'; App.render();" class="flex items-center gap-1 text-xs text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-lg border border-cyan-500/30"><i data-lucide="plus" class="w-3.5 h-3.5"></i> Ajouter tâche</button></div>
                    ${AppState.showProjectAddTaskModal === project.id ? `<div class="mb-3 flex gap-2 bg-[#0D0F12] p-2 rounded-xl border border-gray-800"><input type="text" id="project-quick-task-${project.id}" onkeydown="if(event.key==='Enter') App.addProjectTask('${project.id}')" placeholder="Nouvelle tâche..." class="flex-1 bg-transparent px-2 text-sm text-white focus:outline-none" autofocus><button type="button" onclick="App.addProjectTask('${project.id}')" class="bg-cyan-500 text-black px-3 py-1 rounded-lg text-xs font-bold">Ajouter</button></div>`:''}
                    ${projectTasks.length===0?'<p class="text-sm text-gray-500 text-center py-2">Aucune tâche.</p>':projectTasks.map(task=>`<div class="space-y-2 mb-2">${this.renderTask(task,true)}
                        ${AppState.showProjectAddSubtaskModal === task.id ? `<div class="ml-8 mb-2 flex gap-2 bg-[#0D0F12] p-2 rounded-xl border border-gray-800"><input type="text" id="task-quick-subtask-${task.id}" onkeydown="if(event.key==='Enter') App.addSubtask('${task.id}')" placeholder="Nouvelle sous-tâche..." class="flex-1 bg-transparent px-2 text-sm text-white focus:outline-none" autofocus><button type="button" onclick="App.addSubtask('${task.id}')" class="bg-cyan-500 text-black px-3 py-1 rounded-lg text-xs font-bold">OK</button></div>`:''}
                        ${task.subtasks&&task.subtasks.length>0?`<div class="ml-8 space-y-1.5 border-l border-gray-800 pl-3">${task.subtasks.map(sub=>`<div draggable="true" onclick="App.handleRowTap('${task.projectId}')" ondragstart="App.handleDragStart(event, '${sub.id}', 'subtask', '${task.id}')" ondragend="App.handleDragEnd(event)" ondragover="App.handleDragOver(event)" ondragleave="App.handleDragLeave(event)" ondrop="App.handleDrop(event, '${sub.id}', 'subtask', '${task.id}')" class="draggable-item flex items-center justify-between py-2 px-2.5 rounded-lg bg-[#13161c] border border-gray-800/40 hover:bg-[#1A1D24] transition-colors"><div class="flex items-center gap-2 flex-1 min-w-0"><button onclick="App.toggleSubtask('${task.id}','${sub.id}'); event.stopPropagation();" class="shrink-0 focus:outline-none cursor-pointer p-1 -ml-1"><i data-lucide="${sub.status==='done'?'check-circle-2':'circle'}" class="${sub.status==='done'?'text-emerald-500':'text-gray-600'} w-3.5 h-3.5"></i></button><div class="flex-1 min-w-0"><span class="text-sm truncate block ${sub.status==='done'?'text-gray-600 line-through':'text-gray-300'}">${sub.name}</span><div class="flex items-center gap-2 mt-0.5 text-[10px] text-gray-500 flex-wrap"><span><i data-lucide="clock" class="w-2.5 h-2.5 inline"></i> ${sub.duration || 15}m</span>${sub.locations && sub.locations.length > 0 ? `<span><i data-lucide="map-pin" class="w-2.5 h-2.5 inline text-emerald-400"></i> ${sub.locations.join(', ')}</span>` : ''}<span class="px-1.5 py-0.2 rounded text-[9px] border ${priorityColors[sub.priority || 'Moyenne']}">${sub.priority || 'Moyenne'}</span>${sub.note ? `<span onclick="App.openNote('subtask', '${sub.id}', '${task.id}'); event.stopPropagation();" class="flex items-center text-amber-400 hover:text-amber-300 transition-colors bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30 cursor-pointer"><i data-lucide="file-text" class="w-2.5 h-2.5"></i></span>` : ''}</div></div></div><button onclick="App.openMenu(event, 'subtask', '${sub.id}', '${task.id}')" class="p-1.5 text-gray-500 hover:text-cyan-400 shrink-0 ml-1 rounded-md"><i data-lucide="more-vertical" class="w-4 h-4"></i></button></div>`).join('')}</div>`:''}
                    </div>`).join('')}
                </div>`:''}
            </div>`;
        }).join('');
        return html+'</div>';
    },
    
    renderBank() {
        const filteredTasks = AppState.tasks.filter(t => {
            if(AppState.bankFilter === 'isolated' && (t.projectId !== null || t.status === 'done')) return false;
            if(AppState.bankFilter === 'done' && t.status !== 'done') return false;
            if(AppState.bankFilter === 'all' && t.status === 'done') return false;
            if(AppState.bankPriorityFilter !== 'all' && t.priority !== AppState.bankPriorityFilter) return false;
            return true;
        });
        let bankListHtml = '';
        if (filteredTasks.length === 0) { 
            bankListHtml = '<p class="text-center text-gray-500 text-sm py-8">Aucune tâche.</p>'; 
        } else {
            filteredTasks.forEach(task => {
                bankListHtml += `<div class="mb-3">${this.renderTask(task, true)}`;
                if (task.subtasks && task.subtasks.length > 0) {
                    const activeSubs = task.subtasks.filter(s => { if (AppState.bankFilter === 'done') return s.status === 'done'; if (AppState.bankPriorityFilter !== 'all' && s.priority !== AppState.bankPriorityFilter) return false; return s.status !== 'done'; });
                    if (activeSubs.length > 0) {
                        const priorityColors={'Haute':'text-purple-400 bg-purple-500/10 border-purple-500/30','Moyenne':'text-amber-400 bg-amber-500/10 border-amber-500/30','Basse':'text-blue-400 bg-blue-500/10 border-blue-500/30'};
                        bankListHtml += `<div class="ml-4 mt-2 space-y-2 border-l-2 border-gray-800/50 pl-3">`;
                        activeSubs.forEach(sub => {
                            const isSubDone = sub.status === 'done';
                            bankListHtml += `<div class="flex items-center justify-between p-3 rounded-xl bg-[#13161c] border border-gray-800/50 hover:border-gray-700 transition-all ${isSubDone ? 'opacity-60' : ''}" onclick="App.handleRowTap('${task.projectId}')"><div class="flex items-center gap-3 flex-1 min-w-0"><button onclick="App.toggleSubtask('${task.id}','${sub.id}'); event.stopPropagation();" class="shrink-0 focus:outline-none cursor-pointer p-1 -ml-1"><i data-lucide="${isSubDone ? 'check-circle-2' : 'circle'}" class="${isSubDone ? 'text-emerald-500' : 'text-gray-600'} w-4 h-4"></i></button><div class="flex-1 min-w-0"><div class="text-sm ${isSubDone ? 'text-gray-600 line-through' : 'text-gray-300'} font-medium truncate">${sub.name}</div><div class="flex items-center gap-2 mt-1 text-[11px] text-gray-500 flex-wrap"><span><i data-lucide="clock" class="w-3 h-3 inline"></i> ${sub.duration || 15}m</span>${sub.locations && sub.locations.length > 0 ? `<span><i data-lucide="map-pin" class="w-3 h-3 inline text-emerald-400"></i> ${sub.locations.join(', ')}</span>` : ''}<span class="px-1.5 py-0.2 rounded text-[9px] border ${priorityColors[sub.priority || 'Moyenne']}">${sub.priority || 'Moyenne'}</span>${sub.note ? `<span onclick="App.openNote('subtask', '${sub.id}', '${task.id}'); event.stopPropagation();" class="flex items-center text-amber-400 hover:text-amber-300 transition-colors bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30 cursor-pointer"><i data-lucide="file-text" class="w-3 h-3"></i></span>` : ''}</div><div class="text-[10px] text-cyan-500/70 font-semibold flex items-center gap-1 mt-0.5 truncate"><i data-lucide="corner-down-right" class="w-3 h-3 shrink-0"></i> Sous-tâche de : ${task.name}</div></div></div><button onclick="App.openMenu(event, 'subtask', '${sub.id}', '${task.id}')" class="p-2 text-gray-500 hover:text-cyan-400 shrink-0 ml-1 rounded-lg"><i data-lucide="more-vertical" class="w-4 h-4"></i></button></div>`;
                        });
                        bankListHtml += `</div>`;
                    }
                }
                bankListHtml += `</div>`;
            });
        }
        return `
        <div class="space-y-6">
            <section class="bg-gradient-to-br from-[#1A1D24] to-[#13161c] rounded-3xl p-5 border border-gray-800">
                <h2 class="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2"><i data-lucide="plus" class="text-emerald-400 w-4 h-4"></i> Ajout Rapide</h2>
                <form onsubmit="App.addTask(event)" class="space-y-4">
                    <input type="text" id="new-task-name" placeholder="Que faut-il faire ?" required class="w-full bg-[#0D0F12] rounded-xl px-4 py-3 text-white border border-gray-800">
                    <div class="flex gap-2"><select id="new-task-project" class="flex-1 bg-[#0D0F12] rounded-xl px-3 py-3 text-sm text-gray-300 border border-gray-800"><option value="">Projet : Aucun</option>${AppState.projects.map(p=>`<option value="${p.id}">${p.name}</option>`).join('')}</select><select id="new-task-duration" class="w-24 bg-[#0D0F12] rounded-xl px-3 py-3 text-sm text-gray-300 border border-gray-800 text-center">${AppState.settings.times.map(t => `<option value="${t}">${t}m</option>`).join('')}</select></div>
                    <div class="flex gap-2 flex-wrap">${AppState.settings.locations.map(l => `<button type="button" onclick="App.toggleFormLocation(this)" class="flex-1 min-w-[70px] py-2 rounded-xl text-xs font-bold bg-[#0D0F12] text-gray-500 border border-transparent" data-loc="${l}">${l}</button>`).join('')}</div>
                    <div class="flex gap-2">${['Basse','Moyenne','Haute'].map(p=>`<button type="button" onclick="App.selectBankPriority(this)" class="flex-1 py-2 rounded-xl text-xs font-bold ${p==='Moyenne'?'priority-btn-selected bg-purple-500/20 text-purple-400 border border-purple-500/50':'bg-[#0D0F12] text-gray-500 border border-transparent'}">Priorité : ${p}</button>`).join('')}</div>
                    <button type="submit" class="w-full py-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/50 font-bold uppercase hover:bg-emerald-500 hover:text-black">Ajouter</button>
                </form>
            </section>
            <section>
                <div class="flex flex-col gap-3 mb-4 px-1"><div class="flex justify-between items-end"><h2 class="text-xl font-black text-white">Toutes les tâches</h2><div class="flex gap-1 flex-wrap justify-end"><button onclick="App.setBankFilter('all')" class="text-xs px-2.5 py-1 rounded-full font-bold ${AppState.bankFilter==='all'?'bg-gray-700 text-white':'bg-[#1A1D24] text-gray-500'}">Actives</button><button onclick="App.setBankFilter('isolated')" class="text-xs px-2.5 py-1 rounded-full font-bold ${AppState.bankFilter==='isolated'?'bg-gray-700 text-white':'bg-[#1A1D24] text-gray-500'}">Isolées</button><button onclick="App.setBankFilter('done')" class="text-xs px-2.5 py-1 rounded-full font-bold ${AppState.bankFilter==='done'?'bg-emerald-600 text-white':'bg-[#1A1D24] text-gray-500'}">Effectuée</button></div></div><div class="flex gap-1 items-center overflow-x-auto pb-1"><span class="text-[10px] text-gray-500 uppercase font-bold mr-1">Priorité:</span><button onclick="App.setBankPriorityFilter('all')" class="text-[11px] px-2 py-0.5 rounded-md font-bold ${AppState.bankPriorityFilter==='all'?'bg-cyan-500/20 text-cyan-400':'bg-[#1A1D24] text-gray-500'}">Toutes</button><button onclick="App.setBankPriorityFilter('Haute')" class="text-[11px] px-2 py-0.5 rounded-md font-bold ${AppState.bankPriorityFilter==='Haute'?'bg-purple-500/20 text-purple-400':'bg-[#1A1D24] text-gray-500'}">Haute</button><button onclick="App.setBankPriorityFilter('Moyenne')" class="text-[11px] px-2 py-0.5 rounded-md font-bold ${AppState.bankPriorityFilter==='Moyenne'?'bg-amber-500/20 text-amber-400':'bg-[#1A1D24] text-gray-500'}">Moyenne</button><button onclick="App.setBankPriorityFilter('Basse')" class="text-[11px] px-2 py-0.5 rounded-md font-bold ${AppState.bankPriorityFilter==='Basse'?'bg-blue-500/20 text-blue-400':'bg-[#1A1D24] text-gray-500'}">Basse</button></div></div>
                <div class="pb-10">${bankListHtml}</div>
            </section>
        </div>`;
    },

    renderSettings() {
        const renderList = (type, placeholder, isNumber) => `<div class="bg-[#1A1D24] rounded-2xl p-5 border border-gray-800 mb-6"><h3 class="font-bold text-white mb-4 uppercase text-sm flex items-center gap-2">${type === 'times' ? '<i data-lucide="clock" class="text-cyan-400 w-4 h-4"></i> Temps disponibles (min)' : type === 'locations' ? '<i data-lucide="map-pin" class="text-emerald-400 w-4 h-4"></i> Lieux' : '<i data-lucide="tag" class="text-indigo-400 w-4 h-4"></i> Catégories'}</h3><div class="flex gap-2 mb-4"><input type="${isNumber ? 'number' : 'text'}" id="setting-input-${type}" placeholder="${placeholder}" class="flex-1 bg-[#0D0F12] rounded-xl px-3 py-2 text-sm text-white focus:outline-none border border-gray-800"><button onclick="App.addSetting('${type}', 'setting-input-${type}')" class="bg-cyan-500 text-black px-4 py-2 rounded-xl text-sm font-bold">+</button></div><div class="flex flex-wrap gap-2">${AppState.settings[type].map(item => `<div class="flex items-center gap-2 bg-[#0D0F12] border border-gray-800 px-3 py-1.5 rounded-lg text-sm text-gray-300"><span>${item}</span><button onclick="App.removeSetting('${type}', ${isNumber ? item : `'${item}'`})" class="text-gray-500 hover:text-red-500 ml-1"><i data-lucide="x" class="w-3.5 h-3.5"></i></button></div>`).join('')}</div></div>`;
        return `<div class="space-y-4"><div class="px-1 mb-6"><h2 class="text-xl font-black text-white flex items-center gap-2"><i data-lucide="settings" class="text-gray-400"></i> Paramètres</h2><p class="text-sm text-gray-500 mt-1">Personnalise les filtres de ton application.</p></div>${renderList('times', 'Ex: 45', true)}${renderList('locations', 'Ex: Garage', false)}${renderList('categories', 'Ex: Famille', false)}<div class="mt-8 mb-4 flex justify-center"><span class="text-xs font-bold text-gray-600 bg-[#1A1D24] px-4 py-2 rounded-full border border-gray-800">OS de Vie v1.2.2 (Planning Avancé)</span></div></div>`;
    },
    
    // ==========================================
    // 5. AFFICHAGE GLOBAL ET INITIALISATION
    // ==========================================
    render() {
        const content = document.getElementById('app-content');
        if (AppState.activeTab === 'home') content.innerHTML = this.renderHome();
        else if (AppState.activeTab === 'planning') content.innerHTML = this.renderPlanning();
        else if (AppState.activeTab === 'projects') content.innerHTML = this.renderProjects();
        else if (AppState.activeTab === 'bank') content.innerHTML = this.renderBank();
        else if (AppState.activeTab === 'settings') content.innerHTML = this.renderSettings();
        
        let modalContainer = document.getElementById('modal-container');
        if (!modalContainer) { 
            modalContainer = document.createElement('div'); 
            modalContainer.id = 'modal-container'; 
            document.getElementById('app-container').appendChild(modalContainer); 
        }
        
        if (AppState.activeMenu) {
            modalContainer.innerHTML = `<div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center pb-8 px-4" onclick="App.closeMenu()"><div class="bg-[#1A1D24] border border-gray-800 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl transform transition-all animate-slide-up" onclick="event.stopPropagation()"><div class="p-2 border-b border-gray-800/50"><button onclick="App.openEdit()" class="w-full text-left px-6 py-4 text-white font-bold hover:bg-[#1f232b] flex items-center gap-3"><i data-lucide="pencil" class="text-cyan-400 w-5 h-5"></i> Modifier</button><button onclick="App.openNote('${AppState.activeMenu.type}', '${AppState.activeMenu.id}', ${AppState.activeMenu.parentId ? `'${AppState.activeMenu.parentId}'` : 'null'})" class="w-full text-left px-6 py-4 text-white font-bold hover:bg-[#1f232b] flex items-center gap-3"><i data-lucide="file-text" class="text-amber-400 w-5 h-5"></i> Gérer la note</button><button onclick="App.openDelete()" class="w-full text-left px-6 py-4 text-red-500 font-bold hover:bg-[#1f232b] flex items-center gap-3"><i data-lucide="trash-2" class="w-5 h-5"></i> Supprimer</button></div><div class="p-2"><button onclick="App.closeMenu()" class="w-full text-center px-6 py-4 text-gray-500 font-bold hover:bg-[#1f232b] rounded-2xl">Annuler</button></div></div></div>`;
        } else if (AppState.notePrompt) {
            modalContainer.innerHTML = `<div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center pb-8 px-4" onclick="App.closeNote()"><div class="bg-[#1A1D24] border border-gray-800 w-full max-w-md rounded-3xl p-6 shadow-2xl transform transition-all animate-slide-up" onclick="event.stopPropagation()"><h3 class="text-xl font-bold text-white mb-4 flex items-center gap-2"><i data-lucide="file-text" class="text-amber-400"></i> Note</h3><form onsubmit="App.saveNote(event)" class="space-y-4"><textarea id="edit-note-text" rows="6" class="w-full bg-[#0D0F12] rounded-xl px-4 py-3 text-white border border-gray-800 focus:border-amber-500 focus:outline-none placeholder-gray-600" placeholder="Écris ta note ici...">${AppState.notePrompt.note}</textarea><div class="flex gap-3 mt-4"><button type="button" onclick="App.closeNote()" class="flex-1 py-3 rounded-xl bg-[#0D0F12] text-white font-bold border border-gray-700">Annuler</button><button type="submit" class="flex-1 py-3 rounded-xl bg-amber-500 text-black font-bold">Enregistrer</button></div></form></div></div>`;
        } else if (AppState.editPrompt) {
            const d = AppState.editPrompt.data; const dLocs = d.locations || []; const dCat = d.category || '';
            modalContainer.innerHTML = `
                <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center pb-8 px-4" onclick="App.closeEdit()">
                    <div class="bg-[#1A1D24] border border-gray-800 w-full max-w-md rounded-3xl p-6 shadow-2xl transform transition-all animate-slide-up" onclick="event.stopPropagation()">
                        <h3 class="text-xl font-bold text-white mb-4">Modifier</h3>
                        <form onsubmit="App.saveEdit(event)" class="space-y-4">
                            <input type="text" id="edit-name" value="${d.name.replace(/"/g, '&quot;')}" required class="w-full bg-[#0D0F12] rounded-xl px-4 py-3 text-white border border-gray-800 focus:border-cyan-500 focus:outline-none">
                            ${AppState.editPrompt.type === 'project' ? `<select id="edit-proj-category" class="w-full bg-[#0D0F12] rounded-xl px-3 py-3 text-sm text-gray-300 border border-gray-800 focus:outline-none"><option value="">Catégorie : Aucune</option>${AppState.settings.categories.map(c => `<option value="${c}" ${c === dCat ? 'selected' : ''}>${c}</option>`).join('')}</select>` : ''}
                            ${AppState.editPrompt.type === 'task' ? `<div class="flex gap-2"><select id="edit-project" class="flex-1 bg-[#0D0F12] rounded-xl px-3 py-3 text-sm text-gray-300 border border-gray-800 focus:outline-none"><option value="">Projet : Aucun</option>${AppState.projects.map(p => `<option value="${p.id}" ${p.id === d.projectId ? 'selected' : ''}>${p.name}</option>`).join('')}</select><select id="edit-duration" class="w-24 bg-[#0D0F12] rounded-xl px-3 py-3 text-sm text-gray-300 border border-gray-800 text-center focus:outline-none">${AppState.settings.times.map(t => `<option value="${t}" ${d.duration == t ? 'selected' : ''}>${t}m</option>`).join('')}</select></div><div class="flex gap-2 flex-wrap">${AppState.settings.locations.map(l => `<button type="button" onclick="App.toggleFormLocation(this)" data-loc="${l}" class="flex-1 min-w-[70px] py-2 rounded-xl text-xs font-bold ${dLocs.includes(l) ? 'loc-selected bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' : 'bg-[#0D0F12] text-gray-500 border border-transparent'}">${l}</button>`).join('')}</div><div class="flex gap-2">${['Basse','Moyenne','Haute'].map(p => `<button type="button" onclick="App.selectEditPriority(this)" class="flex-1 py-2 rounded-xl text-xs font-bold ${p === (d.priority || 'Moyenne') ? 'edit-priority-selected bg-purple-500/20 text-purple-400 border border-purple-500/50' : 'bg-[#0D0F12] text-gray-500 border border-transparent'}">${p}</button>`).join('')}</div>` : ''}
                            ${AppState.editPrompt.type === 'subtask' ? `<div class="flex gap-2"><select id="edit-sub-duration" class="w-full bg-[#0D0F12] rounded-xl px-3 py-3 text-sm text-gray-300 border border-gray-800 text-center focus:outline-none">${AppState.settings.times.map(t => `<option value="${t}" ${(d.duration || 15) == t ? 'selected' : ''}>${t}m</option>`).join('')}</select></div><div class="flex gap-2 flex-wrap">${AppState.settings.locations.map(l => `<button type="button" onclick="App.toggleFormLocation(this)" data-loc="${l}" class="flex-1 min-w-[70px] py-2 rounded-xl text-xs font-bold ${dLocs.includes(l) ? 'loc-selected bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' : 'bg-[#0D0F12] text-gray-500 border border-transparent'}">${l}</button>`).join('')}</div><div class="flex gap-2">${['Basse','Moyenne','Haute'].map(p => `<button type="button" onclick="App.selectSubEditPriority(this)" class="flex-1 py-2 rounded-xl text-xs font-bold ${p === (d.priority || 'Moyenne') ? 'edit-sub-priority-selected bg-purple-500/20 text-purple-400 border border-purple-500/50' : 'bg-[#0D0F12] text-gray-500 border border-transparent'}">${p}</button>`).join('')}</div>` : ''}
                            <div class="flex gap-3 mt-6 pt-2"><button type="button" onclick="App.closeEdit()" class="flex-1 py-3 rounded-xl bg-[#0D0F12] text-white font-bold border border-gray-700">Annuler</button><button type="submit" class="flex-1 py-3 rounded-xl bg-cyan-500 text-black font-bold">Enregistrer</button></div>
                        </form>
                    </div>
                </div>`;
        } else if (AppState.deletePrompt) {
            let typeName = AppState.deletePrompt.type === 'project' ? 'ce projet' : (AppState.deletePrompt.type === 'task' ? 'cette tâche' : 'cette sous-tâche');
            modalContainer.innerHTML = `<div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center pb-8 px-4" onclick="App.cancelDelete()"><div class="bg-[#1A1D24] border border-gray-800 w-full max-w-md rounded-3xl p-6 shadow-2xl transform transition-all animate-slide-up" onclick="event.stopPropagation()"><div class="w-12 h-1.5 bg-gray-700 rounded-full mx-auto mb-6"></div><h3 class="text-xl font-bold text-white mb-2 flex items-center gap-2"><i data-lucide="trash-2" class="text-red-500"></i> Supprimer ${typeName} ?</h3><p class="text-gray-400 text-sm mb-8">Cette action est définitive et supprimera tout le contenu associé.</p><div class="flex gap-3"><button onclick="App.cancelDelete()" class="flex-1 py-4 rounded-xl bg-[#0D0F12] text-white font-bold border border-gray-700">Annuler</button><button onclick="App.confirmDelete()" class="flex-1 py-4 rounded-xl bg-red-500/10 text-red-500 font-bold border border-red-500/50">Supprimer</button></div></div></div>`;
        } else { 
            modalContainer.innerHTML = ''; 
        }
        
        const tabs=[
            {id:'home',color:'text-cyan-400'},
            {id:'planning',color:'text-amber-400'},
            {id:'projects',color:'text-cyan-400'},
            {id:'bank',color:'text-emerald-400'},
            {id:'settings',color:'text-gray-200'}
        ];
        
        tabs.forEach(tab=>{
            const btn=document.getElementById('nav-'+tab.id);
            if(btn) btn.className=`flex flex-col items-center gap-1 transition-all ${AppState.activeTab===tab.id?tab.color:'text-gray-500'}`;
        });
        lucide.createIcons();
    },
    
    init() {
        document.getElementById('app-container').insertAdjacentHTML('beforeend', `<nav class="fixed bottom-0 w-full bg-[#13161c]/90 backdrop-blur-md border-t border-gray-800 px-1 py-4 flex justify-between items-center z-20 pb-8"><button onclick="App.setTab('home')" id="nav-home" class="flex-1 flex flex-col items-center gap-1 transition-all text-gray-500"><i data-lucide="play-circle"></i><span class="text-[9px] font-bold tracking-wider uppercase">Action</span></button><button onclick="App.setTab('projects')" id="nav-projects" class="flex-1 flex flex-col items-center gap-1 transition-all text-gray-500"><i data-lucide="folder"></i><span class="text-[9px] font-bold tracking-wider uppercase">Projets</span></button><button onclick="App.setTab('planning')" id="nav-planning" class="flex-1 flex flex-col items-center gap-1 transition-all text-gray-500"><i data-lucide="calendar"></i><span class="text-[9px] font-bold tracking-wider uppercase">Plan</span></button><button onclick="App.setTab('bank')" id="nav-bank" class="flex-1 flex flex-col items-center gap-1 transition-all text-gray-500"><i data-lucide="list-todo"></i><span class="text-[9px] font-bold tracking-wider uppercase">Banque</span></button><button onclick="App.setTab('settings')" id="nav-settings" class="flex-1 flex flex-col items-center gap-1 transition-all text-gray-500"><i data-lucide="settings"></i><span class="text-[9px] font-bold tracking-wider uppercase">Param</span></button></nav>`);
        this.render();
    }
};

window.onload = () => App.init();
