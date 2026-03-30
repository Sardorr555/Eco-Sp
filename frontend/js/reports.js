document.addEventListener('DOMContentLoaded', async () => {
    requireAuth();
    renderSidebar();

    try {
        const list = await api.reports.list();
        const grid = document.getElementById('reportsGrid');
        const empty = document.getElementById('emptyState');
        const count = document.getElementById('reportCount');

        count.textContent = `(${list.length})`;

        if (list.length === 0) {
            empty.style.display = 'block';
            return;
        }

        list.forEach(r => {
            const card = document.createElement('div');
            card.className = 'card';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.gap = '16px';

            const scoreColor = r.score >= 80 ? 'var(--success)' :
                r.score >= 60 ? 'var(--accent-2)' :
                    r.score >= 40 ? 'var(--warning)' : 'var(--danger)';

            const tagClass = r.score >= 60 ? 'tag-good' :
                r.score >= 40 ? 'tag-moderate' : 'tag-poor';

            const dateLabel = r.date_from ? `${r.date_from} to ${r.date_to}` : 'N/A';

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <h3 style="font-size: 16px; margin-bottom: 4px;">${r.territory || 'Unknown Territory'}</h3>
                        <div style="font-size: 12px; color: var(--muted);">${dateLabel}</div>
                    </div>
                    ${r.score !== null ? `<div class="score-badge" style="width: 48px; height: 48px; font-size: 16px; border: 2px solid ${scoreColor}; color: ${scoreColor}; background: transparent;">${r.score}</div>` : ''}
                </div>
                
                ${r.label ? `<div><span class="tag ${tagClass}">${r.label}</span></div>` : ''}
                
                <div style="margin-top: auto; display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--border); padding-top: 16px;">
                    <span style="font-size: 12px; color: var(--muted);">Generated: ${r.created_at.split('T')[0]}</span>
                    <button class="btn btn-ghost" style="padding: 6px 12px; font-size: 12px;" onclick="window.open('${r.pdf_url}', '_blank')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        PDF
                    </button>
                </div>
            `;
            grid.appendChild(card);
        });

    } catch (err) {
        toast('Failed to load reports: ' + err.message, 'error');
    }
});
