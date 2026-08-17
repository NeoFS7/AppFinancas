// ============================================================
// SETTINGS.JS — Configurações da Conta e Perfil do Usuário
// ------------------------------------------------------------
// Responsável por gerenciar:
// 1. Carregamento dos dados do usuário (nome, e-mail, foto)
// 2. Pré-visualização e sincronização imediata do avatar com a sidebar
// 3. Upload de nova foto de perfil com validação de tipo e tamanho
// 4. Remoção de foto de perfil
// 5. Atualização do nome do perfil e metadados de autenticação
// 6. Mensagens de feedback e alertas temporizados
// ============================================================

import { supabase } from './supabase.js';
import { getProfile, updateProfile, uploadAvatar } from './data.js';

// ============================================================
// 1. INICIALIZAÇÃO DA ABA DE CONFIGURAÇÕES
// ============================================================

export async function initSettings() {
  await loadProfile();
  setupAvatarUpload();
  setupProfileForm();
}

// ============================================================
// 2. CARREGAMENTO E SINCRONIZAÇÃO DO PERFIL
// ============================================================

/**
 * Busca os dados do perfil no banco e preenche os campos do formulário e imagem de avatar.
 */
async function loadProfile() {
  try {
    const profile = await getProfile();

    document.getElementById('settingName').value  = profile.name  || '';
    document.getElementById('settingEmail').value = profile.email || '';

    setAvatarPreview(profile.avatar_url);
    // Atualiza também o avatar na sidebar em tempo real
    updateSidebarAvatar(profile.avatar_url, profile.name);
  } catch (err) {
    console.error('Erro ao carregar perfil:', err);
  }
}

/**
 * Atualiza o preview visual do avatar na tela de configurações.
 */
function setAvatarPreview(url) {
  const img = document.getElementById('avatarPreview');
  const placeholder = document.getElementById('avatarPlaceholder');
  if (url) {
    img.src = url;
    img.style.display = 'block';
    if (placeholder) placeholder.style.display = 'none';
  } else {
    img.style.display = 'none';
    if (placeholder) placeholder.style.display = 'flex';
  }
}

/**
 * Sincroniza a imagem e o nome exibidos no card do usuário na barra lateral (sidebar).
 */
function updateSidebarAvatar(url, name) {
  const sidebarAvatarImg = document.getElementById('sidebarAvatarImg');
  const sidebarName = document.getElementById('sidebarUserName');
  const sidebarPlaceholder = document.getElementById('sidebarAvatarPlaceholder');

  if (sidebarName && name) sidebarName.textContent = name;
  
  if (sidebarAvatarImg && sidebarPlaceholder) {
    if (url) {
      sidebarAvatarImg.src = url;
      sidebarAvatarImg.style.display = 'block';
      sidebarPlaceholder.style.display = 'none';
    } else {
      sidebarAvatarImg.style.display = 'none';
      sidebarPlaceholder.style.display = 'block';
    }
  }
}

// ============================================================
// 3. UPLOAD E REMOÇÃO DA FOTO DE PERFIL
// ============================================================

function setupAvatarUpload() {
  const fileInput = document.getElementById('avatarInput');
  const uploadBtn = document.getElementById('btnUploadAvatar');
  const removeBtn = document.getElementById('btnRemoveAvatar');

  // Abre a janela de seleção de arquivo ao clicar no botão
  uploadBtn?.addEventListener('click', () => fileInput?.click());

  // Trata o arquivo selecionado
  fileInput?.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. Valida se é realmente uma imagem
    if (!file.type.startsWith('image/')) {
      showSettingsAlert('Apenas arquivos de imagem são permitidos.', 'error');
      return;
    }
    // 2. Valida tamanho máximo de 5 MB
    if (file.size > 5 * 1024 * 1024) {
      showSettingsAlert('A imagem deve ter no máximo 5 MB.', 'error');
      return;
    }

    // 3. Preview local instantâneo enquanto faz o upload
    const reader = new FileReader();
    reader.onload = ev => setAvatarPreview(ev.target.result);
    reader.readAsDataURL(file);

    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<span class="spinner"></span>';

    try {
      const url = await uploadAvatar(file);
      setAvatarPreview(url);
      updateSidebarAvatar(url, document.getElementById('settingName').value);
      showSettingsAlert('Foto de perfil atualizada!', 'success');
    } catch (err) {
      showSettingsAlert('Erro ao enviar imagem: ' + err.message, 'error');
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.innerHTML = 'Alterar foto';
      fileInput.value = '';
    }
  });

  // Remove a foto do perfil e restaura o placeholder
  removeBtn?.addEventListener('click', async () => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id);
    setAvatarPreview(null);
    updateSidebarAvatar(null, document.getElementById('settingName').value);
    showSettingsAlert('Foto removida.', 'info');
  });
}

// ============================================================
// 4. FORMULÁRIO DE ATUALIZAÇÃO DO NOME
// ============================================================

function setupProfileForm() {
  document.getElementById('settingsForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const name = document.getElementById('settingName').value.trim();
    if (!name) { showSettingsAlert('O nome não pode estar vazio.', 'error'); return; }

    const btn = document.getElementById('btnSaveProfile');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';

    try {
      // 1. Atualiza a tabela pública profiles
      await updateProfile({ name });
      // 2. Atualiza os metadados do usuário na sessão Auth
      await supabase.auth.updateUser({ data: { name } });
      // 3. Atualiza na sidebar e saudação
      updateSidebarAvatar(null, name);
      document.getElementById('greetingName').textContent = name;
      showSettingsAlert('Perfil salvo com sucesso!', 'success');
    } catch (err) {
      showSettingsAlert('Erro ao salvar: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'Salvar alterações';
    }
  });
}

// ============================================================
// 5. FEEDBACK VISUAL (Alertas)
// ============================================================

/**
 * Exibe mensagem de feedback no formulário de configurações e auto-limpa após 4 segundos.
 */
function showSettingsAlert(msg, type = 'info') {
  const el = document.getElementById('settingsAlert');
  if (!el) return;
  el.className = `alert-msg ${type}`;
  el.textContent = msg;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => {
    el.className = 'alert-msg';
    el.textContent = '';
  }, 4000);
}
