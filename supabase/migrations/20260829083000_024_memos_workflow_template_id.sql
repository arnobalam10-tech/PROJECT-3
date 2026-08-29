-- `memos.workflow_template_id` had been documented in DATABASE.md's schema
-- section since Phase 1 ("workflow_template_id (nullable, if built from a
-- template)") but, like memo_versions in migration 017, was never actually
-- created by any prior migration — migration 008 (memos_core) built every
-- other memos column but missed this one. Caught now, while wiring
-- workflow_templates (migration 021) into submit_memo, by checking
-- information_schema directly rather than trusting the doc.
alter table memos add column workflow_template_id uuid references workflow_templates(id) on delete set null;

-- Diffed directly against the LIVE function body (via pg_get_functiondef),
-- not reconstructed from memory — after migration 023 accidentally
-- regressed a different function this same session by working from a
-- stale mental model instead of the actual deployed SQL (see migration
-- 025), every subsequent create-or-replace in this session re-reads the
-- live definition first. Only two things change here vs. the live
-- migration-019 body: the new p_workflow_template_id parameter (+
-- validation), and setting it in the memos UPDATE.
create or replace function submit_memo(
  p_memo_id uuid,
  p_participant_ids uuid[],
  p_workflow_template_id uuid default null
) returns void
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

  if p_workflow_template_id is not null and not exists (
    select 1 from public.workflow_templates
    where id = p_workflow_template_id and organization_id = v_org_id
  ) then
    raise exception 'Invalid template.';
  end if;

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
    -- Every participant in the initial chain is "assigned to a workflow"
    -- right now, regardless of turn order.
    perform private.notify_user(
      v_org_id, v_uid, 'workflow_assignment', p_memo_id,
      format('You were added to the workflow for "%s".', v_memo.subject)
    );
    v_order := v_order + 1000;
  end loop;

  v_first_holder := p_participant_ids[1];

  update public.memos
  set status = 'submitted', submitted_at = now(), workflow_template_id = p_workflow_template_id
  where id = p_memo_id;

  insert into public.memo_versions (memo_id, version_number, editor_id, content_snapshot, associated_submission_at)
  values (p_memo_id, 1, auth.uid(), jsonb_build_object('subject', v_memo.subject, 'body', v_memo.body), now());

  perform private.log_audit_event(
    v_org_id, 'memo_submission', auth.uid(), 'memo', p_memo_id,
    format('Memo "%s" submitted with %s participant(s).', v_memo.subject, array_length(p_participant_ids, 1))
  );
  -- The first holder ALSO needs to know it's their turn right now, on top
  -- of the workflow_assignment notification everyone already got above.
  perform private.notify_user(
    v_org_id, v_first_holder, 'memo_requires_action', p_memo_id,
    format('"%s" requires your action.', v_memo.subject)
  );
end;
$$;
