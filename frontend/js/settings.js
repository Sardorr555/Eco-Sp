document.addEventListener('DOMContentLoaded', async () => {
    requireAuth();
    renderSidebar();

    try {
        const user = await api.auth.me();

        document.getElementById('set-email').value = user.email || '';
        document.getElementById('set-name').value = user.full_name || '';
        document.getElementById('set-company').value = user.company || '';

        // Load Language
        document.getElementById('set-lang').value = localStorage.getItem('lang') || 'uz';

        const plan = (user.plan || 'free').toUpperCase();
        document.getElementById('planBadge').textContent = `${plan} PLAN`;

        // Update local storage just in case
        setUser(user);
    } catch (err) {
        toast('Failed to load user profile: ' + err.message, 'error');
    }

    document.getElementById('settingsForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const btn = document.getElementById('btnSaveSettings');
        const origText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Saving...';

        try {
            const updatedUser = await api.auth.update({
                full_name: document.getElementById('set-name').value,
                company: document.getElementById('set-company').value
            });

            // Save language
            localStorage.setItem('lang', document.getElementById('set-lang').value);

            setUser(updatedUser);
            toast('Settings updated successfully!', 'success');

            // Apply language immediately
            if (typeof applyLanguage === 'function') applyLanguage();
        } catch (err) {
            toast(err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = origText;
        }
    });
});
