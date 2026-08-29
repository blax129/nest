-- Slice 2 — run this AFTER slice 1 (applications table already exists)
-- Supabase → SQL Editor → paste → Run
-- Empty results panel is normal.

create table if not exists public.payment_proofs (
  id uuid primary key default gen_random_uuid(),
  application_id text not null references public.applications (application_id) on delete cascade,
  cloudinary_public_id text not null default '',
  screenshot_url text not null,
  receipt_number text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'rejected')),
  submitted_at timestamptz not null default now(),
  confirmed_at timestamptz,
  rejected_at timestamptz
);

create unique index if not exists payment_proofs_open_application_idx
  on public.payment_proofs (application_id)
  where status in ('pending', 'paid');

alter table public.payment_proofs enable row level security;
revoke all on table public.payment_proofs from public, anon, authenticated;

create or replace function public.submit_payment_proof(
  p_token uuid,
  p_screenshot_url text,
  p_cloudinary_public_id text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.applications%rowtype;
  v_existing public.payment_proofs%rowtype;
  v_receipt text;
  v_attempt int := 0;
begin
  if p_token is null then
    raise exception 'application token required';
  end if;
  if p_screenshot_url is null or length(trim(p_screenshot_url)) = 0 then
    raise exception 'screenshot url required';
  end if;

  select * into v_app
  from public.applications
  where access_token = p_token;

  if not found then
    raise exception 'application not found';
  end if;

  select * into v_existing
  from public.payment_proofs
  where application_id = v_app.application_id
    and status = 'paid'
  order by submitted_at desc
  limit 1;

  if found then
    return json_build_object(
      'application_id', v_app.application_id,
      'receipt_number', v_existing.receipt_number,
      'status', v_existing.status,
      'screenshot_url', v_existing.screenshot_url,
      'replay', true
    );
  end if;

  select * into v_existing
  from public.payment_proofs
  where application_id = v_app.application_id
    and status = 'pending'
  order by submitted_at desc
  limit 1;

  if found then
    return json_build_object(
      'application_id', v_app.application_id,
      'receipt_number', v_existing.receipt_number,
      'status', v_existing.status,
      'screenshot_url', v_existing.screenshot_url,
      'replay', true
    );
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_receipt := 'PPH-' || to_char(timezone('utc', now()), 'YYYYMMDD') || '-' ||
      upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    begin
      insert into public.payment_proofs (
        application_id,
        cloudinary_public_id,
        screenshot_url,
        receipt_number,
        status
      ) values (
        v_app.application_id,
        coalesce(trim(p_cloudinary_public_id), ''),
        trim(p_screenshot_url),
        v_receipt,
        'pending'
      )
      returning * into v_existing;
      exit;
    exception
      when unique_violation then
        if v_attempt >= 8 then
          raise;
        end if;
    end;
  end loop;

  return json_build_object(
    'application_id', v_app.application_id,
    'receipt_number', v_existing.receipt_number,
    'status', v_existing.status,
    'screenshot_url', v_existing.screenshot_url,
    'replay', false
  );
end;
$$;

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
    'receipt_number', v_proof.receipt_number
  );
end;
$$;

revoke all on function public.submit_payment_proof(uuid, text, text) from public;
grant execute on function public.submit_payment_proof(uuid, text, text) to anon;

notify pgrst, 'reload schema';
