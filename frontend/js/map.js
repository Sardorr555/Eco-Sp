let map, drawnItems = [];
let drawingPolygon = null;
let customColor = '#00c9a7';
let currentGeoJSON = null;

document.addEventListener('DOMContentLoaded', async () => {
    requireAuth();
    renderSidebar();

    ymaps.ready(initMap);

    document.getElementById('btnDrawNew').addEventListener('click', () => {
        if (!map) return;
        startDrawing();
    });

    document.getElementById('btnCancelName').addEventListener('click', () => {
        document.getElementById('nameModal').style.display = 'none';
        if (drawingPolygon) {
            map.geoObjects.remove(drawingPolygon);
            drawingPolygon = null;
        }
    });

    document.getElementById('btnSaveName').addEventListener('click', async () => {
        const name = document.getElementById('newTerritoryName').value;
        if (!name) return toast('Please enter a name', 'error');

        try {
            document.getElementById('btnSaveName').disabled = true;
            const t = await api.territories.create({
                name,
                geojson: JSON.stringify(currentGeoJSON),
                color: customColor
            });
            document.getElementById('nameModal').style.display = 'none';
            document.getElementById('btnSaveName').disabled = false;
            toast('Territory created', 'success');

            if (drawingPolygon) { drawingPolygon.options.set('editorDrawingCursor', 'pointer'); }

            await loadTerritories();
            selectTerritory(t, customColor);
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

        document.getElementById('resultsPanel').style.display = 'block';
        document.getElementById('results-panel').style.display = 'block';
        document.getElementById('ai-analysis-container').innerHTML = `
        <div id="ai-skeleton">
            <div class="skeleton" style="height:16px;width:60%;margin-bottom:10px"></div>
            <div class="skeleton" style="height:60px;margin-bottom:10px"></div>
            <div class="skeleton" style="height:40px;width:80%"></div>
        </div>`;

        try {
            btn.textContent = '🤖 Running analysis...';
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
            document.getElementById('ai-analysis-container').innerHTML = '';
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

async function initMap() {
    map = new ymaps.Map("map", {
        center: [55.76, 37.64],
        zoom: 10,
        controls: ['zoomControl', 'searchControl', 'fullscreenControl']
    });

    // Dark style filter is handled via CSS
    await loadTerritories();
}

function startDrawing() {
    if (drawingPolygon) {
        map.geoObjects.remove(drawingPolygon);
    }
    drawingPolygon = new ymaps.Polygon([], {}, {
        editorDrawingCursor: "crosshair",
        editorMaxPoints: 50,
        fillColor: 'rgba(0, 201, 167, 0.2)',
        strokeColor: '#00c9a7',
        strokeWidth: 2
    });

    map.geoObjects.add(drawingPolygon);
    drawingPolygon.editor.startDrawing();

    toast('Draw a polygon. Click the first point again to finish.', 'info');

    // Monitor when drawing finishes
    var stateMonitor = new ymaps.Monitor(drawingPolygon.editor.state);
    stateMonitor.add("drawing", function (newValue) {
        if (!newValue) {
            // drawing just stopped (completed)
            onDrawComplete();
        }
    });
}

function onDrawComplete() {
    const coords = drawingPolygon.geometry.getCoordinates();
    if (coords && coords[0] && coords[0].length >= 3) {
        // Convert to GeoJSON manually
        // Yandex uses [lat, lng], whereas GeoJSON normally uses [lng, lat]
        const geoJSONCoords = coords[0].map(c => [c[1], c[0]]);

        currentGeoJSON = {
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [geoJSONCoords]
            }
        };
        document.getElementById('newTerritoryName').value = '';
        document.getElementById('nameModal').style.display = 'flex';
    } else {
        toast('Invalid polygon drawn', 'error');
        map.geoObjects.remove(drawingPolygon);
    }
}

function getScoreColor(score) {
    if (score >= 80) return '#00c9a7';
    if (score >= 60) return '#4f8ef7';
    if (score >= 40) return '#f5a623';
    return '#f05252';
}

function getRiskBadge(risk) {
    if (!risk) return '';
    const colors = { 'low': 'color:#00c9a7', 'medium': 'color:#f5a623', 'high': 'color:#f05252' };
    return `<span style="font-size:10px;text-transform:uppercase;${colors[risk]}">${risk} Risk</span>`;
}

async function loadTerritories() {
    if (!map) return;
    try {
        const list = await api.territories.list();
        const container = document.getElementById('territoryList');
        const empty = document.getElementById('territoryEmpty');

        Array.from(container.children).forEach(c => {
            if (c.id !== 'territoryEmpty') c.remove();
        });

        if (drawnItems && drawnItems.length > 0) {
            drawnItems.forEach(i => map.geoObjects.remove(i));
        }
        drawnItems = [];

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
                    // Convert [lng, lat] back to [lat, lng] for Yandex
                    const yandexCoords = geo.geometry.coordinates[0].map(c => [c[1], c[0]]);

                    const p = new ymaps.Polygon([yandexCoords], {
                        hintContent: t.name,
                        balloonContent: `<strong>${t.name}</strong><br>Score: ${t.last_score || 'No data'}`
                    }, {
                        fillColor: color,
                        fillOpacity: 0.2,
                        strokeColor: color,
                        strokeWidth: 2
                    });

                    p.events.add('click', function () {
                        selectTerritory(t, color);
                    });

                    map.geoObjects.add(p);
                    drawnItems.push(p);
                } catch (e) { }
            }

            // ui item
            const item = document.createElement('div');
            item.className = 'territory-item';
            item.addEventListener('click', (e) => {
                if (e.target.closest('.del-btn')) return;
                selectTerritory(t, color);
                map.setCenter([t.centroid_lat, t.centroid_lon], 12);
            });
            item.innerHTML = `
                <div class="dot" style="background: ${color}; flex-shrink: 0;"></div>
                <div class="name" title="${t.name}">${t.name}</div>
                <div class="score" style="display:flex; align-items:center; gap:8px;">
                    <div>
                        <div>${t.last_score || '--'}</div>
                        ${getRiskBadge(t.last_risk)}
                    </div>
                    <button class="del-btn btn-ghost" style="padding:4px; font-size:12px; color:var(--danger); border:none; cursor:pointer;" onclick="deleteTerritory(${t.id})">🗑️</button>
                </div>
            `;
            container.appendChild(item);
        });
    } catch (err) {
        toast('Failed to load territories: ' + err.message, 'error');
    }
}

window.deleteTerritory = async function (id) {
    if (!confirm('Delete this territory? All associated analyses will be lost.')) return;
    try {
        await api.territories.delete(id);
        toast('Territory deleted', 'success');
        if (document.getElementById('selectTerritoryId').value == id) {
            document.getElementById('analysisFormPanel').style.display = 'none';
        }
        await loadTerritories();
    } catch (err) {
        toast(err.message, 'error');
    }
}

function selectTerritory(t, color) {
    document.getElementById('analysisFormPanel').style.display = 'block';
    document.getElementById('resultsPanel').style.display = 'none';

    document.getElementById('selectTerritoryName').textContent = t.name;
    document.getElementById('selectTerritoryId').value = t.id;

    // set default dates (last 7 days by default, which is perfect for satellite)
    const today = new Date();
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 3); // 3 days ago is safest for open-meteo recent data limit

    document.getElementById('dateTo').value = today.toISOString().split('T')[0];
    document.getElementById('dateFrom').value = lastWeek.toISOString().split('T')[0];
}

function showResults(res) {
    document.getElementById('resultsPanel').style.display = 'flex';
    document.getElementById('resultsPanel').style.flexDirection = 'column';
    document.getElementById('results-panel').style.display = 'block';

    const c = document.getElementById('resScoreCircle');
    c.textContent = res.overall_score;
    const color = getScoreColor(res.overall_score);
    c.style.color = color;
    c.style.borderColor = color;
    c.style.background = `rgba(${hexToRgb(color)}, 0.15)`;

    const l = document.getElementById('resLabel');
    l.textContent = res.label;
    l.style.color = color;

    document.getElementById('score-period').textContent = `${res.date_from} → ${res.date_to}`;

    setPollutant('PM25', res.pm25, 75);
    setPollutant('PM10', res.pm10, 150);
    setPollutant('NO2', res.no2, 200);
    setPollutant('SO2', res.so2, 500);
    setPollutant('CO', res.co, 10000);
    setPollutant('O3', res.o3, 240);

    renderAIBlock(document.getElementById('ai-analysis-container'), res);
    loadTerritories();
    setTimeout(applyLanguage, 100);
}

function setPollutant(id, val, max) {
    document.getElementById(`res${id}`).textContent = val;
    const pct = Math.min(100, Math.max(0, (val / max) * 100));
    const bar = document.getElementById(`bar${id}`);
    bar.style.width = `${pct}%`;

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
