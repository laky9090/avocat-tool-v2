// Constantes et variables globales
const TVA_RATE = 0.20;
let invoices = [];
let clients = [];

const CABINET_INFO = {
    nom: "Me Candice ROVERA",
    titre: "Avocat au Barreau de Paris",
    adresse: "[Adresse du cabinet]",
    telephone: "[Numéro de téléphone]",
    email: "[Email professionnel]",
    siret: "98302483700020",
    tva: "FR13983024837"
};

const fs = require('fs');
const path = require('path');

// Variables globales pour stocker les instances de graphiques
let revenueChart = null;
let dossiersChart = null;

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
        // Charger les clients depuis le fichier clients.json
        const clientsPath = path.join(__dirname, 'clients.json');
        console.log('Chargement des clients depuis:', clientsPath);
        
        if (fs.existsSync(clientsPath)) {
            const data = fs.readFileSync(clientsPath, 'utf8');
            clients = JSON.parse(data);
            console.log(`${clients.length} clients chargés depuis clients.json`);

            // Synchroniser les dossiers après le chargement des clients
            synchronizeClientFolders();
        } else {
            console.error('Fichier clients.json non trouvé');
            clients = [];
        }

        // Peupler la liste des clients
        populateClientSelect();

        // Charger les factures
        const invoicesPath = path.join(__dirname, 'invoices.json');
        if (fs.existsSync(invoicesPath)) {
            const data = fs.readFileSync(invoicesPath, 'utf8');
            invoices = JSON.parse(data);
            console.log('Factures chargées:', invoices.length);
            updateInvoicesList();
        } else {
            console.log('Aucun fichier de factures trouvé, initialisation d\'une nouvelle liste');
            invoices = [];
            fs.writeFileSync(invoicesPath, JSON.stringify(invoices, null, 2));
        }
    } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
        console.error('Stack:', error.stack);
        clients = [];
        invoices = [];
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
    // Détruire et recréer les graphiques avec les nouvelles données
    initializeCharts({
        responsive: true,
        maintainAspectRatio: false,
        animation: {
            duration: 0
        },
        plugins: {
            legend: {
                display: true,
                position: 'bottom'
            }
        }
    });
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
        totalTTC: formData.totalHT * (1 + TVA_RATE)
    };

    invoices.push(invoice);
    saveInvoicesToFile();
    updateInvoicesList();
    closeModal();
}

function updateInvoicesList() {
    const tbody = document.getElementById('invoicesList');
    tbody.innerHTML = invoices.map(invoice => `
        <tr>
            <td>${invoice.number}</td>
            <td>${getClientName(invoice.clientId)}</td>
            <td>${formatDate(invoice.date)}</td>
            <td>${formatMoney(invoice.totalHT)}</td>
            <td>${formatMoney(invoice.tva)}</td>
            <td>${formatMoney(invoice.totalTTC)}</td>
            <td>
                <button onclick="editInvoice('${invoice.number}')">✏️</button>
                <button onclick="printInvoice('${invoice.number}')">🖨️</button>
                <button onclick="deleteInvoice('${invoice.number}')">🗑️</button>
            </td>
        </tr>
    `).join('');
}

// Modifier la fonction populateClientSelect
function populateClientSelect() {
    const select = document.getElementById('clientSelect');
    if (!select) {
        console.error('Element select non trouvé');
        return;
    }

    // Vider la liste
    select.innerHTML = '<option value="">Sélectionner un client</option>';

    // Vérifier si nous avons des clients
    if (!Array.isArray(clients) || clients.length === 0) {
        console.error('Aucun client disponible');
        return;
    }

    // Créer les groupes
    const currentGroup = document.createElement('optgroup');
    currentGroup.label = 'Dossiers en cours';
    
    const archivedGroup = document.createElement('optgroup');
    archivedGroup.label = 'Dossiers archivés';

    // Trier et répartir les clients
    clients.forEach(client => {
        if (client && client.numeroDossier) {
            const option = document.createElement('option');
            option.value = client.numeroDossier;
            option.textContent = `${client.nom} ${client.prenom || ''} (${client.numeroDossier})`;
            
            if (client.archived) {
                archivedGroup.appendChild(option);
            } else {
                currentGroup.appendChild(option);
            }
        }
    });

    // Ajouter les groupes non vides
    if (currentGroup.children.length > 0) {
        select.appendChild(currentGroup);
    }
    if (archivedGroup.children.length > 0) {
        select.appendChild(archivedGroup);
    }

    console.log(`Clients chargés dans le select : ${select.options.length - 1}`);
}

// Ajouter cette fonction après les autres fonctions
function getFormData() {
    try {
        const clientId = document.getElementById('clientSelect').value;
        if (!clientId) {
            alert('Veuillez sélectionner un client');
            return null;
        }

        const prestations = [];
        // Modifier le sélecteur pour cibler correctement les lignes de prestation
        document.querySelectorAll('#prestationsContainer .prestation-item').forEach(row => {
            const description = row.querySelector('.prestation-desc').value.trim();
            const amount = parseFloat(row.querySelector('.prestation-amount').value);
            
            // Vérifier si la ligne est remplie
            if (description && !isNaN(amount) && amount > 0) {
                prestations.push({
                    description: description,
                    amount: amount
                });
            }
        });

        // Debug
        console.log('Prestations trouvées:', prestations);

        // Ne vérifier que si le tableau est vide
        if (prestations.length === 0) {
            alert('Veuillez remplir au moins une prestation');
            return null;
        }

        const totalHT = prestations.reduce((sum, p) => sum + p.amount, 0);

        return {
            clientId,
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
        if (!formData) return;

        const client = clients.find(c => c.numeroDossier === formData.clientId);
        if (!client) {
            throw new Error('Client non trouvé');
        }

        // Vérifier que le client a un email
        if (!client.email) {
            throw new Error('Email du client non renseigné');
        }

        // Générer le numéro de facture
        const invoiceNumber = generateInvoiceNumber();

        // Créer l'objet facture
        const invoice = {
            number: invoiceNumber,
            date: new Date().toISOString(),
            client: client,
            prestations: formData.prestations,
            totalHT: formData.totalHT,
            tva: formData.totalHT * 0.20,
            totalTTC: formData.totalHT * 1.20
        };

        // Générer et sauvegarder le PDF
        const pdfBuffer = await generateInvoicePDF(invoice);
        const baseFolder = client.archived ? 'Dossiers archivés' : 'Dossiers en cours';
        const clientFolder = path.join(__dirname, baseFolder, `${client.nom}_${client.prenom}`, '2-Factures');
        
        if (!fs.existsSync(clientFolder)) {
            fs.mkdirSync(clientFolder, { recursive: true });
        }

        const pdfPath = path.join(clientFolder, `Facture_${invoiceNumber}.pdf`);
        fs.writeFileSync(pdfPath, Buffer.from(pdfBuffer));

        // Lire et encoder le logo en base64
        const logoPath = path.join(__dirname, 'logo_candice.png');
        const logoBase64 = fs.readFileSync(logoPath, { encoding: 'base64' });

        const emailSubject = encodeURIComponent(`Note d'honoraire - Maître Candice ROVERA`);
        const emailBody = encodeURIComponent(`
        <html>
        <body>
            <p>Cher(e) ${client.nom},</p>
            <p>Veuillez trouver ci-joint ma note d'honoraire d'un montant de ${invoice.totalTTC.toFixed(2)} € TTC, dont je vous remercie par avance pour le règlement.</p>
            <p>Vous trouverez également ci-joint mon RIB.</p>
            <p>Vous en souhaitant bonne réception,<br>
            Je reste à votre disposition,<br>
            Bien à vous,</p>
            <p><img src="data:image/png;base64,${logoBase64}" alt="Logo" style="max-width: 200px;"></p>
            <p><strong>Maître Candice ROVERA<br>
            Avocate au Barreau de Paris<br>
            124 Boulevard de Strasbourg<br>
            75010 PARIS<br>
            06.07.50.43.81<br>
            Toque C0199<br>
            Site internet : https://candicerovera-avocat.fr/</strong></p>
        </body>
        </html>
        `);

        // Modifier l'URL Gmail pour spécifier le contenu HTML
        const ribPath = path.join(__dirname, 'RIB.pdf'); // Assurez-vous que le RIB est présent dans le dossier
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(client.email)}&su=${emailSubject}&body=${emailBody}&attach=${encodeURIComponent(pdfPath)},${encodeURIComponent(ribPath)}&html=true`;
        require('electron').shell.openExternal(gmailUrl);

        // Fermer la modal et réinitialiser
        closeModal();
        loadData();
        updateCharts();

    } catch (error) {
        console.error('Erreur détaillée:', error);
        alert(`Erreur: ${error.message}`);
    }
}

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