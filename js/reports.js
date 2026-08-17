// ============================================================
// REPORTS.JS — Relatórios Financeiros e Gráficos (Chart.js)
// ------------------------------------------------------------
// Responsável por renderizar os dados anuais:
// 1. Inicialização e seletor de ano
// 2. Gráfico de Barras: Comparativo mensal Entradas x Saídas
// 3. Gráfico de Rosca (Donut): Distribuição de saídas por categoria
// 4. Tabela de Histórico Mensal consolidada
// ============================================================

import { getEntriesByMonth } from './data.js';
import { formatCurrency } from './dashboard.js';

// Nomes dos meses para labels curtos e completos
const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MONTHS_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// Instâncias ativas dos gráficos do Chart.js para permitir destruição e re-renderização
let barChart = null;
let pieChart = null;

// ============================================================
// 1. INICIALIZAÇÃO DA ABA DE RELATÓRIOS
// ============================================================

/**
 * Chamada quando o usuário clica na aba "Relatórios".
 * Popula o dropdown de anos e dispara o carregamento inicial.
 */
export async function initReports() {
  const currentYear = new Date().getFullYear();
  const sel = document.getElementById('reportYear');
  if (!sel) return;

  // Monta as opções de ano (ano seguinte até 5 anos atrás)
  sel.innerHTML = '';
  for (let y = currentYear + 1; y >= currentYear - 5; y--) {
    sel.innerHTML += `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`;
  }

  // Ouve a mudança de ano para recarregar os dados
  sel.addEventListener('change', e => {
    loadReport(parseInt(e.target.value));
  });

  await loadReport(currentYear);
}

/**
 * Busca os dados do ano no Supabase e atualiza gráficos e tabela.
 */
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

// ============================================================
// 2. GRÁFICO DE BARRAS (Entradas vs Saídas por Mês)
// ============================================================

function renderBarChart(entries, year) {
  // Inicializa array com 12 posições zeradas para entradas e saídas
  const monthlyData = Array.from({ length: 12 }, () => ({ entrada: 0, saida: 0 }));

  // Agrega valores em cada mês
  for (const e of entries) {
    const month = parseInt(e.date.split('-')[1]) - 1;
    if (e.type === 'entrada') monthlyData[month].entrada += parseFloat(e.value);
    else monthlyData[month].saida += parseFloat(e.value);
  }

  const ctx = document.getElementById('barChart')?.getContext('2d');
  if (!ctx) return;

  // Destrói o gráfico anterior para evitar sobreposição
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
        x: {
          ticks: { color: 'rgba(255, 255, 255, 0.75)', font: { family: 'Inter' } },
          grid:  { color: 'rgba(255, 255, 255, 0.1)' },
        },
        y: {
          ticks: {
            color: 'rgba(255, 255, 255, 0.75)',
            font: { family: 'Inter' },
            callback: v => formatCurrency(v),
          },
          grid: { color: 'rgba(255, 255, 255, 0.1)' },
        },
      },
    },
  });
}

// ============================================================
// 3. GRÁFICO DE ROSCA / PIZZA (Saídas por Categoria)
// ============================================================

function renderPieChart(entries) {
  // Agrupa apenas lançamentos do tipo 'saida' por categoria
  const catMap = {};
  for (const e of entries) {
    if (e.type !== 'saida') continue;
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

  // Se não houver saídas no ano, exibe mensagem informativa amigável
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

// ============================================================
// 4. TABELA DE HISTÓRICO MENSAL
// ============================================================

function renderHistoryTable(entries) {
  const tbody = document.getElementById('historyBody');
  if (!tbody) return;

  // Totaliza mês a mês
  const monthlyData = Array.from({ length: 12 }, () => ({ entrada: 0, saida: 0 }));
  for (const e of entries) {
    const month = parseInt(e.date.split('-')[1]) - 1;
    if (e.type === 'entrada') monthlyData[month].entrada += parseFloat(e.value);
    else monthlyData[month].saida += parseFloat(e.value);
  }

  // Gera as linhas da tabela com os saldos calculados
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