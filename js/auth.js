// ============================================================
// AUTH.JS — Lógica de Autenticação e Gestão de Sessão
// ------------------------------------------------------------
// Controla os fluxos de:
// 1. Alternância visual entre telas (Login, Cadastro, Esqueci Senha, Nova Senha)
// 2. Medidor interativo de força de senha
// 3. Login com e-mail e senha
// 4. Cadastro de nova conta
// 5. Envio de link de recuperação de senha
// 6. Redefinição da nova senha
// 7. Ouvinte de estado de autenticação e redirecionamentos
// ============================================================

import { supabase } from './supabase.js';

// ============================================================
// 1. UTILITÁRIOS DE INTERFACE (Feedback visual ao usuário)
// ============================================================

/**
 * Exibe uma mensagem de feedback (erro, sucesso ou aviso) no topo do card.
 */
function showAlert(msg, type = 'error') {
  const el = document.getElementById('alertMsg');
  el.className = `alert-msg ${type}`;
  el.textContent = msg;
}

/**
 * Limpa qualquer alerta exibido atualmente.
 */
function clearAlert() {
  const el = document.getElementById('alertMsg');
  el.className = 'alert-msg';
  el.textContent = '';
}

/**
 * Altera o estado de carregamento de um botão (desabilita e adiciona spinner).
 */
function setLoading(btnId, loading, defaultText) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  btn.innerHTML = loading
    ? `<span class="spinner"></span> Aguarde...`
    : defaultText;
}

// ============================================================
// 2. CONTROLE DE ABAS E TELAS (View Router simples)
// ============================================================

/**
 * Alterna dinamicamente a visibilidade das seções da tela de login.
 * Disponível globalmente no objeto `window` para ser acionado por `onclick` no HTML.
 */
window.switchTab = function (view) {
  clearAlert();
  // Esconde todas as visualizações ativas
  document.querySelectorAll('.auth-view').forEach(v => v.classList.remove('active'));
  // Desmarca os botões de aba
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
    document.getElementById('authTabs').style.display = 'none'; // Esconde abas para focar no fluxo
  } else if (view === 'newpwd') {
    document.getElementById('viewNewPwd').classList.add('active');
    document.getElementById('authTabs').style.display = 'none';
  }
};

// ============================================================
// 3. MEDIDOR DE FORÇA DA SENHA
// ============================================================

/**
 * Avalia critérios de segurança da senha digitada e atualiza a barra colorida:
 * - Comprimento (>= 6 e >= 10)
 * - Letras maiúsculas
 * - Números
 * - Caracteres especiais
 */
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

// Ouve a digitação nos campos de senha para atualizar a força em tempo real
document.getElementById('signupPassword')?.addEventListener('input', e => {
  checkStrength(e.target.value, 'pwdFill', 'pwdLabel');
});
document.getElementById('newPwd')?.addEventListener('input', e => {
  checkStrength(e.target.value, 'pwdFill2', 'pwdLabel2');
});

// ============================================================
// 4. FLUXO: LOGIN
// ============================================================

document.getElementById('formLogin')?.addEventListener('submit', async e => {
  e.preventDefault();
  clearAlert();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  // Validação básica de campos
  if (!email || !password) {
    showAlert('Preencha todos os campos.'); return;
  }

  setLoading('btnLogin', true);
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  setLoading('btnLogin', false, 'Entrar');

  // Trata mensagens de erro retornadas pelo Supabase
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

  // Sucesso: redireciona para o aplicativo principal
  window.location.href = 'app.html';
});

// ============================================================
// 5. FLUXO: CADASTRO
// ============================================================

document.getElementById('formSignup')?.addEventListener('submit', async e => {
  e.preventDefault();
  clearAlert();
  const name     = document.getElementById('signupName').value.trim();
  const email    = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  const confirm  = document.getElementById('signupConfirm').value;

  // Validações no cliente
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
  // Cria a conta enviando os metadados do nome para o trigger criar o profile no banco
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

// ============================================================
// 6. FLUXO: RECUPERAÇÃO DE SENHA (Solicitar Link)
// ============================================================

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

// ============================================================
// 7. FLUXO: NOVA SENHA (Após clicar no link recebido por e-mail)
// ============================================================

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
  // Desloga e volta para o login após 2 segundos
  setTimeout(() => {
    supabase.auth.signOut().then(() => {
      window.location.href = 'index.html';
    });
  }, 2000);
});

// ============================================================
// 8. INICIALIZAÇÃO E TRATAMENTO DE LINKS DE RECUPERAÇÃO
// ============================================================

async function init() {
  // 1. Checa se o usuário acessou a página via link de recuperação de senha
  const hash = window.location.hash;
  const params = new URLSearchParams(window.location.search);
  const type = params.get('type') || (hash.includes('type=recovery') ? 'recovery' : null);

  if (type === 'recovery') {
    switchTab('newpwd');
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') switchTab('newpwd');
    });
    return; // Interrompe para não redirecionar antes de redefinir a senha
  }

  // 2. Escuta eventos normais de autenticação
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      switchTab('newpwd');
    } else if (event === 'SIGNED_IN') {
      const isNewPwdView = document.getElementById('viewNewPwd').classList.contains('active');
      if (!isNewPwdView) window.location.href = 'app.html';
    }
  });

  // 3. Se já houver sessão ativa, vai direto para o app
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    const isNewPwdView = document.getElementById('viewNewPwd').classList.contains('active');
    if (!isNewPwdView) {
      window.location.href = 'app.html';
    }
  }
}

// Executa a checagem inicial
init();
