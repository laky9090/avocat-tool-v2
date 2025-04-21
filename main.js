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