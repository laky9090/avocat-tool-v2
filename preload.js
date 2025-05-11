const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

// Exposer des modules Node et des fonctions IPC de manière sécurisée au processus de rendu
contextBridge.exposeInMainWorld('electronAPI', {
    ipcRenderer: {
        send: (channel, data) => ipcRenderer.send(channel, data),
        invoke: (channel, data) => ipcRenderer.invoke(channel, data),
        on: (channel, func) => {
            // Pour éviter les fuites de mémoire, nettoyez les listeners si nécessaire
            const subscription = (event, ...args) => func(...args);
            ipcRenderer.on(channel, subscription);
            return () => ipcRenderer.removeListener(channel, subscription); // Fonction pour se désabonner
        },
        removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
    },
    fs: fs, // Exposer le module fs (synchrone pour la simplicité ici, mais l'asynchrone est mieux)
    path: path, // Exposer le module path
    getAppPath: (name) => ipcRenderer.invoke('get-app-path', name) // Pour obtenir des chemins comme userData
});

console.log('preload.js chargé');