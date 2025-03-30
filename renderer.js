const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { dialog, shell } = require('@electron/remote');
const cheminFichier = path.join(__dirname, 'clients.json');

// Fonction pour formater une date au format français
function formatDateFr(dateStr) {
  if (!dateStr) return "–";
  const [yyyy, mm, dd] = dateStr.split("-");
  return `${dd}-${mm}-${yyyy}`;
}

// Fonction pour ajouter ou modifier un client
function ajouterOuModifierClient() {
  try {
    const nom = document.getElementById('nom').value;
    const type = document.getElementById('type').value;
    const dateAudience = document.getElementById('dateAudience').value;
    const dateContact = document.getElementById('dateContact').value;
    const dateEcheance = document.getElementById('dateEcheance').value;
    const commentaire = document.getElementById('commentaire').value;
    const indexModif = document.getElementById('indexModif').value;

    if (!nom || !type) {
      alert("Merci de remplir les champs obligatoires.");
      return;
    }

    let clients = fs.existsSync(cheminFichier)
      ? JSON.parse(fs.readFileSync(cheminFichier))
      : [];
    const client = { nom, type, dateAudience, dateContact, dateEcheance, commentaire };

    if (indexModif === "") {
      clients.push(client);
    } else {
      // Gestion des fichiers joints en cas de changement de nom
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
    document.getElementById('nom').value = '';
    document.getElementById('type').value = '';
    document.getElementById('dateAudience').value = '';
    document.getElementById('dateContact').value = '';
    document.getElementById('dateEcheance').value = '';
    document.getElementById('commentaire').value = '';
  } catch (error) {
    console.error("Erreur dans ajouterOuModifierClient:", error);
    alert("Une erreur est survenue lors de l'enregistrement du client.");
  }
}

// Fonction pour charger et afficher la liste des clients
function chargerClients() {
  try {
    const data = fs.existsSync(cheminFichier)
      ? JSON.parse(fs.readFileSync(cheminFichier))
      : [];
    afficherClients(data);
  } catch (error) {
    console.error("Erreur dans chargerClients:", error);
    alert("Impossible de charger les clients.");
  }
}

// Affiche les clients dans la liste
function afficherClients(clients) {
  const liste = document.getElementById('listeClients');
  liste.innerHTML = '';
  clients.forEach((client, index) => {
    const li = document.createElement('li');
    li.className = 'client-item';
    const info = document.createElement('div');
    info.innerHTML = `
      <p><strong>${client.nom}</strong> (${client.type})</p>
      <p>Date audience : ${formatDateFr(client.dateAudience)}</p>
      <p>Échéance juridique : ${formatDateFr(client.dateEcheance)}</p>
      <p>Dernier contact : ${formatDateFr(client.dateContact)}</p>
      <p>${client.commentaire || ''}</p>
    `;
    const buttons = document.createElement('div');
    buttons.className = 'client-buttons';
    const btnVoir = document.createElement('button');
    btnVoir.textContent = 'Voir la fiche';
    btnVoir.onclick = () => afficherFicheClient(client);
    const btnModifier = document.createElement('button');
    btnModifier.textContent = 'Modifier';
    btnModifier.onclick = () => {
      document.getElementById('nom').value = client.nom;
      document.getElementById('type').value = client.type;
      document.getElementById('dateAudience').value = client.dateAudience;
      document.getElementById('dateContact').value = client.dateContact;
      document.getElementById('dateEcheance').value = client.dateEcheance;
      document.getElementById('commentaire').value = client.commentaire;
      document.getElementById('indexModif').value = index;
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
    li.appendChild(info);
    afficherFichiersJoints(client, li);
    li.appendChild(buttons);
    liste.appendChild(li);
  });
}

// Affiche la fiche détaillée d'un client
function afficherFicheClient(client) {
  const fiche = document.getElementById('fiche-detaillee');
  fiche.innerHTML = `
    <h3>Fiche détaillée</h3>
    <p><strong>Nom :</strong> ${client.nom}</p>
    <p><strong>Type :</strong> ${client.type}</p>
    <p><strong>Date audience :</strong> ${formatDateFr(client.dateAudience)}</p>
    <p><strong>Échéance juridique :</strong> ${formatDateFr(client.dateEcheance)}</p>
    <p><strong>Dernier contact :</strong> ${formatDateFr(client.dateContact)}</p>
    <p><strong>Commentaire :</strong> ${client.commentaire || '–'}</p>
    <button onclick="document.getElementById('fiche-detaillee').style.display='none'">Fermer</button>
  `;
  fiche.style.display = 'block';
}

// Filtrer la liste des clients en fonction de la recherche
function filtrerClients() {
  try {
    const filtre = document.getElementById('recherche').value.toLowerCase();
    const data = fs.existsSync(cheminFichier)
      ? JSON.parse(fs.readFileSync(cheminFichier))
      : [];
    const resultat = data.filter(client =>
      `${client.nom} ${client.type} ${client.commentaire}`.toLowerCase().includes(filtre)
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
      contenu += `<p><strong>${c.nom}</strong> - ${c.type} - Audience : ${formatDateFr(c.dateAudience)} - Échéance : ${formatDateFr(c.dateEcheance)} - Contact : ${formatDateFr(c.dateContact)}</p>`;
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

// Afficher le calendrier des audiences et échéances
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
          evt.textContent = `${client.nom} (${client.dateAudience === dateStr ? 'Audience' : 'Éch'})`;
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

// Fonction pour exporter la fiche client en PDF
// La structure de la fiche est similaire à celle des fichiers de Jean-Christophe ou Candice.
function exporterFichePDF(client) {
  try {
    const { nom, type, dateAudience, dateEcheance, dateContact, commentaire } = client;
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
    doc.text(`Date d’échéance juridique : ${formatDateFr(dateEcheance)}`);
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

// Ajout d'écouteurs d'événements pour filtrer et trier
document.getElementById('recherche').addEventListener('input', filtrerClients);
document.getElementById('tri').addEventListener('change', appliquerTri);

// Chargement initial des clients
chargerClients();
