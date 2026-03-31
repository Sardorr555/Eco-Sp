const BASE = '/api';

function getToken() { return localStorage.getItem('token'); }
function setToken(t) { localStorage.setItem('token', t); }
function setUser(u) { localStorage.setItem('user', JSON.stringify(u)); }
function getUser() { return JSON.parse(localStorage.getItem('user') || 'null'); }
function logout() { localStorage.clear(); location.href = '/app/login.html'; }

async function req(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(BASE + path, opts);
  if (r.status === 401) { logout(); return; }

  let data;
  try {
    const text = await r.text();
    data = JSON.parse(text);
  } catch (e) {
    if (!r.ok) {
      throw new Error(`Server Error (${r.status}): It seems the server crashed. Check console or contact admin.`);
    }
    return null;
  }

  if (!r.ok) throw new Error(data.detail || 'Error');
  return data;
}

const api = {
  auth: {
    login: (email, password) => req('POST', '/auth/login', { email, password }),
    register: (data) => req('POST', '/auth/register', data),
    me: () => req('GET', '/auth/me'),
    update: (data) => req('PUT', '/auth/me', data),
  },
  territories: {
    list: () => req('GET', '/territories/'),
    create: (data) => req('POST', '/territories/', data),
    delete: (id) => req('DELETE', `/territories/${id}`),
  },
  analysis: {
    run: (data) => req('POST', '/analysis/', data),
    byTerritory: (tid) => req('GET', `/analysis/territory/${tid}`),
    dashboard: () => req('GET', '/analysis/dashboard'),
  },
  reports: {
    generate: (analysis_id, title) => req('POST', '/reports/generate', { analysis_id, title }),
    list: () => req('GET', '/reports/'),
    delete: (id) => req('DELETE', `/reports/${id}`),
    download: async (id) => {
      const r = await fetch(`${BASE}/reports/${id}/download`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (!r.ok) throw new Error('Failed to download PDF - ' + r.status);
      const blob = await r.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    }
  }
};

function requireAuth() {
  if (!getToken()) {
    if (!window.location.pathname.startsWith('/app/login.html') && !window.location.pathname.startsWith('/app/register.html')) {
      location.href = '/app/login.html';
    }
  }
}

function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = 'toast';
  el.style.borderLeft = `3px solid ${type === 'error' ? 'var(--danger)' : type === 'success' ? 'var(--accent)' : 'var(--accent-2)'}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// Render the AI analysis block into a container element
function renderAIBlock(container, data) {
  if (!data.ai_summary) {
    container.innerHTML = '<p style="color:var(--muted);font-size:14px">AI analysis not available</p>';
    return;
  }

  const riskColors = { low: 'risk-low', medium: 'risk-medium', high: 'risk-high' };
  const riskClass = riskColors[data.ai_risk_level] || 'risk-medium';

  // A small inline style for badges if they don't exist in main
  const riskBg = {
    'low': 'rgba(0, 201, 167, 0.15)',
    'medium': 'rgba(245, 166, 35, 0.15)',
    'high': 'rgba(240, 82, 82, 0.15)'
  }[data.ai_risk_level] || 'rgba(245, 166, 35, 0.15)';

  const riskColor = {
    'low': '#00c9a7',
    'medium': '#f5a623',
    'high': '#f05252'
  }[data.ai_risk_level] || '#f5a623';

  // Trend direction icon + color
  const trendMeta = {
    improving: { icon: '↗', color: '#00c9a7', label: 'Improving' },
    stable: { icon: '→', color: '#4f8ef7', label: 'Stable' },
    worsening: { icon: '↘', color: '#f05252', label: 'Worsening' },
    baseline: { icon: '◎', color: '#7a8ba0', label: 'Baseline' },
  };
  const trend = trendMeta[data.ai_trend_direction] || trendMeta.baseline;

  const recsHtml = (data.ai_recommendations || []).map(r =>
    `<div class="ai-rec-item" style="display:flex; gap:8px; margin-top:8px;"><span class="ai-rec-icon" style="color:var(--accent-2)">🔹</span><span style="font-size:14px; color:var(--text)">${r}</span></div>`
  ).join('');

  container.innerHTML = `
    <div class="ai-block" style="background:var(--surface-2); border-left:4px solid #a78bfa; border-radius:8px; padding:20px; margin-top:16px;">
      <div class="ai-block-header" style="color:#a78bfa; font-size:12px; text-transform:uppercase; letter-spacing:1px; margin-bottom:12px; font-weight:600;">✦ AI Environmental Analysis</div>

      <p class="ai-summary" style="font-size:14px; line-height:1.6; margin-bottom:20px;">${data.ai_summary}</p>

      <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap">
        <div style="flex:1;min-width:100px;background:var(--surface);border-radius:8px;padding:12px">
          <div class="metric-label" style="font-size:11px;color:var(--muted);text-transform:uppercase;">Risk Level</div>
          <span style="background:${riskBg}; color:${riskColor}; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:600; margin-top:4px;display:inline-block">
            ${(data.ai_risk_level || 'medium').toUpperCase()}
          </span>
        </div>
        <div style="flex:1;min-width:100px;background:var(--surface);border-radius:8px;padding:12px">
          <div class="metric-label" style="font-size:11px;color:var(--muted);text-transform:uppercase;">Trend</div>
          <div style="font-size:14px;font-weight:600;margin-top:4px;color:${trend.color}">
            ${trend.icon} ${trend.label}
          </div>
        </div>
        <div style="flex:1;min-width:100px;background:var(--surface);border-radius:8px;padding:12px">
          <div class="metric-label" style="font-size:11px;color:var(--muted);text-transform:uppercase;">Primary Concern</div>
          <div style="font-size:13px;font-weight:600;margin-top:4px;color:var(--text)">
            ${data.ai_main_pollutant || '—'}
          </div>
        </div>
      </div>

      ${data.ai_trend ? `
        <div class="ai-section" style="margin-bottom:16px;">
          <div class="ai-section-title" style="font-size:12px; color:#a78bfa; text-transform:uppercase; margin-bottom:4px;">Trend vs Previous Periods</div>
          <p style="font-size:13px;line-height:1.6;color:var(--muted)">${data.ai_trend}</p>
        </div>
      ` : ''}

      ${data.ai_forecast ? `
        <div class="ai-section" style="margin-bottom:16px;">
          <div class="ai-section-title" style="font-size:12px; color:#a78bfa; text-transform:uppercase; margin-bottom:4px;">30-Day Forecast</div>
          <p style="font-size:13px;line-height:1.6;color:var(--muted)">${data.ai_forecast}</p>
        </div>
      ` : ''}

      ${data.ai_health_impact ? `
        <div class="ai-section" style="margin-bottom:16px;">
          <div class="ai-section-title" style="font-size:12px; color:#a78bfa; text-transform:uppercase; margin-bottom:4px;">Health Impact</div>
          <p style="font-size:13px;line-height:1.6;color:var(--muted)">${data.ai_health_impact}</p>
        </div>
      ` : ''}

      ${recsHtml ? `
        <div class="ai-section" style="margin-bottom:8px;">
          <div class="ai-section-title" style="font-size:12px; color:#a78bfa; text-transform:uppercase; margin-bottom:8px;">Recommendations</div>
          ${recsHtml}
        </div>
      ` : ''}
    </div>
  `;
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
        <a href="/app/compare.html" class="nav-item ${window.location.pathname.includes('compare') ? 'active' : ''}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"></path></svg>
            Compare
        </a>
        <a href="/app/settings.html" class="nav-item ${window.location.pathname.includes('settings') ? 'active' : ''}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            Settings
        </a>
        <div class="nav-item nav-bottom" onclick="logout()">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            Logout
        </div>
    `;
  document.body.prepend(sidebar);
  applyLanguage();
}

const UZ_CYR = {
  "Dashboard": "Асосий панель",
  "Map & Analysis": "Харита ва Таҳлил",
  "Reports": "Ҳисоботлар",
  "Compare": "Таққослаш",
  "Settings": "Созламалар",
  "Logout": "Тизимдан чиқиш",
  "Account Settings": "Ҳисоб созламалари",
  "Manage your profile and subscription": "Профиль ва обунангизни бошқаринг",
  "Profile Information": "Профиль маълумотлари",
  "Email Address": "Электрон почта",
  "Full Name": "Тўлиқ исм ёки Ф.И.Ш",
  "Company / Organization": "Ташкилот / Компания",
  "Language / Тил": "Тил / Language",
  "Save Changes": "Сақлаш",
  "Subscription Plan": "Обуна режаси",
  "FREE PLAN": "БЕПУЛ РЕЖА",
  "You are currently using the Free tier.": "Сиз ҳозирда бепул тарифдан фойдаланяпсиз.",
  "Pro Plan includes:": "Pro тарифига қуйидагилар киради:",
  "Upgrade to Pro": "Pro-га ўтиш",
  "My Territories": "Менинг ҳудудларим",
  "No territories yet. Draw one on the map!": "Ҳудудлар йўқ. Харитада бирортасини чизинг!",
  "Date From": "Бошланиш санаси",
  "Date To": "Тугаш санаси",
  "Analyze Territory": "Ҳудудни таҳлил қилиш",
  "Results": "Натижалар",
  "Save as PDF Report": "PDF ҳисобот яратиш",
  "Compare Territories": "Ҳудудларни таққослаш",
  "Side-by-side environmental analysis & radar chart": "Атроф-муҳит таҳлили ва радар графиги",
  "Run Comparison": "Таққослашни бошлаш",
  "High Risk Territories": "Юқори хавфли ҳудудлар",
  "Needs Immediate Attention": "Шошилинч эътибор талаб қилади",
  "Avg System Score": "Ўртача тизим баҳоси",
  "Based on recent scans": "Сўнгги таҳлилларга асосланган",
  "Recent Analyses": "Сўнгги таҳлиллар",
  "Territory": "Ҳудуд",
  "Risk": "Хавф",
  "Period": "Давр",

  // NEW MISSING STRINGS
  "Welcome Back,": "Хуш келибсиз,",
  "Here is the environmental overview for your selected territories.": "Танланган ҳудудларнинг экологик ҳолати.",
  "Number of Territories": "Ҳудудлар сони",
  "Best Territory": "Энг яхши ҳудуд",
  "Cleanest Air": "Энг тоза ҳаво",
  "Worst Territory": "Энг ёмон ҳудуд",
  "Poorest Air Quality": "Энг ифлос ҳаво",
  "High Risk Areas": "Юқори хавфли жойлар",
  "Data is automatically categorized based on WHO guidelines.": "Маълумотлар автоматик ЖССТ стандартлари бўйича тақсимланади.",
  "Run Analysis": "Таҳлилни бошлаш",
  "Start by drawing a polygon on the map": "Харитада ҳудуд чизишдан бошланг",
  "Environmental Reports": "Экологик Ҳисоботлар",
  "View, download and manage your generated analysis reports.": "Яратилган ҳисоботларни кўриш, юклаб олиш ва бошқариш.",
  "No reports generated yet.": "Ҳозирча ҳисобот яратилмаган.",
  "Generate one from the Map Analysis page.": "Харита саҳифасида таҳлил орқали яратинг.",
  "-- Select Territory A --": "-- А ҳудудни танланг --",
  "-- Select Territory B --": "-- Б ҳудудни танланг --"
};

window.applyLanguage = function () {
  const lang = localStorage.getItem('lang') || 'en';
  if (lang !== 'uz') return;

  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  let n;
  while (n = walk.nextNode()) {
    if (n.parentElement && (n.parentElement.tagName === 'SCRIPT' || n.parentElement.tagName === 'STYLE')) continue;
    const text = n.nodeValue.trim();
    if (text && UZ_CYR[text]) {
      n.nodeValue = n.nodeValue.replace(text, UZ_CYR[text]);
    }
  }

  // Check elements with explicit attributes
  document.querySelectorAll('input[placeholder], textarea[placeholder]').forEach(el => {
    const ph = el.getAttribute('placeholder');
    if (ph && UZ_CYR[ph]) el.setAttribute('placeholder', UZ_CYR[ph]);
  });
};

document.addEventListener('DOMContentLoaded', () => {
  // Delay slightly to ensure UI is ready
  setTimeout(applyLanguage, 100);
});

