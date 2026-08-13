-- ============================================================
-- SCHEMA DO BANCO DE DADOS — FinApp
-- ============================================================

-- 1. Tabela de perfis de usuário
create table if not exists profiles (
  id         uuid references auth.users on delete cascade primary key,
  name       text not null default '',
  avatar_url text,
  created_at timestamptz default now()
);

-- 2. Trigger: cria perfil automaticamente ao cadastrar usuário
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- 3. Tabela de categorias
create table if not exists categories (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users on delete cascade not null,
  name       text not null,
  color      text not null default '#8b6e52',
  created_at timestamptz default now()
);

-- 4. Tabela de entradas financeiras
create table if not exists entries (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users on delete cascade not null,
  date        date not null default current_date,
  description text default '',
  category_id uuid references categories(id) on delete set null,
  value       numeric(12,2) not null default 0,
  type        text check (type in ('entrada','saida')) not null,
  created_at  timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Cada usuário acessa apenas os seus próprios dados
-- ============================================================

alter table profiles   enable row level security;
alter table categories enable row level security;
alter table entries    enable row level security;

-- Policies para profiles
drop policy if exists "user own profile select" on profiles;
drop policy if exists "user own profile insert" on profiles;
drop policy if exists "user own profile update" on profiles;

create policy "user own profile select" on profiles
  for select using (auth.uid() = id);
create policy "user own profile insert" on profiles
  for insert with check (auth.uid() = id);
create policy "user own profile update" on profiles
  for update using (auth.uid() = id);

-- Policies para categories
drop policy if exists "user own categories" on categories;
create policy "user own categories" on categories
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Policies para entries
drop policy if exists "user own entries" on entries;
create policy "user own entries" on entries
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- Índices de performance
-- ============================================================
create index if not exists idx_entries_user_id   on entries(user_id);
create index if not exists idx_entries_date       on entries(date desc);
create index if not exists idx_categories_user_id on categories(user_id);

-- ============================================================
-- STORAGE RLS (Fotos de Perfil)
-- Permite que usuários enviem e editem suas próprias fotos
-- ============================================================

-- Garante que as políticas de Storage estejam habilitadas
alter table storage.objects enable row level security;

-- Política para visualizar imagens (o bucket é público, mas garante leitura via DB)
create policy "Avatar images are publicly accessible" 
  on storage.objects for select 
  using ( bucket_id = 'avatars' );

-- Política para fazer upload da própria imagem
create policy "Users can upload their own avatar" 
  on storage.objects for insert 
  with check ( bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1] );

-- Política para atualizar a própria imagem
create policy "Users can update their own avatar" 
  on storage.objects for update 
  using ( bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1] );

-- Política para excluir a própria imagem
create policy "Users can delete their own avatar" 
  on storage.objects for delete 
  using ( bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1] );
