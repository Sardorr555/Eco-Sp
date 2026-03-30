document.addEventListener('DOMContentLoaded', async () => {
    requireAuth();
    renderSidebar();

    const user = getUser();
    if (user) {
        document.getElementById('greeting').textContent = `Good morning, ${user.full_name}`;
    }
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    try {
        const data = await api.analysis.dashboard();

        document.getElementById('statTerritories').textContent = data.territories_count;

        const avgEl = document.getElementById('statAvgScore');
        avgEl.textContent = data.avg_score;
        avgEl.style.color = getScoreColor(data.avg_score);

        const bestEl = document.getElementById('statBest');
        if (data.best) {
            bestEl.innerHTML = `${data.best.territory} <br><span style="font-size: 14px; color: var(--muted)">Score: ${data.best.score}</span>`;
        } else {
            bestEl.textContent = '-';
        }

        const worstEl = document.getElementById('statWorst');
        if (data.worst) {
            worstEl.innerHTML = `${data.worst.territory} <br><span style="font-size: 14px; color: var(--muted)">Score: ${data.worst.score}</span>`;
        } else {
            worstEl.textContent = '-';
        }

        renderRecentTable(data.recent);
        renderChart(data.recent);

    } catch (err) {
        toast(err.message, 'error');
    }
});

function getScoreColor(score) {
    if (score >= 80) return 'var(--success)';
    if (score >= 60) return 'var(--accent-2)';
    if (score >= 40) return 'var(--warning)';
    return 'var(--danger)';
}

function getScoreTagClass(score) {
    if (score >= 60) return 'tag-good';
    if (score >= 40) return 'tag-moderate';
    return 'tag-poor';
}

function renderRecentTable(recent) {
    const tbody = document.getElementById('recentAnalysesBody');
    tbody.innerHTML = '';

    if (!recent || recent.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--muted); padding: 24px;">No recent analyses</td></tr>`;
        return;
    }

    recent.forEach(a => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>Territory #${a.territory_id}</td>
            <td>${a.date_from} → ${a.date_to}</td>
            <td style="font-weight: 600; color: ${getScoreColor(a.score)}">${a.score}</td>
            <td><span class="tag ${getScoreTagClass(a.score)}">${a.label}</span></td>
            <td><a href="/app/map.html" class="btn btn-ghost" style="padding: 6px 12px; font-size: 12px;">Map</a></td>
        `;
        tbody.appendChild(row);
    });
}

function renderChart(recent) {
    const ctx = document.getElementById('trendChart');
    if (!ctx || !recent || recent.length === 0) return;

    // A simple chart taking recent analyses as data points
    // For a real app, this should fetch history per territory.
    const reversed = [...recent].reverse();

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: reversed.map(a => a.date_from),
            datasets: [{
                label: 'Overall Score',
                data: reversed.map(a => a.score),
                borderColor: '#00c9a7',
                backgroundColor: 'rgba(0, 201, 167, 0.1)',
                borderWidth: 2,
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#7a8ba0' } },
                x: { grid: { display: false }, ticks: { color: '#7a8ba0' } }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}
