-- Per-user MCP API keys (hash only) + generation locks + CV metadata
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.mcp_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key_hash text not null,
  key_prefix text not null,
  label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  constraint mcp_api_keys_key_hash_unique unique (key_hash)
);

create index if not exists mcp_api_keys_user_active_idx
  on public.mcp_api_keys (user_id)
  where revoked_at is null;

alter table public.mcp_api_keys enable row level security;

drop policy if exists "mcp_keys_select_own" on public.mcp_api_keys;
create policy "mcp_keys_select_own" on public.mcp_api_keys
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "mcp_keys_insert_own" on public.mcp_api_keys;
create policy "mcp_keys_insert_own" on public.mcp_api_keys
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "mcp_keys_update_own" on public.mcp_api_keys;
create policy "mcp_keys_update_own" on public.mcp_api_keys
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.mcp_generation_locks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  locked_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.mcp_generation_locks enable row level security;

create table if not exists public.cv_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  pdf_file_name text not null,
  empresa_slug text,
  language text not null check (language in ('es', 'en')),
  sobre_mi_preview text,
  created_at timestamptz not null default now()
);

create index if not exists cv_generations_user_created_idx
  on public.cv_generations (user_id, created_at desc);

alter table public.cv_generations enable row level security;

drop policy if exists "cv_generations_select_own" on public.cv_generations;
create policy "cv_generations_select_own" on public.cv_generations
  for select to authenticated
  using (auth.uid() = user_id);

create or replace function public.create_mcp_api_key(p_label text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_raw_key text;
  v_hash text;
  v_prefix text;
  v_id uuid;
  v_label text;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  v_label := nullif(trim(coalesce(p_label, '')), '');
  v_raw_key := 'cvai_'
    || replace(replace(replace(encode(extensions.gen_random_bytes(24), 'base64'), '/', '_'), '+', '-'), '=', '');
  v_hash := encode(extensions.digest(v_raw_key, 'sha256'), 'hex');
  v_prefix := left(v_raw_key, 12);
  insert into public.mcp_api_keys (user_id, key_hash, key_prefix, label)
  values (v_user_id, v_hash, v_prefix, v_label)
  returning id into v_id;
  return jsonb_build_object(
    'id', v_id,
    'apiKey', v_raw_key,
    'prefix', v_prefix,
    'label', v_label,
    'createdAt', now()
  );
end;
$$;

revoke all on function public.create_mcp_api_key(text) from public;
grant execute on function public.create_mcp_api_key(text) to authenticated;

create or replace function public.revoke_mcp_api_key(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  update mcp_api_keys
  set revoked_at = now()
  where id = p_id and user_id = v_user_id and revoked_at is null;
  if not found then
    raise exception 'key not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.revoke_mcp_api_key(uuid) from public;
grant execute on function public.revoke_mcp_api_key(uuid) to authenticated;