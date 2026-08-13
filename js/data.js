// ============================================================
// DATA.JS — CRUD via Supabase (entradas, categorias, perfil)
// ============================================================

import { supabase } from './supabase.js';

// ── Categorias ─────────────────────────────────────────────

export async function getCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name');
  if (error) throw error;
  return data;
}

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

export async function deleteCategory(id) {
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ── Entradas financeiras ───────────────────────────────────

export async function getEntries({ search = '', categoryId = '', type = '', page = 1, perPage = 10 } = {}) {
  let query = supabase
    .from('entries')
    .select('*, category:categories(id,name,color)', { count: 'exact' })
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  if (search) {
    query = query.ilike('description', `%${search}%`);
  }
  if (categoryId) {
    query = query.eq('category_id', categoryId);
  }
  if (type && type !== 'all') {
    query = query.eq('type', type);
  }

  const from = (page - 1) * perPage;
  const to   = from + perPage - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data, count };
}

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

export async function deleteEntry(id) {
  const { error } = await supabase
    .from('entries')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ── Totais (Saldo, Entradas, Saídas) ──────────────────────

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

// ── Perfil ─────────────────────────────────────────────────

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

export async function uploadAvatar(file) {
  const { data: { user } } = await supabase.auth.getUser();
  const ext  = file.name.split('.').pop();
  const path = `${user.id}/avatar.${ext}`;

  // Remove avatar antigo se existir
  await supabase.storage.from('avatars').remove([path]);

  const { error: uploadErr } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadErr) throw uploadErr;

  const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);

  // Salva a URL no perfil
  const { error: updateErr } = await supabase
    .from('profiles')
    .update({ avatar_url: publicUrl + '?t=' + Date.now() })
    .eq('id', user.id);
  if (updateErr) throw updateErr;

  return publicUrl;
}

// ── Dados para relatórios mensais ──────────────────────────

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
