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

// --- Sauvegarde Automatique ---

async function performAutoBackup(sourcePaths) {
    if (!mainWindow || mainWindow.isDestroyed()) {
        console.log('[Main] Fenêtre principale non disponible, sauvegarde automatique annulée.');
        return;
    }
    if (!sourcePaths || !sourcePaths.clients || !sourcePaths.invoices || !sourcePaths.tasks) {
        console.warn('[Main] Chemins sources pour la sauvegarde automatique non valides ou incomplets.');
        return;
    }

    const autoBackupDir = path.join(app.getPath('userData'), 'AutoBackups');
    const specificAutoBackupPath = path.join(autoBackupDir, 'latest'); // Pour écraser la dernière sauvegarde auto

    try {
        console.log(`[Main] Démarrage de la sauvegarde automatique vers ${specificAutoBackupPath}`);
        await ensureDirExists(specificAutoBackupPath);

        let filesBackedUpCount = 0;
        for (const key in sourcePaths) {
            const sourceFile = sourcePaths[key];
            if (fssync.existsSync(sourceFile)) {
                const fileName = path.basename(sourceFile);
                const destFile = path.join(specificAutoBackupPath, fileName);
                await fs.copyFile(sourceFile, destFile);
                filesBackedUpCount++;
                console.log(`[Main] Fichier ${fileName} sauvegardé automatiquement.`);
            } else {
                console.warn(`[Main] Fichier source ${sourceFile} non trouvé pour la sauvegarde automatique.`);
            }
        }

        if (filesBackedUpCount > 0) {
            if (Notification.isSupported()) {
                new Notification({
                    title: 'Sauvegarde Automatique Réussie',
                    body: `Les données ont été sauvegardées automatiquement à ${new Date().toLocaleTimeString()}.`
                }).show();
            }
            console.log('[Main] Sauvegarde automatique terminée avec succès.');
        } else {
            console.warn('[Main] Aucun fichier n\'a été sauvegardé automatiquement (sources non trouvées ou vides).');
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
    if (!mainWindow) return { success: false, message: "Fenêtre principale non disponible." };

    const dialogResult = await dialog.showOpenDialog(mainWindow, {
        title: 'Sélectionner un dossier pour la sauvegarde',
        defaultPath: lastManualBackupPath || app.getPath('documents'),
        properties: ['openDirectory', 'createDirectory']
    });

    if (dialogResult.canceled || !dialogResult.filePaths.length) {
        return { success: false, message: 'Sauvegarde annulée par l\'utilisateur.' };
    }

    const backupDir = dialogResult.filePaths[0];
    lastManualBackupPath = backupDir; // Mémoriser ce chemin

    try {
        await ensureDirExists(backupDir); // S'assurer que le dossier existe
        const backedUpFiles = [];
        let filesCopied = 0;

        for (const key in sourcePaths) {
            const sourceFile = sourcePaths[key];
            if (fssync.existsSync(sourceFile)) {
                const fileName = path.basename(sourceFile);
                const destFile = path.join(backupDir, fileName);
                await fs.copyFile(sourceFile, destFile);
                backedUpFiles.push(fileName);
                filesCopied++;
            } else {
                console.warn(`[Main] Fichier source ${sourceFile} non trouvé pour la sauvegarde manuelle.`);
            }
        }
        if (filesCopied === 0) {
            return { success: false, message: 'Aucun fichier de données trouvé à sauvegarder.' };
        }
        return { success: true, message: `Sauvegarde réussie dans ${backupDir}\nFichiers sauvegardés: ${backedUpFiles.join(', ')}` };
    } catch (error) {
        console.error('[Main] Erreur lors de la sauvegarde manuelle:', error);
        return { success: false, message: `Erreur de sauvegarde: ${error.message}` };
    }
});

ipcMain.handle('perform-restore', async (event, targetPaths) => {
    if (!mainWindow) return { success: false, message: "Fenêtre principale non disponible." };

    const dialogResult = await dialog.showOpenDialog(mainWindow, {
        title: 'Sélectionner le dossier de sauvegarde à restaurer',
        defaultPath: lastManualBackupPath || app.getPath('documents'),
        properties: ['openDirectory']
    });

    if (dialogResult.canceled || !dialogResult.filePaths.length) {
        return { success: false, message: 'Restauration annulée par l\'utilisateur.' };
    }

    const backupDir = dialogResult.filePaths[0];
    const restoredFiles = [];
    const errors = [];
    let filesFoundInBackup = false;
    let filesRestoredCount = 0;

    try {
        for (const key in targetPaths) {
            const targetFile = targetPaths[key];
            const fileName = path.basename(targetFile);
            const backupSourcePath = path.join(backupDir, fileName);

            if (fssync.existsSync(backupSourcePath)) {
                filesFoundInBackup = true;
                try {
                    await ensureDirExists(path.dirname(targetFile));
                    await fs.copyFile(backupSourcePath, targetFile);
                    restoredFiles.push(fileName);
                    filesRestoredCount++;
                } catch (copyError) {
                    console.error(`[Main] Erreur lors de la copie de ${backupSourcePath} vers ${targetFile}:`, copyError);
                    errors.push(`Erreur pour ${fileName}: ${copyError.message}`);
                }
            } else {
                console.warn(`[Main] Fichier ${fileName} non trouvé dans le dossier de sauvegarde ${backupDir}, ignoré.`);
            }
        }

        if (!filesFoundInBackup) {
            return { success: false, message: `Aucun fichier de données (.json) correspondant trouvé dans le dossier de sauvegarde sélectionné: ${backupDir}` };
        }
        if (errors.length > 0) {
            return { success: false, message: `Restauration terminée avec des erreurs:\n${errors.join('\n')}` };
        }
        if (filesRestoredCount === 0 && filesFoundInBackup) {
             return { success: false, message: `Des fichiers ont été trouvés dans la sauvegarde mais aucun n'a pu être restauré. Vérifiez les permissions.` };
        }
        return { success: true, message: `Restauration réussie depuis ${backupDir}\nFichiers restaurés: ${restoredFiles.join(', ')}.` };

    } catch (error) {
        console.error('[Main] Erreur inattendue lors de la restauration:', error);
        return { success: false, message: `Erreur de restauration: ${error.message}` };
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
        if (dataPaths && dataPaths.clients && dataPaths.invoices && dataPaths.tasks) {
            autoBackupIntervalId = setInterval(() => {
                performAutoBackup(dataPaths).catch(console.error);
            }, AUTO_BACKUP_INTERVAL);
            console.log(`[Main] Sauvegarde automatique configurée toutes les ${AUTO_BACKUP_INTERVAL / 60000} minutes.`);
        } else {
            console.warn('[Main] Impossible de démarrer la sauvegarde automatique: chemins de données non valides reçus du renderer.');
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