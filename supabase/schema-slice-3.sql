-- Slice 3 — receipts + owner Confirm/Reject
-- SQL Editor → paste → Run (empty results is normal)
-- Then run ONE more query with your own password (do not reuse a simple password):
--   select public.set_owner_password('choose-a-long-password-here');

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.owner_settings (
  id integer primary key default 1 check (id = 1),
  password_hash text not null
);

alter table public.owner_settings enable row level security;
revoke all on table public.owner_settings from public, anon, authenticated;

create or replace function public.set_owner_password(p_password text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_password is null or length(p_password) < 8 then
    raise exception 'password must be at least 8 characters';
  end if;

  insert into public.owner_settings (id, password_hash)
  values (1, crypt(p_password, gen_salt('bf'::text)))
  on conflict (id) do update
    set password_hash = excluded.password_hash;
end;
$$;

revoke all on function public.set_owner_password(text) from public, anon, authenticated;

create or replace function public._owner_assert_password(p_password text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
begin
  select password_hash into v_hash
  from public.owner_settings
  where id = 1;

  if v_hash is null then
    raise exception 'owner password is not set';
  end if;

  if p_password is null or v_hash <> crypt(p_password, v_hash) then
    raise exception 'invalid password';
  end if;
end;
$$;

revoke all on function public._owner_assert_password(text) from public, anon, authenticated;

create or replace function public.get_application_by_token(p_token uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.applications%rowtype;
  v_proof public.payment_proofs%rowtype;
begin
  if p_token is null then
    return null;
  end if;

  select * into v_row
  from public.applications
  where access_token = p_token;

  if not found then
    return null;
  end if;

  select * into v_proof
  from public.payment_proofs
  where application_id = v_row.application_id
  order by submitted_at desc
  limit 1;

  return json_build_object(
    'application_id', v_row.application_id,
    'applicant_name', v_row.applicant_name,
    'applicant_email', v_row.applicant_email,
    'applicant_phone', v_row.applicant_phone,
    'property_address', v_row.property_address,
    'application_fee', v_row.application_fee,
    'payment_email', v_row.payment_email,
    'proof_status', v_proof.status,
    'receipt_number', v_proof.receipt_number,
    'screenshot_url', v_proof.screenshot_url,
    'submitted_at', v_proof.submitted_at,
    'confirmed_at', v_proof.confirmed_at,
    'rejected_at', v_proof.rejected_at
  );
end;
$$;

create or replace function public.get_public_receipt_status(p_receipt_number text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proof public.payment_proofs%rowtype;
begin
  if p_receipt_number is null or length(trim(p_receipt_number)) = 0 then
    return null;
  end if;

  select * into v_proof
  from public.payment_proofs
  where receipt_number = trim(p_receipt_number);

  if not found then
    return null;
  end if;

  return json_build_object(
    'receipt_number', v_proof.receipt_number,
    'status', v_proof.status
  );
end;
$$;

create or replace function public.owner_list_proofs(p_password text)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._owner_assert_password(p_password);

  return coalesce((
    select json_agg(row_to_json(x))
    from (
      select
        a.application_id,
        a.applicant_name,
        a.applicant_email,
        a.applicant_phone,
        a.property_address,
        a.application_fee,
        a.payment_email,
        p.receipt_number,
        p.status,
        p.screenshot_url,
        p.submitted_at,
        p.confirmed_at,
        p.rejected_at
      from public.payment_proofs p
      join public.applications a on a.application_id = p.application_id
      order by
        case p.status
          when 'pending' then 0
          when 'rejected' then 1
          else 2
        end,
        p.submitted_at desc
    ) x
  ), '[]'::json);
end;
$$;

create or replace function public.owner_confirm_proof(p_password text, p_receipt_number text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proof public.payment_proofs%rowtype;
begin
  perform public._owner_assert_password(p_password);

  select * into v_proof
  from public.payment_proofs
  where receipt_number = trim(p_receipt_number)
  for update;

  if not found then
    raise exception 'receipt not found';
  end if;

  if v_proof.status = 'paid' then
    return json_build_object(
      'receipt_number', v_proof.receipt_number,
      'status', v_proof.status,
      'replay', true
    );
  end if;

  if v_proof.status <> 'pending' then
    raise exception 'only pending proofs can be confirmed';
  end if;

  update public.payment_proofs
  set status = 'paid',
      confirmed_at = now()
  where id = v_proof.id
  returning * into v_proof;

  return json_build_object(
    'receipt_number', v_proof.receipt_number,
    'status', v_proof.status,
    'replay', false
  );
end;
$$;

create or replace function public.owner_reject_proof(p_password text, p_receipt_number text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proof public.payment_proofs%rowtype;
begin
  perform public._owner_assert_password(p_password);

  select * into v_proof
  from public.payment_proofs
  where receipt_number = trim(p_receipt_number)
  for update;

  if not found then
    raise exception 'receipt not found';
  end if;

  if v_proof.status = 'rejected' then
    return json_build_object(
      'receipt_number', v_proof.receipt_number,
      'status', v_proof.status,
      'replay', true
    );
  end if;

  if v_proof.status <> 'pending' then
    raise exception 'only pending proofs can be rejected';
  end if;

  update public.payment_proofs
  set status = 'rejected',
      rejected_at = now()
  where id = v_proof.id
  returning * into v_proof;

  return json_build_object(
    'receipt_number', v_proof.receipt_number,
    'status', v_proof.status,
    'replay', false
  );
end;
$$;

grant execute on function public.get_public_receipt_status(text) to anon;
grant execute on function public.owner_list_proofs(text) to anon;
grant execute on function public.owner_confirm_proof(text, text) to anon;
grant execute on function public.owner_reject_proof(text, text) to anon;

notify pgrst, 'reload schema';
