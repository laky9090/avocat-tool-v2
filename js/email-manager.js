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
// Modifier la fonction showEmailModal

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
    
    // S'assurer que l'interface est configurée pour les factures
    const checkboxGroup = document.getElementById('attachPDFCheckboxGroup');
    const buttonGroup = document.getElementById('attachDocumentBtnGroup');
    if (checkboxGroup && buttonGroup) {
        checkboxGroup.style.display = 'block';
        buttonGroup.style.display = 'none';
    }
    
    // Réinitialiser la pièce jointe client
    clientAttachment = null;

    // --- AJOUT GESTION PIÈCES JOINTES SUPPLÉMENTAIRES ---
    const attachmentsInput = document.getElementById('additionalAttachmentsInput');
    const attachmentsList = document.getElementById('additionalAttachmentsList');

    if (attachmentsInput && attachmentsList) {
        // 1. Réinitialiser le champ et la liste
        attachmentsInput.value = ''; // Important pour pouvoir resélectionner
        attachmentsList.innerHTML = '';

        // 2. Écouter les changements sur l'input
        // Utiliser une fonction nommée pour pouvoir la supprimer si besoin
        const handleAttachmentChange = function(event) {
            attachmentsList.innerHTML = ''; // Vider la liste précédente
            if (event.target.files.length > 0) {
                Array.from(event.target.files).forEach(file => {
                    const li = document.createElement('li');
                    li.textContent = file.name;
                    li.style.fontSize = '0.8em'; // Plus petit pour la liste
                    attachmentsList.appendChild(li);
                });
            }
        };
        // Nettoyer l'ancien écouteur avant d'en ajouter un nouveau
        attachmentsInput.removeEventListener('change', attachmentsInput.__currentListener);
        attachmentsInput.addEventListener('change', handleAttachmentChange);
        attachmentsInput.__currentListener = handleAttachmentChange; // Stocker la référence

    } else {
        console.warn("Éléments #additionalAttachmentsInput ou #additionalAttachmentsList non trouvés.");
    }
    // --- FIN AJOUT ---

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
        
        // Forcer explicitement le type d'email basé sur les éléments d'interface
        const clientAttachmentBtn = document.getElementById('attachDocumentBtnGroup');
        const isClientEmail = (clientAttachmentBtn && clientAttachmentBtn.style.display !== 'none') || (!invoiceNumber && clientId);
        
        // Récupérer les valeurs du formulaire
        const toEmail = document.getElementById('emailTo').value;
        const subject = document.getElementById('emailSubject').value;
        const message = document.getElementById('emailMessage').value;
        
        // Vérifier les champs requis
        if (!toEmail) {
            alert('Veuillez remplir l\'adresse email');
            emailSendingInProgress = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
            return;
        }
        
        // Préparer les pièces jointes - NOUVELLE IMPLÉMENTATION
        let attachments = [];

        // Log pour débogage
        console.log(`Type d'email: ${isClientEmail ? 'Client' : 'Facture'}`);

        // POUR LES EMAILS DE FACTURE
        if (!isClientEmail) {
            // --- Code existant pour ajouter le RIB ---
            try {
                const fs = window.require('fs');
                const path = window.require('path');
                
                const ribPath = window.emailConfig && window.emailConfig.ribConfig ? 
                    window.emailConfig.ribConfig.path : 
                    "assets/rib/rib-candice-rovera.pdf";
                
                const ribFilename = window.emailConfig && window.emailConfig.ribConfig ? 
                    window.emailConfig.ribConfig.filename : 
                    "RIB_Candice_ROVERA.pdf";
                
                const absoluteRibPath = path.join(__dirname, ribPath);
                
                if (fs.existsSync(absoluteRibPath)) {
                    const ribContent = fs.readFileSync(absoluteRibPath);
                    const ribBase64 = Buffer.from(ribContent).toString('base64');
                    
                    attachments.push({
                        filename: ribFilename,
                        content: ribBase64,
                        encoding: 'base64'
                    });
                    console.log('RIB ajouté à l\'email de facture');
                }
            } catch (error) {
                console.error('Erreur lors de l\'ajout du RIB:', error);
            }

            // --- Code existant pour ajouter la FACTURE PDF PRINCIPALE ---
            try {
                const fs = window.require('fs');
                const path = window.require('path');

                const invoice = window.invoices.find(inv => inv.number === invoiceNumber);
                if (!invoice) {
                    throw new Error(`Facture ${invoiceNumber} non trouvée dans window.invoices.`);
                }
                if (!invoice.client || !invoice.client.nom || !invoice.client.prenom) {
                    throw new Error(`Données client manquantes pour la facture ${invoiceNumber}.`);
                }

                const appRootPath = getAppRootPath();
                if (appRootPath === 'CHEMIN_RACINE_INCONNU') {
                    throw new Error("Impossible de déterminer le chemin racine pour joindre la facture PDF.");
                }

                const baseDossiersPath = path.join(appRootPath, 'Dossiers en cours');
                const clientFolderName = `${invoice.client.nom}_${invoice.client.prenom}`.replace(/[^a-zA-Z0-9_]/g, '_');
                const facturesSubDir = '2-Factures';
                const pdfFileName = `Facture_${invoice.number}.pdf`;
                const pdfFilePath = path.join(baseDossiersPath, clientFolderName, facturesSubDir, pdfFileName);

                console.log(`Recherche de la facture PDF à joindre: ${pdfFilePath}`);

                if (fs.existsSync(pdfFilePath)) {
                    const pdfContent = fs.readFileSync(pdfFilePath);
                    const pdfBase64 = Buffer.from(pdfContent).toString('base64');

                    attachments.push({
                        filename: pdfFileName,
                        content: pdfBase64,
                        encoding: 'base64'
                    });
                    console.log(`Facture PDF ajoutée avec succès à l'email: ${pdfFileName}`);
                } else {
                    console.error(`ERREUR: Le fichier PDF de la facture est introuvable: ${pdfFilePath}`);
                    alert(`Attention : Le fichier PDF de la facture ${pdfFileName} n'a pas été trouvé à l'emplacement attendu et ne sera pas joint à l'e-mail.`);
                }

            } catch (error) {
                console.error('Erreur lors de la tentative d\'ajout de la facture PDF:', error);
                alert(`Une erreur est survenue lors de la tentative d'ajout de la facture PDF à l'e-mail : ${error.message}`);
            }

            // --- AJOUT POUR LES PIÈCES JOINTES SUPPLÉMENTAIRES ---
            try {
                const attachmentsInput = document.getElementById('additionalAttachmentsInput');
                const additionalFiles = attachmentsInput ? attachmentsInput.files : null;
                const fs = window.require('fs');

                if (additionalFiles && additionalFiles.length > 0) {
                    console.log(`[PJ Supp] Traitement de ${additionalFiles.length} fichier(s) supplémentaire(s)...`);
                    for (let i = 0; i < additionalFiles.length; i++) {
                        const file = additionalFiles[i];
                        if (file.path && fs.existsSync(file.path)) {
                            try {
                                console.log(`[PJ Supp] Lecture de: ${file.path}`);
                                const fileContent = fs.readFileSync(file.path);
                                const fileBase64 = Buffer.from(fileContent).toString('base64');

                                attachments.push({
                                    filename: file.name,
                                    content: fileBase64,
                                    encoding: 'base64'
                                });
                                console.log(`[PJ Supp] Fichier ajouté: ${file.name}`);
                            } catch (readError) {
                                console.error(`[PJ Supp] Erreur lors de la lecture du fichier ${file.name}:`, readError);
                                alert(`Erreur lors de la lecture du fichier supplémentaire ${file.name}. Il ne sera pas joint.`);
                            }
                        } else {
                            console.warn(`[PJ Supp] Le fichier ${file.name} n'a pas de chemin valide ou n'existe pas (${file.path}). Ignoré.`);
                        }
                    }
                } else {
                     console.log("[PJ Supp] Aucun fichier supplémentaire sélectionné.");
                }
            } catch (error) {
                console.error('[PJ Supp] Erreur lors du traitement des fichiers supplémentaires:', error);
                alert("Une erreur est survenue lors de l'ajout des pièces jointes supplémentaires.");
            }
            // --- FIN AJOUT PIÈCES JOINTES SUPPLÉMENTAIRES ---

        }
        // POUR LES EMAILS CLIENT (logique existante inchangée)
        else {
            console.log('Email client - aucun RIB ne sera ajouté');
            
            console.log('Debug - clientAttachment:', clientAttachment ? clientAttachment.name : 'aucun');
            
            if (clientAttachment) {
                try {
                    const fs = window.require('fs');
                    const path = window.require('path');
                    
                    const fileContent = fs.readFileSync(clientAttachment.path);
                    const fileBase64 = Buffer.from(fileContent).toString('base64');
                    
                    attachments.push({
                        filename: clientAttachment.name,
                        content: fileBase64,
                        encoding: 'base64'
                    });
                    
                    console.log('Document sélectionné ajouté:', clientAttachment.name);
                } catch (error) {
                    console.error('Erreur lors de la lecture du fichier joint:', error);
                    alert("Erreur lors de la lecture du fichier joint: " + error.message);
                }
            } else {
                console.log('Aucun document joint');
            }
        }

        const fromEmail = window.emailConfig ? window.emailConfig.email : document.getElementById('emailFrom')?.value;
        const appPassword = window.emailConfig ? window.emailConfig.appPassword : '';

        if (!fromEmail || !appPassword) {
            const configurer = confirm('La configuration d\'email n\'est pas complète. Voulez-vous configurer votre email maintenant?');
            if (configurer) {
                showEmailConfigModal();
            }
            
            emailSendingInProgress = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
            return;
        }

        const emailData = {
            from: fromEmail,
            to: toEmail,
            subject: subject,
            text: message,
            password: appPassword,
            attachments: attachments
        };

        console.log('Préparation à l\'envoi de l\'email:', { 
            to: emailData.to, 
            subject: emailData.subject, 
            attachmentsCount: emailData.attachments.length 
        });
        console.log('Noms des pièces jointes:', emailData.attachments.map(a => a.filename));

        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            
            const safetyTimeout = setTimeout(() => {
                console.log('Timeout de sécurité: déverrouillage forcé');
                emailSendingInProgress = false;
                
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalText;
                }
                
                alert('L\'envoi d\'email a pris trop de temps. Veuillez réessayer.');
            }, 15000);
            
            ipcRenderer.send('send-email', emailData);
            
            ipcRenderer.once('email-sent', (event, response) => {
                clearTimeout(safetyTimeout);
                
                console.log('Réponse du processus principal:', response);
                
                emailSendingInProgress = false;
                
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalText;
                }
                
                if (response.success) {
                    alert('Email envoyé avec succès !');
                    
                    closeEmailModal();
                    
                    if (!isClientEmail && typeof updateInvoiceStatus === 'function') {
                        try {
                            updateInvoiceStatus(invoiceNumber, 'sent');
                        } catch (err) {
                            console.error('Erreur lors de la mise à jour du statut de la facture:', err);
                        }
                    }
                    
                    setTimeout(() => {
                        if (typeof forceWindowRefresh === 'function') {
                            try {
                                forceWindowRefresh();
                            } catch (err) {
                                console.error('Erreur lors du rafraîchissement de la fenêtre:', err);
                            }
                        }
                    }, 200);
                } else {
                    alert(`Erreur lors de l'envoi de l'email : ${response.error}`);
                }
            });
        } else {
            alert('L\'envoi d\'emails n\'est pas disponible dans cette version de l\'application');
            emailSendingInProgress = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        }
    } catch (error) {
        console.error('Erreur globale dans sendInvoiceEmail:', error);
        alert(`Une erreur inattendue est survenue: ${error.message}`);
        emailSendingInProgress = false;
        lastRequestTimestamp = 0;
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
        const emailForm = document.getElementById('emailForm');
        if (emailForm) {
            emailForm.removeAttribute('data-submitting');
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
    
    // Réinitialiser la pièce jointe client
    clientAttachment = null;
    const fileNameSpan = document.getElementById('attachedFileName');
    if (fileNameSpan) {
        fileNameSpan.textContent = '';
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
        
        // Affichage du bouton au lieu de la case à cocher
        const checkboxGroup = document.getElementById('attachPDFCheckboxGroup');
        const buttonGroup = document.getElementById('attachDocumentBtnGroup');
        if (checkboxGroup && buttonGroup) {
            checkboxGroup.style.display = 'none';
            buttonGroup.style.display = 'block';
            document.getElementById('attachedFileName').textContent = '';
        }
        
        // Préparer le gestionnaire pour le bouton d'attachement
        const attachBtn = document.getElementById('attachDocumentBtn');
        if (attachBtn) {
            // Supprimer les gestionnaires existants
            const newBtn = attachBtn.cloneNode(true);
            attachBtn.parentNode.replaceChild(newBtn, attachBtn);
            
            // Ajouter le nouveau gestionnaire
            newBtn.addEventListener('click', selectAttachmentForClient);
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

// Ajouter cette nouvelle fonction

// Variable globale pour stocker le fichier attaché
let clientAttachment = null;

// Fonction pour sélectionner un fichier à joindre
async function selectAttachmentForClient() {
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
            
            // Stocker les informations du fichier
            clientAttachment = {
                path: filePath,
                name: fileName
            };
            
            // Afficher le nom du fichier
            const fileNameSpan = document.getElementById('attachedFileName');
            if (fileNameSpan) {
                fileNameSpan.textContent = fileName;
            }
            
            console.log('Document sélectionné:', fileName);
        }
    } catch (error) {
        console.error('Erreur lors de la sélection du fichier:', error);
        alert("Erreur lors de la sélection du fichier: " + error.message);
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
window.selectAttachmentForClient = selectAttachmentForClient; // Nouvelle fonction

// Initialiser au chargement
document.addEventListener('DOMContentLoaded', initEmailManager);