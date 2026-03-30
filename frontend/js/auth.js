document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const btn = loginForm.querySelector('button');
            const originalText = btn.textContent;
            try {
                btn.textContent = 'Logging in...';
                btn.disabled = true;
                const data = await api.auth.login(email, password);
                setToken(data.access_token);
                setUser(data.user);
                window.location.href = '/app/dashboard.html';
            } catch (err) {
                toast(err.message, 'error');
                btn.textContent = originalText;
                btn.disabled = false;
            }
        });
    }

    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fullName = document.getElementById('fullName').value;
            const company = document.getElementById('company').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            if (password !== confirmPassword) {
                return toast('Passwords do not match', 'error');
            }

            const btn = registerForm.querySelector('button');
            const originalText = btn.textContent;
            try {
                btn.textContent = 'Registering...';
                btn.disabled = true;
                const data = await api.auth.register({
                    full_name: fullName,
                    company: company,
                    email: email,
                    password: password
                });
                setToken(data.access_token);
                setUser(data.user);
                window.location.href = '/app/dashboard.html';
            } catch (err) {
                toast(err.message, 'error');
                btn.textContent = originalText;
                btn.disabled = false;
            }
        });
    }
});
