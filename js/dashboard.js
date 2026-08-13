// ============================================================
// DASHBOARD.JS — Painel de Finanças (com Bootstrap 5 Modals)
// ============================================================

import {
  getEntries, createEntry, updateEntry, deleteEntry,
  getCategories, createCategory, deleteCategory,
  getSummary,
} from './data.js';

// ── Estado ────────────────────────────────────────────────

const state = {
  page: 1,
  perPage: 10,
  search: '',
  categoryId: '',
  type: 'all',
  categories: [],
  totalCount: 0,
  editingId: null,
};

// ── Formatação ─────────────────────────────────────────────

export function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

// ── Bootstrap Modal helpers ────────────────────────────────

function openBsModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  bootstrap.Modal.getOrCreateInstance(el).show();
}

function closeBsModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  bootstrap.Modal.getOrCreateInstance(el).hide();
}

// ── Inicialização ──────────────────────────────────────────

export async function initDashboard() {
  await loadCategories();
  setupFilters();
  setupEntryModal();
  setupCategoryModal();
  await refreshAll();
}

async function refreshAll() {
  await Promise.all([loadSummary(), loadEntries()]);
}

// ── Sumário (Cards) ────────────────────────────────────────

async function loadSummary() {
  try {
    const { totalEntradas, totalSaidas, saldo } = await getSummary();
    document.getElementById('cardSaldo').textContent    = formatCurrency(saldo);
    document.getElementById('cardEntradas').textContent = formatCurrency(totalEntradas);
    document.getElementById('cardSaidas').textContent   = formatCurrency(totalSaidas);
    const saldoEl = document.getElementById('cardSaldo');
    saldoEl.style.color = saldo >= 0 ? 'var(--entrada)' : 'var(--saida)';
  } catch (err) {
    console.error('Erro ao carregar sumário:', err);
  }
}

// ── Categorias ─────────────────────────────────────────────

async function loadCategories() {
  state.categories = await getCategories();
  populateCategoryFilter();
  populateCategorySelect();
}

function populateCategoryFilter() {
  const sel = document.getElementById('filterCategory');
  if (!sel) return;
  sel.innerHTML = `<option value="">Todas</option>` +
    state.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  sel.value = state.categoryId;
}

function populateCategorySelect() {
  const sel = document.getElementById('entryCategory');
  if (!sel) return;
  sel.innerHTML = `<option value="">— Sem categoria —</option>` +
    state.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

// ── Tabela de entradas ─────────────────────────────────────

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

// ── Paginação ──────────────────────────────────────────────

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

// ── Filtros ────────────────────────────────────────────────

function setupFilters() {
  const searchInput   = document.getElementById('searchInput');
  const filterCat     = document.getElementById('filterCategory');
  const filterType    = document.getElementById('filterType');
  const perPageSelect = document.getElementById('perPageSelect');
  const btnPrev       = document.getElementById('btnPrevPage');
  const btnNext       = document.getElementById('btnNextPage');

  let searchTimer;
  searchInput?.addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { state.search = e.target.value; state.page = 1; loadEntries(); }, 350);
  });
  filterCat?.addEventListener('change',     e => { state.categoryId = e.target.value; state.page = 1; loadEntries(); });
  filterType?.addEventListener('change',    e => { state.type = e.target.value; state.page = 1; loadEntries(); });
  perPageSelect?.addEventListener('change', e => { state.perPage = parseInt(e.target.value); state.page = 1; loadEntries(); });
  btnPrev?.addEventListener('click', () => { if (state.page > 1) { state.page--; loadEntries(); } });
  btnNext?.addEventListener('click', () => {
    if (state.page < Math.ceil(state.totalCount / state.perPage)) { state.page++; loadEntries(); }
  });
}

// ── Modal de Entrada ───────────────────────────────────────

function setupEntryModal() {
  document.getElementById('btnNewEntry')?.addEventListener('click', () => openNewEntry());
  document.getElementById('entryForm')?.addEventListener('submit', handleEntrySave);
}

window.openNewEntry = function () {
  state.editingId = null;

  const label = document.getElementById('entryModalLabel');
  if (label) label.textContent = 'Nova Entrada';

  document.getElementById('entryForm').reset();
  document.getElementById('entryDate').value = new Date().toISOString().split('T')[0];

  populateCategorySelect();
  openBsModal('entryModal');
};

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

// ── Modal de Categoria ─────────────────────────────────────

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

// ── Excluir Entrada ────────────────────────────────────────

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

// ── Modal de Confirmação ───────────────────────────────────

let confirmCallback = null;

function openConfirmModal(title, msg, cb) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMsg').textContent   = msg;
  confirmCallback = cb;
  openBsModal('confirmModal');
}

window._dashConfirm = function () {
  closeBsModal('confirmModal');
  confirmCallback?.();
};
window._dashCancel = function () {
  closeBsModal('confirmModal');
};