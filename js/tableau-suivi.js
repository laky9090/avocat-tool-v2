const fs = require('fs');
const path = require('path');

// Alternative pour le chemin du fichier clients

// Tester différentes méthodes pour obtenir le chemin
const clientsFilePath1 = path.join(__dirname, '..', 'clients.json');
const clientsFilePath2 = path.resolve(__dirname, '..', 'clients.json');
const clientsFilePath3 = path.join(process.cwd(), 'clients.json');

console.log('Chemins possibles:');
console.log('1:', clientsFilePath1);
console.log('2:', clientsFilePath2);
console.log('3:', clientsFilePath3);

console.log('Existence des fichiers:');
console.log('1 existe:', fs.existsSync(clientsFilePath1));
console.log('2 existe:', fs.existsSync(clientsFilePath2));
console.log('3 existe:', fs.existsSync(clientsFilePath3));

// Utiliser le premier chemin qui fonctionne
const clientsFilePath = fs.existsSync(clientsFilePath1) ? clientsFilePath1 :
                       fs.existsSync(clientsFilePath2) ? clientsFilePath2 :
                       fs.existsSync(clientsFilePath3) ? clientsFilePath3 : 
                       clientsFilePath1; // Fallback

console.log('Chemin du fichier clients:', clientsFilePath);

// Variables globales
let clients = [];

// Au chargement du document
document.addEventListener('DOMContentLoaded', () => {
    // Initialisation du bouton de thème si présent
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        initializeTheme();
    }
    
    // Initialiser les gestionnaires d'événements
    initEventListeners();
    
    // Charger les données
    loadData();
});

// Charger les données nécessaires
function loadData() {
    console.log('Chargement des données clients...');
    
    try {
        // Vérifier le chemin et l'existence du fichier
        console.log('Vérification du fichier clients:', clientsFilePath);
        console.log('Le fichier existe:', fs.existsSync(clientsFilePath));
        
        // Charger les clients depuis le fichier clients.json
        if (fs.existsSync(clientsFilePath)) {
            const fileContent = fs.readFileSync(clientsFilePath, 'utf8');
            console.log('Contenu lu du fichier');
            
            // Vérifier si le contenu est valide
            if (!fileContent || fileContent.trim() === '') {
                console.warn("Fichier clients.json vide");
                clients = [];
            } else {
                try {
                    const allClients = JSON.parse(fileContent);
                    
                    // Filtrer pour ne garder que les clients non archivés
                    clients = allClients.filter(client => !client.archived);
                    
                    console.log(`${allClients.length} clients chargés au total`);
                    console.log(`${clients.length} clients actifs (non archivés)`);
                } catch (parseError) {
                    console.error("Erreur de parsing JSON:", parseError);
                    clients = [];
                }
            }
        } else {
            console.warn("Fichier clients.json non trouvé");
            clients = [];
        }
    } catch (error) {
        console.error("Erreur lors du chargement des clients:", error);
        clients = [];
    }
    
    // Si aucun client n'est trouvé, créer des clients de test
    if (!clients || clients.length === 0) {
        console.log("Création de clients de test pour la démonstration");
        clients = [
            {
                id: "client_test_1",
                nom: "Dupont",
                prenom: "Jean",
                type: "Divorce",
                archived: false
            },
            {
                id: "client_test_2",
                nom: "Martin",
                prenom: "Sophie",
                type: "Droit immobilier",
                archived: false
            },
            {
                id: "client_test_3",
                nom: "Durand",
                prenom: "Pierre",
                type: "Droit du travail",
                archived: false
            }
        ];
    }
    
    // Afficher les tâches
    renderTaskGroups();
}

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

// Afficher les groupes de tâches
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
    
    // Créer un groupe pour chaque client
    clients.forEach((client, index) => {
        // Format du nom du client
        const clientName = `${client.nom || ''} ${client.prenom || ''}`.trim();
        
        // Création du conteneur de groupe
        const group = document.createElement('div');
        group.className = 'task-group';
        group.dataset.clientId = client.id || index;
        
        // Création du tableau
        const table = document.createElement('table');
        table.className = 'task-table';
        
        // Tâches d'exemple pour ce client
        const exampleTasks = [
            {
                id: `task_${index}_1`,
                description: "Préparer les conclusions",
                dueDate: "2025-05-15",
                completed: false,
                comment: "Vérifier les documents avant envoi"
            },
            {
                id: `task_${index}_2`,
                description: "Envoyer notification à l'adverse",
                dueDate: "2025-05-20",
                completed: true,
                comment: "Notification envoyée par email"
            }
        ];
        
        // Calculer le pourcentage d'avancement
        const totalTasks = exampleTasks.length;
        const completedTasks = exampleTasks.filter(task => task.completed).length;
        const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        
        // Création de l'en-tête avec le nom du client et la barre de progression
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th class="client-name-header" colspan="4">${clientName}</th>
            </tr>
            <tr>
                <th colspan="4" class="progress-header">
                    <div class="progress-container">
                        <div class="progress-bar" style="width: ${progressPercentage}%"></div>
                        <span class="progress-text">${progressPercentage}% d'avancement</span>
                    </div>
                </th>
            </tr>
            <tr>
                <th class="task-description">Tâche</th>
                <th class="task-date">Date</th>
                <th class="task-status">Statut</th>
                <th class="task-comment">Commentaire</th>
            </tr>
        `;
        table.appendChild(thead);
        
        // Création du corps du tableau avec les tâches d'exemple
        const tbody = document.createElement('tbody');
            
        // Ajouter les tâches d'exemple au tableau
        exampleTasks.forEach((task) => {
            const row = document.createElement('tr');
            if (task.completed) {
                row.classList.add('task-completed');
            }
            
            row.innerHTML = `
                <td class="task-description">${task.description}</td>
                <td class="task-date">${formatDate(task.dueDate)}</td>
                <td class="task-status">
                    <input type="checkbox" class="task-checkbox" data-task-id="${task.id}" 
                        ${task.completed ? 'checked' : ''}>
                </td>
                <td class="task-comment">
                    <div class="comment-container">
                        <span class="comment-text">${task.comment || ''}</span>
                        <button class="edit-comment-btn" data-task-id="${task.id}">
                            <i class="fas fa-pencil-alt"></i>✏️
                        </button>
                    </div>
                </td>
            `;
            
            tbody.appendChild(row);
        });
        
        table.appendChild(tbody);
        group.appendChild(table);
        container.appendChild(group);
    });
    
    // Ajouter les gestionnaires d'événements pour les cases à cocher
    document.querySelectorAll('.task-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const taskId = this.dataset.taskId;
            const isChecked = this.checked;
            
            // Mettre à jour l'apparence
            const row = this.closest('tr');
            row.classList.toggle('task-completed', isChecked);
            
            // Mettre à jour la barre de progression (à implémenter plus tard pour les tâches réelles)
            // Pour l'instant, nous ne faisons que mettre à jour l'apparence
        });
    });

    // Ajouter les gestionnaires pour les boutons d'édition des commentaires
    document.querySelectorAll('.edit-comment-btn').forEach(button => {
        button.addEventListener('click', function() {
            const taskId = this.dataset.taskId;
            const commentCell = this.closest('.task-comment');
            const commentText = commentCell.querySelector('.comment-text');
            const currentComment = commentText.textContent || '';
            
            // Créer un champ de saisie
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'comment-input';
            input.value = currentComment;
            
            // Remplacer le texte par le champ de saisie
            const commentContainer = commentCell.querySelector('.comment-container');
            commentContainer.innerHTML = '';
            commentContainer.appendChild(input);
            
            // Focus sur le champ et sélectionner le texte
            input.focus();
            input.select();
            
            // Gestionnaire pour sauvegarder le commentaire lorsqu'on appuie sur Entrée
            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    saveComment(taskId, this.value, commentCell);
                }
            });
            
            // Gestionnaire pour sauvegarder lors de la perte de focus
            input.addEventListener('blur', function() {
                saveComment(taskId, this.value, commentCell);
            });
        });
    });
    
    console.log('Rendu terminé');
}

// Fonction pour sauvegarder un commentaire
function saveComment(taskId, commentText, commentCell) {
    // Dans une future implémentation, nous sauvegarderions le commentaire dans les données
    console.log(`Commentaire sauvegardé pour la tâche ${taskId}: ${commentText}`);
    
    // Recréer la structure du commentaire
    commentCell.innerHTML = `
        <div class="comment-container">
            <span class="comment-text">${commentText}</span>
            <button class="edit-comment-btn" data-task-id="${taskId}">
                <i class="fas fa-pencil-alt"></i>✏️
            </button>
        </div>
    `;
    
    // Réattacher l'événement au bouton d'édition
    commentCell.querySelector('.edit-comment-btn').addEventListener('click', function() {
        const taskId = this.dataset.taskId;
        const commentCell = this.closest('.task-comment');
        const commentText = commentCell.querySelector('.comment-text').textContent || '';
        
        // Code pour créer l'input...
        // (Vous pourriez extraire cette partie dans une fonction séparée)
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

// Ajouter une nouvelle tâche (fonction à développer)
function addNewTask() {
    alert("Fonctionnalité d'ajout de tâche à venir !");
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