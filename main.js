const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const remoteMain = require('@electron/remote/main');
const nodemailer = require('nodemailer'); // Ajouter à votre fichier main.js d'Electron

// Désactiver l'accélération GPU
app.disableHardwareAcceleration();

// Activer le module remote
remoteMain.initialize(); // Garder uniquement cette initialisation

function createWindow() {
  // Créer la fenêtre du navigateur
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
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

// Dans la configuration des gestionnaires d'événements IPC
ipcMain.on('send-email', async (event, emailData) => {
  try {
    // Récupérer les paramètres d'authentification depuis un fichier de configuration sécurisé
    // ou depuis les variables d'environnement dans un environnement de production
    const emailUser = process.env.EMAIL_USER || emailData.from;
    const emailPass = process.env.EMAIL_PASSWORD; // En production, utiliser une variable d'environnement
    
    if (!emailPass) {
      console.log('Utilisation du mot de passe d\'application fourni dans emailData');
      // En développement, l'application frontend peut fournir le mot de passe
    }
    
    // Créer le transporteur pour l'envoi d'emails
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPass || emailData.password // Récupérer le mot de passe soit de l'env soit des données envoyées
      }
    });
    
    // Supprimer le mot de passe des données transmises pour la sécurité
    delete emailData.password;
    
    // Envoyer l'email
    await transporter.sendMail(emailData);
    
    // Répondre au renderer avec succès
    event.reply('email-sent', { success: true });
  } catch (error) {
    console.error('Erreur lors de l\'envoi de l\'email:', error);
    event.reply('email-sent', { success: false, error: error.message });
  }
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});