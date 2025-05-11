// Gestionnaire de chemins et stockage avec solution de secours

// Initialisation
console.log('Initialisation du gestionnaire de chemins et stockage...');
console.log('Chargement de path-manager.js...');

// --- MODIFICATION POUR IPCRENDERER ---
let ipcRenderer = null; // Déclarer ipcRenderer ici pour une portée plus large
// --- FIN MODIFICATION ---

// --- VÉRIFIER/AJOUTER CES LIGNES ---
if (!window.fs) {
    const fs = require('fs');
    const path = require('path');
    const electron = require('electron'); // Charger electron ici aussi

    window.fs = fs; // Rendre fs accessible globalement
    window.path = path; // Rendre path accessible globalement
    
    ipcRenderer = electron.ipcRenderer; // Assigner ipcRenderer
    window.ipcRenderer = ipcRenderer; // Rendre ipcRenderer accessible globalement

    console.log('Modules fs, path et ipcRenderer initialisés.');
} else {
    console.log('Modules fs, path et ipcRenderer déjà initialisés (ou fs/path seulement).');
    // S'assurer que ipcRenderer est aussi initialisé si fs l'était déjà
    if (!window.ipcRenderer && typeof require === 'function') {
        try {
            const electron = require('electron');
            ipcRenderer = electron.ipcRenderer;
            window.ipcRenderer = ipcRenderer;
            console.log('ipcRenderer ré-initialisé car manquant sur window.');
        } catch (e) {
            console.error("Erreur lors de la tentative de ré-initialisation de ipcRenderer:", e);
        }
    } else if (window.ipcRenderer) {
        ipcRenderer = window.ipcRenderer; // Récupérer la référence existante
    }
}
// --- FIN VÉRIFICATION/AJOUT ---


// AJOUTEZ CECI: Variables pour stocker les chemins de main.js
let appPathGlobal = null;
let userDataPathGlobal = null;

// AJOUTEZ CECI: Fonction pour initialiser les chemins APRÈS les avoir reçus
function initializePathsAndStorageSystem() {
    if (appPathGlobal && userDataPathGlobal) {
        // Définir les chemins pour les dossiers "Dossiers en cours" et "Dossiers archivés"
        // Ils sont à la racine de l'application (appPathGlobal)
        window.dossiersEnCoursPath = path.join(appPathGlobal, 'Dossiers en cours');
        window.dossiersArchivesPath = path.join(appPathGlobal, 'Dossiers archivés');
        console.log('path-manager.js: Chemin "Dossiers en cours" défini:', window.dossiersEnCoursPath);
        console.log('path-manager.js: Chemin "Dossiers archivés" défini:', window.dossiersArchivesPath);

        // Optionnel: s'assurer que ces dossiers existent
        try {
            if (fs && !fs.existsSync(window.dossiersEnCoursPath)) {
                fs.mkdirSync(window.dossiersEnCoursPath, { recursive: true });
            }
            if (fs && !fs.existsSync(window.dossiersArchivesPath)) {
                fs.mkdirSync(window.dossiersArchivesPath, { recursive: true });
            }
        } catch (dirError) {
            console.error('path-manager.js: Erreur création dossiers racine:', dirError);
        }

        // Initialiser StorageSystem pour les fichiers JSON en utilisant userDataPathGlobal
        if (!StorageSystem.initialized) {
            const initSuccess = StorageSystem.init(userDataPathGlobal); // Passer userDataPath ici
            if (initSuccess) {
                console.log('path-manager.js: StorageSystem initialisé avec succès via userDataPath.');

                const pathsForBackup = {
                    clients: window.clientsPath,
                    invoices: window.invoicesPath,
                    tasks: window.tasksPath,
                    dossiersEnCours: window.dossiersEnCoursPath,
                    dossiersArchives: window.dossiersArchivesPath
                };
                const validPaths = Object.fromEntries(Object.entries(pathsForBackup).filter(([, value]) => value));

                if (ipcRenderer && Object.keys(validPaths).length > 0) {
                    ipcRenderer.send('renderer-ready-for-autobackup', validPaths);
                    console.log('path-manager.js: "renderer-ready-for-autobackup" envoyé avec:', validPaths);
                }
            } else {
                console.error('path-manager.js: Échec de l\'initialisation de StorageSystem avec userDataPath.');
            }
        }
    } else {
        console.error('path-manager.js: appPathGlobal ou userDataPathGlobal non définis avant initializePathsAndStorageSystem.');
    }
}

// AJOUTEZ CECI: Écouteur pour les chemins envoyés par main.js
if (ipcRenderer) {
    ipcRenderer.on('app-paths', (event, paths) => {
        console.log('path-manager.js: Chemins reçus de main.js:', paths);
        if (paths && paths.appPath && paths.userDataPath) {
            appPathGlobal = paths.appPath;
            userDataPathGlobal = paths.userDataPath;
            // Maintenant que nous avons les chemins, initialisons le reste
            initializePathsAndStorageSystem();
        } else {
            console.error('path-manager.js: appPath ou userDataPath manquants dans le message de main.js.');
        }
    });
} else {
    console.error('path-manager.js: ipcRenderer non disponible pour écouter "app-paths".');
}







// Système de stockage hybride - Utilise le système de fichiers si disponible,
// sinon utilise localStorage comme solution de secours

const StorageSystem = {
    fs: null,
    path: null,
    dataFolder: null,   // Sera userDataPathGlobal (pour les fichiers JSON)
    
    invoicesPath: null,
    clientsPath: null,
    tasksPath: null,
    
    initialized: false,

    init: function(basePathForJsons) {
        console.log('StorageSystem.init() appelé avec basePathForJsons:', basePathForJsons);
        
        this.fs = window.fs;
        this.path = window.path;

        if (!this.fs || !this.path) {
            console.error('StorageSystem: fs ou path non disponibles sur window.');
            this.initialized = false;
            return false;
        }
        if (!basePathForJsons || typeof basePathForJsons !== 'string') {
            console.error('StorageSystem: basePathForJsons (attendu comme userDataPath) est invalide.');
            this.initialized = false;
            return false;
        }

        this.dataFolder = basePathForJsons; // C'est ici que les JSONs seront stockés

        try {
            if (!this.fs.existsSync(this.dataFolder)) {
                this.fs.mkdirSync(this.dataFolder, { recursive: true });
                console.log('StorageSystem: Dossier de données JSON créé:', this.dataFolder);
            }
        } catch (e) {
            console.error("StorageSystem: Erreur création dossier de données JSON:", e);
            this.initialized = false;
            return false;
        }

        this.clientsPath = this.path.join(this.dataFolder, 'clients.json');
        this.invoicesPath = this.path.join(this.dataFolder, 'invoices.json');
        this.tasksPath = this.path.join(this.dataFolder, 'taches.json'); // Assurez-vous que le nom du fichier est correct

        window.clientsPath = this.clientsPath;
        window.invoicesPath = this.invoicesPath;
        window.tasksPath = this.tasksPath;

        console.log('StorageSystem: Chemins des fichiers JSON définis:');
        console.log('  - Clients:', window.clientsPath);
        console.log('  - Invoices:', window.invoicesPath);
        console.log('  - Tasks:', window.tasksPath);

        this.ensureFilesExist(); // S'assurer que les fichiers JSON vides existent
        
        this.initialized = true;
        console.log('StorageSystem initialisé avec succès pour les fichiers JSON.');
        return true;
    },
    
    ensureFilesExist: function() {
        if (!this.fs || !this.clientsPath || !this.invoicesPath || !this.tasksPath) {
            console.warn('StorageSystem.ensureFilesExist: fs ou chemins JSON non définis. Impossible de vérifier/créer les fichiers.');
            return;
        }
        try {
            if (!this.fs.existsSync(this.clientsPath)) {
                this.fs.writeFileSync(this.clientsPath, '[]', 'utf8');
                console.log('StorageSystem.ensureFilesExist: Fichier clients.json créé à:', this.clientsPath);
            } else {
                // console.log('StorageSystem.ensureFilesExist: Fichier clients.json existe déjà à:', this.clientsPath);
            }

            if (!this.fs.existsSync(this.invoicesPath)) {
                this.fs.writeFileSync(this.invoicesPath, '[]', 'utf8');
                console.log('StorageSystem.ensureFilesExist: Fichier invoices.json créé à:', this.invoicesPath);
            } else {
                // console.log('StorageSystem.ensureFilesExist: Fichier invoices.json existe déjà à:', this.invoicesPath);
            }

            if (!this.fs.existsSync(this.tasksPath)) {
                this.fs.writeFileSync(this.tasksPath, '[]', 'utf8');
                console.log('StorageSystem.ensureFilesExist: Fichier taches.json créé à:', this.tasksPath);
            } else {
                // console.log('StorageSystem.ensureFilesExist: Fichier taches.json existe déjà à:', this.tasksPath);
            }
        } catch (e) {
            console.error('StorageSystem.ensureFilesExist: Erreur lors de la vérification/création des fichiers JSON:', e);
        }
    },
    
    saveData: function(key, data) {
        if (!this.initialized || !this.fs) {
            console.error(`StorageSystem.saveData: Non initialisé ou fs manquant pour la clé '${key}'.`);
            return false;
        }
        const jsonData = JSON.stringify(data, null, 2);
        let filePath;
        if (key === 'clients') filePath = this.clientsPath;
        else if (key === 'invoices') filePath = this.invoicesPath;
        else if (key === 'tasks') filePath = this.tasksPath;
        else {
            console.error(`StorageSystem.saveData: Clé de sauvegarde inconnue: ${key}`);
            return false;
        }

        try {
            const tempPath = `${filePath}.tmp`;
            this.fs.writeFileSync(tempPath, jsonData, 'utf8');
            if (this.fs.existsSync(filePath)) {
                this.fs.unlinkSync(filePath);
            }
            this.fs.renameSync(tempPath, filePath);
            console.log(`StorageSystem.saveData: Données pour '${key}' sauvegardées dans ${filePath}`);
            return true;
        } catch (e) {
            console.error(`StorageSystem.saveData: Erreur sauvegarde '${key}' vers ${filePath}:`, e);
            return false;
        }
    },
    
    loadData: function(key) {
        if (!this.initialized || !this.fs) {
            console.error(`StorageSystem.loadData: Non initialisé ou fs manquant pour la clé '${key}'.`);
            return [];
        }
        let filePath;
        if (key === 'clients') filePath = this.clientsPath;
        else if (key === 'invoices') filePath = this.invoicesPath;
        else if (key === 'tasks') filePath = this.tasksPath;
        else {
            console.error(`StorageSystem.loadData: Clé de chargement inconnue: ${key}`);
            return [];
        }

        try {
            if (this.fs.existsSync(filePath)) {
                const fileData = this.fs.readFileSync(filePath, 'utf8');
                if (!fileData || fileData.trim() === '') {
                    console.warn(`StorageSystem.loadData: Fichier pour '${key}' (${filePath}) est vide.`);
                    return [];
                }
                const parsedData = JSON.parse(fileData);
                // console.log(`StorageSystem.loadData: Données pour '${key}' chargées depuis ${filePath}`);
                return parsedData;
            } else {
                console.warn(`StorageSystem.loadData: Fichier pour '${key}' (${filePath}) non trouvé.`);
                // Tenter de charger depuis localStorage comme fallback si le fichier n'existe pas
                const localData = localStorage.getItem(key);
                if (localData) {
                    console.log(`StorageSystem.loadData: Données pour '${key}' chargées depuis localStorage (fallback).`);
                    try { return JSON.parse(localData); } catch (e) { return []; }
                }
                return [];
            }
        } catch (e) {
            console.error(`StorageSystem.loadData: Erreur chargement '${key}' depuis ${filePath}:`, e);
            // Tenter de charger depuis localStorage en cas d'erreur de lecture/parsing du fichier
            const localData = localStorage.getItem(key);
            if (localData) {
                console.log(`StorageSystem.loadData: Données pour '${key}' chargées depuis localStorage (fallback après erreur).`);
                try { return JSON.parse(localData); } catch (e) { return []; }
            }
            return [];
        }
    }
};

// Fonctions globales pour la compatibilité
window.saveInvoicesToFile = function() {
    return StorageSystem.saveData('invoices', window.invoices);
};

window.loadInvoices = function() {
    window.invoices = StorageSystem.loadData('invoices') || [];
    console.log(`${window.invoices.length} factures chargées`);
    return window.invoices;
};

window.saveClientsToFile = function() {
    return StorageSystem.saveData('clients', window.clients);
};

window.loadClients = function() {
    window.clients = StorageSystem.loadData('clients') || [];
    console.log(`${window.clients.length} clients chargés`);
    return window.clients;
};

// Fonction pour tester le système
window.testStorage = function() {
    console.log('=== TEST DU SYSTÈME DE STOCKAGE ===');
    
    // Créer des données de test
    const testInvoice = { number: 'TEST-' + Date.now(), date: new Date().toISOString() };
    
    // Sauvegarder
    window.invoices = [testInvoice];
    const saveSuccess = window.saveInvoicesToFile();
    
    if (!saveSuccess) {
        alert('ÉCHEC: Sauvegarde impossible!');
        return;
    }
    
    // Effacer la mémoire et recharger
    window.invoices = [];
    window.loadInvoices();
    
    // Vérifier
    const found = window.invoices.find(i => i.number === testInvoice.number);
    
    if (found) {
        alert('SUCCÈS: Le système de stockage fonctionne correctement!');
        
        // Nettoyer
        window.invoices = window.invoices.filter(i => !i.number.startsWith('TEST-'));
        window.saveInvoicesToFile();
    } else {
        alert('ÉCHEC: Les données n\'ont pas été correctement rechargées!');
    }
};