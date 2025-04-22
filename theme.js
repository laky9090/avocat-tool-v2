// Fonction unifiée pour le changement de thème
function setupThemeToggle() {
    // Récupérer le thème enregistré ou utiliser "light" par défaut
    const savedTheme = localStorage.getItem('theme') || 'light';
    
    // Appliquer le thème enregistré au chargement
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    // Mettre à jour l'apparence du bouton selon le thème actuel
    updateThemeButton(savedTheme);
    
    // Gestionnaire d'événement pour le bouton de changement de thème
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', function() {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            
            // Appliquer le nouveau thème
            document.documentElement.setAttribute('data-theme', newTheme);
            
            // Enregistrer le thème dans localStorage
            localStorage.setItem('theme', newTheme);
            
            // Mettre à jour l'apparence du bouton
            updateThemeButton(newTheme);
        });
    }
    
    // Gestionnaire pour le bouton d'actualisation
    const refreshBtn = document.getElementById('refreshPageBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            window.location.reload();
        });
    }
}

// Mettre à jour l'apparence du bouton selon le thème
function updateThemeButton(theme) {
    const themeIcon = document.getElementById('themeIcon');
    const themeText = document.getElementById('themeText');
    
    if (themeIcon && themeText) {
        themeIcon.textContent = theme === 'dark' ? '🌙' : '🌞';
        themeText.textContent = theme === 'dark' ? 'Mode clair' : 'Mode sombre';
    }
}

// Exécuter la configuration au chargement de la page
document.addEventListener('DOMContentLoaded', setupThemeToggle);