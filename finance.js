// Constantes et variables globales
const TVA_RATE = 0.20;
let invoices = [];
let clients = [];

const CABINET_INFO = {
    nom: "Maître Candice ROVERA",
    titre: "Avocat au Barreau de Paris",
    adresse: "[Adresse du cabinet]",
    telephone: "[Numéro de téléphone]",
    email: "[Email professionnel]",
    siret: "98302483700020",
    tva: "FR13983024837"
};

const fs = require('fs');
const path = require('path');
const { shell } = require('electron');

// Ajouter ces variables globales au début du fichier
let draggedColumn = null;
let originalIndex = null;

// Variables globales pour stocker les instances de graphiques
let revenueChart = null;
let dossiersChart = null;

// Ajouter après les constantes globales
function getClientName(clientId) {
    try {
        const client = clients.find(c => c.numeroDossier === clientId);
        if (!client) {
            console.warn(`Client non trouvé pour l'ID: ${clientId}`);
            return 'Client inconnu';
        }
        return `${client.nom} ${client.prenom || ''}`.trim();
    } catch (error) {
        console.error('Erreur dans getClientName:', error);
        return 'Erreur';
    }
}

// Fonctions utilitaires de formatage
function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).format(date);
    } catch (error) {
        console.error('Erreur de formatage de date:', error);
        return 'Date invalide';
    }
}

function formatMoney(amount) {
    try {
        return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'EUR'
        }).format(amount);
    } catch (error) {
        console.error('Erreur de formatage monétaire:', error);
        return '0,00 €';
    }
}

function generateRevenueData() {
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    const currentYear = new Date().getFullYear();
    
    // Initialiser les données à 0 pour chaque mois
    const monthlyData = new Array(12).fill(0);

    // Calculer le total par mois
    invoices.forEach(invoice => {
        const invoiceDate = new Date(invoice.date);
        if (invoiceDate.getFullYear() === currentYear) {
            monthlyData[invoiceDate.getMonth()] += invoice.totalHT;
        }
    });

    return {
        labels: months,
        datasets: [{
            label: 'Chiffre d\'affaires mensuel (HT)',
            data: monthlyData,
            borderColor: '#3498db',
            backgroundColor: 'rgba(52, 152, 219, 0.1)',
            tension: 0.4
        }]
    };
}

function generateDossiersData() {
    // Compter le nombre de dossiers par type
    const typesCount = {};
    clients.forEach(client => {
        if (!client.archived) {
            typesCount[client.type] = (typesCount[client.type] || 0) + 1;
        }
    });

    // Préparer les données pour le graphique
    const types = Object.keys(typesCount);
    const counts = Object.values(typesCount);
    const colors = [
        '#3498db', '#e74c3c', '#2ecc71', '#f1c40f', 
        '#9b59b6', '#1abc9c', '#e67e22', '#34495e'
    ];

    return {
        labels: types,
        datasets: [{
            data: counts,
            backgroundColor: colors.slice(0, types.length),
            borderWidth: 1
        }]
    };
}

// Variables pour le tri des colonnes
let currentSort = {
    column: null,
    direction: 'asc'
};

function initializeSortableColumns() {
    const headers = document.querySelectorAll('#invoicesTable th');
    headers.forEach((header, index) => {
        header.addEventListener('click', () => {
            const column = getColumnKey(index);
            if (column) {
                sortTable(column, header);
            }
        });
    });
}

function getColumnKey(index) {
    const columns = {
        0: 'number',
        1: 'client',
        2: 'date',
        3: 'description',
        4: 'totalHT',
        5: 'totalTTC',
        6: 'status',
        7: 'actions'
    };
    return columns[index];
}

function sortTable(column, header) {
    // Mettre à jour les indicateurs visuels
    document.querySelectorAll('#invoicesTable th').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
    });

    // Inverser la direction si on clique sur la même colonne
    if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.column = column;
        currentSort.direction = 'asc';
    }

    // Ajouter la classe de tri appropriée
    header.classList.add(`sort-${currentSort.direction}`);

    // Trier les factures
    invoices.sort((a, b) => {
        let valueA = getComparisonValue(a, column);
        let valueB = getComparisonValue(b, column);
        
        const direction = currentSort.direction === 'asc' ? 1 : -1;
        
        if (valueA < valueB) return -1 * direction;
        if (valueA > valueB) return 1 * direction;
        return 0;
    });

    // Mettre à jour l'affichage
    updateInvoicesList();
}

function getComparisonValue(invoice, column) {
    switch (column) {
        case 'number':
            return invoice.number;
        case 'client':
            return `${invoice.client.nom} ${invoice.client.prenom}`.toLowerCase();
        case 'date':
            return new Date(invoice.date);
        case 'totalHT':
            return invoice.totalHT;
        case 'tva':
            return invoice.tva;
        case 'totalTTC':
            return invoice.totalTTC;
        default:
            return '';
    }
}

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    // Disable scroll events completely
    document.body.addEventListener('scroll', (e) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }, { passive: false });

    // Prevent scroll restoration
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }

    // Initialize charts with fixed dimensions
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: true,
        animation: false,
        layout: {
            padding: 0
        },
        plugins: {
            legend: {
                display: false
            }
        }
    };

    // Initialize components
    initializeCharts(chartOptions);
    loadData();
    setupEventListeners();
    initializeTheme();
    populateClientSelect();
    initializeSortableColumns();
    initializeDraggableColumns();
    updateFinancialStats();
});

function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeButton(savedTheme);
}

function updateThemeButton(theme) {
    const themeIcon = document.getElementById('themeIcon');
    const themeText = document.getElementById('themeText');
    
    if (theme === 'dark') {
        themeIcon.textContent = '🌞';
        themeText.textContent = 'Mode clair';
    } else {
        themeIcon.textContent = '🌜';
        themeText.textContent = 'Mode sombre';
    }
}

document.getElementById('themeToggle').addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeButton(newTheme);
});

function synchronizeClientFolders() {
    try {
        const dossierTypes = ['Dossiers en cours', 'Dossiers archivés'];
        
        // Parcourir tous les types de dossiers
        dossierTypes.forEach(dossierType => {
            const dossierPath = path.join(__dirname, dossierType);
            if (!fs.existsSync(dossierPath)) return;

            // Lire les dossiers existants
            const existingFolders = fs.readdirSync(dossierPath)
                .filter(folder => !folder.startsWith('.'));

            // Pour chaque dossier existant
            existingFolders.forEach(folder => {
                // Vérifier si le dossier correspond à un client
                const [nom, prenom] = folder.split('_');
                const clientExists = clients.some(client => 
                    client.nom === nom && 
                    (client.prenom || '') === (prenom || '') &&
                    client.archived === (dossierType === 'Dossiers archivés')
                );

                // Si le dossier ne correspond à aucun client, le supprimer
                if (!clientExists) {
                    const folderPath = path.join(dossierPath, folder);
                    console.log(`Suppression du dossier orphelin: ${folderPath}`);
                    fs.rmSync(folderPath, { recursive: true, force: true });
                }
            });
        });

        console.log('Synchronisation des dossiers terminée');
    } catch (error) {
        console.error('Erreur lors de la synchronisation des dossiers:', error);
    }
}

// Modifier la fonction loadData
function loadData() {
    try {
        // 1. Charger les clients
        const clientsPath = path.join(__dirname, 'clients.json');
        console.log('Chargement des clients depuis:', clientsPath);
        
        if (fs.existsSync(clientsPath)) {
            const data = fs.readFileSync(clientsPath, 'utf8');
            
            // Vérifier que le contenu n'est pas vide
            if (!data.trim()) {
                throw new Error('Fichier clients.json vide');
            }

            try {
                clients = JSON.parse(data);
                
                // Vérification du format des données
                if (!Array.isArray(clients)) {
                    throw new Error('Format de données clients invalide');
                }
                
                console.log(`${clients.length} clients chargés avec succès`);
                
                // 2. Peupler la liste des clients APRÈS avoir vérifié les données
                populateClientSelect();
                
            } catch (parseError) {
                console.error('Erreur de parsing JSON:', parseError);
                alert('Erreur lors de la lecture du fichier clients.json');
                clients = [];
            }
        } else {
            console.error('Fichier clients.json non trouvé');
            clients = [];
        }

        // 3. Charger les factures
        const invoicesPath = path.join(__dirname, 'invoices.json');
        if (fs.existsSync(invoicesPath)) {
            const invoicesData = fs.readFileSync(invoicesPath, 'utf8');
            invoices = JSON.parse(invoicesData);
            updateInvoicesList();
        } else {
            invoices = [];
            fs.writeFileSync(invoicesPath, JSON.stringify([], null, 2));
        }

        // 4. Mettre à jour les graphiques
        updateInvoicesList();
        updateFinancialStats();
        updateCharts();

    } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
        console.error('Stack:', error.stack);
        alert(`Erreur de chargement : ${error.message}`);
    }
}

// Modifier la fonction initializeCharts
function initializeCharts(options) {
    // Détruire les graphiques existants s'ils existent
    if (revenueChart) {
        revenueChart.destroy();
    }
    if (dossiersChart) {
        dossiersChart.destroy();
    }

    const revenueCtx = document.getElementById('revenueChart').getContext('2d');
    const dossiersCtx = document.getElementById('dossiersChart').getContext('2d');

    revenueChart = new Chart(revenueCtx, {
        type: 'line',
        data: generateRevenueData(),
        options: options
    });

    dossiersChart = new Chart(dossiersCtx, {
        type: 'pie',
        data: generateDossiersData(),
        options: options
    });
}

// Fonction pour mettre à jour les graphiques
function updateCharts() {
    updateRevenueChart();
    updateDossiersChart();
}

function updateRevenueChart() {
    const ctx = document.getElementById('revenueChart').getContext('2d');
    
    // Détruire le graphique existant s'il existe
    if (revenueChart) {
        revenueChart.destroy();
    }

    // Obtenir les données mensuelles
    const monthlyData = getMonthlyRevenue();

    // Créer le nouveau graphique
    revenueChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: monthlyData.labels,
            datasets: [{
                label: 'CA mensuel',
                data: monthlyData.data,
                borderColor: '#2196F3',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function updateDossiersChart() {
    const ctx = document.getElementById('dossiersChart').getContext('2d');
    
    // Détruire le graphique existant s'il existe
    if (dossiersChart) {
        dossiersChart.destroy();
    }

    // Créer le nouveau graphique
    dossiersChart = new Chart(ctx, {
        type: 'pie',
        data: generateDossiersData(),
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'right',
                    display: true
                }
            }
        }
    });
}

function getMonthlyRevenue() {
    const currentYear = new Date().getFullYear();
    const months = Array(12).fill(0);
    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

    // Calculer le CA pour chaque mois
    invoices.forEach(invoice => {
        const date = new Date(invoice.date);
        if (date.getFullYear() === currentYear) {
            months[date.getMonth()] += invoice.totalHT;
        }
    });

    return {
        labels: monthNames,
        data: months
    };
}

// Modifier la fonction generateInvoiceNumber pour gérer le cas où invoices est undefined
function generateInvoiceNumber() {
    const date = new Date();
    const year = date.getFullYear();
    
    // S'assurer que invoices est un tableau
    if (!Array.isArray(invoices)) {
        invoices = [];
    }

    // Filtrer et trier les factures de l'année en cours
    const currentYearInvoices = invoices.filter(inv => inv && inv.number && inv.number.startsWith(`${year}`));
    const lastInvoice = currentYearInvoices.sort((a, b) => b.number.localeCompare(a.number))[0];

    const lastNumber = lastInvoice ? parseInt(lastInvoice.number.split('-')[1]) : 0;
    return `${year}-${(lastNumber + 1).toString().padStart(4, '0')}`;
}

function createInvoice() {
    console.log('Ouverture de la modal de facture'); // Pour debug
    openModal();
    
    // Réinitialiser le formulaire
    const form = document.getElementById('invoiceForm');
    if (form) {
        form.reset();
    }
    
    // Réinitialiser les prestations
    const prestationsContainer = document.getElementById('prestationsContainer');
    if (prestationsContainer) {
        prestationsContainer.innerHTML = `
            <div class="prestation-item">
                <input type="text" placeholder="Description" class="prestation-desc">
                <input type="number" placeholder="Montant HT" class="prestation-amount" onchange="updateTotals()">
                <button type="button" class="remove-prestation">×</button>
            </div>
        `;
    }
    
    // Réinitialiser les totaux
    document.getElementById('invoiceTotalHT').textContent = '0 €';
    document.getElementById('invoiceTVA').textContent = '0 €';
    document.getElementById('invoiceTotalTTC').textContent = '0 €';
    
    // Rafraîchir la liste des clients
    populateClientSelect();
}

function updateTotals() {
    let totalHT = 0;
    document.querySelectorAll('.prestation-amount').forEach(input => {
        totalHT += parseFloat(input.value || 0);
    });
    
    const tva = totalHT * 0.20;
    const totalTTC = totalHT + tva;
    
    document.getElementById('invoiceTotalHT').textContent = `${totalHT.toFixed(2)} €`;
    document.getElementById('invoiceTVA').textContent = `${tva.toFixed(2)} €`;
    document.getElementById('invoiceTotalTTC').textContent = `${totalTTC.toFixed(2)} €`;
}

// Garder et modifier cette fonction
function addRow() {
    const container = document.getElementById('prestationsContainer');
    if (!container) return;

    const newRow = document.createElement('tr');
    newRow.className = 'prestation-item';
    newRow.innerHTML = `
        <td><input type="text" class="prestation-desc" placeholder="Description" required></td>
        <td><input type="number" class="prestation-amount" placeholder="0.00" step="0.01" required onchange="updateTotals()"></td>
        <td><button type="button" class="remove-row" onclick="removeRow(this)">×</button></td>
    `;
    container.appendChild(newRow);
}

// Renommer cette fonction pour plus de cohérence
function removeRow(button) {
    button.closest('.prestation-item').remove();
    updateTotals();
}

function saveInvoice(formData) {
    const invoice = {
        number: generateInvoiceNumber(),
        date: new Date().toISOString(),
        clientId: formData.clientId,
        prestations: formData.prestations,
        totalHT: formData.totalHT,
        tva: formData.totalHT * TVA_RATE,
        totalTTC: formData.totalHT * (1 + TVA_RATE),
        status: 'sent' // Ajouter le statut par défaut
    };

    invoices.push(invoice);
    saveInvoicesToFile();
    updateInvoicesList();
    updateFinancialStats();
    updateCharts();
    closeModal();
}

function saveInvoicesToFile() {
    try {
        const invoicesPath = path.join(__dirname, 'invoices.json');
        fs.writeFileSync(invoicesPath, JSON.stringify(invoices, null, 2));
        console.log('Factures sauvegardées avec succès');
    } catch (error) {
        console.error('Erreur lors de la sauvegarde des factures:', error);
        throw new Error('Impossible de sauvegarder les factures');
    }
}

function updateInvoicesList() {
    const tbody = document.querySelector('#invoicesTable tbody');
    tbody.innerHTML = '';

    invoices.forEach(invoice => {
        const description = invoice.prestations && invoice.prestations[0] ? 
            invoice.prestations[0].description : '';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${invoice.number}</td>
            <td>${invoice.client.nom} ${invoice.client.prenom}</td>
            <td>${formatDate(invoice.date)}</td>
            <td>${description}</td>
            <td>${formatMoney(invoice.totalHT)}</td>
            <td>${formatMoney(invoice.totalTTC)}</td>
            <td>
                <select class="status-select" onchange="updateInvoiceStatus('${invoice.number}', this.value)">
                    <option value="sent" ${invoice.status === 'sent' ? 'selected' : ''}>Envoyée</option>
                    <option value="paid" ${invoice.status === 'paid' ? 'selected' : ''}>Payée</option>
                </select>
            </td>
            <td>
                <button onclick="deleteInvoice('${invoice.number}')" class="action-btn delete-btn" title="Supprimer">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Ajouter cette nouvelle fonction pour gérer le changement de statut
function updateInvoiceStatus(invoiceNumber, newStatus) {
    const invoice = invoices.find(inv => inv.number === invoiceNumber);
    if (invoice) {
        invoice.status = newStatus;
        saveInvoicesToFile();
        updateCharts();
        updateFinancialStats();
    }
}

// Fonctions pour les actions
function viewInvoice(invoiceNumber) {
    const invoice = invoices.find(inv => inv.number === invoiceNumber);
    if (invoice) {
        generateInvoicePDF(invoice, true); // Le second paramètre indique d'ouvrir le PDF
    }
}

function downloadInvoice(invoiceNumber) {
    const invoice = invoices.find(inv => inv.number === invoiceNumber);
    if (invoice) {
        generateInvoicePDF(invoice, false); // Le second paramètre indique de télécharger le PDF
    }
}

function deleteInvoice(invoiceNumber) {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette facture ?')) {
        const index = invoices.findIndex(inv => inv.number === invoiceNumber);
        if (index !== -1) {
            invoices.splice(index, 1);
            saveInvoicesToFile();
            updateInvoicesList();
            updateFinancialStats();
            updateCharts();
        }
    }
}

// Modifier la fonction populateClientSelect
function populateClientSelect() {
    const select = document.getElementById('clientSelect');
    if (!select) {
        console.error('Element select non trouvé');
        return;
    }

    select.innerHTML = '<option value="">Sélectionner un client</option>';

    if (!Array.isArray(clients) || clients.length === 0) {
        console.error('Aucun client disponible');
        return;
    }

    console.log(`Préparation de ${clients.length} clients pour la liste`);

    const sortedClients = [...clients].sort((a, b) => a.nom.localeCompare(b.nom));
    
    const currentGroup = document.createElement('optgroup');
    currentGroup.label = 'Dossiers en cours';
    
    const archivedGroup = document.createElement('optgroup');
    archivedGroup.label = 'Dossiers archivés';

    let currentCount = 0;
    let archivedCount = 0;

    sortedClients.forEach(client => {
        if (client?.numeroDossier && client?.nom) {
            const option = document.createElement('option');
            option.value = client.numeroDossier;
            option.textContent = `${client.nom} ${client.prenom || ''} (${client.numeroDossier})`;
            
            if (client.archived) {
                archivedGroup.appendChild(option);
                archivedCount++;
            } else {
                currentGroup.appendChild(option);
                currentCount++;
            }
        }
    });

    if (currentCount > 0) select.appendChild(currentGroup);
    if (archivedCount > 0) select.appendChild(archivedGroup);

    console.log(`Liste peuplée avec ${currentCount} dossiers en cours et ${archivedCount} dossiers archivés`);
}

// Ajouter cette fonction après les autres fonctions
function getFormData() {
    try {
        // Récupérer l'ID du client sélectionné
        const clientId = document.getElementById('clientSelect').value;
        if (!clientId) {
            alert('Veuillez sélectionner un client');
            return null;
        }

        // Trouver le client correspondant
        const selectedClient = clients.find(c => c.numeroDossier === clientId);
        if (!selectedClient) {
            alert('Client non trouvé');
            return null;
        }

        // Récupérer les prestations - Modification du sélecteur ici
        const prestations = [];
        document.querySelectorAll('.prestation-item').forEach(row => {
            const description = row.querySelector('.prestation-desc').value.trim();
            const amount = parseFloat(row.querySelector('.prestation-amount').value);
            
            if (description && !isNaN(amount) && amount > 0) {
                prestations.push({
                    description: description,
                    amount: amount
                });
            }
        });

        if (prestations.length === 0) {
            alert('Veuillez remplir au moins une prestation');
            return null;
        }

        const totalHT = prestations.reduce((sum, p) => sum + p.amount, 0);

        return {
            clientId: selectedClient.numeroDossier,
            client: selectedClient,
            prestations,
            totalHT,
            date: new Date()
        };
    } catch (error) {
        console.error('Erreur dans getFormData:', error);
        return null;
    }
}

// Modifier la fonction handleInvoiceSubmission
async function handleInvoiceSubmission(event) {
    event.preventDefault();
    
    try {
        const formData = getFormData();
        console.log('FormData reçu:', formData);
        
        if (!formData) return;

        const selectedClient = formData.client;
        console.log('Client sélectionné pour la facture:', selectedClient);

        // ... reste du code ...

// Avant de créer l'email
console.log('Préparation de l\'email pour:', selectedClient.nom, selectedClient.prenom);

if (!selectedClient.email) {
            throw new Error('Email du client non renseigné');
        }

        const invoiceNumber = generateInvoiceNumber();
        const invoice = {
            number: invoiceNumber,
            date: new Date().toISOString(),
            client: selectedClient,
            prestations: formData.prestations,
            totalHT: formData.totalHT,
            tva: formData.totalHT * 0.20,
            totalTTC: formData.totalHT * 1.20
        };

        // Générer le PDF
        const pdfArrayBuffer = await generateInvoicePDF(invoice);
        const pdfBuffer = Buffer.from(pdfArrayBuffer);

        // Créer le dossier du client
        const baseFolder = selectedClient.archived ? 'Dossiers archivés' : 'Dossiers en cours';
        const clientFolder = path.join(__dirname, baseFolder, `${selectedClient.nom}_${selectedClient.prenom}`, '2-Factures');
        
        if (!fs.existsSync(clientFolder)) {
            fs.mkdirSync(clientFolder, { recursive: true });
        }

        const pdfPath = path.join(clientFolder, `Facture_${invoiceNumber}.pdf`);
        fs.writeFileSync(pdfPath, pdfBuffer);

        // Préparer le message d'email avec le client sélectionné
        const emailBody = `
Cher(e) ${selectedClient.prenom ? selectedClient.prenom + ' ' : ''}${selectedClient.nom},

Veuillez trouver ci-joint ma note d'honoraire d'un montant de ${invoice.totalTTC.toFixed(2)} € TTC, dont je vous remercie par avance pour le règlement.

Vous trouverez également ci-joint mon RIB.

Vous en souhaitant bonne réception,
Je reste à votre disposition,
Bien à vous,

Maître Candice ROVERA
Avocate au Barreau de Paris
124 Boulevard de Strasbourg
75010 PARIS
06.07.50.43.81
Toque C0199
Site internet : https://candicerovera-avocat.fr/`;

        // Sauvegarder et mettre à jour
        invoices.push(invoice);
        saveInvoicesToFile();
        closeModal();
        loadData();
        updateCharts();
        updateFinancialStats();

        // Ouvrir la modale d'email avec le bon client
        openEmailModal({
            to: selectedClient.email,
            subject: `Note d'honoraire - Maître Candice ROVERA`,
            body: emailBody,
            attachments: [
                pdfPath,
                path.join(__dirname, 'RIB.pdf')
            ]
        });

    } catch (error) {
        console.error('Erreur détaillée:', error);
        alert(`Erreur: ${error.message}`);
    }
}

function openEmailModal(emailData) {
    const modal = document.getElementById('emailModal');
    
    // Pré-remplir les champs
    document.getElementById('emailFrom').value = 'candicerovera@gmail.com';
    document.getElementById('emailTo').value = emailData.to;
    document.getElementById('emailSubject').value = emailData.subject;
    document.getElementById('emailBody').value = emailData.body;

    // Afficher les pièces jointes
    const attachmentsList = document.getElementById('attachmentsList');
    attachmentsList.innerHTML = emailData.attachments
        .map(file => `<li>📎 ${path.basename(file)}</li>`)
        .join('');

    // Stocker les chemins des pièces jointes pour l'envoi
    modal.dataset.attachments = JSON.stringify(emailData.attachments);

    modal.style.display = 'flex';
}

function closeEmailModal() {
    document.getElementById('emailModal').style.display = 'none';
}

// Modifier la gestion de l'envoi d'email
document.getElementById('emailForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
        const modal = document.getElementById('emailModal');
        const attachments = JSON.parse(modal.dataset.attachments);
        
        const emailData = {
            from: document.getElementById('emailFrom').value,
            to: document.getElementById('emailTo').value,
            cc: document.getElementById('emailCc').value,
            subject: document.getElementById('emailSubject').value,
            body: document.getElementById('emailBody').value,
            attachments: attachments
        };

        // Ouvrir le dossier contenant les pièces jointes
        if (attachments.length > 0) {
            const folderPath = path.dirname(attachments[0]);
            await shell.openPath(folderPath);
        }

        // Construire l'URL Gmail pour composer un nouveau mail
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(emailData.to)}${
            emailData.cc ? '&cc=' + encodeURIComponent(emailData.cc) : ''
        }&su=${encodeURIComponent(emailData.subject)}&body=${encodeURIComponent(emailData.body)}`;

        // Ouvrir Gmail dans le navigateur par défaut
        await shell.openExternal(gmailUrl);

        closeEmailModal();

    } catch (error) {
        console.error('Erreur lors de l\'envoi:', error);
        alert('Erreur lors de la préparation de l\'email : ' + error.message);
    }
});

// Fonction pour générer le PDF de la facture
async function generateInvoicePDF(invoice) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // En-tête
    doc.setFontSize(20);
    doc.text("FACTURE", 105, 20, { align: "center" });
    
    // Informations du cabinet
    doc.setFontSize(12);
    doc.text(CABINET_INFO.nom, 20, 40);
    doc.setFontSize(10);
    doc.text(CABINET_INFO.titre, 20, 45);
    doc.text(CABINET_INFO.adresse, 20, 50);
    doc.text(`SIRET : ${CABINET_INFO.siret}`, 20, 55);
    doc.text(`TVA : ${CABINET_INFO.tva}`, 20, 60);

    // Informations de la facture
    doc.text(`Facture N° : ${invoice.number}`, 120, 40);
    doc.text(`Date : ${new Date(invoice.date).toLocaleDateString('fr-FR')}`, 120, 45);

    // Informations du client
    doc.text("Facturer à :", 120, 60);
    doc.text(`${invoice.client.nom} ${invoice.client.prenom}`, 120, 65);
    doc.text(invoice.client.adresse || "", 120, 70);

    // Tableau des prestations
    const tableColumn = ["Description", "Montant HT"];
    const tableRows = invoice.prestations.map(item => [
        item.description,
        `${item.amount.toFixed(2)} €`
    ]);

    doc.autoTable({
        startY: 90,
        head: [tableColumn],
        body: tableRows,
        foot: [
            ["Total HT", `${invoice.totalHT.toFixed(2)} €`],
            ["TVA (20%)", `${invoice.tva.toFixed(2)} €`],
            ["Total TTC", `${invoice.totalTTC.toFixed(2)} €`]
        ],
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185] }
    });

    return doc.output('arraybuffer');
}

function openModal() {
    const modal = document.getElementById('invoiceModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.querySelector('.modal-content').scrollTop = 0;
    }
}

function closeModal() {
    const modal = document.getElementById('invoiceModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function setupEventListeners() {
    // Initialiser les éléments avec vérification
    const createInvoiceBtn = document.getElementById('createInvoiceBtn');
    const closeModalBtn = document.querySelector('.close-modal');
    const addPrestationBtn = document.querySelector('.add-prestation');
    const prestationsContainer = document.getElementById('prestationsContainer');
    const invoiceForm = document.getElementById('invoiceForm');

    // Vérifier et ajouter les événements un par un
    if (createInvoiceBtn) {
        createInvoiceBtn.addEventListener('click', createInvoice);
    } else {
        console.error('Bouton de création de facture non trouvé');
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            const modal = document.getElementById('invoiceModal');
            if (modal) modal.style.display = 'none';
        });
    }

    // Gestionnaire de la modal
    const modal = document.getElementById('invoiceModal');
    if (modal) {
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }

    // Gestionnaire des calculs automatiques
    if (prestationsContainer) {
        prestationsContainer.addEventListener('input', (e) => {
            if (e.target.classList.contains('prestation-amount')) {
                updateTotals();
            }
        });
    }

    // Gestionnaire du formulaire
    if (invoiceForm) {
        invoiceForm.addEventListener('submit', handleInvoiceSubmission);
    }

    // Gestionnaire pour l'ajout de lignes
    const addRowBtn = document.querySelector('.add-row');
    if (addRowBtn) {
        addRowBtn.addEventListener('click', addRow);
    }
}

function initializeDraggableColumns() {
    const headers = document.querySelectorAll('#invoicesTable th');
    
    headers.forEach((header, index) => {
        if (index < headers.length - 1) { // Exclure la colonne Actions
            header.draggable = true;
            
            header.addEventListener('dragstart', (e) => {
                draggedColumn = header;
                originalIndex = Array.from(headers).indexOf(header);
                header.classList.add('dragging');
            });

            header.addEventListener('dragend', () => {
                header.classList.remove('dragging');
                draggedColumn = null;
                originalIndex = null;
            });

            header.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (draggedColumn && draggedColumn !== header) {
                    const currentIndex = Array.from(headers).indexOf(header);
                    if (currentIndex !== originalIndex) {
                        swapColumns(originalIndex, currentIndex);
                        originalIndex = currentIndex;
                    }
                }
            });
        }
    });
}

function swapColumns(fromIndex, toIndex) {
    const table = document.getElementById('invoicesTable');
    const rows = Array.from(table.rows);

    rows.forEach(row => {
        const fromCell = row.cells[fromIndex];
        const toCell = row.cells[toIndex];
        
        // Créer une copie temporaire du contenu
        const tempContent = fromCell.innerHTML;
        
        // Échanger les contenus
        fromCell.innerHTML = toCell.innerHTML;
        toCell.innerHTML = tempContent;
    });

    // Mettre à jour l'ordre des colonnes dans la configuration
    updateColumnOrder(fromIndex, toIndex);
}

function updateColumnOrder(fromIndex, toIndex) {
    // Mettre à jour l'ordre des colonnes pour le tri
    const columns = {
        0: 'number',
        1: 'client',
        2: 'date',
        3: 'description',
        4: 'totalTTC'
    };

    // Sauvegarder le nouvel ordre dans le localStorage
    localStorage.setItem('columnOrder', JSON.stringify(columns));
}

function updateFinancialStats() {
    const currentYear = new Date().getFullYear();
    let currentYearHT = 0;
    let totalTVA = 0;
    let totalTTC = 0;

    // Calculer les totaux pour l'année en cours
    invoices.forEach(invoice => {
        const invoiceDate = new Date(invoice.date);
        if (invoiceDate.getFullYear() === currentYear) {
            currentYearHT += invoice.totalHT;
            totalTVA += invoice.totalHT * 0.20;
            totalTTC += invoice.totalTTC;
        }
    });

    // Mettre à jour l'affichage
    document.getElementById('totalHT').textContent = formatMoney(currentYearHT);
    document.getElementById('totalTVA').textContent = formatMoney(totalTVA);
    document.getElementById('totalTTC').textContent = formatMoney(totalTTC);
}