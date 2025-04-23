// Variables globales partagées
window.invoices = [];
window.clients = [];
window.revenueChart = null;
window.dossiersChart = null;

// Fonction pour charger les clients
function loadClients() {
    try {
        // Utiliser les variables globales définies par path-manager.js
        const fs = window.fs; // Assurez-vous que window.fs est défini (probablement par path-manager.js)
        const clientsPath = window.clientsPath;

        if (!fs) {
            console.error("ERREUR CRITIQUE: Module 'fs' non disponible sur window.");
            window.clients = [];
            return;
        }
        if (!clientsPath) {
            console.error("ERREUR CRITIQUE: Chemin 'window.clientsPath' non défini.");
            window.clients = [];
            return;
        }

        console.log(`Tentative de chargement des clients depuis: ${clientsPath}`);
        if (fs.existsSync(clientsPath)) {
            const clientsFileContent = fs.readFileSync(clientsPath, 'utf8');
            console.log(`Contenu brut de clients.json (premiers 200 chars): ${clientsFileContent.substring(0, 200)}`);
            if (clientsFileContent.trim() === '') {
                console.warn('Fichier clients.json est vide.');
                window.clients = [];
            } else {
                try {
                    window.clients = JSON.parse(clientsFileContent);
                    console.log(`Clients chargés avec succès. Nombre: ${window.clients.length}`);
                    if (window.clients.length > 0) {
                        console.log('Premier client chargé:', JSON.stringify(window.clients[0]));
                    }
                } catch (parseError) {
                     console.error('ERREUR lors du parsing de clients.json:', parseError);
                     window.clients = [];
                }
            }
        } else {
            console.error(`ERREUR: Fichier clients.json non trouvé à l'emplacement: ${clientsPath}`);
            window.clients = [];
        }
    } catch (error) {
        console.error('ERREUR lors du chargement des clients:', error);
        window.clients = [];
    }

    // Mettre à jour le sélecteur de clients APRÈS le chargement
    if (typeof populateClientSelect === 'function') {
        populateClientSelect();
    } else {
        console.warn('Fonction populateClientSelect non trouvée pour mettre à jour la liste déroulante.');
    }
}

// Chargement des données (simplifié)
function loadData() {
    console.log('--- Début loadData ---');
    try {
        // --- DEBUG: Vérifier les chemins globaux ---
        console.log(`Chemin clients utilisé (depuis window): ${window.clientsPath}`);
        console.log(`Chemin factures utilisé (depuis window): ${window.invoicesPath}`);
        // --- FIN DEBUG ---

        // 1. Charger les clients D'ABORD
        loadClients(); // Appel de la fonction ajoutée/vérifiée ci-dessus

        // 2. Charger les factures ENSUITE
        loadInvoices(); // Utilise la fonction loadInvoices existante

        // 3. Mettre à jour l'interface (liste factures, stats)
        // populateClientSelect est maintenant appelé DANS loadClients
        if (typeof updateInvoicesList === 'function') {
            updateInvoicesList();
        } else {
             console.warn('Fonction updateInvoicesList non trouvée.');
        }

        if (typeof updateFinancialStats === 'function') {
            updateFinancialStats();
        } else {
             console.warn('Fonction updateFinancialStats non trouvée.');
        }

    } catch (error) {
        console.error('Erreur globale lors du chargement des données (loadData):', error);
    }
     console.log('--- Fin loadData ---');
}

// Assurez-vous qu'il n'y a qu'UN SEUL bloc comme celui-ci
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM chargé - Initialisation...');

    // S'assurer que les tableaux sont initialisés (peut rester)
    window.invoices = window.invoices || [];
    window.clients = window.clients || [];
    if (!Array.isArray(window.invoices)) window.invoices = [];
    if (!Array.isArray(window.clients)) window.clients = [];

    // Charger les données (clients PUIS factures)
    loadData(); // Appel unique et centralisé

    // Initialiser le tri de table (si applicable à cette page)
    if (typeof initSortableTable === 'function') {
        initSortableTable();
    }

    // Attacher l'écouteur au formulaire de facture
    const invoiceForm = document.getElementById('invoiceForm');
    if (invoiceForm) {
        invoiceForm.addEventListener('submit', handleInvoiceSubmission);
        console.log('Listener ajouté au formulaire de facture.');
    } else {
        console.error('Formulaire de facture #invoiceForm non trouvé!');
    }

     // Attacher l'écouteur au bouton "Créer facture" avec vérification
    const openModalButton = document.getElementById('openInvoiceModalBtn'); // Mettez le bon ID
    if (openModalButton) {
        openModalButton.addEventListener('click', () => {
            console.log(`Clic sur "Créer facture". Nombre de clients chargés: ${window.clients?.length}`);
            if (!window.clients || window.clients.length === 0) {
                alert('Vous devez avoir au moins un client pour créer une facture. Veuillez ajouter un client dans la section Client.');
            } else {
                // Assurez-vous que populateClientSelect a bien été appelé avant (normalement fait dans loadClients)
                if (typeof openInvoiceModal === 'function') {
                    openInvoiceModal();
                } else {
                    console.error('Fonction openInvoiceModal non trouvée!');
                }
            }
        });
         console.log('Listener ajouté au bouton "Créer facture".');
    } else {
        console.warn('Bouton pour ouvrir la modale de facture non trouvé.');
    }

    // Initialisation des graphiques (peut rester dans son setTimeout)
    setTimeout(function() {
        console.log('Initialisation différée des graphiques...');
        if (typeof updateCharts === 'function') {
            try {
                updateCharts();
                console.log('Graphiques initialisés avec succès');
            } catch (error) {
                console.error('Erreur lors de l\'initialisation des graphiques:', error);
            }
        } else {
            console.error('Fonction updateCharts non disponible pour initialisation différée.');
        }
    }, 1000);

    // Ajouter les autres listeners (retour accueil, thème...)
    const backToHomeBtn = document.getElementById('backToHomeBtn');
    if (backToHomeBtn) {
        backToHomeBtn.addEventListener('click', function() {
            window.location.href = 'index.html';
        });
    }
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', function() {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
            
            // Mettre à jour l'icône et le texte
            const themeIcon = document.getElementById('themeIcon');
            const themeText = document.getElementById('themeText');
            if (newTheme === 'dark') {
                themeIcon.textContent = '🌙';
                themeText.textContent = 'Mode clair';
            } else {
                themeIcon.textContent = '🌞';
                themeText.textContent = 'Mode sombre';
            }
        });
    }

    console.log('Initialisation DOMContentLoaded terminée.');
});

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