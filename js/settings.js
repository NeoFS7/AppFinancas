// ============================================================
// SETTINGS.JS — Configurações de conta e perfil
// ============================================================

import { supabase } from './supabase.js';
import { getProfile, updateProfile, uploadAvatar } from './data.js';

export async function initSettings() {
  await loadProfile();
  setupAvatarUpload();
  setupProfileForm();
}

// ── Carrega e exibe o perfil ───────────────────────────────

async function loadProfile() {
  try {
    const profile = await getProfile();

    document.getElementById('settingName').value  = profile.name  || '';
    document.getElementById('settingEmail').value = profile.email || '';

    setAvatarPreview(profile.avatar_url);
    // Atualiza também o avatar da sidebar
    updateSidebarAvatar(profile.avatar_url, profile.name);
  } catch (err) {
    console.error('Erro ao carregar perfil:', err);
  }
}

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

function updateSidebarAvatar(url, name) {
  const sidebarAvatarImg = document.getElementById('sidebarAvatarImg');
  const sidebarName = document.getElementById('sidebarUserName');
  const sidebarPlaceholder = document.getElementById('sidebarAvatarPlaceholder');

  if (sidebarName) sidebarName.textContent = name || 'Usuário';
  
  if (sidebarAvatarImg && sidebarPlaceholder) {
    if (url) {
      sidebarAvatarImg.src = url;
      sidebarAvatarImg.style.display = 'block';
      sidebarPlaceholder.style.display = 'none';
    } else {
      sidebarAvatarImg.style.display = 'none';
      sidebarPlaceholder.style.display = 'block'; // ou flex dependendo do estilo
    }
  }
}

// ── Upload de avatar ───────────────────────────────────────

function setupAvatarUpload() {
  const fileInput   = document.getElementById('avatarInput');
  const uploadBtn   = document.getElementById('btnUploadAvatar');
  const removeBtn   = document.getElementById('btnRemoveAvatar');

  uploadBtn?.addEventListener('click', () => fileInput?.click());

  fileInput?.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Valida tipo e tamanho
    if (!file.type.startsWith('image/')) {
      showSettingsAlert('Apenas arquivos de imagem são permitidos.', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showSettingsAlert('A imagem deve ter no máximo 5 MB.', 'error');
      return;
    }

    // Preview local imediato
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

  removeBtn?.addEventListener('click', async () => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id);
    setAvatarPreview(null);
    updateSidebarAvatar(null, document.getElementById('settingName').value);
    showSettingsAlert('Foto removida.', 'info');
  });
}

// ── Formulário de perfil (nome) ────────────────────────────

function setupProfileForm() {
  document.getElementById('settingsForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const name = document.getElementById('settingName').value.trim();
    if (!name) { showSettingsAlert('O nome não pode estar vazio.', 'error'); return; }

    const btn = document.getElementById('btnSaveProfile');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';

    try {
      await updateProfile({ name });
      // Atualiza também o metadata do user no auth
      await supabase.auth.updateUser({ data: { name } });
      updateSidebarAvatar(null, name); // só atualiza nome na sidebar
      showSettingsAlert('Perfil salvo com sucesso!', 'success');
    } catch (err) {
      showSettingsAlert('Erro ao salvar: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'Salvar alterações';
    }
  });
}

// ── Alerta de settings ─────────────────────────────────────

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
