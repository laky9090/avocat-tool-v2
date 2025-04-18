// Nouveau fichier pour gérer l'envoi d'emails aux clients

// Fonction pour afficher la modal d'envoi d'email au client
function showClientEmailModal(clientId) {
    // Récupérer les infos du client
    const client = window.clients.find(c => c.id === clientId);
    if (!client) {
        alert('Client non trouvé');
        return;
    }
    
    // Stocker l'ID du client dans le formulaire
    document.getElementById('clientIdForEmail').value = clientId;
    
    // Préremplir l'adresse email du client si disponible
    const emailInput = document.getElementById('clientEmailTo');
    if (client.email) {
        emailInput.value = client.email;
    } else {
        emailInput.value = '';
    }
    
    // Personnaliser l'objet de l'email
    document.getElementById('clientEmailSubject').value = `Dossier ${client.nom} ${client.prenom} - Me Candice ROVERA`;
    
    // Créer le message avec le format spécifié
    const emailMessage = `Cher(e) ${client.prenom} ${client.nom},

Je me permets de vous contacter concernant votre dossier "${client.type}".

Bien cordialement,

Maître Candice ROVERA
Avocate au Barreau de Paris
124 Boulevard de Strasbourg
75010 PARIS
06.07.50.43.81
Toque C0199
Site internet : https://candicerovera-avocat.fr/`;

    // Définir le message dans le formulaire
    document.getElementById('clientEmailMessage').value = emailMessage;
    
    // Afficher la modal
    document.getElementById('clientEmailModal').style.display = 'flex';
}

// Fonction pour fermer la modal d'email client
function closeClientEmailModal() {
    // Fermer la modal
    const emailModal = document.getElementById('clientEmailModal');
    if (emailModal) {
        emailModal.style.display = 'none';
    }
    
    // Réinitialiser les champs du formulaire
    const emailForm = document.getElementById('clientEmailForm');
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
    
    console.log('Modal email client fermée et interface restaurée');
}

// Fonction pour envoyer l'email au client
async function sendClientEmail(event) {
    event.preventDefault();
    
    try {
        // Récupérer les valeurs du formulaire
        const clientId = document.getElementById('clientIdForEmail').value;
        const toEmail = document.getElementById('clientEmailTo').value;
        const subject = document.getElementById('clientEmailSubject').value;
        const message = document.getElementById('clientEmailMessage').value;
        
        // Vérifier les champs requis
        if (!clientId || !toEmail) {
            alert('Veuillez remplir tous les champs requis');
            return;
        }
        
        // Afficher un indicateur de chargement
        const submitBtn = event.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Envoi en cours...';
        
        // Récupérer les données de configuration
        const fromEmail = window.emailConfig ? window.emailConfig.email : document.getElementById('clientEmailFrom').value;
        const appPassword = window.emailConfig ? window.emailConfig.appPassword : '';

        // Préparer les données de l'email
        const emailData = {
            from: fromEmail,
            to: toEmail,
            subject: subject,
            text: message,
            password: appPassword,
            attachments: []
        };
        
        // Envoyer l'email via le backend
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            
            ipcRenderer.send('send-email', emailData);
            
            ipcRenderer.once('email-sent', (event, response) => {
                if (response.success) {
                    alert('Email envoyé avec succès !');
                    
                    closeClientEmailModal();
                    
                    // Forcer le rafraîchissement de la fenêtre
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

// Initialisation des événements
function initClientEmailSystem() {
    const clientEmailForm = document.getElementById('clientEmailForm');
    if (clientEmailForm) {
        clientEmailForm.addEventListener('submit', sendClientEmail);
    }
}

// Exposer les fonctions nécessaires globalement
window.showClientEmailModal = showClientEmailModal;
window.closeClientEmailModal = closeClientEmailModal;
window.sendClientEmail = sendClientEmail;

// Initialiser au chargement du document
document.addEventListener('DOMContentLoaded', initClientEmailSystem);