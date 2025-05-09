const { app, BrowserWindow, ipcMain, dialog } = require('electron'); // Ajouter dialog
const path = require('path');
const remoteMain = require('@electron/remote/main');
const nodemailer = require('nodemailer');
const fs = require('fs'); // Ajouter fs

// Désactiver l'accélération GPU
app.disableHardwareAcceleration();

// Activer le module remote
remoteMain.initialize(); // Garder uniquement cette initialisation

function createWindow() {
  // Créer la fenêtre du navigateur
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    // Ajouter cette ligne pour définir l'icône
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

// Variable pour suivre les emails déjà envoyés
const processedEmails = new Set();

// Gestionnaire d'événement pour l'envoi d'emails
ipcMain.on('send-email', async (event, emailData) => {
  try {
    // Créer un identifiant unique basé sur le destinataire, le sujet et un timestamp
    const uniqueId = `${emailData.to}-${emailData.subject}-${Date.now()}`;
    
    // Vérifier si cet email a déjà été traité récemment
    if (processedEmails.has(uniqueId)) {
      console.log('Requête d\'email dupliquée détectée et ignorée');
      
      // Répondre au renderer process
      event.reply('email-sent', {
        success: false,
        error: "Envoi ignoré (requête dupliquée)"
      });
      return;
    }
    
    // Ajouter à l'ensemble des emails traités
    processedEmails.add(uniqueId);
    
    // Nettoyer l'ensemble après un délai pour éviter une croissance infinie
    setTimeout(() => {
      processedEmails.delete(uniqueId);
    }, 10000); // 10 secondes
    
    console.log('Demande d\'envoi d\'email reçue');
    
    // Créer un transporteur SMTP avec Gmail
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailData.from,
        pass: emailData.password // Mot de passe d'application Google
      }
    });
    
    // Options de l'email
    const mailOptions = {
      from: emailData.from,
      to: emailData.to,
      subject: emailData.subject,
      text: emailData.text,
      attachments: emailData.attachments || []
    };
    
    // Envoyer l'email
    const info = await transporter.sendMail(mailOptions);
    console.log('Email envoyé:', info.messageId);
    
    // Répondre au renderer process
    event.reply('email-sent', {
      success: true,
      messageId: info.messageId
    });
  } catch (error) {
    console.error('Erreur lors de l\'envoi de l\'email:', error);
    
    // Répondre avec l'erreur
    event.reply('email-sent', {
      success: false,
      error: error.message
    });
  }
});

// --- GESTION SAUVEGARDE ---
ipcMain.handle('perform-backup', async (event, sourcePaths) => {
  console.log('[Main] Demande de sauvegarde reçue. Sources:', sourcePaths);
  try {
    // 1. Demander à l'utilisateur où sauvegarder (choisir un dossier)
    const { canceled, filePaths } = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow(), {
      title: 'Choisir le dossier de sauvegarde',
      properties: ['openDirectory', 'createDirectory'] // Permet de choisir ou créer un dossier
    });

    if (canceled || filePaths.length === 0) {
      console.log('[Main] Sauvegarde annulée par l\'utilisateur.');
      return { success: false, message: 'Sauvegarde annulée.' };
    }

    const backupDir = filePaths[0];
    console.log(`[Main] Dossier de sauvegarde choisi: ${backupDir}`);

    // 2. Copier les fichiers sources vers le dossier de sauvegarde
    const copiedFiles = [];
    const errors = [];

    for (const key in sourcePaths) {
      const sourcePath = sourcePaths[key];
      if (sourcePath && fs.existsSync(sourcePath)) { // Vérifier si le fichier source existe
        const fileName = path.basename(sourcePath);
        const targetPath = path.join(backupDir, fileName);
        try {
          fs.copyFileSync(sourcePath, targetPath);
          console.log(`[Main] Fichier copié: ${fileName} vers ${backupDir}`);
          copiedFiles.push(fileName);
        } catch (copyError) {
          console.error(`[Main] Erreur lors de la copie de ${fileName}:`, copyError);
          errors.push(`Erreur copie ${fileName}: ${copyError.message}`);
        }
      } else {
        console.warn(`[Main] Fichier source non trouvé ou chemin invalide, ignoré: ${sourcePath}`);
      }
    }

    if (errors.length > 0) {
      return { success: false, message: `Sauvegarde terminée avec des erreurs:\n${errors.join('\n')}` };
    }
    if (copiedFiles.length === 0) {
        return { success: false, message: 'Aucun fichier de données trouvé à sauvegarder.' };
    }
    return { success: true, message: `Sauvegarde réussie dans ${backupDir}\nFichiers copiés: ${copiedFiles.join(', ')}` };

  } catch (error) {
    console.error('[Main] Erreur inattendue lors de la sauvegarde:', error);
    return { success: false, message: `Erreur de sauvegarde: ${error.message}` };
  }
});

// --- GESTION RESTAURATION ---
ipcMain.handle('perform-restore', async (event, targetPaths) => {
  console.log('[Main] Demande de restauration reçue. Cibles:', targetPaths);
  try {
    // 1. Demander à l'utilisateur de choisir le dossier contenant la sauvegarde
    const { canceled, filePaths } = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow(), {
      title: 'Choisir le dossier contenant la sauvegarde',
      properties: ['openDirectory']
    });

    if (canceled || filePaths.length === 0) {
      console.log('[Main] Restauration annulée par l\'utilisateur.');
      return { success: false, message: 'Restauration annulée.' };
    }

    const backupDir = filePaths[0];
    console.log(`[Main] Dossier de sauvegarde choisi pour restauration: ${backupDir}`);

    // 2. CONFIRMER L'ÉCRASEMENT
    const confirmation = await dialog.showMessageBox(BrowserWindow.getFocusedWindow(), {
      type: 'warning',
      buttons: ['Annuler', 'Restaurer et Écraser'],
      defaultId: 0, // Le bouton Annuler est sélectionné par défaut
      title: 'Confirmation de Restauration',
      message: 'Êtes-vous sûr de vouloir restaurer les données ?',
      detail: 'Cela écrasera les fichiers de données actuels (clients, factures, tâches) par ceux du dossier de sauvegarde sélectionné. Cette action est irréversible.'
    });

    if (confirmation.response === 0) { // 0 est l'index de 'Annuler'
      console.log('[Main] Restauration annulée après confirmation.');
      return { success: false, message: 'Restauration annulée.' };
    }

    // 3. Copier les fichiers depuis la sauvegarde vers les emplacements cibles
    const restoredFiles = [];
    const errors = [];
    let filesFoundInBackup = false;

    for (const key in targetPaths) {
      const targetPath = targetPaths[key];
      if (targetPath) {
        const fileName = path.basename(targetPath);
        const backupSourcePath = path.join(backupDir, fileName);

        if (fs.existsSync(backupSourcePath)) { // Vérifier si le fichier existe DANS LA SAUVEGARDE
          filesFoundInBackup = true;
          try {
            fs.copyFileSync(backupSourcePath, targetPath); // Copie backup -> cible
            console.log(`[Main] Fichier restauré: ${fileName} depuis ${backupDir}`);
            restoredFiles.push(fileName);
          } catch (copyError) {
            console.error(`[Main] Erreur lors de la restauration de ${fileName}:`, copyError);
            errors.push(`Erreur restauration ${fileName}: ${copyError.message}`);
          }
        } else {
          console.warn(`[Main] Fichier ${fileName} non trouvé dans le dossier de sauvegarde ${backupDir}, ignoré.`);
        }
      }
    }

     if (!filesFoundInBackup) {
        return { success: false, message: `Aucun fichier de données (.json) trouvé dans le dossier de sauvegarde sélectionné: ${backupDir}` };
    }
    if (errors.length > 0) {
      return { success: false, message: `Restauration terminée avec des erreurs:\n${errors.join('\n')}` };
    }
    return { success: true, message: `Restauration réussie depuis ${backupDir}\nFichiers restaurés: ${restoredFiles.join(', ')}.\nL'application va recharger les données.` };

  } catch (error) {
    console.error('[Main] Erreur inattendue lors de la restauration:', error);
    return { success: false, message: `Erreur de restauration: ${error.message}` };
  }
});

app.whenReady().then(() => {
  createWindow();
  
  // Configuration Mac OS X
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quitter quand toutes les fenêtres sont fermées, sauf sur macOS
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});