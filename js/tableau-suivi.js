const { ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');

// Chemins absolus vers les fichiers de données
const clientsFilePath = path.resolve(__dirname, 'clients.json');
const tasksFilePath = path.resolve(__dirname, 'taches.json');

console.log('Chemin absolu vers clients.json:', clientsFilePath);
console.log('Chemin absolu vers taches.json:', tasksFilePath);

// Ajouter après les définitions des chemins
console.log('Répertoire actuel:', __dirname);
console.log('Répertoire parent:', path.resolve(__dirname, '..'));
console.log('Chemin complet du fichier clients:', clientsFilePath);
console.log('Existence du fichier clients:', fs.existsSync(clientsFilePath));

// Si le fichier n'est toujours pas trouvé, essayez ces alternatives
const alternativePaths = [
  path.resolve(__dirname, 'clients.json'),
  path.resolve(__dirname, '..', '..', 'clients.json'),
  path.resolve('./clients.json'),
  path.resolve('../clients.json')
];

console.log('Recherche de chemins alternatifs:');
alternativePaths.forEach(p => {
  console.log(`- Chemin: ${p}, Existe: ${fs.existsSync(p)}`);
});

// Vérifier si les fichiers existent
console.log('clients.json existe:', fs.existsSync(clientsFilePath));
console.log('taches.json existe:', fs.existsSync(tasksFilePath));

// Variables globales
let clients = [];
let tasks = {};
let currentSortType = 'client'; // <-- AJOUTER ICI (valeur par défaut)
let currentSortOrder = 'asc';   // <-- AJOUTER ICI (valeur par défaut)
let currentQuickFilter = 'all'; // Nouvelle variable globale pour le filtre actif

// Fonction pour mettre à jour le statut d'une tâche en mémoire ET la barre de progression
function updateTaskStatus(clientId, taskId, isCompleted) {
    console.log(`updateTaskStatus: Client ${clientId}, Tâche ${taskId}, Complété: ${isCompleted}`);
    if (!tasks || !tasks[clientId]) {
        console.error(`updateTaskStatus: Client ${clientId} non trouvé dans tasks.`);
        return false; // Indiquer l'échec
    }
    const taskIndex = tasks[clientId].findIndex(t => t.id === taskId);
    if (taskIndex === -1) {
        console.error(`updateTaskStatus: Tâche ${taskId} non trouvée pour client ${clientId}.`);
        return false; // Indiquer l'échec
    }

    // Mettre à jour le statut dans la structure de données en mémoire
    if (tasks[clientId][taskIndex].completed !== isCompleted) {
        tasks[clientId][taskIndex].completed = isCompleted;
        console.log(`Statut de la tâche ${taskId} mis à jour en mémoire.`);

        // *** APPEL CRUCIAL pour mettre à jour l'affichage de la progression ***
        updateProgressBar(clientId);

        return true; // Indiquer le succès
    } else {
        console.log(`Statut de la tâche ${taskId} déjà à jour.`);
        // On peut quand même rafraîchir la barre au cas où l'affichage initial était faux
        updateProgressBar(clientId);
        return true; // Considéré comme un succès car l'état est correct
    }
}

// Fonction pour mettre à jour la barre de progression d'un client spécifique
function updateProgressBar(clientId) {
    console.log(`Mise à jour de la barre de progression pour le client ${clientId}`);
    // Trouver le conteneur du groupe pour ce client
    const group = document.querySelector(`.task-group[data-client-id="${clientId}"]`);
    if (!group) {
        // Si on est en vue plate, il n'y a pas de barre de progression à mettre à jour
        if (document.querySelector('.flat-task-view')) {
            console.log("Vue plate active, pas de barre de progression à mettre à jour.");
            return;
        }
        console.warn(`Groupe non trouvé pour la mise à jour de la barre de progression (Client ID: ${clientId})`);
        return;
    }

    // Récupérer les tâches pour ce client depuis la variable globale 'tasks'
    const clientTasks = tasks[clientId] || [];
    const totalTasks = clientTasks.length;
    const completedTasks = clientTasks.filter(task => task.completed).length;
    // Calculer le pourcentage (éviter division par zéro)
    const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Trouver les éléments de la barre de progression dans l'en-tête du groupe
    const progressBar = group.querySelector('.progress-bar');
    const progressNumber = group.querySelector('.progress-number');

    if (progressBar && progressNumber) {
        // Mettre à jour le style de la barre et le texte
        progressBar.style.width = `${progressPercentage}%`;
        progressNumber.textContent = `${progressPercentage}% (${completedTasks}/${totalTasks} tâches terminées)`;
        console.log(`Barre de progression pour ${clientId} mise à jour: ${progressPercentage}%`);
    } else {
        console.warn(`Éléments de barre de progression (.progress-bar ou .progress-number) non trouvés pour le client ${clientId}`);
    }
}

// Fonction pour charger les données
function loadData() {
    console.log('Chargement des données clients...');
    
    try {
        // Vérifier l'existence du fichier clients
        console.log('Vérification du fichier clients:', clientsFilePath);
        console.log('Le fichier existe:', fs.existsSync(clientsFilePath));
        
        if (fs.existsSync(clientsFilePath)) {
            const fileContent = fs.readFileSync(clientsFilePath, 'utf8');
            console.log('Contenu lu du fichier, taille:', fileContent.length);
            
            if (!fileContent || fileContent.trim() === '') {
                console.warn("Fichier clients.json vide");
                clients = [];
            } else {
                try {
                    const allClients = JSON.parse(fileContent);
                    console.log('Données clients parsées:', allClients.slice(0, 2)); // Affiche les 2 premiers clients
                    
                    // CORRECTION IMPORTANTE ICI: Assigner explicitement l'ID basé sur numeroDossier
                    allClients.forEach((client, index) => {
                        // Utiliser "client_1", "client_2", etc. au lieu de "client_0", "client_1"
                        client.id = client.numeroDossier || `client_${index + 1}`;
                        console.log(`Client assigné avec ID: ${client.id} (${client.nom} ${client.prenom})`);
                    });
                    
                    // Filtrer pour ne garder que les clients non archivés
                    clients = allClients.filter(client => !client.archived);
                    
                    console.log(`${allClients.length} clients chargés au total`);
                    console.log(`${clients.length} clients actifs (non archivés)`);
                    console.log('Premier client actif:', clients.length > 0 ? 
                        `${clients[0].nom} ${clients[0].prenom} (ID: ${clients[0].id})` : 'aucun');
                } catch (parseError) {
                    console.error("Erreur de parsing JSON:", parseError);
                    clients = [];
                }
            }
        } else {
            console.warn("Fichier clients.json non trouvé dans:", clientsFilePath);
            clients = [];
        }
        
        // Charger aussi les tâches existantes
        loadTasks();
        
    } catch (error) {
        console.error("Erreur lors du chargement des clients:", error);
        clients = [];
    }
    
    // Afficher les tâches
    renderTaskGroups();
}

function saveTasks() {
    console.log('Tentative de sauvegarde des tâches dans:', tasksFilePath);
    try {
        // Convertir la structure groupée { clientId: [tasks] } en liste plate
        let tasksToSave = [];
        for (const clientId in tasks) {
            if (tasks[clientId]) { // Vérifier si le client a des tâches
                tasksToSave = tasksToSave.concat(tasks[clientId]);
            }
        }

        // Écrire la liste plate dans le fichier JSON
        fs.writeFileSync(tasksFilePath, JSON.stringify(tasksToSave, null, 2), 'utf8');
        console.log(`Sauvegarde réussie: ${tasksToSave.length} tâches écrites dans ${tasksFilePath}`);
        return true; // Indiquer le succès
    } catch (error) {
        console.error('Erreur lors de la sauvegarde des tâches:', error);
        // Afficher une alerte ou un message d'erreur plus visible si nécessaire
        alert(`Erreur critique lors de la sauvegarde des tâches: ${error.message}. Vérifiez les permissions du fichier.`);
        return false; // Indiquer l'échec
    }
}

// Fonction pour charger les tâches
function loadTasks() {
    console.log('Chargement des tâches...');
    
    try {
        if (fs.existsSync(tasksFilePath)) {
            const tasksContent = fs.readFileSync(tasksFilePath, 'utf8');
            
            if (tasksContent && tasksContent.trim() !== '') {
                const tasksList = JSON.parse(tasksContent);
                
                // Convertir la liste plate en structure groupée par client
                tasks = {};
                tasksList.forEach(task => {
                    if (!tasks[task.clientId]) {
                        tasks[task.clientId] = [];
                    }
                    tasks[task.clientId].push(task);
                });
                
                console.log(`Chargement de ${tasksList.length} tâches pour ${Object.keys(tasks).length} clients`);
            } else {
                console.log('Fichier de tâches vide, initialisation de tâches par défaut');
                createDefaultTasks();
            }
        } else {
            console.log('Fichier de tâches non trouvé, initialisation de tâches par défaut');
            createDefaultTasks();
        }
    } catch (error) {
        console.error('Erreur lors du chargement des tâches:', error);
        createDefaultTasks();
    }
}

// Fonction pour créer des tâches par défaut pour les clients
function createDefaultTasks() {
    tasks = {};
    
    // Créer des tâches par défaut pour chaque client
    clients.forEach((client, index) => {
        if (!client.id) {
            console.warn(`Client sans ID trouvé: ${client.nom} ${client.prenom}`);
            return;
        }
        
        // Créer des tâches pour ce client
        tasks[client.id] = [
            {
                id: `task_${client.id}_1`,
                clientId: client.id,
                description: `Préparer dossier ${client.nom}`,
                dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Date dans 7 jours
                completed: false,
                comment: `Première tâche pour ${client.prenom} ${client.nom}`
            },
            {
                id: `task_${client.id}_2`,
                clientId: client.id,
                description: `Contacter ${client.prenom} ${client.nom}`,
                dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Date dans 3 jours
                completed: index % 2 === 0, // Alterner entre complété et non complété
                comment: ``
            }
        ];
        
        console.log(`Tâches par défaut créées pour ${client.prenom} ${client.nom} (ID: ${client.id})`);
    });
}

// Fonction pour afficher les groupes de tâches
function renderTaskGroups() {
    console.log('Rendu des groupes de tâches...');
    const container = document.getElementById('tasksContainer');
    
    // Vérifier si le conteneur existe
    if (!container) {
        console.error("Conteneur 'tasksContainer' non trouvé dans le DOM");
        return;
    }
    
    container.innerHTML = '';
    
    // Ajouter un indicateur du nombre de clients actifs
    const statusElement = document.createElement('div');
    statusElement.className = 'clients-status';
    statusElement.textContent = `${clients.length} dossier(s) actif(s)`;
    container.appendChild(statusElement);
    
    // Si aucun client
    if (!clients || clients.length === 0) {
        container.innerHTML = '<div class="no-tasks">Aucun client trouvé. Ajoutez des clients dans la page principale.</div>';
        return;
    }
    
    // Afficher les clients chargés pour débogage
    console.log('Clients à afficher:', clients.map(c => `${c.nom} ${c.prenom} (ID: ${c.id})`));
    
    // Créer un groupe pour chaque client
    clients.forEach((client, index) => {
        // Format du nom du client
        const clientName = `${client.nom || ''} ${client.prenom || ''}`.trim();
        console.log(`Affichage du client: ${clientName} (ID: ${client.id})`);
        
        // Création du conteneur de groupe
        const group = document.createElement('div');
        group.className = 'task-group';
        group.dataset.clientId = client.id;
        
        // Création du tableau
        const table = document.createElement('table');
        table.className = 'task-table';
        
        // Utiliser les tâches réelles si disponibles, sinon créer des tâches exemple
        let clientTasks = [];
        if (tasks[client.id] && tasks[client.id].length > 0) {
            clientTasks = tasks[client.id];
            console.log(`${clientTasks.length} tâches trouvées pour ${clientName}`);
        } else {
            // Utiliser des tâches d'exemple seulement si nécessaire
            clientTasks = [
                {
                    id: `task_${client.id}_1`,
                    clientId: client.id,
                    description: "Préparer les conclusions",
                    dueDate: "2025-05-15",
                    completed: false,
                    comment: "Vérifier les documents avant envoi"
                },
                {
                    id: `task_${client.id}_2`,
                    clientId: client.id,
                    description: "Envoyer notification à l'adverse",
                    dueDate: "2025-05-20",
                    completed: true,
                    comment: "Notification envoyée par email"
                }
            ];
            
            // Mettre à jour la structure tasks
            tasks[client.id] = clientTasks;
        }
        
        // Calculer le pourcentage d'avancement
        const totalTasks = clientTasks.length;
        const completedTasks = clientTasks.filter(task => task.completed).length;
        const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        
        // Création de l'en-tête avec le nom du client et la barre de progression
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th class="client-name-header" colspan="5">
                    <span class="client-icon">👤</span> 
                    <span class="client-name">${clientName}</span>
                </th>
            </tr>
            <tr>
                <th colspan="5" class="progress-header">
                    <div class="progress-container">
                        <div class="progress-bar" style="width: ${progressPercentage}%"></div>
                        <div class="progress-number">
                            ${progressPercentage}% (${completedTasks}/${totalTasks} tâches terminées)
                        </div>
                    </div>
                </th>
            </tr>
            <tr>
                <th class="task-description">Tâche</th>
                <th class="task-date">Échéance</th>
                <th class="task-status">Statut</th>
                <th class="task-comment">Commentaire</th>
                <th class="task-actions-header">Actions</th>
            </tr>
        `;
        table.appendChild(thead);
        
        // Création du corps du tableau avec les tâches
        const tbody = document.createElement('tbody');
            
        // Ajouter les tâches au tableau
        clientTasks.forEach((task) => {
            const row = document.createElement('tr');
            if (task.completed) {
                row.classList.add('task-completed');
            }
            
            row.dataset.taskId = task.id;
            
            row.innerHTML = `
                <td class="task-description" data-task-id="${task.id}">
                    <span class="description-text">${task.description}</span>
                </td>
                <td class="task-date" data-task-id="${task.id}">
                    <span class="date-text${isDateOverdue(task.dueDate) && !task.completed ? ' date-overdue' : ''}">
                        ${formatDate(task.dueDate)}
                    </span>
                </td>
                <td class="task-status">
                    <div class="status-container">
                        <input type="checkbox" class="task-checkbox" data-task-id="${task.id}" data-client-id="${client.id}" 
                            ${task.completed ? 'checked' : ''}>
                    </div>
                </td>
                <td class="task-comment" data-task-id="${task.id}">
                    ${task.comment ? 
                        `<span class="comment-text">${task.comment}</span>` : 
                        `<span class="comment-text empty-comment">Ajouter un commentaire...</span>`
                    }
                </td>
                <td class="task-actions">
                    <button class="action-btn delete-task-btn" data-task-id="${task.id}" title="Supprimer">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                            <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                        </svg>
                    </button>
                </td>
            `;
            
            tbody.appendChild(row);
        });
        
        table.appendChild(tbody);
        group.appendChild(table);
        container.appendChild(group);
    });
    
    // Ajouter les gestionnaires d'événements pour les cases à cocher, etc.
    
    console.log('Rendu terminé');
}

// Ajouter cette fonction juste après renderTaskGroups
function attachCheckboxListeners() {
    console.log('Ajout des gestionnaires pour les cases à cocher...');

    document.querySelectorAll('.task-checkbox').forEach(checkbox => {
        // Vérifier si un listener est déjà attaché
        if (checkbox.dataset.listenerAttached === 'true') {
            return;
        }
        checkbox.dataset.listenerAttached = 'true';

        // Utiliser une fonction async pour pouvoir utiliser await pour saveTasks
        checkbox.addEventListener('change', async function() {
            const taskId = this.dataset.taskId;
            const isChecked = this.checked;
            const clientId = this.dataset.clientId;

            console.log(`Case à cocher changée: ${taskId}, état: ${isChecked}, client: ${clientId}`);

            const row = this.closest('tr');
            if (row) {
                // 1. Mettre à jour la classe de la ligne (pour le style général de la tâche terminée)
                row.classList.toggle('task-completed', isChecked);

                // 2. Mettre à jour la classe 'date-overdue' sur le span de la date
                const dateSpan = row.querySelector('.date-text');
                if (dateSpan) {
                    let taskDueDate = null;
                    // Essayer de trouver la date d'échéance dans la structure de données 'tasks'
                    if (tasks && tasks[clientId]) {
                        const taskData = tasks[clientId].find(t => t.id === taskId);
                        if (taskData) {
                            taskDueDate = taskData.dueDate; // Récupère la date (ex: "2025-05-10")
                        } else {
                            console.warn(`Données de tâche non trouvées pour ${taskId} dans tasks[${clientId}]`);
                        }
                    } else {
                         console.warn(`Données client non trouvées pour ${clientId} dans tasks`);
                    }

                    // Déterminer si la classe 'date-overdue' doit être appliquée
                    const shouldBeOverdue = isDateOverdue(taskDueDate) && !isChecked;
                    dateSpan.classList.toggle('date-overdue', shouldBeOverdue);
                    console.log(`Mise à jour classe date-overdue pour ${taskId}: ${shouldBeOverdue} (Date: ${taskDueDate})`);

                } else {
                    console.warn(`Span de date (.date-text) non trouvé pour la tâche ${taskId}`);
                }
                // Fin de la mise à jour de la classe date-overdue

            } else {
                console.warn(`Impossible de trouver la ligne (tr) pour la tâche ${taskId}`);
            } // Fin du if (row)

            // 3. Mettre à jour les données en mémoire ET la barre de progression
            // Cette fonction appelle updateProgressBar à l'intérieur
            const statusUpdated = updateTaskStatus(clientId, taskId, isChecked);

            // 4. Sauvegarder les tâches si la mise à jour en mémoire a réussi
            if (statusUpdated) {
                try {
                    // Utiliser await car saveTasks peut être asynchrone (si vous avez fait les modifs IPC)
                    await saveTasks();
                } catch (saveError) {
                    console.error("Erreur lors de la sauvegarde après changement de statut:", saveError);
                    alert("Erreur lors de la sauvegarde du statut de la tâche.");
                }
            } else {
                console.error("Le statut de la tâche n'a pas pu être mis à jour dans les données (updateTaskStatus a retourné false).");
                // Peut-être décocher la case pour refléter l'échec ?
                // this.checked = !isChecked;
                // row.classList.toggle('task-completed', !isChecked);
                // Mettre à jour à nouveau la classe date-overdue si on annule
            }
        }); // Fin de l'addEventListener
    }); // Fin du forEach
    console.log('Gestionnaires pour les cases à cocher ajoutés/vérifiés.');
}

// Assurez-vous que isDateOverdue gère correctement les dates null/undefined/vides
function isDateOverdue(dateString) {
    // Si dateString est null, undefined, vide ou '—', ce n'est pas en retard
    if (!dateString || dateString === '—') return false;
    try {
        let taskDate;
        // Gérer les formats YYYY-MM-DD et DD/MM/YYYY
        if (dateString.includes('/')) {
            const parts = dateString.split('/');
            // Attention: Mois est 0-indexé dans new Date()
            taskDate = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
        } else {
            // S'assurer que l'heure est à minuit pour comparer les jours
            // Utiliser Z pour UTC ou ajuster selon le fuseau horaire si nécessaire
            // Si vos dates sont locales, ne pas mettre 'Z'
            taskDate = new Date(dateString + 'T00:00:00');
        }

        // Vérifier si la date est valide
        if (isNaN(taskDate.getTime())) {
            console.warn("Date invalide détectée dans isDateOverdue:", dateString);
            return false;
        }

        const now = new Date();
        // Mettre l'heure actuelle à minuit pour comparer uniquement les jours
        now.setHours(0, 0, 0, 0);
        taskDate.setHours(0, 0, 0, 0); // Assurer la comparaison au même fuseau

        return taskDate < now;
    } catch (e) {
        console.error("Erreur dans isDateOverdue:", dateString, e);
        return false;
    }
}

// Ajouter cette fonction après attachCheckboxListeners
function attachDeleteButtonListeners() {
    console.log('Ajout des gestionnaires pour les boutons de suppression...');
    
    document.querySelectorAll('.delete-task-btn').forEach(button => {
        button.addEventListener('click', function() {
            const taskId = this.dataset.taskId;
            console.log(`Clic sur bouton supprimer pour tâche: ${taskId}`);
            
            if (confirm('Êtes-vous sûr de vouloir supprimer cette tâche ?')) {
                // Trouver la tâche dans la structure de données
                const clientId = findClientIdByTaskId(taskId);
                if (!clientId) {
                    console.error(`Client ID non trouvé pour la tâche ${taskId}`);
                    return;
                }
                
                // Trouver l'index de la tâche
                const taskIndex = tasks[clientId].findIndex(t => t.id === taskId);
                if (taskIndex === -1) {
                    console.error(`Tâche ${taskId} non trouvée pour client ${clientId}`);
                    return;
                }
                
                // Supprimer la tâche
                tasks[clientId].splice(taskIndex, 1);
                console.log(`Tâche ${taskId} supprimée de la structure de données`);
                
                // Supprimer du DOM avec animation
                const taskRow = this.closest('tr');
                taskRow.classList.add('deleting');
                
                setTimeout(() => {
                    if (taskRow.parentNode) {
                        taskRow.parentNode.removeChild(taskRow);
                    }
                    
                    // Mettre à jour la progression
                    updateProgressBar(clientId);
                    
                    // Sauvegarder les changements
                    saveTasks();
                }, 300);
            }
        });
    });
}

// Le chemin du fichier clients est déjà défini en haut du fichier
console.log('Chemin du fichier clients:', clientsFilePath);

// Variables globales sont déjà déclarées en haut du fichier
// Variable tasks already declared at the top of the file

// Fonction pour vérifier l'accès au fichier de tâches
function checkTasksFileAccess() {
    const tasksFilePath = path.resolve(__dirname, 'taches.json');
    console.log('Vérification du fichier de tâches:', tasksFilePath);
    
    try {
        // Vérifier si le fichier existe
        const exists = fs.existsSync(tasksFilePath);
        console.log('Le fichier existe:', exists);
        
        if (exists) {
            // Vérifier si on peut le lire
            const content = fs.readFileSync(tasksFilePath, 'utf8');
            console.log('Lecture du fichier réussie, taille:', content.length);
            
            // Vérifier si on peut y écrire
            const testPath = path.join(path.dirname(tasksFilePath), 'write_test.tmp');
            fs.writeFileSync(testPath, 'test', 'utf8');
            fs.unlinkSync(testPath);
            console.log('Test d\'écriture réussi');
            
            return {
                success: true,
                message: 'Accès au fichier de tâches vérifié avec succès'
            };
        } else {
            // Essayer de créer le fichier
            fs.writeFileSync(tasksFilePath, '[]', 'utf8');
            console.log('Fichier de tâches créé avec succès');
            
            return {
                success: true,
                message: 'Fichier de tâches créé avec succès'
            };
        }
    } catch (error) {
        console.error('Erreur lors de la vérification du fichier de tâches:', error);
        return {
            success: false,
            message: `Erreur d'accès au fichier: ${error.message}`
        };
    }
}

// Fonction pour créer l'interface de recherche et tri
function createSearchAndSortInterface() {
    const container = document.getElementById('tasksContainer');
    if (!container) return;
    
    // Créer l'élément manuellement
    const searchAndFilter = document.createElement('div');
    searchAndFilter.className = 'search-and-filter';
    
    // Utiliser du HTML simple
    searchAndFilter.innerHTML = `
        <div class="search-container">
            <input type="text" id="searchInput" placeholder="Rechercher un client ou une tâche..." class="search-input">
            <button id="searchButton" class="search-button">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
            </button>
        </div>
        <div class="sort-container">
            <label for="sortOptions">Trier par:</label>
            <select id="sortOptions" class="sort-select">
                <option value="client">Nom de client</option>
                <option value="date">Date d'échéance</option>
                <option value="status">Statut</option>
            </select>
            <button id="sortDirection" class="sort-direction" title="Inverser l'ordre de tri">▼</button>
        </div>
        <div class="quick-filters">
            <button class="quick-filter-btn active" data-filter="all">Tous</button>
            <button class="quick-filter-btn" data-filter="pending">En attente</button>
            <button class="quick-filter-btn" data-filter="completed">Terminés</button>
            <button class="quick-filter-btn" data-filter="overdue">En retard</button>
        </div>
    `;
    
    // Insérer au début du conteneur
    container.insertBefore(searchAndFilter, container.firstChild);
    
    // Vérifier si l'insertion a réussi
    console.log('Interface de recherche et tri insérée:', !!document.getElementById('searchInput'));
    console.log('Bouton de tri inséré:', !!document.getElementById('sortDirection'));
    console.log('Contenu du bouton de tri:', document.getElementById('sortDirection').textContent);
}

// Au chargement du document
document.addEventListener('DOMContentLoaded', () => {
    // Vérifier l'accès au fichier de tâches
    const fileCheck = checkTasksFileAccess();
    if (!fileCheck.success) {
        alert(`Attention: ${fileCheck.message}. Certaines fonctionnalités peuvent ne pas fonctionner correctement.`);
    }
    
    // Initialisation du bouton de thème si présent
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        initializeTheme();
    }
    
    // Initialiser les gestionnaires d'événements
    initEventListeners();
    
    // Créer l'interface de recherche et tri
    createSearchAndSortInterface();
    
    // Charger les données
    loadData();

    // Ajouter l'initialisation de la recherche et du tri
    initSearchAndSort();
    addEditableFieldListeners(); // Appeler la fonction mise à jour

    console.log("Initialisation DOMContentLoaded terminée.");
});

// Créer des exemples de tâches pour la démonstration
function createExampleTasks() {
    // Pour chaque client, nous allons créer des tâches d'exemple
    clients.forEach((client, index) => {
        // Créer l'ID du client s'il n'existe pas
        if (!client.id) {
            client.id = `client_${index}`;
        }
    });
}

// Initialiser les gestionnaires d'événements
function initEventListeners() {
    // Retour à l'accueil
    document.getElementById('backToHomeBtn').addEventListener('click', () => {
        window.location.href = 'index.html';
    });
    
    // Ajouter une tâche
    document.getElementById('addTaskBtn').addEventListener('click', () => {
        addNewTask();
    });

    // Bouton de débogage
    document.getElementById('debugBtn').addEventListener('click', () => {
        showDebugInfo();
    });
}


// Fonction pour rafraîchir l'affichage des tâches d'un client
function refreshTaskList(clientId) {
    console.log(`Rafraîchissement des tâches pour le client ${clientId}`);
    
    // Recharger les tâches depuis la structure de données
    loadTasks();
    
    // Trouver le groupe de tâches pour ce client
    const taskGroup = document.querySelector(`div[data-client-id='${clientId}']`);
    if (!taskGroup) {
        console.error(`Groupe de tâches non trouvé pour le client ${clientId}, rechargement complet`);
        renderTaskGroups();
        return;
    }
    
    // Récupérer les tâches du client
    const clientTasks = tasks[clientId] || [];
    
    // Si le client n'a pas de tâches, recharger tout
    if (clientTasks.length === 0) {
        console.warn(`Aucune tâche trouvée pour le client ${clientId}`);
        renderTaskGroups();
        return;
    }
    
    // Récupérer le tableau existant
    const table = taskGroup.querySelector('table');
    if (!table) {
        console.error(`Tableau non trouvé pour le client ${clientId}`);
        renderTaskGroups();
        return;
    }
    
    // Récupérer l'en-tête du tableau
    const thead = table.querySelector('thead');
    
    // Calculer le nouveau pourcentage d'avancement
    const totalTasks = clientTasks.length;
    const completedTasks = clientTasks.filter(task => task.completed).length;
    const progressPercentage = Math.round((completedTasks / totalTasks) * 100);
    
    // Mettre à jour la barre de progression
    const progressBar = thead.querySelector('.progress-bar');
    const progressNumber = thead.querySelector('.progress-number');
    
    if (progressBar && progressNumber) {
        progressBar.style.width = `${progressPercentage}%`;
        progressNumber.textContent = `${progressPercentage}% (${completedTasks}/${totalTasks} tâches terminées)`;
    }
    
    // Créer un nouveau corps de tableau
    const tbody = document.createElement('tbody');
    
    // Ajouter chaque tâche au corps du tableau
    clientTasks.forEach(task => {
        const row = document.createElement('tr');
        if (task.completed) {
            row.classList.add('task-completed');
        }
        
        row.dataset.taskId = task.id;
        
        row.innerHTML = `
            <td class="task-description" data-task-id="${task.id}">
                <span class="description-text">${task.description}</span>
            </td>
            <td class="task-date" data-task-id="${task.id}">
                <span class="date-text${isDateOverdue(task.dueDate) && !task.completed ? ' date-overdue' : ''}">
                    ${formatDate(task.dueDate)}
                </span>
            </td>
            <td class="task-status">
                <div class="status-container">
                    <input type="checkbox" class="task-checkbox" data-task-id="${task.id}" data-client-id="${clientId}" 
                        ${task.completed ? 'checked' : ''}>
                </div>
            </td>
            <td class="task-comment" data-task-id="${task.id}">
                ${task.comment ? 
                    `<span class="comment-text">${task.comment}</span>` : 
                    `<span class="comment-text empty-comment">Ajouter un commentaire...</span>`
                }
            </td>
            <td class="task-actions">
                <button class="action-btn delete-task-btn" data-task-id="${task.id}" title="Supprimer">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                        <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                    </svg>
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    const oldTbody = table.querySelector('tbody');
    if (oldTbody) {
        table.replaceChild(tbody, oldTbody);
    } else {
        table.appendChild(tbody);
    }
    
    console.log('Corps de tableau mis à jour, ajout des gestionnaires d\'événements');
    
    
    // Gestionnaires spécifiques pour les cases à cocher et boutons de suppression
    taskGroup.querySelectorAll('.task-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const taskId = this.dataset.taskId;
            const isChecked = this.checked;
            const clientId = this.dataset.clientId;
            
            // Mettre à jour l'apparence
            const row = this.closest('tr');
            row.classList.toggle('task-completed', isChecked);
            
            // Mettre à jour les données
            updateTaskStatus(clientId, taskId, isChecked);
            // Sauvegarder le changement
            saveTasks();
        });
    });
    
    taskGroup.querySelectorAll('.delete-task-btn').forEach(button => {
        button.addEventListener('click', function() {
            const taskId = this.dataset.taskId;
            deleteTask(taskId);
        });
    });
    
    console.log(`Affichage rafraîchi pour le client ${clientId}`);
}

// Fonction pour sauvegarder un commentaire
function saveComment(taskId, commentText, commentCell) {
    // Si le commentaire est vide, afficher le texte d'invite
    const displayText = commentText.trim() === '' ? 'Cliquez pour ajouter un commentaire' : commentText;
    
    console.log(`Commentaire sauvegardé pour la tâche ${taskId}: ${commentText}`);
    
    // Recréer la structure du commentaire
    commentCell.innerHTML = `
        <span class="comment-text${displayText === 'Cliquez pour ajouter un commentaire' ? ' comment-placeholder' : ''}">${displayText}</span>
    `;
    
    // Réattacher le gestionnaire d'événement (important !)
    commentCell.addEventListener('click', function() {
        const taskId = this.dataset.taskId;
        const commentText = this.querySelector('.comment-text');
        const currentText = commentText.textContent;
        
        // Ne pas transformer en champ d'édition si déjà en cours d'édition
        if (this.querySelector('.comment-input')) {
            return;
        }
        
        // Créer un champ de saisie et le reste du code...
        // (code similaire à celui dans renderTaskGroups)
    });
}

// Fonction pour sauvegarder une description
function saveDescription(taskId, descriptionText, descriptionCell) {
    // Validation simple: ne pas accepter une description vide
    if (!descriptionText.trim()) {
        alert('La description ne peut pas être vide.');
        
        // Recréer le champ d'édition pour permettre une nouvelle saisie
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'description-input';
        input.value = '';
        
        descriptionCell.innerHTML = '';
        descriptionCell.appendChild(input);
        input.focus();
        
        return;
    }
    
    console.log(`Description sauvegardée pour la tâche ${taskId}: ${descriptionText}`);
    
    // Recréer la structure de la description
    descriptionCell.innerHTML = `
        <span class="description-text">${descriptionText}</span>
    `;
    
    // Réattacher le gestionnaire d'événement
    descriptionCell.addEventListener('click', function() {
        // Code d'édition similaire à ci-dessus
    });
}

// Fonction pour sauvegarder une date
function saveDate(taskId, dateValue, dateCell) {
    console.log(`Date sauvegardée pour la tâche ${taskId}: ${dateValue}`);
    
    // Formatter la date pour l'affichage
    const displayDate = dateValue ? formatDate(dateValue) : '—';
    
    // Recréer la structure de la date
    dateCell.innerHTML = `
        <span class="date-text">${displayDate}</span>
    `;
    
    // Réattacher le gestionnaire d'événement
    dateCell.addEventListener('click', function() {
        // Code d'édition similaire à ci-dessus
    });
}

// Formater une date (YYYY-MM-DD → DD/MM/YYYY)
function formatDate(dateString) {
    if (!dateString) return '—';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    } catch (e) {
        console.error('Erreur de formatage de date:', dateString, e);
        return dateString;
    }
}

// Vérifier si une date est dépassée
function isDateOverdue(dateString) {
    if (!dateString || dateString === '—') return false;
    try {
        let taskDate;
        if (dateString.includes('/')) {
            const parts = dateString.split('/');
            taskDate = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
        } else {
            taskDate = new Date(dateString + 'T00:00:00');
        }
        if (isNaN(taskDate.getTime())) {
            console.warn("Date invalide détectée dans isDateOverdue:", dateString);
            return false;
        }
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        taskDate.setHours(0, 0, 0, 0);
        return taskDate < now;
    } catch (e) {
        console.error("Erreur dans isDateOverdue:", dateString, e);
        return false;
    }
}

// Ajouter une nouvelle tâche (fonction mise à jour)
function addNewTask() {
    console.log("Ouverture du formulaire d'ajout de tâche");
    
    // Créer le formulaire d'ajout
    const form = document.createElement('div');
    form.className = 'edit-task-form';
    
    // Récupérer la liste des clients pour le sélecteur
    const clientOptions = clients.map(client => {
        const clientName = `${client.nom || ''} ${client.prenom || ''}`.trim();
        return `<option value="${client.id}">${clientName}</option>`;
    }).join('');
    
    form.innerHTML = `
        <div class="edit-form-header">Ajouter une nouvelle tâche</div>
        <div class="edit-form-field">
            <label for="new-client">Client:</label>
            <select id="new-client" required>
                <option value="" disabled selected>Sélectionnez un client</option>
                ${clientOptions}
            </select>
        </div>
        <div class="edit-form-field">
            <label for="new-description">Description:</label>
            <input type="text" id="new-description" placeholder="Description de la tâche" required>
        </div>
        <div class="edit-form-field">
            <label for="new-date">Date d'échéance:</label>
            <input type="date" id="new-date">
        </div>
        <div class="edit-form-field">
            <label for="new-comment">Commentaire (optionnel):</label>
            <input type="text" id="new-comment" placeholder="Ajouter un commentaire">
        </div>
        <div class="edit-form-actions">
            <button type="button" class="btn-cancel">Annuler</button>
            <button type="button" class="btn-save">Ajouter</button>
        </div>
    `;
    
    // Créer un overlay et ajouter le formulaire
    const overlay = document.createElement('div');
    overlay.className = 'task-edit-overlay';
    overlay.appendChild(form);
    document.body.appendChild(overlay);
    
    // Focus sur le sélecteur de client
    setTimeout(() => {
        const clientSelect = overlay.querySelector('#new-client');
        if (clientSelect) {
            clientSelect.focus();
        }
    }, 10);
    
    // Gestionnaire pour le bouton Annuler
    overlay.querySelector('.btn-cancel').addEventListener('click', () => {
        document.body.removeChild(overlay);
    });
    
    // Gestionnaire pour le bouton Ajouter
    overlay.querySelector('.btn-save').addEventListener('click', () => {
        // Récupérer les valeurs du formulaire
        const clientId = overlay.querySelector('#new-client').value;
        const description = overlay.querySelector('#new-description').value.trim();
        const dueDate = overlay.querySelector('#new-date').value;
        const comment = overlay.querySelector('#new-comment').value.trim();
        
        console.log('Ajout de tâche:', { clientId, description, dueDate, comment });
        
        // Validation
        if (!clientId) {
            alert('Veuillez sélectionner un client.');
            return;
        }
        if (!description) {
            alert('La description ne peut pas être vide.');
            return;
        }
        
        // Créer un nouvel ID de tâche unique
        const newTaskId = `task_${Date.now()}`;
        
        // Créer la nouvelle tâche
        const newTask = {
            id: newTaskId,
            clientId: clientId,
            description: description,
            dueDate: dueDate || null,
            completed: false,
            comment: comment || ''
        };
        
        console.log('Nouvelle tâche créée:', newTask);
        
        try {
            // S'assurer que tasks est initialisé
            if (!window.tasks) {
                window.tasks = {};
            }
            
            // Ajouter la tâche à la structure de données
            if (!tasks[clientId]) {
                tasks[clientId] = [];
            }
            
            tasks[clientId].push(newTask);
            console.log(`Tâche ajoutée à tasks[${clientId}], total: ${tasks[clientId].length} tâches`);
            
            // Déboguer la structure actuelle
            console.log('Structure des tâches actuelle:', JSON.stringify(tasks));
            
            // Sauvegarder les modifications
            const saveSuccess = saveTasks();
            
            if (saveSuccess) {
                console.log('Sauvegarde réussie, fermeture du formulaire');
                // Fermer l'overlay
                document.body.removeChild(overlay);
                console.log('Actualisation de l\'affichage après ajout de la tâche');

                // Rafraîchir uniquement les tâches du client concerné
                refreshTaskList(clientId);

            } else {
                console.error('Échec de la sauvegarde');
                alert('La tâche a été créée mais n\'a pas pu être sauvegardée. Veuillez vérifier la console pour plus d\'informations.');
            }
        } catch (error) {
            console.error('Erreur lors de l\'ajout de la tâche:', error);
            alert(`Erreur lors de l'ajout de la tâche: ${error.message}`);
        }
    });
}

// Initialiser le thème (si applicable)
function initializeTheme() {
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');
    const themeText = document.getElementById('themeText');
    
    // Charger le thème sauvegardé
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    // Mettre à jour l'apparence du bouton
    if (themeIcon && themeText) {
        themeIcon.textContent = savedTheme === 'dark' ? '🌜' : '🌞';
        themeText.textContent = savedTheme === 'dark' ? 'Mode clair' : 'Mode sombre';
    }
    
    // Ajouter le gestionnaire d'événements
    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        
        if (themeIcon && themeText) {
            themeIcon.textContent = newTheme === 'dark' ? '🌜' : '🌞';
            themeText.textContent = newTheme === 'dark' ? 'Mode clair' : 'Mode sombre';
        }
    });
}

// Fonction de débogage
function showDebugInfo() {
    console.log('=== INFORMATIONS DE DÉBOGAGE ===');
    console.log('Chemin du fichier clients:', clientsFilePath);
    console.log('Le fichier existe:', fs.existsSync(clientsFilePath));
    console.log('Nombre de clients chargés:', clients ? clients.length : 0);
    if (clients && clients.length > 0) {
        console.log('Premier client:', clients[0]);
    }
    
    // Afficher dans une alerte
    alert(`Informations de débogage:
    - Chemin du fichier: ${clientsFilePath}
    - Le fichier existe: ${fs.existsSync(clientsFilePath)}
    - Nombre de clients: ${clients ? clients.length : 0}
    
    Consultez la console pour plus de détails.`);
}

// Fonction pour modifier une tâche
function editTask(taskId) {
    console.log('Édition de la tâche:', taskId);
    
    // Trouver la tâche dans le DOM
    const taskRow = document.querySelector(`[data-task-id="${taskId}"]`).closest('tr');
    if (!taskRow) {
        console.error(`Impossible de trouver la ligne pour la tâche ${taskId}`);
        return;
    }
    
    const descriptionCell = taskRow.querySelector('.task-description');
    const dateCell = taskRow.querySelector('.task-date');
    const description = descriptionCell.textContent || '';
    const dateText = dateCell.textContent || '';
    
    console.log('Description:', description);
    console.log('Date:', dateText);
    
    // Convertir la date du format DD/MM/YYYY au format YYYY-MM-DD pour l'input date
    let dateValue = '';
    if (dateText && dateText !== '—') {
        try {
            const [day, month, year] = dateText.split('/');
            dateValue = `${year}-${month}-${day}`;
        } catch (e) {
            console.error('Erreur de conversion de date:', e);
        }
    }
    
    // Créer un formulaire d'édition
    const form = document.createElement('div');
    form.className = 'edit-task-form';
    form.innerHTML = `
        <div class="edit-form-header">Modifier la tâche</div>
        <div class="edit-form-field">
            <label for="edit-description">Description:</label>
            <input type="text" id="edit-description" value="${description}" required>
        </div>
        <div class="edit-form-field">
            <label for="edit-date">Date:</label>
            <input type="date" id="edit-date" value="${dateValue}">
        </div>
        <div class="edit-form-actions">
            <button type="button" class="btn-cancel">Annuler</button>
            <button type="button" class="btn-save">Enregistrer</button>
        </div>
    `;
    
    // Créer un overlay et ajouter le formulaire
    const overlay = document.createElement('div');
    overlay.className = 'task-edit-overlay';
    overlay.appendChild(form);
    document.body.appendChild(overlay);
    
    // Focus sur le champ de description
    setTimeout(() => {
        const descInput = overlay.querySelector('#edit-description');
        if (descInput) {
            descInput.focus();
            descInput.select();
        }
    }, 10);
    
    // Gestionnaires d'événements pour les boutons
    overlay.querySelector('.btn-cancel').addEventListener('click', () => {
        document.body.removeChild(overlay);
    });
    
    overlay.querySelector('.btn-save').addEventListener('click', () => {
        const newDescription = overlay.querySelector('#edit-description').value;
        const newDate = overlay.querySelector('#edit-date').value;
        
        // Validation simple
        if (!newDescription.trim()) {
            alert('La description ne peut pas être vide.');
            return;
        }
        
        console.log(`Sauvegarde des modifications: ${newDescription}, ${newDate}`);
        
        // Mise à jour visuelle des cellules
        descriptionCell.textContent = newDescription;
        dateCell.textContent = newDate ? formatDate(newDate) : '—';
        
        // Fermer l'overlay
        document.body.removeChild(overlay);
    });
}

// Fonction pour supprimer une tâche
function deleteTask(taskId) {
    console.log('Suppression de la tâche:', taskId);
    
    if (confirm('Êtes-vous sûr de vouloir supprimer cette tâche ?')) {
        // Trouver la ligne de la tâche
        const taskRow = document.querySelector(`[data-task-id="${taskId}"]`).closest('tr');
        if (!taskRow) {
            console.error(`Impossible de trouver la ligne pour la tâche ${taskId}`);
            return;
        }
        
        // Ajouter la classe pour l'animation de suppression
        taskRow.classList.add('deleting');
        
        // Attendre la fin de l'animation avant de supprimer réellement
        setTimeout(() => {
            // Vérifier si l'élément existe toujours (au cas où la page aurait été rafraîchie)
            if (taskRow.parentNode) {
                taskRow.parentNode.removeChild(taskRow);
                console.log(`Tâche ${taskId} supprimée du DOM`);
                
                // Mettre à jour la barre de progression si nécessaire
                updateProgressBar();
            }
        }, 300); // Correspond à la durée de l'animation dans le CSS
    }
}

// Gère la perte de focus pour sauvegarder (utilisé par le listener délégué)
function handleEditableBlur(e) {
    const input = e.target;
    // Vérifier si c'est bien un input de notre système éditable
    if (!input.matches('.description-input, .date-input, .comment-input')) {
        return;
    }

    const cell = input.closest('td');
    if (!cell) return;
    const taskId = cell.dataset.taskId;
    const fieldType = input.dataset.fieldType;
    const textElement = cell.querySelector('.description-text, .date-text, .comment-text');

    if (!textElement || !fieldType || !taskId) {
        console.error("Blur: Éléments/Données manquants pour sauvegarder.");
        // Ne pas retirer l'input ici, saveField le fera si nécessaire
        return;
    }

    // Utiliser setTimeout pour les dates pour éviter conflit avec 'change'
    // et pour permettre au clic sur le calendrier de fonctionner
    if (fieldType === 'date') {
        console.log(`Blur détecté sur date (Tâche ${taskId}). Appel de saveField différé.`);
        setTimeout(() => {
            // Vérifier si l'input existe toujours (n'a pas été retiré par Echap par ex.)
            // et s'il est toujours dans le DOM
            if (input && input.closest('body')) {
                 console.log(`Timeout Blur (date): Appel de saveField pour ${taskId}.`);
                 saveField(input, textElement, fieldType, taskId);
            } else {
                 console.log(`Timeout Blur (date): Input déjà retiré pour ${taskId}, abandon.`);
            }
        }, 150); // Léger délai pour le date picker
    } else {
        console.log(`Blur détecté sur ${fieldType} (Tâche ${taskId}). Appel direct de saveField.`);
        // Pour les autres champs, on peut sauvegarder directement sur blur
        saveField(input, textElement, fieldType, taskId);
    }
}

// Gère les touches Entrée/Échap (utilisé par le listener délégué)
function handleEditableKeydown(e) {
    const input = e.target;
    if (!input.matches('.description-input, .date-input, .comment-input')) {
        return;
    }
    const cell = input.closest('td');
    if (!cell) return;
    const taskId = cell.dataset.taskId;
    const fieldType = input.dataset.fieldType;
    const textElement = cell.querySelector('.description-text, .date-text, .comment-text');

    if (!textElement || !fieldType || !taskId) return;

    if (e.key === 'Enter') {
        console.log(`Entrée sur ${fieldType} (Tâche ${taskId}). Déclenchement du blur.`);
        input.blur(); // Déclencher blur pour sauvegarder (géré par handleEditableBlur)
        e.preventDefault(); // Empêcher le comportement par défaut (ex: saut de ligne textarea)
    } else if (e.key === 'Escape') {
        console.log(`Échap sur ${fieldType} (Tâche ${taskId}). Annulation.`);
        // Restaurer l'affichage original et supprimer l'input
        textElement.textContent = input.dataset.originalDisplayValue;
        if (fieldType === 'comment') {
             const isEmpty = !input.dataset.originalDisplayValue || input.dataset.originalDisplayValue === 'Ajouter un commentaire...' || input.dataset.originalDisplayValue === 'Cliquez pour ajouter un commentaire';
             textElement.classList.toggle('comment-placeholder', isEmpty);
             textElement.classList.toggle('empty-comment', isEmpty);
             if (isEmpty) textElement.textContent = 'Ajouter un commentaire...';
        }
        textElement.style.display = '';
        if (input.parentNode) {
            input.remove();
        }
    }
}

// Nouvelle fonction addEditableFieldListeners (utilise la délégation)
function addEditableFieldListeners() {
    console.log('Initialisation des champs éditables via délégation...');
    const container = document.getElementById('tasksContainer');
    if (!container) {
        console.error("Conteneur #tasksContainer non trouvé pour délégation.");
        return;
    }

    // --- CLICK Listener (Délégué) ---
    // Détecte les clics sur les cellules éditables pour démarrer l'édition
    container.removeEventListener('click', handleDelegatedClick); // Eviter doublons
    container.addEventListener('click', handleDelegatedClick);

    // --- BLUR Listener (Délégué) ---
    // Détecte la perte de focus des inputs créés. Utilise la phase de capture car blur ne bulle pas.
    container.removeEventListener('blur', handleEditableBlur, true); // Eviter doublons
    container.addEventListener('blur', handleEditableBlur, true);

    // --- KEYDOWN Listener (Délégué) ---
    // Détecte Entrée/Échap dans les inputs créés
    container.removeEventListener('keydown', handleEditableKeydown); // Eviter doublons
    container.addEventListener('keydown', handleEditableKeydown);

    // --- CHANGE Listener (Délégué) ---
    // Détecte les changements explicites (ex: sélection date picker)
    container.removeEventListener('change', handleDelegatedChange);
    container.addEventListener('change', handleDelegatedChange);

    console.log('Écouteurs délégués (édition, statut, suppression) attachés à #tasksContainer');
}


// Nouvelle fonction pour gérer les clics délégués
function handleDelegatedClick(e) {
    const target = e.target;

    // 1. Gérer le clic pour démarrer l'édition (ancien handleDelegatedClick)
    const editableCell = target.closest('.task-description, .task-date, .task-comment');
    if (editableCell && !target.closest('.action-btn') && !editableCell.querySelector('.description-input, .date-input, .comment-input')) {
        // Appeler la logique de démarrage d'édition (le contenu de l'ancien handleDelegatedClick)
        startEditingCell(editableCell, e); // Créer une fonction startEditingCell si besoin
        return; // Important pour ne pas traiter aussi comme un clic suppression
    }

    // 2. Gérer le clic sur le bouton supprimer
    const deleteButton = target.closest('.delete-task-btn');
    if (deleteButton) {
        const taskId = deleteButton.dataset.taskId;
        console.log(`Clic délégué sur bouton supprimer pour tâche: ${taskId}`);
        if (confirm('Êtes-vous sûr de vouloir supprimer cette tâche ?')) {
            deleteTaskLogic(taskId, deleteButton); // Créer une fonction deleteTaskLogic
        }
        return;
    }
}

// Nouvelle fonction pour gérer les changements délégués
async function handleDelegatedChange(e) { // async car on appelle saveTasks
    const target = e.target;

    // 1. Gérer le changement d'un input d'édition (ancien handleEditableChange)
    if (target.matches('.description-input, .date-input, .comment-input')) {
        const cell = target.closest('td');
        if (!cell) return;
        const taskId = cell.dataset.taskId;
        const fieldType = target.dataset.fieldType;
        const textElement = cell.querySelector('.description-text, .date-text, .comment-text');

        if (!textElement || !fieldType || !taskId) { /* ... erreur ... */ return; }

        if (fieldType === 'date') {
            console.log(`Change délégué sur date (Tâche ${taskId}). Ignoré (géré par blur).`);
            return;
        }
        console.log(`Change délégué sur ${fieldType} (Tâche ${taskId}). Appel de saveField.`);
        saveField(target, textElement, fieldType, taskId);
        return;
    }

    // 2. Gérer le changement d'une case à cocher
    if (target.matches('.task-checkbox')) {
        const checkbox = target;
        const taskId = checkbox.dataset.taskId;
        const isChecked = checkbox.checked;
        const clientId = checkbox.dataset.clientId;

        console.log(`Change délégué sur checkbox: ${taskId}, état: ${isChecked}, client: ${clientId}`);

        const row = checkbox.closest('tr');
        if (row) {
            row.classList.toggle('task-completed', isChecked);
            const dateSpan = row.querySelector('.date-text');
            if (dateSpan) {
                let taskDueDate = null;
                if (tasks && tasks[clientId]) {
                    const taskData = tasks[clientId].find(t => t.id === taskId);
                    if (taskData) taskDueDate = taskData.dueDate;
                }
                const shouldBeOverdue = isDateOverdue(taskDueDate) && !isChecked;
                dateSpan.classList.toggle('date-overdue', shouldBeOverdue);
            }
        }

        const statusUpdated = updateTaskStatus(clientId, taskId, isChecked);

        if (statusUpdated) {
            try {
                await saveTasks(); // Utiliser await ici
            } catch (saveError) {
                console.error("Erreur lors de la sauvegarde après changement de statut:", saveError);
                alert("Erreur lors de la sauvegarde du statut de la tâche.");
            }
        } else {
            console.error("Le statut de la tâche n'a pas pu être mis à jour.");
        }
        return;
    }
}

// Nouvelle fonction startEditingCell (reprend le contenu de handleDelegatedClick)
// --- AJOUTER L'IMPLÉMENTATION COMPLÈTE DE CETTE FONCTION ---
// (Reprend la logique de l'ancien handleEditableClick pour créer l'input)
function startEditingCell(cell, e) {
    console.log('startEditingCell: Démarrage édition pour cellule:', cell);
    const taskId = cell.dataset.taskId;
    if (!taskId) {
         console.warn("startEditingCell: Clic sur cellule sans data-task-id:", cell);
         return;
    }
    console.log(`startEditingCell: Traitement pour Tâche ${taskId}`);

    let textElement, inputType, inputClassName, originalValue, valueForInput, fieldType;

    // Déterminer le type de champ et récupérer les éléments nécessaires
    if (cell.classList.contains('task-description')) {
        fieldType = 'description';
        textElement = cell.querySelector('.description-text');
        if (!textElement) return;
        inputType = 'text'; // Ou 'textarea' si vous préférez
        inputClassName = 'description-input';
        originalValue = textElement.textContent?.trim() || '';
        valueForInput = originalValue; // Utiliser la valeur actuelle pour l'input
        console.log(`startEditingCell: Type=description, Original='${originalValue}'`);

    } else if (cell.classList.contains('task-date')) {
        fieldType = 'date';
        textElement = cell.querySelector('.date-text');
        if (!textElement) {
             console.error('startEditingCell (date): .date-text non trouvé!');
             return;
        }
        inputType = 'date'; // Utilisation de input type="date"
        inputClassName = 'date-input';
        originalValue = textElement.textContent?.trim() || ''; // Format DD/MM/YYYY ou '—'
        valueForInput = ''; // Valeur par défaut pour l'input (YYYY-MM-DD)

        console.log(`startEditingCell (date): Texte original affiché (originalValue): "${originalValue}"`);

        // Convertir DD/MM/YYYY en YYYY-MM-DD pour l'input type="date"
        if (originalValue && originalValue !== '—') {
            console.log('startEditingCell (date): Tentative conversion DD/MM/YYYY -> YYYY-MM-DD');
            try {
                const parts = originalValue.split('/');
                if (parts.length === 3) {
                    const day = parts[0].trim().padStart(2, '0');
                    const month = parts[1].trim().padStart(2, '0');
                    const year = parts[2].trim();
                    // Vérifier si les parties sont valides (simple vérification)
                    if (day && month && year && !isNaN(parseInt(day)) && !isNaN(parseInt(month)) && !isNaN(parseInt(year))) {
                         valueForInput = `${year}-${month}-${day}`;
                         console.log(`startEditingCell (date): Conversion réussie -> valueForInput: "${valueForInput}"`);
                    } else {
                         console.warn(`startEditingCell (date): Parties de date invalides après split:`, parts);
                    }
                } else {
                    console.warn(`startEditingCell (date): Format date inattendu (pas 3 parties /): "${originalValue}"`);
                }
            } catch (err) {
                console.error(`startEditingCell (date): Erreur conversion "${originalValue}":`, err);
            }
        } else {
             console.log(`startEditingCell (date): Date originale vide ou "—". valueForInput reste "${valueForInput}"`);
        }
        console.log(`startEditingCell: Type=date, Original='${originalValue}', InputValue='${valueForInput}'`);

    } else if (cell.classList.contains('task-comment')) {
        fieldType = 'comment';
        textElement = cell.querySelector('.comment-text');
        if (!textElement) return;
        inputType = 'text'; // Ou 'textarea'
        inputClassName = 'comment-input';
        originalValue = textElement.textContent?.trim() || '';
        // Si c'est le placeholder, mettre une chaîne vide dans l'input
        if (originalValue === 'Ajouter un commentaire...' || originalValue === 'Cliquez pour ajouter un commentaire') {
            valueForInput = '';
        } else {
            valueForInput = originalValue;
        }
        console.log(`startEditingCell: Type=comment, Original='${originalValue}', InputValue='${valueForInput}'`);

    } else {
        console.log('startEditingCell: Type de cellule inconnu.');
        return;
    }

    // Création de l'input
    console.log(`startEditingCell: Création input: type=${inputType}, class=${inputClassName}, value=${valueForInput}`);
    const input = document.createElement('input'); // Ou 'textarea' si besoin
    input.type = inputType;
    input.className = inputClassName;
    input.value = valueForInput;
    input.dataset.originalDisplayValue = originalValue; // Stocker l'affichage original (DD/MM/YYYY pour date)
    input.dataset.fieldType = fieldType;

    // Ajouter placeholder pour commentaire si vide
    if (fieldType === 'comment') {
        input.placeholder = 'Ajouter un commentaire...';
    }

    // Remplacer le texte par l'input
    console.log('startEditingCell: Masquage textElement et ajout input au DOM...');
    textElement.style.display = 'none';
    cell.appendChild(input);
    console.log('startEditingCell: Input ajouté. Tentative de focus...');

    input.focus();
    // Sélectionner le texte pour les inputs texte (pas utile pour date)
    if (input.type === 'text' && valueForInput !== '') {
        input.select();
        console.log('startEditingCell: Texte sélectionné.');
    }
    console.log('startEditingCell: Focus demandé.');

    // Arrêter la propagation pour éviter que le listener sur document ne ferme l'input immédiatement
    if (e) { // Vérifier si l'événement est passé
        e.stopPropagation();
        console.log('startEditingCell: Propagation du clic arrêtée.');
    }
    console.log('startEditingCell: Fin.');
}


// Nouvelle fonction deleteTaskLogic (reprend le contenu du listener du bouton delete)
function deleteTaskLogic(taskId, buttonElement) {
    const clientId = findClientIdByTaskId(taskId);
    if (!clientId) { /* ... erreur ... */ return; }
    const taskIndex = tasks[clientId].findIndex(t => t.id === taskId);
    if (taskIndex === -1) { /* ... erreur ... */ return; }

    tasks[clientId].splice(taskIndex, 1);
    console.log(`Tâche ${taskId} supprimée de la structure de données`);

    const taskRow = buttonElement.closest('tr');
    if (taskRow) {
        taskRow.classList.add('deleting');
        setTimeout(() => {
            if (taskRow.parentNode) {
                taskRow.parentNode.removeChild(taskRow);
            }
            updateProgressBar(clientId);
            saveTasks();
        }, 300);
    } else {
        // Si la ligne n'est pas trouvée, rafraîchir quand même
        updateProgressBar(clientId);
        saveTasks();
    }
}



/**
 * Tente de parser une chaîne en objet Date.
 * Accepte les formats YYYY-MM-DD et DD/MM/YYYY.
 * @param {string} dateString La chaîne à parser.
 * @returns {Date|null} Un objet Date valide ou null si le parsing échoue.
 */
function parseDateString(dateString) {
    if (!dateString) return null;
    dateString = dateString.trim();

    let date = null;

    // Essayer format YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        date = new Date(dateString + 'T00:00:00'); // Ajouter T00:00:00 pour éviter les pbs de fuseau
    }
    // Essayer format DD/MM/YYYY
    else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateString)) {
        const parts = dateString.split('/');
        // Attention: Mois est 0-indexé dans new Date()
        date = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
    }

    // Vérifier si la date résultante est valide
    if (date && !isNaN(date.getTime())) {
        return date;
    }

    return null; // Échec du parsing
}


// --- AJOUTER OU RESTAURER CETTE FONCTION ---
function saveField(inputElement, textElement, fieldType, taskId) {
    console.log(`saveField: Début pour ${fieldType} tâche ${taskId}`);

    // Si l'élément a déjà été retiré (par Escape ou un autre appel)
    if (!inputElement || !inputElement.parentNode) { // Vérification renforcée
        console.log("saveField: inputElement non trouvé ou sans parent, abandon.");
        return;
    }

    // Récupérer la valeur ISO actuelle et la valeur affichée originale
    let newValue = inputElement.value; // Valeur ISO pour date (YYYY-MM-DD ou ''), texte pour autres
    const originalDisplayValue = inputElement.dataset.originalDisplayValue; // Ancienne valeur affichée (DD/MM/YYYY ou '—')

    console.log(`saveField: Nouvelle valeur (input): '${newValue}', Ancienne valeur affichée: '${originalDisplayValue}'`);

    let hasChanged = false;
    let newDisplayValue = ''; // Nouvelle valeur à afficher
    let valueToUpdate = newValue; // Valeur à stocker (ISO pour date)

    switch (fieldType) {
        case 'description':
            if (!newValue.trim()) {
                alert('La description ne peut pas être vide.');
                inputElement.focus(); // Remettre le focus pour correction
                return; // Arrêter ici, ne pas sauvegarder ni retirer l'input
            }
            newDisplayValue = newValue;
            hasChanged = (newDisplayValue !== originalDisplayValue);
            valueToUpdate = newDisplayValue;
            break;

        case 'date':
            // --- VÉRIFICATION LOGS ---
            console.log(`saveField (date) - Comparaison pour hasChanged :`);
            console.log(`   > Nouvelle valeur affichable (newDisplayValue): "${newDisplayValue}" (Type: ${typeof newDisplayValue})`);
            console.log(`   > Ancienne valeur affichée (originalDisplayValue): "${originalDisplayValue}" (Type: ${typeof originalDisplayValue})`);

            if (newValue) {
                try {
                    const parsedDate = parseDateString(newValue);
                    if (!parsedDate) throw new Error('Date invalide depuis input[type=date]');
                    const day = parsedDate.getDate().toString().padStart(2, '0');
                    const month = (parsedDate.getMonth() + 1).toString().padStart(2, '0');
                    const year = parsedDate.getFullYear();
                    newDisplayValue = `${day}/${month}/${year}`;
                    valueToUpdate = newValue;
                    console.log(`saveField (date): Input date valide -> Affichage: ${newDisplayValue}, Sauvegarde: ${valueToUpdate}`);
                } catch (e) {
                    console.error("saveField (date): Erreur conversion date depuis input:", newValue, e);
                    newDisplayValue = originalDisplayValue;
                    valueToUpdate = (parseDateString(originalDisplayValue)) ? `${originalDisplayValue.split('/')[2]}-${originalDisplayValue.split('/')[1]}-${originalDisplayValue.split('/')[0]}` : null;
                    hasChanged = false;
                }
            } else {
                newDisplayValue = '—';
                valueToUpdate = null;
                console.log('saveField (date): Champ date vidé ou invalide.');
            }

            hasChanged = (newDisplayValue !== originalDisplayValue);
            console.log(`   > Résultat (hasChanged): ${hasChanged}`);
            console.log(`   > Valeur à sauvegarder (valueToUpdate):`, valueToUpdate);
            break;

        case 'comment':
            const isOriginalPlaceholder = originalDisplayValue === 'Cliquez pour ajouter un commentaire' || originalDisplayValue === 'Ajouter un commentaire...';
            if (!newValue.trim()) {
                newDisplayValue = 'Ajouter un commentaire...';
                valueToUpdate = '';
                hasChanged = !isOriginalPlaceholder;
            } else {
                newDisplayValue = newValue;
                valueToUpdate = newValue;
                hasChanged = (newDisplayValue !== originalDisplayValue);
            }
            break;

        default:
            console.error(`saveField: Type de champ inconnu: ${fieldType}`);
            if (textElement) textElement.style.display = '';
            if (inputElement && inputElement.parentNode) inputElement.remove();
            return;
    }

    textElement.textContent = newDisplayValue;
    if (fieldType === 'comment') {
        textElement.classList.toggle('comment-placeholder', newDisplayValue === 'Ajouter un commentaire...');
        textElement.classList.toggle('empty-comment', newDisplayValue === 'Ajouter un commentaire...');
    }
    textElement.style.display = '';

    if (inputElement && inputElement.parentNode) {
        inputElement.remove();
        console.log("saveField: Input retiré, affichage mis à jour.");
    } else {
        console.log("saveField: Input déjà retiré avant la fin.");
    }

    if (hasChanged) {
        console.log(`saveField: Changement confirmé pour ${fieldType}. Appel de updateTaskField...`);
        const clientId = findClientIdByTaskId(taskId);
        if (clientId) {
            const updateSuccess = updateTaskField(clientId, taskId, fieldType, valueToUpdate);
            if (updateSuccess) {
                console.log(`saveField: updateTaskField a réussi. Appel de saveTasks...`);
                saveTasks();
            } else {
                console.error("saveField: Echec de updateTaskField.");
            }
        } else {
            console.error("saveField: ClientId non trouvé pour tâche", taskId, ", sauvegarde annulée.");
        }
    } else {
        console.log(`saveField: Aucun changement détecté pour ${fieldType}. Pas de sauvegarde.`);
    }
    console.log(`saveField: Fin pour ${fieldType} tâche ${taskId}`);
}

// Assurez-vous que updateTaskField et findClientIdByTaskId existent aussi
function updateTaskField(clientId, taskId, fieldType, newValue) {
    console.log(`updateTaskField: Tentative maj champ '${fieldType}' pour tâche ${taskId} (client ${clientId}) avec valeur:`, newValue);

    if (!tasks || !tasks[clientId]) {
        console.error(`updateTaskField: Données client non trouvées pour ${clientId}`);
        return false;
    }

    const taskIndex = tasks[clientId].findIndex(t => t.id === taskId);
    if (taskIndex === -1) {
        console.error(`updateTaskField: Tâche ${taskId} non trouvée pour client ${clientId}`);
        return false;
    }

    let updated = false;
    switch (fieldType) {
        case 'description':
            if (tasks[clientId][taskIndex].description !== newValue) {
                tasks[clientId][taskIndex].description = newValue;
                updated = true;
            }
            break;
        case 'date':
            if (tasks[clientId][taskIndex].dueDate !== newValue) {
                tasks[clientId][taskIndex].dueDate = newValue;
                updated = true;
            }
            break;
        case 'comment':
            const currentComment = tasks[clientId][taskIndex].comment || '';
            const newComment = newValue || '';
            if (currentComment !== newComment) {
                tasks[clientId][taskIndex].comment = newComment;
                updated = true;
            }
            break;
        default:
            console.error(`updateTaskField: Type de champ inconnu '${fieldType}'`);
            return false;
    }

    if (updated) {
        console.log(`updateTaskField: Champ '${fieldType}' mis à jour dans l'objet tasks.`);
        if (fieldType === 'date') {
            const row = document.querySelector(`tr[data-task-id="${taskId}"]`);
            if (row) {
                const dateSpan = row.querySelector('.date-text');
                const isCompleted = row.classList.contains('task-completed');
                if (dateSpan) {
                    dateSpan.classList.toggle('date-overdue', isDateOverdue(newValue) && !isCompleted);
                }
            }
        }
        return true;
    } else {
        console.log(`updateTaskField: Aucune modification nécessaire pour '${fieldType}' (valeur identique).`);
        return true;
    }
}

function findClientIdByTaskId(taskId) {
    for (const clientId in tasks) {
        if (tasks[clientId] && tasks[clientId].some(task => task.id === taskId)) {
            return clientId;
        }
    }
    console.warn(`findClientIdByTaskId: Client non trouvé pour taskId: ${taskId}`);
    return null;
}

// *** MODIFIER performSort pour appeler applyQuickFilters à la fin ***
function performSort() {
    console.log(`--- Début Tri: ${currentSortType} (${currentSortOrder}) ---`);
    const container = document.getElementById('tasksContainer');
    if (!container) return;

    const sortTypeLabels = {
        'client': 'nom de client (groupé)',
        'date': 'date d\'échéance (liste globale)',
        'status': 'statut des tâches (liste globale)'
    };
    let sortIndicator = container.querySelector('.sort-indicator');
    if (!sortIndicator) {
        sortIndicator = document.createElement('div');
        sortIndicator.className = 'sort-indicator';
        sortIndicator.style.padding = '8px';
        sortIndicator.style.margin = '10px 0';
        sortIndicator.style.backgroundColor = 'var(--input-bg-color, #e9f5ff)';
        sortIndicator.style.border = '1px solid var(--border-color, #c2e0ff)';
        sortIndicator.style.borderRadius = '4px';
        sortIndicator.style.textAlign = 'center';
        sortIndicator.style.fontWeight = 'bold';
        sortIndicator.style.color = 'var(--text-color, #333)';
        const searchFilterElement = container.querySelector('.search-and-filter');
        if (searchFilterElement) {
            searchFilterElement.parentNode.insertBefore(sortIndicator, searchFilterElement.nextSibling);
        } else {
            container.insertBefore(sortIndicator, container.firstChild);
        }
    }
    sortIndicator.textContent = `Trié par : ${sortTypeLabels[currentSortType]} (${currentSortOrder === 'asc' ? 'croissant' : 'décroissant'})`;

    if (currentSortType === 'status' || currentSortType === 'date') {
        renderFlatTaskView(currentSortOrder, currentSortType);
    } else {
        const isGroupedView = container.querySelector('.task-group');
        if (!isGroupedView) {
            console.log("Passage à la vue groupée, reconstruction...");
            renderTaskGroups();
        } else {
            console.log("Vue déjà groupée, tri des groupes existants.");
        }

        const taskGroups = Array.from(container.querySelectorAll(':scope > .task-group:not(.search-no-match)'));
        if (!taskGroups.length) {
            console.warn('Aucun groupe à trier dans la vue groupée.');
            return;
        }
        console.log(`Nombre de groupes à trier: ${taskGroups.length}`);

        const groupsWithValues = [];
        taskGroups.forEach((group, index) => {
            const clientId = group.dataset.clientId;
            const clientNameElement = group.querySelector('.client-name-header .client-name');
            const clientName = clientNameElement ? clientNameElement.textContent : `Client Inconnu ${index}`;
            let value;
            let rawValueForLog = '';

            try {
                value = clientName.toLowerCase();
                rawValueForLog = value;

            } catch (error) {
                console.error(`Erreur calcul valeur pour ${clientName}:`, error);
                value = '';
                rawValueForLog = `ERREUR (${value})`;
            }
            console.log(` -> [${index}] Client: ${clientName}, Type: ${currentSortType}, Valeur brute: ${rawValueForLog}, Valeur pour tri groupe: ${value}`);
            groupsWithValues.push({ group, value, clientName });
        });

        try {
            groupsWithValues.sort((a, b) => {
                const valA = a.value;
                const valB = b.value;
                const comparison = valA.localeCompare(valB);
                return currentSortOrder === 'asc' ? comparison : -comparison;
            });
        } catch (sortError) {
            console.error("Erreur pendant le tri des groupes:", sortError);
            return;
        }

        console.log('Ordre des groupes APRÈS tri:', groupsWithValues.map(item => item.clientName));

        console.log("Début réorganisation DOM des GROUPES...");
        groupsWithValues.forEach(({ group, clientName }) => {
            console.log(` -> Déplacement/Ajout du GROUPE: ${clientName}`);
            container.appendChild(group);
        });
        console.log("Fin réorganisation DOM des GROUPES.");
    }

    applyQuickFilters();

    const searchInput = document.getElementById('searchInput');
    if (searchInput && searchInput.value.trim() !== '') {
        console.log("Réapplication de la recherche après tri/filtrage.");
        performSearch();
    }

    console.log(`--- Fin Tri: ${currentSortType} (${currentSortOrder}) ---`);
}

// *** MODIFIER renderFlatTaskView pour accepter le type de tri ***
function renderFlatTaskView(sortOrder, sortType) {
    console.log(`Rendu de la vue plate des tâches, tri par ${sortType} (${sortOrder})`);
    const container = document.getElementById('tasksContainer');
    if (!container) return;

    container.innerHTML = '';

    let allTasksList = [];
    clients.forEach(client => {
        const clientTasks = tasks[client.id] || [];
        clientTasks.forEach(task => {
            allTasksList.push({
                ...task,
                clientName: `${client.nom || ''} ${client.prenom || ''}`.trim(),
                originalClientId: client.id
            });
        });
    });
    console.log(`Total de ${allTasksList.length} tâches collectées.`);

    allTasksList.sort((a, b) => {
        let comparison = 0;
        if (sortType === 'status') {
            const valueA = a.completed ? 1 : 0;
            const valueB = b.completed ? 1 : 0;
            comparison = valueA - valueB;
        } else if (sortType === 'date') {
            const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
            const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
            const timeA = isNaN(dateA) ? Infinity : dateA;
            const timeB = isNaN(dateB) ? Infinity : dateB;

            if (timeA === Infinity && timeB === Infinity) comparison = 0;
            else if (timeA === Infinity) comparison = 1;
            else if (timeB === Infinity) comparison = -1;
            else comparison = timeA - timeB;
        }
        return sortOrder === 'asc' ? comparison : -comparison;
    });

    console.log(`Tâches triées globalement par ${sortType}.`);

    const flatTable = document.createElement('table');
    flatTable.className = 'task-table flat-task-view';
    flatTable.innerHTML = `
        <thead>
            <tr>
                <th class="task-client">Client</th>
                <th class="task-description">Tâche</th>
                <th class="task-date">Échéance</th>
                <th class="task-status">Statut</th>
                <th class="task-comment">Commentaire</th>
                <th class="task-actions-header">Actions</th>
            </tr>
        </thead>
    `;

    const tbody = document.createElement('tbody');

    allTasksList.forEach(task => {
        const row = document.createElement('tr');
        if (task.completed) {
            row.classList.add('task-completed');
        }
        row.dataset.taskId = task.id;
        row.dataset.clientId = task.originalClientId;

        row.innerHTML = `
            <td class="task-client">${task.clientName}</td>
            <td class="task-description" data-task-id="${task.id}">
                <span class="description-text">${task.description}</span>
            </td>
            <td class="task-date" data-task-id="${task.id}">
                <span class="date-text${isDateOverdue(task.dueDate) && !task.completed ? ' date-overdue' : ''}">
                    ${formatDate(task.dueDate)}
                </span>
            </td>
            <td class="task-status">
                <div class="status-container">
                    <input type="checkbox" class="task-checkbox" data-task-id="${task.id}" data-client-id="${task.originalClientId}"
                        ${task.completed ? 'checked' : ''}>
                </div>
            </td>
            <td class="task-comment" data-task-id="${task.id}">
                ${task.comment ?
                    `<span class="comment-text">${task.comment}</span>` :
                    `<span class="comment-text empty-comment">Ajouter un commentaire...</span>`
                }
            </td>
            <td class="task-actions">
                <button class="action-btn delete-task-btn" data-task-id="${task.id}" title="Supprimer">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                        <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                    </svg>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });

    flatTable.appendChild(tbody);
    container.appendChild(flatTable);

    console.log('Vue plate rendue et écouteurs attachés.');
}

// Fonctionnalités de recherche et de tri
function initSearchAndSort() {
    console.log('Initialisation de la recherche, du tri et des filtres rapides');
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    const sortSelect = document.getElementById('sortOptions');
    const sortDirectionButton = document.getElementById('sortDirection');
    const quickFilterButtons = document.querySelectorAll('.quick-filter-btn');

    // ... (listeners pour searchInput/searchButton) ...

    if (sortSelect) {
        sortSelect.value = currentSortType; // Assurer que le select reflète l'état initial
        sortSelect.addEventListener('change', function() {
            currentSortType = this.value;
            performSort();
        });
    } else {
         console.error("Élément sortSelect non trouvé!");
    }

    if (sortDirectionButton) {
        // --- DÉFINIR L'ICÔNE INITIALE ICI ---
        // Cette ligne doit être exécutée au chargement, en dehors du listener.
        // Elle lit la variable globale 'currentSortOrder' (qui devrait être 'asc' par défaut)
        // et met à jour le texte du bouton en conséquence.
        sortDirectionButton.textContent = currentSortOrder === 'asc' ? '▼' : '▲';
        console.log(`initSearchAndSort: Icône de direction initiale définie à '${sortDirectionButton.textContent}' basé sur currentSortOrder='${currentSortOrder}'`);
        // --- FIN DÉFINITION INITIALE ---

        // Attacher l'écouteur pour les clics suivants
        sortDirectionButton.addEventListener('click', function() {
            currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
            // Mettre à jour l'icône lors du clic
            this.textContent = currentSortOrder === 'asc' ? '▼' : '▲';
            performSort();
            console.log(`Direction de tri changée à: ${currentSortOrder}`);
        });
    } else {
         console.error("Élément sortDirectionButton non trouvé!");
    }

    if (quickFilterButtons.length > 0) {
        quickFilterButtons.forEach(button => {
            // --- AJOUT LOG ---
            console.log(`initSearchAndSort: Attachement listener au bouton filtre: ${button.dataset.filter}`);
            // --- FIN AJOUT LOG ---
            button.addEventListener('click', function() {
                // --- AJOUT LOGS ---
                const filterType = this.dataset.filter;
                console.log(`Clic sur filtre rapide: ${filterType}`);
                if (currentQuickFilter === filterType) {
                    console.log(`Filtre ${filterType} déjà actif.`);
                    return; // Ne rien faire si le filtre est déjà actif
                }
                currentQuickFilter = filterType;
                console.log(`currentQuickFilter mis à jour à: ${currentQuickFilter}`);
                // --- FIN AJOUT LOGS ---

                // Mettre à jour la classe 'active'
                quickFilterButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');

                // --- AJOUT LOG ---
                console.log(`Appel de applyQuickFilters depuis le listener du bouton.`);
                // --- FIN AJOUT LOG ---
                applyQuickFilters();

                // Réappliquer la recherche si elle est active
                const searchInput = document.getElementById('searchInput');
                if (searchInput && searchInput.value.trim() !== '') {
                    console.log("Réapplication de la recherche après changement de filtre.");
                    performSearch();
                }
            });
        });
        // Appliquer le filtre initial au chargement
        console.log(`initSearchAndSort: Appel initial de applyQuickFilters.`);
        applyQuickFilters();
    } else {
        console.error("Aucun bouton de filtre rapide trouvé!");
    }

    // Appliquer les filtres initiaux (déjà présent à la fin de la fonction)
    applyQuickFilters();
}

// Nouvelle fonction pour appliquer les filtres rapides
function applyQuickFilters() {
    // --- AJOUT LOG DÉBUT ---
    console.log(`--- applyQuickFilters: DÉBUT - Filtre actif: ${currentQuickFilter} ---`);
    // --- FIN AJOUT LOG ---
    const container = document.getElementById('tasksContainer');
    if (!container) {
         console.error("applyQuickFilters: Conteneur #tasksContainer non trouvé.");
         return;
    }

    const isFlatView = container.querySelector('.flat-task-view');
    const rowsSelector = isFlatView ? '.flat-task-view tbody tr' : '.task-group .task-table tbody tr';
    const taskRows = container.querySelectorAll(rowsSelector);

    // --- AJOUT LOG ---
    console.log(`applyQuickFilters: Application sur ${taskRows.length} lignes (Sélecteur: ${rowsSelector})`);
    // --- FIN AJOUT LOG ---

    let visibleCount = 0; // Compteur pour debug

    taskRows.forEach((row, index) => {
        // --- AJOUT LOGS DÉTAILLÉS ---
        const taskId = row.dataset.taskId || `(ID inconnu ligne ${index})`;
        console.log(`applyQuickFilters: Traitement ligne ${index} (Tâche: ${taskId})`);

        let showRow = false;
        const isCompleted = row.classList.contains('task-completed');
        const dateTextElement = row.querySelector('.date-text');
        const dateText = dateTextElement ? dateTextElement.textContent.trim() : '';

        let taskDueDate = '';
        const clientId = row.closest('[data-client-id]')?.dataset.clientId || row.dataset.clientId;
        if(clientId && taskId && tasks[clientId]) {
            const taskData = tasks[clientId].find(t => t.id === taskId);
            if (taskData) {
                taskDueDate = taskData.dueDate; // Format YYYY-MM-DD ou null
            }
        }
        // Utiliser la date des données si dispo, sinon celle affichée (moins fiable)
        const dateToCheck = taskDueDate !== undefined ? taskDueDate : dateText;
        const isOverdue = isDateOverdue(dateToCheck); // isDateOverdue gère YYYY-MM-DD et DD/MM/YYYY

        console.log(`  -> Tâche ${taskId}: Complété=${isCompleted}, Date=${dateToCheck}, EnRetard=${isOverdue}`);

        switch (currentQuickFilter) {
            case 'overdue':
                showRow = !isCompleted && isOverdue;
                console.log(`  -> Filtre 'overdue': showRow = ${showRow}`);
                break;
            case 'completed':
                showRow = isCompleted;
                console.log(`  -> Filtre 'completed': showRow = ${showRow}`);
                break;
            case 'pending':
                showRow = !isCompleted;
                console.log(`  -> Filtre 'pending': showRow = ${showRow}`);
                break;
            case 'all':
            default:
                showRow = true;
                console.log(`  -> Filtre 'all': showRow = ${showRow}`);
                break;
        }

        // Appliquer la classe
        if (showRow) {
            row.classList.remove('quick-filter-hidden');
            visibleCount++;
            console.log(`  -> Afficher ligne ${index}`);
        } else {
            row.classList.add('quick-filter-hidden');
            console.log(`  -> Masquer ligne ${index}`);
        }
        // --- FIN AJOUT LOGS DÉTAILLÉS ---
    });

    // --- AJOUT LOG ---
    console.log(`applyQuickFilters: Nombre de lignes visibles après filtre: ${visibleCount}`);
    // --- FIN AJOUT LOG ---

    // Gérer la visibilité des groupes (logique existante)
    if (!isFlatView) {
        console.log("applyQuickFilters: Vérification visibilité des groupes...");
        container.querySelectorAll('.task-group').forEach(group => {
            // Ne considérer que les lignes non masquées par la RECHERCHE pour la visibilité du groupe par FILTRE
            const visibleRowsInGroup = group.querySelectorAll('tbody tr:not(.quick-filter-hidden):not(.search-no-match)');
            const groupClientId = group.dataset.clientId;

            // Un groupe est masqué par le filtre si aucune de ses lignes (non masquées par la recherche) n'est visible
            const hideGroupDueToFilter = visibleRowsInGroup.length === 0 && currentQuickFilter !== 'all';

            // Ne pas masquer un groupe si la recherche le montre explicitement
            const hideGroupDueToSearch = group.classList.contains('search-no-match');

            // Masquer si masqué par filtre OU par recherche
            const shouldHideGroup = hideGroupDueToFilter || hideGroupDueToSearch;

            group.classList.toggle('quick-filter-hidden-group', hideGroupDueToFilter); // Classe spécifique pour filtre groupe
            group.style.display = shouldHideGroup ? 'none' : ''; // Masquer via style si filtre ou recherche

            console.log(`  -> Groupe ${groupClientId}: Lignes visibles=${visibleRowsInGroup.length}, MasquéFiltre=${hideGroupDueToFilter}, MasquéRecherche=${hideGroupDueToSearch}, Display=${shouldHideGroup ? 'none' : 'block'}`);
        });
    }
     // --- AJOUT LOG FIN ---
     console.log(`--- applyQuickFilters: FIN - Filtre actif: ${currentQuickFilter} ---`);
     // --- FIN AJOUT LOG ---
}