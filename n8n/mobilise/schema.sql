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
  sent_at          timestamptz not null default now()
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
  resolution       jsonb
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

-- A person's button answer, applied in one transaction. Called by WF-02.
-- a = {verb, ref, value, by, at, wamid}
create or replace function apply_answer(a jsonb) returns jsonb language plpgsql as $$
declare
  ev evidence%rowtype;
  r  jsonb;
begin
  if a->>'verb' = 'bind' then
    select * into ev from evidence where id = (a->>'ref')::bigint for update;
    if not found then return jsonb_build_object('ok', false, 'why', 'evidence not found'); end if;
    if a->>'value' = 'OTHER' then
      insert into review_queue (mobilisation_id, evidence_id, reason) values (ev.mobilisation_id, ev.id, 'Sender chose "something else"');
      return jsonb_build_object('ok', true, 'fragment', jsonb_build_object('kind', 'review', 'line', ''));
    end if;
    update evidence set line_code = a->>'value', bind_method = case when bind_method = 'ai' then 'ai-confirmed' else 'confirmed' end where id = ev.id;
    update lines set status = case when status = 'open' then 'filed' else status end where mobilisation_id = ev.mobilisation_id and code = a->>'value';
    r := jsonb_build_object('ok', true, 'fragment', jsonb_build_object('kind', 'filed', 'line', a->>'value', 'photo', ev.kind = 'photo'));
  elsif a->>'verb' = 'pick' then
    insert into pending_picks (contact_id, line_code, at) values ((a->>'by')::bigint, a->>'value', now())
      on conflict (contact_id) do update set line_code = excluded.line_code, at = now();
    r := jsonb_build_object('ok', true, 'fragment', jsonb_build_object('kind', 'picked', 'line', a->>'value'));
  elsif a->>'verb' = 'na' then
    update lines set status = case when a->>'value' = 'approve' then 'na' else status end, status_by = (a->>'by')::bigint, status_at = now()
      where id = (a->>'ref')::bigint;
    r := jsonb_build_object('ok', true);
  elsif a->>'verb' = 'close' then
    update open_items set status = case when a->>'value' = 'accept' then 'closed' else 'open' end, closed_at = case when a->>'value' = 'accept' then now() end
      where id = (a->>'ref')::bigint;
    r := jsonb_build_object('ok', true);
  elsif a->>'verb' = 'sign' then
    update noc_reports set status = case a->>'value' when 'approve' then 'approved' when 'conditions' then 'conditional' else 'held' end,
      signed_by = (a->>'by')::bigint, signed_at = now(), sign_wamid = a->>'wamid'
      where id = (a->>'ref')::bigint and status = 'draft';
    r := jsonb_build_object('ok', found);
  else
    return jsonb_build_object('ok', false, 'why', 'unknown verb');
  end if;
  insert into audit_log (actor, action, entity, entity_id, detail) values ('contact:' || (a->>'by'), a->>'verb', 'answer', coalesce(a->>'ref', ''), a);
  return r;
end $$;
