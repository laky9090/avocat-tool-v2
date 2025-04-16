// Gestionnaire de modales
// Ce fichier centralise toutes les opérations liées aux modales

// Ouvrir la modale de facture
function openInvoiceModal() {
    console.log('Ouverture de la modale de facture');
    
    // IMPORTANT: vérifier d'abord que nous avons des clients
    if (!window.clients || !Array.isArray(window.clients) || window.clients.length === 0) {
        console.warn('Aucun client disponible, chargement des clients...');
        loadClients();
        
        // Si toujours pas de clients après le chargement
        if (!window.clients || window.clients.length === 0) {
            alert('Vous devez avoir au moins un client pour créer une facture. Veuillez ajouter un client dans la section Client.');
            return;
        }
    }
    
    // Recréer la modale
    recreateInvoiceModal();
    
    // Peupler la liste des clients
    populateClientSelect();
    
    // Afficher la modale
    const modal = document.getElementById('invoiceModal');
    if (modal) {
        modal.style.display = 'flex';
    } else {
        console.error('Modale introuvable après recréation');
    }
}

// Fonction cruciale qui recrée entièrement la modale à partir du template HTML
function recreateInvoiceModal() {
    // 1. Supprimer la modale existante si elle existe
    const existingModal = document.getElementById('invoiceModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // 2. Recréer la modale complète avec le même HTML que dans finance.html
    const modalHTML = `
    <div id="invoiceModal" class="modal">
        <div class="modal-content">
            <button class="close-modal">×</button>
            <h2>Création de facture</h2>
            <form id="invoiceForm">
                <!-- En-tête de facture -->
                <div class="form-group">
                    <label>Client :</label>
                    <select id="clientSelect" required></select>
                </div>

                <!-- Tableau des prestations -->
                <div class="form-group">
                    <table class="invoice-table">
                        <thead>
                            <tr>
                                <th>Description de la prestation</th>
                                <th>Montant HT</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="prestationsContainer">
                            <tr class="prestation-item">
                                <td><input type="text" class="prestation-desc" placeholder="Description" required></td>
                                <td><input type="number" class="prestation-amount" placeholder="0.00" step="0.01" required onchange="updateTotals()"></td>
                                <td><button type="button" class="remove-row" onclick="removeRow(this)">×</button></td>
                            </tr>
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colspan="3">
                                    <button type="button" class="add-row">+ Ajouter une ligne</button>
                                </td>
                            </tr>
                            <tr class="totals">
                                <td>Total HT</td>
                                <td id="invoiceTotalHT">0.00 €</td>
                                <td></td>
                            </tr>
                            <tr class="totals">
                                <td>TVA (20%)</td>
                                <td id="invoiceTVA">0.00 €</td>
                                <td></td>
                            </tr>
                            <tr class="totals">
                                <td>Total TTC</td>
                                <td id="invoiceTotalTTC">0.00 €</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <div class="button-group">
                    <button type="submit" class="primary-button">Générer et envoyer la facture</button>
                    <button type="button" class="secondary-button close-modal">Annuler</button>
                </div>
            </form>
        </div>
    </div>`;
    
    // 3. Ajouter la modale au DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // 4. Attacher les événements
    setupModalEvents();
}

// Configuration des événements de la modale
function setupModalEvents() {
    // Gestion de la fermeture
    const modal = document.getElementById('invoiceModal');
    const closeButtons = document.querySelectorAll('.close-modal');
    
    closeButtons.forEach(button => {
        button.addEventListener('click', closeInvoiceModal);
    });
    
    // Soumission du formulaire
    const form = document.getElementById('invoiceForm');
    if (form) {
        form.addEventListener('submit', handleInvoiceSubmission);
    }
    
    // Ajout de ligne
    const addButton = document.querySelector('.add-row');
    if (addButton) {
        addButton.addEventListener('click', addRow);
    }
    
    // IMPORTANT: Événements sur les champs de montant pour calculer les totaux
    const amountInputs = document.querySelectorAll('.prestation-amount');
    amountInputs.forEach(input => {
        input.addEventListener('input', updateTotals);
        input.addEventListener('change', updateTotals);
    });
}

// Fermer la modale de facture
function closeInvoiceModal() {
    const modal = document.getElementById('invoiceModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Ajouter une ligne de prestation
function addRow() {
    const container = document.getElementById('prestationsContainer');
    if (container) {
        const newRow = document.createElement('tr');
        newRow.className = 'prestation-item';
        newRow.innerHTML = `
            <td><input type="text" class="prestation-desc" placeholder="Description" required></td>
            <td><input type="number" class="prestation-amount" placeholder="0.00" step="0.01" required onchange="updateTotals()"></td>
            <td><button type="button" class="remove-row" onclick="removeRow(this)">×</button></td>
        `;
        container.appendChild(newRow);
        
        // Ajouter l'événement sur le champ de montant
        const input = newRow.querySelector('.prestation-amount');
        if (input) {
            input.addEventListener('input', updateTotals);
            input.addEventListener('change', updateTotals);
        }
    }
}

// Supprimer une ligne de prestation
function removeRow(button) {
    const container = document.getElementById('prestationsContainer');
    if (container && container.children.length > 1) {
        button.closest('tr').remove();
        updateTotals();
    }
}