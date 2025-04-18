// Ajouter au début du fichier

// Vérifier si la configuration d'email existe déjà
if (!window.emailConfig) {
    console.log('Configuration d\'email non trouvée, tentative de chargement depuis le fichier...');
    
    // Essayer de charger la configuration depuis le fichier
    try {
        if (window.require) {
            const fs = window.require('fs');
            const path = window.require('path');
            const configPath = path.join(__dirname, 'js', 'email-config.js');
            
            if (fs.existsSync(configPath)) {
                console.log('Fichier de configuration trouvé, initialisation...');
                // La configuration sera chargée par le script lui-même
                // Nous n'avons pas besoin de faire autre chose ici
                // Le fichier email-config.js définit window.emailConfig
            } else {
                console.warn('Fichier de configuration non trouvé:', configPath);
                window.emailConfig = {}; // Créer un objet vide pour éviter les erreurs
            }
        }
    } catch (error) {
        console.error('Erreur lors du chargement de la configuration d\'email:', error);
        window.emailConfig = {}; // Créer un objet vide pour éviter les erreurs
    }
}

// Vérifier que la configuration est bien chargée
console.log('État de la configuration d\'email:', 
    window.emailConfig && window.emailConfig.email ? 'OK' : 'Incomplète');

// Variables de verrou pour éviter les envois multiples
let emailSendingInProgress = false;
let lastRequestTimestamp = 0;

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
        doc.text('Avocate au Barreau de Paris', 20, 30); // "Avocat" → "Avocate"
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
        doc.text('Me Candice ROVERA - Avocate au Barreau de Paris', 105, y, { align: 'center' }); // "Avocat" → "Avocate"
        
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
    
    // Protection contre les doubles soumissions
    const now = Date.now();
    if (emailSendingInProgress || (now - lastRequestTimestamp < 2000)) {
        console.log('Envoi déjà en cours ou demande trop rapprochée, ignorée.');
        return;
    }
    
    // Mettre le verrou
    emailSendingInProgress = true;
    lastRequestTimestamp = now;
    
    // Récupérer le bouton de soumission
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.textContent : 'Envoyer';
    
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Envoi en cours...';
    }
    
    try {
        // Déterminer si c'est un email de facture ou de client
        const invoiceNumber = document.getElementById('invoiceNumberForEmail')?.value;
        const clientId = document.getElementById('clientIdForEmail')?.value;
        const isClientEmail = !invoiceNumber && clientId;
        
        // Récupérer les valeurs du formulaire
        const toEmail = document.getElementById('emailTo').value;
        const subject = document.getElementById('emailSubject').value;
        const message = document.getElementById('emailMessage').value;
        const attachPDF = document.getElementById('attachPDF').checked;
        
        // Vérifier les champs requis
        if (!toEmail) {
            alert('Veuillez remplir l\'adresse email');
            return;
        }
        
        // Afficher un indicateur de chargement
        const submitBtn = event.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Envoi en cours...';
        
        // Préparer les pièces jointes
        let attachments = [];

        // Gestion des pièces jointes selon le type (facture ou client)
        if (!isClientEmail && attachPDF) {
            // Code existant pour les factures
            const pdfBlob = await generateInvoicePDF(invoiceNumber);
            if (pdfBlob) {
                // Convertir le Blob en base64
                const reader = new FileReader();
                const pdfBase64 = await new Promise((resolve) => {
                    reader.onload = () => resolve(reader.result.split(',')[1]);
                    reader.readAsDataURL(pdfBlob);
                });
                
                attachments.push({
                    filename: `Facture_${invoiceNumber}.pdf`,
                    content: pdfBase64,
                    encoding: 'base64'
                });
            }
        } 
        else if (isClientEmail && attachPDF) {
            // Nouveau code pour les clients: permettre de sélectionner un fichier
            try {
                const { dialog } = window.require('@electron/remote');
                const result = await dialog.showOpenDialog({
                    properties: ['openFile'],
                    filters: [
                        { name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'jpg', 'png'] }
                    ],
                    title: 'Sélectionner un document à joindre'
                });
                
                if (!result.canceled && result.filePaths.length > 0) {
                    const fs = window.require('fs');
                    const path = window.require('path');
                    const filePath = result.filePaths[0];
                    const fileName = path.basename(filePath);
                    
                    // Lire le fichier
                    const fileContent = fs.readFileSync(filePath);
                    const fileBase64 = Buffer.from(fileContent).toString('base64');
                    
                    attachments.push({
                        filename: fileName,
                        content: fileBase64,
                        encoding: 'base64'
                    });
                }
            } catch (error) {
                console.error('Erreur lors de la sélection du fichier:', error);
                alert("Erreur lors de la sélection du fichier: " + error.message);
            }
        }

        // Ajouter le RIB pour tous les emails (factures et clients)
        try {
            const fs = window.require('fs');
            const path = window.require('path');
            
            // Récupérer le chemin du RIB depuis la configuration
            const ribPath = window.emailConfig && window.emailConfig.ribConfig ? 
                window.emailConfig.ribConfig.path : 
                "assets/rib/rib-candice-rovera.pdf";
            
            const ribFilename = window.emailConfig && window.emailConfig.ribConfig ? 
                window.emailConfig.ribConfig.filename : 
                "RIB_Candice_ROVERA.pdf";
            
            // Chemin absolu du RIB
            const absoluteRibPath = path.join(__dirname, ribPath);
            
            // Vérifier si le fichier existe
            if (fs.existsSync(absoluteRibPath)) {
                // Lire le fichier RIB
                const ribContent = fs.readFileSync(absoluteRibPath);
                
                // Convertir en base64
                const ribBase64 = Buffer.from(ribContent).toString('base64');
                
                // Ajouter à la liste des pièces jointes
                attachments.push({
                    filename: ribFilename,
                    content: ribBase64,
                    encoding: 'base64'
                });
                
                console.log('RIB ajouté à l\'email');
            } else {
                console.warn('Fichier RIB non trouvé à l\'emplacement:', absoluteRibPath);
            }
        } catch (error) {
            console.error('Erreur lors de l\'ajout du RIB:', error);
        }

        // Récupérer les données de configuration
        const fromEmail = window.emailConfig ? window.emailConfig.email : document.getElementById('emailFrom')?.value;
        const appPassword = window.emailConfig ? window.emailConfig.appPassword : '';

        // Vérifier si les données d'envoi d'email sont configurées
        if (!fromEmail || !appPassword) {
            const configurer = confirm(
                'La configuration d\'email n\'est pas complète ou n\'a pas été chargée correctement.\n\n' +
                'Voulez-vous configurer votre email maintenant?\n\n' +
                'Note: Normalement, cette configuration est sauvegardée et ne doit être faite qu\'une seule fois.'
            );
            
            if (configurer) {
                showEmailConfigModal();
            }
            
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
            return;
        }

        // Préparer les données de l'email
        const emailData = {
            from: fromEmail,
            to: toEmail,
            subject: subject,
            text: message,
            password: appPassword,
            attachments: attachments
        };
        
        console.log('Préparation à l\'envoi de l\'email:', { to: emailData.to, subject: emailData.subject, attachmentsCount: emailData.attachments.length });
        
        // Envoyer l'email via le backend
        // Pour Electron, nous utilisons l'IPC pour communiquer avec le processus principal
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            
            ipcRenderer.send('send-email', emailData);

            // Timeout de sécurité pour restaurer le bouton si aucune réponse n'est reçue
            const unlockTimeout = setTimeout(() => {
                console.log('Timeout de sécurité: déverrouillage forcé');
                emailSendingInProgress = false;
                
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalText;
                }
            }, 30000); // 30 secondes max
            
            ipcRenderer.once('email-sent', (event, response) => {
                // Déverrouiller immédiatement
                emailSendingInProgress = false;
                clearTimeout(unlockTimeout);
                
                console.log('Réponse du processus principal:', response);
                
                // Restaurer le bouton et le formulaire IMMÉDIATEMENT
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalText;
                }
                
                // Réinitialiser l'état de soumission du formulaire
                const emailForm = document.getElementById('emailForm');
                if (emailForm) {
                    emailForm.removeAttribute('data-submitting');
                }
                
                if (response.success) {
                    alert('Email envoyé avec succès !');
                    
                    // Fermer la modal APRÈS avoir restauré le bouton
                    closeEmailModal();
                    
                    // Pour les factures: mettre à jour le statut à "sent"
                    if (!isClientEmail && typeof updateInvoiceStatus === 'function') {
                        try {
                            updateInvoiceStatus(invoiceNumber, 'sent');
                        } catch (err) {
                            console.error('Erreur lors de la mise à jour du statut de la facture:', err);
                        }
                    }
                    
                    // Le reste du code...
                } else {
                    alert(`Erreur lors de l'envoi de l'email : ${response.error}`);
                }
            });
        } else {
            // Si on n'est pas dans Electron, afficher un message d'erreur
            alert('L\'envoi d\'emails n\'est pas disponible dans cette version de l\'application');
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    } catch (error) {
        // En cas d'erreur, déverrouiller
        emailSendingInProgress = false;
        
        console.error('Erreur lors de l\'envoi de l\'email:', error);
        alert(`Une erreur est survenue : ${error.message}`);
        
        // Restaurer le bouton
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Envoyer';
        }
    }
}

// Modifier la fonction closeEmailModal

function closeEmailModal() {
    // Réinitialiser explicitement le bouton d'envoi s'il est encore en état "envoi en cours"
    const submitBtn = document.querySelector('#emailForm button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Envoyer';
    }
    
    // Réinitialiser l'attribut de soumission du formulaire
    const emailForm = document.getElementById('emailForm');
    if (emailForm) {
        emailForm.removeAttribute('data-submitting');
        emailForm.reset();
    }
    
    // Fermer la modal
    const emailModal = document.getElementById('emailModal');
    if (emailModal) {
        emailModal.style.display = 'none';
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

// Fonction pour ouvrir la modale de gestion du RIB
function openRibSettings() {
    const ribConfig = window.emailConfig && window.emailConfig.ribConfig ? 
        window.emailConfig.ribConfig : 
        { path: "RIB non configuré", filename: "" };
    
    document.getElementById('currentRibPath').textContent = ribConfig.path;
    document.getElementById('ribSettingsModal').style.display = 'flex';
}

// Fonction pour prévisualiser le RIB actuel
function previewRib() {
    try {
        const fs = window.require('fs');
        const path = window.require('path');
        const { shell } = window.require('electron');
        
        const ribPath = window.emailConfig && window.emailConfig.ribConfig ? 
            window.emailConfig.ribConfig.path : 
            "assets/rib/rib-candice-rovera.pdf";
        
        const absoluteRibPath = path.join(__dirname, ribPath);
        
        if (fs.existsSync(absoluteRibPath)) {
            shell.openPath(absoluteRibPath);
        } else {
            alert('Fichier RIB non trouvé à l\'emplacement: ' + absoluteRibPath);
        }
    } catch (error) {
        console.error('Erreur lors de l\'aperçu du RIB:', error);
        alert('Erreur: ' + error.message);
    }
}

// Fonction pour mettre à jour le RIB
async function updateRib() {
    try {
        const fileInput = document.getElementById('newRibFile');
        
        if (!fileInput.files || fileInput.files.length === 0) {
            alert('Veuillez sélectionner un fichier');
            return;
        }
        
        const file = fileInput.files[0];
        const fs = window.require('fs');
        const path = window.require('path');
        
        // Créer le dossier assets/rib s'il n'existe pas
        const ribDir = path.join(__dirname, 'assets', 'rib');
        if (!fs.existsSync(path.join(__dirname, 'assets'))) {
            fs.mkdirSync(path.join(__dirname, 'assets'));
        }
        if (!fs.existsSync(ribDir)) {
            fs.mkdirSync(ribDir);
        }
        
        // Déterminer l'extension du fichier
        const fileExt = path.extname(file.name);
        const newFileName = 'rib-candice-rovera' + fileExt;
        const newFilePath = path.join(ribDir, newFileName);
        
        // Lire le fichier et le copier
        const content = await readFileAsBuffer(file);
        fs.writeFileSync(newFilePath, content);
        
        // Mettre à jour la configuration
        const relPath = path.join('assets', 'rib', newFileName).replace(/\\/g, '/');
        window.emailConfig.ribConfig = {
            path: relPath,
            filename: `RIB_Candice_ROVERA${fileExt}`
        };
        
        // Sauvegarder la configuration
        saveEmailConfig();
        
        alert('RIB mis à jour avec succès!');
        document.getElementById('ribSettingsModal').style.display = 'none';
    } catch (error) {
        console.error('Erreur lors de la mise à jour du RIB:', error);
        alert('Erreur: ' + error.message);
    }
}

// Fonction pour lire un fichier
function readFileAsBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(Buffer.from(reader.result));
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

// Fonction pour sauvegarder la configuration
function saveEmailConfig() {
    try {
        const fs = window.require('fs');
        const path = window.require('path');
        
        const configPath = path.join(__dirname, 'js', 'email-config.js');
        const configContent = `// Configuration pour l'envoi d'emails
window.emailConfig = ${JSON.stringify(window.emailConfig, null, 2)};

console.log("Configuration email chargée");`;
        
        fs.writeFileSync(configPath, configContent);
        console.log('Configuration email sauvegardée');
    } catch (error) {
        console.error('Erreur lors de la sauvegarde de la configuration:', error);
    }
}

// Modifiez votre fonction showClientEmailModal

function showClientEmailModal(client) {
    // Empêcher l'ouverture si un envoi est en cours
    if (emailSendingInProgress) {
        console.log('Un envoi est en cours, impossible d\'ouvrir une nouvelle fenêtre');
        return;
    }
    
    console.log("Préparation d'email pour le client:", client.nom);
    
    try {
        // Créer un champ caché pour stocker l'ID du client s'il n'existe pas
        if (!document.getElementById('clientIdForEmail')) {
            const hiddenField = document.createElement('input');
            hiddenField.type = 'hidden';
            hiddenField.id = 'clientIdForEmail';
            document.getElementById('emailForm').appendChild(hiddenField);
        }
        
        // Stocker l'ID du client
        document.getElementById('clientIdForEmail').value = client.id || '';
        
        // S'assurer que le champ de numéro de facture est vide
        if (document.getElementById('invoiceNumberForEmail')) {
            document.getElementById('invoiceNumberForEmail').value = '';
        }
        
        // Préremplir l'adresse email du client
        const emailTo = document.getElementById('emailTo');
        if (emailTo) {
            emailTo.value = client.email || '';
        }
        
        // Personnaliser l'objet de l'email
        const emailSubject = document.getElementById('emailSubject');
        if (emailSubject) {
            emailSubject.value = `${client.numeroDossier || ''} - ${client.nom} ${client.prenom || ''} - Maître Candice ROVERA`;
        }
        
        // Créer le contenu du message
        let audienceDate = '';
        if (client.dateAudience) {
            try {
                const date = new Date(client.dateAudience);
                audienceDate = date.toLocaleDateString('fr-FR');
            } catch (error) {
                audienceDate = client.dateAudience;
            }
        }
        
        const emailMessage = `Cher(e) ${client.prenom || ''} ${client.nom},

${client.type && client.role ? `Dans le cadre de la procédure ${client.type} où vous êtes ${client.role}, j'ai le plaisir de vous contacter.` : 'J\'ai le plaisir de vous contacter concernant votre dossier.'}
${client.dateAudience ? `Je vous rappelle que l'audience est prévue le ${audienceDate}.` : ''}

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
        const emailMessageElem = document.getElementById('emailMessage');
        if (emailMessageElem) {
            emailMessageElem.value = emailMessage;
        }
        
        // Décocher la case pour les pièces jointes par défaut pour les clients
        const attachPDF = document.getElementById('attachPDF');
        if (attachPDF) {
            attachPDF.checked = false;
        }
        
        // Afficher la modal
        const emailModal = document.getElementById('emailModal');
        if (emailModal) {
            emailModal.style.display = 'flex';
        } else {
            console.error("Modal d'email non trouvée dans le DOM");
            alert("Erreur: La fenêtre d'envoi d'email n'a pas pu être trouvée.");
        }
    } catch (error) {
        console.error("Erreur lors de la préparation de l'email:", error);
        alert("Une erreur est survenue lors de la préparation de l'email: " + error.message);
    }
}

// Fonction pour afficher la modale de configuration d'email
function showEmailConfigModal() {
    // Pré-remplir avec les valeurs existantes si disponibles
    if (window.emailConfig) {
        if (window.emailConfig.email) {
            document.getElementById('configEmail').value = window.emailConfig.email;
        }
        if (window.emailConfig.appPassword) {
            document.getElementById('configAppPassword').value = window.emailConfig.appPassword;
        }
    }
    
    // Afficher la modale
    document.getElementById('emailConfigModal').style.display = 'flex';
}

// Fonction pour fermer la modale de configuration
function closeEmailConfigModal() {
    document.getElementById('emailConfigModal').style.display = 'none';
}

// Fonction pour enregistrer la configuration d'email
function saveEmailConfiguration(event) {
    event.preventDefault();
    
    const email = document.getElementById('configEmail').value;
    const appPassword = document.getElementById('configAppPassword').value;
    
    // Vérifier que les champs sont remplis
    if (!email || !appPassword) {
        alert('Veuillez remplir tous les champs');
        return;
    }
    
    // Créer ou mettre à jour la configuration
    if (!window.emailConfig) {
        window.emailConfig = {};
    }
    
    window.emailConfig.email = email;
    window.emailConfig.appPassword = appPassword;
    
    // Sauvegarder la configuration
    saveEmailConfig();
    
    alert('Configuration email enregistrée avec succès!');
    closeEmailConfigModal();
}

// Fonction pour ouvrir la page Google de création des mots de passe d'application
function openGoogleAppPasswordPage() {
    if (window.require) {
        const { shell } = window.require('electron');
        shell.openExternal('https://myaccount.google.com/apppasswords');
    } else {
        window.open('https://myaccount.google.com/apppasswords', '_blank');
    }
}

// Initialiser les événements
function initEmailManager() {
    const emailForm = document.getElementById('emailForm');
    if (emailForm) {
        // Supprimer tous les écouteurs d'événements existants
        emailForm.removeEventListener('submit', sendInvoiceEmail);
        
        // En ajouter un nouveau
        emailForm.addEventListener('submit', function(event) {
            // Éviter les soumissions multiples
            if (this.getAttribute('data-submitting') === 'true') {
                event.preventDefault();
                console.log('Soumission déjà en cours, ignorée');
                return;
            }
            
            // Marquer le formulaire comme en cours de soumission
            this.setAttribute('data-submitting', 'true');
            
            // Appeler la fonction d'envoi
            sendInvoiceEmail(event);
        });
        
        console.log('Formulaire email initialisé avec protection contre les soumissions multiples');
    }
    
    // Vérification de la configuration email (inchangée)
    if (!window.emailConfig || !window.emailConfig.email || !window.emailConfig.appPassword) {
        console.warn('Configuration d\'email incomplète');
    } else {
        console.log('Configuration d\'email chargée:', window.emailConfig.email);
    }
}

// Exposer les fonctions globalement - CETTE SECTION NE DOIT APPARAÎTRE QU'UNE FOIS
window.showEmailModal = showEmailModal;
window.generateInvoicePDF = generateInvoicePDF;
window.sendInvoiceEmail = sendInvoiceEmail;
window.initEmailManager = initEmailManager;
window.closeEmailModal = closeEmailModal;
window.openRibSettings = openRibSettings;
window.previewRib = previewRib;
window.updateRib = updateRib;
window.showClientEmailModal = showClientEmailModal;
window.showEmailConfigModal = showEmailConfigModal;
window.closeEmailConfigModal = closeEmailConfigModal;
window.saveEmailConfiguration = saveEmailConfiguration;
window.openGoogleAppPasswordPage = openGoogleAppPasswordPage;

// Initialiser au chargement
document.addEventListener('DOMContentLoaded', initEmailManager);