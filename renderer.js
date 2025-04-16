const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { dialog, shell } = require('@electron/remote');
const cheminFichier = path.join(__dirname, 'clients.json');
let originalClientData = null;
let currentView = 'active';
let currentCalendarDate = new Date();
let isFormVisible = false;

// Ajouter au début du fichier, après les imports
const clientColors = new Map();
const usedColors = new Set();

const SOUS_DOSSIERS = [
    "1-convention d'honoraires",
    "2-Factures",
    "3-Correspondances",
    "4-Assignation",
    "5-Requête",
    "6-Pièces client",
    "7-Décisions",
    "8-Actes de naissance",
    "9-DP",
    "10-RPVA",
    "11-Huissier"
]; // Ensure this is part of a valid array declaration or assignment

// Modifier la constante pour les dossiers principaux
const DOSSIERS_PRINCIPAUX = {
    actifs: 'Dossiers en cours',
    archives: 'Dossiers archivés'  // Changé de 'Dossiers archives' à 'Dossiers archivés'
};

// Ajouter ces constantes après les autres constantes existantes
const TAGS_PREDEFINED = [
    'Urgent', 'En attente', 'À relancer', 
    'Familial', 'Commercial', 'Pénal',
    'Civil', 'Social', 'Administratif'
];

function getClientColor(clientNom) {
    // Si le client a déjà une couleur, on la retourne
    if (clientColors.has(clientNom)) {
        return clientColors.get(clientNom);
    }

    // Liste de couleurs prédéfinies
    const colors = [
        '#3498db', '#e74c3c', '#2ecc71', '#f1c40f', '#9b59b6',
        '#1abc9c', '#d35400', '#34495e', '#16a085', '#c0392b',
        '#8e44ad', '#2980b9', '#f39c12', '#27ae60', '#7f8c8d'
    ];

    // Trouver une couleur non utilisée
    let color = colors.find(c => !usedColors.has(c));
    
    // Si toutes les couleurs sont utilisées, on en génère une aléatoire
    if (!color) {
        do {
            color = '#' + Math.floor(Math.random()*16777215).toString().hex;
        } while (usedColors.has(color));
    }

    // Enregistrer la couleur pour ce client
    usedColors.add(color);
    clientColors.set(clientNom, color);
    return color;
}

// Ajouter au début du fichier, après les constantes
function generateDossierNumber() {
    const currentYear = new Date().getFullYear();
    let clients = fs.existsSync(cheminFichier) ? JSON.parse(fs.readFileSync(cheminFichier)) : [];
    
    // Filtrer les dossiers de l'année en cours
    const dossiersAnnee = clients.filter(client => client.numeroDossier && 
        client.numeroDossier.startsWith(currentYear.toString()));
    
    // Trouver le plus grand numéro
    let maxNumber = 0;
    dossiersAnnee.forEach(client => {
        const num = parseInt(client.numeroDossier.split('-')[1]);
        if (!isNaN(num) && num > maxNumber) {
            maxNumber = num;
        }
    });
    
    // Générer le nouveau numéro
    return `${currentYear}-${(maxNumber + 1).toString().padStart(3, '0')}`;
}

// Formater une date au format français
function formatDateFr(dateStr) {
  if (!dateStr) return "–";
  try {
    const date = new Date(dateStr);
    if (isNaN(date)) return "–";
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch (e) {
    console.error('Erreur de formatage de date:', e);
    return "–";
  }
}

function showError(field, message) {
    const input = document.getElementById(field);
    const existingError = input.parentElement.querySelector('.erreur-message');
    
    if (existingError) {
        existingError.remove();
    }
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'erreur-message';
    errorDiv.style.color = 'red';
    errorDiv.style.fontSize = '12px';
    errorDiv.style.marginTop = '5px';
    errorDiv.textContent = message;
    
    input.parentElement.appendChild(errorDiv);
}

// Ajouter au début du fichier après les constantes
function initializeTheme() {
    const themeToggle = document.getElementById('themeToggle');
    if (!themeToggle) {
        console.error('Bouton de thème non trouvé');
        return;
    }

    // Charger le thème sauvegardé ou utiliser le thème clair par défaut
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeButton(savedTheme);

    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeButton(newTheme);
    });

    function updateThemeButton(theme) {
        const themeIcon = themeToggle.querySelector('#themeIcon');
        const themeText = themeToggle.querySelector('#themeText');
        
        if (themeIcon && themeText) {
            themeIcon.textContent = theme === 'dark' ? '🌜' : '🌞';
            themeText.textContent = theme === 'dark' ? 'Mode clair' : 'Mode sombre';
        }
    }
}

// Ajouter cette fonction dans votre fichier renderer.js

// Gestion de l'affichage conditionnel pour le rôle selon le type de dossier
function initTypeRoleSelect() {
  const typeSelect = document.getElementById('type');
  const roleContainer = document.getElementById('roleContainer');
  const roleLabel = document.getElementById('roleLabel');
  const roleSelect = document.getElementById('role');
  
  // Options pour première instance
  const optionsPremiereInstance = [
    { value: 'En demande', text: 'En demande' },
    { value: 'En défense', text: 'En défense' }
  ];
  
  // Options pour appel
  const optionsAppel = [
    { value: 'Appelant(e)', text: 'Appelant(e)' },
    { value: 'Intimé(e)', text: 'Intimé(e)' }
  ];
  
  typeSelect.addEventListener('change', function() {
    const selectedValue = this.value;
    
    // Vider le select
    roleSelect.innerHTML = '<option value="">-- Sélectionner --</option>';
    
    // Afficher et configurer selon le type sélectionné
    if (selectedValue.startsWith('Première instance')) {
      // Configurer pour première instance
      roleLabel.textContent = 'Position :';
      optionsPremiereInstance.forEach(option => {
        const optEl = document.createElement('option');
        optEl.value = option.value;
        optEl.textContent = option.text;
        roleSelect.appendChild(optEl);
      });
      roleContainer.style.display = 'block';
    } 
    else if (selectedValue.startsWith('Appel')) {
      // Configurer pour appel
      roleLabel.textContent = 'Position :';
      optionsAppel.forEach(option => {
        const optEl = document.createElement('option');
        optEl.value = option.value;
        optEl.textContent = option.text;
        roleSelect.appendChild(optEl);
      });
      roleContainer.style.display = 'block';
    } 
    else {
      // Cacher si aucun type pertinent n'est sélectionné
      roleContainer.style.display = 'none';
    }
  });
}

// Amélioration de la validation du formulaire
function validateForm() {
    document.querySelectorAll('.erreur-message').forEach(el => el.remove());
    
    const errors = new Map();
    const required = ['nom', 'type', 'tribunal']; // Ajoutez 'prenom' ici si vous voulez le rendre obligatoire
    
    required.forEach(field => {
        const value = document.getElementById(field).value.trim();
        if (!value) {
            errors.set(field, 'Ce champ est requis');
            showError(field, 'Ce champ est requis');
        }
    });

    // Validation des emails
    ['email', 'emailAdverse'].forEach(field => {
        const value = document.getElementById(field).value.trim();
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            errors.set(field, 'Email invalide');
            showError(field, 'Email invalide');
        }
    });

    // Validation des téléphones
    ['telephone', 'telephoneAdverse'].forEach(field => {
        const value = document.getElementById(field).value.trim();
        if (value && !/^(\+?\d{1,3}[- ]?)?\d{6,14}$/.test(value)) {
            errors.set(field, 'Numéro invalide');
            showError(field, 'Numéro invalide');
        }
    });

    return errors;
}

// Fonction pour créer l'arborescence d'un client
function creerArborescenceClient(client) {
    try {
        const baseDir = path.join(__dirname, 
            client.archived ? DOSSIERS_PRINCIPAUX.archives : DOSSIERS_PRINCIPAUX.actifs);
        const clientDir = path.join(baseDir, `${client.nom}_${client.prenom || ''}`.replace(/[<>:"/\\|?*]/g, '_'));

        // Créer les dossiers principaux s'ils n'existent pas
        if (!fs.existsSync(path.join(__dirname, DOSSIERS_PRINCIPAUX.actifs))) {
            fs.mkdirSync(path.join(__dirname, DOSSIERS_PRINCIPAUX.actifs), { recursive: true });
        }
        if (!fs.existsSync(path.join(__dirname, DOSSIERS_PRINCIPAUX.archives))) {
            fs.mkdirSync(path.join(__dirname, DOSSIERS_PRINCIPAUX.archives), { recursive: true });
        }

        // Créer le dossier du client s'il n'existe pas
        if (!fs.existsSync(clientDir)) {
            fs.mkdirSync(clientDir, { recursive: true });
        }

        // Créer tous les sous-dossiers
        SOUS_DOSSIERS.forEach(sousDir => {
            const completePath = path.join(clientDir, sousDir);
            if (!fs.existsSync(completePath)) {
                fs.mkdirSync(completePath, { recursive: true });
            }
        });

        return clientDir;
    } catch (error) {
        console.error("Erreur lors de la création de l'arborescence:", error);
        return null;
    }
}

// Modifier la fonction ajouterOuModifierClient pour inclure les tags et le rôle
function ajouterOuModifierClient() {
    try {
        // Effacer les anciens messages d'erreur
        document.querySelectorAll('.erreur-message').forEach(el => el.remove());

        // Validation
        const errors = validateForm();
        if (errors.size > 0) {
            return;
        }

        // Récupération des champs
        const formData = {
            numeroDossier: document.getElementById('indexModif').value === '' ? generateDossierNumber() : originalClientData?.numeroDossier,
            nom: document.getElementById('nom').value.trim(),
            prenom: document.getElementById('prenom').value.trim(),
            adresse: document.getElementById('adresse').value.trim(),
            telephone: document.getElementById('telephone').value.trim(),
            email: document.getElementById('email').value.trim(),
            profession: document.getElementById('profession').value.trim(),
            tribunal: document.getElementById('tribunal').value,
            type: document.getElementById('type').value,
            role: document.getElementById('role').value, // Nouvelle propriété
            dateAudience: document.getElementById('dateAudience').value,
            dateContact: document.getElementById('dateContact').value,
            dateEcheance: document.getElementById('dateEcheance').value,
            commentaire: document.getElementById('commentaire').value.trim(),
            nomAdverse: document.getElementById('nomAdverse').value.trim(),
            prenomAdverse: document.getElementById('prenomAdverse').value.trim(),
            adresseAdverse: document.getElementById('adresseAdverse').value.trim(),
            telephoneAdverse: document.getElementById('telephoneAdverse').value.trim(),
            emailAdverse: document.getElementById('emailAdverse').value.trim(),
            professionAdverse: document.getElementById('professionAdverse').value.trim(),
            aideJuridictionnelle: document.getElementById('aideJuridictionnelle').value,
            montantTotal: document.getElementById('montantTotal').value,
            montantPaye: document.getElementById('montantPaye').value,
            tags: Array.from(document.querySelectorAll('.tag-item.selected')).map(tag => tag.textContent.trim()),
            notes: JSON.parse(document.getElementById('clientNotes').value || '[]'),
            archived: originalClientData?.archived || false
        };

        // Lecture du fichier existant
        let clients = fs.existsSync(cheminFichier) ? JSON.parse(fs.readFileSync(cheminFichier)) : [];
        const indexModif = document.getElementById('indexModif').value;

        if (indexModif === "") {
            // Ajout d'un nouveau client
            clients.push(formData);
            creerArborescenceClient(formData);
        } else {
            // Modification d'un client existant
            const index = parseInt(indexModif);
            if (index >= 0 && index < clients.length) {
                formData.archived = clients[index].archived; // Conserver le statut d'archivage
                clients[index] = formData;
            }
        }

        // Sauvegarde dans le fichier
        fs.writeFileSync(cheminFichier, JSON.stringify(clients, null, 2));

        // Réinitialisation du formulaire et mise à jour de l'interface
        document.getElementById('formClient').style.display = 'none';
        document.getElementById('toggleFormBtn').textContent = 'Ajouter un nouveau client';
        isFormVisible = false;
        document.getElementById('enregistrerBtn').disabled = true;
        document.getElementById('annulerBtn').style.display = 'none';
        originalClientData = null;

        // Rafraîchir l'affichage
        chargerClients();
        updateStats();

        // Réinitialiser les champs
        resetForm();

    } catch (error) {
        console.error("Erreur lors de l'ajout/modification du client:", error);
        // Ne pas relancer l'erreur, juste la logger
    }
}

// Charger et afficher la liste des clients
function chargerClients() {
    try {
        // Vérifier si l'élément loader existe
        const loader = document.getElementById('loader');
        if (loader) {
            loader.classList.remove('hidden');
        }

        // Vérifier si le fichier existe, sinon le créer avec un tableau vide
        if (!fs.existsSync(cheminFichier)) {
            fs.writeFileSync(cheminFichier, JSON.stringify([], null, 2));
        }

        // Lire le fichier
        const data = JSON.parse(fs.readFileSync(cheminFichier));
        
        // Vérifier que data est un tableau
        if (!Array.isArray(data)) {
            throw new Error('Le fichier clients.json ne contient pas un tableau valide');
        }
        
        // Tri par défaut par date d'entrée du dossier
        data.sort((a, b) => {
            const dateA = a.dateEcheance ? new Date(a.dateEcheance) : new Date(0);
            const dateB = b.dateEcheance ? new Date(b.dateEcheance) : new Date(0);
            return dateB - dateA;
        });
        
        // Afficher les clients et mettre à jour l'interface
        afficherClients(data);
        updateStats();
        afficherRappels();
        
        // Mettre à jour le calendrier
        const calendarContent = document.getElementById('calendarContent');
        if (calendarContent) {
            calendarContent.innerHTML = '';
            generateCalendar('month');
        }
        
        return data;
    } catch (error) {
        console.error("Erreur dans chargerClients:", error);
        
        // Créer un nouveau fichier si l'erreur est liée à la lecture
        if (!fs.existsSync(cheminFichier) || error instanceof SyntaxError) {
            try {
                fs.writeFileSync(cheminFichier, JSON.stringify([], null, 2));
                afficherClients([]);
                updateStats();
                afficherRappels();
                return [];
            } catch (writeError) {
                console.error("Erreur lors de la création du fichier:", writeError);
                alert("Impossible de créer le fichier clients.json");
            }
        } else {
            alert("Erreur lors du chargement des clients : " + error.message);
        }
        return [];
    } finally {
        const loader = document.getElementById('loader');
        if (loader) {
            loader.classList.add('hidden');
        }
    }
}

// Fonction pour créer et afficher la boîte de dialogue de confirmation
function showDeleteConfirmation(client, index) {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    
    const dialog = document.createElement('div');
    dialog.className = 'dialog-content';
    
    dialog.innerHTML = `
        <h3 class="dialog-title">Confirmer la suppression</h3>
        <p class="dialog-message">Êtes-vous sûr de vouloir supprimer le dossier de <strong>${client.nom} ${client.prenom || ''}</strong> ?</p>
        <div class="dialog-buttons">
            <button class="cancel-delete">Annuler</button>
            <button class="confirm-delete">Supprimer</button>
        </div>
    `;
    
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    
    // Gestion des boutons
    dialog.querySelector('.cancel-delete').onclick = () => {
        document.body.removeChild(overlay);
    };
    
    dialog.querySelector('.confirm-delete').onclick = () => {
        try {
            // Supprimer le dossier du client
            const clientDir = path.join(__dirname, 
                client.archived ? DOSSIERS_PRINCIPAUX.archives : DOSSIERS_PRINCIPAUX.actifs,
                `${client.nom}_${client.prenom || ''}`.replace(/[<>:"/\\|?*]/g, '_'));
            
            if (fs.existsSync(clientDir)) {
                fs.rmSync(clientDir, { recursive: true, force: true });
            }

            // Supprimer le client de la liste
            let clients = fs.existsSync(cheminFichier)
                ? JSON.parse(fs.readFileSync(cheminFichier))
                : [];
            
            clients.splice(index, 1);
            fs.writeFileSync(cheminFichier, JSON.stringify(clients, null, 2));
            
            chargerClients();
            document.body.removeChild(overlay);
        } catch (error) {
            console.error("Erreur lors de la suppression:", error);
            alert("Erreur lors de la suppression du dossier");
        }
    };
}

// Charger un client et ses informations
function chargerClient(client) {
    // Charger les tags
    document.querySelectorAll('.tag-item').forEach(tagItem => {
        tagItem.classList.remove('selected'); // Réinitialiser d'abord
        if (client.tags && client.tags.includes(tagItem.textContent.trim())) {
            tagItem.classList.add('selected');
        }
    });
}

// Afficher les clients dans la liste
function afficherClients(clients) {
  const liste = document.getElementById('listeClients');
  liste.innerHTML = '';
  clients.forEach((client, index) => {
    // Filtrage selon la vue active/archivée
    if (currentView === 'active' && client.archived) return;
    if (currentView === 'archived' && !client.archived) return;

    const li = document.createElement('li');
    li.className = 'client-item';
    const clientColor = getClientColor(client.nom);
    li.style.borderLeft = `4px solid ${clientColor}`;
    li.style.paddingLeft = '10px';
    
    // Contenu synthétique (résumé)
    const info = document.createElement('div');
    info.innerHTML = `
      <p><strong>${client.numeroDossier}</strong> - ${client.nom} ${client.prenom || ''} (${client.type})</p>
      <p>Montant total (HT) : ${client.montantTotal || '0'} €</p>
      ${client.archived ? '<p style="color:red;">[Archivé]</p>' : ''}
    `;
    
    // Créez le conteneur détaillé, caché par défaut
    const detailDiv = document.createElement('div');
    detailDiv.className = 'client-detail';
    detailDiv.style.display = 'none';
    detailDiv.innerHTML = `
      <p>Nom complet : ${client.nom} ${client.prenom || ''}</p>
      <p>Adresse : ${client.adresse || ''}</p>
      <p>Téléphone : ${client.telephone || ''}</p>
      <p>Email : ${client.email || ''}</p>
      <p>Profession : ${client.profession || ''}</p>
      <p>Tribunal compétent : ${client.tribunal || '–'}</p>
      <p>Type : ${client.type || '–'}</p>
      <p>Rôle : ${client.role || '–'}</p>
      <p>Date d'audience : ${formatDateFr(client.dateAudience)}</p>
      <p>Date d'entrée du dossier : ${formatDateFr(client.dateEcheance)}</p>
      <p>Dernier contact : ${formatDateFr(client.dateContact)}</p>
      <p>Commentaire : ${client.commentaire || '–'}</p>
      
      ${client.tags && client.tags.length > 0 ? `
      <div class="client-tags">
          <strong>Tags :</strong>
          <div class="tags-display">
              ${client.tags.map(tag => `
                  <span class="tag-display">${tag}</span>
              `).join('')}
          </div>
      </div>` : ''}
      
      ${client.notes && client.notes.length > 0 ? `
      <div class="client-notes">
          <strong>Notes :</strong>
          <div class="notes-display">
              ${client.notes.map(note => `
                  <div class="note-display">
                      <div class="note-content">${note.content}</div>
                      <div class="note-date">${formatDateFr(note.date)}</div>
                  </div>
              `).join('')}
          </div>
      </div>` : ''}
      
      <hr>
      <p><strong>Adverse</strong></p>
      <p>Nom complet : ${client.nomAdverse} ${client.prenomAdverse || ''}</p>
      <p>Adresse : ${client.adresseAdverse || ''}</p>
      <p>Téléphone : ${client.telephoneAdverse || ''}</p>
      <p>Email : ${client.emailAdverse || ''}</p>
      <p>Profession : ${client.professionAdverse || ''}</p>
      <p>Aide juridictionnelle : ${client.aideJuridictionnelle || 'non'}</p>
      <p>Montant payé (HT) : ${client.montantPaye || '0'} €</p>
      <p>Reste à facturer (HT) : ${client.resteAFacturer || '0'} €</p>
    `;
    
    // Créez le conteneur des boutons
    const buttons = document.createElement('div');
    buttons.className = 'client-buttons';

    // Bouton pour basculer l'affichage détaillé
    const btnToggleDetail = document.createElement('button');
    const btnVoir = null; // évite l’erreur plus bas si le code s’attend à cette variable
    btnToggleDetail.textContent = 'Voir la fiche';
    btnToggleDetail.onclick = () => {
      if (detailDiv.style.display === 'none') {
        detailDiv.style.display = 'block';
        btnToggleDetail.textContent = 'Cacher la fiche';
      } else {
        detailDiv.style.display = 'none';
        btnToggleDetail.textContent = 'Voir la fiche';
      }
    };
    buttons.appendChild(btnToggleDetail);
    const btnModifier = document.createElement('button');
    btnModifier.textContent = 'Modifier';
    btnModifier.onclick = () => {
        // Afficher le formulaire
        isFormVisible = true;
        document.getElementById('formClient').style.display = 'block';
        document.getElementById('toggleFormBtn').textContent = 'Masquer le formulaire';
        
        // Remplissage du formulaire pour modification
        document.getElementById('nom').value = client.nom;
        document.getElementById('prenom').value = client.prenom; // Nouveau champ
        document.getElementById('adresse').value = client.adresse;
        document.getElementById('telephone').value = client.telephone;
        document.getElementById('email').value = client.email;
        document.getElementById('profession').value = client.profession;
        if(document.getElementById('tribunal')) {
            document.getElementById('tribunal').value = client.tribunal;
        }
        document.getElementById('type').value = client.type;
        document.getElementById('role').value = client.role; // Nouveau champ
        document.getElementById('dateAudience').value = client.dateAudience;
        document.getElementById('dateContact').value = client.dateContact;
        document.getElementById('dateEcheance').value = client.dateEcheance;
        document.getElementById('commentaire').value = client.commentaire;
        
        document.getElementById('nomAdverse').value = client.nomAdverse;
        document.getElementById('prenomAdverse').value = client.prenomAdverse || '';
        document.getElementById('adresseAdverse').value = client.adresseAdverse;
        document.getElementById('telephoneAdverse').value = client.telephoneAdverse;
        document.getElementById('emailAdverse').value = client.emailAdverse;
        document.getElementById('professionAdverse').value = client.professionAdverse;
        
        document.getElementById('aideJuridictionnelle').value = client.aideJuridictionnelle;
        document.getElementById('montantTotal').value = client.montantTotal;
        document.getElementById('montantPaye').value = client.montantPaye;
        
        document.getElementById('indexModif').value = index;
        
        // Stocker les données originales pour vérifier les modifications
        originalClientData = { ...client };
        
        // Charger les tags
        document.querySelectorAll('.tag-checkbox').forEach(cb => {
            cb.checked = client.tags && client.tags.includes(cb.value);
            cb.closest('.tag-item').classList.toggle('selected', cb.checked);
        });
        
        // Charger les notes
        document.getElementById('clientNotes').value = JSON.stringify(client.notes || []);
        renderNotes(client.notes || []);
        
        document.getElementById('annulerBtn').style.display = 'inline-block';
        checkFormChanges();
        
        // Faire défiler jusqu'au formulaire
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    
    const btnDupliquer = document.createElement('button');
    btnDupliquer.textContent = '📋 Dupliquer';
    btnDupliquer.onclick = () => {
        // Générer un nouveau nom unique
        let nouveauNom = `${client.nom} (copie)`;
        let numero = 1;
        const clients = fs.existsSync(cheminFichier) ? JSON.parse(fs.readFileSync(cheminFichier)) : [];
        
        // Vérifier si le nom existe déjà et incrémenter le numéro si nécessaire
        while (clients.some(c => c.nom === nouveauNom)) {
            numero++;
            nouveauNom = `${client.nom} (copie ${numero})`;
        }

        // Afficher le formulaire
        isFormVisible = true;
        document.getElementById('formClient').style.display = 'block';
        document.getElementById('toggleFormBtn').textContent = 'Masquer le formulaire';
        
        // Remplir le formulaire avec les données du client
        document.getElementById('nom').value = nouveauNom;
        document.getElementById('prenom').value = ''; // Vide pour le nouveau client
        document.getElementById('adresse').value = client.adresse;
        document.getElementById('telephone').value = client.telephone;
        document.getElementById('email').value = client.email;
        document.getElementById('profession').value = client.profession;
        document.getElementById('tribunal').value = client.tribunal;
        document.getElementById('type').value = client.type;
        document.getElementById('role').value = ''; // Vide pour le nouveau client
        document.getElementById('dateAudience').value = '';  // Vide car nouvelle audience
        document.getElementById('dateContact').value = '';   // Vide car nouveau contact
        document.getElementById('dateEcheance').value = '';  // Vide car nouvelle date
        document.getElementById('commentaire').value = client.commentaire;
        
        document.getElementById('nomAdverse').value = client.nomAdverse;
        document.getElementById('prenomAdverse').value = client.prenomAdverse || '';
        document.getElementById('adresseAdverse').value = client.adresseAdverse;
        document.getElementById('telephoneAdverse').value = client.telephoneAdverse;
        document.getElementById('emailAdverse').value = client.emailAdverse;
        document.getElementById('professionAdverse').value = client.professionAdverse;
        
        document.getElementById('aideJuridictionnelle').value = client.aideJuridictionnelle;
        document.getElementById('montantTotal').value = client.montantTotal;
        document.getElementById('montantPaye').value = '0'; // Montant payé à 0 pour le nouveau client
        
        // Réinitialiser l'index de modification car c'est un nouveau client
        document.getElementById('indexModif').value = '';
        originalClientData = null;
        
        // Activer le bouton Enregistrer
        document.getElementById('enregistrerBtn').disabled = false;
        document.getElementById('annulerBtn').style.display = 'inline-block';
        
        // Faire défiler jusqu'au formulaire
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    
    const btnExporter = document.createElement('button');
    btnExporter.textContent = 'Exporter en PDF';
    btnExporter.onclick = () => exporterFichePDF(client);
    
    const btnJoindre = document.createElement('button');
    btnJoindre.textContent = 'Joindre un fichier';
    btnJoindre.onclick = () => joindreFichier(client);
    
    const btnSuppr = document.createElement('button');
    btnSuppr.textContent = 'Supprimer';
    btnSuppr.onclick = () => showDeleteConfirmation(client, index);
    
    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = client.archived ? 'Désarchiver' : 'Archiver';
    toggleBtn.onclick = () => toggleArchive(index);
    
    const btnEmail = document.createElement('button');
    btnEmail.innerHTML = '📧 Email';
    btnEmail.onclick = () => {
        if (client.email) {
            const subject = `${client.numeroDossier} - ${client.nom} / ${client.nomAdverse || 'Sans adversaire'}`;
            const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(client.email)}&su=${encodeURIComponent(subject)}`;
            shell.openExternal(gmailUrl);
        } else {
            alert('Aucune adresse email renseignée pour ce client');
        }
    };
    
    // Ajouter les boutons dans le conteneur dans l'ordre souhaité
    buttons.appendChild(btnEmail); // Nouveau bouton email
    buttons.appendChild(btnModifier);
    buttons.appendChild(btnDupliquer);
    buttons.appendChild(btnJoindre);
    buttons.appendChild(btnExporter);
    buttons.appendChild(btnSuppr);
    buttons.appendChild(toggleBtn);
    
    // Ajoutez les éléments dans le li dans l'ordre souhaité
    li.appendChild(info);
    li.appendChild(detailDiv);
    li.appendChild(buttons);
    liste.appendChild(li);
  });
}

function toggleArchive(index) {
    try {
        let clients = fs.existsSync(cheminFichier)
            ? JSON.parse(fs.readFileSync(cheminFichier))
            : [];
        
        const client = clients[index];
        const ancienDossier = path.join(__dirname, 
            client.archived ? DOSSIERS_PRINCIPAUX.archives : DOSSIERS_PRINCIPAUX.actifs,
            `${client.nom}_${client.prenom || ''}`.replace(/[<>:"/\\|?*]/g, '_'));
        
        // Basculer le statut
        client.archived = !client.archived;
        
        const nouveauDossier = path.join(__dirname, 
            client.archived ? DOSSIERS_PRINCIPAUX.archives : DOSSIERS_PRINCIPAUX.actifs,
            `${client.nom}_${client.prenom || ''}`.replace(/[<>:"/\\|?*]/g, '_'));

        // Si l'ancien dossier existe, le déplacer
        if (fs.existsSync(ancienDossier)) {
            // Assurer que le dossier parent existe
            const nouveauDossierParent = path.dirname(nouveauDossier);
            if (!fs.existsSync(nouveauDossierParent)) {
                fs.mkdirSync(nouveauDossierParent, { recursive: true });
            }
            fs.renameSync(ancienDossier, nouveauDossier);
        } else {
            // Si l'ancien dossier n'existe pas, créer la nouvelle arborescence
            creerArborescenceClient(client);
        }

        // Pour les clients existants qui n'ont pas encore d'arborescence
        if (!fs.existsSync(nouveauDossier)) {
            creerArborescenceClient(client);
        }

        // Mettre à jour le fichier clients.json
        fs.writeFileSync(cheminFichier, JSON.stringify(clients, null, 2));
        chargerClients();
    } catch (error) {
        console.error("Erreur dans toggleArchive:", error);
        alert("Erreur lors de l'archivage/désarchivage du dossier");
    }
}

function switchView(view) {
    currentView = view;
    
    // Mise à jour visuelle des boutons
    const btnActive = document.getElementById('btnActive');
    const btnArchived = document.getElementById('btnArchived');
    
    if (view === 'active') {
        btnActive.classList.add('active');
        btnArchived.classList.remove('active');
    } else {
        btnActive.classList.remove('active');
        btnArchived.classList.add('active');
    }
    
    // Recharger la liste des clients
    const clients = fs.existsSync(cheminFichier) 
        ? JSON.parse(fs.readFileSync(cheminFichier))
        : [];
    afficherClients(clients);
}

function toggleCalendar() {
    const calendarArea = document.getElementById('calendarArea');
    const btnCalendrier = document.getElementById('btnCalendrier');
    
    if (calendarArea.style.display === 'none' || calendarArea.style.display === '') {
        calendarArea.style.display = 'block';
        btnCalendrier.textContent = 'Cacher le calendrier';
        generateCalendar('month'); // Génère le calendrier mensuel
    } else {
        calendarArea.style.display = 'none';
        btnCalendrier.textContent = 'Voir le calendrier';
    }
}

function generateCalendar(viewMode) {
  const contentDiv = document.getElementById('calendarContent');
  contentDiv.innerHTML = ''; // Nettoyer le contenu précédent
  if (viewMode === 'month') {
    generateMonthlyCalendar(contentDiv);
  } else if (viewMode === 'year') {
    generateYearlyCalendar(contentDiv);
  }  
}

function formatClientDate(dateStr) {
  if (!dateStr) return "";
  const [yyyy, mm, dd] = dateStr.split("-");
  return `${dd}-${mm}-${yyyy}`;
}

function generateMonthlyCalendar(container) {
  // Récupérer les clients non archivés uniquement
  const clients = fs.existsSync(cheminFichier) 
    ? JSON.parse(fs.readFileSync(cheminFichier)).filter(client => !client.archived)
    : [];

  const annee = currentCalendarDate.getFullYear();
  const moisIndex = currentCalendarDate.getMonth();
  const premierJour = new Date(annee, moisIndex, 1).getDay();
  const nbJours = new Date(annee, moisIndex + 1, 0).getDate();
  const mois = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

  // Navigation du calendrier
  const navDiv = document.createElement('div');
  navDiv.style.textAlign = 'center';
  navDiv.style.marginBottom = '10px';
  navDiv.classList.add('calendar-nav');

  const btnPrev = document.createElement('button');
  btnPrev.innerHTML = '&#10094;';
  btnPrev.classList.add('calendar-arrow');
  btnPrev.onclick = () => {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
    container.innerHTML = '';
    generateMonthlyCalendar(container);
  };

  const monthTitle = document.createElement('span');
  monthTitle.textContent = `${mois[moisIndex]} ${annee}`;
  monthTitle.classList.add('calendar-title');

  const btnNext = document.createElement('button');
  btnNext.innerHTML = '&#10095;';
  btnNext.classList.add('calendar-arrow');
  btnNext.onclick = () => {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
    container.innerHTML = '';
    generateMonthlyCalendar(container);
  };

  navDiv.appendChild(btnPrev);
  navDiv.appendChild(monthTitle);
  navDiv.appendChild(btnNext);
  container.appendChild(navDiv);

  // Création du tableau du calendrier
  let html = '<table style="width:100%; border-collapse:collapse;">';
  html += '<thead><tr>';
  ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].forEach(j => {
    html += `<th style="border:1px solid #ddd; padding:5px;">${j}</th>`;
  });
  html += '</tr></thead><tbody>';

  // Calcul du premier jour de la semaine
  let adjustedDay = (premierJour + 6) % 7;
  let row = '<tr>';
  
  // Cellules vides pour le début du mois
  for (let i = 0; i < adjustedDay; i++) {
    row += '<td style="border:1px solid #ddd; padding:5px;"></td>';
  }

  // Remplissage des jours du mois
  for (let jour = 1; jour <= nbJours; jour++) {
    const td = document.createElement('td');
    td.style.border = "1px solid #ddd";
    td.style.padding = "5px";
    td.style.verticalAlign = "top";
    
    // Date formatée pour comparaison
    const dateStr = `${annee}-${String(moisIndex + 1).padStart(2, '0')}-${String(jour).padStart(2, '0')}`;
    
    // Numéro du jour
    td.innerHTML = `<strong>${jour}</strong>`;
    
    // Vérification des événements pour cette date
    const evenements = clients.filter(c => 
      c.dateAudience === dateStr || 
      c.dateEcheance === dateStr || 
      c.dateContact === dateStr
    );

    // Ajout des événements s'il y en a
    if (evenements.length > 0) {
      evenements.forEach(evt => {
        const div = document.createElement('div');
        const clientColor = getClientColor(evt.nom);
        div.style.borderColor = clientColor;
        div.style.backgroundColor = 'white';
        div.style.color = '#333';
        div.textContent = `${evt.nom} (${evt.dateAudience === dateStr ? 'Audience' : 
                                        evt.dateEcheance === dateStr ? 'Entrée' : 'Contact'})`;
        td.appendChild(div);
      });
    }

    row += td.outerHTML;
    adjustedDay++;
    
    if (adjustedDay === 7) {
      row += '</tr>';
      html += row;
      row = '<tr>';
      adjustedDay = 0;
    }
  }

  // Compléter la dernière semaine si nécessaire
  if (adjustedDay !== 0) {
    for (let i = adjustedDay; i < 7; i++) {
      row += '<td style="border:1px solid #ddd; padding:5px;"></td>';
    }
    row += '</tr>';
    html += row;
  }

  html += '</tbody></table>';
  container.insertAdjacentHTML('beforeend', html);
}

function generateYearlyCalendar(container) {
  // Vider le conteneur de contenu
  container.innerHTML = '';

  // Créer le conteneur de navigation pour l'année
  const navDiv = document.createElement('div');
  navDiv.style.textAlign = 'center';
  navDiv.style.marginBottom = '10px';

  const btnPrev = document.createElement('button');
  btnPrev.textContent = 'Précédent';
  btnPrev.onclick = () => {
    currentCalendarDate.setFullYear(currentCalendarDate.getFullYear() - 1);
    generateYearlyCalendar(container);
  };

  const btnNext = document.createElement('button');
  btnNext.textContent = 'Suivant';
  btnNext.onclick = () => {
    currentCalendarDate.setFullYear(currentCalendarDate.getFullYear() + 1);
    generateYearlyCalendar(container);
  };

  navDiv.appendChild(btnPrev);
  navDiv.appendChild(btnNext);
  container.appendChild(navDiv);

  // Générer la vue annuelle
  const today = new Date(currentCalendarDate);
  const annee = today.getFullYear();
  const mois = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  let html = `<h2>Année ${annee}</h2>`;
  html += '<div style="display:flex; flex-wrap:wrap;">';
  for (let m = 0; m < 12; m++) {
    html += `<div style="flex:1 0 30%; margin:5px; border:1px solid #ddd; padding:5px;">`;
    html += `<h3>${mois[m]}</h3>`;
    const nbJours = new Date(annee, m + 1, 0).getDate();
    html += `<p>${nbJours} jours</p>`;
    html += `</div>`;
  }
  html += '</div>';
  container.insertAdjacentHTML('beforeend', html);
}

function updateStats() {
    const clients = fs.existsSync(cheminFichier) ? JSON.parse(fs.readFileSync(cheminFichier)) : [];
    
    let openCount = 0;
    let archivedCount = 0;
    let sumMontantTotal = 0;
    let sumMontantPaye = 0;
    let sumReste = 0;
    
    clients.forEach(client => {
        if (client.archived) {
            archivedCount++;
        } else {
            openCount++;
        }
        
        sumMontantTotal += parseFloat(client.montantTotal) || 0;
        sumMontantPaye += parseFloat(client.montantPaye) || 0;
        sumReste += parseFloat(client.resteAFacturer) || 0;
    });
    
    const statsHtml = `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon">📁</div>
                <div class="stat-value">${openCount}</div>
                <div class="stat-label">Dossiers en cours</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">📦</div>
                <div class="stat-value">${archivedCount}</div>
                <div class="stat-label">Dossiers archivés</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">💰</div>
                <div class="stat-value">${sumMontantTotal.toFixed(2)} €</div>
                <div class="stat-label">Montant total HT</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">✅</div>
                <div class="stat-value">${sumMontantPaye.toFixed(2)} €</div>
                <div class="stat-label">Montant payé HT</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">⏳</div>
                <div class="stat-value">${sumReste.toFixed(2)} €</div>
                <div class="stat-label">Reste à facturer HT</div>
            </div>
        </div>
    `;
    
    document.getElementById('statsContent').innerHTML = statsHtml;
}

function checkFormChanges() {
    // Si c'est un nouveau client (pas de données originales), on active toujours le bouton
    if (!originalClientData) {
        document.getElementById('enregistrerBtn').disabled = false;
        return;
    }
    
    // Pour une modification, on compare avec les données originales
    const currentData = {
        nom: document.getElementById('nom').value,
        prenom: document.getElementById('prenom').value,
        adresse: document.getElementById('adresse').value,
        telephone: document.getElementById('telephone').value,
        email: document.getElementById('email').value,
        profession: document.getElementById('profession').value,
        tribunal: document.getElementById('tribunal').value,
        type: document.getElementById('type').value,
        role: document.getElementById('role').value, // Nouveau champ
        dateAudience: document.getElementById('dateAudience').value,
        dateContact: document.getElementById('dateContact').value,
        dateEcheance: document.getElementById('dateEcheance').value,
        commentaire: document.getElementById('commentaire').value,
        nomAdverse: document.getElementById('nomAdverse').value,
        prenomAdverse: document.getElementById('prenomAdverse').value,
        adresseAdverse: document.getElementById('adresseAdverse').value,
        telephoneAdverse: document.getElementById('telephoneAdverse').value,
        emailAdverse: document.getElementById('emailAdverse').value,
        professionAdverse: document.getElementById('professionAdverse').value,
        aideJuridictionnelle: document.getElementById('aideJuridictionnelle').value,
        montantTotal: document.getElementById('montantTotal').value,
        montantPaye: document.getElementById('montantPaye').value,
        // Ajouter les notes et tags
        notes: JSON.parse(document.getElementById('clientNotes').value || '[]'),
        tags: Array.from(document.querySelectorAll('.tag-checkbox:checked')).map(cb => cb.value)
    };
    
    let modified = false;

    // Vérifier les champs simples
    for (let key in originalClientData) {
        if (key === 'notes' || key === 'tags') continue; // On les traite séparément
        if (originalClientData[key] != currentData[key]) {
            modified = true;
            break;
        }
    }

    // Vérifier les notes
    if (!modified) {
        const originalNotes = originalClientData.notes || [];
        const currentNotes = currentData.notes;
        if (originalNotes.length !== currentNotes.length) {
            modified = true;
        } else {
            // Comparer chaque note
            modified = JSON.stringify(originalNotes) !== JSON.stringify(currentNotes);
        }
    }

    // Vérifier les tags
    if (!modified) {
        const originalTags = originalClientData.tags || [];
        const currentTags = currentData.tags;
        if (originalTags.length !== currentTags.length) {
            modified = true;
        } else {
            modified = JSON.stringify(originalTags.sort()) !== JSON.stringify(currentTags.sort());
        }
    }
    
    document.getElementById('enregistrerBtn').disabled = !modified;
}

function annulerModification() {
    // Réinitialiser tous les champs du formulaire à vide
    document.getElementById('nom').value = '';
    document.getElementById('prenom').value = ''; // Nouveau champ
    document.getElementById('adresse').value = '';
    document.getElementById('telephone').value = '';
    document.getElementById('email').value = '';
    document.getElementById('profession').value = '';
    if (document.getElementById('tribunal')) document.getElementById('tribunal').value = '';
    document.getElementById('type').value = '';
    document.getElementById('role').value = ''; // Nouveau champ
    document.getElementById('dateAudience').value = '';
    document.getElementById('dateContact').value = '';
    document.getElementById('dateEcheance').value = '';
    document.getElementById('commentaire').value = '';
    
    document.getElementById('nomAdverse').value = '';
    document.getElementById('prenomAdverse').value = '';
    document.getElementById('adresseAdverse').value = '';
    document.getElementById('telephoneAdverse').value = '';
    document.getElementById('emailAdverse').value = '';
    document.getElementById('professionAdverse').value = '';
    
    document.getElementById('aideJuridictionnelle').value = 'non';
    document.getElementById('montantTotal').value = '';
    document.getElementById('montantPaye').value = '';
    
    // Effacer l'indice de modification et les données originales
    document.getElementById('indexModif').value = '';
    originalClientData = null;
    
    // Désactiver le bouton Enregistrer et masquer le bouton Annuler
    document.getElementById('enregistrerBtn').disabled = true;
    document.getElementById('annulerBtn').style.display = 'none';

    // Mise à jour du bouton et de l'affichage
    isFormVisible = false;
    document.getElementById('formClient').style.display = 'none';
    document.getElementById('toggleFormBtn').textContent = 'Ajouter un nouveau client';
}

// Afficher la fiche détaillée d'un client
function afficherFicheClient(client) {
  const fiche = document.getElementById('fiche-detaillee');
  fiche.innerHTML = `
    <h3>Fiche détaillée</h3>
    <p><strong>Client</strong></p>
    <p>Nom complet : ${client.nom} ${client.prenom || ''}</p>
    <p>Adresse : ${client.adresse || ''}</p>
    <p>Téléphone : ${client.telephone || ''}</p>
    <p>Email : ${client.email || ''}</p>
    <p>Profession : ${client.profession || ''}</p>
    <p>Tribunal compétent : ${client.tribunal || '–'}</p>
    <p>Type de dossier : ${client.type}</p>
    <p>Rôle : ${client.role || '–'}</p>
    <p>Date d'audience : ${formatDateFr(client.dateAudience)}</p>
    <p>Date d'entrée du dossier : ${formatDateFr(client.dateEcheance)}</p>
    <p>Dernier contact : ${formatDateFr(client.dateContact)}</p>
    <p>Commentaire : ${client.commentaire || '–'}</p>
    <hr>
    <p><strong>Facturation</strong></p>
    <p>Montant total (HT) : ${client.montantTotal || '0'} €</p>
    <p>Montant payé (HT) : ${client.montantPaye || '0'} €</p>
    <p>Reste à facturer (HT) : ${client.resteAFacturer || '0'} €</p>
    <hr>
    <p><strong>Adverse</strong></p>
    <p>Nom complet : ${client.nomAdverse} ${client.prenomAdverse || ''}</p>
    <p>Adresse : ${client.adresseAdverse || ''}</p>
    <p>Téléphone : ${client.telephoneAdverse || ''}</p>
    <p>Email : ${client.emailAdverse || ''}</p>
    <p>Profession : ${client.professionAdverse || ''}</p>
    <p>Aide juridictionnelle : ${client.aideJuridictionnelle || 'non'}</p>
    <button onclick="document.getElementById('fiche-detaillee').style.display='none'">Fermer</button>
  `;
  fiche.style.display = 'block';
}


// Filtrer les clients en fonction de la recherche
function filtrerClients() {
  try {
    const filtre = document.getElementById('recherche').value.toLowerCase();
    const data = fs.existsSync(cheminFichier)
      ? JSON.parse(fs.readFileSync(cheminFichier))
      : [];
    const resultat = data.filter(client =>
      `${client.nom} ${client.prenom || ''} ${client.type} ${client.role || ''} ${client.adresse} ${client.telephone} ${client.email} ${client.profession} ${client.commentaire} ${client.nomAdverse} ${client.prenomAdverse || ''} ${client.adresseAdverse} ${client.telephoneAdverse} ${client.emailAdverse} ${client.professionAdverse}`.toLowerCase().includes(filtre)
    );
    afficherClients(resultat);
  } catch (error) {
    console.error("Erreur dans filtrerClients:", error);
  }
}

// Trier la liste des clients selon un critère
function appliquerTri() {
  try {
    const critere = document.getElementById('tri').value;
    const data = fs.existsSync(cheminFichier)
      ? JSON.parse(fs.readFileSync(cheminFichier))
      : [];
    const tries = data.slice().sort((a, b) => {
      if (!a[critere]) return 1;
      if (!b[critere]) return -1;
      if (critere.startsWith('date')) {
        return new Date(a[critere]) - new Date(b[critere]);
      } else {
        return a[critere].localeCompare(b[critere]);
      }
    });
    afficherClients(tries);
  } catch (error) {
    console.error("Erreur dans appliquerTri:", error);
  }
}

// Imprimer tous les dossiers clients
function imprimerTousLesClients() {
  try {
    const clients = fs.existsSync(cheminFichier)
      ? JSON.parse(fs.readFileSync(cheminFichier))
      : [];
    let contenu = `<html><head><title>Dossiers</title></head><body><h1>Liste des clients</h1>`;
    clients.forEach(c => {
      contenu += `<p><strong>${c.nom} ${c.prenom || ''}</strong> - ${c.type} - Audience : ${formatDateFr(c.dateAudience)} - Date d'entrée du dossier : ${formatDateFr(c.dateEcheance)} - Contact : ${formatDateFr(c.dateContact)}</p>`;
    });
    contenu += `<script>window.onload = () => window.print();<\/script></body></html>`;
    const fenetre = window.open('', '_blank');
    fenetre.document.write(contenu);
    fenetre.document.close();
  } catch (error) {
    console.error("Erreur dans imprimerTousLesClients:", error);
  }
}

// Joindre un fichier à un client
async function joindreFichier(client) {
  try {
    const dossierClient = path.join(__dirname, 'fichiers_clients', client.nom.replace(/\s+/g, '_'));
    
    if (!fs.existsSync(dossierClient)) {
      fs.mkdirSync(dossierClient, { recursive: true });
    }

    const result = await dialog.showOpenDialog({
      title: "Choisir un fichier à joindre",
      properties: ['openFile'],
      filters: [
        { name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'txt', 'jpg', 'png'] }
      ]
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const fichierSource = result.filePaths[0];
      const nomFichier = path.basename(fichierSource);
      const cheminDestination = path.join(dossierClient, nomFichier);
      
      fs.copyFileSync(fichierSource, cheminDestination);
      alert("Fichier joint avec succès !");
      chargerClients();
    }
  } catch (error) {
    console.error("Erreur lors de l'ajout du fichier:", error);
    alert("Erreur lors de l'ajout du fichier");
  }
}

// Afficher les fichiers joints dans la fiche client
function afficherFichiersJoints(client, container) {
  try {
    const dossierClient = path.join(__dirname, 'fichiers_clients', client.nom.replace(/\s+/g, '_'));
    if (fs.existsSync(dossierClient)) {
      const fichiers = fs.readdirSync(dossierClient);
      if (fichiers.length > 0) {
        const blocFichiers = document.createElement('div');
        blocFichiers.innerHTML = `<strong>Fichiers joints :</strong>`;
        fichiers.forEach(nomFichier => {
          const ligne = document.createElement('div');
          ligne.style.margin = '6px 0';
          ligne.style.display = 'flex';
          ligne.style.alignItems = 'center';
          ligne.style.gap = '10px';
          const lien = document.createElement('a');
          lien.href = '#';
          lien.textContent = nomFichier;
          lien.onclick = () => {
            const chemin = path.join(dossierClient, nomFichier);
            shell.openPath(chemin);
          };
          const boutonSuppr = document.createElement('button');
          boutonSuppr.textContent = "🗑️";
          boutonSuppr.style.padding = "2px 8px";
          boutonSuppr.style.background = "#e74c3c";
          boutonSuppr.style.border = "none";
          boutonSuppr.style.borderRadius = "5px";
          boutonSuppr.style.color = "white";
          boutonSuppr.style.cursor = "pointer";
          boutonSuppr.onclick = () => {
            const chemin = path.join(dossierClient, nomFichier);
            if (fs.existsSync(chemin)) {
              fs.unlinkSync(chemin);
              chargerClients();
            }
          };
          ligne.appendChild(lien);
          ligne.appendChild(boutonSuppr);
          blocFichiers.appendChild(ligne);
        });
        container.appendChild(blocFichiers);
      }
    }
  } catch (error) {
    console.error("Erreur dans afficherFichiersJoints:", error);
  }
}

// Afficher le calendrier des audiences et dates d'entrée du dossier
function afficherCalendrier() {
  try {
    const container = document.getElementById('calendrier');
    const btn = document.getElementById('btnCalendrier');
    if (container.style.display === 'block') {
      container.style.display = 'none';
      btn.textContent = 'Voir le calendrier';
      return;
    }
    container.innerHTML = '';
    container.style.display = 'block';
    btn.textContent = 'Cacher le calendrier';
    const mois = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
    const aujourdhui = new Date();
    const annee = aujourdhui.getFullYear();
    const moisIndex = aujourdhui.getMonth();
    const premierJour = new Date(annee, moisIndex, 1).getDay();
    const nbJours = new Date(annee, moisIndex + 1, 0).getDate();
    const titre = document.createElement('h2');
    titre.textContent = `${mois[moisIndex]} ${annee}`;
    container.appendChild(titre);
    const table = document.createElement('table');
    const jours = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    jours.forEach(j => {
      const th = document.createElement('th');
      th.textContent = j;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    let row = document.createElement('tr');
    let jourSemaine = (premierJour + 6) % 7;
    for (let i = 0; jourSemaine; i++) {
      row.appendChild(document.createElement('td'));
    }
    const data = fs.existsSync(cheminFichier)
      ? JSON.parse(fs.readFileSync(cheminFichier))
      : [];
    for (let jour = 1; jour <= nbJours; jour++) {
      const td = document.createElement('td');
      td.style.border = "1px solid #ddd";
      td.style.padding = "5px";
      td.innerHTML = `<strong>${jour}</strong><br>`;
      const dateStr = new Date(annee, moisIndex, jour).toISOString().split('T')[0];
      data.forEach(client => {
        if (client.dateAudience === dateStr || client.dateEcheance === dateStr) {
          const evt = document.createElement('div');
          evt.textContent = `${client.nom} ${client.prenom || ''} (${client.dateAudience === dateStr ? 'Audience' : 'Entrée'})`;
          evt.style.fontSize = '12px';
          evt.style.background = client.dateAudience === dateStr ? '#3498db' : '#e67e22';
          evt.style.color = 'white';
          evt.style.padding = '2px 4px';
          evt.style.marginTop = '4px';
          evt.style.borderRadius = '4px';
          td.appendChild(evt);
        }
      });
      row.appendChild(td);
      jourSemaine++;
      if (jourSemaine === 7) {
        tbody.appendChild(row);
        row = document.createElement('tr');
        jourSemaine = 0;
      }
    }
    if (jourSemaine !== 0) {
      while (jourSemaine++ < 7) row.appendChild(document.createElement('td'));
      tbody.appendChild(row);
    }
    table.appendChild(tbody);
    container.appendChild(table);
  } catch (error) {
    console.error("Erreur dans afficherCalendrier:", error);
  }
}

// Exporter la fiche client en PDF en incluant toutes les informations
function exporterFichePDF(client) {
  try {
    const stream = fs.createWriteStream(cheminFichierPdf);
    doc.pipe(stream);

    // En-tête de la fiche
    doc.fontSize(20).text(`Fiche Client`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(18).text(`${nom} ${prenom || ''}`, { align: 'center', underline: true });
    doc.moveDown(1);

    // Informations du dossier
    doc.fontSize(12);
    doc.text(`Type de dossier : ${type}`);
    doc.text(`Rôle : ${role || '–'}`); // Ajout du rôle
    doc.text(`Date d'audience : ${formatDateFr(dateAudience)}`);
    doc.text(`Date de dernier contact : ${formatDateFr(dateContact)}`);
    // Modification ici
    doc.text(`Date d'entrée du dossier : ${formatDateFr(dateEcheance)}`);
    doc.moveDown();

    // Informations du client
    doc.fontSize(14).text("Informations du client", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Adresse : ${adresse || '–'}`);
    doc.text(`Téléphone : ${telephone || '–'}`);
    doc.text(`Email : ${email || '–'}`);
    doc.text(`Profession : ${profession || '–'}`);
    doc.moveDown();

    // Informations de l'adverse
    doc.fontSize(14).text("Informations de l'adverse", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Nom complet : ${nomAdverse} ${prenomAdverse || ''}`);
    doc.text(`Adresse : ${adresseAdverse || '–'}`);
    doc.text(`Téléphone : ${telephoneAdverse || '–'}`);
    doc.text(`Email : ${emailAdverse || '–'}`);
    doc.text(`Profession : ${professionAdverse || '–'}`);
    doc.moveDown();

    doc.fontSize(14).text("Facturation :", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Montant total (HT) : ${client.montantTotal || '0'} €`, { indent: 20 });
    doc.text(`Montant payé (HT) : ${client.montantPaye || '0'} €`, { indent: 20 });
    doc.text(`Reste à facturer (HT) : ${client.resteAFacturer || '0'} €`, { indent: 20 });
    doc.moveDown();
    
    

    // Commentaire
    doc.fontSize(14).text("Commentaire :", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12).text(commentaire || "–", { indent: 20 });
    doc.moveDown();

    // Pièces jointes
    const dossierClient = path.join(__dirname, 'fichiers_clients', nom.replace(/\s+/g, '_'));
    if (fs.existsSync(dossierClient)) {
      const fichiers = fs.readdirSync(dossierClient);
      if (fichiers.length > 0) {
        doc.fontSize(14).text('Pièces jointes :', { underline: true });
        doc.moveDown(0.5);
        fichiers.forEach(fichier => {
          doc.fontSize(12).text(`• ${fichier}`, { indent: 20 });
        });
      }
    }

    doc.end();
    stream.on('finish', () => {
      shell.openPath(cheminFichierPdf);
    });
  } catch (error) {
    console.error("Erreur dans exporterFichePDF:", error);
  }
}

function initializeTags() {
    const container = document.querySelector('.tags-container');
    if (!container) return;
    
    // Vider le conteneur avant d'ajouter les tags
    container.innerHTML = '';
    
    // Créer les tags
    TAGS_PREDEFINED.forEach(tag => {
        const tagDiv = document.createElement('div');
        tagDiv.className = 'tag-item';
        tagDiv.textContent = tag;
        
        tagDiv.addEventListener('click', () => {
            tagDiv.classList.toggle('selected');
            // Activer le bouton Enregistrer
            const enregistrerBtn = document.getElementById('enregistrerBtn');
            if (enregistrerBtn) enregistrerBtn.disabled = false;
        });
        
        container.appendChild(tagDiv);
    });
}

function addNote() {
    const input = document.getElementById('newNote');
    const content = input.value.trim();
    if (!content) return;

    // Activer le bouton Enregistrer car il y a eu une modification
    const enregistrerBtn = document.getElementById('enregistrerBtn');
    if (enregistrerBtn) enregistrerBtn.disabled = false;

    // Récupérer les notes existantes ou initialiser un tableau vide
    const notes = JSON.parse(document.getElementById('clientNotes').value || '[]');
    
    // Ajouter la nouvelle note
    notes.push({
        content,
        date: new Date().toISOString(),
        id: Date.now()
    });

    // Mettre à jour le champ caché et l'affichage
    document.getElementById('clientNotes').value = JSON.stringify(notes);
    renderNotes(notes);
    input.value = '';
}

function deleteNote(id) {
    // Récupérer les notes existantes
    const notes = JSON.parse(document.getElementById('clientNotes').value || '[]');
    
    // Filtrer pour retirer la note à supprimer
    const updatedNotes = notes.filter(note => note.id !== id);
    
    // Activer le bouton Enregistrer car il y a eu une modification
    const enregistrerBtn = document.getElementById('enregistrerBtn');
    if (enregistrerBtn) enregistrerBtn.disabled = false;

    // Mettre à jour le champ caché et l'affichage
    document.getElementById('clientNotes').value = JSON.stringify(updatedNotes);
    renderNotes(updatedNotes);
}

function renderNotes(notes) {
    const container = document.querySelector('.notes-list');
    if (!container) return;

    container.innerHTML = notes.map(note => `
        <div class="note-item">
            <div class="note-content">
                ${note.content}
                <div class="note-date">${formatDateFr(note.date)}</div>
            </div>
            <button class="note-delete" onclick="deleteNote(${note.id})">✖</button>
        </div>
    `).join('');
}

function afficherRappels() {
    const clients = fs.existsSync(cheminFichier) ? JSON.parse(fs.readFileSync(cheminFichier)) : [];
    const rappels = [];

    clients.forEach(client => {
        // Ne traiter que les clients non archivés
        if (!client.archived) {
            ['dateAudience', 'dateContact', 'dateEcheance'].forEach(type => {
                if (client[type]) {
                    const date = new Date(client[type]);
                    if (!isNaN(date)) {
                        rappels.push({
                            date,
                            type,
                            nom: client.nom,
                            prenom: client.prenom || '',
                            color: getClientColor(client.nom)
                        });
                    }
                }
            });
        }
    });

    const aujourdHui = new Date();
    const rappelsAVenir = rappels
        .filter(r => r.date >= aujourdHui)
        .sort((a, b) => a.date - b.date)
        .slice(0, 10);

    const container = document.getElementById('listeRappels');
    container.innerHTML = `
        <div class="rappels-container">
            <div class="rappels-header">
                <span class="rappel-icon">🔔</span>
                <h3>Prochains événements</h3>
            </div>
            ${rappelsAVenir.length === 0 ? 
                '<div class="no-rappels">Aucun rappel à venir</div>' :
                `<div class="rappels-list">
                    ${rappelsAVenir.map(rappel => `
                        <div class="rappel-item" style="border-left: 4px solid ${rappel.color}">
                            <div class="rappel-date">${formatDateFr(rappel.date.toISOString().split('T')[0])}</div>
                            <div class="rappel-details">
                                <div class="rappel-client">${rappel.nom} ${rappel.prenom}</div>
                                <div class="rappel-type">${
                                    rappel.type === 'dateAudience' ? '⚖️ Audience' :
                                    rappel.type === 'dateContact' ? '📞 Contact' :
                                    '📥 Entrée dossier'
                                }</div>
                            </div>
                        </div>
                    `).join('')}
                </div>`
            }
        </div>
    `;
}

function creerArborescencePourClientsExistants() {
    try {
        const clients = fs.existsSync(cheminFichier)
            ? JSON.parse(fs.readFileSync(cheminFichier))
            : [];

        clients.forEach(client => {
            const dossierClient = path.join(__dirname, 
                client.archived ? 'Dossiers archivés' : 'Dossiers en cours',
                `${client.nom}_${client.prenom || ''}`.replace(/[<>:"/\\|?*]/g, '_'));

            if (!fs.existsSync(dossierClient)) {
                creerArborescenceClient(client);
            }
        });
    } catch (error) {
        console.error("Erreur lors de la création des arborescences:", error);
    }
}

// Fonction pour initialiser l'explorateur de fichiers
function initializeFileExplorer() {
    const treeView = document.getElementById('treeView');
    const fileList = document.getElementById('fileList');
    
    function loadDirectory(dirPath) {
        try {
            const items = fs.readdirSync(dirPath, { withFileTypes: true });
            // Ne garder que les dossiers principaux ou les sous-dossiers des dossiers principaux
            const directories = items
                .filter(item => {
                    if (!item.isDirectory()) return false;
                    const fullPath = path.join(dirPath, item.name);
                    const relativePath = path.relative(__dirname, fullPath);
                    // Vérifier si c'est un dossier principal ou un sous-dossier
                    return item.name === DOSSIERS_PRINCIPAUX.actifs ||
                           item.name === DOSSIERS_PRINCIPAUX.archives ||
                           relativePath.startsWith(DOSSIERS_PRINCIPAUX.actifs) ||
                           relativePath.startsWith(DOSSIERS_PRINCIPAUX.archives);
                })
                .map(item => ({
                    name: item.name,
                    path: path.join(dirPath, item.name),
                    type: 'folder'
                }));
            
            const files = items
                .filter(item => item.isFile())
                .map(item => ({
                    name: item.name,
                    path: path.join(dirPath, item.name),
                    type: 'file'
                }));
            
            return [...directories, ...files];
        } catch (error) {
            console.error('Erreur lors du chargement du dossier:', error);
            return [];
        }
    }

    function renderTreeView(dirPath, parentElement) {
        const items = loadDirectory(dirPath);
        
        items.filter(item => item.type === 'folder').forEach(folder => {
            const folderDiv = document.createElement('div');
            folderDiv.className = 'folder-item';
            folderDiv.innerHTML = `
                <span class="folder-toggle">▶</span>
                <span class="folder-icon">📁</span>
                <span class="folder-name">${folder.name}</span>
            `;
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'folder-content';
            contentDiv.style.display = 'none';
            
            // Gérer le clic sur le dossier
            folderDiv.onclick = () => {
                renderFileList(folder.path);
            };
            
            // Gérer l'expansion/réduction du dossier
            folderDiv.querySelector('.folder-toggle').onclick = (e) => {
                e.stopPropagation();
                const isExpanded = contentDiv.style.display !== 'none';
                contentDiv.style.display = isExpanded ? 'none' : 'block';
                e.target.textContent = isExpanded ? '▶' : '▼';
                
                if (!isExpanded && contentDiv.children.length === 0) {
                    renderTreeView(folder.path, contentDiv);
                }
            };

            // Ajout des gestionnaires pour le drag & drop
            folderDiv.ondragover = (e) => {
                e.preventDefault();
                folderDiv.classList.add('drag-over');
            };

            folderDiv.ondragleave = () => {
                folderDiv.classList.remove('drag-over');
            };

            folderDiv.ondrop = (e) => {
                e.preventDefault();
                folderDiv.classList.remove('drag-over');
                const filePath = e.dataTransfer.getData('text/plain');
                const fileName = path.basename(filePath);
                const newPath = path.join(folder.path, fileName);
                
                try {
                    fs.copyFileSync(filePath, newPath);
                    renderFileList(folder.path);
                } catch (error) {
                    alert('Erreur lors du déplacement du fichier');
                }
            };

            parentElement.appendChild(folderDiv);
            parentElement.appendChild(contentDiv);
        });
    }

    function renderFileList(dirPath) {
        fileList.innerHTML = '';
        const items = loadDirectory(dirPath);
        
        items.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = item.type === 'folder' ? 'folder-item' : 'file-item';
            itemDiv.draggable = true;
            itemDiv.innerHTML = `
                <span class="${item.type}-icon">${item.type === 'folder' ? '📁' : '📄'}</span>
                <span class="${item.type}-name">${item.name}</span>
            `;
            
            // Double-clic pour ouvrir
            itemDiv.ondblclick = () => {
                if (item.type === 'folder') {
                    renderFileList(item.path);
                } else {
                    shell.openPath(item.path);
                }
            };

            // Menu contextuel (clic droit)
            itemDiv.oncontextmenu = (e) => {
                e.preventDefault();
                
                // Supprimer tout menu contextuel existant
                const existingMenu = document.querySelector('.context-menu');
                if (existingMenu) {
                    document.body.removeChild(existingMenu);
                }
                
                const contextMenu = document.createElement('div');
                contextMenu.className = 'context-menu';
                contextMenu.style.position = 'fixed';
                contextMenu.style.left = `${e.clientX}px`;
                contextMenu.style.top = `${e.clientY}px`;
                
                const menuItems = [
                    {
                        text: 'Ouvrir',
                        action: () => {
                            if (item.type === 'folder') {
                                renderFileList(item.path);
                            } else {
                                shell.openPath(item.path);
                            }
                            document.body.removeChild(contextMenu);
                        }
                    },
                    {
                        text: 'Renommer',
                        action: () => {
                            const newName = prompt('Nouveau nom :', item.name);
                            if (newName && newName !== item.name) {
                                const newPath = path.join(path.dirname(item.path), newName);
                                try {
                                    fs.renameSync(item.path, newPath);
                                    // Rafraîchir l'arborescence complète
                                    refreshView();
                                    // Rafraîchir la liste des fichiers du dossier courant
                                    renderFileList(dirPath);
                                } catch (error) {
                                    if (error.code === 'EBUSY') {
                                        alert('Veuillez fermer le fichier avant de le renommer');
                                    } else {
                                        alert('Erreur lors du renommage : ' + error.message);
                                    }
                                }
                            }
                            if (contextMenu.parentNode) {
                                document.body.removeChild(contextMenu);
                            }
                        }
                    },
                    {
                        text: 'Supprimer',
                        action: () => {
                            if (confirm(`Êtes-vous sûr de vouloir supprimer "${item.name}" ?`)) {
                                try {
                                    if (item.type === 'folder') {
                                        fs.rmdirSync(item.path, { recursive: true });
                                    } else {
                                        fs.unlinkSync(item.path);
                                    }
                                    renderFileList(dirPath);
                                } catch (error) {
                                    alert('Erreur lors de la suppression');
                                }
                            }
                            document.body.removeChild(contextMenu);
                        }
                    }
                ];

                menuItems.forEach(menuItem => {
                    const button = document.createElement('button');
                    button.textContent = menuItem.text;
                    button.onclick = menuItem.action;
                    contextMenu.appendChild(button);
                });

                document.body.appendChild(contextMenu);

                // Fermer le menu au clic ailleurs
                setTimeout(() => {
                    document.addEventListener('click', function closeMenu(e) {
                        if (!contextMenu.contains(e.target)) {
                            document.body.removeChild(contextMenu);
                            document.removeEventListener('click', closeMenu);
                        }
                    });
                }, 0);
            };
            
            fileList.appendChild(itemDiv);
        });
    }

    function refreshView() {
        treeView.innerHTML = '';
        const mainFolders = [
            {
                name: DOSSIERS_PRINCIPAUX.actifs,
                path: path.join(__dirname, DOSSIERS_PRINCIPAUX.actifs),
                type: 'folder'
            },
            {
                name: DOSSIERS_PRINCIPAUX.archives,
                path: path.join(__dirname, DOSSIERS_PRINCIPAUX.archives),
                type: 'folder'
            }
        ];

        mainFolders.forEach(folder => {
            if (fs.existsSync(folder.path)) {
                const folderDiv = document.createElement('div');
                folderDiv.className = 'folder-item';
                folderDiv.innerHTML = `
                    <span class="folder-toggle">▶</span>
                    <span class="folder-icon">📁</span>
                    <span class="folder-name">${folder.name}</span>
                `;
                
                const contentDiv = document.createElement('div');
                contentDiv.className = 'folder-content';
                contentDiv.style.display = 'none';
                
                folderDiv.querySelector('.folder-toggle').onclick = (e) => {
                    e.stopPropagation();
                    const isExpanded = contentDiv.style.display !== 'none';
                    contentDiv.style.display = isExpanded ? 'none' : 'block';
                    e.target.textContent = isExpanded ? '▶' : '▼';
                    
                    if (!isExpanded && contentDiv.children.length === 0) {
                        renderTreeView(folder.path, contentDiv);
                    }
                };
                
                folderDiv.onclick = () => {
                    renderFileList(folder.path);
                };
                
                treeView.appendChild(folderDiv);
                treeView.appendChild(contentDiv);
            }
        });

        // Supprimer ou commenter cette ligne pour ne pas afficher le contenu au démarrage
        // renderFileList(__dirname);
        
        // À la place, vider la liste de fichiers et afficher un message d'instruction
        fileList.innerHTML = '<div class="file-explorer-instructions">Cliquez sur un dossier pour afficher son contenu</div>';
    }

    // Initialisation
    refreshView();
}

// Fonction pour migrer les dossiers
function migrateDossiers() {
    let clients = fs.existsSync(cheminFichier) ? JSON.parse(fs.readFileSync(cheminFichier)) : [];
    const annee = new Date().getFullYear();
    let counter = 1;
    
    clients.forEach(client => {
        if (!client.numeroDossier) {
            client.numeroDossier = `${annee}-${counter.toString().padStart(3, '0')}`;
            counter++;
        }
    });
    
    fs.writeFileSync(cheminFichier, JSON.stringify(clients, null, 2));
}

// Modifiez l'écouteur DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    // Charge et affiche immédiatement tous les clients
    chargerClients();
    
    // Active la vue "Dossiers en cours" par défaut
    switchView('active');
    
    // Génère immédiatement le calendrier
    generateCalendar('month');
    
    // Créer l'arborescence pour tous les clients existants
    creerArborescencePourClientsExistants();
    
    // Initialise les gestionnaires d'événements
    document.getElementById('recherche').addEventListener('input', filtrerClients);
    document.getElementById('tri').addEventListener('change', appliquerTri);

    // Ajouter la gestion du formulaire
    const toggleFormBtn = document.getElementById('toggleFormBtn');
    const formClient = document.getElementById('formClient');

    toggleFormBtn.addEventListener('click', () => {
        isFormVisible = !isFormVisible;
        formClient.style.display = isFormVisible ? 'block' : 'none';
        toggleFormBtn.textContent = isFormVisible ? 'Masquer le formulaire' : 'Ajouter un nouveau client';
        
        // Si on masque le formulaire, on réinitialise les champs
        if (!isFormVisible) {
            annulerModification();
        }
    });

    // Ajouter des écouteurs pour tous les champs du formulaire
    document.querySelectorAll('#formClient input, #formClient textarea, #formClient select').forEach(element => {
        element.addEventListener('input', () => {
            if (!originalClientData) {
                // Pour un nouveau client, activer le bouton dès qu'il y a une saisie
                document.getElementById('enregistrerBtn').disabled = false;
            } else {
                checkFormChanges();
            }
        });
    });

    // Initialiser l'explorateur de fichiers
    initializeFileExplorer();

    // Appeler la fonction de migration des dossiers
    migrateDossiers();

    // Initialiser les tags
    initializeTags();
    
    // Ajouter le gestionnaire pour le bouton d'ajout de note
    document.querySelector('.add-note button').addEventListener('click', addNote);
    
    // Permettre l'ajout de note avec la touche Entrée
    document.getElementById('newNote').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addNote();
        }
    });
    initializeTags();
    initializeTheme();
    initTypeRoleSelect();
});

// Modifier le gestionnaire du bouton Enregistrer
document.getElementById('enregistrerBtn').onclick = () => {
    ajouterOuModifierClient();
};

// Ajouter après les autres initialisations
document.getElementById('openFinanceBtn').addEventListener('click', () => {
    window.location.href = 'finance.html';
});

document.getElementById('refreshPageBtn').addEventListener('click', () => {
    window.location.reload();
});