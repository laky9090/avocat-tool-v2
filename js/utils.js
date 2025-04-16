// Fonctions utilitaires globales

// Variables globales partagées

// Modification des chemins pour s'assurer qu'ils pointent vers la racine du projet

// Configuration des modules Node.js
const fs = window.fs = require('fs');
const path = window.path = require('path');

// Chemins des fichiers - Utiliser des chemins absolus avec __dirname
const rootPath = path.join(__dirname, '..');  // Remonter d'un niveau (de /js vers la racine)
const invoicesPath = path.join(rootPath, 'invoices.json');
const clientsPath = path.join(rootPath, 'clients.json');

// Exposer les chemins globalement
window.invoicesPath = invoicesPath;
window.clientsPath = clientsPath;

// Afficher les chemins pour vérification
console.log('=== CHEMINS DES FICHIERS ===');
console.log('- Répertoire racine:', rootPath);
console.log('- invoices.json:', invoicesPath);
console.log('- clients.json:', clientsPath);

// Fonction de mise à jour des totaux
function updateTotals() {
    try {
        console.log('Mise à jour des totaux...');
        const items = document.querySelectorAll('.prestation-amount');
        let totalHT = 0;
        
        items.forEach(item => {
            const value = parseFloat(item.value) || 0;
            totalHT += value;
        });
        
        const tva = totalHT * 0.20;
        const totalTTC = totalHT + tva;
        
        document.getElementById('invoiceTotalHT').textContent = totalHT.toFixed(2) + ' €';
        document.getElementById('invoiceTVA').textContent = tva.toFixed(2) + ' €';
        document.getElementById('invoiceTotalTTC').textContent = totalTTC.toFixed(2) + ' €';
    } catch (error) {
        console.error('Erreur lors de la mise à jour des totaux:', error);
    }
}

// Fonction pour formater les montants
function formatMoney(amount) {
    return (Math.round(amount * 100) / 100).toFixed(2) + ' €';
}

// Fonction pour formater les dates
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR');
}

// Rendre les fonctions et variables accessibles globalement