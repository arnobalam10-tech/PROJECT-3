-- Two real bugs in submit_memo, both caught by actually running the
-- workflow-engine test script (not by review) — see STATUS.md for the
-- full test writeup.
--
-- Bug 1: the CASE expression choosing 'current' vs 'queued' resolved to
-- `text`, and Postgres didn't implicitly cast it for an INSERT ... VALUES
-- position inside a function body (unlike a bare string literal against a
-- known column type, which does cast fine).
-- Bug 2: the fix for #1 used an explicit ::workflow_step_status cast, but
-- with search_path = '' (deliberate, to prevent search-path hijacking in a
-- SECURITY DEFINER function), an unqualified type name in a cast can't
-- resolve either — same rule as unqualified table names. Needed
-- ::public.workflow_step_status.
create or replace function submit_memo(p_memo_id uuid, p_participant_ids uuid[]) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_memo public.memos;
  v_org_id uuid;
  v_uid uuid;
  v_order double precision := 1000;
  v_first_holder uuid;
  v_invalid_count int;
begin
  select * into v_memo from public.memos where id = p_memo_id for update;
  if v_memo.id is null then
    raise exception 'Memo not found.';
  end if;
  if v_memo.author_id != auth.uid() then
    raise exception 'Only the author may submit this memo.';
  end if;
  if v_memo.status != 'draft' then
    raise exception 'Only a draft may be submitted.';
  end if;
  if p_participant_ids is null or array_length(p_participant_ids, 1) is null then
    raise exception 'At least one participant is required.';
  end if;

  v_org_id := v_memo.organization_id;

  select count(*) into v_invalid_count
  from unnest(p_participant_ids) pid
  where not exists (
    select 1 from public.profiles pr
    where pr.id = pid and pr.organization_id = v_org_id and pr.status = 'active'
  );
  if v_invalid_count > 0 then
    raise exception 'One or more selected participants are invalid.';
  end if;

  foreach v_uid in array p_participant_ids loop
    insert into public.workflow_steps
      (memo_id, sequence_order, assigned_user_id, status, is_original)
    values
      (
        p_memo_id, v_order, v_uid,
        (case when v_order = 1000 then 'current' else 'queued' end)::public.workflow_step_status,
        true
      );
    v_order := v_order + 1000;
  end loop;

  v_first_holder := p_participant_ids[1];

  update public.memos
  set status = 'submitted', submitted_at = now()
  where id = p_memo_id;

  insert into public.memo_versions (memo_id, version_number, editor_id, content_snapshot, associated_submission_at)
  values (p_memo_id, 1, auth.uid(), jsonb_build_object('subject', v_memo.subject, 'body', v_memo.body), now());

  perform private.log_audit_event(
    v_org_id, 'memo_submission', auth.uid(), 'memo', p_memo_id,
    format('Memo "%s" submitted with %s participant(s).', v_memo.subject, array_length(p_participant_ids, 1))
  );
  perform private.notify_user(
    v_org_id, v_first_holder, 'memo_requires_action', p_memo_id,
    format('"%s" requires your action.', v_memo.subject)
  );
end;
$$;
