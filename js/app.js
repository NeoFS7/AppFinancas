// ============================================================
// APP.JS — Inicialização, proteção de rota, roteador de abas
// ============================================================

import { supabase } from './supabase.js';
import { initDashboard } from './dashboard.js';
import { initReports }   from './reports.js';
import { initSettings }  from './settings.js';
import { getProfile }    from './data.js';

const sections = ['dashboard', 'reports', 'settings'];
let initialized = { dashboard: false, reports: false, settings: false };

// ── Proteção de rota ──────────────────────────────────────

async function checkAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = 'index.html';
    return null;
  }
  return session;
}

// ── Navegação entre abas ──────────────────────────────────

function navigateTo(section) {
  if (!sections.includes(section)) section = 'dashboard';

  // Ativa a aba no menu
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.section === section);
  });

  // Mostra a seção correta
  sections.forEach(s => {
    const el = document.getElementById(`section-${s}`);
    if (el) el.style.display = s === section ? 'block' : 'none';
  });

  // Inicializa lazy se ainda não foi
  if (!initialized[section]) {
    initialized[section] = true;
    if (section === 'dashboard') initDashboard();
    if (section === 'reports')   initReports();
    if (section === 'settings')  initSettings();
  }
}

// ── Logout ─────────────────────────────────────────────────

async function logout() {
  await supabase.auth.signOut();
  window.location.href = 'index.html';
}

// ── Inicialização principal ────────────────────────────────

async function init() {
  const session = await checkAuth();
  if (!session) return;

  // Exibe nome do usuário na saudação e sidebar
  try {
    const profile = await getProfile();
    const displayName = profile.name || session.user.email;
    document.getElementById('greetingName').textContent = displayName;
    document.getElementById('sidebarUserName').textContent = displayName;
    document.getElementById('sidebarUserEmail').textContent = profile.email || '';
    if (profile.avatar_url) {
      const img = document.getElementById('sidebarAvatarImg');
      if (img) {
        img.src = profile.avatar_url;
        img.style.display = 'block';
        const placeholder = document.getElementById('sidebarAvatarPlaceholder');
        if (placeholder) placeholder.style.display = 'none';
      }
    }
  } catch (_) {}

  // Evento de navegação
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', () => navigateTo(el.dataset.section));
  });

  // Logout
  document.getElementById('btnLogout')?.addEventListener('click', logout);
  document.getElementById('btnLogoutSettings')?.addEventListener('click', logout);

  // Navega para dashboard por padrão
  navigateTo('dashboard');
}

init();
