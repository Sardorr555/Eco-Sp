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
            bestEl.innerHTML = `<span title="${data.best.territory}" style="display:block; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${data.best.territory}</span> <span style="font-size: 14px; color: var(--muted)">Score: ${data.best.score}</span>`;
        } else {
            bestEl.textContent = '-';
        }

        const worstEl = document.getElementById('statWorst');
        if (data.worst) {
            worstEl.innerHTML = `<span title="${data.worst.territory}" style="display:block; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${data.worst.territory}</span> <span style="font-size: 14px; color: var(--muted)">Score: ${data.worst.score}</span>`;
        } else {
            worstEl.textContent = '-';
        }

        document.getElementById('high-risk-count').textContent = data.high_risk_count || 0;

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

function getRiskBadge(risk) {
    const colors = { 'low': '#00c9a7', 'medium': '#f5a623', 'high': '#f05252' };
    const bgs = { 'low': 'rgba(0,201,167,0.15)', 'medium': 'rgba(245,166,35,0.15)', 'high': 'rgba(240,82,82,0.15)' };
    const r = risk || 'medium';
    return `<span style="background:${bgs[r]}; color:${colors[r]}; padding:3px 8px; border-radius:4px; font-size:11px; text-transform:uppercase; font-weight:600">${r} Risk</span>`;
}

function renderRecentTable(recent) {
    const tbody = document.getElementById('recentAnalysesBody');
    tbody.innerHTML = '';

    if (!recent || recent.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--muted); padding: 24px;">No recent analyses</td></tr>`;
        return;
    }

    recent.forEach(a => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${a.territory_name || 'Territory #' + a.territory_id}</td>
            <td style="font-size:12px;color:var(--muted)">${a.date_from} → ${a.date_to}</td>
            <td style="font-weight: 600; color: ${getScoreColor(a.overall_score)}">${a.overall_score}</td>
            <td>${getRiskBadge(a.ai_risk_level)}</td>
            <td><span class="tag ${getScoreTagClass(a.overall_score)}">${a.label}</span></td>
            <td><a href="/app/map.html" class="btn btn-ghost" style="padding: 6px 12px; font-size: 12px;">Map</a></td>
        `;
        tbody.appendChild(row);
    });
}

function renderChart(recent) {
    const ctx = document.getElementById('trendChart');
    if (!ctx || !recent || recent.length === 0) return;

    // A simple chart taking recent analyses as data points
    const reversed = [...recent].reverse();

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: reversed.map(a => a.date_from),
            datasets: [{
                label: 'Overall Score',
                data: reversed.map(a => a.overall_score),
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
