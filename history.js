// ==========================================
// HISTORIQUE DES MISES À JOUR (My Task)
// ==========================================
export const RELEASE_HISTORY = [
    {
        version: "1.8.1",
        title: "Smart Timeline & Drag&Drop 2.0",
        notes: "• ⏳ <b>Smart Timeline :</b> Grille 100% dynamique (masquage des heures vides), sauts de temps discrets et nouvelle échelle très aérée.<br>• 📏 <b>Tâches Absolues :</b> Taille strictement proportionnelle mathématiquement, hauteur minimale de sécurité et décalage intelligent anti-chevauchement.<br>• 🤏 <b>Drag & Drop 2.0 :</b> Appui long n'importe où, déploiement 24h dynamique, auto-scroll fluide et accroche magnétique (5 min).<br>• 📱 <b>Interface :</b> Espace maximisé, centrage auto de la date du jour, renommage en \"Base\", accès direct \"+ Tâche\" et suggestion d'heure arrondie."
    },
    {
        version: "1.8.0",
        title: "Planification Intuitive & Suivi",
        notes: "• ⚡ Planification : Glissez une tâche pour modifier son heure. L'ajout d'une tâche depuis le calendrier cible automatiquement la prochaine demi-heure. Heures de début/fin visibles sur les cartes.<br>• 🗓️ Navigation : Focus direct sur le jour actuel à l'ouverture du calendrier. Repositionnement de l'heure et bouton 'Aujourd'hui' toujours actif.<br>• ✅ Validation : Les tâches non terminées 24h après leur période de fin sont notifiées (avec option de retour dans la Base)."
    },
    {
        version: "1.7.8",
        title: "Timeline Épurée, Timeblocking Proportonnell & Bouton Aujourd'hui",
        notes: "• 🎯 <b>Timeline épurée :</b> Suppression de la grande ligne rouge horizontale pour un affichage plus propre et moderne.<br>• 📍 <b>Alignement parfait :</b> L'heure actuelle en rouge et les heures fixes (10h00, 11h00...) sont désormais positionnées de manière fixe sur la gauche, en parfaite harmonie avec la ligne verticale principale.<br>• ⏱️ <b>Timeblocking visuel :</b> Les hauteurs des blocs de tâches et de créneaux s'étirent automatiquement de façon proportionnelle au temps qu'ils durent, avec leurs heures échelonnées heure par heure.<br>• 👁️ <b>Indicateurs visuels :</b> Les dates comportant des tâches affichent désormais un discret point cyan de repérage dans les deux modes d'affichage du calendrier.<br>• 📅 <b>Navigation étendue & Bouton 'Aujourd'hui' :</b> Profitez d'une vue mensuelle déroulante sur plusieurs années et d'un bouton de retour rapide à la date du jour."
    },
    {
        version: "1.7.7",
        title: "PWA 100% Hors-Ligne",
        notes: "• 🚀 <b>Application Native :</b> My Task s'installe désormais comme une véritable application sur votre téléphone.<br>• 📴 <b>Mode Hors-Ligne Absolu :</b> Le Service Worker met l'interface en cache. Lancez l'application instantanément, même sans aucune connexion internet (en mode avion). Firebase s'occupe de synchroniser vos données au retour du réseau.<br>• 🧹 <b>Nettoyage du code :</b> Suppression des variables obsolètes du moteur d'action et des fantômes du glisser-déposer pour une application plus légère."
    },
    {
        version: "1.7.6",
        title: "Refonte de l'Architecture",
        notes: "• 🧘 Minimalisme absolu : L'application se recentre sur l'essentiel avec 3 onglets (Base, Calendrier, Paramètres). L'onglet Action tire sa révérence.<br>• 🧠 Cerveau centralisé : Tes <i>Tâches non planifiées</i> t'attendent désormais sagement tout en bas de ta Base. Elles y sont intelligemment triées par urgence, puis par durée."
    },
    {
        version: "1.7.5.1",
        title: "Changement mineur",
        notes: "• 📝 Ajout du texte (Date) & (Heure) lors de la modification d'une tâche."
    },
    {
        version: "1.7.5",
        title: "Navigation & Calendrier",
        notes: "• ⚡ Navigation éclair : Cliquez sur la date affichée sur une tâche pour être instantanément téléporté au bon jour dans le calendrier.<br>• 🗓️ Défilement intelligent : Le calendrier glisse désormais fluidement pour centrer automatiquement la date sélectionnée sans effet de saut."
    },
        {
        version: "1.7.4",
        title: "Durée Libre & Flexibilité",
        notes: "• ⏱️ Fini les temps prédéfinis ! Vous pouvez désormais saisir la durée exacte de vos tâches à la minute près (jusqu'à 10h maximum).<br>• 🧹 Le moteur d'action et les paramètres ont été épurés pour refléter cette liberté totale."
    },
        {
        version: "1.7.3",
        title: "Notes & Timeline Dynamique",
        notes: "• 📝 Les notes ont désormais leur propre fenêtre d'affichage dédiée à la lecture (cliquez sur l'icône jaune).<br>• ⏰ La ligne rouge du temps s'anime intelligemment et traverse désormais vos tâches en cours de réalisation sur le calendrier."
    },
    {
        version: "1.7.2.1",
        title: "Changement mineur",
        notes: "• Déplacement de l'historique des mises à jours se trouvant désormais tout en bas de l'onglet Paramètres."
    },
    {
        version: "1.7.2",
        title: "Historique & Calendrier Interactif",
        notes: "• 📜 L'historique complet des mises à jour s'affiche correctement dans les paramètres.<br>• ✅ Ajout des cases à cocher pour valider les tâches directement depuis le calendrier.<br>• 📝 Retour de la petite icône 'note' quand une tâche possède une description."
    },
    {
        version: "1.7.1",
        title: "Correctifs Calendrier & UI",
        notes: "• 🐛 Correction de la fenêtre des nouveautés qui ne s'ouvrait plus.<br>• 🗓️ Le calendrier affiche désormais les mois et permet de scroller sur 90 jours.<br>• 🗑️ Ajout d'un bouton pour effacer la planification d'une tâche."
    },
    {
        version: "1.7.0",
        title: "Le Calendrier & Timeblocking",
        notes: "• 📅 Nouvel onglet Calendrier : Naviguez de jour en jour avec une timeline chronologique de la journée.<br>• ⏰ Planification précise : Fixez une date et une heure directement depuis la fiche tâche.<br>• 🤖 Créneaux intelligents : Dessinez un bloc de temps libre dans le calendrier et laissez l'algorithme le remplir.<br>• 🧹 Nettoyage auto : Les tâches planifiées non terminées à l'heure dite retournent automatiquement dans la Base."
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