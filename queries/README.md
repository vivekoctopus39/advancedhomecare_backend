# Database queries

Run these in **pgAdmin → your existing database → Query Tool**, in this order.
They do not create a new database.

| Order | File | What it does |
| --- | --- | --- |
| 1 | `01_schema.sql` | Creates all tables, indexes and `updated_at` triggers |
| 2 | `02_seed_data.sql` | Inserts the website's current content (services, sections, FAQs, …) and image records |
| 3 | `03_admin_user.sql` | Creates the first admin login (change the password after logging in) |

Each file runs inside a transaction, so if anything fails nothing is half-applied.

`99_reset.sql` drops every table. Use it only if you want to start over
(it deletes all data, including enquiries).

## Tables (3NF)

| Table | Holds |
| --- | --- |
| `admins` | Admin-panel users (bcrypt password hashes, role) |
| `media` | Uploaded images: file, URL, alt text |
| `site_settings` | One row: site name, logo, phone, WhatsApp, email, address, hours, map, footer text |
| `social_links` | Facebook / Instagram / LinkedIn / YouTube / X URLs |
| `nav_menus`, `nav_items` | Header menu, header button and the three footer columns |
| `page_sections`, `section_items` | Every heading, paragraph, image and button on the site, plus their lists (trust points, stats, Why Choose Us cards, steps, checklists, values) |
| `service_categories`, `services`, `service_features`, `service_suitable_for` | Services and their bullet lists |
| `care_durations` | Short-term, 24-hour, … (site + enquiry form) |
| `faq_categories`, `faqs` | FAQs |
| `testimonials` | Reviews (seeded ones are marked `is_sample`) |
| `team_members`, `team_member_skills` | Team / care-role cards |
| `legal_pages`, `legal_sections` | Privacy Policy and Terms |
| `customers`, `enquiries`, `enquiry_statuses` | Website enquiries and their follow-up status |
