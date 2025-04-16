// Gestionnaire de chemins et stockage avec solution de secours

// Initialisation
console.log('Initialisation du gestionnaire de chemins et stockage...');

// Système de stockage hybride - Utilise le système de fichiers si disponible,
// sinon utilise localStorage comme solution de secours
const StorageSystem = {
    // Stockage principal
    fs: null,
    path: null,
    dataFolder: null,
    
    // Chemins des fichiers
    invoicesPath: null,
    clientsPath: null,
    
    // État du système
    initialized: false,
    usingLocalStorage: false,
    
    // Initialiser le système de stockage
    init: function() {
        console.log('Initialisation du système de stockage...');
        
        try {
            // Tenter d'utiliser le système de fichiers
            if (window.require) {
                this.fs = require('fs');
                this.path = require('path');
                
                // Essayer plusieurs emplacements pour trouver un endroit accessible en écriture
                const locations = this.getPossibleStorageLocations();
                
                for (const location of locations) {
                    if (this.testWriteAccess(location)) {
                        this.dataFolder = location;
                        console.log('Dossier de données accessible en écriture trouvé:', location);
                        break;
                    }
                }
                
                if (!this.dataFolder) {
                    throw new Error('Aucun dossier accessible en écriture trouvé');
                }
                
                // Définir les chemins des fichiers
                this.invoicesPath = this.path.join(this.dataFolder, 'invoices.json');
                this.clientsPath = this.path.join(this.dataFolder, 'clients.json');
                
                // Exposer les chemins globalement pour la compatibilité
                window.invoicesPath = this.invoicesPath;
                window.clientsPath = this.clientsPath;
                
                this.initialized = true;
                console.log('Système de fichiers initialisé avec succès');
                console.log('- invoices.json:', this.invoicesPath);
                console.log('- clients.json:', this.clientsPath);
                
                this.ensureFilesExist();
                return true;
            } else {
                throw new Error('Module require non disponible');
            }
        } catch (error) {
            console.warn('Impossible d\'utiliser le système de fichiers:', error.message);
            console.log('Utilisation du localStorage comme solution de secours');
            
            // Utiliser localStorage comme solution de secours
            this.usingLocalStorage = true;
            this.initialized = true;
            return true;
        }
    },
    
    // Obtenir tous les emplacements possibles pour le stockage
    getPossibleStorageLocations: function() {
        try {
            const locations = [];
            
            // 1. Répertoire actuel
            locations.push(__dirname);
            
            // 2. Répertoire parent
            locations.push(this.path.resolve(__dirname, '..'));
            
            // 3. Répertoire utilisateur
            try {
                const os = require('os');
                const userDataDir = this.path.join(os.homedir(), 'AvocatTool');
                
                // Créer le répertoire s'il n'existe pas
                if (!this.fs.existsSync(userDataDir)) {
                    this.fs.mkdirSync(userDataDir, { recursive: true });
                }
                
                locations.push(userDataDir);
            } catch (e) {
                console.warn('Impossible d\'utiliser le répertoire utilisateur:', e.message);
            }
            
            // 4. Répertoire temporaire
            try {
                const os = require('os');
                locations.push(os.tmpdir());
            } catch (e) {
                console.warn('Impossible d\'utiliser le répertoire temporaire:', e.message);
            }
            
            // 5. Via l'API Electron si disponible
            try {
                const remote = require('@electron/remote');
                if (remote && remote.app) {
                    locations.push(remote.app.getPath('userData'));
                }
            } catch (e) {
                console.warn('API Electron remote non disponible:', e.message);
            }
            
            console.log('Emplacements potentiels pour le stockage:', locations);
            return locations;
        } catch (error) {
            console.error('Erreur lors de la recherche d\'emplacements de stockage:', error);
            return [__dirname];
        }
    },
    
    // Tester si un emplacement est accessible en écriture
    testWriteAccess: function(location) {
        try {
            const testFile = this.path.join(location, '.write-test');
            this.fs.writeFileSync(testFile, 'test');
            this.fs.unlinkSync(testFile);
            return true;
        } catch (error) {
            console.warn(`Emplacement ${location} non accessible en écriture:`, error.message);
            return false;
        }
    },
    
    // S'assurer que les fichiers de données existent
    ensureFilesExist: function() {
        if (!this.initialized || this.usingLocalStorage) return;
        
        try {
            if (!this.fs.existsSync(this.invoicesPath)) {
                this.fs.writeFileSync(this.invoicesPath, '[]', 'utf8');
                console.log('Fichier invoices.json créé');
            }
            
            if (!this.fs.existsSync(this.clientsPath)) {
                this.fs.writeFileSync(this.clientsPath, '[]', 'utf8');
                console.log('Fichier clients.json créé');
            }
        } catch (error) {
            console.error('Erreur lors de la création des fichiers:', error);
        }
    },
    
    // Sauvegarder des données
    saveData: function(key, data) {
        console.log(`Sauvegarde des données '${key}'...`);
        
        if (!this.initialized) {
            console.error('Système de stockage non initialisé');
            return false;
        }
        
        const jsonData = JSON.stringify(data, null, 2);
        
        try {
            if (this.usingLocalStorage) {
                console.log(`Sauvegarde dans localStorage: ${key}, taille: ${jsonData.length}`);
                localStorage.setItem(key, jsonData);
                return true;
            } else {
                // Déterminer le chemin du fichier
                let filePath;
                if (key === 'invoices') {
                    filePath = this.invoicesPath;
                } else if (key === 'clients') {
                    filePath = this.clientsPath;
                } else {
                    filePath = this.path.join(this.dataFolder, `${key}.json`);
                }
                
                console.log(`Sauvegarde dans fichier: ${filePath}, taille: ${jsonData.length}`);
                
                // Utiliser une approche sécurisée avec fichier temporaire
                const tempPath = `${filePath}.tmp`;
                this.fs.writeFileSync(tempPath, jsonData, 'utf8');
                
                if (this.fs.existsSync(filePath)) {
                    this.fs.unlinkSync(filePath);
                }
                
                this.fs.renameSync(tempPath, filePath);
                
                // Vérifier que les données ont bien été écrites
                const verifyData = this.fs.readFileSync(filePath, 'utf8');
                if (verifyData === jsonData) {
                    console.log(`Sauvegarde réussie pour ${key}`);
                    return true;
                } else {
                    console.error(`Vérification de sauvegarde échouée pour ${key}`);
                    return false;
                }
            }
        } catch (error) {
            console.error(`Erreur lors de la sauvegarde des données '${key}':`, error);
            
            // Tentative de récupération en dernier recours avec localStorage
            if (!this.usingLocalStorage) {
                try {
                    console.log(`Tentative de récupération avec localStorage pour '${key}'`);
                    localStorage.setItem(key, jsonData);
                    this.usingLocalStorage = true;
                    return true;
                } catch (localStorageError) {
                    console.error('Échec également avec localStorage:', localStorageError);
                }
            }
            
            return false;
        }
    },
    
    // Charger des données
    loadData: function(key) {
        console.log(`Chargement des données '${key}'...`);
        
        if (!this.initialized) {
            console.error('Système de stockage non initialisé');
            return null;
        }
        
        try {
            // D'abord, essayer le localStorage dans tous les cas (pour la récupération)
            const localData = localStorage.getItem(key);
            
            if (this.usingLocalStorage) {
                if (localData) {
                    console.log(`Données '${key}' chargées depuis localStorage`);
                    return JSON.parse(localData);
                }
                return [];
            }
            
            // Déterminer le chemin du fichier
            let filePath;
            if (key === 'invoices') {
                filePath = this.invoicesPath;
            } else if (key === 'clients') {
                filePath = this.clientsPath;
            } else {
                filePath = this.path.join(this.dataFolder, `${key}.json`);
            }
            
            if (!this.fs.existsSync(filePath)) {
                console.log(`Fichier '${filePath}' non trouvé`);
                
                // Si des données existent dans localStorage, les utiliser
                if (localData) {
                    console.log(`Utilisation des données de localStorage pour '${key}'`);
                    return JSON.parse(localData);
                }
                
                return [];
            }
            
            const fileData = this.fs.readFileSync(filePath, 'utf8');
            
            if (!fileData || fileData.trim() === '' || fileData.trim() === '[]') {
                console.log(`Fichier '${filePath}' vide`);
                
                // Si des données existent dans localStorage, les utiliser
                if (localData) {
                    console.log(`Utilisation des données de localStorage pour '${key}'`);
                    return JSON.parse(localData);
                }
                
                return [];
            }
            
            const parsedData = JSON.parse(fileData);
            console.log(`Données '${key}' chargées depuis fichier`);
            
            // Sauvegarder également dans localStorage pour la récupération
            try {
                localStorage.setItem(key, fileData);
            } catch (e) {
                console.warn('Impossible de sauvegarder dans localStorage:', e.message);
            }
            
            return parsedData;
        } catch (error) {
            console.error(`Erreur lors du chargement des données '${key}':`, error);
            
            // Tentative de récupération avec localStorage
            try {
                const localData = localStorage.getItem(key);
                if (localData) {
                    console.log(`Récupération avec localStorage pour '${key}'`);
                    return JSON.parse(localData);
                }
            } catch (localStorageError) {
                console.error('Échec également avec localStorage:', localStorageError);
            }
            
            return [];
        }
    }
};

// Initialiser le système de stockage
StorageSystem.init();

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