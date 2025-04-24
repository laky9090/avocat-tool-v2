// Gestion des factures

const { ipcRenderer } = require('electron');
const { jsPDF } = require("jspdf"); // <-- AJOUTER CETTE LIGNE
let remote;
try {
    remote = require('@electron/remote');
} catch (e) {
    console.error("Erreur: Impossible de charger @electron/remote. Assurez-vous qu'il est installé et initialisé.", e);
    // Fournir un fallback si remote n'est pas disponible
    remote = null;
}

// Fonction pour obtenir le chemin racine de manière fiable
function getAppRootPath() {
    if (remote && remote.app) {
        // Utilise le chemin de l'application fourni par Electron
        return remote.app.getAppPath();
    } else {
        // Fallback (moins fiable, utilise l'ancienne méthode mais log un avertissement)
        console.warn("Utilisation du fallback pour getAppRootPath via __dirname.");
        // Attention: Ce fallback peut encore donner le mauvais chemin C:\Users\dhlla\Downloads\
        // Il faudrait idéalement passer le chemin correct via IPC depuis le processus principal.
        // Assurez-vous que 'path' est disponible (il devrait l'être via window.path)
        if (typeof path !== 'undefined') {
             return path.resolve(__dirname, '..');
        } else {
             console.error("ERREUR CRITIQUE: Module 'path' non disponible pour le fallback de getAppRootPath !");
             // Retourner une valeur par défaut ou lever une erreur plus explicite
             return 'CHEMIN_RACINE_INCONNU'; // Ou null, ou lever une erreur
        }
    }
}

// Remplacer la fonction handleInvoiceSubmission
function handleInvoiceSubmission(event) {
    event.preventDefault();

    try {
        // Récupérer les données du formulaire
        const data = getFormData();
        if (!data) return;

        // Générer un numéro de facture unique
        const invoiceNumber = generateInvoiceNumber(data.client.numeroDossier);
        if (!invoiceNumber) {
            throw new Error("Impossible de générer un numéro de facture.");
        }

        // Créer l'objet facture
        const invoice = {
            number: invoiceNumber,
            client: data.client, // Contient nom, prenom, numeroDossier, etc.
            date: new Date().toISOString(),
            prestations: data.prestations,
            totalHT: data.totalHT,
            totalTTC: data.totalHT * 1.2, // TVA 20%
            status: 'sent' // Par défaut
        };

        // --- Début Génération PDF ---
        try {
            console.log('Début de la génération du PDF...');

            // --- NOUVELLE LOGIQUE - À AJOUTER ---
            // 1. Obtenir le chemin racine de l'application
            const appRootPath = getAppRootPath();
            console.log(`Chemin racine de l'application détecté: ${appRootPath}`); // LOG AJOUTÉ

            const baseDossiersPath = path.join(appRootPath, 'Dossiers en cours');
            const clientFolderName = `${invoice.client.nom}_${invoice.client.prenom}`
                                        .replace(/[^a-zA-Z0-9_]/g, '_');
            const facturesSubDir = '2-Factures'; // Le sous-dossier spécifique

            // Chemin complet vers le dossier où enregistrer la facture PDF
            const clientFacturesPath = path.join(baseDossiersPath, clientFolderName, facturesSubDir);
            // --- FIN NOUVELLE LOGIQUE ---

            // 2. S'assurer que le répertoire de base et celui du client existent
            if (!fs.existsSync(clientFacturesPath)) { // Utilise le nouveau chemin complet
                fs.mkdirSync(clientFacturesPath, { recursive: true });
                console.log(`Arborescence créée ou existante jusqu'à: ${clientFacturesPath}`);
            } else {
                 console.log(`Arborescence existe jusqu'à: ${clientFacturesPath}`);
            }

            // 3. Définir le nom et chemin complet du fichier PDF
            const pdfFileName = `Facture_${invoice.number}.pdf`;
            const pdfFilePath = path.join(clientFacturesPath, pdfFileName); // Utilise le nouveau chemin

            // 4. Générer le contenu du PDF avec jsPDF
            const doc = new jsPDF();
            const pageHeight = doc.internal.pageSize.height;
            const pageWidth = doc.internal.pageSize.width;
            const margin = 15; // Ou la valeur souhaitée
            // --- Début Contenu PDF ---

            // A. En-tête
            const logoPath = path.join(appRootPath, 'logo_candice.png'); // Assurez-vous que le logo est à la racine du projet
            const logoWidth = 30; // Largeur du logo en mm
            const logoHeight = 15; // Hauteur du logo en mm (ajuster selon l'aspect ratio)
            if (fs.existsSync(logoPath)) {
                try {
                    const imgData = fs.readFileSync(logoPath); // Lire l'image
                    // Convertir en Base64 pour jsPDF (plus fiable que le chemin direct)
                    const base64Img = Buffer.from(imgData).toString('base64');
                    doc.addImage(base64Img, 'PNG', margin, margin, logoWidth, logoHeight);
                } catch (imgError) {
                    console.error("Erreur lors du chargement/ajout du logo:", imgError);
                    // Optionnel: Ajouter un texte de remplacement si le logo échoue
                    doc.setFontSize(10);
                    doc.text("Logo non chargé", margin, margin + 5);
                }
            } else {
                console.warn(`Logo non trouvé à l'emplacement: ${logoPath}`);
                doc.setFontSize(10);
                doc.text("Logo manquant", margin, margin + 5);
            }

            // B. Coordonnées Avocate (sous le logo, aligné à gauche)
            let yPos = margin + logoHeight + 10; // Position Y initiale sous le logo
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('Maître Candice ROVERA', margin, yPos); // Placeholder
            doc.setFont('helvetica', 'normal');
            yPos += 5;
            doc.text('Avocate au Barreau de Paris', margin, yPos); // Placeholder
            yPos += 5;
            doc.text('123 Rue de la Loi, 75001 Paris', margin, yPos); // Placeholder
            yPos += 5;
            doc.text('TVA Intra: FR13983024837', margin, yPos); // Placeholder (si applicable)

            // C. Coordonnées Client (aligné à droite)
            yPos = margin + 10; // Réinitialiser Y pour l'alignement à droite
            const clientStartX = pageWidth - margin - 70; // Position X pour le bloc client (ajuster la largeur 70mm)
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('Client:', clientStartX, yPos);
            doc.setFont('helvetica', 'normal');
            yPos += 5;
            doc.text(`${invoice.client.nom} ${invoice.client.prenom}`, clientStartX, yPos);
            // Ajouter adresse client si disponible
            if (invoice.client.adresse) {
                yPos += 5;
                doc.text(invoice.client.adresse, clientStartX, yPos);
            }
            if (invoice.client.codePostal || invoice.client.ville) {
                yPos += 5;
                doc.text(`${invoice.client.codePostal || ''} ${invoice.client.ville || ''}`, clientStartX, yPos);
            }

            // D. Bloc d'information facture (sous les coordonnées)
            yPos = Math.max(margin + logoHeight + 30, yPos + 15); // Position Y sous le plus bas des deux blocs
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text(`FACTURE N° : ${invoice.number}`, margin, yPos);
            doc.setFont('helvetica', 'normal');
            yPos += 7;
            doc.setFontSize(10);
            doc.text(`Date d'émission : ${new Date(invoice.date).toLocaleDateString('fr-FR')}`, margin, yPos);
            yPos += 5;
            doc.text(`Référence dossier : ${invoice.client.numeroDossier}`, margin, yPos);
            yPos += 5;
            // Objet: Utiliser la première prestation ou un texte générique
            const objet = invoice.prestations.length > 0 ? `Objet : ${invoice.prestations[0].description.substring(0, 50)}${invoice.prestations[0].description.length > 50 ? '...' : ''}` : 'Objet : Prestations juridiques';
            doc.text(objet, margin, yPos);

            // E. Tableau récapitulatif
            yPos += 15; // Espace avant le tableau
            const tableHeaders = ['Description', 'Prix HT (€)', 'Taux TVA (%)'];
            const colWidths = [pageWidth * 0.55, pageWidth * 0.15, pageWidth * 0.15]; // Ajuster les largeurs
            const tableStartX = margin;
            const tableHeaderY = yPos;
            const tableRowHeight = 7; // Hauteur de ligne
            const vatRate = 20; // Taux TVA fixe

            // En-têtes du tableau
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setFillColor(230, 230, 230); // Gris clair pour l'en-tête
            doc.rect(tableStartX, tableHeaderY, colWidths.reduce((a, b) => a + b), tableRowHeight, 'F');
            doc.text(tableHeaders[0], tableStartX + 2, tableHeaderY + tableRowHeight - 2);
            doc.text(tableHeaders[1], tableStartX + colWidths[0] + colWidths[1] / 2, tableHeaderY + tableRowHeight - 2, { align: 'center' });
            doc.text(tableHeaders[2], tableStartX + colWidths[0] + colWidths[1] + colWidths[2] / 2, tableHeaderY + tableRowHeight - 2, { align: 'center' });
            yPos += tableRowHeight;

            // Lignes du tableau
            doc.setFont('helvetica', 'normal');
            doc.setLineWidth(0.1);
            invoice.prestations.forEach((p, index) => {
                const descriptionLines = doc.splitTextToSize(p.description, colWidths[0] - 4); // Texte avec marge
                const rowHeight = descriptionLines.length * (doc.getLineHeight() / doc.internal.scaleFactor) + 4; // Hauteur dynamique

                // Vérifier si la ligne dépasse la page
                if (yPos + rowHeight > pageHeight - margin - 30) { // 30mm pour les totaux et le pied de page
                    doc.addPage();
                    yPos = margin;
                    // Redessiner l'en-tête du tableau sur la nouvelle page si nécessaire
                    doc.setFontSize(10);
                    doc.setFont('helvetica', 'bold');
                    doc.setFillColor(230, 230, 230);
                    doc.rect(tableStartX, yPos, colWidths.reduce((a, b) => a + b), tableRowHeight, 'F');
                    doc.text(tableHeaders[0], tableStartX + 2, yPos + tableRowHeight - 2);
                    doc.text(tableHeaders[1], tableStartX + colWidths[0] + colWidths[1] / 2, yPos + tableRowHeight - 2, { align: 'center' });
                    doc.text(tableHeaders[2], tableStartX + colWidths[0] + colWidths[1] + colWidths[2] / 2, yPos + tableRowHeight - 2, { align: 'center' });
                    yPos += tableRowHeight;
                    doc.setFont('helvetica', 'normal');
                }

                // Dessiner les bordures de la ligne
                doc.line(tableStartX, yPos, tableStartX, yPos + rowHeight); // Gauche
                doc.line(tableStartX + colWidths[0], yPos, tableStartX + colWidths[0], yPos + rowHeight); // Milieu 1
                doc.line(tableStartX + colWidths[0] + colWidths[1], yPos, tableStartX + colWidths[0] + colWidths[1], yPos + rowHeight); // Milieu 2
                doc.line(tableStartX + colWidths[0] + colWidths[1] + colWidths[2], yPos, tableStartX + colWidths[0] + colWidths[1] + colWidths[2], yPos + rowHeight); // Droite
                doc.line(tableStartX, yPos + rowHeight, tableStartX + colWidths.reduce((a, b) => a + b), yPos + rowHeight); // Bas

                // Ajouter le texte
                doc.text(descriptionLines, tableStartX + 2, yPos + 4);
                doc.text(p.amount.toFixed(2), tableStartX + colWidths[0] + colWidths[1] / 2, yPos + 4 + (rowHeight - tableRowHeight)/2, { align: 'center' });
                doc.text(vatRate.toFixed(0) + '%', tableStartX + colWidths[0] + colWidths[1] + colWidths[2] / 2, yPos + 4 + (rowHeight - tableRowHeight)/2, { align: 'center' });

                yPos += rowHeight;
            });

            // F. Totaux (alignés à droite, sous le tableau)
            yPos = Math.max(yPos + 10, pageHeight - margin - 30); // Positionner en bas ou sous le tableau
            const totalsStartX = tableStartX + colWidths[0]; // Aligner avec la 2ème colonne
            const totalsValueX = tableStartX + colWidths.reduce((a, b) => a + b); // Aligner à droite du tableau

            doc.setFontSize(10);
            doc.text('Total HT :', totalsStartX, yPos, { align: 'right' });
            doc.text(`${invoice.totalHT.toFixed(2)} €`, totalsValueX, yPos, { align: 'right' });
            yPos += tableRowHeight;

            doc.text(`TVA (${vatRate}%) :`, totalsStartX, yPos, { align: 'right' });
            doc.text(`${(invoice.totalHT * (vatRate / 100)).toFixed(2)} €`, totalsValueX, yPos, { align: 'right' });
            yPos += tableRowHeight;

            doc.setFont('helvetica', 'bold');
            doc.text('Total TTC :', totalsStartX, yPos, { align: 'right' });
            doc.text(`${invoice.totalTTC.toFixed(2)} €`, totalsValueX, yPos, { align: 'right' });
            doc.setFont('helvetica', 'normal');

            // G. Pied de page (centré en bas)
            const footerY = pageHeight - margin + 5;
            doc.setFontSize(8);
            doc.setTextColor(150); // Gris
            const footerText = `Maître Candice ROVERA - Avocate au Barreau de Paris - SIRET : 98302483700020`; // Placeholder
            doc.text(footerText, pageWidth / 2, footerY, { align: 'center' });

            // --- Fin Contenu PDF ---

            // 5. Sauvegarder le PDF dans le fichier
            const pdfOutput = doc.output('arraybuffer'); // Obtenir le contenu binaire
            fs.writeFileSync(pdfFilePath, Buffer.from(pdfOutput)); // Écrire le buffer dans le fichier

            console.log(`Facture PDF générée avec succès: ${pdfFilePath}`);

        } catch (pdfError) {
            console.error('ERREUR lors de la génération/sauvegarde du PDF:', pdfError);
            // Informer l'utilisateur que le PDF a échoué mais que la facture est créée
            alert(`Facture ${invoiceNumber} créée, mais une erreur est survenue lors de la génération du fichier PDF.\nErreur: ${pdfError.message}`);
            // On continue quand même pour sauvegarder la facture dans le JSON
        }
        // --- Fin Génération PDF ---

        // S'assurer que window.invoices est un tableau
        if (!Array.isArray(window.invoices)) {
            console.warn('window.invoices n\'est pas un tableau, initialisation...');
            window.invoices = [];
        }

        // Ajouter la facture à la liste en mémoire
        window.invoices.push(invoice);
        console.log(`Facture ${invoiceNumber} ajoutée en mémoire`);

        // Sauvegarder la liste des factures (y compris la nouvelle) dans invoices.json
        const saveResult = window.saveInvoicesToFile(); // Utilise la fonction existante
        console.log('Résultat de la sauvegarde JSON:', saveResult ? 'Succès' : 'Échec');
        if (!saveResult) {
             // Si la sauvegarde JSON échoue, on pourrait vouloir annuler ou notifier davantage
             throw new Error("La sauvegarde des données de facturation (JSON) a échoué.");
        }

        // Mettre à jour l'interface (liste, stats, graphiques)
        updateInvoicesList();
        updateFinancialStats();
        updateCharts();

        // Fermer la modale et donner un retour à l'utilisateur
        closeInvoiceModal(); // Assurez-vous que cette fonction existe
        alert(`Facture ${invoiceNumber} créée avec succès.`); // Message simplifié, le PDF est géré dans le bloc try/catch

        // Optionnel: Rafraîchir la fenêtre si nécessaire (peut-être pas utile ici)
        // setTimeout(() => { ... }, 200);

    } catch (error) {
        console.error('Erreur lors de la création de la facture (globale):', error);
        alert('Erreur lors de la création de la facture: ' + error.message);
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
    const confirmation = confirm(`Êtes-vous sûr de vouloir supprimer la facture ${invoiceNumber} ? Cette action supprimera également le fichier PDF associé et est irréversible.`);
    if (!confirmation) {
        return;
    }

    console.log(`Suppression demandée pour la facture : ${invoiceNumber}`);
    const invoiceIndex = window.invoices.findIndex(inv => inv.number === invoiceNumber);

    if (invoiceIndex === -1) {
        alert(`Erreur : Facture ${invoiceNumber} non trouvée.`);
        return;
    }

    const invoiceToDelete = window.invoices[invoiceIndex];
    let fileError = false;
    let saveError = false;

    // --- Logique de suppression du fichier PDF ---
    const appRootPath = getAppRootPath();
    const fs = window.fs;
    const path = window.path;

    if (appRootPath === 'CHEMIN_RACINE_INCONNU' || !fs || !path) {
         console.error("Erreur critique : Impossible de déterminer le chemin racine ou modules fs/path manquants pour supprimer le fichier PDF.");
         fileError = true;
    } else if (invoiceToDelete.client && invoiceToDelete.client.nom && invoiceToDelete.client.prenom) {
        try {
            const baseDossiersPath = path.join(appRootPath, 'Dossiers en cours');
            const clientFolderName = `${invoiceToDelete.client.nom}_${invoiceToDelete.client.prenom}`.replace(/[^a-zA-Z0-9_]/g, '_');
            const facturesSubDir = '2-Factures';
            const pdfFileName = `Facture_${invoiceToDelete.number}.pdf`;
            const pdfFilePath = path.join(baseDossiersPath, clientFolderName, facturesSubDir, pdfFileName);

            if (fs.existsSync(pdfFilePath)) {
                console.log(`Tentative de suppression du fichier : ${pdfFilePath}`);
                fs.unlinkSync(pdfFilePath);
                console.log(`Fichier ${pdfFileName} supprimé avec succès.`);
            } else {
                console.warn(`Le fichier PDF pour la facture ${invoiceToDelete.number} n'a pas été trouvé à l'emplacement ${pdfFilePath}. Suppression de l'entrée uniquement.`);
            }
        } catch (error) {
            console.error(`Erreur lors de la suppression du fichier PDF pour la facture ${invoiceToDelete.number}:`, error);
            fileError = true;
        }
    } else {
        console.warn(`Données client manquantes pour la facture ${invoiceToDelete.number}. Impossible de déterminer le chemin du fichier PDF à supprimer.`);
        fileError = true;
    }
    // --- Fin logique suppression fichier ---

    // Supprimer la facture du tableau en mémoire
    window.invoices.splice(invoiceIndex, 1);

    // Sauvegarder les modifications
    const saveResult = saveInvoicesToFile();
    if (!saveResult) {
        saveError = true;
    }
    console.log('Résultat de la sauvegarde JSON après suppression individuelle:', saveResult ? 'Succès' : 'Échec');

    // Mettre à jour l'interface
    updateInvoicesList(); // Redessine le tableau
    if (typeof updateFinancialStats === 'function') updateFinancialStats();
    if (typeof updateCharts === 'function') updateCharts();
    // Mettre à jour l'UI de sélection au cas où la facture supprimée était sélectionnée
    updateDeleteSelectionUI();

    // Message final
    let message = `Facture ${invoiceNumber} supprimée avec succès.`;
    if (fileError) {
        message += `\nUne erreur est survenue lors de la suppression du fichier PDF associé (voir console pour détails).`;
    }
    if (saveError) {
        message += `\nATTENTION : La sauvegarde des modifications dans le fichier JSON a échoué !`;
    }
    alert(message);
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
        
        // Déclencher l'événement et mettre à jour les statistiques
        document.dispatchEvent(new CustomEvent('invoicesUpdated'));
        if (typeof updateInvoiceStats === 'function') {
            updateInvoiceStats();
        }
        
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
        
        // Mettre à jour les statistiques
        if (typeof updateInvoiceStats === 'function') {
            updateInvoiceStats();
        }
        
        // Déclencher l'événement
        document.dispatchEvent(new CustomEvent('invoicesUpdated'));
    } catch (error) {
        console.error('Erreur lors du chargement des factures:', error);
        window.invoices = [];
    }
}

// Mise à jour de la liste des factures dans l'interface
function updateInvoicesList() {
    const tableBody = document.getElementById('invoicesTableBody');
    const noInvoicesMessage = document.getElementById('noInvoicesMessage');

    if (!tableBody) {
        console.error("ERREUR: Élément #invoicesTableBody non trouvé !");
        return;
    }
    if (!noInvoicesMessage) {
        console.error("ERREUR: Élément #noInvoicesMessage non trouvé !");
    }

    tableBody.innerHTML = '';

    if (noInvoicesMessage) {
        tableBody.appendChild(noInvoicesMessage);
        noInvoicesMessage.style.display = 'none';
    }

    if (!window.invoices || window.invoices.length === 0) {
        if (noInvoicesMessage) {
            noInvoicesMessage.style.display = 'table-row';
        }
        const deleteBtn = document.getElementById('deleteSelectedInvoicesBtn');
        if (deleteBtn) deleteBtn.style.display = 'none';
        const selectAllCheckbox = document.getElementById('selectAllInvoicesCheckbox');
        if (selectAllCheckbox) selectAllCheckbox.checked = false;
        return;
    }

    // --- DÉBUT MODIFICATION TRI ---
    // Utiliser les variables globales pour le tri
    const sortColumn = window.currentSortColumn || 'date'; // 'date' par défaut si non défini
    const sortDirection = window.currentSortDirection || 'desc'; // 'desc' par défaut

    const sortedInvoices = [...window.invoices].sort((a, b) => {
        let valA, valB;

        // Récupérer les valeurs à comparer en fonction de la colonne
        switch (sortColumn) {
            case 'number':
                valA = a.number || '';
                valB = b.number || '';
                break;
            case 'client':
                valA = (a.client ? `${a.client.nom} ${a.client.prenom}` : '').toLowerCase();
                valB = (b.client ? `${b.client.nom} ${b.client.prenom}` : '').toLowerCase();
                break;
            case 'description':
                valA = (a.prestations && a.prestations.length > 0 ? a.prestations[0].description : '').toLowerCase();
                valB = (b.prestations && b.prestations.length > 0 ? b.prestations[0].description : '').toLowerCase();
                break;
            case 'date':
                // Convertir en objets Date pour une comparaison correcte
                valA = a.date ? new Date(a.date) : new Date(0); // Date très ancienne si nulle
                valB = b.date ? new Date(b.date) : new Date(0);
                break;
            case 'totalHT':
                valA = parseFloat(a.totalHT || 0);
                valB = parseFloat(b.totalHT || 0);
                break;
            case 'totalTTC':
                valA = parseFloat(a.totalTTC || 0);
                valB = parseFloat(b.totalTTC || 0);
                break;
            case 'status':
                valA = a.status || '';
                valB = b.status || '';
                break;
            default:
                // Si colonne inconnue, ne pas trier (ou trier par défaut)
                return 0;
        }

        // Comparaison
        let comparison = 0;
        if (valA > valB) {
            comparison = 1;
        } else if (valA < valB) {
            comparison = -1;
        }

        // Inverser si direction descendante
        return (sortDirection === 'desc') ? (comparison * -1) : comparison;
    });
    // --- FIN MODIFICATION TRI ---

    sortedInvoices.forEach(invoice => {
        // --- MODIFIER L'INSERTION DE LIGNE ---
        // Insérer à la fin pour respecter l'ordre du tableau trié
        const row = tableBody.insertRow();
        // --- FIN MODIFICATION INSERTION ---
        row.setAttribute('data-invoice-number', invoice.number);

        // 1. Case à cocher
        const cellCheckbox = row.insertCell();
        cellCheckbox.innerHTML = `<input type="checkbox" class="invoice-select-checkbox" value="${invoice.number}">`;

        // 2. Numéro
        const cellNumber = row.insertCell();
        cellNumber.textContent = invoice.number || 'N/A';

        // 3. Client
        const cellClient = row.insertCell();
        cellClient.textContent = invoice.client ? `${invoice.client.nom} ${invoice.client.prenom}` : 'Client inconnu';

        // 4. Description
        const cellDescription = row.insertCell();
        const firstPrestationDesc = invoice.prestations && invoice.prestations.length > 0 ? invoice.prestations[0].description : 'N/A';
        cellDescription.textContent = firstPrestationDesc.length > 50 ? firstPrestationDesc.substring(0, 47) + '...' : firstPrestationDesc;
        cellDescription.title = firstPrestationDesc;

        // 5. Date
        const cellDate = row.insertCell();
        cellDate.textContent = invoice.date ? new Date(invoice.date).toLocaleDateString('fr-FR') : 'N/A';

        // 6. Montant HT
        const cellAmountHT = row.insertCell();
        cellAmountHT.textContent = invoice.totalHT ? `${invoice.totalHT.toFixed(2)} €` : 'N/A';
        cellAmountHT.style.textAlign = 'right';

        // 7. Montant TTC
        const cellAmountTTC = row.insertCell();
        cellAmountTTC.textContent = invoice.totalTTC ? `${invoice.totalTTC.toFixed(2)} €` : 'N/A';
        cellAmountTTC.style.textAlign = 'right';

        // 8. Statut
        const cellStatus = row.insertCell();
        cellStatus.innerHTML = `<select class="form-select form-select-sm status-select" data-invoice-number="${invoice.number}">
                                    <option value="draft" ${invoice.status === 'draft' ? 'selected' : ''}>Brouillon</option>
                                    <option value="sent" ${invoice.status === 'sent' ? 'selected' : ''}>Envoyée</option>
                                    <option value="paid" ${invoice.status === 'paid' ? 'selected' : ''}>Payée</option>
                                    <option value="cancelled" ${invoice.status === 'cancelled' ? 'selected' : ''}>Annulée</option>
                                </select>`;
        const statusSelect = cellStatus.querySelector('.status-select');
        if (statusSelect && typeof updateInvoiceStatus === 'function') {
             statusSelect.addEventListener('change', (e) => {
                 updateInvoiceStatus(e.target.dataset.invoiceNumber, e.target.value);
             });
        }

        // 9. Actions
        const cellActions = row.insertCell();
        cellActions.classList.add('actions-cell');
        cellActions.style.textAlign = 'center';
        cellActions.innerHTML = `
            <button class="btn btn-sm btn-outline-primary me-1" onclick="showEmailModalWrapper('${invoice.number}')" title="Envoyer par email">📧</button>
            <button class="btn btn-sm btn-outline-secondary me-1" onclick="viewInvoicePDFWrapper('${invoice.number}')" title="Voir PDF">📄</button>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteInvoice('${invoice.number}')" title="Supprimer">🗑️</button>
        `;
    });

    updateDeleteSelectionUI();
    console.log(`Liste des factures mise à jour et triée par ${sortColumn} (${sortDirection}).`);
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
    console.log("DOM Chargé - Initialisation principale de invoice-manager.js");

    // Charger les factures d'abord (ce qui appelle updateInvoicesList)
    if (typeof loadInvoices === 'function') {
        loadInvoices(); // Cette fonction devrait appeler updateInvoicesList à la fin
    } else {
        console.error("La fonction loadInvoices n'est pas définie !");
        // Essayer d'appeler updateInvoicesList directement au cas où window.invoices serait déjà chargé autrement
        if (typeof updateInvoicesList === 'function') {
            updateInvoicesList();
        }
    }

    // Initialiser le tri par colonne (si la fonction existe)
    if (typeof initSortableTable === 'function') {
        initSortableTable();
    }

    // AJOUTER CET APPEL ICI, après que la liste soit potentiellement chargée et affichée
    setupMultiSelectListeners();

    // Attacher l'écouteur au formulaire de facture
    const invoiceForm = document.getElementById('invoiceForm');
    if (invoiceForm && typeof handleInvoiceSubmission === 'function') {
        invoiceForm.addEventListener('submit', handleInvoiceSubmission);
        console.log('Listener ajouté au formulaire de facture.');
    } else {
        if (!invoiceForm) console.error('Formulaire de facture #invoiceForm non trouvé!');
        if (typeof handleInvoiceSubmission !== 'function') console.error('Fonction handleInvoiceSubmission non trouvée!');
    }

    // Initialisation des graphiques (si les fonctions existent)
    if (typeof updateCharts === 'function' && typeof ensureChartsAreLoaded === 'function') {
        setTimeout(function() {
            console.log('Initialisation différée des graphiques...');
            try {
                updateCharts();
                console.log('Graphiques initialisés avec succès via updateCharts.');
                // Vérification supplémentaire
                setTimeout(ensureChartsAreLoaded, 500);
            } catch (error) {
                console.error('Erreur lors de l\'initialisation des graphiques:', error);
            }
        }, 1500); // Augmenter le délai si nécessaire
    } else {
         console.warn("Fonctions updateCharts ou ensureChartsAreLoaded non disponibles.");
    }

    // Ajouter des wrappers pour les fonctions appelées par onclick si elles ne sont pas globales
    window.showEmailModalWrapper = function(invoiceNumber) {
        if (typeof showEmailModal === 'function') {
            showEmailModal(invoiceNumber);
        } else {
            console.error('Fonction showEmailModal non trouvée.');
        }
    }
    window.viewInvoicePDFWrapper = function(invoiceNumber) {
        if (typeof viewInvoicePDF === 'function') {
            viewInvoicePDF(invoiceNumber);
        } else {
            console.error('Fonction viewInvoicePDF non trouvée.');
        }
    }
     // deleteInvoice est déjà définie globalement dans ce fichier, pas besoin de wrapper normalement

});

// --- AJOUT POUR SÉLECTION/SUPPRESSION MULTIPLE (À METTRE À LA FIN DU FICHIER) ---

// Fonction pour mettre à jour l'UI de sélection multiple
function updateDeleteSelectionUI() {
    const checkboxes = document.querySelectorAll('.invoice-select-checkbox');
    const checkedCheckboxes = document.querySelectorAll('.invoice-select-checkbox:checked');
    const deleteBtn = document.getElementById('deleteSelectedInvoicesBtn');
    const selectAllCheckbox = document.getElementById('selectAllInvoicesCheckbox');
    const countSpan = document.getElementById('selectedInvoiceCount');

    // Vérifier si les éléments existent avant de les manipuler
    if (deleteBtn && countSpan) {
        if (checkedCheckboxes.length > 0) {
            deleteBtn.style.display = 'inline-block'; // Afficher le bouton
            countSpan.textContent = checkedCheckboxes.length; // Mettre à jour le compteur
        } else {
            deleteBtn.style.display = 'none'; // Cacher le bouton
        }
    }

    if (selectAllCheckbox) {
        // Mettre à jour l'état de "Tout sélectionner"
        selectAllCheckbox.checked = checkboxes.length > 0 && checkedCheckboxes.length === checkboxes.length;
        // Indeterminate si certains mais pas tous sont cochés
        selectAllCheckbox.indeterminate = checkedCheckboxes.length > 0 && checkedCheckboxes.length < checkboxes.length;
    }
}

// Fonction pour gérer la suppression multiple
async function handleDeleteSelectedInvoices() {
    const checkedCheckboxes = document.querySelectorAll('.invoice-select-checkbox:checked');
    const invoiceNumbersToDelete = Array.from(checkedCheckboxes).map(cb => cb.value);

    if (invoiceNumbersToDelete.length === 0) {
        alert("Aucune facture sélectionnée.");
        return;
    }

    const confirmation = confirm(`Êtes-vous sûr de vouloir supprimer définitivement ${invoiceNumbersToDelete.length} facture(s) ? Cette action supprimera également les fichiers PDF associés et est irréversible.`);

    if (!confirmation) {
        return;
    }

    console.log(`Suppression demandée pour les factures : ${invoiceNumbersToDelete.join(', ')}`);
    let deletedCount = 0;
    let fileErrors = 0;
    let saveError = false;
    const invoicesToKeep = []; // On va reconstruire la liste

    const appRootPath = getAppRootPath(); // Obtenir le chemin racine une seule fois
    const fs = window.fs; // Accéder à fs via window
    const path = window.path; // Accéder à path via window

    if (appRootPath === 'CHEMIN_RACINE_INCONNU' || !fs || !path) {
         alert("Erreur critique : Impossible de déterminer le chemin racine ou modules fs/path manquants pour supprimer les fichiers PDF.");
         return;
    }

    for (const invoice of window.invoices) {
        if (invoiceNumbersToDelete.includes(invoice.number)) {
            // Cette facture doit être supprimée
            console.log(`Traitement de la suppression pour ${invoice.number}...`);

            // 1. Supprimer le fichier PDF associé
            if (invoice.client && invoice.client.nom && invoice.client.prenom) {
                try {
                    const baseDossiersPath = path.join(appRootPath, 'Dossiers en cours');
                    const clientFolderName = `${invoice.client.nom}_${invoice.client.prenom}`.replace(/[^a-zA-Z0-9_]/g, '_');
                    const facturesSubDir = '2-Factures';
                    const pdfFileName = `Facture_${invoice.number}.pdf`;
                    const pdfFilePath = path.join(baseDossiersPath, clientFolderName, facturesSubDir, pdfFileName);

                    if (fs.existsSync(pdfFilePath)) {
                        console.log(`Tentative de suppression du fichier : ${pdfFilePath}`);
                        fs.unlinkSync(pdfFilePath); // Supprime le fichier
                        console.log(`Fichier ${pdfFileName} supprimé avec succès.`);
                    } else {
                        console.warn(`Le fichier PDF pour la facture ${invoice.number} n'a pas été trouvé à l'emplacement ${pdfFilePath}. Suppression de l'entrée uniquement.`);
                    }
                } catch (error) {
                    console.error(`Erreur lors de la suppression du fichier PDF pour la facture ${invoice.number}:`, error);
                    fileErrors++;
                }
            } else {
                console.warn(`Données client manquantes pour la facture ${invoice.number}. Impossible de déterminer le chemin du fichier PDF à supprimer.`);
                fileErrors++;
            }

            deletedCount++;
        } else {
            // Cette facture doit être conservée
            invoicesToKeep.push(invoice);
        }
    }

    // Mettre à jour la liste globale des factures
    window.invoices = invoicesToKeep;

    // Sauvegarder les modifications dans le fichier JSON
    const saveResult = saveInvoicesToFile();
    if (!saveResult) {
        saveError = true;
    }
    console.log('Résultat de la sauvegarde JSON après suppression multiple:', saveResult ? 'Succès' : 'Échec');

    // Mettre à jour l'interface utilisateur
    updateInvoicesList(); // Redessine le tableau
    if (typeof updateFinancialStats === 'function') updateFinancialStats(); // Mettre à jour les stats si la fonction existe
    if (typeof updateCharts === 'function') updateCharts(); // Mettre à jour les graphiques si la fonction existe

    // Réinitialiser l'UI de sélection
    const selectAllCheckbox = document.getElementById('selectAllInvoicesCheckbox');
    if (selectAllCheckbox) selectAllCheckbox.checked = false;
    updateDeleteSelectionUI(); // Cache le bouton et met à jour le compteur (qui sera à 0)

    // Message final
    let message = `${deletedCount} facture(s) supprimée(s) avec succès.`;
    if (fileErrors > 0) {
        message += `\n${fileErrors} erreur(s) lors de la suppression des fichiers PDF associés (voir console pour détails).`;
    }
    if (saveError) {
        message += `\nATTENTION : La sauvegarde des modifications dans le fichier JSON a échoué !`;
    }
    alert(message);
}

// Fonction pour ajouter les écouteurs d'événements pour la sélection multiple
function setupMultiSelectListeners() {
    const tableBody = document.getElementById('invoicesTableBody');
    const selectAllCheckbox = document.getElementById('selectAllInvoicesCheckbox');
    const deleteBtn = document.getElementById('deleteSelectedInvoicesBtn');

    // Écouteur sur le corps du tableau pour les cases individuelles (délégation)
    if (tableBody) {
        tableBody.addEventListener('change', (event) => {
            if (event.target.classList.contains('invoice-select-checkbox')) {
                updateDeleteSelectionUI();
            }
        });
    } else {
        console.error("Élément #invoicesTableBody non trouvé pour attacher l'écouteur de changement.");
    }

    // Écouteur sur la case "Tout sélectionner"
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', (event) => {
            const isChecked = event.target.checked;
            const checkboxes = document.querySelectorAll('.invoice-select-checkbox');
            checkboxes.forEach(cb => cb.checked = isChecked);
            updateDeleteSelectionUI();
        });
    } else {
        console.error("Élément #selectAllInvoicesCheckbox non trouvé pour attacher l'écouteur.");
    }

    // Écouteur sur le bouton "Supprimer la sélection"
    if (deleteBtn) {
        deleteBtn.addEventListener('click', handleDeleteSelectedInvoices);
    } else {
        console.error("Élément #deleteSelectedInvoicesBtn non trouvé pour attacher l'écouteur.");
    }
    console.log("Écouteurs pour la sélection multiple configurés (ou tentative)."); // Log pour vérifier
}

// --- FIN AJOUT POUR SÉLECTION/SUPPRESSION MULTIPLE ---

// Variables globales pour le tri
window.currentSortColumn = 'date'; // Par défaut, tri par date
window.currentSortDirection = 'desc'; // Par défaut, ordre décroissant

// Initialiser les événements de tri
function initSortableTable() {
    const headers = document.querySelectorAll('#invoicesTable th.sortable');
    headers.forEach(header => {
        header.addEventListener('click', function() {
            const sortBy = this.getAttribute('data-sort');
            
            // Changer la direction si on clique sur la même colonne
            if (sortBy === window.currentSortColumn) {
                window.currentSortDirection = window.currentSortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                window.currentSortColumn = sortBy;
                window.currentSortDirection = 'asc'; // Par défaut, nouveau tri en ordre ascendant
            }
            
            // Mettre à jour les classes sur les en-têtes
            headers.forEach(h => {
                h.classList.remove('sort-asc', 'sort-desc');
            });
            
            this.classList.add(window.currentSortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
            
            // Mettre à jour la liste avec le nouveau tri
            updateInvoicesList();
        });
    });
}

// Exposer globalement
window.initSortableTable = initSortableTable;