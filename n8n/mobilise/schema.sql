-- Desk 05 One-day Mobilisation: Postgres schema used by the n8n workflows.
-- Run once on the Vera database:  psql "$DATABASE_URL" -f n8n/mobilise/schema.sql
-- Every table that holds evidence is append-only in practice: a correction adds a row
-- (superseded_by / audit_log), it never overwrites what a person or the site sent.

create table if not exists mobilisations (
  id                 bigserial primary key,
  project            text not null,
  package            text not null default '',
  contractor_name    text not null,
  contractor_aliases jsonb not null default '[]',
  site_address       text not null default '',
  site_keywords      jsonb not null default '[]',   -- words that must appear in a paper's address
  start_date         date not null,
  visit_date         date not null,
  contract_end       date not null,
  contract_value_inr numeric not null,
  peak_workers       int not null,
  flags              jsonb not null default '{}',   -- concrete plant|rmc, lifting, creche, excavation
  template_version   text not null,
  phase              text not null default 'paper', -- paper | walk | report | closure | closed
  created_at         timestamptz not null default now()
);

create table if not exists contacts (
  id               bigserial primary key,
  mobilisation_id  bigint references mobilisations(id),
  phone            text not null,                   -- digits with country code, as WhatsApp sends it
  name             text not null default '',
  role             text not null,                   -- contractor | engineer | design | ehs | project_head | reviewer
  language         text not null default 'en',
  last_inbound_at  timestamptz,                     -- drives the 24-hour window
  unique (mobilisation_id, phone)
);
create index if not exists contacts_phone on contacts (phone);

create table if not exists lines (
  id               bigserial primary key,
  mobilisation_id  bigint not null references mobilisations(id),
  code             text not null,
  area             text not null,
  text             text not null,
  evidence         text not null,                   -- document | photo | both
  "when"           text not null,                   -- paper | walk
  severity         text not null,                   -- critical | major | minor
  doc_type         text,
  rules            jsonb not null default '[]',
  hint             text not null default '',
  status           text not null default 'open',    -- open | filed | review | accepted | rejected | ok | not_ok | na
  reason           text,
  remark           text,
  status_by        bigint references contacts(id),
  status_at        timestamptz,
  expires_on       date,
  unique (mobilisation_id, code)
);

-- Raw webhook bodies, stored before anything else happens, so nothing Meta sends is lost.
create table if not exists inbox (
  id           bigserial primary key,
  body_sha     text not null unique,
  payload      jsonb not null,
  received_at  timestamptz not null default now()
);

create table if not exists messages (
  id               bigserial primary key,
  wamid            text not null unique,            -- dedupe: Meta can deliver the same message twice
  inbox_id         bigint references inbox(id),
  contact_id       bigint references contacts(id),
  mobilisation_id  bigint references mobilisations(id),
  type             text not null,
  body             jsonb not null,                  -- the exploded event
  state            text not null default 'new',     -- new | processing | done | needs_human | failed
  state_at         timestamptz not null default now(),
  error            text,
  received_at      timestamptz not null default now()
);

create table if not exists evidence (
  id               bigserial primary key,
  mobilisation_id  bigint not null references mobilisations(id),
  line_code        text,
  message_id       bigint references messages(id),
  capture_id       uuid unique,                     -- walk page retries are safe
  kind             text not null,                   -- photo | document | audio | location
  s3_key           text,
  sha256           text,
  mime             text,
  bytes            int,
  gps              jsonb,                           -- {lat, lng, accuracy, ts} from the phone, never from EXIF
  geo_check        jsonb,                           -- result of geofence()
  bind_method      text,                            -- reply-to-line | caption-code | area-reply-number | picked-from-list | walk-line | ai-auto | ai-confirmed | reviewer
  bind_confidence  numeric,
  ai               jsonb,                           -- what AI said, kept for audit and evals
  fields           jsonb,                           -- what AI read off a paper
  checks           jsonb,                           -- checkPaper() result
  transcript       text,
  transcript_lang  text,
  created_by       bigint references contacts(id),
  created_at       timestamptz not null default now(),
  superseded_by    bigint references evidence(id)
);
create index if not exists evidence_sha on evidence (mobilisation_id, sha256);

-- Every message we send. Replies to it (context.id) are how a photo binds to a line for sure.
create table if not exists outbound (
  id               bigserial primary key,
  wamid            text unique,
  mobilisation_id  bigint references mobilisations(id),
  contact_id       bigint references contacts(id),
  kind             text not null,                   -- area | line | confirm | gap_list | open_item | noc | reply | review | help
  area             text,
  line_code        text,
  ref              text,                            -- evidence id / open item id / noc id
  payload          jsonb,
  status           text not null default 'sent',    -- sent | delivered | read | failed | not_sent
  error            jsonb,
  sent_at          timestamptz not null default now(),
  held_body        jsonb,                           -- outside the 24 h window: the real message, sent when they tap "Show me"
  released_at      timestamptz
);

create table if not exists pending_picks (
  contact_id  bigint primary key references contacts(id),
  line_code   text not null,
  at          timestamptz not null default now()
);

create table if not exists reply_queue (
  id               bigserial primary key,
  mobilisation_id  bigint references mobilisations(id),
  contact_id       bigint not null references contacts(id),
  fragment         jsonb not null,                  -- {kind: filed|accepted|rejected|review|unclear, line, reason}
  created_at       timestamptz not null default now(),
  claimed_at       timestamptz,
  sent_at          timestamptz
);

create table if not exists zones (
  id               bigserial primary key,
  mobilisation_id  bigint not null references mobilisations(id),
  area             text not null,
  name             text not null,
  shape            jsonb not null,                  -- {polygon: [[lat,lng],...]} or {circle: {lat,lng,radius_m}}
  source           text not null                    -- engineer_drawn | contractor_pin
);

create table if not exists walks (
  id               bigserial primary key,
  mobilisation_id  bigint not null references mobilisations(id),
  engineer_id      bigint not null references contacts(id),
  expires_at       timestamptz not null,
  started_at       timestamptz,
  finished_at      timestamptz
);

create table if not exists trail (
  walk_id   bigint not null references walks(id),
  ts        timestamptz not null,
  lat       double precision not null,
  lng       double precision not null,
  accuracy  real not null,
  primary key (walk_id, ts)
);

-- QR stickers fixed in rooms and areas. A scan opens the walk page and is recorded here.
create table if not exists spot_checks (
  walk_id   bigint not null references walks(id),
  area      text not null,
  sticker   int not null,
  ts        timestamptz not null,
  gps       jsonb,
  primary key (walk_id, area, sticker, ts)
);

create table if not exists noc_reports (
  id               bigserial primary key,
  mobilisation_id  bigint not null references mobilisations(id),
  version          int not null,
  score            jsonb not null,
  narrative        jsonb,
  narrative_ok     boolean,
  s3_key           text,
  status           text not null default 'draft',   -- draft | approved | conditional | held
  signed_by        bigint references contacts(id),
  signed_at        timestamptz,
  sign_wamid       text,                            -- the button reply that signed it
  created_at       timestamptz not null default now(),
  unique (mobilisation_id, version)
);

create table if not exists open_items (
  id                 bigserial primary key,
  mobilisation_id    bigint not null references mobilisations(id),
  line_code          text not null,
  severity           text not null,
  text               text not null,
  finding            text,
  due_on             date not null,
  status             text not null default 'open',  -- open | proposed_closed | closed
  closed_evidence_id bigint references evidence(id),
  closed_at          timestamptz
);

create table if not exists review_queue (
  id               bigserial primary key,
  mobilisation_id  bigint references mobilisations(id),
  message_id       bigint references messages(id),
  evidence_id      bigint references evidence(id),
  reason           text not null,
  options          jsonb not null default '[]',
  created_at       timestamptz not null default now(),
  resolved_at      timestamptz,
  resolution       jsonb,
  sent_at          timestamptz,                     -- handed to a reviewer on WhatsApp (WF-12)
  reviewer_id      bigint references contacts(id)
);

create table if not exists audit_log (
  id        bigserial primary key,
  at        timestamptz not null default now(),
  actor     text not null,                          -- contact:<id> | system | ai | reviewer:<id>
  action    text not null,
  entity    text not null,
  entity_id text not null,
  detail    jsonb
);

create table if not exists errors (
  id            bigserial primary key,
  at            timestamptz not null default now(),
  workflow      text,
  execution_id  text,
  node          text,
  message       text,
  url           text
);

-- Upgrades for databases created from the first version of this file.
alter table outbound add column if not exists held_body jsonb;
alter table outbound add column if not exists released_at timestamptz;
alter table review_queue add column if not exists sent_at timestamptz;
alter table review_queue add column if not exists reviewer_id bigint references contacts(id);
create index if not exists outbound_held on outbound (contact_id) where held_body is not null and released_at is null;

-- How often AI's line choice matched the line a person settled on (shadow mode measures this).
-- Rows: every file AI was asked about and that has since been filed by a person.
create or replace view ai_accuracy as
select mobilisation_id,
  case when (ai->>'confidence')::numeric >= 0.9 then '0.90+' when (ai->>'confidence')::numeric >= 0.7 then '0.70-0.89'
       when (ai->>'confidence')::numeric >= 0.45 then '0.45-0.69' else 'under 0.45' end as confidence_band,
  count(*) as items,
  count(*) filter (where ai->>'line_code' = line_code) as ai_right,
  round(100.0 * count(*) filter (where ai->>'line_code' = line_code) / nullif(count(*), 0), 1) as pct_right
from evidence
where ai is not null and ai ? 'line_code' and line_code is not null and bind_method in ('ai-confirmed', 'confirmed', 'reviewer')
group by 1, 2;

-- File one stored evidence row on a line. Used by button answers (sender or reviewer).
-- A paper is not accepted here: it is marked for re-reading (WF-10 runs the paper checks).
create or replace function file_evidence(ev_id bigint, p_code text, p_method text, p_actor text) returns jsonb language plpgsql as $$
declare
  ev evidence%rowtype;
  ln lines%rowtype;
  paper boolean;
begin
  select * into ev from evidence where id = ev_id for update;
  if not found then return jsonb_build_object('ok', false, 'why', 'evidence not found'); end if;
  select * into ln from lines where mobilisation_id = ev.mobilisation_id and lines.code = p_code;
  if not found then return jsonb_build_object('ok', false, 'why', 'line ' || p_code || ' is not on this site'); end if;
  paper := ln.evidence in ('document', 'both') and ev.kind in ('document', 'photo');
  update evidence set line_code = ln.code, bind_method = p_method where id = ev.id;
  update lines set status = 'filed', status_at = now() where id = ln.id and status in ('open', 'rejected');
  if not paper and ev.created_by is not null then
    insert into reply_queue (mobilisation_id, contact_id, fragment)
      values (ev.mobilisation_id, ev.created_by, jsonb_build_object('kind', 'filed', 'line', ln.code, 'photo', ev.kind = 'photo'));
  end if;
  insert into audit_log (actor, action, entity, entity_id, detail)
    values (p_actor, 'file_evidence', 'line', ln.code, jsonb_build_object('evidence', ev.id, 'method', p_method));
  return jsonb_build_object('ok', true, 'line', ln.code, 'reread', paper, 'evidence_id', ev.id);
end $$;

-- A person's button answer, applied in one transaction. Called by WF-02.
-- a = {verb, ref, value, by, at, wamid}. Every verb checks the person belongs to the site
-- the button is about, so a forwarded button cannot act on someone else's site.
create or replace function apply_answer(a jsonb) returns jsonb language plpgsql as $$
declare
  me  contacts%rowtype;
  ev  evidence%rowtype;
  oi  open_items%rowtype;
  rq  review_queue%rowtype;
  ln  lines%rowtype;
  v   text := coalesce(a->>'value', '');
  who bigint;
  r   jsonb := jsonb_build_object('ok', true);
begin
  select * into me from contacts where id = (a->>'by')::bigint;
  if not found then return jsonb_build_object('ok', false, 'why', 'unknown sender'); end if;

  if a->>'verb' = 'bind' then
    select * into ev from evidence where id = (a->>'ref')::bigint;
    if not found or ev.mobilisation_id is distinct from me.mobilisation_id then return jsonb_build_object('ok', false, 'why', 'not on your site'); end if;
    if ev.line_code is not null then return jsonb_build_object('ok', true, 'why', 'already filed on ' || ev.line_code); end if;
    if v = 'OTHER' then
      insert into review_queue (mobilisation_id, evidence_id, message_id, reason) values (ev.mobilisation_id, ev.id, ev.message_id, 'Sender chose "something else"');
      insert into reply_queue (mobilisation_id, contact_id, fragment) values (ev.mobilisation_id, me.id, jsonb_build_object('kind', 'review', 'line', ''));
    else
      r := file_evidence(ev.id, v, case when ev.bind_method = 'ai' then 'ai-confirmed' else 'confirmed' end, 'contact:' || me.id);
    end if;

  elsif a->>'verb' = 'pick' then
    insert into pending_picks (contact_id, line_code, at) values (me.id, v, now())
      on conflict (contact_id) do update set line_code = excluded.line_code, at = now();

  elsif a->>'verb' = 'na' then
    update lines set status = case when v = 'approve' then 'na' else status end, status_by = me.id, status_at = now(),
      reason = case when v = 'approve' then 'N/A approved by the engineer' else reason end
      where mobilisation_id = me.mobilisation_id and code = a->>'ref' and me.role = 'engineer' returning * into ln;
    if not found then return jsonb_build_object('ok', false, 'why', 'line not on your site'); end if;
    insert into reply_queue (mobilisation_id, contact_id, fragment)
      select me.mobilisation_id, c.id, jsonb_build_object('kind', case when v = 'approve' then 'na' else 'na_refused' end, 'line', ln.code)
      from contacts c where c.mobilisation_id = me.mobilisation_id and c.role = 'contractor';

  elsif a->>'verb' = 'close' then
    select * into oi from open_items where id = (a->>'ref')::bigint for update;
    if not found or oi.mobilisation_id is distinct from me.mobilisation_id or me.role <> 'engineer' then return jsonb_build_object('ok', false, 'why', 'item not on your site'); end if;
    if oi.status <> 'proposed_closed' then return jsonb_build_object('ok', true, 'why', 'item is ' || oi.status); end if;
    select created_by into who from evidence where id = oi.closed_evidence_id;
    if v = 'accept' then
      update open_items set status = 'closed', closed_at = now() where id = oi.id;
      update lines set status = 'ok', status_by = me.id, status_at = now() where mobilisation_id = oi.mobilisation_id and code = oi.line_code;
    else
      update open_items set status = 'open', closed_evidence_id = null where id = oi.id;
    end if;
    if who is not null then
      insert into reply_queue (mobilisation_id, contact_id, fragment) values (oi.mobilisation_id, who, jsonb_build_object('kind', case when v = 'accept' then 'closed' else 'reopened' end, 'line', oi.line_code));
    end if;

  elsif a->>'verb' = 'sign' then
    update noc_reports set status = case v when 'approve' then 'approved' when 'conditions' then 'conditional' else 'held' end,
      signed_by = me.id, signed_at = now(), sign_wamid = a->>'wamid'
      where id = (a->>'ref')::bigint and status = 'draft' and mobilisation_id = me.mobilisation_id and me.role = 'engineer';
    r := jsonb_build_object('ok', found);

  elsif a->>'verb' = 'review' then
    if me.role <> 'reviewer' then return jsonb_build_object('ok', false, 'why', 'reviewers only'); end if;
    select * into rq from review_queue where id = (a->>'ref')::bigint for update;
    if not found then return jsonb_build_object('ok', false, 'why', 'review item not found'); end if;
    if rq.resolved_at is not null then return jsonb_build_object('ok', true, 'why', 'already resolved'); end if;
    if rq.evidence_id is not null then select * into ev from evidence where id = rq.evidence_id; end if;
    who := coalesce(ev.created_by, (select contact_id from messages where id = rq.message_id));
    if v ~ '^[A-Z]{2,3}-[0-9]{2}$' then
      if rq.evidence_id is null then return jsonb_build_object('ok', false, 'why', 'no stored file to file'); end if;
      r := file_evidence(rq.evidence_id, v, 'reviewer', 'reviewer:' || me.id);
      if not (r->>'ok')::boolean then return r; end if;
    elsif v in ('accept', 'reject') then
      if ev.line_code is null then return jsonb_build_object('ok', false, 'why', 'file has no line yet'); end if;
      update lines set status = case when v = 'accept' then 'accepted' else 'rejected' end,
        reason = case when v = 'accept' then 'Checked by Vera team' else 'Checked by Vera team: please send a correct, clear copy' end, status_at = now()
        where mobilisation_id = ev.mobilisation_id and code = ev.line_code and status not in ('ok', 'not_ok', 'na');
      if who is not null then
        insert into reply_queue (mobilisation_id, contact_id, fragment) values (ev.mobilisation_id, who,
          jsonb_build_object('kind', case when v = 'accept' then 'accepted' else 'rejected' end, 'line', ev.line_code, 'reason', 'checked by our team: please send a correct, clear copy'));
      end if;
    elsif v = 'resend' then
      if who is not null then
        insert into reply_queue (mobilisation_id, contact_id, fragment) values (rq.mobilisation_id, who, jsonb_build_object('kind', 'resend', 'line', coalesce(ev.line_code, ''), 'reason', rq.reason));
      end if;
    elsif v <> 'done' then
      return jsonb_build_object('ok', false, 'why', 'unknown review choice');
    end if;
    update review_queue set resolved_at = now(), resolution = a where id = rq.id;
    update messages set state = 'done', state_at = now() where id = rq.message_id and state = 'needs_human';

  else
    return jsonb_build_object('ok', false, 'why', 'unknown verb');
  end if;
  insert into audit_log (actor, action, entity, entity_id, detail) values ('contact:' || me.id, a->>'verb', 'answer', coalesce(a->>'ref', ''), a);
  return r;
end $$;
