-- =====================================================================
-- Advanced Home Care (AHC) — Database schema (PostgreSQL, 3NF)
-- ---------------------------------------------------------------------
-- Run this file FIRST, inside the database you already created in
-- pgAdmin (Query Tool). It does NOT create a database.
--
-- Normalisation notes (3NF):
--  * Every table has a single-column surrogate primary key.
--  * Repeating groups are split into child tables
--    (service_features, service_suitable_for, team_member_skills,
--     section_items, legal_sections, nav_items).
--  * Lookup data lives in its own table and is referenced by FK
--    (service_categories, faq_categories, care_durations,
--     enquiry_statuses, nav_menus).
--  * A customer's name/email depend on the customer (keyed by mobile),
--    not on each enquiry, so they live in `customers`.
--  * Image metadata (file, alt text, size) lives once in `media` and is
--    referenced by id.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Helper: keep updated_at current on every UPDATE
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- Admin users (JWT login)
-- ---------------------------------------------------------------------
CREATE TABLE admins (
  id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  full_name      VARCHAR(100) NOT NULL,
  email          VARCHAR(150) NOT NULL UNIQUE,
  password_hash  VARCHAR(255) NOT NULL,
  role           VARCHAR(20)  NOT NULL DEFAULT 'editor'
                 CHECK (role IN ('super_admin', 'editor')),
  is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
  last_login_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- Uploaded images
-- ---------------------------------------------------------------------
CREATE TABLE media (
  id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  file_name      VARCHAR(255) NOT NULL UNIQUE,      -- stored file name
  original_name  VARCHAR(255),
  mime_type      VARCHAR(100) NOT NULL,
  size_bytes     INTEGER      NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  url            VARCHAR(500) NOT NULL,             -- e.g. /uploads/hero.jpg
  alt_text       VARCHAR(255) NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- Global site settings (single row, id is always 1)
-- ---------------------------------------------------------------------
CREATE TABLE site_settings (
  id               SMALLINT     PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  site_name        VARCHAR(120) NOT NULL,
  legal_name       VARCHAR(150) NOT NULL,
  short_name       VARCHAR(20)  NOT NULL,
  tagline          VARCHAR(200) NOT NULL DEFAULT '',
  meta_description VARCHAR(300) NOT NULL DEFAULT '',
  logo_media_id    INTEGER REFERENCES media(id) ON DELETE SET NULL,
  phone_display    VARCHAR(30)  NOT NULL DEFAULT '',
  phone_dial       VARCHAR(20)  NOT NULL DEFAULT '',
  whatsapp_number  VARCHAR(20)  NOT NULL DEFAULT '',
  email            VARCHAR(150) NOT NULL DEFAULT '',
  address          VARCHAR(300) NOT NULL DEFAULT '',
  city             VARCHAR(100) NOT NULL DEFAULT '',
  working_hours    VARCHAR(150) NOT NULL DEFAULT '',
  map_embed_url    VARCHAR(1000) NOT NULL DEFAULT '',
  footer_about     TEXT         NOT NULL DEFAULT '',
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE social_links (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  platform    VARCHAR(30)  NOT NULL UNIQUE
              CHECK (platform IN ('facebook', 'instagram', 'linkedin', 'youtube', 'x')),
  url         VARCHAR(500) NOT NULL DEFAULT '',
  sort_order  INTEGER      NOT NULL DEFAULT 0,
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- Navigation (header + footer columns)
-- ---------------------------------------------------------------------
CREATE TABLE nav_menus (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code        VARCHAR(50)  NOT NULL UNIQUE,   -- header, footer_company, ...
  title       VARCHAR(100) NOT NULL,
  sort_order  INTEGER      NOT NULL DEFAULT 0
);

CREATE TABLE nav_items (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  menu_id     INTEGER      NOT NULL REFERENCES nav_menus(id) ON DELETE CASCADE,
  label       VARCHAR(100) NOT NULL,
  url         VARCHAR(300) NOT NULL,
  sort_order  INTEGER      NOT NULL DEFAULT 0,
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_nav_items_menu ON nav_items(menu_id, sort_order);

-- ---------------------------------------------------------------------
-- Editable page sections (headings, text, images, CTAs) + their items
-- (trust points, stats, pillars, features, steps, checklists, values)
-- ---------------------------------------------------------------------
CREATE TABLE page_sections (
  id                   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  section_key          VARCHAR(80)  NOT NULL UNIQUE,  -- e.g. home.hero
  page                 VARCHAR(40)  NOT NULL,         -- home, about, ...
  admin_label          VARCHAR(120) NOT NULL,         -- shown in admin panel
  eyebrow              VARCHAR(150) NOT NULL DEFAULT '',
  title                VARCHAR(250) NOT NULL DEFAULT '',
  highlight            VARCHAR(300) NOT NULL DEFAULT '',
  body                 TEXT         NOT NULL DEFAULT '',
  image_media_id       INTEGER REFERENCES media(id) ON DELETE SET NULL,
  primary_cta_label    VARCHAR(80)  NOT NULL DEFAULT '',
  primary_cta_url      VARCHAR(300) NOT NULL DEFAULT '',
  secondary_cta_label  VARCHAR(80)  NOT NULL DEFAULT '',
  secondary_cta_url    VARCHAR(300) NOT NULL DEFAULT '',
  is_active            BOOLEAN      NOT NULL DEFAULT TRUE,
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE section_items (
  id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  section_id   INTEGER      NOT NULL REFERENCES page_sections(id) ON DELETE CASCADE,
  icon_key     VARCHAR(50)  NOT NULL DEFAULT '',
  title        VARCHAR(200) NOT NULL DEFAULT '',
  text         TEXT         NOT NULL DEFAULT '',
  value        VARCHAR(50)  NOT NULL DEFAULT '',   -- e.g. stat number "500+"
  badge        VARCHAR(50)  NOT NULL DEFAULT '',
  is_featured  BOOLEAN      NOT NULL DEFAULT FALSE,
  sort_order   INTEGER      NOT NULL DEFAULT 0,
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_section_items_section ON section_items(section_id, sort_order);

-- ---------------------------------------------------------------------
-- Services
-- ---------------------------------------------------------------------
CREATE TABLE service_categories (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug        VARCHAR(60)  NOT NULL UNIQUE,
  label       VARCHAR(100) NOT NULL,
  sort_order  INTEGER      NOT NULL DEFAULT 0,
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE services (
  id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug            VARCHAR(120) NOT NULL UNIQUE,
  title           VARCHAR(150) NOT NULL,
  short_title     VARCHAR(80)  NOT NULL DEFAULT '',
  category_id     INTEGER REFERENCES service_categories(id) ON DELETE SET NULL,
  icon_key        VARCHAR(50)  NOT NULL DEFAULT 'heartPulse',
  image_media_id  INTEGER REFERENCES media(id) ON DELETE SET NULL,
  summary         VARCHAR(500) NOT NULL,
  description     TEXT         NOT NULL DEFAULT '',
  sort_order      INTEGER      NOT NULL DEFAULT 0,
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_services_category ON services(category_id);

CREATE TABLE service_features (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  service_id  INTEGER      NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  text        VARCHAR(300) NOT NULL,
  sort_order  INTEGER      NOT NULL DEFAULT 0
);
CREATE INDEX idx_service_features_service ON service_features(service_id, sort_order);

CREATE TABLE service_suitable_for (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  service_id  INTEGER      NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  text        VARCHAR(300) NOT NULL,
  sort_order  INTEGER      NOT NULL DEFAULT 0
);
CREATE INDEX idx_service_suitable_service ON service_suitable_for(service_id, sort_order);

-- ---------------------------------------------------------------------
-- Care durations (used on the site and in enquiries)
-- ---------------------------------------------------------------------
CREATE TABLE care_durations (
  id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code         VARCHAR(40)  NOT NULL UNIQUE,     -- short-term, 24-hour, ...
  label        VARCHAR(100) NOT NULL,
  description  VARCHAR(300) NOT NULL DEFAULT '',
  icon_key     VARCHAR(50)  NOT NULL DEFAULT 'clock',
  sort_order   INTEGER      NOT NULL DEFAULT 0,
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- FAQs
-- ---------------------------------------------------------------------
CREATE TABLE faq_categories (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug        VARCHAR(60)  NOT NULL UNIQUE,
  label       VARCHAR(100) NOT NULL,
  sort_order  INTEGER      NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE faqs (
  id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category_id  INTEGER REFERENCES faq_categories(id) ON DELETE SET NULL,
  question     VARCHAR(300) NOT NULL,
  answer       TEXT         NOT NULL,
  sort_order   INTEGER      NOT NULL DEFAULT 0,
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_faqs_category ON faqs(category_id);

-- ---------------------------------------------------------------------
-- Testimonials
-- ---------------------------------------------------------------------
CREATE TABLE testimonials (
  id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_name  VARCHAR(100) NOT NULL,
  relation       VARCHAR(60)  NOT NULL DEFAULT '',
  rating         SMALLINT     NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  feedback       TEXT         NOT NULL,
  service_id     INTEGER REFERENCES services(id) ON DELETE SET NULL,
  is_sample      BOOLEAN      NOT NULL DEFAULT FALSE,
  sort_order     INTEGER      NOT NULL DEFAULT 0,
  is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- Team (care-role cards)
-- ---------------------------------------------------------------------
CREATE TABLE team_members (
  id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  role_title      VARCHAR(120) NOT NULL,
  description     VARCHAR(500) NOT NULL DEFAULT '',
  image_media_id  INTEGER REFERENCES media(id) ON DELETE SET NULL,
  is_sample       BOOLEAN      NOT NULL DEFAULT FALSE,
  sort_order      INTEGER      NOT NULL DEFAULT 0,
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE team_member_skills (
  id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  team_member_id  INTEGER     NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  skill           VARCHAR(80) NOT NULL,
  sort_order      INTEGER     NOT NULL DEFAULT 0
);
CREATE INDEX idx_team_skills_member ON team_member_skills(team_member_id, sort_order);

-- ---------------------------------------------------------------------
-- Legal pages (Privacy Policy, Terms)
-- ---------------------------------------------------------------------
CREATE TABLE legal_pages (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug        VARCHAR(60)  NOT NULL UNIQUE,
  title       VARCHAR(150) NOT NULL,
  intro       TEXT         NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE legal_sections (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  page_id     INTEGER      NOT NULL REFERENCES legal_pages(id) ON DELETE CASCADE,
  heading     VARCHAR(200) NOT NULL,
  body        TEXT         NOT NULL,   -- paragraphs separated by a blank line
  sort_order  INTEGER      NOT NULL DEFAULT 0
);
CREATE INDEX idx_legal_sections_page ON legal_sections(page_id, sort_order);

-- ---------------------------------------------------------------------
-- Enquiries (contact form + booking form)
-- ---------------------------------------------------------------------
CREATE TABLE customers (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  full_name   VARCHAR(100) NOT NULL,
  mobile      VARCHAR(15)  NOT NULL UNIQUE,   -- normalised 10-digit number
  email       VARCHAR(150) NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE enquiry_statuses (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code        VARCHAR(30) NOT NULL UNIQUE,
  label       VARCHAR(60) NOT NULL,
  sort_order  INTEGER     NOT NULL DEFAULT 0
);

CREATE TABLE enquiries (
  id                    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id           INTEGER      NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  source                VARCHAR(20)  NOT NULL CHECK (source IN ('contact-form', 'booking-form')),
  service_id            INTEGER REFERENCES services(id) ON DELETE SET NULL,
  care_duration_id      INTEGER REFERENCES care_durations(id) ON DELETE SET NULL,
  status_id             INTEGER      NOT NULL REFERENCES enquiry_statuses(id),
  patient_name          VARCHAR(100) NOT NULL,
  patient_age           SMALLINT     CHECK (patient_age BETWEEN 0 AND 120),
  patient_condition     TEXT         NOT NULL DEFAULT '',
  preferred_start_date  DATE,
  city                  VARCHAR(100) NOT NULL DEFAULT '',
  address               VARCHAR(500) NOT NULL DEFAULT '',
  requirements          TEXT         NOT NULL DEFAULT '',
  admin_notes           TEXT         NOT NULL DEFAULT '',
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_enquiries_status   ON enquiries(status_id);
CREATE INDEX idx_enquiries_created  ON enquiries(created_at DESC);
CREATE INDEX idx_enquiries_customer ON enquiries(customer_id);

-- ---------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'admins', 'media', 'site_settings', 'social_links', 'nav_items',
    'page_sections', 'section_items', 'service_categories', 'services',
    'care_durations', 'faq_categories', 'faqs', 'testimonials',
    'team_members', 'legal_pages', 'customers', 'enquiries'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON %1$I
         FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t);
  END LOOP;
END $$;

COMMIT;
