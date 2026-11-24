-- =====================================================================
-- DANGER: drops every AHC table and ALL data (including enquiries).
-- Only run this if you want to rebuild the schema from scratch,
-- then run 01, 02 and 03 again.
-- =====================================================================

BEGIN;

DROP TABLE IF EXISTS
  enquiries, enquiry_statuses, customers,
  legal_sections, legal_pages,
  team_member_skills, team_members,
  testimonials,
  faqs, faq_categories,
  care_durations,
  service_suitable_for, service_features, services, service_categories,
  section_items, page_sections,
  nav_items, nav_menus,
  social_links, site_settings,
  media, admins
CASCADE;

DROP FUNCTION IF EXISTS set_updated_at();

COMMIT;
