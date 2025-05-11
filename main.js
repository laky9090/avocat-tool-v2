const { app, BrowserWindow, ipcMain, dialog, shell, Notification } = require('electron');
const fs = require('fs').promises; // Utiliser les promesses pour fs
const fssync = require('fs'); // Pour les opérations synchrones si absolument nécessaire
const path = require('path');
const remoteMain = require('@electron/remote/main');
const nodemailer = require('nodemailer');

// Désactiver l'accélération GPU
app.disableHardwareAcceleration();

// Activer le module remote
remoteMain.initialize();

let mainWindow;
let autoBackupIntervalId = null;
const AUTO_BACKUP_INTERVAL = 5 * 60 * 1000; // 5 minutes en millisecondes
let lastManualBackupPath = null; // Pour se souvenir du dernier chemin de sauvegarde manuelle

function createWindow() {
  // Créer la fenêtre du navigateur
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: process.platform === 'win32' 
      ? path.join(__dirname, 'icone.ico')
      : path.join(__dirname, 'icone.icns'), // pour macOS
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: false
    }
  });
  
  // Charger le fichier index.html de l'application
  mainWindow.loadFile('index.html');
  
  // Envoyer les chemins nécessaires au processus de rendu une fois chargé
  mainWindow.webContents.on('did-finish-load', () => {
    const appPath = app.getAppPath();
    const userDataPath = app.getPath('userData');
    console.log(`[Main] did-finish-load: appPath=${appPath}, userDataPath=${userDataPath}`);
    mainWindow.webContents.send('app-paths', { appPath, userDataPath });
  });

  // Désactiver le zoom
  mainWindow.webContents.setZoomFactor(1);
  mainWindow.webContents.setVisualZoomLevelLimits(1, 1);

  mainWindow.maximize();
  remoteMain.enable(mainWindow.webContents);
}

// --- Fonctions Utilitaires pour la Sauvegarde/Restauration ---

async function ensureDirExists(dirPath) {
    try {
        await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
        if (error.code !== 'EEXIST') { // Ignorer si le dossier existe déjà
            console.error(`[Main] Erreur lors de la création du dossier ${dirPath}:`, error);
            throw error; // Propager l'erreur si ce n'est pas EEXIST
        }
    }
}

// Fonction pour copier un dossier récursivement
async function copyDirectoryRecursive(source, destination) {
    try {
        if (typeof fs.cp === 'function') {
            await fs.cp(source, destination, { recursive: true, force: true });
            console.log(`[Main] Dossier copié (avec fs.cp) de ${source} vers ${destination}`);
        } else {
            await fs.mkdir(destination, { recursive: true });
            const entries = await fs.readdir(source, { withFileTypes: true });
            for (let entry of entries) {
                const srcPath = path.join(source, entry.name);
                const destPath = path.join(destination, entry.name);
                if (entry.isDirectory()) {
                    await copyDirectoryRecursive(srcPath, destPath);
                } else {
                    await fs.copyFile(srcPath, destPath);
                }
            }
            console.log(`[Main] Dossier copié (manuellement) de ${source} vers ${destination}`);
        }
    } catch (error) {
        console.error(`[Main] Erreur lors de la copie du dossier de ${source} vers ${destination}:`, error);
        throw error;
    }
}

// --- Sauvegarde Automatique ---

async function performAutoBackup(sourcePaths) {
    if (!mainWindow || mainWindow.isDestroyed()) {
        console.log('[Main] Fenêtre principale non disponible, sauvegarde automatique annulée.');
        return;
    }
    // Ajuster cette vérification si les dossiers sont optionnels pour l'autobackup
    if (!sourcePaths || (!sourcePaths.clients && !sourcePaths.dossiersEnCours)) { // Exemple de vérification plus souple
        console.warn('[Main] Chemins sources pour la sauvegarde automatique non valides ou incomplets.');
        return;
    }

    const autoBackupDir = path.join(app.getPath('userData'), 'AutoBackups');
    const specificAutoBackupPath = path.join(autoBackupDir, 'latest_autobackup'); // Dossier spécifique pour la dernière sauvegarde auto

    try {
        console.log(`[Main] Démarrage de la sauvegarde automatique vers ${specificAutoBackupPath}`);
        // Supprimer l'ancien dossier de sauvegarde auto 'latest' pour éviter l'accumulation à l'intérieur
        if (fssync.existsSync(specificAutoBackupPath)) {
            await fs.rm(specificAutoBackupPath, { recursive: true, force: true });
        }
        await ensureDirExists(specificAutoBackupPath);

        let itemsBackedUpCount = 0;
        for (const key in sourcePaths) {
            const srcPath = sourcePaths[key];
            if (!srcPath) {
                console.warn(`[Main][AutoBackup] Chemin source pour la clé '${key}' est indéfini. Ignoré.`);
                continue;
            }

            if (fssync.existsSync(srcPath)) {
                const itemName = path.basename(srcPath);
                const destPathInBackup = path.join(specificAutoBackupPath, itemName);
                
                const stats = await fs.stat(srcPath); // Vérifier si c'est un fichier ou un dossier
                if (stats.isDirectory()) {
                    console.log(`[Main][AutoBackup] Sauvegarde du dossier: ${srcPath} vers ${destPathInBackup}`);
                    await copyDirectoryRecursive(srcPath, destPathInBackup); // Utiliser votre fonction existante
                    itemsBackedUpCount++;
                } else if (stats.isFile()) {
                    console.log(`[Main][AutoBackup] Sauvegarde du fichier: ${srcPath} vers ${destPathInBackup}`);
                    await fs.copyFile(srcPath, destPathInBackup);
                    itemsBackedUpCount++;
                } else {
                    console.warn(`[Main][AutoBackup] Le chemin source n'est ni un fichier ni un dossier: ${srcPath}. Ignoré.`);
                }
            } else {
                console.warn(`[Main][AutoBackup] Élément source ${srcPath} non trouvé pour la sauvegarde automatique.`);
            }
        }

        if (itemsBackedUpCount > 0) {
            if (Notification.isSupported()) {
                new Notification({
                    title: 'Sauvegarde Automatique Réussie',
                    body: `Les données ont été sauvegardées automatiquement à ${new Date().toLocaleTimeString()}.`
                }).show();
            }
            console.log('[Main] Sauvegarde automatique terminée avec succès.');
        } else {
            console.warn('[Main] Aucun élément n\'a été sauvegardé automatiquement (sources non trouvées ou vides).');
        }

    } catch (error) {
        console.error('[Main] Erreur lors de la sauvegarde automatique:', error);
        if (Notification.isSupported()) {
            new Notification({
                title: 'Erreur de Sauvegarde Automatique',
                body: `Une erreur est survenue: ${error.message}`
            }).show();
        }
    }
}

// --- Gestionnaires IPC pour Sauvegarde/Restauration Manuelle ---

ipcMain.handle('perform-backup', async (event, sourcePaths) => {
    console.log('[Main] Demande de sauvegarde reçue avec les sources:', sourcePaths);
    const dialogResult = await dialog.showSaveDialog(mainWindow, {
        title: 'Choisir un emplacement pour la sauvegarde',
        defaultPath: `Sauvegarde_AvocatTool_${new Date().toISOString().slice(0, 10)}`, // Nom de dossier suggéré plus simple
        properties: ['openDirectory', 'createDirectory']
    });

    if (dialogResult.canceled || !dialogResult.filePath) {
        return { success: false, message: 'Sauvegarde annulée par l\'utilisateur.' };
    }

    const backupBaseFolder = dialogResult.filePath;
    const backupFolderName = `Backup_${new Date().toISOString().replace(/:/g, '-').slice(0, 19)}`;
    const backupSubFolder = path.join(backupBaseFolder, backupFolderName);

    try {
        await ensureDirExists(backupSubFolder);
        let allSuccessful = true;
        let errors = [];

        for (const key in sourcePaths) {
            const srcPath = sourcePaths[key];
            if (!srcPath) {
                console.warn(`[Main] Chemin source pour la clé '${key}' est indéfini. Ignoré.`);
                continue;
            }

            const destName = path.basename(srcPath);
            const destPathInBackup = path.join(backupSubFolder, destName);

            try {
                if (!fssync.existsSync(srcPath)) {
                    console.warn(`[Main] Le chemin source n'existe pas: ${srcPath}. Ignoré.`);
                    errors.push(`Source manquante: ${srcPath}`);
                    allSuccessful = false;
                    continue;
                }

                const stats = await fs.stat(srcPath);
                if (stats.isDirectory()) {
                    console.log(`[Main] Sauvegarde du dossier: ${srcPath} vers ${destPathInBackup}`);
                    await copyDirectoryRecursive(srcPath, destPathInBackup);
                } else if (stats.isFile()) {
                    console.log(`[Main] Sauvegarde du fichier: ${srcPath} vers ${destPathInBackup}`);
                    await fs.copyFile(srcPath, destPathInBackup);
                } else {
                    console.warn(`[Main] Le chemin source n'est ni un fichier ni un dossier: ${srcPath}. Ignoré.`);
                    errors.push(`Type de source inconnu: ${srcPath}`);
                    allSuccessful = false;
                }
            } catch (fileOrDirError) {
                console.error(`[Main] Erreur lors de la sauvegarde de ${srcPath}:`, fileOrDirError);
                errors.push(`Erreur sauvegarde ${key}: ${fileOrDirError.message}`);
                allSuccessful = false;
            }
        }

        if (allSuccessful) {
            return { success: true, message: `Sauvegarde complète réussie dans ${backupSubFolder}` };
        } else {
            return { success: false, message: `Sauvegarde terminée avec des erreurs dans ${backupSubFolder}. Détails: ${errors.join('; ')}` };
        }

    } catch (error) {
        console.error('[Main] Erreur globale lors de la sauvegarde :', error);
        return { success: false, message: `Erreur globale lors de la sauvegarde : ${error.message}` };
    }
});

ipcMain.handle('perform-restore', async (event, pathsToRestoreTo) => {
    console.log('[Main] Demande de restauration reçue. Cibles de restauration:', pathsToRestoreTo);
    const dialogResult = await dialog.showOpenDialog(mainWindow, {
        title: 'Choisir le dossier de sauvegarde spécifique (ex: Backup_YYYY-MM-DDTHH-MM-SS) à restaurer',
        properties: ['openDirectory']
    });

    if (dialogResult.canceled || dialogResult.filePaths.length === 0) {
        return { success: false, message: 'Restauration annulée par l\'utilisateur.' };
    }

    const selectedBackupDir = dialogResult.filePaths[0];
    console.log(`[Main] Restauration depuis le dossier de sauvegarde: ${selectedBackupDir}`);

    try {
        let allSuccessful = true;
        let errors = [];

        for (const key in pathsToRestoreTo) {
            const targetRestorePath = pathsToRestoreTo[key];
            if (!targetRestorePath) {
                console.warn(`[Main] Chemin de restauration cible pour la clé '${key}' est indéfini. Ignoré.`);
                continue;
            }

            const sourceNameInBackup = path.basename(targetRestorePath);
            const sourcePathInBackup = path.join(selectedBackupDir, sourceNameInBackup);

            try {
                if (!fssync.existsSync(sourcePathInBackup)) {
                    console.warn(`[Main] Le fichier/dossier source n'existe pas dans la sauvegarde: ${sourcePathInBackup}. Ignoré pour la restauration de '${key}'.`);
                    errors.push(`Source manquante dans la sauvegarde: ${sourceNameInBackup} pour ${key}`);
                    allSuccessful = false;
                    continue;
                }

                const stats = await fs.stat(sourcePathInBackup);
                if (stats.isFile()) {
                    await ensureDirExists(path.dirname(targetRestorePath));
                }

                if (stats.isDirectory()) {
                    console.log(`[Main] Restauration du dossier: ${sourcePathInBackup} vers ${targetRestorePath}`);
                    await copyDirectoryRecursive(sourcePathInBackup, targetRestorePath);
                } else if (stats.isFile()) {
                    console.log(`[Main] Restauration du fichier: ${sourcePathInBackup} vers ${targetRestorePath}`);
                    await fs.copyFile(sourcePathInBackup, targetRestorePath);
                } else {
                     console.warn(`[Main] L'élément source dans la sauvegarde n'est ni un fichier ni un dossier: ${sourcePathInBackup}. Ignoré.`);
                     errors.push(`Type de source inconnu dans la sauvegarde: ${sourceNameInBackup}`);
                     allSuccessful = false;
                }
            } catch (fileOrDirError) {
                console.error(`[Main] Erreur lors de la restauration de ${sourcePathInBackup} vers ${targetRestorePath}:`, fileOrDirError);
                errors.push(`Erreur restauration ${key}: ${fileOrDirError.message}`);
                allSuccessful = false;
            }
        }
        
        if (allSuccessful) {
            return { success: true, message: `Restauration depuis ${selectedBackupDir} terminée avec succès.` };
        } else {
            return { success: false, message: `Restauration depuis ${selectedBackupDir} terminée avec des erreurs. Détails: ${errors.join('; ')}` };
        }

    } catch (error) {
        console.error('[Main] Erreur globale lors de la restauration :', error);
        return { success: false, message: `Erreur globale lors de la restauration : ${error.message}` };
    }
});

// --- Gestionnaire d'événement pour l'envoi d'emails ---
ipcMain.on('send-email', async (event, emailData) => {
  try {
    const uniqueId = `${emailData.to}-${emailData.subject}-${Date.now()}`;
    if (processedEmails.has(uniqueId)) {
      console.log('Requête d\'email dupliquée détectée et ignorée');
      event.reply('email-sent', {
        success: false,
        error: "Envoi ignoré (requête dupliquée)"
      });
      return;
    }
    processedEmails.add(uniqueId);
    setTimeout(() => {
      processedEmails.delete(uniqueId);
    }, 10000);

    console.log('Demande d\'envoi d\'email reçue');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailData.from,
        pass: emailData.password
      }
    });
    const mailOptions = {
      from: emailData.from,
      to: emailData.to,
      subject: emailData.subject,
      text: emailData.text,
      attachments: emailData.attachments || []
    };
    const info = await transporter.sendMail(mailOptions);
    console.log('Email envoyé:', info.messageId);
    event.reply('email-sent', {
      success: true,
      messageId: info.messageId
    });
  } catch (error) {
    console.error('Erreur lors de l\'envoi de l\'email:', error);
    event.reply('email-sent', {
      success: false,
      error: error.message
    });
  }
});

app.whenReady().then(() => {
    createWindow();

    ipcMain.on('renderer-ready-for-autobackup', (event, dataPaths) => {
        console.log('[Main] Renderer prêt, chemins de données reçus pour la sauvegarde auto:', dataPaths);
        if (autoBackupIntervalId) {
            clearInterval(autoBackupIntervalId);
        }
        // Vérifier qu'il y a au moins un chemin valide pour démarrer
        if (dataPaths && Object.keys(dataPaths).length > 0) {
            autoBackupIntervalId = setInterval(() => {
                performAutoBackup(dataPaths).catch(console.error);
            }, AUTO_BACKUP_INTERVAL);
            console.log(`[Main] Sauvegarde automatique configurée toutes les ${AUTO_BACKUP_INTERVAL / 60000} minutes.`);
        } else {
            console.warn('[Main] Impossible de démarrer la sauvegarde automatique: aucun chemin de données valide reçu du renderer.');
        }
    });

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('will-quit', () => {
    if (autoBackupIntervalId) {
        clearInterval(autoBackupIntervalId);
        console.log('[Main] Sauvegarde automatique arrêtée.');
    }
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});