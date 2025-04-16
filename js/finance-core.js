// Variables globales partagées
window.invoices = [];
window.clients = [];
window.revenueChart = null;
window.dossiersChart = null;

// S'assurer que les structures sont bien initialisées au chargement
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initialisation de finance-core.js');
    
    // S'assurer que les tableaux sont initialisés
    window.invoices = window.invoices || [];
    window.clients = window.clients || [];
    
    // Forcer un type tableau
    if (!Array.isArray(window.invoices)) window.invoices = [];
    if (!Array.isArray(window.clients)) window.clients = [];
    
    // Chargement des données
    loadData();
});

// Chemins des fichiers
const invoicesPath = path.join(__dirname, 'invoices.json');
const clientsPath = path.join(__dirname, 'clients.json');

// Fonction d'initialisation principale
function initializeApp() {
    console.log('=== INITIALISATION DE L\'APPLICATION ===');
    
    // 1. Charger les données AVANT toute autre initialisation
    loadInitialData();
    
    // 2. Configurer l'interface
    setupEventListeners();
    
    // 3. Mettre à jour tous les éléments visuels
    refreshAllUI();
    
    console.log('Initialisation terminée');
}

// Fonction de chargement initial des données
function loadInitialData() {
    console.log('Chargement des données initiales...');
    
    // D'abord les clients
    loadClients();
    console.log(`${window.clients ? window.clients.length : 0} clients chargés`);
    
    // Puis les factures avec diagnostic
    loadInvoicesWithDiagnostic();
    console.log(`${window.invoices ? window.invoices.length : 0} factures chargées`);
}

// Fonction plus robuste pour charger les factures
function loadInvoicesWithDiagnostic() {
    console.log('Chargement des factures avec diagnostic...');
    
    try {
        // 1. Vérifier que le système de fichiers est disponible
        const fs = require('fs');
        const invoicesPath = window.invoicesPath;
        
        console.log('Chemin du fichier des factures:', invoicesPath);
        
        // 2. Vérifier que le fichier existe
        if (!fs.existsSync(invoicesPath)) {
            console.warn('Fichier de factures non trouvé, création d\'un nouveau fichier');
            fs.writeFileSync(invoicesPath, '[]', 'utf8');
            window.invoices = [];
            return;
        }
        
        // 3. Lire le contenu du fichier
        const content = fs.readFileSync(invoicesPath, 'utf8');
        console.log(`Contenu lu: ${content.length} caractères`);
        
        // 4. Analyser le contenu
        if (!content || content.trim() === '' || content.trim() === '[]') {
            console.log('Fichier vide ou contenant un tableau vide');
            window.invoices = [];
            return;
        }
        
        // 5. Parser le JSON avec gestion d'erreurs détaillée
        try {
            // Parser le JSON
            const parsed = JSON.parse(content);
            
            // Vérifier que c'est un tableau
            if (!Array.isArray(parsed)) {
                throw new Error('Le contenu n\'est pas un tableau JSON valide');
            }
            
            // Assigner les données
            window.invoices = parsed;
            
            // Afficher un résumé
            console.log(`Chargement réussi: ${window.invoices.length} factures`);
            if (window.invoices.length > 0) {
                console.log('Première facture:', window.invoices[0].number);
            }
        } catch (parseError) {
            console.error('Erreur lors du parsing JSON:', parseError);
            window.invoices = [];
            
            // Créer une copie de sauvegarde du fichier corrompu
            fs.copyFileSync(invoicesPath, invoicesPath + '.backup');
            console.log('Sauvegarde du fichier corrompu créée');
        }
    } catch (error) {
        console.error('Erreur critique lors du chargement des factures:', error);
        window.invoices = [];
    }
    
    // 6. Mettre à jour l'interface quoi qu'il arrive
    refreshInvoicesUI();
}

// Fonction pour rafraîchir toute l'interface
function refreshAllUI() {
    console.log('Rafraîchissement de l\'interface...');
    
    // Mettre à jour la liste des factures
    if (typeof updateInvoicesList === 'function') {
        updateInvoicesList();
    }
    
    // Mettre à jour les statistiques financières
    if (typeof updateFinancialStats === 'function') {
        updateFinancialStats();
    }
    
    // Mettre à jour les graphiques
    if (typeof updateCharts === 'function') {
        updateCharts();
    }
}

// Fonction spécifique pour rafraîchir l'interface des factures
function refreshInvoicesUI() {
    if (typeof updateInvoicesList === 'function') {
        updateInvoicesList();
    }
}

// Remplacer votre gestionnaire DOMContentLoaded actuel par ceci
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM chargé - Démarrage de l\'application');
    
    // Initialiser l'application
    initializeApp();
});

// Chargement des données
function loadData() {
    try {
        console.log('Chargement des données...');
        
        // Chargement des clients
        if (typeof loadClients === 'function') {
            loadClients();
        } else {
            console.error('Fonction loadClients non disponible');
        }
        
        // Chargement des factures
        loadInvoices();
        
        // Mise à jour de l'interface
        if (typeof updateInvoicesList === 'function') {
            updateInvoicesList();
        }
        
        if (typeof updateFinancialStats === 'function') {
            updateFinancialStats();
        }
    } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
    }
}

// Chargement des factures
function loadInvoices() {
    try {
        const fs = window.fs;
        const invoicesPath = window.invoicesPath;
        
        if (!fs) {
            console.error('Module fs non disponible');
            return;
        }
        
        if (!invoicesPath) {
            console.error('Chemin invoicesPath non défini');
            return;
        }
        
        console.log('Tentative de chargement des factures depuis:', invoicesPath);
        
        if (fs.existsSync(invoicesPath)) {
            const invoicesData = fs.readFileSync(invoicesPath, 'utf8');
            console.log('Données lues, taille:', invoicesData ? invoicesData.length : 0);
            
            try {
                window.invoices = JSON.parse(invoicesData || '[]');
                console.log(`${window.invoices.length} factures chargées`);
                
                // Vérification rapide
                if (window.invoices.length > 0) {
                    console.log('Première facture:', window.invoices[0].number);
                }
            } catch (parseError) {
                console.error('Erreur de parsing JSON:', parseError);
                window.invoices = [];
            }
        } else {
            console.warn('Fichier invoices.json non trouvé, création...');
            window.invoices = [];
            fs.writeFileSync(invoicesPath, '[]');
        }
    } catch (error) {
        console.error('Erreur lors du chargement des factures:', error);
        window.invoices = [];
    }
}

// Exposer les fonctions globalement
window.loadInvoices = loadInvoices;
window.loadData = loadData;
window.initializeApp = initializeApp;
window.refreshAllUI = refreshAllUI;