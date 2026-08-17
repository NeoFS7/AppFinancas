// ============================================================
// DATA.JS — Camada de Acesso a Dados (CRUD com Supabase)
// ------------------------------------------------------------
// Centraliza todas as requisições ao banco de dados:
// 1. Categorias (listar, criar, atualizar, excluir)
// 2. Entradas Financeiras (listar com paginação/filtro, criar, editar, excluir)
// 3. Totais e Saldos
// 4. Perfil do Usuário e Foto (Storage)
// 5. Dados agregados para Relatórios
// ============================================================

import { supabase } from './supabase.js';

// ============================================================
// 1. CATEGORIAS
// ============================================================

/**
 * Busca todas as categorias do usuário logado ordenadas alfabeticamente.
 * O RLS do banco garante que só virão as categorias do próprio usuário.
 */
export async function getCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name');
  if (error) throw error;
  return data;
}

/**
 * Cria uma nova categoria associando-a ao ID do usuário autenticado.
 */
export async function createCategory({ name, color = '#8b6e52' }) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('categories')
    .insert([{ user_id: user.id, name: name.trim(), color }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Atualiza o nome e/ou a cor de uma categoria existente pelo ID.
 */
export async function updateCategory(id, { name, color }) {
  const { data, error } = await supabase
    .from('categories')
    .update({ name: name.trim(), color })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Exclui uma categoria pelo ID.
 * As entradas vinculadas a ela terão category_id setado para NULL (on delete set null).
 */
export async function deleteCategory(id) {
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ============================================================
// 2. ENTRADAS FINANCEIRAS
// ============================================================

/**
 * Busca entradas com suporte a:
 * - Filtro por texto na descrição (busca case-insensitive)
 * - Filtro por ID de categoria
 * - Filtro por tipo ('entrada' ou 'saida')
 * - Paginação (range baseado em page e perPage)
 * Retorna os dados da página atual e a contagem total para a paginação.
 */
export async function getEntries({ search = '', categoryId = '', type = '', page = 1, perPage = 10 } = {}) {
  let query = supabase
    .from('entries')
    .select('*, category:categories(id,name,color)', { count: 'exact' })
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  // Aplica filtro de texto se houver
  if (search) {
    query = query.ilike('description', `%${search}%`);
  }
  // Aplica filtro de categoria se selecionada
  if (categoryId) {
    query = query.eq('category_id', categoryId);
  }
  // Aplica filtro de tipo (entrada ou saida)
  if (type && type !== 'all') {
    query = query.eq('type', type);
  }

  // Calcula os limites para paginação do Supabase
  const from = (page - 1) * perPage;
  const to   = from + perPage - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data, count };
}

/**
 * Retorna todas as entradas sem limites de página (útil para buscas globais).
 */
export async function getAllEntries({ categoryId = '', type = '' } = {}) {
  let query = supabase
    .from('entries')
    .select('*, category:categories(id,name,color)')
    .order('date', { ascending: false });

  if (categoryId) query = query.eq('category_id', categoryId);
  if (type && type !== 'all') query = query.eq('type', type);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/**
 * Insere um novo lançamento financeiro vinculado ao usuário logado.
 */
export async function createEntry({ date, description, categoryId, value, type }) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('entries')
    .insert([{
      user_id: user.id,
      date,
      description: description.trim(),
      category_id: categoryId || null,
      value: parseFloat(value),
      type,
    }])
    .select('*, category:categories(id,name,color)')
    .single();
  if (error) throw error;
  return data;
}

/**
 * Atualiza um lançamento existente pelo ID.
 */
export async function updateEntry(id, { date, description, categoryId, value, type }) {
  const { data, error } = await supabase
    .from('entries')
    .update({
      date,
      description: description.trim(),
      category_id: categoryId || null,
      value: parseFloat(value),
      type,
    })
    .eq('id', id)
    .select('*, category:categories(id,name,color)')
    .single();
  if (error) throw error;
  return data;
}

/**
 * Remove um lançamento pelo ID.
 */
export async function deleteEntry(id) {
  const { error } = await supabase
    .from('entries')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ============================================================
// 3. TOTAIS (Saldo, Entradas e Saídas)
// ============================================================

/**
 * Calcula a soma total de entradas e saídas de todos os tempos
 * para exibição nos cards do topo do painel.
 */
export async function getSummary() {
  const { data, error } = await supabase
    .from('entries')
    .select('value, type');
  if (error) throw error;

  let totalEntradas = 0, totalSaidas = 0;
  for (const e of data) {
    if (e.type === 'entrada') totalEntradas += parseFloat(e.value);
    else totalSaidas += parseFloat(e.value);
  }
  return {
    totalEntradas,
    totalSaidas,
    saldo: totalEntradas - totalSaidas,
  };
}

// ============================================================
// 4. PERFIL DO USUÁRIO & FOTO DE AVATAR
// ============================================================

/**
 * Obtém os dados do perfil público (nome e avatar) mesclados com o e-mail da sessão auth.
 */
export async function getProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  if (error) throw error;
  return { ...data, email: user.email };
}

/**
 * Atualiza o nome do perfil na tabela pública profiles.
 */
export async function updateProfile({ name }) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('profiles')
    .update({ name: name.trim() })
    .eq('id', user.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Faz upload da foto para o bucket 'avatars' no Storage do Supabase,
 * gera a URL pública e salva o link na tabela de perfil.
 */
export async function uploadAvatar(file) {
  const { data: { user } } = await supabase.auth.getUser();
  const ext  = file.name.split('.').pop();
  const path = `${user.id}/avatar.${ext}`;

  // Remove avatar anterior caso já exista
  await supabase.storage.from('avatars').remove([path]);

  // Faz upload do novo arquivo com substituição autorizada
  const { error: uploadErr } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadErr) throw uploadErr;

  // Obtém a URL pública do arquivo
  const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);

  // Atualiza a URL na tabela de perfis com timestamp de cache-busting
  const { error: updateErr } = await supabase
    .from('profiles')
    .update({ avatar_url: publicUrl + '?t=' + Date.now() })
    .eq('id', user.id);
  if (updateErr) throw updateErr;

  return publicUrl;
}

// ============================================================
// 5. RELATÓRIOS MENSAIS
// ============================================================

/**
 * Busca todas as entradas dentro do período de 1 ano especificado
 * para alimentar os gráficos de barras e de pizza.
 */
export async function getEntriesByMonth(year) {
  const { data, error } = await supabase
    .from('entries')
    .select('date, value, type, category_id, category:categories(id,name,color)')
    .gte('date', `${year}-01-01`)
    .lte('date', `${year}-12-31`)
    .order('date');
  if (error) throw error;
  return data;
}
