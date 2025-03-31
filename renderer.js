const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { dialog, shell } = require('@electron/remote');
const cheminFichier = path.join(__dirname, 'clients.json');
let originalClientData = null;
let currentView = 'active';



// Formater une date au format français
function formatDateFr(dateStr) {
  if (!dateStr) return "–";
  const [yyyy, mm, dd] = dateStr.split("-");
  return `${dd}-${mm}-${yyyy}`;
}

// Fonction pour ajouter ou modifier un client
function ajouterOuModifierClient() {
  try {
    // Récupération des informations du client
    const nom = document.getElementById('nom').value;
    const adresse = document.getElementById('adresse').value;
    const telephone = document.getElementById('telephone').value;
    const email = document.getElementById('email').value;
    const profession = document.getElementById('profession').value;
    const aideJuridictionnelle = document.getElementById('aideJuridictionnelle').value;
    const tribunal = document.getElementById('tribunal').value;


    
    const type = document.getElementById('type').value;
    const dateAudience = document.getElementById('dateAudience').value;
    const dateContact = document.getElementById('dateContact').value;
    // Utilisation du même champ (dateEcheance) pour "Date d'entrée du dossier"
    const dateEcheance = document.getElementById('dateEcheance').value;
    const commentaire = document.getElementById('commentaire').value;

    const montantTotal = parseFloat(document.getElementById('montantTotal').value) || 0;
    console.log("Montant total récupéré :", montantTotal);
    const montantPaye = parseFloat(document.getElementById('montantPaye').value) || 0;
    
    // const montantFacture = document.getElementById('montantFacture').value;
    const resteAFacturer = montantTotal - montantPaye;

    


    // Récupération des informations de l'adverse
    const nomAdverse = document.getElementById('nomAdverse').value;
    const adresseAdverse = document.getElementById('adresseAdverse').value;
    const telephoneAdverse = document.getElementById('telephoneAdverse').value;
    const emailAdverse = document.getElementById('emailAdverse').value;
    const professionAdverse = document.getElementById('professionAdverse').value;
    
    const indexModif = document.getElementById('indexModif').value;

    if (!nom || !type) {
      alert("Merci de remplir les champs obligatoires (Nom du client et Type de dossier).");
      return;
    }

    let clients = fs.existsSync(cheminFichier)
      ? JSON.parse(fs.readFileSync(cheminFichier))
      : [];
    
    const client = { 
      nom, adresse, telephone, email, profession, tribunal,
      type, dateAudience, dateContact, dateEcheance, commentaire,
      nomAdverse, adresseAdverse, telephoneAdverse, emailAdverse, professionAdverse, aideJuridictionnelle, montantTotal, montantPaye, resteAFacturer
    };

    if (indexModif === "") {
      clients.push(client);
    } else {
      // Si le nom change, gérer le déplacement des fichiers joints
      const ancienNom = clients[indexModif].nom;
      const ancienDossier = path.join(__dirname, 'fichiers_clients', ancienNom.replace(/\s+/g, '_'));
      const nouveauDossier = path.join(__dirname, 'fichiers_clients', nom.replace(/\s+/g, '_'));
      if (ancienNom !== nom && fs.existsSync(ancienDossier)) {
        if (!fs.existsSync(nouveauDossier)) fs.mkdirSync(nouveauDossier, { recursive: true });
        fs.readdirSync(ancienDossier).forEach(fichier => {
          const src = path.join(ancienDossier, fichier);
          const dest = path.join(nouveauDossier, fichier);
          fs.copyFileSync(src, dest);
        });
      }
      clients[indexModif] = client;
      document.getElementById('indexModif').value = "";
    }

    fs.writeFileSync(cheminFichier, JSON.stringify(clients, null, 2));
    chargerClients();

    // Réinitialisation des champs du formulaire
    document.getElementById('nom').value = '';
    document.getElementById('adresse').value = '';
    document.getElementById('telephone').value = '';
    document.getElementById('email').value = '';
    document.getElementById('profession').value = '';
    document.getElementById('type').value = '';
    document.getElementById('dateAudience').value = '';
    document.getElementById('dateContact').value = '';
    document.getElementById('dateEcheance').value = '';
    document.getElementById('commentaire').value = '';
    document.getElementById('tribunal').value = '';

    document.getElementById('montantTotal').value = '';
    document.getElementById('montantPaye').value = '';   
    document.getElementById('resteAFacturer').value = '';

    
    document.getElementById('nomAdverse').value = '';
    document.getElementById('adresseAdverse').value = '';
    document.getElementById('telephoneAdverse').value = '';
    document.getElementById('emailAdverse').value = '';
    document.getElementById('professionAdverse').value = '';
  } catch (error) {
    console.error("Erreur dans ajouterOuModifierClient:", error);
    alert("Une erreur est survenue lors de l'enregistrement du client.");
  }
}

// Charger et afficher la liste des clients
function chargerClients() {
  try {
    const data = fs.existsSync(cheminFichier)
      ? JSON.parse(fs.readFileSync(cheminFichier))
      : [];
    afficherClients(data);
    
    // Mettre à jour les statistiques après avoir affiché les clients
    updateStats();
  } catch (error) {
    console.error("Erreur dans chargerClients:", error);
    alert("Impossible de charger les clients.");
  }
}


// Afficher les clients dans la liste
function afficherClients(clients) {
  const liste = document.getElementById('listeClients');
  liste.innerHTML = '';
  clients.forEach((client, index) => {
    // Filtrer selon la vue sélectionnée
    if (currentView === 'active' && client.archived) return;
    if (currentView === 'archived' && !client.archived) return;

    const li = document.createElement('li');
    li.className = 'client-item';
    const info = document.createElement('div');
    info.innerHTML = `
      <p><strong>${client.nom}</strong> (${client.type})</p>
      <p>Adresse : ${client.adresse || ''}</p>
      <p>Téléphone : ${client.telephone || ''}</p>
      <p>Montant total (HT) : ${client.montantTotal || '0'} €</p>
    `;
    
    // Ajoutez un bouton de bascule pour archiver/désarchiver
    const toggleBtn = document.createElement('button');
    if (client.archived) {
      toggleBtn.textContent = 'Désarchiver';
    } else {
      toggleBtn.textContent = 'Archiver';
    }
    toggleBtn.onclick = () => toggleArchive(index);
    
    // Les boutons existants (Voir, Modifier, etc.)
    const buttons = document.createElement('div');
    buttons.className = 'client-buttons';
    const btnVoir = document.createElement('button');
    btnVoir.textContent = 'Voir la fiche';
    btnVoir.onclick = () => afficherFicheClient(client);
    const btnModifier = document.createElement('button');
    btnModifier.textContent = 'Modifier';
    btnModifier.onclick = () => {
      // Remplissage du formulaire pour modification...
      // (Le code existant de remplissage et stockage d'originalClientData)
      // Par exemple :
      document.getElementById('nom').value = client.nom;
      document.getElementById('adresse').value = client.adresse;
      document.getElementById('telephone').value = client.telephone;
      document.getElementById('email').value = client.email;
      document.getElementById('profession').value = client.profession;
      if(document.getElementById('tribunal')) {
        document.getElementById('tribunal').value = client.tribunal;
      }
      document.getElementById('type').value = client.type;
      document.getElementById('dateAudience').value = client.dateAudience;
      document.getElementById('dateContact').value = client.dateContact;
      document.getElementById('dateEcheance').value = client.dateEcheance;
      document.getElementById('commentaire').value = client.commentaire;
      
      document.getElementById('nomAdverse').value = client.nomAdverse;
      document.getElementById('adresseAdverse').value = client.adresseAdverse;
      document.getElementById('telephoneAdverse').value = client.telephoneAdverse;
      document.getElementById('emailAdverse').value = client.emailAdverse;
      document.getElementById('professionAdverse').value = client.professionAdverse;
      
      document.getElementById('aideJuridictionnelle').value = client.aideJuridictionnelle;
      document.getElementById('montantTotal').value = client.montantTotal;
      document.getElementById('montantPaye').value = client.montantPaye;
      
      document.getElementById('indexModif').value = index;
      
      // Stockage des données originales pour comparaison
      originalClientData = { /* ... */ };
      
      // Affiche le bouton Annuler (code existant)
      document.getElementById('annulerBtn').style.display = 'inline-block';
      checkFormChanges();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    const btnExporter = document.createElement('button');
    btnExporter.textContent = 'Exporter en PDF';
    btnExporter.onclick = () => exporterFichePDF(client);
    const btnJoindre = document.createElement('button');
    btnJoindre.textContent = 'Joindre un fichier';
    btnJoindre.onclick = () => joindreFichier(client);
    const btnSuppr = document.createElement('button');
    btnSuppr.textContent = 'Supprimer';
    btnSuppr.onclick = () => {
      clients.splice(index, 1);
      fs.writeFileSync(cheminFichier, JSON.stringify(clients, null, 2));
      chargerClients();
    };

    buttons.appendChild(btnVoir);
    buttons.appendChild(btnModifier);
    buttons.appendChild(btnJoindre);
    buttons.appendChild(btnExporter);
    buttons.appendChild(btnSuppr);
    // Ajoutez le bouton de bascule (toggle) à la fin
    buttons.appendChild(toggleBtn);
    
    li.appendChild(info);
    afficherFichiersJoints(client, li);
    li.appendChild(buttons);
    liste.appendChild(li);
  });
}



function toggleArchive(index) {
  let clients = fs.existsSync(cheminFichier)
    ? JSON.parse(fs.readFileSync(cheminFichier))
    : [];
  // Basculer la propriété "archived" (si inexistante, on la considère comme false)
  clients[index].archived = !clients[index].archived;
  fs.writeFileSync(cheminFichier, JSON.stringify(clients, null, 2));
  chargerClients();
}


function switchView(view) {
  currentView = view;
  // (Optionnel) Vous pouvez mettre à jour l'apparence des boutons ici
  if(view === 'active') {
    document.getElementById('btnActive').classList.add('active');
    document.getElementById('btnArchived').classList.remove('active');
  } else {
    document.getElementById('btnActive').classList.remove('active');
    document.getElementById('btnArchived').classList.add('active');
  }
  chargerClients();
}



function updateStats() {
  // Récupère tous les clients
  const clients = fs.existsSync(cheminFichier) ? JSON.parse(fs.readFileSync(cheminFichier)) : [];
  
  // Initialisation des compteurs
  let openCount = 0;
  let archivedCount = 0;
  let sumMontantTotal = 0;
  let sumMontantPaye = 0;
  let sumReste = 0;
  
  clients.forEach(client => {
    // On considère que si la propriété archived est true, c'est un dossier archivé
    if (client.archived) {
      archivedCount++;
    } else {
      openCount++;
    }
    
    // S'assurer de convertir les valeurs en nombres
    sumMontantTotal += parseFloat(client.montantTotal) || 0;
    sumMontantPaye += parseFloat(client.montantPaye) || 0;
    sumReste += parseFloat(client.resteAFacturer) || 0;
  });
  
  // Création du contenu HTML pour la section de statistiques
  const statsHtml = `
    <p>Total dossiers ouverts : ${openCount}</p>
    <p>Total dossiers archivés : ${archivedCount}</p>
    <p>Montant total (HT) : ${sumMontantTotal.toFixed(2)} €</p>
    <p>Montant payé (HT) : ${sumMontantPaye.toFixed(2)} €</p>
    <p>Reste à facturer (HT) : ${sumReste.toFixed(2)} €</p>
  `;
  
  document.getElementById('statsSection').innerHTML = statsHtml;
}




function checkFormChanges() {
  if (!originalClientData) return; // Si aucune modification en cours, on ne fait rien
  
  const currentData = {
    nom: document.getElementById('nom').value,
    adresse: document.getElementById('adresse').value,
    telephone: document.getElementById('telephone').value,
    email: document.getElementById('email').value,
    profession: document.getElementById('profession').value,
    tribunal: document.getElementById('tribunal') ? document.getElementById('tribunal').value : '',
    type: document.getElementById('type').value,
    dateAudience: document.getElementById('dateAudience').value,
    dateContact: document.getElementById('dateContact').value,
    dateEcheance: document.getElementById('dateEcheance').value,
    commentaire: document.getElementById('commentaire').value,
    nomAdverse: document.getElementById('nomAdverse').value,
    adresseAdverse: document.getElementById('adresseAdverse').value,
    telephoneAdverse: document.getElementById('telephoneAdverse').value,
    emailAdverse: document.getElementById('emailAdverse').value,
    professionAdverse: document.getElementById('professionAdverse').value,
    aideJuridictionnelle: document.getElementById('aideJuridictionnelle').value,
    montantTotal: document.getElementById('montantTotal').value,
    montantPaye: document.getElementById('montantPaye').value
  };
  
  let modified = false;
  for (let key in originalClientData) {
    if (originalClientData[key] != currentData[key]) {
      modified = true;
      break;
    }
  }
  
  document.getElementById('enregistrerBtn').disabled = !modified;
}



function annulerModification() {
  // Réinitialiser tous les champs du formulaire à vide
  document.getElementById('nom').value = '';
  document.getElementById('adresse').value = '';
  document.getElementById('telephone').value = '';
  document.getElementById('email').value = '';
  document.getElementById('profession').value = '';
  if (document.getElementById('tribunal')) document.getElementById('tribunal').value = '';
  document.getElementById('type').value = '';
  document.getElementById('dateAudience').value = '';
  document.getElementById('dateContact').value = '';
  document.getElementById('dateEcheance').value = '';
  document.getElementById('commentaire').value = '';
  
  document.getElementById('nomAdverse').value = '';
  document.getElementById('adresseAdverse').value = '';
  document.getElementById('telephoneAdverse').value = '';
  document.getElementById('emailAdverse').value = '';
  document.getElementById('professionAdverse').value = '';
  
  document.getElementById('aideJuridictionnelle').value = 'non';
  document.getElementById('montantTotal').value = '';
  document.getElementById('montantPaye').value = '';
  
  // Effacer l'indice de modification et les données originales
  document.getElementById('indexModif').value = '';
  originalClientData = null;
  
  // Désactiver le bouton Enregistrer et masquer le bouton Annuler
  document.getElementById('enregistrerBtn').disabled = true;
  document.getElementById('annulerBtn').style.display = 'none';
}








// Afficher la fiche détaillée d'un client
function afficherFicheClient(client) {
  const fiche = document.getElementById('fiche-detaillee');
  fiche.innerHTML = `
    <h3>Fiche détaillée</h3>
    <p><strong>Client</strong></p>
    <p>Nom : ${client.nom}</p>
    <p>Adresse : ${client.adresse || ''}</p>
    <p>Téléphone : ${client.telephone || ''}</p>
    <p>Email : ${client.email || ''}</p>
    <p>Profession : ${client.profession || ''}</p>
    <p>Tribunal compétent : ${client.tribunal || '–'}</p>
    <p>Type de dossier : ${client.type}</p>
    <p>Date d'audience : ${formatDateFr(client.dateAudience)}</p>
    <p>Date d'entrée du dossier : ${formatDateFr(client.dateEcheance)}</p>
    <p>Dernier contact : ${formatDateFr(client.dateContact)}</p>
    <p>Commentaire : ${client.commentaire || '–'}</p>
    <hr>
    <p><strong>Facturation</strong></p>
    <p>Montant total (HT) : ${client.montantTotal || '0'} €</p>
    <p>Montant payé (HT) : ${client.montantPaye || '0'} €</p>
    <p>Reste à facturer (HT) : ${client.resteAFacturer || '0'} €</p>
    <hr>
    <p><strong>Adverse</strong></p>
    <p>Nom : ${client.nomAdverse || ''}</p>
    <p>Adresse : ${client.adresseAdverse || ''}</p>
    <p>Téléphone : ${client.telephoneAdverse || ''}</p>
    <p>Email : ${client.emailAdverse || ''}</p>
    <p>Profession : ${client.professionAdverse || ''}</p>
    <p>Aide juridictionnelle : ${client.aideJuridictionnelle || 'non'}</p>
    <button onclick="document.getElementById('fiche-detaillee').style.display='none'">Fermer</button>
  `;
  fiche.style.display = 'block';
}


// Filtrer les clients en fonction de la recherche
function filtrerClients() {
  try {
    const filtre = document.getElementById('recherche').value.toLowerCase();
    const data = fs.existsSync(cheminFichier)
      ? JSON.parse(fs.readFileSync(cheminFichier))
      : [];
    const resultat = data.filter(client =>
      `${client.nom} ${client.type} ${client.adresse} ${client.telephone} ${client.email} ${client.profession} ${client.commentaire} ${client.nomAdverse} ${client.adresseAdverse} ${client.telephoneAdverse} ${client.emailAdverse} ${client.professionAdverse}`.toLowerCase().includes(filtre)
    );
    afficherClients(resultat);
  } catch (error) {
    console.error("Erreur dans filtrerClients:", error);
  }
}

// Trier la liste des clients selon un critère
function appliquerTri() {
  try {
    const critere = document.getElementById('tri').value;
    const data = fs.existsSync(cheminFichier)
      ? JSON.parse(fs.readFileSync(cheminFichier))
      : [];
    const tries = data.slice().sort((a, b) => {
      if (!a[critere]) return 1;
      if (!b[critere]) return -1;
      if (critere.startsWith('date')) {
        return new Date(a[critere]) - new Date(b[critere]);
      } else {
        return a[critere].localeCompare(b[critere]);
      }
    });
    afficherClients(tries);
  } catch (error) {
    console.error("Erreur dans appliquerTri:", error);
  }
}

// Imprimer tous les dossiers clients
function imprimerTousLesClients() {
  try {
    const clients = fs.existsSync(cheminFichier)
      ? JSON.parse(fs.readFileSync(cheminFichier))
      : [];
    let contenu = `<html><head><title>Dossiers</title></head><body><h1>Liste des clients</h1>`;
    clients.forEach(c => {
      contenu += `<p><strong>${c.nom}</strong> - ${c.type} - Audience : ${formatDateFr(c.dateAudience)} - Date d'entrée du dossier : ${formatDateFr(c.dateEcheance)} - Contact : ${formatDateFr(c.dateContact)}</p>`;
    });
    contenu += `<script>window.onload = () => window.print();<\/script></body></html>`;
    const fenetre = window.open('', '_blank');
    fenetre.document.write(contenu);
    fenetre.document.close();
  } catch (error) {
    console.error("Erreur dans imprimerTousLesClients:", error);
  }
}

// Joindre un fichier à un client
function joindreFichier(client) {
  try {
    const dossierClient = path.join(__dirname, 'fichiers_clients', client.nom.replace(/\s+/g, '_'));
    if (!fs.existsSync(dossierClient)) {
      fs.mkdirSync(dossierClient, { recursive: true });
    }
    dialog.showOpenDialog({
      title: "Choisir un fichier à joindre",
      properties: ['openFile']
    }).then(result => {
      if (!result.canceled && result.filePaths.length > 0) {
        const fichierSource = result.filePaths[0];
        const nomFichier = path.basename(fichierSource);
        const cheminDestination = path.join(dossierClient, nomFichier);
        fs.copyFileSync(fichierSource, cheminDestination);
        alert("Fichier joint avec succès !");
        chargerClients();
      }
    }).catch(err => {
      console.error("Erreur lors de la sélection de fichier :", err);
    });
  } catch (error) {
    console.error("Erreur dans joindreFichier:", error);
  }
}

// Afficher les fichiers joints dans la fiche client
function afficherFichiersJoints(client, container) {
  try {
    const dossierClient = path.join(__dirname, 'fichiers_clients', client.nom.replace(/\s+/g, '_'));
    if (fs.existsSync(dossierClient)) {
      const fichiers = fs.readdirSync(dossierClient);
      if (fichiers.length > 0) {
        const blocFichiers = document.createElement('div');
        blocFichiers.innerHTML = `<strong>Fichiers joints :</strong>`;
        fichiers.forEach(nomFichier => {
          const ligne = document.createElement('div');
          ligne.style.margin = '6px 0';
          ligne.style.display = 'flex';
          ligne.style.alignItems = 'center';
          ligne.style.gap = '10px';
          const lien = document.createElement('a');
          lien.href = '#';
          lien.textContent = nomFichier;
          lien.onclick = () => {
            const chemin = path.join(dossierClient, nomFichier);
            shell.openPath(chemin);
          };
          const boutonSuppr = document.createElement('button');
          boutonSuppr.textContent = "🗑️";
          boutonSuppr.style.padding = "2px 8px";
          boutonSuppr.style.background = "#e74c3c";
          boutonSuppr.style.border = "none";
          boutonSuppr.style.borderRadius = "5px";
          boutonSuppr.style.color = "white";
          boutonSuppr.style.cursor = "pointer";
          boutonSuppr.onclick = () => {
            const chemin = path.join(dossierClient, nomFichier);
            if (fs.existsSync(chemin)) {
              fs.unlinkSync(chemin);
              chargerClients();
            }
          };
          ligne.appendChild(lien);
          ligne.appendChild(boutonSuppr);
          blocFichiers.appendChild(ligne);
        });
        container.appendChild(blocFichiers);
      }
    }
  } catch (error) {
    console.error("Erreur dans afficherFichiersJoints:", error);
  }
}

// Afficher le calendrier des audiences et dates d'entrée du dossier
function afficherCalendrier() {
  try {
    const container = document.getElementById('calendrier');
    const btn = document.getElementById('btnCalendrier');
    if (container.style.display === 'block') {
      container.style.display = 'none';
      btn.textContent = 'Voir le calendrier';
      return;
    }
    container.innerHTML = '';
    container.style.display = 'block';
    btn.textContent = 'Cacher le calendrier';
    const mois = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
    const aujourdhui = new Date();
    const annee = aujourdhui.getFullYear();
    const moisIndex = aujourdhui.getMonth();
    const premierJour = new Date(annee, moisIndex, 1).getDay();
    const nbJours = new Date(annee, moisIndex + 1, 0).getDate();
    const titre = document.createElement('h2');
    titre.textContent = `${mois[moisIndex]} ${annee}`;
    container.appendChild(titre);
    const table = document.createElement('table');
    const jours = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    jours.forEach(j => {
      const th = document.createElement('th');
      th.textContent = j;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    let row = document.createElement('tr');
    let jourSemaine = (premierJour + 6) % 7;
    for (let i = 0; i < jourSemaine; i++) {
      row.appendChild(document.createElement('td'));
    }
    const data = fs.existsSync(cheminFichier)
      ? JSON.parse(fs.readFileSync(cheminFichier))
      : [];
    for (let jour = 1; jour <= nbJours; jour++) {
      const td = document.createElement('td');
      td.innerHTML = `<strong>${jour}</strong><br>`;
      const dateStr = new Date(annee, moisIndex, jour).toISOString().split('T')[0];
      data.forEach(client => {
        if (client.dateAudience === dateStr || client.dateEcheance === dateStr) {
          const evt = document.createElement('div');
          evt.textContent = `${client.nom} (${client.dateAudience === dateStr ? 'Audience' : 'Entrée'})`;
          evt.style.fontSize = '12px';
          evt.style.background = client.dateAudience === dateStr ? '#3498db' : '#e67e22';
          evt.style.color = 'white';
          evt.style.padding = '2px 4px';
          evt.style.marginTop = '4px';
          evt.style.borderRadius = '4px';
          td.appendChild(evt);
        }
      });
      row.appendChild(td);
      jourSemaine++;
      if (jourSemaine === 7) {
        tbody.appendChild(row);
        row = document.createElement('tr');
        jourSemaine = 0;
      }
    }
    if (jourSemaine !== 0) {
      while (jourSemaine++ < 7) row.appendChild(document.createElement('td'));
      tbody.appendChild(row);
    }
    table.appendChild(tbody);
    container.appendChild(table);
  } catch (error) {
    console.error("Erreur dans afficherCalendrier:", error);
  }
}

// Exporter la fiche client en PDF en incluant toutes les informations
function exporterFichePDF(client) {
  try {
    const { nom, adresse, telephone, email, profession,
            type, dateAudience, dateContact, dateEcheance, commentaire,
            nomAdverse, adresseAdverse, telephoneAdverse, emailAdverse, professionAdverse } = client;
    
    const doc = new PDFDocument({ margin: 50 });
    const nomFichier = `${nom.replace(/\s+/g, '_')}_fiche.pdf`;
    const cheminFichierPdf = path.join(__dirname, nomFichier);
    const stream = fs.createWriteStream(cheminFichierPdf);
    doc.pipe(stream);

    // En-tête de la fiche
    doc.fontSize(20).text(`Fiche Client`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(18).text(nom, { align: 'center', underline: true });
    doc.moveDown(1);

    // Informations du dossier
    doc.fontSize(12);
    doc.text(`Type de dossier : ${type}`);
    doc.text(`Date d'audience : ${formatDateFr(dateAudience)}`);
    doc.text(`Date de dernier contact : ${formatDateFr(dateContact)}`);
    // Modification ici
    doc.text(`Date d'entrée du dossier : ${formatDateFr(dateEcheance)}`);
    doc.moveDown();

    // Informations du client
    doc.fontSize(14).text("Informations du client", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Adresse : ${adresse || '–'}`);
    doc.text(`Téléphone : ${telephone || '–'}`);
    doc.text(`Email : ${email || '–'}`);
    doc.text(`Profession : ${profession || '–'}`);
    doc.moveDown();

    // Informations de l'adverse
    doc.fontSize(14).text("Informations de l'adverse", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Nom : ${nomAdverse || '–'}`);
    doc.text(`Adresse : ${adresseAdverse || '–'}`);
    doc.text(`Téléphone : ${telephoneAdverse || '–'}`);
    doc.text(`Email : ${emailAdverse || '–'}`);
    doc.text(`Profession : ${professionAdverse || '–'}`);
    doc.moveDown();

    doc.fontSize(14).text("Facturation :", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Montant total (HT) : ${client.montantTotal || '0'} €`, { indent: 20 });
    doc.text(`Montant payé (HT) : ${client.montantPaye || '0'} €`, { indent: 20 });
    doc.text(`Reste à facturer (HT) : ${client.resteAFacturer || '0'} €`, { indent: 20 });
    doc.moveDown();
    
    

    // Commentaire
    doc.fontSize(14).text("Commentaire :", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12).text(commentaire || "–", { indent: 20 });
    doc.moveDown();

    // Pièces jointes
    const dossierClient = path.join(__dirname, 'fichiers_clients', nom.replace(/\s+/g, '_'));
    if (fs.existsSync(dossierClient)) {
      const fichiers = fs.readdirSync(dossierClient);
      if (fichiers.length > 0) {
        doc.fontSize(14).text('Pièces jointes :', { underline: true });
        doc.moveDown(0.5);
        fichiers.forEach(fichier => {
          doc.fontSize(12).text(`• ${fichier}`, { indent: 20 });
        });
      }
    }

    doc.end();
    stream.on('finish', () => {
      shell.openPath(cheminFichierPdf);
    });
  } catch (error) {
    console.error("Erreur dans exporterFichePDF:", error);
  }
}

// Écouteurs pour filtrer et trier
document.getElementById('recherche').addEventListener('input', filtrerClients);
document.getElementById('tri').addEventListener('change', appliquerTri);

// Chargement initial des clients
chargerClients();

window.addEventListener('load', () => {
  const inputs = document.querySelectorAll('#formClient input, #formClient textarea, #formClient select');
  inputs.forEach(input => {
    input.addEventListener('input', checkFormChanges);
  });
});
