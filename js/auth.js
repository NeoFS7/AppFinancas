// ============================================================
// AUTH.JS — Lógica de autenticação (login, signup, reset, new pwd)
// ============================================================

import { supabase } from './supabase.js';

// ── Utilitários de UI ──────────────────────────────────────

function showAlert(msg, type = 'error') {
  const el = document.getElementById('alertMsg');
  el.className = `alert-msg ${type}`;
  el.textContent = msg;
}
function clearAlert() {
  const el = document.getElementById('alertMsg');
  el.className = 'alert-msg';
  el.textContent = '';
}

function setLoading(btnId, loading, defaultText) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  btn.innerHTML = loading
    ? `<span class="spinner"></span> Aguarde...`
    : defaultText;
}

// ── Troca de view (tab / link) ─────────────────────────────

window.switchTab = function (view) {
  clearAlert();
  // esconde todas as views
  document.querySelectorAll('.auth-view').forEach(v => v.classList.remove('active'));
  // remove active de todos os tabs
  document.querySelectorAll('.auth-tab-btn').forEach(b => b.classList.remove('active'));

  if (view === 'login') {
    document.getElementById('viewLogin').classList.add('active');
    document.getElementById('tabLogin').classList.add('active');
    document.getElementById('authTabs').style.display = 'flex';
  } else if (view === 'signup') {
    document.getElementById('viewSignup').classList.add('active');
    document.getElementById('tabSignup').classList.add('active');
    document.getElementById('authTabs').style.display = 'flex';
  } else if (view === 'reset') {
    document.getElementById('viewReset').classList.add('active');
    document.getElementById('authTabs').style.display = 'none';
  } else if (view === 'newpwd') {
    document.getElementById('viewNewPwd').classList.add('active');
    document.getElementById('authTabs').style.display = 'none';
  }
};

// ── Força da senha ─────────────────────────────────────────

function checkStrength(pwd, fillId, labelId) {
  const fill = document.getElementById(fillId);
  const label = document.getElementById(labelId);
  if (!fill || !label) return;
  let score = 0;
  if (pwd.length >= 6) score++;
  if (pwd.length >= 10) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;

  const levels = [
    { w: '0%',   c: 'transparent', t: '' },
    { w: '25%',  c: '#e74c3c',     t: 'Muito fraca' },
    { w: '50%',  c: '#e67e22',     t: 'Fraca' },
    { w: '75%',  c: '#f1c40f',     t: 'Boa' },
    { w: '90%',  c: '#27ae60',     t: 'Forte' },
    { w: '100%', c: '#1abc9c',     t: 'Muito forte' },
  ];
  const lv = levels[Math.min(score, 5)];
  fill.style.width = lv.w;
  fill.style.background = lv.c;
  label.textContent = lv.t;
  label.style.color = lv.c;
}

document.getElementById('signupPassword')?.addEventListener('input', e => {
  checkStrength(e.target.value, 'pwdFill', 'pwdLabel');
});
document.getElementById('newPwd')?.addEventListener('input', e => {
  checkStrength(e.target.value, 'pwdFill2', 'pwdLabel2');
});

// ── LOGIN ──────────────────────────────────────────────────

document.getElementById('formLogin')?.addEventListener('submit', async e => {
  e.preventDefault();
  clearAlert();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!email || !password) {
    showAlert('Preencha todos os campos.'); return;
  }

  setLoading('btnLogin', true);
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  setLoading('btnLogin', false, 'Entrar');

  if (error) {
    if (error.message.includes('Email not confirmed')) {
      showAlert('Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.', 'info');
    } else if (error.message.includes('Invalid login credentials')) {
      showAlert('E-mail ou senha incorretos.');
    } else {
      showAlert(error.message);
    }
    return;
  }
  window.location.href = 'app.html';
});

// ── CADASTRO ───────────────────────────────────────────────

document.getElementById('formSignup')?.addEventListener('submit', async e => {
  e.preventDefault();
  clearAlert();
  const name     = document.getElementById('signupName').value.trim();
  const email    = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  const confirm  = document.getElementById('signupConfirm').value;

  if (!name || !email || !password || !confirm) {
    showAlert('Preencha todos os campos.'); return;
  }
  if (password.length < 6) {
    showAlert('A senha deve ter pelo menos 6 caracteres.'); return;
  }
  if (password !== confirm) {
    showAlert('As senhas não coincidem.'); return;
  }

  setLoading('btnSignup', true);
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
      emailRedirectTo: window.location.origin + window.location.pathname,
    },
  });
  setLoading('btnSignup', false, 'Criar conta');

  if (error) {
    if (error.message.includes('already registered')) {
      showAlert('Este e-mail já está cadastrado. Tente fazer login.', 'info');
    } else {
      showAlert(error.message);
    }
    return;
  }
  showAlert('Conta criada! Verifique seu e-mail para confirmar o cadastro.', 'success');
  document.getElementById('formSignup').reset();
});

// ── RESET DE SENHA (solicitar link) ───────────────────────

document.getElementById('formReset')?.addEventListener('submit', async e => {
  e.preventDefault();
  clearAlert();
  const email = document.getElementById('resetEmail').value.trim();

  if (!email) { showAlert('Digite seu e-mail.'); return; }

  setLoading('btnReset', true);
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname,
  });
  setLoading('btnReset', false, 'Enviar link de redefinição');

  if (error) { showAlert(error.message); return; }
  showAlert('Link enviado! Verifique sua caixa de entrada e spam.', 'success');
  document.getElementById('formReset').reset();
});

// ── NOVA SENHA (vindo do link do e-mail) ──────────────────

document.getElementById('formNewPwd')?.addEventListener('submit', async e => {
  e.preventDefault();
  clearAlert();
  const pwd     = document.getElementById('newPwd').value;
  const confirm = document.getElementById('newPwdConfirm').value;

  if (pwd.length < 6) { showAlert('A senha deve ter pelo menos 6 caracteres.'); return; }
  if (pwd !== confirm) { showAlert('As senhas não coincidem.'); return; }

  setLoading('btnNewPwd', true);
  const { error } = await supabase.auth.updateUser({ password: pwd });
  setLoading('btnNewPwd', false, 'Salvar nova senha');

  if (error) { showAlert(error.message); return; }
  showAlert('Senha alterada com sucesso! Redirecionando...', 'success');
  setTimeout(() => {
    supabase.auth.signOut().then(() => {
      window.location.href = 'index.html';
    });
  }, 2000);
});

// ── Inicialização: checar estado de auth e URL ─────────────

async function init() {
  // 1. Checa a URL sincronamente para evitar o redirecionamento imediato
  const hash = window.location.hash;
  const params = new URLSearchParams(window.location.search);
  const type = params.get('type') || (hash.includes('type=recovery') ? 'recovery' : null);

  if (type === 'recovery') {
    switchTab('newpwd');
    // Escutamos o evento apenas para garantir, mas já estamos na aba certa
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') switchTab('newpwd');
    });
    return; // Importante: interrompe o fluxo para não checar a sessão e redirecionar
  }

  // 2. Escuta eventos normais
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      switchTab('newpwd');
    } else if (event === 'SIGNED_IN') {
      const isNewPwdView = document.getElementById('viewNewPwd').classList.contains('active');
      if (!isNewPwdView) window.location.href = 'app.html';
    }
  });

  // 3. Checa a sessão atual no carregamento normal
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    const isNewPwdView = document.getElementById('viewNewPwd').classList.contains('active');
    if (!isNewPwdView) {
      window.location.href = 'app.html';
    }
  }
}

init();
