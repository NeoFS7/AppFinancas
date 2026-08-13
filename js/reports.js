// ============================================================
// REPORTS.JS — Relatórios mensais com Chart.js
// ============================================================

import { getEntriesByMonth } from './data.js';
import { formatCurrency } from './dashboard.js';

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MONTHS_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

let barChart = null;
let pieChart = null;

export async function initReports() {
  const year = new Date().getFullYear();
  document.getElementById('reportYear').value = year;

  document.getElementById('reportYear')?.addEventListener('change', e => {
    loadReport(parseInt(e.target.value));
  });

  // preenche o select de anos
  const sel = document.getElementById('reportYear');
  const currentYear = new Date().getFullYear();
  sel.innerHTML = '';
  for (let y = currentYear + 1; y >= currentYear - 5; y--) {
    sel.innerHTML += `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`;
  }

  await loadReport(year);
}

async function loadReport(year) {
  const spinner = document.getElementById('reportsSpinner');
  if (spinner) spinner.style.display = 'flex';

  try {
    const entries = await getEntriesByMonth(year);
    renderBarChart(entries, year);
    renderPieChart(entries);
    renderHistoryTable(entries);
  } catch (err) {
    console.error('Erro ao carregar relatório:', err);
  } finally {
    if (spinner) spinner.style.display = 'none';
  }
}

// ── Gráfico de barras: Entradas vs Saídas por mês ─────────

function renderBarChart(entries, year) {
  const monthlyData = Array.from({ length: 12 }, () => ({ entrada: 0, saida: 0 }));

  for (const e of entries) {
    const month = parseInt(e.date.split('-')[1]) - 1;
    if (e.type === 'entrada') monthlyData[month].entrada += parseFloat(e.value);
    else monthlyData[month].saida += parseFloat(e.value);
  }

  const ctx = document.getElementById('barChart')?.getContext('2d');
  if (!ctx) return;

  if (barChart) barChart.destroy();

  barChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: MONTHS,
      datasets: [
        {
          label: 'Entradas',
          data: monthlyData.map(m => m.entrada),
          backgroundColor: '#048f3c',
          borderColor:     '#25c265',
          borderWidth: 1,
          borderRadius: 6,
          borderSkipped: false,
        },
        {
          label: 'Saídas',
          data: monthlyData.map(m => m.saida),
          backgroundColor: '#df2e1b',
          borderColor:     'rgba(231,76,60,1)',
          borderWidth: 1,
          borderRadius: 6,
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#ffffffd5', font: { family: 'Inter', size: 12 } } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: { //Cor dos números do gráfico de barras
          ticks: { color: 'rgba(255, 255, 255, 0.75)', font: { family: 'Inter' } },
          grid:  { color: 'rgba(255, 255, 255, 0.1)' },
        },
        y: {
          ticks: {
            color: 'rgba(255, 255, 255, 0.75)', //Cor dos números do gráfico de barras
            font: { family: 'Inter' },
            callback: v => formatCurrency(v),
          },
          grid: { color: 'rgba(255, 255, 255, 0.1)' },
        },
      },
    },
  });
}

// ── Gráfico de pizza: Distribuição por categoria ───────────

function renderPieChart(entries) {
  const catMap = {};
  for (const e of entries) {
    if (e.type !== 'saida') continue; // pizza apenas saídas
    const name  = e.category?.name || 'Sem categoria';
    const color = e.category?.color || '#8b6e52';
    if (!catMap[name]) catMap[name] = { value: 0, color };
    catMap[name].value += parseFloat(e.value);
  }

  const labels = Object.keys(catMap);
  const values = labels.map(l => catMap[l].value);
  const colors = labels.map(l => catMap[l].color);

  const ctx = document.getElementById('pieChart')?.getContext('2d');
  if (!ctx) return;
  if (pieChart) pieChart.destroy();

  if (!labels.length) {
    document.getElementById('pieNoData').style.display = 'flex';
    return;
  }
  document.getElementById('pieNoData').style.display = 'none';

  pieChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors.map(c => c + 'cc'),
        borderColor:     colors,
        borderWidth: 2,
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#ffffffcb', font: { family: 'Inter', size: 11 }, padding: 16 },
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${formatCurrency(ctx.parsed)}`,
          },
        },
      },
    },
  });
}

// ── Tabela de histórico mensal ─────────────────────────────

function renderHistoryTable(entries) {
  const tbody = document.getElementById('historyBody');
  if (!tbody) return;

  const monthlyData = Array.from({ length: 12 }, () => ({ entrada: 0, saida: 0 }));
  for (const e of entries) {
    const month = parseInt(e.date.split('-')[1]) - 1;
    if (e.type === 'entrada') monthlyData[month].entrada += parseFloat(e.value);
    else monthlyData[month].saida += parseFloat(e.value);
  }

  tbody.innerHTML = monthlyData.map((m, i) => {
    const saldo = m.entrada - m.saida;
    const hasData = m.entrada > 0 || m.saida > 0;
    return `
      <tr class="${hasData ? '' : 'row-empty'}">
        <td>${MONTHS_FULL[i]}</td>
        <td class="entrada">${m.entrada > 0 ? formatCurrency(m.entrada) : '—'}</td>
        <td class="saida">${m.saida > 0 ? formatCurrency(m.saida) : '—'}</td>
        <td class="${saldo >= 0 ? 'entrada' : 'saida'} bold">
          ${hasData ? formatCurrency(saldo) : '—'}
        </td>
      </tr>
    `;
  }).join('');
}