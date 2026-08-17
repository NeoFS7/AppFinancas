-- ============================================================
-- SCHEMA DO BANCO DE DADOS — FinApp (Supabase / PostgreSQL)
-- ------------------------------------------------------------
-- Este script define a estrutura completa de dados do aplicativo:
-- 1. Tabela 'profiles' (dados públicos do usuário: nome, avatar)
-- 2. Trigger automático de criação de perfil ao cadastrar novo usuário
-- 3. Tabela 'categories' (categorias personalizadas com cor)
-- 4. Tabela 'entries' (lançamentos de receitas e despesas)
-- 5. Políticas de Segurança em Nível de Linha (RLS - Row Level Security)
-- 6. Índices de performance para consultas rápidas
-- 7. Políticas de segurança do Storage (Bucket de Avatars)
-- ============================================================

-- ============================================================
-- 1. TABELA DE PERFIS (profiles)
-- ============================================================
-- Armazena dados complementares do usuário vinculado ao auth.users.
create table if not exists profiles (
  id         uuid references auth.users on delete cascade primary key, -- Chave primária ligada ao ID de autenticação
  name       text not null default '',                                 -- Nome completo do usuário
  avatar_url text,                                                     -- URL pública da foto de perfil
  created_at timestamptz default now()                                 -- Data de criação do registro
);

-- ============================================================
-- 2. TRIGGER: CRIAÇÃO AUTOMÁTICA DE PERFIL
-- ============================================================
-- Função acionada automaticamente sempre que uma nova conta é criada no auth.users,
-- extraindo o nome enviado nos metadados de cadastro e inserindo na tabela profiles.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', '')
  );
  return new;
end;
$$;

-- Vincula a trigger à tabela interna auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- 3. TABELA DE CATEGORIAS (categories)
-- ============================================================
-- Permite que cada usuário crie suas próprias categorias de gastos/ganhos.
create table if not exists categories (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users on delete cascade not null, -- Dono da categoria
  name       text not null,                                         -- Nome da categoria (ex: Alimentação, Salário)
  color      text not null default '#8b6e52',                       -- Cor em hexadecimal para tags e gráficos
  created_at timestamptz default now()
);

-- ============================================================
-- 4. TABELA DE ENTRADAS FINANCEIRAS (entries)
-- ============================================================
-- Registra cada lançamento financeiro individual (receita ou despesa).
create table if not exists entries (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users on delete cascade not null,     -- Dono do lançamento
  date        date not null default current_date,                        -- Data do lançamento
  description text default '',                                           -- Descrição detalhada
  category_id uuid references categories(id) on delete set null,         -- Vínculo opcional com categoria
  value       numeric(12,2) not null default 0,                          -- Valor monetário (positivo)
  type        text check (type in ('entrada','saida')) not null,         -- Tipo: 'entrada' (ganho) ou 'saida' (gasto)
  created_at  timestamptz default now()
);

-- ============================================================
-- 5. ROW LEVEL SECURITY (RLS) — Isolamento de Dados por Usuário
-- ============================================================
-- Garante que um usuário NUNCA consiga visualizar, editar ou excluir dados de outros usuários.

alter table profiles   enable row level security;
alter table categories enable row level security;
alter table entries    enable row level security;

-- Políticas para a tabela PROFILES (apenas o próprio usuário pode ler, criar e alterar seu perfil)
drop policy if exists "user own profile select" on profiles;
drop policy if exists "user own profile insert" on profiles;
drop policy if exists "user own profile update" on profiles;

create policy "user own profile select" on profiles
  for select using (auth.uid() = id);
create policy "user own profile insert" on profiles
  for insert with check (auth.uid() = id);
create policy "user own profile update" on profiles
  for update using (auth.uid() = id);

-- Políticas para a tabela CATEGORIES (operações permitidas apenas onde user_id coincide com o usuário logado)
drop policy if exists "user own categories" on categories;
create policy "user own categories" on categories
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Políticas para a tabela ENTRIES (operações permitidas apenas onde user_id coincide com o usuário logado)
drop policy if exists "user own entries" on entries;
create policy "user own entries" on entries
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- 6. ÍNDICES DE PERFORMANCE
-- ============================================================
-- Aceleram filtros comuns por usuário e ordenações por data.
create index if not exists idx_entries_user_id   on entries(user_id);
create index if not exists idx_entries_date       on entries(date desc);
create index if not exists idx_categories_user_id on categories(user_id);

-- ============================================================
-- 7. STORAGE RLS (Bucket 'avatars' para Fotos de Perfil)
-- ============================================================
-- Controla permissões de upload, visualização, edição e exclusão de arquivos.

alter table storage.objects enable row level security;

-- Visualização pública de imagens do bucket avatars
create policy "Avatar images are publicly accessible" 
  on storage.objects for select 
  using ( bucket_id = 'avatars' );

-- Upload permitido apenas na subpasta correspondente ao ID do próprio usuário (ex: <user_id>/avatar.png)
create policy "Users can upload their own avatar" 
  on storage.objects for insert 
  with check ( bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1] );

-- Atualização permitida apenas no próprio avatar
create policy "Users can update their own avatar" 
  on storage.objects for update 
  using ( bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1] );

-- Exclusão permitida apenas do próprio avatar
create policy "Users can delete their own avatar" 
  on storage.objects for delete 
  using ( bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1] );
