const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { dialog, shell } = require('@electron/remote');
const cheminFichier = path.join(__dirname, 'clients.json');
let originalClientData = null;
let currentView = 'active';
let currentCalendarDate = new Date();




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
    // Filtrage selon la vue active/archivée
    if (currentView === 'active' && client.archived) return;
    if (currentView === 'archived' && !client.archived) return;

    const li = document.createElement('li');
    li.className = 'client-item';
    
    // Contenu synthétique (résumé)
    const info = document.createElement('div');
    info.innerHTML = `
      <p><strong>${client.nom}</strong> (${client.type})</p>
      <p>Montant total (HT) : ${client.montantTotal || '0'} €</p>
      ${client.archived ? '<p style="color:red;">[Archivé]</p>' : ''}
    `;
    
    // Créez le conteneur détaillé, caché par défaut
    const detailDiv = document.createElement('div');
    detailDiv.className = 'client-detail';
    detailDiv.style.display = 'none';
    detailDiv.innerHTML = `
      <p>Adresse : ${client.adresse || ''}</p>
      <p>Téléphone : ${client.telephone || ''}</p>
      <p>Email : ${client.email || ''}</p>
      <p>Profession : ${client.profession || ''}</p>
      <p>Tribunal compétent : ${client.tribunal || '–'}</p>
      <p>Date d'audience : ${formatDateFr(client.dateAudience)}</p>
      <p>Date d'entrée du dossier : ${formatDateFr(client.dateEcheance)}</p>
      <p>Dernier contact : ${formatDateFr(client.dateContact)}</p>
      <p>Commentaire : ${client.commentaire || '–'}</p>
      <hr>
      <p><strong>Adverse</strong></p>
      <p>Nom : ${client.nomAdverse || ''}</p>
      <p>Adresse : ${client.adresseAdverse || ''}</p>
      <p>Téléphone : ${client.telephoneAdverse || ''}</p>
      <p>Email : ${client.emailAdverse || ''}</p>
      <p>Profession : ${client.professionAdverse || ''}</p>
      <p>Aide juridictionnelle : ${client.aideJuridictionnelle || 'non'}</p>
      <p>Montant payé (HT) : ${client.montantPaye || '0'} €</p>
      <p>Reste à facturer (HT) : ${client.resteAFacturer || '0'} €</p>
    `;
    
    // Créez le conteneur des boutons
    const buttons = document.createElement('div');
    buttons.className = 'client-buttons';

    // Bouton pour basculer l'affichage détaillé
    const btnToggleDetail = document.createElement('button');
    const btnVoir = null; // évite l’erreur plus bas si le code s’attend à cette variable


    btnToggleDetail.textContent = 'Voir la fiche';
    btnToggleDetail.onclick = () => {
      if (detailDiv.style.display === 'none') {
        detailDiv.style.display = 'block';
        btnToggleDetail.textContent = 'Cacher la fiche';
      } else {
        detailDiv.style.display = 'none';
        btnToggleDetail.textContent = 'Voir la fiche';
      }
    };
    buttons.appendChild(btnToggleDetail);
    
    
    const btnModifier = document.createElement('button');
    btnModifier.textContent = 'Modifier';
    btnModifier.onclick = () => {
      // Remplissage du formulaire pour modification
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
      // Stocker les données originales pour vérifier les modifications
      originalClientData = { /* ... */ };
      
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
    
    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = client.archived ? 'Désarchiver' : 'Archiver';
    toggleBtn.onclick = () => toggleArchive(index);
    
    // Ajoutez les autres boutons dans le conteneur
    buttons.appendChild(btnModifier);
    buttons.appendChild(btnJoindre);
    buttons.appendChild(btnExporter);
    buttons.appendChild(btnSuppr);
    buttons.appendChild(toggleBtn);
    
    // Ajoutez les éléments dans le li dans l'ordre souhaité
    li.appendChild(info);
    li.appendChild(detailDiv);
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
  // Mettre à jour les classes
  document.getElementById('btnActive').classList.remove('active');
  document.getElementById('btnArchived').classList.remove('active');
  if (view === 'active') {
    document.getElementById('btnActive').classList.add('active');
  } else {
    document.getElementById('btnArchived').classList.add('active');
  }
  // Recharger la liste des clients
  chargerClients();
}





function toggleCalendar() {
  // Utilise le conteneur du calendrier qui est dans la section des statistiques
  const calendarArea = document.getElementById('calendarArea');
  const btnToggleCalendar = document.getElementById('btnCalendrier');
  
  if (calendarArea.style.display === 'none' || calendarArea.style.display === '') {
    // Afficher le calendrier
    calendarArea.style.display = 'block';
    btnToggleCalendar.textContent = 'Cacher le calendrier';
    
    // Dans le conteneur calendarArea, on suppose qu'il contient un sous-conteneur #calendrier
    const calendarDiv = document.getElementById('calendrier');
    calendarDiv.innerHTML = ''; // Réinitialiser le contenu du calendrier

    // Créer le sélecteur de vue
    const viewSelect = document.createElement('select');
    viewSelect.id = 'calendarViewSelect';
    
    const optionWeek = document.createElement('option');
    optionWeek.value = 'week';
    optionWeek.textContent = 'Semaine';
    
    const optionMonth = document.createElement('option');
    optionMonth.value = 'month';
    optionMonth.textContent = 'Mois';
    optionMonth.selected = true;  // Par défaut, "Mois"
    
    const optionYear = document.createElement('option');
    optionYear.value = 'year';
    optionYear.textContent = 'Année';
    
    viewSelect.appendChild(optionWeek);
    viewSelect.appendChild(optionMonth);
    viewSelect.appendChild(optionYear);
    
    viewSelect.addEventListener('change', function() {
      generateCalendar(viewSelect.value);
    });
    
    calendarDiv.appendChild(viewSelect);

    // Créer un conteneur pour le contenu du calendrier
    const contentDiv = document.createElement('div');
    contentDiv.id = 'calendarContent';
    calendarDiv.appendChild(contentDiv);

    // Générer par défaut la vue "Mois"
    generateCalendar('month');
  } else {
    // Cacher le calendrier
    calendarArea.style.display = 'none';
    btnToggleCalendar.textContent = 'Voir le calendrier';
  }
}






function generateCalendar(viewMode) {
  const contentDiv = document.getElementById('calendarContent');
  contentDiv.innerHTML = ''; // Nettoyer le contenu précédent
  if (viewMode === 'week') {
    generateWeeklyCalendar(contentDiv);
  } else if (viewMode === 'month') {
    generateMonthlyCalendar(contentDiv);
  } else if (viewMode === 'year') {
    generateYearlyCalendar(contentDiv);
  }
}


function formatClientDate(dateStr) {
  if (!dateStr) return "";
  const [yyyy, mm, dd] = dateStr.split("-");
  return `${dd}-${mm}-${yyyy}`;
}



function generateWeeklyCalendar(container) {
  // Vider le conteneur de contenu
  container.innerHTML = '';

  // Créer le conteneur de navigation pour la semaine
  const navDiv = document.createElement('div');
  navDiv.style.textAlign = 'center';
  navDiv.style.marginBottom = '10px';

  const btnPrev = document.createElement('button');
  btnPrev.textContent = 'Précédent';
  btnPrev.onclick = () => {
    currentCalendarDate.setDate(currentCalendarDate.getDate() - 7);
    generateWeeklyCalendar(container);
  };

  const btnNext = document.createElement('button');
  btnNext.textContent = 'Suivant';
  btnNext.onclick = () => {
    currentCalendarDate.setDate(currentCalendarDate.getDate() + 7);
    generateWeeklyCalendar(container);
  };

  navDiv.appendChild(btnPrev);
  navDiv.appendChild(btnNext);
  container.appendChild(navDiv);

  // Calculer le lundi de la semaine en cours (considérons que la semaine commence le lundi)
  const today = new Date(currentCalendarDate);
  const dayOfWeek = today.getDay();
  // Ajuster pour que lundi = 1 (si dimanche, on le traite comme 7)
  const adjustedDay = dayOfWeek === 0 ? 7 : dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() - adjustedDay + 1);

  let html = `<h2>Semaine du ${formatDateFr(monday.toISOString().split('T')[0])}</h2>`;
  html += '<table style="width:100%; border-collapse:collapse;"><tr>';
  ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].forEach(day => {
    html += `<th style="border:1px solid #ddd; padding:5px;">${day}</th>`;
  });
  html += '</tr><tr>';
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    html += `<td style="border:1px solid #ddd; padding:5px;"><strong>${d.getDate()}</strong></td>`;
  }
  html += '</tr></table>';
  container.insertAdjacentHTML('beforeend', html);
}



function generateMonthlyCalendar(container) {
  const annee = currentCalendarDate.getFullYear();
  const moisIndex = currentCalendarDate.getMonth();
  const premierJour = new Date(annee, moisIndex, 1).getDay();
  const nbJours = new Date(annee, moisIndex + 1, 0).getDate();
  const mois = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

  // Créez le conteneur de navigation
  const navDiv = document.createElement('div');
  navDiv.style.textAlign = 'center';
  navDiv.style.marginBottom = '10px';

  const btnPrev = document.createElement('button');
  btnPrev.textContent = 'Précédent';
  btnPrev.onclick = () => {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
    container.innerHTML = ''; // Vider le conteneur
    generateMonthlyCalendar(container);
  };

  const btnNext = document.createElement('button');
  btnNext.textContent = 'Suivant';
  btnNext.onclick = () => {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
    container.innerHTML = ''; // Vider le conteneur
    generateMonthlyCalendar(container);
  };

  navDiv.appendChild(btnPrev);
  navDiv.appendChild(btnNext);
  container.appendChild(navDiv);

  // Lire les clients pour colorer les dates
  const clients = fs.existsSync(cheminFichier) ? JSON.parse(fs.readFileSync(cheminFichier)) : [];

  let html = `<h2>${mois[moisIndex]} ${annee}</h2>`;
  html += '<table style="width:100%; border-collapse:collapse;">';
  html += '<thead><tr>';
  ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].forEach(j => {
    html += `<th style="border:1px solid #ddd; padding:5px;">${j}</th>`;
  });
  html += '</tr></thead><tbody>';

  // Calculez le jour de la semaine pour le 1er du mois
  let adjustedDay = (new Date(annee, moisIndex, 1).getDay() + 6) % 7;
  let row = '<tr>';
  for (let i = 0; i < adjustedDay; i++) {
    row += '<td style="border:1px solid #ddd; padding:5px;"></td>';
  }
  for (let jour = 1; jour <= nbJours; jour++) {
    const td = document.createElement('td');
    td.style.border = "1px solid #ddd";
    td.style.padding = "5px";
    
    // Créez un objet Date pour ce jour
    const d = new Date(annee, moisIndex, jour);
    // Format manuel en "JJ-MM-AAAA"
    const dayStr = ('0' + d.getDate()).slice(-2);
    const monthStr = ('0' + (d.getMonth() + 1)).slice(-2);
    const yearStr = d.getFullYear();
    const dateStr = `${dayStr}-${monthStr}-${yearStr}`;
    
    // Récupérer tous les clients dont l'une des dates correspond à cette cellule
    const matches = clients.filter(c => 
      formatClientDate(c.dateAudience) === dateStr || 
      formatClientDate(c.dateEcheance) === dateStr || 
      formatClientDate(c.dateContact) === dateStr
    );
    
    // Si des correspondances existent, colorer la cellule et définir le tooltip
    if (matches.length > 0) {
      td.style.backgroundColor = '#c8e6c9';
      
      // Construire le texte de l'info-bulle pour chaque correspondance
      const tooltipText = matches.map(c => {
        let infos = [];
        if (formatClientDate(c.dateAudience) === dateStr) {
          infos.push(`Audience: ${c.nom}`);
        }
        if (formatClientDate(c.dateEcheance) === dateStr) {
          infos.push(`Entrée dossier: ${c.nom}`);
        }
        if (formatClientDate(c.dateContact) === dateStr) {
          infos.push(`Contact: ${c.nom}`);
        }
        return infos.join(' | ');
      }).join('\n');
      
      td.title = tooltipText;
    }
    
    td.innerHTML = `<strong>${jour}</strong>`;
    row += td.outerHTML;
    adjustedDay++;
    if (adjustedDay === 7) {
      row += '</tr>';
      html += row;
      row = '<tr>';
      adjustedDay = 0;
    }
  }
  
  
  if (adjustedDay !== 0) {
    for (let i = adjustedDay; i < 7; i++) {
      row += '<td style="border:1px solid #ddd; padding:5px;"></td>';
    }
    row += '</tr>';
    html += row;
  }
  html += '</tbody></table>';
  container.insertAdjacentHTML('beforeend', html);
}



function generateYearlyCalendar(container) {
  // Vider le conteneur de contenu
  container.innerHTML = '';

  // Créer le conteneur de navigation pour l'année
  const navDiv = document.createElement('div');
  navDiv.style.textAlign = 'center';
  navDiv.style.marginBottom = '10px';

  const btnPrev = document.createElement('button');
  btnPrev.textContent = 'Précédent';
  btnPrev.onclick = () => {
    currentCalendarDate.setFullYear(currentCalendarDate.getFullYear() - 1);
    generateYearlyCalendar(container);
  };

  const btnNext = document.createElement('button');
  btnNext.textContent = 'Suivant';
  btnNext.onclick = () => {
    currentCalendarDate.setFullYear(currentCalendarDate.getFullYear() + 1);
    generateYearlyCalendar(container);
  };

  navDiv.appendChild(btnPrev);
  navDiv.appendChild(btnNext);
  container.appendChild(navDiv);

  // Générer la vue annuelle
  const today = new Date(currentCalendarDate);
  const annee = today.getFullYear();
  const mois = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  let html = `<h2>Année ${annee}</h2>`;
  html += '<div style="display:flex; flex-wrap:wrap;">';
  for (let m = 0; m < 12; m++) {
    html += `<div style="flex:1 0 30%; margin:5px; border:1px solid #ddd; padding:5px;">`;
    html += `<h3>${mois[m]}</h3>`;
    const nbJours = new Date(annee, m + 1, 0).getDate();
    html += `<p>${nbJours} jours</p>`;
    html += `</div>`;
  }
  html += '</div>';
  container.insertAdjacentHTML('beforeend', html);
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
  
  document.getElementById('statsContent').innerHTML = statsHtml;
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
      td.style.border = "1px solid #ddd";
      td.style.padding = "5px";
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
