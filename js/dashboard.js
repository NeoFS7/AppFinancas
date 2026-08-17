// ============================================================
// DASHBOARD.JS — Painel Principal de Finanças
// ------------------------------------------------------------
// Responsável por toda a lógica da aba "Painel de Finanças":
// 1. Gerenciamento do estado local (filtros, busca, paginação)
// 2. Formatação de valores (Moeda BRL e Datas)
// 3. Integração com Bootstrap 5 Modals
// 4. Cards de resumo (Saldo, Total Entradas, Total Saídas)
// 5. Tabela de lançamentos e paginação
// 6. Modal de Nova / Editar Entrada
// 7. Modal de Gerenciamento de Categorias
// 8. Modal de Confirmação de Exclusão
// ============================================================

import {
  getEntries, createEntry, updateEntry, deleteEntry,
  getCategories, createCategory, deleteCategory,
  getSummary,
} from './data.js';

// ============================================================
// 1. ESTADO LOCAL DO DASHBOARD
// ============================================================

const state = {
  page: 1,           // Página atual na tabela
  perPage: 10,       // Quantidade de registros por página
  search: '',        // Termo de pesquisa na descrição
  categoryId: '',    // Categoria filtrada (vazio = todas)
  type: 'all',       // Tipo filtrado: 'all', 'entrada' ou 'saida'
  categories: [],    // Lista de categorias carregadas em memória
  totalCount: 0,     // Total de registros encontrados no banco
  editingId: null,   // ID da entrada em edição (null = criando nova)
};

// ============================================================
// 2. FUNÇÕES DE FORMATAÇÃO
// ============================================================

/**
 * Converte um número float para o formato de moeda brasileiro (Ex: R$ 1.250,50).
 */
export function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

/**
 * Converte data ISO (YYYY-MM-DD) para formato legível (DD/MM/YYYY).
 */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

// ============================================================
// 3. HELPERS PARA MODAIS DO BOOTSTRAP 5
// ============================================================

/**
 * Abre um modal Bootstrap pelo ID do elemento HTML.
 */
function openBsModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  bootstrap.Modal.getOrCreateInstance(el).show();
}

/**
 * Fecha um modal Bootstrap pelo ID do elemento HTML.
 */
function closeBsModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  bootstrap.Modal.getOrCreateInstance(el).hide();
}

// ============================================================
// 4. INICIALIZAÇÃO DO DASHBOARD
// ============================================================

/**
 * Chamada quando a aba "Painel de Finanças" é ativada pela primeira vez.
 */
export async function initDashboard() {
  await loadCategories();
  setupFilters();
  setupEntryModal();
  setupCategoryModal();
  await refreshAll();
}

/**
 * Recarrega tanto os cards de sumário quanto a tabela de dados.
 */
async function refreshAll() {
  await Promise.all([loadSummary(), loadEntries()]);
}

// ============================================================
// 5. CARDS DE RESUMO (Saldo, Entradas e Saídas)
// ============================================================

/**
 * Busca os totais agregados e atualiza o texto e as cores dos cards no topo.
 */
async function loadSummary() {
  try {
    const { totalEntradas, totalSaidas, saldo } = await getSummary();
    document.getElementById('cardSaldo').textContent    = formatCurrency(saldo);
    document.getElementById('cardEntradas').textContent = formatCurrency(totalEntradas);
    document.getElementById('cardSaidas').textContent   = formatCurrency(totalSaidas);

    // Ajusta a cor do saldo (verde se positivo/zero, vermelho se negativo)
    const saldoEl = document.getElementById('cardSaldo');
    saldoEl.style.color = saldo >= 0 ? 'var(--entrada)' : 'var(--saida)';
  } catch (err) {
    console.error('Erro ao carregar sumário:', err);
  }
}

// ============================================================
// 6. GESTÃO DE CATEGORIAS EM MEMÓRIA
// ============================================================

/**
 * Carrega a lista de categorias do banco e popula os selects de filtro e de formulário.
 */
async function loadCategories() {
  state.categories = await getCategories();
  populateCategoryFilter();
  populateCategorySelect();
}

/**
 * Preenche o select de filtro na toolbar da tabela.
 */
function populateCategoryFilter() {
  const sel = document.getElementById('filterCategory');
  if (!sel) return;
  sel.innerHTML = `<option value="">Todas as categorias</option>` +
    state.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  sel.value = state.categoryId;
}

/**
 * Preenche o select de categoria dentro do formulário de criação/edição de entrada.
 */
function populateCategorySelect() {
  const sel = document.getElementById('entryCategory');
  if (!sel) return;
  sel.innerHTML = `<option value="">— Sem categoria —</option>` +
    state.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

// ============================================================
// 7. TABELA DE ENTRADAS & PAGINAÇÃO
// ============================================================

/**
 * Executa a busca paginada no banco com base nos filtros ativos e renderiza o HTML.
 */
async function loadEntries() {
  const tbody = document.getElementById('entriesBody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">
    <div class="spinner-border spinner-border-sm me-2" role="status"></div> Carregando...
  </td></tr>`;

  try {
    const { data, count } = await getEntries({
      search:     state.search,
      categoryId: state.categoryId,
      type:       state.type,
      page:       state.page,
      perPage:    state.perPage,
    });
    state.totalCount = count;
    renderTable(data);
    renderPagination();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">Erro ao carregar dados.</td></tr>`;
    console.error(err);
  }
}

/**
 * Constrói as linhas (TRs) da tabela a partir dos dados recebidos.
 */
function renderTable(entries) {
  const tbody = document.getElementById('entriesBody');
  if (!entries.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted fst-italic">Nenhuma entrada encontrada.</td></tr>`;
    return;
  }
  tbody.innerHTML = entries.map(e => `
    <tr data-id="${e.id}">
      <td class="text-nowrap">${formatDate(e.date)}</td>
      <td class="desc-cell">${e.description || '<span class="text-muted">—</span>'}</td>
      <td>
        ${e.category
          ? `<span class="badge rounded-pill" style="background:${e.category.color}22;color:${e.category.color};border:1px solid ${e.category.color}44;">${e.category.name}</span>`
          : '<span class="text-muted">—</span>'}
      </td>
      <td class="fw-semibold text-nowrap ${e.type === 'entrada' ? 'text-entrada' : 'text-saida'}">${formatCurrency(e.value)}</td>
      <td><span class="badge rounded-pill type-badge-${e.type}">${e.type === 'entrada' ? 'Entrada' : 'Saída'}</span></td>
      <td class="text-nowrap">
        <button class="btn btn-sm btn-light me-1" title="Editar" onclick="openEditEntry('${e.id}')">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" /></svg>
        </button>
        <button class="btn btn-sm btn-light text-danger" title="Excluir" onclick="confirmDeleteEntry('${e.id}')">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
        </button>
      </td>
    </tr>
  `).join('');
}

/**
 * Atualiza o rodapé de paginação (texto "X–Y de Z" e estado dos botões Anterior/Próximo).
 */
function renderPagination() {
  const totalPages = Math.ceil(state.totalCount / state.perPage) || 1;
  const from = state.totalCount === 0 ? 0 : (state.page - 1) * state.perPage + 1;
  const to   = Math.min(state.page * state.perPage, state.totalCount);

  document.getElementById('pageInfo').textContent = `${from}–${to} de ${state.totalCount}`;
  document.getElementById('btnPrevPage').disabled = state.page <= 1;
  document.getElementById('btnNextPage').disabled = state.page >= totalPages;

  const sel = document.getElementById('perPageSelect');
  if (sel) sel.value = state.perPage;
}

// ============================================================
// 8. CONFIGURAÇÃO DE EVENTOS DE FILTROS E BUSCA
// ============================================================

function setupFilters() {
  const searchInput   = document.getElementById('searchInput');
  const filterCat     = document.getElementById('filterCategory');
  const filterType    = document.getElementById('filterType');
  const perPageSelect = document.getElementById('perPageSelect');
  const btnPrev       = document.getElementById('btnPrevPage');
  const btnNext       = document.getElementById('btnNextPage');

  // Debounce de 350ms para não fazer query a cada letra digitada
  let searchTimer;
  searchInput?.addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { state.search = e.target.value; state.page = 1; loadEntries(); }, 350);
  });

  // Filtros imediatos
  filterCat?.addEventListener('change',     e => { state.categoryId = e.target.value; state.page = 1; loadEntries(); });
  filterType?.addEventListener('change',    e => { state.type = e.target.value; state.page = 1; loadEntries(); });
  perPageSelect?.addEventListener('change', e => { state.perPage = parseInt(e.target.value); state.page = 1; loadEntries(); });

  // Botões de navegação de páginas
  btnPrev?.addEventListener('click', () => { if (state.page > 1) { state.page--; loadEntries(); } });
  btnNext?.addEventListener('click', () => {
    if (state.page < Math.ceil(state.totalCount / state.perPage)) { state.page++; loadEntries(); }
  });
}

// ============================================================
// 9. MODAL: NOVA OU EDITAR ENTRADA
// ============================================================

function setupEntryModal() {
  document.getElementById('btnNewEntry')?.addEventListener('click', () => openNewEntry());
  document.getElementById('entryForm')?.addEventListener('submit', handleEntrySave);
}

/**
 * Prepara o formulário para criar um novo registro (limpa campos e define data atual).
 */
window.openNewEntry = function () {
  state.editingId = null;

  const label = document.getElementById('entryModalLabel');
  if (label) label.textContent = 'Nova Entrada';

  document.getElementById('entryForm').reset();
  document.getElementById('entryDate').value = new Date().toISOString().split('T')[0];

  populateCategorySelect();
  openBsModal('entryModal');
};

/**
 * Abre o modal preenchendo os dados do item selecionado para edição.
 */
window.openEditEntry = async function (id) {
  state.editingId = id;

  const label = document.getElementById('entryModalLabel');
  if (label) label.textContent = 'Editar Entrada';

  const { data } = await getEntries({ page: 1, perPage: 9999 });
  const entry = data.find(e => e.id === id);

  if (!entry) return;

  populateCategorySelect();

  document.getElementById('entryDate').value = entry.date;
  document.getElementById('entryDescription').value = entry.description || '';
  document.getElementById('entryCategory').value = entry.category_id || '';
  document.getElementById('entryValue').value = entry.value;
  document.getElementById('entryType').value = entry.type;

  openBsModal('entryModal');
};

/**
 * Salva a entrada (cria se editingId for nulo, ou atualiza se existir ID).
 */
async function handleEntrySave(e) {
  e.preventDefault();
  const payload = {
    date:        document.getElementById('entryDate').value,
    description: document.getElementById('entryDescription').value,
    categoryId:  document.getElementById('entryCategory').value,
    value:       document.getElementById('entryValue').value,
    type:        document.getElementById('entryType').value,
  };
  if (!payload.date || !payload.value || !payload.type) return;

  const btn = document.getElementById('btnSaveEntry');
  const original = btn.innerHTML;

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span> Salvando';

  try {
    if (state.editingId) {
      await updateEntry(state.editingId, payload);
    } else {
      await createEntry(payload);
    }
    closeBsModal('entryModal');
    await refreshAll();
  } catch (err) {
    alert('Erro ao salvar: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
  }
}

// ============================================================
// 10. MODAL: GERENCIAR CATEGORIAS
// ============================================================

function setupCategoryModal() {
  document.getElementById('btnNewCategory')?.addEventListener('click', openCategoryModal);
  document.getElementById('categoryForm')?.addEventListener('submit', handleCategorySave);
}

function openCategoryModal() {
  document.getElementById('categoryForm').reset();
  document.getElementById('categoryColor').value = '#701c1c';
  renderCategoryList();
  openBsModal('categoryModal');
}

/**
 * Renderiza a lista de categorias existentes dentro do modal de gerenciamento.
 */
async function renderCategoryList() {
  const list = document.getElementById('categoryList');
  if (!list) return;
  list.innerHTML = state.categories.map(c => `
    <div class="d-flex align-items-center gap-2 p-2 bg-white rounded mb-1 border">
      <span style="width:12px;height:12px;border-radius:50%;background:${c.color};flex-shrink:0;display:inline-block;"></span>
      <span class="flex-grow-1 small">${c.name}</span>
      <button class="btn btn-sm btn-outline-danger border-0 p-1" onclick="confirmDeleteCategory('${c.id}','${c.name.replace(/'/g,"\\'")}')">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
      </button>
    </div>
  `).join('') || '<p class="text-muted small mb-0">Nenhuma categoria ainda.</p>';
}

/**
 * Cria uma nova categoria e atualiza a interface.
 */
async function handleCategorySave(e) {
  e.preventDefault();
  const name  = document.getElementById('categoryName').value.trim();
  const color = document.getElementById('categoryColor').value;
  if (!name) return;

  try {
    await createCategory({ name, color });
    await loadCategories();
    document.getElementById('categoryForm').reset();
    document.getElementById('categoryColor').value = '#701c1c';
    renderCategoryList();
  } catch (err) {
    alert('Erro: ' + err.message);
  }
}

/**
 * Solicita confirmação antes de apagar uma categoria.
 */
window.confirmDeleteCategory = function (id, name) {
  openConfirmModal(
    `Excluir categoria "${name}"?`,
    'As entradas vinculadas a ela ficarão sem categoria.',
    async () => {
      try {
        await deleteCategory(id);
        await loadCategories();
        renderCategoryList();
        await loadEntries();
      } catch (err) { alert('Erro: ' + err.message); }
    }
  );
};

// ============================================================
// 11. MODAL: EXCLUSÃO DE ENTRADA FINANCEIRA
// ============================================================

window.confirmDeleteEntry = function (id) {
  openConfirmModal(
    'Excluir esta entrada?',
    'Esta ação não pode ser desfeita.',
    async () => {
      try {
        await deleteEntry(id);
        await refreshAll();
      } catch (err) { alert('Erro: ' + err.message); }
    }
  );
};

// ============================================================
// 12. MODAL GENÉRICO DE CONFIRMAÇÃO
// ============================================================

let confirmCallback = null;

/**
 * Abre o modal de confirmação recebendo um título, texto explicativo e a função callback.
 */
function openConfirmModal(title, msg, cb) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMsg').textContent   = msg;
  confirmCallback = cb;
  openBsModal('confirmModal');
}

// Ações dos botões do modal de confirmação
window._dashConfirm = function () {
  closeBsModal('confirmModal');
  confirmCallback?.();
};
window._dashCancel = function () {
  closeBsModal('confirmModal');
};