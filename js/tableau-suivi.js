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
                    <span class="date-text${isDateOverdue(task.dueDate) ? ' date-overdue' : ''}">
                        ${formatDate(task.dueDate)}
                    </span>
                </td>
                <td class="task-status">
                    <div class="status-container">
                        <span class="status-dot ${task.completed ? 'completed' : 'pending'}"></span>
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
    addEditableFieldListeners();
    attachCheckboxListeners(); 
    attachDeleteButtonListeners();
    
    console.log('Rendu terminé');
}

// Ajouter cette fonction juste après renderTaskGroups
function attachCheckboxListeners() {
    console.log('Ajout des gestionnaires pour les cases à cocher...');
    
    document.querySelectorAll('.task-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const taskId = this.dataset.taskId;
            const isChecked = this.checked;
            const clientId = this.dataset.clientId;
            
            console.log(`Case à cocher changée: ${taskId}, état: ${isChecked}`);
            
            // Mettre à jour l'apparence
            const row = this.closest('tr');
            row.classList.toggle('task-completed', isChecked);
            
            // Mettre à jour les données
            updateTaskStatus(clientId, taskId, isChecked);
            
            // Sauvegarder le changement
            saveTasks();
        });
    });
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
                <span class="date-text${isDateOverdue(task.dueDate) ? ' date-overdue' : ''}">
                    ${formatDate(task.dueDate)}
                </span>
            </td>
            <td class="task-status">
                <div class="status-container">
                    <span class="status-dot ${task.completed ? 'completed' : 'pending'}"></span>
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
    
    // Remplacer l'ancien corps par le nouveau
    const oldTbody = table.querySelector('tbody');
    if (oldTbody) {
        table.replaceChild(tbody, oldTbody);
    } else {
        table.appendChild(tbody);
    }
    
    console.log('Corps de tableau mis à jour, ajout des gestionnaires d\'événements');
    
    // Important: réattacher tous les gestionnaires d'événements
    addEditableFieldListeners();
    
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
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    } catch (e) {
        console.error('Erreur de formatage de date:', e);
        return dateString;
    }
}

// Ajouter cette fonction après la fonction formatDate existante

// Vérifier si une date est dépassée
function isDateOverdue(dateString) {
    if (!dateString || dateString === '—') return false;
    
    try {
        // Si le format est déjà DD/MM/YYYY, le convertir en YYYY-MM-DD
        let isoDate = dateString;
        if (dateString.includes('/')) {
            const [day, month, year] = dateString.split('/');
            isoDate = `${year}-${month}-${day}`;
        }
        
        const date = new Date(isoDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Ignorer l'heure pour la comparaison
        
        return date < today;
    } catch (e) {
        console.error('Erreur lors de la vérification de date:', e);
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

                // Réattacher explicitement les gestionnaires d'événements
                setTimeout(() => {
                    addEditableFieldListeners();
                    console.log('Gestionnaires d\'événements réattachés');
                }, 50);
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

// Fonction pour initialiser les gestionnaires d'événements après le rendu du tableau

function addEditableFieldListeners() {
    console.log('Initialisation des champs éditables...');
    
    // Gestionnaires pour l'édition des descriptions
    document.querySelectorAll('.task-description').forEach(cell => {
        cell.addEventListener('click', function(e) {
            // Empêcher l'édition si on clique sur un élément d'interface (comme un bouton)
            if (e.target.closest('.action-btn')) return;
            
            console.log('Clic sur description');
            const taskId = this.dataset.taskId;
            const textElement = this.querySelector('.description-text');
            
            // Si l'élément n'existe pas ou est déjà en mode édition, ne rien faire
            if (!textElement || this.querySelector('.description-input')) {
                return;
            }
            
            const currentText = textElement.textContent || '';
            
            // Créer un champ de saisie
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'description-input';
            input.value = currentText;
            input.dataset.originalValue = currentText; // Stocker la valeur originale
            
            // Cacher le texte et ajouter l'input
            textElement.style.display = 'none';
            this.appendChild(input);
            
            // Focus sur le champ et sélectionner le texte
            input.focus();
            input.select();
            
            // Empêcher que le clic se propage pour éviter des déclenchements multiples
            e.stopPropagation();
            
            // Gestionnaire pour la touche Entrée
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    saveField(this, textElement, 'description', taskId);
                } else if (e.key === 'Escape') {
                    // Annuler l'édition et restaurer la valeur d'origine
                    textElement.style.display = '';
                    this.remove();
                }
            });
            
            // Gestionnaire pour la perte de focus
            input.addEventListener('blur', function() {
                saveField(this, textElement, 'description', taskId);
            });
        });
    });
    
    // Gestionnaires pour l'édition des dates
    document.querySelectorAll('.task-date').forEach(cell => {
        cell.addEventListener('click', function(e) {
            // Empêcher l'édition si on clique sur un bouton
            if (e.target.closest('.action-btn')) return;
            
            console.log('Clic sur date');
            const taskId = this.dataset.taskId;
            const textElement = this.querySelector('.date-text');
            
            // Si l'élément n'existe pas ou est déjà en mode édition, ne rien faire
            if (!textElement || this.querySelector('.date-input')) {
                return;
            }
            
            const currentText = textElement.textContent || '';
            
            // Convertir la date du format affiché vers format ISO pour l'input
            let dateValue = '';
            if (currentText && currentText !== '—') {
                try {
                    const [day, month, year] = currentText.split('/');
                    dateValue = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                } catch (e) {
                    console.error('Erreur de conversion de date:', e);
                }
            }
            
            // Créer un champ date
            const input = document.createElement('input');
            input.type = 'date';
            input.className = 'date-input';
            input.value = dateValue;
            input.dataset.originalValue = currentText; // Stocker la valeur originale
            
            // Cacher le texte et ajouter l'input
            textElement.style.display = 'none';
            this.appendChild(input);
            
            // Focus sur le champ
            input.focus();
            
            // Empêcher que le clic se propage
            e.stopPropagation();
            
            // Gestionnaire pour la touche Échap (annuler)
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') {
                    textElement.style.display = '';
                    this.remove();
                }
            });
            
            // Gestionnaires pour sauvegarder
            input.addEventListener('change', function() {
                saveField(this, textElement, 'date', taskId);
            });
            
            input.addEventListener('blur', function() {
                saveField(this, textElement, 'date', taskId);
            });
        });
    });
    
    // Gestionnaires pour l'édition des commentaires
    document.querySelectorAll('.task-comment').forEach(cell => {
        cell.addEventListener('click', function(e) {
            // Empêcher l'édition si on clique sur un bouton
            if (e.target.closest('.action-btn')) return;
            
            console.log('Clic sur commentaire');
            const taskId = this.dataset.taskId;
            const textElement = this.querySelector('.comment-text');
            
            // Si l'élément n'existe pas ou est déjà en mode édition, ne rien faire
            if (!textElement || this.querySelector('.comment-input')) {
                return;
            }
            
            const currentText = textElement.textContent || '';
            const isPlaceholder = textElement.classList.contains('comment-placeholder');
            
            // Créer un champ de saisie
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'comment-input';
            input.value = isPlaceholder ? '' : currentText;
            input.dataset.originalValue = currentText; // Stocker la valeur originale
            
            // Cacher le texte et ajouter l'input
            textElement.style.display = 'none';
            this.appendChild(input);
            
            // Focus sur le champ et sélectionner le texte
            input.focus();
            if (!isPlaceholder) {
                input.select();
            }
            
            // Empêcher que le clic se propage
            e.stopPropagation();
            
            // Gestionnaire pour la touche Entrée
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    saveField(this, textElement, 'comment', taskId);
                } else if (e.key === 'Escape') {
                    // Annuler l'édition
                    textElement.style.display = '';
                    this.remove();
                }
            });
            
            // Gestionnaire pour la perte de focus
            input.addEventListener('blur', function() {
                saveField(this, textElement, 'comment', taskId);
         
            });
        });
    });
    
    console.log('Champs éditables initialisés avec succès');
}

// Fonction pour sauvegarder un champ modifié
function saveField(inputElement, textElement, fieldType, taskId) {
    console.log(`Sauvegarde du champ ${fieldType} pour la tâche ${taskId}`);
    
    // Si l'élément a déjà été retiré (pour éviter les appels multiples)
    if (!inputElement.parentNode) return;
    
    // Récupérer la valeur et restaurer l'affichage du texte
    let newValue = inputElement.value;
    textElement.style.display = '';
    
    // Traitement spécifique selon le type de champ
    switch (fieldType) {
        case 'description':
            // Validation: la description ne peut pas être vide
            if (!newValue.trim()) {
                alert('La description ne peut pas être vide.');
                textElement.textContent = inputElement.dataset.originalValue;
                inputElement.remove();
                return;
            }
            textElement.textContent = newValue;
            break;
            
        case 'date':
            // Formater la date pour l'affichage ou afficher un tiret si vide
            if (newValue) {
                const date = new Date(newValue);
                const day = date.getDate().toString().padStart(2, '0');
                const month = (date.getMonth() + 1).toString().padStart(2, '0');
                const year = date.getFullYear();
                textElement.textContent = `${day}/${month}/${year}`;
            } else {
                textElement.textContent = '—';
            }
            break;
            
        case 'comment':
            // Gérer le texte placeholder pour les commentaires vides
            if (!newValue.trim()) {
                textElement.textContent = 'Cliquez pour ajouter un commentaire';
                textElement.classList.add('comment-placeholder');
            } else {
                textElement.textContent = newValue;
                textElement.classList.remove('comment-placeholder');
            }
            break;
    }
    
    // Supprimer le champ d'édition
    inputElement.remove();
    
    // Enregistrer dans la structure de données (à implémenter)
    // updateTaskInStorage(taskId, fieldType, newValue);
    
    // Log pour debug
    console.log(`Champ ${fieldType} mis à jour: ${newValue}`);
    
    // Pour intégrer avec la persistance:
    // 1. Trouver le client correspondant
    const clientId = findClientIdByTaskId(taskId);
    if (clientId) {
        // 2. Mettre à jour la tâche dans la structure
        updateTaskField(clientId, taskId, fieldType, newValue);
        // 3. Sauvegarder les tâches
        saveTasks();
    }
}

// Fonction pour trouver le clientId d'une tâche
function findClientIdByTaskId(taskId) {
    // Chercher dans le DOM (plus simple pour le demo)
    const checkbox = document.querySelector(`.task-checkbox[data-task-id="${taskId}"]`);
    if (checkbox && checkbox.dataset.clientId) {
        return checkbox.dataset.clientId;
    }
    
    // Alternative: chercher dans la structure de données
    for (const clientId in tasks) {
        const taskIndex = tasks[clientId].findIndex(t => t.id === taskId);
        if (taskIndex !== -1) {
            return clientId;
        }
    }
    
    console.error(`Impossible de trouver le client pour la tâche ${taskId}`);
    return null;
}

// Fonction pour mettre à jour un champ de tâche dans la structure de données
function updateTaskField(clientId, taskId, fieldType, value) {
    if (!tasks[clientId]) {
        console.error(`Client ${clientId} non trouvé dans les tâches`);
        return false;
    }
    
    const taskIndex = tasks[clientId].findIndex(t => t.id === taskId);
    if (taskIndex === -1) {
        console.error(`Tâche ${taskId} non trouvée pour client ${clientId}`);
        return false;
    }
    
    // Mettre à jour le champ approprié
    switch (fieldType) {
        case 'description':
            tasks[clientId][taskIndex].description = value;
            break;
        case 'date':
            tasks[clientId][taskIndex].dueDate = value || null;
            break;
        case 'comment':
            tasks[clientId][taskIndex].comment = value === 'Cliquez pour ajouter un commentaire' ? '' : value;
            break;
        default:
            console.error(`Type de champ inconnu: ${fieldType}`);
            return false;
    }
    
    console.log(`Champ ${fieldType} mis à jour dans la structure de données`);
    return true;
}

// Fonction pour mettre à jour l'état d'une tâche
function updateTaskStatus(clientId, taskId, isCompleted) {
    console.log(`Mise à jour du statut de la tâche ${taskId} pour client ${clientId}: ${isCompleted}`);
    
    // Initialiser tasks[clientId] si nécessaire
    if (!tasks) {
        tasks = {};
    }
    
    if (!tasks[clientId]) {
        // Récupérer toutes les tâches visibles pour ce client
        const taskElements = document.querySelectorAll(`[data-client-id='${clientId}'] tr[data-task-id]`);
        tasks[clientId] = Array.from(taskElements).map(row => {
            const taskId = row.dataset.taskId;
            const description = row.querySelector('.description-text')?.textContent || '';
            const dateText = row.querySelector('.date-text')?.textContent || '';
            const isCompleted = row.classList.contains('task-completed');
            const comment = row.querySelector('.comment-text')?.textContent || '';
            
            return {
                id: taskId,
                description,
                dueDate: dateText !== '—' ? convertToIsoDate(dateText) : '',
                completed: isCompleted,
                comment: comment === 'Cliquez pour ajouter un commentaire' ? '' : comment
            };
        });
    }
    
    // Trouver et mettre à jour la tâche
    const taskIndex = tasks[clientId].findIndex(t => t.id === taskId);
    if (taskIndex !== -1) {
        tasks[clientId][taskIndex].completed = isCompleted;
        
        // Mettre à jour la barre de progression
        const completedTasks = tasks[clientId].filter(task => task.completed).length;
        const totalTasks = tasks[clientId].length;
        updateProgressBar(clientId, completedTasks, totalTasks);
        return true;
    } else {
        console.error(`Tâche ${taskId} non trouvée pour client ${clientId}`);
        return false;
    }
}

// Fonction auxiliaire pour convertir le format de date
function convertToIsoDate(dateString) {
    if (dateString === '—') return '';
    const [day, month, year] = dateString.split('/');
    return `${year}-${month}-${day}`;
}

// Fonction mise à jour pour gérer la barre de progression
function updateProgressBar(clientId, completedTasks, totalTasks) {
    const progressPercentage = Math.round((completedTasks / totalTasks) * 100) || 0;
    const progressBar = document.querySelector(`.task-group[data-client-id="${clientId}"] .progress-bar`);
    const progressNumber = document.querySelector(`.task-group[data-client-id="${clientId}"] .progress-number`);
    
    if (progressBar && progressNumber) {
        progressBar.style.width = `${progressPercentage}%`;
        progressNumber.textContent = `${progressPercentage}% (${completedTasks}/${totalTasks} tâches terminées)`;
    } else {
        console.error('Éléments de progression non trouvés pour le client', clientId);
    }
}

// Fonction améliorée pour sauvegarder les tâches
function saveTasks() {
    console.log('Sauvegarde des tâches...');
    
    try {
        // 1. Définir le chemin correct vers le fichier
        const tasksFilePath = path.resolve(__dirname, 'taches.json');
        
        console.log('Chemin du fichier de tâches:', tasksFilePath);
        
        // 2. Convertir la structure interne en liste plate pour le fichier
        const tasksList = [];
        for (const clientId in tasks) {
            const clientTasks = tasks[clientId] || [];
            console.log(`Préparation des tâches pour client ${clientId}: ${clientTasks.length} tâches`);
            
            clientTasks.forEach(task => {
                tasksList.push({
                    ...task,
                    clientId: clientId
                });
            });
        }
        
        console.log(`Préparation de ${tasksList.length} tâches pour la sauvegarde`);
        
        // 3. Vérifier si fs est disponible (si on est dans un environnement Electron)
        if (!fs || typeof fs.writeFileSync !== 'function') {
            console.error('Module fs non disponible! Êtes-vous en mode développement web?');
            
            // Alternative: stockage local pour le développement
            localStorage.setItem('tasks', JSON.stringify(tasksList));
            console.log('Tâches sauvegardées dans localStorage (mode dev)');
            return true;
        }
        
        // 4. Créer le répertoire si nécessaire
        const dir = path.dirname(tasksFilePath);
        if (!fs.existsSync(dir)) {
            console.log(`Création du répertoire: ${dir}`);
            fs.mkdirSync(dir, { recursive: true });
        }
        
        // 5. Sauvegarder dans le fichier
        const jsonContent = JSON.stringify(tasksList, null, 2);
        console.log('Contenu JSON à sauvegarder:', jsonContent);
        
        fs.writeFileSync(tasksFilePath, jsonContent, 'utf8');
        
        console.log(`Tâches sauvegardées avec succès dans ${tasksFilePath}`);
        return true;
    } catch (error) {
        console.error('Erreur lors de la sauvegarde des tâches:', error);
        console.error('Stack trace:', error.stack);
        alert(`Erreur lors de la sauvegarde des tâches: ${error.message}`);
        return false;
    }
}

// Fonctionnalités de recherche et de tri
function initSearchAndSort() {
    // Forcer le style du bouton pour le rendre visible
    const sortDirection = document.getElementById('sortDirection');
    if (sortDirection) {
        // Forcer un contenu visible
        sortDirection.textContent = "▼";
        sortDirection.style.fontSize = "16px";
        sortDirection.style.fontWeight = "bold";
        console.log("Bouton de tri configuré manuellement");
    } else {
        console.error("Bouton de tri non trouvé dans le DOM");
    }
    
    console.log('Initialisation de la recherche et du tri');
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    const sortSelect = document.getElementById('sortOptions');
    const sortDirectionButton = document.getElementById('sortDirection');
    
    // État du tri
    let currentSortOrder = 'asc';
    let currentSortType = 'client';
    
    // Fonctionnalité de recherche
    function performSearch() {
        const searchTerm = searchInput.value.toLowerCase().trim();
        const tasksContainer = document.getElementById('tasksContainer');
        
        if (!searchTerm) {
            // Si aucun terme de recherche, afficher tout
            tasksContainer.classList.remove('filtered');
            document.querySelectorAll('.highlight').forEach(el => {
                const text = el.textContent;
                el.outerHTML = text;
            });
            return;
        }
        
        console.log(`Recherche: "${searchTerm}"`);
        tasksContainer.classList.add('filtered');
        
        // Parcourir tous les groupes de tâches
        document.querySelectorAll('.task-group').forEach(group => {
            // Récupérer le nom du client
            const clientName = group.querySelector('.client-name-header').textContent.toLowerCase();
            
            // Rechercher dans les descriptions et commentaires des tâches
            const taskTexts = Array.from(group.querySelectorAll('.description-text, .comment-text'))
                .map(el => el.textContent.toLowerCase());
            
            // Vérifier si le terme de recherche correspond
            const matchesClient = clientName.includes(searchTerm);
            const matchesTask = taskTexts.some(text => text.includes(searchTerm));
            
            if (matchesClient || matchesTask) {
                group.classList.add('search-match');
                
                // Mettre en évidence les correspondances
                group.querySelectorAll('.description-text, .comment-text, .client-name-header').forEach(el => {
                    if (!el.textContent.toLowerCase().includes(searchTerm)) return;
                    
                    const text = el.textContent;
                    const regex = new RegExp(`(${searchTerm})`, 'gi');
                    el.innerHTML = text.replace(regex, '<span class="highlight">$1</span>');
                });
            } else {
                group.classList.remove('search-match');
            }
        });
    }
    
    // Fonctionnalité de tri
    function performSort() {
        console.log(`Tri demandé: ${currentSortType} (${currentSortOrder})`);
        
        // Sélectionner tous les groupes de tâches
        const taskGroups = Array.from(document.querySelectorAll('.task-group'));
        const container = document.getElementById('tasksContainer');
        
        // Vérifier qu'il y a des groupes à trier
        if (!taskGroups.length) {
            console.warn('Aucun groupe de tâches trouvé pour le tri');
            return;
        }
        
        // Tableau pour stocker les groupes avec leurs valeurs de tri
        const groupsWithValues = [];
        
        // Collecter et analyser les groupes et leurs valeurs
        taskGroups.forEach(group => {
            const clientId = group.dataset.clientId;
            const clientName = group.querySelector('.client-name-header').textContent;
            let value;
            
            switch (currentSortType) {
                case 'client':
                    value = clientName.toLowerCase();
                    break;
                    
                case 'date': {
                    // Collecter toutes les dates
                    const dates = [];
                    const dateElements = group.querySelectorAll('.date-text');
                    
                    dateElements.forEach(el => {
                        const text = el.textContent.trim();
                        if (text && text !== '—') {
                            try {
                                const parts = text.split('/');
                                if (parts.length === 3) {
                                    const day = parseInt(parts[0], 10);
                                    const month = parseInt(parts[1], 10) - 1;
                                    const year = parseInt(parts[2], 10);
                                    
                                    const date = new Date(year, month, day);
                                    if (!isNaN(date.getTime())) {
                                        dates.push(date.getTime());
                                    }
                                }
                            } catch (e) {
                                console.error(`Erreur de format de date: ${text}`, e);
                            }
                        }
                    });
                    
                    // Trouver la date la plus proche
                    value = dates.length > 0 ? Math.min(...dates) : Infinity;
                    console.log(`Client ${clientName}: ${dates.length} dates, plus proche: ${value !== Infinity ? new Date(value).toLocaleDateString() : 'aucune'}`);
                    break;
                }
                    
                case 'status': {
                    // Compter manuellement les tâches et les tâches terminées
                    const checkboxes = group.querySelectorAll('.task-checkbox');
                    let total = checkboxes.length;
                    let completed = 0;
                    
                    checkboxes.forEach(checkbox => {
                        if (checkbox.checked) completed++;
                    });
                    
                    // Calculer le pourcentage
                    value = total > 0 ? (completed / total) : 0;
                    console.log(`Client ${clientName}: ${completed}/${total} = ${(value*100).toFixed(1)}%`);
                    break;
                }
            }
            
            // Ajouter au tableau pour tri
            groupsWithValues.push({ group, value });
        });
        
        // Trier le tableau
        groupsWithValues.sort((a, b) => {
            let comparison = 0;
            
            // Pour les dates et statuts
            if (typeof a.value === 'number' && typeof b.value === 'number') {
                comparison = a.value - b.value;
            } 
            // Pour le texte
            else {
                comparison = a.value < b.value ? -1 : (a.value > b.value ? 1 : 0);
            }
            
            // Inverser si ordre descendant
            return currentSortOrder === 'asc' ? comparison : -comparison;
        });
        
        // Journaliser l'ordre après tri
        console.log('Résultat du tri:');
        groupsWithValues.forEach(({group, value}) => {
            const clientName = group.querySelector('.client-name-header').textContent;
            console.log(`- ${clientName}: ${value}`);
        });
        
        // Détacher d'abord tous les groupes du DOM
        taskGroups.forEach(group => {
            if (group.parentNode) {
                container.removeChild(group);
            }
        });

        // Force un reflow du DOM avant de réinsérer les éléments
        void container.offsetHeight;

        // Insérer les groupes dans le nouvel ordre trié
        for (let i = 0; i < groupsWithValues.length; i++) {
            container.appendChild(groupsWithValues[i].group);
        }

        // Log de vérification
        console.log("Groupes réordonnés dans le DOM dans cet ordre:");
        groupsWithValues.forEach(({group}) => {
            console.log(group.querySelector('.client-name-header').textContent);
        });

        // Ajouter l'indicateur de tri (code existant)
        const sortTypeLabels = {
            'client': 'nom de client',
            'date': 'date d\'échéance',
            'status': 'statut d\'avancement'
        };
        
        const sortIndicator = document.createElement('div');
        sortIndicator.className = 'sort-indicator';
        sortIndicator.textContent = `Trié par: ${sortTypeLabels[currentSortType]} (ordre ${currentSortOrder === 'asc' ? 'croissant' : 'décroissant'})`;
        
        // Style de l'indicateur
        sortIndicator.style.padding = '8px';
        sortIndicator.style.margin = '10px 0';
        sortIndicator.style.backgroundColor = '#e9f5ff';
        sortIndicator.style.border = '1px solid #c2e0ff';
        sortIndicator.style.borderRadius = '4px';
        sortIndicator.style.textAlign = 'center';
        sortIndicator.style.fontWeight = 'bold';
        
        // Remplacer ou ajouter l'indicateur
        const existingIndicator = container.querySelector('.sort-indicator');
        if (existingIndicator) {
            container.removeChild(existingIndicator);
        }
        
        // Insérer au début du conteneur
        container.insertBefore(sortIndicator, container.firstChild);
        
        console.log(`Tri terminé: ${currentSortType} (${currentSortOrder})`);
    }
    
    // Événements
    searchInput.addEventListener('input', performSearch);
    searchButton.addEventListener('click', performSearch);
    
    // Traiter la touche Entrée dans la barre de recherche
    searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
    
    sortSelect.addEventListener('change', function() {
        currentSortType = this.value;
        performSort();
    });
    
    sortDirectionButton.addEventListener('click', function() {
        currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
        
        // Mise à jour visuelle du bouton
        this.innerHTML = currentSortOrder === 'asc' ? '▼' : '▲';
        
        // Appliquer le tri
        performSort();
        
        console.log(`Direction de tri changée à: ${currentSortOrder}`);
    });
    
    // Initialiser le tri par défaut
    setTimeout(performSort, 500); // Petit délai pour s'assurer que tous les éléments sont rendus

    // Ajouter à la fin de initSearchAndSort()
    console.log("Test automatique des types de tri");
    setTimeout(() => {
        sortSelect.value = 'date';
        sortSelect.dispatchEvent(new Event('change'));
        
        setTimeout(() => {
            sortSelect.value = 'status';
            sortSelect.dispatchEvent(new Event('change'));
            
            setTimeout(() => {
                sortSelect.value = 'client';
                sortSelect.dispatchEvent(new Event('change'));
            }, 1000);
        }, 1000);
    }, 1000);
}