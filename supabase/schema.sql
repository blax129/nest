-- Private Property Holdings — Slice 1
-- Paste this entire file into Supabase → SQL Editor → Run
-- Anon cannot read the table; only the two functions below are callable.

create extension if not exists pgcrypto;

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  application_id text not null unique,
  access_token uuid not null unique default gen_random_uuid(),
  applicant_name text not null default '',
  applicant_email text not null default '',
  applicant_phone text not null default '',
  property_address text not null default '',
  application_fee numeric(10,2) not null default 70.00,
  payment_email text not null default '',
  created_at timestamptz not null default now()
);

alter table public.applications enable row level security;

revoke all on table public.applications from public, anon, authenticated;

create or replace function public.submit_application(
  p_application_id text,
  p_applicant_name text,
  p_applicant_email text,
  p_applicant_phone text,
  p_property_address text,
  p_payment_email text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token uuid;
  v_fee numeric(10,2);
begin
  if p_application_id is null or length(trim(p_application_id)) = 0 then
    raise exception 'application id required';
  end if;

  insert into public.applications (
    application_id,
    applicant_name,
    applicant_email,
    applicant_phone,
    property_address,
    application_fee,
    payment_email
  ) values (
    trim(p_application_id),
    coalesce(trim(p_applicant_name), ''),
    coalesce(trim(p_applicant_email), ''),
    coalesce(trim(p_applicant_phone), ''),
    coalesce(trim(p_property_address), ''),
    70.00,
    coalesce(trim(p_payment_email), '')
  )
  returning access_token, application_fee into v_token, v_fee;

  return json_build_object(
    'application_id', trim(p_application_id),
    'access_token', v_token,
    'application_fee', v_fee
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

  return json_build_object(
    'application_id', v_row.application_id,
    'applicant_name', v_row.applicant_name,
    'applicant_email', v_row.applicant_email,
    'applicant_phone', v_row.applicant_phone,
    'property_address', v_row.property_address,
    'application_fee', v_row.application_fee,
    'payment_email', v_row.payment_email
  );
end;
$$;

revoke all on function public.submit_application(text, text, text, text, text, text) from public;
revoke all on function public.get_application_by_token(uuid) from public;
grant execute on function public.submit_application(text, text, text, text, text, text) to anon;
grant execute on function public.get_application_by_token(uuid) to anon;

notify pgrst, 'reload schema';
