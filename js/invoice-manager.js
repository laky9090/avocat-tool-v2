// Gestion des factures

// Remplacer la fonction handleInvoiceSubmission

function handleInvoiceSubmission(event) {
    event.preventDefault();
    
    try {
        // Récupérer les données du formulaire
        const data = getFormData();
        if (!data) return;
        
        // Générer un numéro de facture unique
        const invoiceNumber = generateInvoiceNumber(data.client.numeroDossier);
        
        // Créer l'objet facture
        const invoice = {
            number: invoiceNumber,
            client: data.client,
            date: new Date().toISOString(),
            prestations: data.prestations,
            totalHT: data.totalHT,
            totalTTC: data.totalHT * 1.2, // TVA 20%
            status: 'sent' // Par défaut
        };
        
        // S'assurer que window.invoices est un tableau
        if (!Array.isArray(window.invoices)) {
            console.warn('window.invoices n\'est pas un tableau, initialisation...');
            window.invoices = [];
        }
        
        // Ajouter la facture à la liste
        window.invoices.push(invoice);
        console.log(`Facture ${invoiceNumber} ajoutée en mémoire`);
        
        // Sauvegarder immédiatement
        const saveResult = window.saveInvoicesToFile();
        console.log('Résultat de la sauvegarde:', saveResult);
        
        // Mettre à jour l'interface avant de fermer la modale
        updateInvoicesList();
        updateFinancialStats();
        updateCharts();
        
        // Fermer la modale et donner un retour à l'utilisateur
        closeInvoiceModal();
        alert(`Facture ${invoiceNumber} créée avec succès`);
        
        // Rafraîchir la fenêtre
        setTimeout(() => {
            if (typeof forceWindowRefresh === 'function') {
                forceWindowRefresh();
            }
        }, 200);
        
    } catch (error) {
        console.error('Erreur lors de la création de facture:', error);
        alert('Erreur: ' + error.message);
    }
}

// Récupérer les données du formulaire
function getFormData() {
    // Récupérer le client sélectionné
    const clientSelect = document.getElementById('clientSelect');
    if (!clientSelect || !clientSelect.value) {
        alert('Veuillez sélectionner un client');
        return null;
    }
    
    const clientId = clientSelect.value;
    const client = clients.find(c => c.numeroDossier === clientId);
    if (!client) {
        alert('Client introuvable');
        return null;
    }
    
    // Récupérer les prestations
    const prestationItems = document.querySelectorAll('.prestation-item');
    const prestations = [];
    let totalHT = 0;
    
    prestationItems.forEach(item => {
        const desc = item.querySelector('.prestation-desc').value;
        const amount = parseFloat(item.querySelector('.prestation-amount').value);
        
        if (desc && !isNaN(amount)) {
            prestations.push({ description: desc, amount });
            totalHT += amount;
        }
    });
    
    if (prestations.length === 0) {
        alert('Veuillez ajouter au moins une prestation');
        return null;
    }
    
    return { client, prestations, totalHT };
}

// Supprimer une facture
function deleteInvoice(invoiceNumber) {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette facture ?')) {
        const index = window.invoices.findIndex(inv => inv.number === invoiceNumber);
        if (index !== -1) {
            // Supprimer la facture
            window.invoices.splice(index, 1);
            saveInvoicesToFile();
            
            // Mettre à jour l'interface
            updateInvoicesList();
            updateFinancialStats();
            updateCharts();
            
            alert('Facture supprimée avec succès');
            
            // Forcer le rafraîchissement de la fenêtre
            setTimeout(() => {
                if (typeof forceWindowRefresh === 'function') {
                    forceWindowRefresh();
                }
            }, 200);
        }
    }
}

// Générer un numéro de facture unique pour un client
function generateInvoiceNumber(clientId) {
    if (!clientId) {
        console.error('ID client manquant pour la génération du numéro de facture');
        return null;
    }

    try {
        if (!Array.isArray(window.invoices)) {
            window.invoices = [];
        }
        
        // Trouver le dernier numéro utilisé pour ce client
        const clientInvoices = window.invoices
            .filter(inv => inv?.client?.numeroDossier === clientId)
            .map(inv => {
                if (!inv.number) return 0;
                const parts = inv.number.split('-');
                return parseInt(parts[parts.length - 1], 10);
            })
            .filter(num => !isNaN(num));
            
        const lastNumber = clientInvoices.length > 0 ? Math.max(...clientInvoices) : 0;
        return `${clientId}-${String(lastNumber + 1).padStart(2, '0')}`;
    } catch (error) {
        console.error('Erreur lors de la génération du numéro:', error);
        return `${clientId}-01`; // Valeur de repli
    }
}

function getAppPath() {
    try {
        const remote = require('@electron/remote');
        const app = remote.app;
        return app.getAppPath();
    } catch (e) {
        console.error('Erreur lors de la récupération du chemin de l\'application:', e);
        return __dirname; // Fallback
    }
}

// Sauvegarder les factures dans un fichier JSON
function saveInvoicesToFile() {
    console.log('Sauvegarde des factures...');
    
    try {
        const fs = require('fs');
        const invoicesPath = window.invoicesPath;
        
        if (!invoicesPath) {
            throw new Error('Chemin du fichier des factures non défini');
        }
        
        console.log('Chemin de sauvegarde:', invoicesPath);
        
        // S'assurer que le tableau des factures existe
        if (!window.invoices) window.invoices = [];
        if (!Array.isArray(window.invoices)) window.invoices = [];
        
        // Préparer les données et les sauvegarder
        const jsonData = JSON.stringify(window.invoices, null, 2);
        
        // Écrire dans un fichier temporaire d'abord
        const tempPath = invoicesPath + '.tmp';
        fs.writeFileSync(tempPath, jsonData, 'utf8');
        
        // Puis remplacer le fichier principal (plus sûr en cas d'erreur)
        if (fs.existsSync(invoicesPath)) {
            fs.unlinkSync(invoicesPath);
        }
        fs.renameSync(tempPath, invoicesPath);
        
        console.log(`${window.invoices.length} factures sauvegardées dans ${invoicesPath}`);
        return true;
    } catch (error) {
        console.error('ERREUR: Sauvegarde des factures échouée:', error);
        return false;
    }
}

// Exposer globalement
window.saveInvoicesToFile = saveInvoicesToFile;

// Remplacer la fonction loadInvoices

function loadInvoices() {
    console.log('Chargement des factures...');
    
    try {
        const fs = require('fs');
        const invoicesPath = window.invoicesPath;
        
        if (!invoicesPath) {
            throw new Error('Chemin du fichier des factures non défini');
        }
        
        console.log('Chargement depuis:', invoicesPath);
        
        // Vérifier si le fichier existe
        if (fs.existsSync(invoicesPath)) {
            const content = fs.readFileSync(invoicesPath, 'utf8');
            
            if (!content || content.trim() === '' || content.trim() === '[]') {
                console.log('Fichier vide, initialisation d\'un tableau vide');
                window.invoices = [];
            } else {
                try {
                    window.invoices = JSON.parse(content);
                    console.log(`${window.invoices.length} factures chargées`);
                } catch (parseError) {
                    console.error('Erreur de parsing JSON:', parseError);
                    window.invoices = [];
                }
            }
        } else {
            console.log('Fichier non trouvé, création...');
            window.invoices = [];
            fs.writeFileSync(invoicesPath, '[]', 'utf8');
        }
        
        // Mise à jour de l'interface
        if (typeof updateInvoicesList === 'function') {
            updateInvoicesList();
        }
    } catch (error) {
        console.error('Erreur lors du chargement des factures:', error);
        window.invoices = [];
    }
}

// Mise à jour de la liste des factures dans l'interface
function updateInvoicesList() {
    console.log('Mise à jour de la liste des factures...');
    
    // Récupérer le tableau des factures
    const tableBody = document.querySelector('#invoicesTable tbody');
    if (!tableBody) {
        console.error('Tableau des factures non trouvé dans le DOM');
        alert('Erreur: Le tableau des factures n\'a pas pu être trouvé');
        return;
    }
    
    // Vérifier que window.invoices existe et est un tableau
    if (!window.invoices || !Array.isArray(window.invoices)) {
        console.warn('window.invoices n\'est pas défini ou n\'est pas un tableau');
        window.invoices = [];
    }
    
    console.log(`Affichage de ${window.invoices.length} factures`);
    
    // Vider le tableau
    tableBody.innerHTML = '';
    
    // Pas de factures à afficher
    if (window.invoices.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = '<td colspan="6" class="text-center">Aucune facture disponible</td>';
        tableBody.appendChild(emptyRow);
        return;
    }
    
    // Trier les factures par date (la plus récente d'abord)
    const sortedInvoices = [...window.invoices].sort((a, b) => {
        return new Date(b.date) - new Date(a.date);
    });
    
    // Ajouter chaque facture au tableau
    sortedInvoices.forEach(invoice => {
        const row = document.createElement('tr');
        
        // Formater la date
        const date = new Date(invoice.date);
        const formattedDate = date.toLocaleDateString('fr-FR');
        
        // Calculer le montant total
        const totalHT = invoice.totalHT || 0;
        const totalTTC = invoice.totalTTC || totalHT * 1.2;
        
        // Créer le contenu de la ligne
        row.innerHTML = `
            <td>${invoice.number}</td>
            <td>${invoice.client ? (invoice.client.nom + ' ' + invoice.client.prenom) : 'Client inconnu'}</td>
            <td>${formattedDate}</td>
            <td>${totalHT.toFixed(2)} €</td>
            <td>${totalTTC.toFixed(2)} €</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="viewInvoice('${invoice.number}')">Voir</button>
                <button class="btn btn-sm btn-danger" onclick="deleteInvoice('${invoice.number}')">Supprimer</button>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
    
    console.log('Liste des factures mise à jour avec succès');
}

// Exposer globalement
window.updateInvoicesList = updateInvoicesList;

// Fonctions d'actions sur les factures (stubs)
function viewInvoice(invoiceNumber) {
    console.log('Voir facture:', invoiceNumber);
    alert('Fonctionnalité à implémenter: voir facture ' + invoiceNumber);
}

function editInvoice(invoiceNumber) {
    console.log('Modifier facture:', invoiceNumber);
    alert('Fonctionnalité à implémenter: modifier facture ' + invoiceNumber);
}

// Exposer ces fonctions globalement
window.viewInvoice = viewInvoice;
window.editInvoice = editInvoice;

// Remplacer ou compléter la fonction updateFinancialStats

function updateFinancialStats() {
    console.log('Mise à jour des statistiques financières...');
    
    // Vérifier que les factures sont chargées
    if (!window.invoices || !Array.isArray(window.invoices)) {
        console.warn('Aucune facture disponible pour les statistiques');
        return;
    }
    
    console.log(`Calcul des statistiques sur ${window.invoices.length} factures`);
    
    // Obtenir l'année en cours
    const currentYear = new Date().getFullYear();
    
    // Filtrer les factures de l'année en cours
    const invoicesThisYear = window.invoices.filter(invoice => {
        const invoiceDate = new Date(invoice.date);
        return invoiceDate.getFullYear() === currentYear;
    });
    
    console.log(`${invoicesThisYear.length} factures pour l'année ${currentYear}`);
    
    // Calculer le total HT
    let totalHT = 0;
    invoicesThisYear.forEach(invoice => {
        totalHT += parseFloat(invoice.totalHT || 0);
    });
    
    // Calculer la TVA et le total TTC
    const totalTVA = totalHT * 0.2;
    const totalTTC = totalHT * 1.2;
    
    // Mettre à jour l'affichage
    document.getElementById('totalHT').textContent = totalHT.toFixed(2) + ' €';
    document.getElementById('totalTVA').textContent = totalTVA.toFixed(2) + ' €';
    document.getElementById('totalTTC').textContent = totalTTC.toFixed(2) + ' €';
    
    console.log('Statistiques financières mises à jour');
}

// Remplacer les fonctions updateRevenueChart et updateDossiersChart

// Fonction pour mettre à jour le graphique d'évolution du CA
function updateRevenueChart() {
    console.log('Mise à jour du graphique d\'évolution du CA...');
    
    try {
        // Vérifier que l'élément canvas existe
        const canvas = document.getElementById('revenueChart');
        if (!canvas) {
            console.error('Canvas #revenueChart introuvable dans le DOM');
            return;
        }
        
        // Vérifier que Chart est défini
        if (typeof Chart === 'undefined') {
            console.error('La bibliothèque Chart.js n\'est pas chargée');
            return;
        }
        
        const ctx = canvas.getContext('2d');
        
        // Obtenir l'année en cours
        const currentYear = new Date().getFullYear();
        
        // Préparer les données par mois
        const monthlyData = Array(12).fill(0);
        const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
        
        // Calculer le CA par mois
        if (window.invoices && Array.isArray(window.invoices)) {
            window.invoices.forEach(invoice => {
                try {
                    const invoiceDate = new Date(invoice.date);
                    if (invoiceDate.getFullYear() === currentYear) {
                        const month = invoiceDate.getMonth();
                        const amount = parseFloat(invoice.totalHT || 0);
                        if (!isNaN(month) && !isNaN(amount) && month >= 0 && month < 12) {
                            monthlyData[month] += amount;
                        }
                    }
                } catch (e) {
                    console.warn('Erreur lors du traitement d\'une facture:', e);
                }
            });
        }
        
        console.log('Données mensuelles calculées:', monthlyData);
        
        // Détruire le graphique existant s'il y en a un
        if (window.revenueChart) {
            window.revenueChart.destroy();
        }
        
        // Créer un nouveau graphique
        window.revenueChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: monthNames,
                datasets: [{
                    label: 'CA HT mensuel (€)',
                    data: monthlyData,
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
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
        
        console.log('Graphique d\'évolution du CA créé avec succès');
    } catch (error) {
        console.error('Erreur lors de la création du graphique d\'évolution:', error);
    }
}

// Fonction pour mettre à jour le graphique de répartition par type de dossier
function updateDossiersChart() {
    console.log('Mise à jour du graphique de répartition par type de dossier...');
    
    try {
        // Vérifier que l'élément canvas existe
        const canvas = document.getElementById('dossiersChart');
        if (!canvas) {
            console.error('Canvas #dossiersChart introuvable dans le DOM');
            return;
        }
        
        // Vérifier que Chart est défini
        if (typeof Chart === 'undefined') {
            console.error('La bibliothèque Chart.js n\'est pas chargée');
            return;
        }
        
        const ctx = canvas.getContext('2d');
        
        // Préparer les données
        const typeData = {};
        
        // Compter les factures par type de dossier
        if (window.invoices && Array.isArray(window.invoices)) {
            window.invoices.forEach(invoice => {
                try {
                    if (invoice && invoice.client && invoice.client.type) {
                        const type = invoice.client.type || 'Non spécifié';
                        const amount = parseFloat(invoice.totalHT || 0);
                        if (!isNaN(amount)) {
                            typeData[type] = (typeData[type] || 0) + amount;
                        }
                    }
                } catch (e) {
                    console.warn('Erreur lors du traitement d\'une facture pour le graphique de types:', e);
                }
            });
        }
        
        // S'assurer qu'il y a des données à afficher
        if (Object.keys(typeData).length === 0) {
            console.warn('Aucun type de dossier trouvé dans les factures');
            typeData['Non spécifié'] = 0; // Ajouter une valeur par défaut
        }
        
        // Convertir les données pour le graphique
        const types = Object.keys(typeData);
        const values = Object.values(typeData);
        
        console.log('Types de dossiers et valeurs:', types, values);
        
        // Couleurs pour le graphique
        const backgroundColors = [
            'rgba(255, 99, 132, 0.2)',
            'rgba(54, 162, 235, 0.2)',
            'rgba(255, 206, 86, 0.2)',
            'rgba(75, 192, 192, 0.2)',
            'rgba(153, 102, 255, 0.2)',
            'rgba(255, 159, 64, 0.2)'
        ];
        
        const borderColors = [
            'rgba(255, 99, 132, 1)',
            'rgba(54, 162, 235, 1)',
            'rgba(255, 206, 86, 1)',
            'rgba(75, 192, 192, 1)',
            'rgba(153, 102, 255, 1)',
            'rgba(255, 159, 64, 1)'
        ];
        
        // Détruire le graphique existant s'il y en a un
        if (window.dossiersChart) {
            window.dossiersChart.destroy();
        }
        
        // Créer un nouveau graphique
        window.dossiersChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: types,
                datasets: [{
                    data: values,
                    backgroundColor: backgroundColors,
                    borderColor: borderColors,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true
            }
        });
        
        console.log('Graphique de répartition par type créé avec succès');
    } catch (error) {
        console.error('Erreur lors de la création du graphique de répartition:', error);
    }
}

// Exposer les fonctions globalement
window.updateCharts = updateCharts;
window.updateRevenueChart = updateRevenueChart;
window.updateDossiersChart = updateDossiersChart;

// Exposer la fonction globalement pour qu'elle soit accessible partout
window.generateInvoiceNumber = generateInvoiceNumber;

// Fonction de nettoyage global après opérations sur les factures
function resetApplicationState() {
    console.log('Réinitialisation avancée de l\'état de l\'application...');
    
    // 1. Fermer toutes les modales
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.style.display = 'none';
    });
    
    // 2. Solution Electron: Obtenir la fenêtre courante et la forcer à se rafraîchir
    try {
        // Attendre un petit délai pour que toutes les opérations se terminent
        setTimeout(() => {
            // Utiliser l'API Electron
            if (window.require) {
                const { remote } = window.require('electron');
                if (remote) {
                    const currentWindow = remote.getCurrentWindow();
                    
                    // Option 1: Simuler un redimensionnement (équivalent à minimiser/maximiser)
                    const bounds = currentWindow.getBounds();
                    const tempBounds = { ...bounds, width: bounds.width - 1 };
                    currentWindow.setBounds(tempBounds);
                    setTimeout(() => {
                        currentWindow.setBounds(bounds);
                    }, 10);
                    
                    console.log('Rafraîchissement automatique via API Electron effectué');
                }
            } else {
                // Fallback pour les navigateurs sans Electron
                console.log('API Electron non disponible, utilisation de méthodes alternatives');
                
                // Forcer un rafraîchissement du DOM
                document.body.style.display = 'none';
                setTimeout(() => {
                    document.body.style.display = '';
                    
                    // Recréer le bouton de création
                    const createBtn = document.getElementById('createInvoiceBtn');
                    if (createBtn) {
                        const newBtn = createBtn.cloneNode(true);
                        createBtn.parentNode.replaceChild(newBtn, createBtn);
                        
                        // Réattacher l'événement
                        newBtn.addEventListener('click', function() {
                            if (typeof openInvoiceModal === 'function') {
                                openInvoiceModal();
                            }
                        });
                    }
                }, 10);
            }
        }, 150); // Délai plus long pour être sûr que tout est terminé
    } catch (e) {
        console.error('Erreur lors du rafraîchissement automatique:', e);
    }
}

// Exposer globalement
window.resetApplicationState = resetApplicationState;

// Fonction de diagnostic des factures

function diagnosticInvoices() {
    console.log('=== DIAGNOSTIC DES FACTURES ===');
    
    // Vérifier les variables globales
    console.log('window.invoices:', window.invoices ? window.invoices.length : 'undefined');
    console.log('window.invoicesPath:', window.invoicesPath);
    
    // Vérifier le fichier
    try {
        const fs = window.fs;
        if (fs && window.invoicesPath) {
            const exists = fs.existsSync(window.invoicesPath);
            console.log('Le fichier existe:', exists);
            
            if (exists) {
                const content = fs.readFileSync(window.invoicesPath, 'utf8');
                console.log('Taille du contenu:', content ? content.length : 0);
                console.log('Début du contenu:', content ? content.substring(0, 100) + '...' : 'vide');
            }
        }
    } catch (e) {
        console.error('Erreur de diagnostic:', e);
    }
}

// Pour utiliser dans la console du navigateur
window.diagnosticInvoices = diagnosticInvoices;

// Ajouter cette fonction pour diagnostiquer et corriger le problème

// Fonction de diagnostic et réparation du système de sauvegarde
function repairInvoiceSystem() {
    console.log('=== DIAGNOSTIC ET RÉPARATION DU SYSTÈME DE FACTURES ===');
    
    try {
        // 1. Vérifier les modules nécessaires
        const fs = window.fs;
        if (!fs) {
            console.error('Module fs non disponible!');
            return false;
        }
        
        // 2. Vérifier les chemins
        const invoicesPath = window.invoicesPath;
        if (!invoicesPath) {
            console.error('Chemin des factures non défini!');
            return false;
        }
        
        console.log('Chemin de sauvegarde:', invoicesPath);
        
        // 3. Vérifier l'existence du fichier
        const fileExists = fs.existsSync(invoicesPath);
        console.log('Le fichier existe:', fileExists);
        
        // 4. Vérifier les données en mémoire
        console.log('Factures en mémoire:', window.invoices ? window.invoices.length : 'non définies');
        
        // 5. Forcer la sauvegarde avec des données de test si nécessaire
        if (!window.invoices || window.invoices.length === 0) {
            // Créer une facture de test
            const testInvoice = {
                number: 'TEST-01',
                client: {
                    numeroDossier: 'TEST',
                    nom: 'Client Test',
                    prenom: 'Diagnostic'
                },
                date: new Date().toISOString(),
                prestations: [{description: 'Test de sauvegarde', amount: 100}],
                totalHT: 100,
                totalTTC: 120,
                status: 'sent'
            };
            
            // Ajouter la facture de test
            window.invoices = window.invoices || [];
            window.invoices.push(testInvoice);
            console.log('Facture de test créée');
        }
        
        // 6. Tester l'écriture directe dans le fichier
        const jsonData = JSON.stringify(window.invoices, null, 2);
        console.log(`Données à sauvegarder (${jsonData.length} caractères)`);
        
        // Essayer d'écrire dans un fichier temporaire d'abord
        const tempPath = invoicesPath + '.tmp';
        fs.writeFileSync(tempPath, jsonData);
        console.log('Sauvegarde dans fichier temporaire réussie');
        
        // Puis remplacer le fichier principal
        fs.renameSync(tempPath, invoicesPath);
        console.log('Fichier principal mis à jour avec succès');
        
        // 7. Relire le fichier pour vérifier
        const readData = fs.readFileSync(invoicesPath, 'utf8');
        const parsedData = JSON.parse(readData);
        console.log(`Vérification: ${parsedData.length} factures lues du fichier`);
        
        alert(`Réparation réussie! ${parsedData.length} factures sauvegardées.`);
        return true;
    } catch (error) {
        console.error('Erreur lors de la réparation:', error);
        alert('Erreur: ' + error.message);
        return false;
    }
}

// Exposer la fonction
window.repairInvoiceSystem = repairInvoiceSystem;

// Ajouter cette fonction et l'appeler au démarrage

function ensureChartsAreLoaded() {
    console.log('Vérification des graphiques...');
    
    // Vérifier que Chart.js est bien chargé
    if (typeof Chart === 'undefined') {
        console.error('ERREUR: Chart.js n\'est pas chargé!');
        
        // Tenter de charger Chart.js dynamiquement
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        script.onload = function() {
            console.log('Chart.js chargé dynamiquement avec succès');
            // Réessayer de mettre à jour les graphiques
            if (typeof updateCharts === 'function') {
                setTimeout(updateCharts, 100);
            }
        };
        document.head.appendChild(script);
        return;
    }
    
    console.log('Chart.js est correctement chargé');
    
    // Vérifier que les éléments canvas existent
    const revenueCanvas = document.getElementById('revenueChart');
    const dossiersCanvas = document.getElementById('dossiersChart');
    
    if (!revenueCanvas) {
        console.error('Canvas #revenueChart introuvable!');
    }
    
    if (!dossiersCanvas) {
        console.error('Canvas #dossiersChart introuvable!');
    }
    
    // Si tout est bon, mettre à jour les graphiques
    if (revenueCanvas && dossiersCanvas && typeof updateCharts === 'function') {
        updateCharts();
    }
}

// Modifier le gestionnaire DOMContentLoaded pour l'inclure
document.addEventListener('DOMContentLoaded', function() {
    // ... code existant ...
    
    // Initialisation des graphiques après un délai plus long
    setTimeout(function() {
        console.log('Initialisation des graphiques...');
        
        if (typeof updateCharts === 'function') {
            try {
                updateCharts();
                console.log('Graphiques initialisés avec succès');
            } catch (error) {
                console.error('Erreur lors de l\'initialisation des graphiques:', error);
                // Tentative de récupération
                setTimeout(updateCharts, 500);
            }
        } else {
            console.error('Fonction updateCharts non disponible');
        }
    }, 1000);
    
    // Après le chargement des factures et la mise à jour de l'interface
    setTimeout(function() {
        console.log('Vérification des graphiques après chargement...');
        ensureChartsAreLoaded();
    }, 1000);
});