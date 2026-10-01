-- Houses you've contacted, with your notes: contact person, phone, visit date.
-- Keyed on the advert (source + source id), not the cluster, because cluster
-- ids are rebuilt by the pipeline. The house snapshot (url, title, price, photo)
-- keeps the entry readable after the advert is removed or deactivated.
CREATE TABLE house_contacts (
  id             bigserial PRIMARY KEY,
  user_id        text NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  source         text NOT NULL,
  source_id      text NOT NULL,
  url            text NOT NULL,
  title          text,
  price          bigint,
  photo          text,
  lat            double precision,
  lng            double precision,
  status         text NOT NULL DEFAULT 'contacted',
  contact_name   text,
  contact_phone  text,
  contact_email  text,
  visit_at       timestamptz,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT house_contacts_user_advert UNIQUE (user_id, source, source_id)
);

CREATE INDEX house_contacts_user_idx ON house_contacts (user_id);
