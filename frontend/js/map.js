let map, drawnItems, currentDrawing = null;
let customColor = '#00c9a7';

document.addEventListener('DOMContentLoaded', async () => {
    requireAuth();
    renderSidebar();

    initMap();
    await loadTerritories();

    document.getElementById('btnDrawNew').addEventListener('click', () => {
        if (!map) return;
        new L.Draw.Polygon(map, { shapeOptions: { color: customColor } }).enable();
    });

    document.getElementById('btnCancelName').addEventListener('click', () => {
        document.getElementById('nameModal').style.display = 'none';
        if (currentDrawing) drawnItems.removeLayer(currentDrawing);
    });

    document.getElementById('btnSaveName').addEventListener('click', async () => {
        const name = document.getElementById('newTerritoryName').value;
        if (!name) return toast('Please enter a name', 'error');

        const geojson = currentDrawing.toGeoJSON();
        try {
            document.getElementById('btnSaveName').disabled = true;
            await api.territories.create({
                name,
                geojson: JSON.stringify(geojson),
                color: customColor
            });
            document.getElementById('nameModal').style.display = 'none';
            document.getElementById('btnSaveName').disabled = false;
            toast('Territory created', 'success');
            await loadTerritories();
        } catch (err) {
            toast(err.message, 'error');
            document.getElementById('btnSaveName').disabled = false;
        }
    });

    document.getElementById('analysisForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const tid = document.getElementById('selectTerritoryId').value;
        const dFrom = document.getElementById('dateFrom').value;
        const dTo = document.getElementById('dateTo').value;

        const btn = document.getElementById('btnAnalyze');
        const origText = btn.textContent;
        try {
            btn.textContent = 'Fetching satellite data...';
            btn.disabled = true;

            const res = await api.analysis.run({
                territory_id: parseInt(tid),
                date_from: dFrom,
                date_to: dTo
            });

            showResults(res);
            toast('Analysis complete', 'success');

        } catch (err) {
            toast(err.message, 'error');
        } finally {
            btn.textContent = origText;
            btn.disabled = false;
        }
    });

    document.getElementById('btnSaveReport').addEventListener('click', async () => {
        const tid = document.getElementById('selectTerritoryId').value;
        const dFrom = document.getElementById('dateFrom').value;
        if (!tid) return;

        const btn = document.getElementById('btnSaveReport');
        const origText = btn.textContent;
        btn.textContent = 'Generating PDF...';
        btn.disabled = true;

        try {
            // we need the analysis ID, but the form only has territory ID
            // let's fetch the latest analysis for this territory
            const analyses = await api.analysis.byTerritory(parseInt(tid));
            if (!analyses || analyses.length === 0) throw new Error('No analysis found');
            const latest = analyses[0];

            const title = `${document.getElementById('selectTerritoryName').textContent} — ${latest.date_from}`;
            const report = await api.reports.generate(latest.id, title);
            toast('Report generated globally!', 'success');
            window.location.href = '/app/reports.html';
        } catch (err) {
            toast(err.message, 'error');
        } finally {
            btn.textContent = origText;
            btn.disabled = false;
        }
    });
});

function initMap() {
    map = L.map('map').setView([20, 0], 3);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a>'
    }).addTo(map);

    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    map.on(L.Draw.Event.CREATED, function (e) {
        currentDrawing = e.layer;
        drawnItems.addLayer(currentDrawing);
        document.getElementById('newTerritoryName').value = '';
        document.getElementById('nameModal').style.display = 'flex';
    });
}

function getScoreColor(score) {
    if (score >= 80) return '#00c9a7';
    if (score >= 60) return '#4f8ef7';
    if (score >= 40) return '#f5a623';
    return '#f05252';
}

function getScoreTagClass(score) {
    if (score >= 60) return 'tag-good';
    if (score >= 40) return 'tag-moderate';
    return 'tag-poor';
}

async function loadTerritories() {
    try {
        const list = await api.territories.list();
        const container = document.getElementById('territoryList');
        const empty = document.getElementById('territoryEmpty');

        container.innerHTML = '';
        drawnItems.clearLayers();

        if (list.length === 0) {
            empty.style.display = 'block';
            container.appendChild(empty);
            return;
        }

        empty.style.display = 'none';

        list.forEach(t => {
            let color = t.last_score ? getScoreColor(t.last_score) : t.color;

            // map
            if (t.geojson) {
                try {
                    const geo = JSON.parse(t.geojson);
                    const layer = L.geoJSON(geo, { style: { color, weight: 2, fillOpacity: 0.2 } });

                    const scoreText = t.last_score ? `Score: ${t.last_score}` : 'No data';
                    layer.bindPopup(`<strong>${t.name}</strong><br>${scoreText}`);

                    layer.on('click', () => selectTerritory(t, color));
                    drawnItems.addLayer(layer);
                } catch (e) { }
            }

            // ui item
            const item = document.createElement('div');
            item.className = 'territory-item';
            item.onclick = () => {
                selectTerritory(t, color);
                map.setView([t.centroid_lat, t.centroid_lon], 12);
            };
            item.innerHTML = `
                <div class="dot" style="background: ${color}"></div>
                <div class="name">${t.name}</div>
                <div class="score">${t.last_score || '--'}</div>
            `;
            container.appendChild(item);
        });
    } catch (err) {
        toast('Failed to load territories: ' + err.message, 'error');
    }
}

function selectTerritory(t, color) {
    document.getElementById('analysisFormPanel').style.display = 'block';
    document.getElementById('resultsPanel').style.display = 'none';

    document.getElementById('selectTerritoryName').textContent = t.name;
    document.getElementById('selectTerritoryId').value = t.id;

    // set default dates (last 7 days)
    const today = new Date();
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    document.getElementById('dateTo').value = today.toISOString().split('T')[0];
    document.getElementById('dateFrom').value = lastWeek.toISOString().split('T')[0];
}

function showResults(res) {
    document.getElementById('resultsPanel').style.display = 'flex';
    document.getElementById('resultsPanel').style.flexDirection = 'column';

    const c = document.getElementById('resScoreCircle');
    c.textContent = res.overall_score;
    const color = getScoreColor(res.overall_score);
    c.style.color = color;
    c.style.borderColor = color;
    c.style.background = `rgba(${hexToRgb(color)}, 0.15)`;

    const l = document.getElementById('resLabel');
    l.textContent = res.label;
    l.style.color = color;

    setPollutant('PM25', res.pm25, 75);
    setPollutant('PM10', res.pm10, 150);
    setPollutant('NO2', res.no2, 200);
    setPollutant('SO2', res.so2, 500);
    setPollutant('CO', res.co, 10000);
    setPollutant('O3', res.o3, 240);

    // Refresh map to update color
    loadTerritories();
}

function setPollutant(id, val, max) {
    document.getElementById(`res${id}`).textContent = val;
    const pct = Math.min(100, Math.max(0, (val / max) * 100));
    const bar = document.getElementById(`bar${id}`);
    bar.style.width = `${pct}%`;

    // color logic based on value/pct roughly
    if (pct <= 30) {
        bar.style.background = 'var(--success)';
        document.getElementById(`tag${id}`).textContent = 'Good';
        document.getElementById(`tag${id}`).style.color = 'var(--success)';
    } else if (pct <= 70) {
        bar.style.background = 'var(--warning)';
        document.getElementById(`tag${id}`).textContent = 'Moderate';
        document.getElementById(`tag${id}`).style.color = 'var(--warning)';
    } else {
        bar.style.background = 'var(--danger)';
        document.getElementById(`tag${id}`).textContent = 'Poor';
        document.getElementById(`tag${id}`).style.color = 'var(--danger)';
    }
}

function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r}, ${g}, ${b}`;
}
