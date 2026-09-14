-- Amount received on Confirm (admin types the real Chime amount onto the receipt)
-- SQL Editor → Run. Empty success is normal.

alter table public.payment_proofs
  add column if not exists confirmed_amount numeric(10,2);

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
    'confirmed_amount', v_proof.confirmed_amount,
    'receipt_amount', coalesce(v_proof.confirmed_amount, v_row.application_fee),
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
        a.access_token,
        a.applicant_name,
        a.applicant_email,
        a.applicant_phone,
        a.property_address,
        a.application_fee,
        a.payment_email,
        p.receipt_number,
        p.status,
        p.screenshot_url,
        p.confirmed_amount,
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

drop function if exists public.owner_confirm_proof(text, text);

create or replace function public.owner_confirm_proof(
  p_password text,
  p_receipt_number text,
  p_amount numeric
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proof public.payment_proofs%rowtype;
  v_amount numeric(10,2);
begin
  perform public._owner_assert_password(p_password);

  if p_amount is null or p_amount <= 0 or p_amount > 100000 then
    raise exception 'enter the amount received';
  end if;

  v_amount := round(p_amount, 2);

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
      'confirmed_amount', v_proof.confirmed_amount,
      'replay', true
    );
  end if;

  if v_proof.status <> 'pending' then
    raise exception 'only pending proofs can be confirmed';
  end if;

  update public.payment_proofs
  set status = 'paid',
      confirmed_amount = v_amount,
      confirmed_at = now()
  where id = v_proof.id
  returning * into v_proof;

  return json_build_object(
    'receipt_number', v_proof.receipt_number,
    'status', v_proof.status,
    'confirmed_amount', v_proof.confirmed_amount,
    'replay', false
  );
end;
$$;

grant execute on function public.owner_list_proofs(text) to anon;
grant execute on function public.owner_confirm_proof(text, text, numeric) to anon;
grant execute on function public.get_application_by_token(uuid) to anon;

notify pgrst, 'reload schema';
