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
                <th class="client-name-header" colspan="5">${clientName}</th>
            </tr>
            <tr>
                <th colspan="5" class="progress-header">
                    <div class="progress-container">
                        <div class="progress-bar" style="width: ${progressPercentage}%">
                            <span class="progress-number">${progressPercentage}%</span>
                        </div>
                    </div>
                </th>
            </tr>
            <tr>
                <th class="task-description">Tâche</th>
                <th class="task-date">Date</th>
                <th class="task-status">Statut</th>
                <th class="task-comment">Commentaire</th>
                <th class="task-actions-header">Actions</th>
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
            
            // IMPORTANT: Ajouter data-task-id à la ligne elle-même pour faciliter la sélection
            row.dataset.taskId = task.id;
            
            row.innerHTML = `
                <td class="task-description" data-task-id="${task.id}">
                    <span class="description-text">${task.description}</span>
                </td>
                <td class="task-date" data-task-id="${task.id}">
                    <span class="date-text">${formatDate(task.dueDate)}</span>
                </td>
                <td class="task-status">
                    <input type="checkbox" class="task-checkbox" data-task-id="${task.id}" 
                        ${task.completed ? 'checked' : ''}>
                </td>
                <td class="task-comment" data-task-id="${task.id}">
                    <span class="comment-text">${task.comment || 'Cliquez pour ajouter un commentaire'}</span>
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
    
    // Ajouter les gestionnaires d'événements pour les cases à cocher
    document.querySelectorAll('.task-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const taskId = this.dataset.taskId;
            const isChecked = this.checked;
            
            // Mettre à jour l'apparence
            const row = this.closest('tr');
            row.classList.toggle('task-completed', isChecked);
            
            console.log(`Tâche ${taskId} marquée comme ${isChecked ? 'terminée' : 'à faire'}`);
        });
    });

    // Ajouter les gestionnaires pour l'édition de commentaires
    document.querySelectorAll('.task-comment').forEach(commentCell => {
        commentCell.addEventListener('click', function() {
            const taskId = this.dataset.taskId;
            const commentText = this.querySelector('.comment-text');
            const currentText = commentText.textContent;
            
            // Ne pas transformer en champ d'édition si le texte est déjà en cours d'édition
            if (this.querySelector('.comment-input')) {
                return;
            }
            
            // Créer un champ de saisie
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'comment-input';
            input.value = currentText === 'Cliquez pour ajouter un commentaire' ? '' : currentText;
            
            // Remplacer le texte par le champ de saisie
            this.innerHTML = '';
            this.appendChild(input);
            
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

    // Ajouter les gestionnaires pour l'édition in-line de la description
    document.querySelectorAll('.task-description').forEach(cell => {
        cell.addEventListener('click', function() {
            const taskId = this.dataset.taskId;
            const textElement = this.querySelector('.description-text');
            const currentText = textElement.textContent;
            
            // Ne pas transformer en champ d'édition si déjà en cours d'édition
            if (this.querySelector('.description-input')) {
                return;
            }
            
            // Créer un champ de saisie
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'description-input';
            input.value = currentText;
            
            // Remplacer le texte par le champ de saisie
            this.innerHTML = '';
            this.appendChild(input);
            
            // Focus sur le champ et sélectionner le texte
            input.focus();
            input.select();
            
            // Gestionnaire pour sauvegarder lorsqu'on appuie sur Entrée
            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    saveDescription(taskId, this.value, cell);
                }
            });
            
            // Gestionnaire pour sauvegarder lors de la perte de focus
            input.addEventListener('blur', function() {
                saveDescription(taskId, this.value, cell);
            });
        });
    });

    // Ajouter les gestionnaires pour l'édition in-line de la date
    document.querySelectorAll('.task-date').forEach(cell => {
        cell.addEventListener('click', function() {
            const taskId = this.dataset.taskId;
            const textElement = this.querySelector('.date-text');
            const currentText = textElement.textContent;
            
            // Ne pas transformer en champ d'édition si déjà en cours d'édition
            if (this.querySelector('.date-input')) {
                return;
            }
            
            // Convertir la date affichée (DD/MM/YYYY) en format YYYY-MM-DD pour l'input
            let dateValue = '';
            if (currentText && currentText !== '—') {
                try {
                    const [day, month, year] = currentText.split('/');
                    dateValue = `${year}-${month}-${day}`;
                } catch (e) {
                    console.error('Erreur de conversion de date:', e);
                }
            }
            
            // Créer un champ de saisie de date
            const input = document.createElement('input');
            input.type = 'date';
            input.className = 'date-input';
            input.value = dateValue;
            
            // Remplacer le texte par le champ de saisie
            this.innerHTML = '';
            this.appendChild(input);
            
            // Focus sur le champ
            input.focus();
            
            // Gestionnaire pour sauvegarder lors de la perte de focus
            input.addEventListener('blur', function() {
                saveDate(taskId, this.value, cell);
            });
            
            // Gestionnaire pour sauvegarder lors du changement
            input.addEventListener('change', function() {
                saveDate(taskId, this.value, cell);
            });
        });
    });

    // IMPORTANT: Ajouter ces gestionnaires explicitement pour les boutons d'action
    document.querySelectorAll('.edit-task-btn').forEach(button => {
        button.addEventListener('click', function(e) {
            // Empêcher la propagation de l'événement
            e.stopPropagation();
            
            const taskId = this.dataset.taskId;
            console.log(`Bouton modifier cliqué pour la tâche ${taskId}`);
            editTask(taskId);
        });
    });

    document.querySelectorAll('.delete-task-btn').forEach(button => {
        button.addEventListener('click', function(e) {
            // Empêcher la propagation de l'événement
            e.stopPropagation();
            
            const taskId = this.dataset.taskId;
            console.log(`Bouton supprimer cliqué pour la tâche ${taskId}`);
            deleteTask(taskId);
        });
    });

    console.log('Tous les gestionnaires d\'événements ont été ajoutés');

    console.log('Rendu terminé');

    // À la fin de la fonction:
    addEditableFieldListeners();
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
        console.error(`Tâche ${taskId} non trouvée pour le client ${clientId}`);
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

// Modifier la fonction updateProgressBar si elle existe déjà
function updateProgressBar(clientId) {
    // Récupérer les tâches du client
    const clientTasks = tasks[clientId] || [];
    if (clientTasks.length === 0) return;
    
    // Calculer le nouveau pourcentage
    const totalTasks = clientTasks.length;
    const completedTasks = clientTasks.filter(task => task.completed).length;
    const progressPercentage = Math.round((completedTasks / totalTasks) * 100);
    
    // Trouver et mettre à jour la barre de progression
    const progressBar = document.querySelector(`[data-client-id="${clientId}"] .progress-bar`);
    const progressNumber = document.querySelector(`[data-client-id="${clientId}"] .progress-number`);
    
    if (progressBar) {
        progressBar.style.width = `${progressPercentage}%`;
        
        if (progressNumber) {
            progressNumber.textContent = `${progressPercentage}%`;
        }
    }
}