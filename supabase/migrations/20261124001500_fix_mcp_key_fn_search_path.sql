-- Supabase installs pgcrypto in schema "extensions"; qualify crypto functions for fresh envs.
-- Matches production hotfix fix_mcp_key_fn_search_path.

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

create or replace function public.resolve_mcp_api_key(p_raw_key text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_user_id uuid;
  v_key_id uuid;
begin
  if p_raw_key is null or length(trim(p_raw_key)) < 16 then
    return null;
  end if;
  v_hash := encode(extensions.digest(trim(p_raw_key), 'sha256'), 'hex');
  select id, user_id into v_key_id, v_user_id
  from public.mcp_api_keys
  where key_hash = v_hash and revoked_at is null;
  if v_user_id is null then
    return null;
  end if;
  update public.mcp_api_keys set last_used_at = now() where id = v_key_id;
  return v_user_id;
end;
$$;

revoke all on function public.resolve_mcp_api_key(text) from public;
grant execute on function public.resolve_mcp_api_key(text) to service_role;