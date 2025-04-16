// Ajouter au début de window-manager.js
const isMac = process.platform === 'darwin'; // 'darwin' = macOS

// Gestionnaire de fenêtre avec méthode discrète

// Fonction qui force un rafraîchissement de la fenêtre sans minimisation visible
function forceWindowRefresh() {
    console.log('Rafraîchissement discret de l\'interface...');
    
    try {
        // Utiliser l'API Electron via le module remote si disponible
        if (window.require) {
            try {
                const remote = window.require('@electron/remote');
                
                if (remote) {
                    // Obtenir la fenêtre actuelle
                    const currentWindow = remote.getCurrentWindow();
                    
                    // 1. Technique du micro-redimensionnement (invisible à l'œil nu)
                    const bounds = currentWindow.getBounds();
                    // Réduire de 1px dans chaque dimension
                    currentWindow.setBounds({ 
                        width: bounds.width - 1, 
                        height: bounds.height - 1,
                        x: bounds.x, 
                        y: bounds.y 
                    });
                    
                    // Restaurer immédiatement
                    setTimeout(() => {
                        currentWindow.setBounds(bounds);
                    }, 50);
                    
                    // 2. Simuler un changement de focus (sans minimiser)
                    setTimeout(() => {
                        currentWindow.blur();
                        setTimeout(() => {
                            currentWindow.focus();
                            console.log('Rafraîchissement discret effectué avec succès');
                            
                            // 3. Recréer le bouton pour être sûr
                            resetCreateButton();
                        }, 50);
                    }, 100);
                    
                    return true;
                }
            } catch (err) {
                console.warn('Erreur avec @electron/remote:', err);
            }
        }
        
        // Si on arrive ici, l'API Electron n'est pas disponible
        // Méthode de secours basée sur le DOM
        console.warn('API Electron non disponible, utilisation de la méthode DOM');
        resetCreateButton();
        
        return false;
    } catch (error) {
        console.error('Erreur lors du rafraîchissement:', error);
        return false;
    }
}

// Fonction dédiée à la réinitialisation du bouton
function resetCreateButton() {
    // Créer un élément temporaire pour voler le focus
    const tempFocusElement = document.createElement('input');
    tempFocusElement.style.position = 'absolute';
    tempFocusElement.style.opacity = '0';
    tempFocusElement.style.left = '-1000px';
    document.body.appendChild(tempFocusElement);
    
    // Séquence pour changer le focus
    tempFocusElement.focus();
    
    setTimeout(() => {
        document.body.focus();
        tempFocusElement.remove();
        
        // Recréer le bouton de création
        const createBtn = document.getElementById('createInvoiceBtn');
        if (createBtn) {
            const newBtn = createBtn.cloneNode(true);
            createBtn.parentNode.replaceChild(newBtn, createBtn);
            
            newBtn.addEventListener('click', function() {
                console.log('Bouton recréé cliqué');
                if (typeof openInvoiceModal === 'function') {
                    openInvoiceModal();
                }
            });
            
            console.log('Bouton de création réinitialisé');
        }
    }, 50);
}

// Exposer globalement
window.forceWindowRefresh = forceWindowRefresh;