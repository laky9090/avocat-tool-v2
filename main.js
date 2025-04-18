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

// Gestionnaire d'événement pour l'envoi d'emails
ipcMain.on('send-email', async (event, emailData) => {
  try {
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

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});