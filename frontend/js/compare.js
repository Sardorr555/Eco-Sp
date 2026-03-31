let radarChartInstance = null;
let allTerritories = [];

document.addEventListener('DOMContentLoaded', async () => {
    requireAuth();
    renderSidebar();

    try {
        allTerritories = await api.territories.list();
        const selA = document.getElementById('selA');
        const selB = document.getElementById('selB');

        // Populate selectors
        allTerritories.forEach(t => {
            const opt = new Option(`${t.name} (Score: ${t.last_score || 'N/A'})`, t.id);
            selA.add(opt.cloneNode(true));
            selB.add(opt.cloneNode(true));
        });

    } catch (err) {
        toast('Failed to load territories: ' + err.message, 'error');
    }

    document.getElementById('btnRunCompare').addEventListener('click', async () => {
        const idA = document.getElementById('selA').value;
        const idB = document.getElementById('selB').value;

        if (!idA || !idB) return toast('Please select TWO territories to compare', 'error');
        if (idA === idB) return toast('Please select different territories', 'info');

        const btn = document.getElementById('btnRunCompare');
        const origText = btn.textContent;
        btn.textContent = 'Comparing...';
        btn.disabled = true;

        try {
            // Fetch the latest analysis for both
            const analysesA = await api.analysis.byTerritory(parseInt(idA));
            const analysesB = await api.analysis.byTerritory(parseInt(idB));

            if (!analysesA.length) throw new Error(`Territory A has no analysis yet. Run it on the Map first!`);
            if (!analysesB.length) throw new Error(`Territory B has no analysis yet. Run it on the Map first!`);

            const a = analysesA[0];
            const b = analysesB[0];

            renderComparison(a, b);
        } catch (err) {
            toast(err.message, 'error');
        } finally {
            btn.textContent = origText;
            btn.disabled = false;
        }
    });
});

function getScoreColor(score) {
    if (score >= 80) return '#00c9a7';
    if (score >= 60) return '#4f8ef7';
    if (score >= 40) return '#f5a623';
    return '#f05252';
}

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function renderComparison(a, b) {
    document.getElementById('resultsCmp').style.display = 'block';

    // Determine winner
    document.getElementById('winnerA').style.display = a.overall_score > b.overall_score ? 'inline-block' : 'none';
    document.getElementById('winnerB').style.display = b.overall_score > a.overall_score ? 'inline-block' : 'none';

    // Fill text data
    document.getElementById('nameA').textContent = a.territory_name;
    document.getElementById('scoreA').textContent = a.overall_score;
    document.getElementById('scoreA').style.color = getScoreColor(a.overall_score);
    document.getElementById('labelA').textContent = a.label;
    document.getElementById('labelA').style.color = getScoreColor(a.overall_score);

    document.getElementById('nameB').textContent = b.territory_name;
    document.getElementById('scoreB').textContent = b.overall_score;
    document.getElementById('scoreB').style.color = getScoreColor(b.overall_score);
    document.getElementById('labelB').textContent = b.label;
    document.getElementById('labelB').style.color = getScoreColor(b.overall_score);

    const metrics = ['pm25', 'pm10', 'no2', 'so2', 'co', 'o3'];
    metrics.forEach(m => {
        document.getElementById(`m_${m}_A`).textContent = a[m];
        document.getElementById(`m_${m}_B`).textContent = b[m];
    });

    // Radar Chart drawing
    const ctx = document.getElementById('radarChart').getContext('2d');
    if (radarChartInstance) radarChartInstance.destroy();

    const colorA = '#00c9a7'; // Cyan
    const colorB = '#a78bfa'; // Purple

    // Normalized logic: 
    // In radar chart, we want the center to be 0 and the edge edge to be Max limits
    // PM2.5 max 75, PM10 max 150, NO2 max 200, SO2 max 500, CO max 10000, O3 max 240

    const normalize = (val, max) => Math.min(100, Math.max(0, (val / max) * 100));

    radarChartInstance = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['PM2.5', 'PM10', 'NO₂', 'SO₂', 'CO', 'O₃'],
            datasets: [{
                label: a.territory_name,
                data: [
                    normalize(a.pm25, 75), normalize(a.pm10, 150), normalize(a.no2, 200),
                    normalize(a.so2, 500), normalize(a.co, 10000), normalize(a.o3, 240)
                ],
                backgroundColor: hexToRgba(colorA, 0.2),
                borderColor: colorA,
                pointBackgroundColor: colorA,
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: colorA
            }, {
                label: b.territory_name,
                data: [
                    normalize(b.pm25, 75), normalize(b.pm10, 150), normalize(b.no2, 200),
                    normalize(b.so2, 500), normalize(b.co, 10000), normalize(b.o3, 240)
                ],
                backgroundColor: hexToRgba(colorB, 0.2),
                borderColor: colorB,
                pointBackgroundColor: colorB,
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: colorB
            }]
        },
        options: {
            scales: {
                r: {
                    angleLines: { color: 'rgba(255,255,255,0.1)' },
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    pointLabels: { color: '#7a8ba0', font: { size: 12 } },
                    ticks: { display: false, max: 100, min: 0 }
                }
            },
            plugins: {
                legend: { labels: { color: '#e2e8f0', usePointStyle: true } },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return ` ${context.dataset.label}: ${Math.round(context.raw)}% of critical limit`;
                        }
                    }
                }
            }
        }
    });

}
