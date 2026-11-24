# Advanced Home Care — Backend API

Node.js + Express 5 + PostgreSQL. JWT authentication for the admin panel.
Every piece of website content (text, images, menus, services, FAQs, …) is
stored in the database and editable through the admin API.

## Setup

1. **Database** — in pgAdmin, open your existing database → Query Tool, and run
   the files in `queries/` in order: `01_schema.sql`, `02_seed_data.sql`,
   `03_admin_user.sql` (see `queries/README.md`).
2. **Environment** — edit `.env` and set `DB_NAME`, `DB_USER`, `DB_PASSWORD`
   (and `DB_HOST`/`DB_PORT` if not local). `JWT_SECRET` is already a random value.
   `CORS_ORIGINS` must list the website and admin panel URLs.
3. **Run**
   ```bash
   npm install
   npm run dev      # auto-restart on changes
   npm start        # production
   ```
   Check `http://localhost:5000/api/health` → `{"status":"ok","database":"connected"}`.
4. **Website** — `advancedhomecare/.env` has
   `VITE_API_BASE_URL=http://localhost:5000/api/public`. Restart the website's dev server.

Default admin: `admin@advancedhomecare.in` / `Admin@12345` — **change it after first login.**

## Conventions

- JSON in and out. Request and response keys are **camelCase** (`sortOrder`, `isActive`).
- Success: `{ data, message? }`. Lists with paging also return `pagination`.
- Errors: `{ message, errors? }` — `errors` maps field → message (for form highlighting).
- Admin routes need `Authorization: Bearer <token>`. `401` = log in again.
- `PUT` updates are partial: send only the fields you change.
- Image fields (`imageMediaId`, `logoMediaId`) take a media id from the Media library.
- Image `url`s are paths like `/uploads/x.jpg`; prefix them with the API origin
  (`http://localhost:5000`) to display them.
- Icon fields (`iconKey`) take keys from `GET /api/admin/meta/icons`
  (each has the matching lucide-react component name).
- Links (`url`, `primaryCtaUrl`, …) must start with `/`, `#`, `http(s)://`, `mailto:` or `tel:`.

## Endpoints

### Public (website, no auth)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/public/bootstrap` | All website content in one payload |
| POST | `/api/public/enquiries` | Contact-form enquiry (rate-limited) |
| POST | `/api/public/booking-enquiries` | Book Home Care enquiry (rate-limited) |

### Auth

| Method | Path | Body |
| --- | --- | --- |
| POST | `/api/auth/login` | `{ email, password }` → `{ token, expiresIn, admin }` |
| GET | `/api/auth/me` | current admin |
| POST | `/api/auth/change-password` | `{ currentPassword, newPassword }` |

### Admin (JWT required)

| Resource | Endpoints | Fields |
| --- | --- | --- |
| Dashboard | `GET /api/admin/dashboard` | totals, enquiries by status, 5 recent |
| Icons | `GET /api/admin/meta/icons` | `[{ key, lucide }]` |
| Settings | `GET`, `PUT /api/admin/settings` | `siteName, legalName, shortName, tagline, metaDescription, logoMediaId, phoneDisplay, phoneDial, whatsappNumber, email, address, city, workingHours, mapEmbedUrl, footerAbout` |
| Social links | `GET`, `PUT /:id` `/api/admin/social-links` | `url, sortOrder, isActive` |
| Menus | CRUD `/api/admin/nav-menus` | `code, title, sortOrder` |
| Menu links | CRUD `/api/admin/nav-items` (`?menuId=`) | `menuId, label, url, sortOrder, isActive` |
| Media | `GET`, `POST` (multipart `file`, `altText`), `PUT /:id` `{altText}`, `DELETE /:id` `/api/admin/media` | JPG/PNG/WEBP/GIF ≤ 5 MB; images in use cannot be deleted |
| Page sections | `GET /api/admin/sections` (`?page=home`), `GET /:id` (with items), `PUT /:id` | `eyebrow, title, highlight, body, imageMediaId, primaryCtaLabel, primaryCtaUrl, secondaryCtaLabel, secondaryCtaUrl, isActive` |
| Section items | CRUD `/api/admin/section-items` (`?sectionId=`) | `sectionId, iconKey, title, text, value, badge, isFeatured, sortOrder, isActive` |
| Service categories | CRUD `/api/admin/service-categories` | `slug, label, sortOrder, isActive` |
| Services | CRUD `/api/admin/services` | `title, slug?, shortTitle, categoryId, iconKey, imageMediaId, summary, description, sortOrder, isActive, features[], suitableFor[]` |
| Care durations | CRUD `/api/admin/care-durations` | `code, label, description, iconKey, sortOrder, isActive` |
| FAQ categories | CRUD `/api/admin/faq-categories` | `slug, label, sortOrder` |
| FAQs | CRUD `/api/admin/faqs` (`?categoryId=`) | `categoryId, question, answer, sortOrder, isActive` |
| Testimonials | CRUD `/api/admin/testimonials` | `customerName, relation, rating (1–5), feedback, serviceId, isSample, sortOrder, isActive` |
| Team | CRUD `/api/admin/team-members` | `roleTitle, description, imageMediaId, isSample, sortOrder, isActive, skills[]` |
| Legal pages | `GET`, `GET /:id`, `PUT /:id` `/api/admin/legal-pages` | `title, intro, sections: [{ heading, body }]` (blank line = new paragraph) |
| Enquiries | `GET` (`?page&limit&status&source&serviceId&search&from&to`), `GET /:id`, `PUT /:id`, `DELETE /:id` `/api/admin/enquiries` | update: `statusId, adminNotes` |
| Enquiry statuses | CRUD `/api/admin/enquiry-statuses` | `code, label, sortOrder` |
| Customers | `GET` (`?search&page&limit`), `GET /:id` (with enquiries) `/api/admin/customers` | read-only |
| Admins (super_admin only) | CRUD `/api/admin/admins` | `fullName, email, password, role (super_admin/editor), isActive` |

"CRUD" = `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id`, plus
`PUT /reorder` with `{ ids: [3, 1, 2] }` to save a drag-and-drop order.

### Page section keys

| Page | Keys |
| --- | --- |
| Home | `home.hero`, `home.hero_cards`, `home.trust_stats`, `home.about`, `home.services`, `home.why`, `home.process`, `home.care_options`, `home.team`, `home.testimonials`, `home.faq`, `home.faq_help`, `home.cta`, `home.contact` |
| About | `about.hero`, `about.story`, `about.values` |
| Other pages | `services.hero`, `how.hero`, `how.prepare`, `contact.hero`, `contact.form`, `book.hero`, `book.summary`, `faq.hero`, `faq.cta` |

In `home.why`, an item with `isFeatured: true` is shown as the full-width
highlighted card (e.g. 24×7 Emergency Teleconsultation).

## Security

- Passwords are bcrypt-hashed (cost 12); login is rate-limited (10 per 15 min).
- JWT (HS256) with expiry; the admin is re-checked on every request, so
  disabling an account takes effect immediately.
- All SQL uses parameterised queries; table/column names come only from code.
- Helmet headers, CORS allow-list, 1 MB JSON limit, public forms rate-limited.
- Uploads: image MIME allow-list (no SVG), size limit, random file names.

## Structure

```
src/
  app.js, server.js
  config/env.js           environment + validation
  db/pool.js              pg pool, query(), withTransaction()
  middleware/             auth (JWT), errorHandler, upload (multer)
  routes/                 public, auth, admin/*
  services/               publicContent (bootstrap), enquiries
  utils/                  crudRouter, validate, httpError, icons
queries/                  SQL to run in pgAdmin (not run automatically)
uploads/                  images (seeded + uploaded)
```
