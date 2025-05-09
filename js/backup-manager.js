document.addEventListener('DOMContentLoaded', () => {
    const backupBtn = document.getElementById('backupDataBtn');
    const restoreBtn = document.getElementById('restoreDataBtn');
    // Essayer d'obtenir ipcRenderer via window.require
    let ipcRenderer = null;
    try {
        if (window.require) {
            ipcRenderer = window.require('electron').ipcRenderer;
        }
    } catch (e) {
        console.error("Erreur lors du chargement d'ipcRenderer:", e);
    }


    if (!ipcRenderer) {
        console.error("IPC Renderer non disponible. Les fonctions de sauvegarde/restauration ne fonctionneront pas.");
        if (backupBtn) backupBtn.disabled = true;
        if (restoreBtn) restoreBtn.disabled = true;
        // Optionnel: Afficher un message à l'utilisateur
        const backupRestoreSection = document.querySelector('.backup-restore-section');
        if (backupRestoreSection) {
            const errorMsg = document.createElement('p');
            errorMsg.textContent = "Erreur: Impossible d'initialiser les fonctions de sauvegarde/restauration.";
            errorMsg.style.color = 'red';
            errorMsg.style.fontWeight = 'bold';
            backupRestoreSection.appendChild(errorMsg);
        }
        return;
    }

    console.log('Chemins détectés :');
    console.log('- clientsPath :', window.clientsPath);
    console.log('- invoicesPath :', window.invoicesPath);
    console.log('- tasksPath :', window.tasksPath);

    if (!window.clientsPath || !window.invoicesPath || !window.tasksPath) {
        console.error('Erreur : Les chemins ne sont pas définis. Vérifiez path-manager.js.');
        alert('Erreur de configuration : Impossible de déterminer les chemins des fichiers de données.');
        return;
    }

    // --- Gestionnaire Sauvegarde ---
    if (backupBtn) {
        backupBtn.addEventListener('click', async () => {
            console.log("Clic sur Sauvegarder...");
            backupBtn.disabled = true; // Désactiver pendant l'opération
            backupBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sauvegarde en cours...'; // Indicateur visuel

            const pathsToBackup = {
                clients: window.clientsPath,
                invoices: window.invoicesPath,
                tasks: window.tasksPath
            };

            // Vérifier si les chemins sont définis
            if (!pathsToBackup.clients || !pathsToBackup.invoices || !pathsToBackup.tasks) {
                console.error("Erreur: Un ou plusieurs chemins de données (clients, invoices, tasks) ne sont pas définis. Vérifiez path-manager.js.");
                alert("Erreur de configuration : Impossible de déterminer les chemins des fichiers de données.");
                backupBtn.disabled = false;
                backupBtn.innerHTML = '<i class="fas fa-save"></i> Sauvegarder les données';
                return;
            }

            console.log("Chemins à sauvegarder:", pathsToBackup);

            try {
                const result = await ipcRenderer.invoke('perform-backup', pathsToBackup);
                alert(result.message); // Afficher le message de succès ou d'erreur
                console.log("Résultat sauvegarde:", result);
            } catch (error) {
                console.error("Erreur IPC lors de la sauvegarde:", error);
                alert(`Erreur lors de la sauvegarde : ${error.message}`);
            } finally {
                backupBtn.disabled = false; // Réactiver le bouton
                backupBtn.innerHTML = '<i class="fas fa-save"></i> Sauvegarder les données'; // Restaurer texte/icône
            }
        });
    } else {
        console.warn("Bouton #backupDataBtn non trouvé.");
    }

    // --- Gestionnaire Restauration ---
    if (restoreBtn) {
        restoreBtn.addEventListener('click', async () => {
            console.log("Clic sur Restaurer...");
            restoreBtn.disabled = true; // Désactiver pendant l'opération
            restoreBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Restauration en cours...'; // Indicateur visuel

            // Définir les chemins où les fichiers doivent être restaurés
            const pathsToRestore = {
                clients: window.clientsPath,
                invoices: window.invoicesPath,
                tasks: window.tasksPath // Assurez-vous que tasksPath est défini
            };

            // Vérifier si les chemins sont définis
            if (!pathsToRestore.clients || !pathsToRestore.invoices || !pathsToRestore.tasks) {
                 console.error("Erreur: Un ou plusieurs chemins cibles (clients, invoices, tasks) ne sont pas définis. Vérifiez path-manager.js.");
                 alert("Erreur de configuration : Impossible de déterminer où restaurer les fichiers de données.");
                 restoreBtn.disabled = false;
                 restoreBtn.innerHTML = '<i class="fas fa-upload"></i> Restaurer les données';
                 return;
            }

            console.log("Chemins cibles pour la restauration:", pathsToRestore);

            try {
                const result = await ipcRenderer.invoke('perform-restore', pathsToRestore);
                // Afficher le message de succès ou d'erreur DANS TOUS LES CAS
                alert(result.message);
                console.log("Résultat restauration:", result);

                if (result.success) {
                    // Ne pas recharger les données ici car on est dans index.html
                    console.log("Restauration réussie. L'utilisateur doit naviguer/actualiser.");
                    // Afficher un message plus clair à l'utilisateur
                    alert("Restauration terminée avec succès.\nVeuillez naviguer vers les sections concernées (Clients, Finance, Tâches) ou actualiser les pages pour voir les données restaurées.");
                }
            } catch (error) {
                console.error("Erreur IPC lors de la restauration:", error);
                alert(`Erreur lors de la restauration : ${error.message}`);
            } finally {
                restoreBtn.disabled = false; // Réactiver le bouton
                restoreBtn.innerHTML = '<i class="fas fa-upload"></i> Restaurer les données'; // Restaurer texte/icône
            }
        });
    } else {
        console.warn("Bouton #restoreDataBtn non trouvé.");
    }
});