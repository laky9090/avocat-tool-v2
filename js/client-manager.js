// Gestion des clients

// Charger les clients depuis le fichier
function loadClients() {
    try {
        const fs = window.fs;
        // Utilisez directement le chemin de la racine si le dossier js est à la racine
        const clientsPath = window.clientsPath || path.join(__dirname, '../clients.json');
        
        console.log('Tentative de chargement des clients depuis:', clientsPath);
        
        if (!fs) {
            console.error('Module fs non disponible');
            return;
        }
        
        if (fs.existsSync(clientsPath)) {
            console.log('Le fichier clients.json existe');
            const clientsData = fs.readFileSync(clientsPath, 'utf8');
            console.log('Contenu brut du fichier:', clientsData.substring(0, 100) + '...');
            try {
                window.clients = JSON.parse(clientsData || '[]');
                console.log(`${window.clients.length} clients chargés avec succès`);
                
                // Afficher le premier client pour vérification
                if (window.clients.length > 0) {
                    console.log('Premier client:', JSON.stringify(window.clients[0]).substring(0, 100));
                }
            } catch (parseError) {
                console.error('Erreur de parsing JSON:', parseError);
                window.clients = [];
            }
        } else {
            console.warn(`Fichier clients.json introuvable à ${clientsPath}`);
            // Essayer avec un chemin absolu
            const altPath = path.resolve('./clients.json');
            if (fs.existsSync(altPath)) {
                console.log(`Fichier trouvé à ${altPath}, chargement...`);
                const clientsData = fs.readFileSync(altPath, 'utf8');
                window.clients = JSON.parse(clientsData || '[]');
                console.log(`${window.clients.length} clients chargés depuis le chemin alternatif`);
            } else {
                console.error('Fichier introuvable même avec chemin absolu');
                window.clients = [];
            }
        }
    } catch (error) {
        console.error('Erreur lors du chargement des clients:', error);
        window.clients = [];
    }
}

// Peupler la liste déroulante des clients
function populateClientSelect() {
    const select = document.getElementById('clientSelect');
    if (!select) {
        console.error('Element select non trouvé');
        return;
    }

    // Vider la liste
    select.innerHTML = '<option value="">Sélectionner un client</option>';

    if (!Array.isArray(window.clients) || window.clients.length === 0) {
        console.error('Aucun client disponible');
        return;
    }

    // Trier les clients par nom
    const sortedClients = [...window.clients].sort((a, b) => a.nom.localeCompare(b.nom));
    
    // Grouper par statut (archivé ou non)
    const currentGroup = document.createElement('optgroup');
    currentGroup.label = 'Dossiers en cours';
    
    const archivedGroup = document.createElement('optgroup');
    archivedGroup.label = 'Dossiers archivés';

    let currentCount = 0;
    let archivedCount = 0;

    // Ajouter chaque client
    sortedClients.forEach(client => {
        if (client?.numeroDossier && client?.nom) {
            const option = document.createElement('option');
            option.value = client.numeroDossier;
            option.textContent = `${client.nom} ${client.prenom || ''} (${client.numeroDossier})`;
            
            if (client.archived) {
                archivedGroup.appendChild(option);
                archivedCount++;
            } else {
                currentGroup.appendChild(option);
                currentCount++;
            }
        }
    });

    // Ajouter les groupes au select
    if (currentCount > 0) select.appendChild(currentGroup);
    if (archivedCount > 0) select.appendChild(archivedGroup);

    console.log(`Liste des clients peuplée: ${currentCount} actifs, ${archivedCount} archivés`);
}