-- Adds access_token to the owner queue so Confirm emails can include the paid receipt link.
-- SQL Editor → Run (Success. No rows returned is normal).

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

grant execute on function public.owner_list_proofs(text) to anon;

notify pgrst, 'reload schema';
