const BASE = '/api';

function getToken() { return localStorage.getItem('token'); }
function setToken(t) { localStorage.setItem('token', t); }
function setUser(u)  { localStorage.setItem('user', JSON.stringify(u)); }
function getUser()   { return JSON.parse(localStorage.getItem('user') || 'null'); }
function logout()    { localStorage.clear(); location.href = '/app/login.html'; }

async function req(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(BASE + path, opts);
  if (r.status === 401) { logout(); return; }
  const data = await r.json();
  if (!r.ok) throw new Error(data.detail || 'Error');
  return data;
}

const api = {
  auth: {
    login:    (email, password) => req('POST', '/auth/login', { email, password }),
    register: (data)            => req('POST', '/auth/register', data),
    me:       ()                => req('GET',  '/auth/me'),
  },
  territories: {
    list:   ()           => req('GET',    '/territories/'),
    create: (data)       => req('POST',   '/territories/', data),
    delete: (id)         => req('DELETE', `/territories/${id}`),
  },
  analysis: {
    run:       (data)        => req('POST', '/analysis/', data),
    byTerritory: (tid)       => req('GET',  `/analysis/territory/${tid}`),
    dashboard: ()            => req('GET',  '/analysis/dashboard'),
  },
  reports: {
    generate: (analysis_id, title) => req('POST', '/reports/generate', { analysis_id, title }),
    list:     ()                   => req('GET',  '/reports/'),
    download: (id)                 => window.open(`${BASE}/reports/${id}/download`),
  }
};

// Guard: redirect to login if no token
function requireAuth() {
  if (!getToken()) {
      if (!window.location.pathname.startsWith('/app/login.html') && !window.location.pathname.startsWith('/app/register.html')) {
          location.href = '/app/login.html';
      }
  }
}

// Show toast notification
function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = 'toast';
  el.style.borderLeft = `3px solid ${type === 'error' ? 'var(--danger)' : type === 'success' ? 'var(--accent)' : 'var(--accent-2)'}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// Attach auth guard strictly unless it's landing, login, register
if (window.location.pathname !== '/' && window.location.pathname !== '/app/index.html' && window.location.pathname !== '/app/login.html' && window.location.pathname !== '/app/register.html') {
    requireAuth();
}

function renderSidebar() {
    const sidebar = document.createElement('div');
    sidebar.className = 'sidebar';
    sidebar.innerHTML = `
        <a href="/app/dashboard.html" class="logo">Sputnik Eco</a>
        <a href="/app/dashboard.html" class="nav-item ${window.location.pathname.includes('dashboard') ? 'active' : ''}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
            Dashboard
        </a>
        <a href="/app/map.html" class="nav-item ${window.location.pathname.includes('map') ? 'active' : ''}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            Map & Analysis
        </a>
        <a href="/app/reports.html" class="nav-item ${window.location.pathname.includes('reports') ? 'active' : ''}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            Reports
        </a>
        <div class="nav-item nav-bottom" onclick="logout()">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            Logout
        </div>
    `;
    document.body.prepend(sidebar);
}
