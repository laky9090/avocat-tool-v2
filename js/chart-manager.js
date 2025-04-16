// Gestionnaire de graphiques optimisé

console.log('Initialisation du gestionnaire de graphiques...');

// Variables globales pour les graphiques
window.revenueChart = null;
window.dossiersChart = null;

// Fonction principale pour mettre à jour tous les graphiques
function updateCharts() {
    console.log('Mise à jour de tous les graphiques...');
    
    try {
        // Vérifier que Chart.js est disponible
        if (typeof Chart === 'undefined') {
            console.error('Chart.js n\'est pas disponible!');
            return;
        }
        
        // Mettre à jour les graphiques individuels
        updateRevenueChart();
        updateDossiersChart();
        
        console.log('Tous les graphiques ont été mis à jour');
    } catch (error) {
        console.error('Erreur lors de la mise à jour des graphiques:', error);
    }
}

// Fonction pour mettre à jour le graphique d'évolution du CA
function updateRevenueChart() {
    console.log('Mise à jour du graphique de CA...');
    
    try {
        // Récupérer le canvas
        const canvas = document.getElementById('revenueChart');
        if (!canvas) {
            console.error('Canvas #revenueChart non trouvé!');
            return;
        }
        
        // Forcer une taille minimale au canvas
        canvas.style.width = '100%';
        canvas.style.height = '300px';
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        
        const ctx = canvas.getContext('2d');
        
        // Détruire le graphique existant s'il existe
        if (window.revenueChart instanceof Chart) {
            console.log('Destruction du graphique existant');
            window.revenueChart.destroy();
            window.revenueChart = null;
        }
        
        // Préparer les données
        const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
        const monthlyData = Array(12).fill(0);
        
        // Année actuelle
        const currentYear = new Date().getFullYear();
        
        // Calculer les revenus par mois
        if (window.invoices && Array.isArray(window.invoices)) {
            window.invoices.forEach(invoice => {
                try {
                    const date = new Date(invoice.date);
                    if (date.getFullYear() === currentYear) {
                        const month = date.getMonth();
                        const amount = parseFloat(invoice.totalHT || 0);
                        if (!isNaN(month) && !isNaN(amount)) {
                            monthlyData[month] += amount;
                        }
                    }
                } catch (e) {
                    console.warn('Erreur lors du traitement d\'une facture:', e);
                }
            });
        }
        
        console.log('Données mensuelles calculées:', monthlyData);
        
        // Si toutes les données sont à zéro, ajouter quelques exemples
        if (monthlyData.every(value => value === 0)) {
            console.log('Aucune donnée réelle, ajout de données de test');
            monthlyData[0] = 1000;  // Janvier
            monthlyData[1] = 1500;  // Février
            monthlyData[2] = 2000;  // Mars
        }
        
        // Configuration du graphique
        const config = {
            type: 'bar',
            data: {
                labels: monthNames,
                datasets: [{
                    label: 'CA mensuel (€)',
                    data: monthlyData,
                    backgroundColor: 'rgba(75, 192, 192, 0.5)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return value + ' €';
                            }
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Évolution mensuelle du CA ' + currentYear
                    },
                    legend: {
                        display: false
                    }
                }
            }
        };
        
        // Créer le nouveau graphique
        window.revenueChart = new Chart(ctx, config);
        console.log('Graphique de CA créé avec succès');
        
    } catch (error) {
        console.error('Erreur lors de la création du graphique de CA:', error);
    }
}

// Fonction pour mettre à jour le graphique des types de dossiers
function updateDossiersChart() {
    console.log('Mise à jour du graphique de types de dossiers...');
    
    try {
        // Récupérer le canvas
        const canvas = document.getElementById('dossiersChart');
        if (!canvas) {
            console.error('Canvas #dossiersChart non trouvé!');
            return;
        }
        
        // Forcer une taille minimale au canvas
        canvas.style.width = '100%';
        canvas.style.height = '300px';
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        
        const ctx = canvas.getContext('2d');
        
        // Détruire le graphique existant s'il existe
        if (window.dossiersChart instanceof Chart) {
            console.log('Destruction du graphique existant');
            window.dossiersChart.destroy();
            window.dossiersChart = null;
        }
        
        // Compter les factures par type de dossier
        const typeData = {};
        
        if (window.invoices && Array.isArray(window.invoices)) {
            window.invoices.forEach(invoice => {
                try {
                    if (invoice.client && invoice.client.type) {
                        const type = invoice.client.type;
                        typeData[type] = (typeData[type] || 0) + parseFloat(invoice.totalHT || 0);
                    }
                } catch (e) {
                    console.warn('Erreur lors du traitement d\'une facture:', e);
                }
            });
        }
        
        console.log('Types de dossiers calculés:', typeData);
        
        // Si aucun type n'est trouvé, ajouter des données de test
        if (Object.keys(typeData).length === 0) {
            console.log('Aucune donnée réelle, ajout de données de test');
            typeData['Divorce'] = 2500;
            typeData['Civil'] = 1800;
            typeData['Pénal'] = 3000;
        }
        
        // Préparer les données pour le graphique
        const types = Object.keys(typeData);
        const values = Object.values(typeData);
        
        // Couleurs pour chaque type
        const backgroundColors = [
            'rgba(255, 99, 132, 0.6)',
            'rgba(54, 162, 235, 0.6)',
            'rgba(255, 206, 86, 0.6)',
            'rgba(75, 192, 192, 0.6)',
            'rgba(153, 102, 255, 0.6)',
            'rgba(255, 159, 64, 0.6)',
            'rgba(199, 199, 199, 0.6)'
        ];
        
        const borderColors = backgroundColors.map(color => color.replace('0.6', '1'));
        
        // Configuration du graphique
        const config = {
            type: 'pie',
            data: {
                labels: types,
                datasets: [{
                    data: values,
                    backgroundColor: backgroundColors.slice(0, types.length),
                    borderColor: borderColors.slice(0, types.length),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Répartition du CA par type de dossier'
                    },
                    legend: {
                        position: 'right'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.raw;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((value / total) * 100);
                                return `${context.label}: ${value.toFixed(2)} € (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        };
        
        // Créer le nouveau graphique
        window.dossiersChart = new Chart(ctx, config);
        console.log('Graphique de types de dossiers créé avec succès');
        
    } catch (error) {
        console.error('Erreur lors de la création du graphique de types de dossiers:', error);
    }
}

// Fonction de diagnostic des graphiques
function debugCharts() {
    console.log('=== DIAGNOSTIC DES GRAPHIQUES ===');
    
    // 1. Vérifier Chart.js
    console.log('Chart.js disponible:', typeof Chart !== 'undefined');
    
    // 2. Vérifier les canvas
    const revenueCanvas = document.getElementById('revenueChart');
    const dossiersCanvas = document.getElementById('dossiersChart');
    
    console.log('Canvas revenue trouvé:', !!revenueCanvas);
    if (revenueCanvas) {
        console.log('- Dimensions:', revenueCanvas.width, 'x', revenueCanvas.height);
        console.log('- Style:', revenueCanvas.style.width, revenueCanvas.style.height);
    }
    
    console.log('Canvas dossiers trouvé:', !!dossiersCanvas);
    if (dossiersCanvas) {
        console.log('- Dimensions:', dossiersCanvas.width, 'x', dossiersCanvas.height);
        console.log('- Style:', dossiersCanvas.style.width, dossiersCanvas.style.height);
    }
    
    // 3. Vérifier les instances de graphiques
    console.log('Instance revenueChart:', window.revenueChart instanceof Chart);
    console.log('Instance dossiersChart:', window.dossiersChart instanceof Chart);
    
    // 4. Vérifier les données
    console.log('Nombre de factures:', window.invoices ? window.invoices.length : 0);
    
    // 5. Tenter de créer un graphique simple de test
    try {
        const testCanvas = document.createElement('canvas');
        testCanvas.width = 100;
        testCanvas.height = 100;
        const testCtx = testCanvas.getContext('2d');
        
        new Chart(testCtx, {
            type: 'bar',
            data: {
                labels: ['Test'],
                datasets: [{
                    label: 'Test',
                    data: [10],
                    backgroundColor: 'red'
                }]
            }
        });
        
        console.log('Test de création de graphique réussi');
    } catch (e) {
        console.error('Test de création de graphique échoué:', e);
    }
    
    // 6. Forcer la recréation des graphiques avec des données de test
    try {
        updateCharts();
        console.log('Mise à jour des graphiques effectuée');
        alert('Diagnostic terminé. Consultez la console pour les détails.');
    } catch (e) {
        console.error('Erreur lors du diagnostic:', e);
        alert('Erreur lors du diagnostic: ' + e.message);
    }
}

// Exposer les fonctions globalement
window.updateCharts = updateCharts;
window.updateRevenueChart = updateRevenueChart;
window.updateDossiersChart = updateDossiersChart;
window.debugCharts = debugCharts;