// Nouveau fichier pour gérer les statistiques financières

// Fonction pour calculer et afficher les statistiques des factures
function updateInvoiceStats() {
    console.log('Mise à jour des statistiques des factures...');
    
    // Vérifier que les factures sont disponibles
    if (!Array.isArray(window.invoices)) {
        console.warn('Les factures ne sont pas disponibles');
        return;
    }
    
    // Initialiser les compteurs
    let sentCount = 0;
    let paidCount = 0;
    let sentHT = 0;
    let sentTTC = 0;
    let paidHT = 0;
    let paidTTC = 0;
    
    // Parcourir toutes les factures
    window.invoices.forEach(invoice => {
        // Calculer les montants
        const totalHT = parseFloat(invoice.totalHT || 0);
        const totalTTC = parseFloat(invoice.totalTTC || totalHT * 1.2 || 0);
        
        // Vérifier si la facture est envoyée ou payée
        const isPaid = invoice.status === 'paid';
        const isSent = invoice.status === 'sent' || isPaid; // Une facture payée est forcément envoyée
        
        // Mettre à jour les compteurs
        if (isSent) {
            sentCount++;
            sentHT += totalHT;
            sentTTC += totalTTC;
        }
        
        if (isPaid) {
            paidCount++;
            paidHT += totalHT;
            paidTTC += totalTTC;
        }
    });
    
    // Formater les montants pour l'affichage (avec séparateur de milliers)
    const formatAmount = amount => {
        return amount.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, " ") + ' €';
    };
    
    // Mettre à jour les éléments HTML
    document.getElementById('invoicesSentCount').textContent = sentCount;
    document.getElementById('invoicesPaidCount').textContent = paidCount;
    document.getElementById('invoicesSentHT').textContent = formatAmount(sentHT);
    document.getElementById('invoicesSentTTC').textContent = formatAmount(sentTTC);
    document.getElementById('invoicesPaidHT').textContent = formatAmount(paidHT);
    document.getElementById('invoicesPaidTTC').textContent = formatAmount(paidTTC);
    
    console.log('Statistiques des factures mises à jour');
}

// Fonction pour initialiser les statistiques
function initInvoiceStats() {
    // Charger les statistiques initiales
    updateInvoiceStats();
    
    // Mettre à jour les statistiques à chaque modification de facture
    document.addEventListener('invoicesUpdated', updateInvoiceStats);
}

// Exposer les fonctions globalement
window.updateInvoiceStats = updateInvoiceStats;
window.initInvoiceStats = initInvoiceStats;

// Initialiser au chargement de la page
document.addEventListener('DOMContentLoaded', initInvoiceStats);