// Nouveau fichier pour gérer l'envoi d'emails

// Fonction pour afficher la modal d'envoi d'email
function showEmailModal(invoiceNumber) {
    // Récupérer les infos de la facture
    const invoice = window.invoices.find(inv => inv.number === invoiceNumber);
    if (!invoice) {
        alert('Facture non trouvée');
        return;
    }
    
    // Stocker le numéro de facture dans le formulaire
    document.getElementById('invoiceNumberForEmail').value = invoiceNumber;
    
    // Préremplir l'adresse email du client si disponible
    const emailInput = document.getElementById('emailTo');
    if (invoice.client && invoice.client.email) {
        emailInput.value = invoice.client.email;
    } else {
        emailInput.value = '';
    }
    
    // Personnaliser l'objet de l'email
    const clientPrenom = invoice.client && invoice.client.prenom ? invoice.client.prenom : '';
    const clientNom = invoice.client && invoice.client.nom ? invoice.client.nom : '';
    document.getElementById('emailSubject').value = `Note d'honoraire - ${clientNom} ${clientPrenom} - Maître Candice ROVERA`;
    
    // Créer le message avec le format spécifié
    const totalTTC = invoice.totalTTC || (invoice.totalHT * 1.2);
    
    const emailMessage = `Cher(e) ${clientPrenom} ${clientNom},

Veuillez trouver ci-joint ma note d'honoraire d'un montant de ${totalTTC.toFixed(2)} € TTC, dont je vous remercie par avance pour le règlement.

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

    // Définir le message dans le formulaire
    document.getElementById('emailMessage').value = emailMessage;
    
    // Afficher la modal
    document.getElementById('emailModal').style.display = 'flex';
}

// Fonction pour générer un PDF de la facture
async function generateInvoicePDF(invoiceNumber) {
    try {
        // Récupérer les données de la facture
        const invoice = window.invoices.find(inv => inv.number === invoiceNumber);
        if (!invoice) throw new Error('Facture non trouvée');
        
        // Importer jsPDF si ce n'est pas déjà fait
        if (!window.jspdf) {
            console.error('jsPDF n\'est pas chargé');
            return null;
        }
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // En-tête de la facture
        doc.setFontSize(18);
        doc.text('Me Candice ROVERA', 20, 20);
        
        doc.setFontSize(12);
        doc.text('Avocat au Barreau de Paris', 20, 30);
        doc.text('SIRET : 98302483700020', 20, 35);
        doc.text('TVA Intracommunautaire : FR13983024837', 20, 40);
        
        // Informations de la facture
        doc.setFontSize(14);
        doc.text(`Facture N° ${invoice.number}`, 20, 55);
        doc.text(`Date : ${new Date(invoice.date).toLocaleDateString('fr-FR')}`, 20, 62);
        
        // Informations du client
        if (invoice.client) {
            doc.text(`Client : ${invoice.client.nom} ${invoice.client.prenom}`, 20, 75);
            if (invoice.client.adresse) {
                doc.text(`Adresse : ${invoice.client.adresse}`, 20, 82);
            }
        }
        
        // Tableau des prestations
        let y = 100;
        doc.line(20, y, 190, y);
        y += 10;
        
        doc.text('Description', 25, y);
        doc.text('Montant HT', 150, y);
        
        y += 5;
        doc.line(20, y, 190, y);
        y += 10;
        
        // Liste des prestations
        let totalHT = 0;
        if (invoice.prestations && invoice.prestations.length > 0) {
            invoice.prestations.forEach(prestation => {
                const amount = parseFloat(prestation.amount || 0);
                totalHT += amount;
                
                doc.text(prestation.description, 25, y);
                doc.text(`${amount.toFixed(2)} €`, 150, y);
                y += 10;
            });
        }
        
        y += 5;
        doc.line(20, y, 190, y);
        y += 10;
        
        // Totaux
        const tva = totalHT * 0.2;
        const totalTTC = totalHT + tva;
        
        doc.text('Total HT', 120, y);
        doc.text(`${totalHT.toFixed(2)} €`, 150, y);
        y += 10;
        
        doc.text('TVA (20%)', 120, y);
        doc.text(`${tva.toFixed(2)} €`, 150, y);
        y += 10;
        
        doc.setFontSize(16);
        doc.text('Total TTC', 120, y);
        doc.text(`${totalTTC.toFixed(2)} €`, 150, y);
        
        // Pied de page
        y = 250;
        doc.setFontSize(10);
        doc.text('Me Candice ROVERA - Avocat au Barreau de Paris', 105, y, { align: 'center' });
        
        // Retourner le PDF généré
        return doc.output('blob');
    } catch (error) {
        console.error('Erreur lors de la génération du PDF:', error);
        return null;
    }
}

// Fonction pour envoyer l'email avec la facture
async function sendInvoiceEmail(event) {
    event.preventDefault();
    
    try {
        // Récupérer les valeurs du formulaire
        const invoiceNumber = document.getElementById('invoiceNumberForEmail').value;
        const toEmail = document.getElementById('emailTo').value;
        const subject = document.getElementById('emailSubject').value;
        const message = document.getElementById('emailMessage').value;
        const attachPDF = document.getElementById('attachPDF').checked;
        
        // Vérifier les champs requis
        if (!invoiceNumber || !toEmail) {
            alert('Veuillez remplir tous les champs requis');
            return;
        }
        
        // Afficher un indicateur de chargement
        const submitBtn = event.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Envoi en cours...';
        
        // Préparer les données pour l'email
        let attachmentData = null;
        
        if (attachPDF) {
            // Générer le PDF de la facture
            const pdfBlob = await generateInvoicePDF(invoiceNumber);
            if (pdfBlob) {
                // Convertir le Blob en base64
                const reader = new FileReader();
                const pdfBase64 = await new Promise((resolve) => {
                    reader.onload = () => resolve(reader.result.split(',')[1]);
                    reader.readAsDataURL(pdfBlob);
                });
                
                attachmentData = {
                    filename: `Facture_${invoiceNumber}.pdf`,
                    content: pdfBase64,
                    encoding: 'base64'
                };
            }
        }
        
        // Récupérer les données de configuration
        const fromEmail = window.emailConfig ? window.emailConfig.email : document.getElementById('emailFrom').value;
        const appPassword = window.emailConfig ? window.emailConfig.appPassword : '';

        // Préparer les données de l'email
        const emailData = {
            from: fromEmail,
            to: toEmail,
            subject: subject,
            text: message,
            password: appPassword,
            attachments: attachPDF && attachmentData ? [attachmentData] : []
        };
        
        // Envoyer l'email via le backend
        // Pour Electron, nous utilisons l'IPC pour communiquer avec le processus principal
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            
            ipcRenderer.send('send-email', emailData);
            
            ipcRenderer.once('email-sent', (event, response) => {
                if (response.success) {
                    alert('Email envoyé avec succès !');
                    
                    // Fermer la modal
                    closeEmailModal();
                    
                    // Mettre à jour le statut de la facture à "sent"
                    if (typeof updateInvoiceStatus === 'function') {
                        updateInvoiceStatus(invoiceNumber, 'sent');
                    }
                    
                    // Forcer le rafraîchissement de la fenêtre comme pour la suppression
                    setTimeout(() => {
                        if (typeof forceWindowRefresh === 'function') {
                            forceWindowRefresh();
                        }
                    }, 200);
                } else {
                    alert(`Erreur lors de l'envoi de l'email : ${response.error}`);
                }
                
                // Restaurer le bouton
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            });
        } else {
            // Si on n'est pas dans Electron, afficher un message d'erreur
            alert('L\'envoi d\'emails n\'est pas disponible dans cette version de l\'application');
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    } catch (error) {
        console.error('Erreur lors de l\'envoi de l\'email:', error);
        alert(`Une erreur est survenue : ${error.message}`);
        
        // Restaurer le bouton
        const submitBtn = event.target.querySelector('button[type="submit"]');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Envoyer';
    }
}

// Fonction améliorée pour fermer la modal d'email et restaurer l'état de l'application
function closeEmailModal() {
    // Fermer la modal
    const emailModal = document.getElementById('emailModal');
    if (emailModal) {
        emailModal.style.display = 'none';
    }
    
    // Réinitialiser les champs du formulaire
    const emailForm = document.getElementById('emailForm');
    if (emailForm) {
        emailForm.reset();
    }
    
    // Restaurer le focus sur le document principal et débloquer l'interface
    document.body.click();
    
    // Éliminer tout overlay qui pourrait rester
    const overlays = document.querySelectorAll('.modal-backdrop');
    overlays.forEach(overlay => overlay.remove());
    
    // S'assurer que le body n'est pas verrouillé
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
    
    // Forcer un redraw pour s'assurer que l'interface est réactive
    setTimeout(() => {
        const forceRedraw = document.body.offsetHeight;
    }, 10);
    
    console.log('Modal email fermée et interface restaurée');
}

// Initialiser les événements
function initEmailManager() {
    const emailForm = document.getElementById('emailForm');
    if (emailForm) {
        emailForm.addEventListener('submit', sendInvoiceEmail);
    }
}

// Exposer les fonctions globalement
window.showEmailModal = showEmailModal;
window.generateInvoicePDF = generateInvoicePDF;
window.sendInvoiceEmail = sendInvoiceEmail;
window.initEmailManager = initEmailManager;
window.closeEmailModal = closeEmailModal;

// Initialiser au chargement
document.addEventListener('DOMContentLoaded', initEmailManager);