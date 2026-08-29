
// ==========================================
// ui.js : GESTION DE L'INTERFACE UTILISATEUR (HTML & DOM)
// ==========================================

export const UI = {
    // Affiche l'écran de chargement pendant la connexion
    renderLoading() {
        const content = document.getElementById('app-content');
        if (content) {
            content.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full text-cyan-500">
                    <i data-lucide="cloud-cog" class="w-12 h-12 animate-pulse mb-4"></i>
                    <span class="text-sm font-bold tracking-widest uppercase">Synchronisation...</span>
                </div>
            `;
            if (window.lucide) lucide.createIcons();
        }
    },

    // Affiche la barre de navigation en bas de l'écran
    renderNavbar(activeTab) {
        let container = document.getElementById('app-container');
        let nav = document.getElementById('main-nav');
        
        // Si la navbar n'existe pas encore, on la crée
        if (!nav) {
            nav = document.createElement('nav');
            nav.id = 'main-nav';
            nav.className = "fixed bottom-0 w-full bg-[#13161c]/90 backdrop-blur-md border-t border-gray-800 px-2 py-4 flex justify-around items-center z-20 pb-8";
            container.appendChild(nav);
        }

        // Met à jour les couleurs des boutons selon l'onglet actif
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

    // Structure de base pour afficher le contenu principal (qui sera enrichi par la suite)
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
    }
};
