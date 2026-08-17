// ============================================================
// APP.JS — Roteador Principal, Proteção de Rotas e Inicialização
// ------------------------------------------------------------
// Este arquivo é o ponto de entrada do painel autenticado:
// 1. Verifica se o usuário possui sessão ativa (proteção de rota)
// 2. Controla a troca de abas (Dashboard, Relatórios, Configurações)
// 3. Inicializa cada módulo sob demanda (Lazy Loading)
// 4. Controla a abertura e fechamento da barra lateral no mobile
// 5. Gerencia o logout do usuário
// ============================================================

import { supabase } from './supabase.js';
import { initDashboard } from './dashboard.js';
import { initReports }   from './reports.js';
import { initSettings }  from './settings.js';
import { getProfile }    from './data.js';

// Lista de seções/abas válidas no aplicativo
const sections = ['dashboard', 'reports', 'settings'];

// Controle de módulos já inicializados para não re-executar setups repetidamente
let initialized = { dashboard: false, reports: false, settings: false };

// ============================================================
// 1. PROTEÇÃO DE ROTAS (Autenticação)
// ============================================================

/**
 * Checa se o usuário está autenticado no Supabase.
 * Se não houver sessão ativa, redireciona imediatamente para a tela de login (index.html).
 */
async function checkAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = 'index.html';
    return null;
  }
  return session;
}

// ============================================================
// 2. NAVEGAÇÃO ENTRE ABAS (SPA Router)
// ============================================================

/**
 * Alterna a seção visível na tela e atualiza os botões ativos no menu lateral.
 * Inicializa o JavaScript da aba apenas quando ela for acessada pela 1ª vez.
 */
function navigateTo(section) {
  if (!sections.includes(section)) section = 'dashboard';

  // 1. Atualiza visualmente o botão ativo no menu lateral
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.section === section);
  });

  // 2. Alterna a visibilidade das tags <section> no HTML
  sections.forEach(s => {
    const el = document.getElementById(`section-${s}`);
    if (el) el.style.display = s === section ? 'block' : 'none';
  });

  // 3. Inicialização sob demanda (Lazy Init)
  if (!initialized[section]) {
    initialized[section] = true;
    if (section === 'dashboard') initDashboard();
    if (section === 'reports')   initReports();
    if (section === 'settings')  initSettings();
  }
}

// ============================================================
// 3. LOGOUT (Desconectar)
// ============================================================

async function logout() {
  await supabase.auth.signOut();
  window.location.href = 'index.html';
}

// ============================================================
// 4. MENU LATERAL RESPONSIVO (Mobile Drawer)
// ============================================================

/**
 * Abre a barra lateral no mobile e ativa o fundo escurecido (overlay).
 */
function openSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  sidebar?.classList.add('open');
  overlay?.classList.add('active');
  document.body.style.overflow = 'hidden'; // Evita rolagem da página ao fundo
}

/**
 * Fecha a barra lateral no mobile e desativa o overlay.
 */
function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  sidebar?.classList.remove('open');
  overlay?.classList.remove('active');
  document.body.style.overflow = '';
}

// ============================================================
// 5. INICIALIZAÇÃO GERAL DO APLICATIVO
// ============================================================

async function init() {
  // 1. Garante que o usuário está autenticado
  const session = await checkAuth();
  if (!session) return;

  // 2. Carrega e exibe nome e foto do usuário na saudação e no rodapé da sidebar
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

  // 3. Configura eventos de clique nos itens do menu de navegação
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', () => {
      navigateTo(el.dataset.section);
      closeSidebar(); // Fecha automaticamente a sidebar no mobile ao clicar em um item
    });
  });

  // 4. Configura eventos do menu hambúrguer e do overlay no mobile
  document.getElementById('hamburgerBtn')?.addEventListener('click', openSidebar);
  document.getElementById('sidebarOverlay')?.addEventListener('click', closeSidebar);

  // 5. Configura botões de logout
  document.getElementById('btnLogout')?.addEventListener('click', logout);
  document.getElementById('btnLogoutSettings')?.addEventListener('click', logout);

  // 6. Abre o Painel de Finanças como aba padrão inicial
  navigateTo('dashboard');
}

// Dispara a inicialização
init();
