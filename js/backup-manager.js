document.addEventListener('DOMContentLoaded', () => {
    const backupBtn = document.getElementById('backupDataBtn');
    const restoreBtn = document.getElementById('restoreDataBtn');
    
    const ipcRenderer = window.ipcRenderer;

    if (!ipcRenderer) {
        console.error("backup-manager.js: window.ipcRenderer n'est pas disponible...");
        if (backupBtn) backupBtn.disabled = true;
        if (restoreBtn) restoreBtn.disabled = true;
        
        const backupRestoreSection = document.querySelector('.backup-restore-section');
        if (backupRestoreSection) {
            const errorMsg = document.createElement('p');
            errorMsg.textContent = "Erreur: Impossible d'initialiser les fonctions de sauvegarde/restauration (dépendance manquante).";
            errorMsg.style.color = 'red';
            errorMsg.style.fontWeight = 'bold';
            backupRestoreSection.appendChild(errorMsg);
        }
        return;
    } else {
        console.log("backup-manager.js: window.ipcRenderer est disponible.");
    }

    // Utiliser un petit délai pour s'assurer que path-manager.js a traité 'app-paths'
    setTimeout(() => {
        console.log('backup-manager.js: Vérification des chemins (après délai):');
        console.log('  - clientsPath:', window.clientsPath);
        console.log('  - invoicesPath:', window.invoicesPath);
        console.log('  - tasksPath:', window.tasksPath);
        console.log('  - dossiersEnCoursPath:', window.dossiersEnCoursPath);
        console.log('  - dossiersArchivesPath:', window.dossiersArchivesPath);

        if (!window.clientsPath || !window.invoicesPath || !window.tasksPath || !window.dossiersEnCoursPath || !window.dossiersArchivesPath) {
            console.warn('backup-manager.js: Un ou plusieurs chemins essentiels sont manquants sur window. La sauvegarde/restauration pourrait être incomplète.');
        }

        // --- Gestionnaire Sauvegarde ---
        if (backupBtn) {
            backupBtn.addEventListener('click', async () => {
                backupBtn.disabled = true;
                backupBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sauvegarde...';

                const pathsToBackup = {
                    clients: window.clientsPath,
                    invoices: window.invoicesPath,
                    tasks: window.tasksPath,
                    dossiersEnCours: window.dossiersEnCoursPath,
                    dossiersArchives: window.dossiersArchivesPath
                };
                // Filtrer les chemins non définis pour éviter d'envoyer null/undefined à main.js
                const validPathsToBackup = Object.fromEntries(
                    Object.entries(pathsToBackup).filter(([, value]) => value)
                );

                if (Object.keys(validPathsToBackup).length === 0) {
                    alert("Erreur: Aucun chemin valide à sauvegarder n'a été trouvé.");
                    backupBtn.disabled = false;
                    backupBtn.innerHTML = '<i class="fas fa-save"></i> Sauvegarder';
                    return;
                }

                console.log("backup-manager.js: Chemins à sauvegarder envoyés à main.js:", validPathsToBackup);
                try {
                    const result = await ipcRenderer.invoke('perform-backup', validPathsToBackup);
                    alert(result.message);
                } catch (error) {
                    alert(`Erreur sauvegarde: ${error.message}`);
                } finally {
                    backupBtn.disabled = false;
                    backupBtn.innerHTML = '<i class="fas fa-save"></i> Sauvegarder';
                }
            });
        } else {
            console.warn("Bouton #backupDataBtn non trouvé.");
        }

        // --- Gestionnaire Restauration ---
        if (restoreBtn) {
            restoreBtn.addEventListener('click', async () => {
                restoreBtn.disabled = true;
                restoreBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Restauration...';

                const pathsToRestoreTo = { // Ce sont les chemins CIBLES où restaurer
                    clients: window.clientsPath,
                    invoices: window.invoicesPath,
                    tasks: window.tasksPath,
                    dossiersEnCours: window.dossiersEnCoursPath,
                    dossiersArchives: window.dossiersArchivesPath
                };
                const validPathsToRestoreTo = Object.fromEntries(
                    Object.entries(pathsToRestoreTo).filter(([, value]) => value)
                );

                if (Object.keys(validPathsToRestoreTo).length === 0) {
                    alert("Erreur: Aucun chemin cible valide pour la restauration.");
                    restoreBtn.disabled = false;
                    restoreBtn.innerHTML = '<i class="fas fa-upload"></i> Restaurer';
                    return;
                }
                
                console.log("backup-manager.js: Chemins cibles pour restauration envoyés à main.js:", validPathsToRestoreTo);
                try {
                    const result = await ipcRenderer.invoke('perform-restore', validPathsToRestoreTo);
                    alert(result.message);
                    if (result.success) {
                        if (confirm("Restauration terminée. Recharger l'application pour voir les changements ?")) {
                            window.location.reload();
                        }
                    }
                } catch (error) {
                    alert(`Erreur restauration: ${error.message}`);
                } finally {
                    restoreBtn.disabled = false;
                    restoreBtn.innerHTML = '<i class="fas fa-upload"></i> Restaurer';
                }
            });
        } else {
            console.warn("Bouton #restoreDataBtn non trouvé.");
        }
    }, 200); // Augmentation légère du délai pour plus de robustesse
});