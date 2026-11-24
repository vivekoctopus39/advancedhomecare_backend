import { query } from '../db/pool.js'

/**
 * Builds everything the public website needs in one payload.
 * The shape matches the website's local data files, so the frontend can use
 * API data and its built-in fallback interchangeably.
 */

const splitParagraphs = (text) =>
  String(text || '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)

const cta = (label, url) => (label && url ? { label, url } : null)

async function getSettings() {
  const { rows } = await query(`
    SELECT s.*, m.url AS logo_url
    FROM site_settings s
    LEFT JOIN media m ON m.id = s.logo_media_id
    WHERE s.id = 1`)
  const s = rows[0]
  if (!s) return null
  return {
    name: s.site_name,
    legalName: s.legal_name,
    shortName: s.short_name,
    tagline: s.tagline,
    description: s.meta_description,
    logoUrl: s.logo_url || '',
    footerAbout: s.footer_about,
    contact: {
      phoneDisplay: s.phone_display,
      phoneDial: s.phone_dial,
      whatsappNumber: s.whatsapp_number,
      email: s.email,
      address: s.address,
      city: s.city,
      workingHours: s.working_hours,
      mapEmbedUrl: s.map_embed_url,
    },
  }
}

async function getSocial() {
  const { rows } = await query('SELECT platform, url FROM social_links WHERE is_active ORDER BY sort_order')
  return Object.fromEntries(rows.map((r) => [r.platform, r.url]))
}

async function getNavigation() {
  const { rows } = await query(`
    SELECT m.code, m.title, i.label, i.url
    FROM nav_menus m
    LEFT JOIN nav_items i ON i.menu_id = m.id AND i.is_active
    ORDER BY m.sort_order, i.sort_order, i.id`)
  const menus = {}
  for (const r of rows) {
    menus[r.code] ??= { title: r.title, items: [] }
    if (r.label) menus[r.code].items.push({ label: r.label, to: r.url })
  }
  return menus
}

async function getSections() {
  const [{ rows: sections }, { rows: items }] = await Promise.all([
    query(`
      SELECT p.*, m.url AS image_url, m.alt_text AS image_alt
      FROM page_sections p
      LEFT JOIN media m ON m.id = p.image_media_id
      WHERE p.is_active`),
    query(`
      SELECT i.* FROM section_items i
      JOIN page_sections p ON p.id = i.section_id
      WHERE i.is_active AND p.is_active
      ORDER BY i.section_id, i.sort_order, i.id`),
  ])
  const byId = {}
  const result = {}
  for (const s of sections) {
    const section = {
      eyebrow: s.eyebrow,
      title: s.title,
      highlight: s.highlight,
      body: s.body,
      paragraphs: splitParagraphs(s.body),
      image: s.image_url || null,
      imageAlt: s.image_alt || '',
      primaryCta: cta(s.primary_cta_label, s.primary_cta_url),
      secondaryCta: cta(s.secondary_cta_label, s.secondary_cta_url),
      items: [],
    }
    byId[s.id] = section
    result[s.section_key] = section
  }
  for (const i of items) {
    byId[i.section_id]?.items.push({
      id: i.id,
      icon: i.icon_key,
      title: i.title,
      text: i.text,
      value: i.value || null,
      badge: i.badge,
      featured: i.is_featured,
    })
  }
  return result
}

async function getServices() {
  const { rows } = await query(`
    SELECT s.id, s.slug, s.title, s.short_title, s.icon_key, s.summary, s.description,
           c.slug AS category, m.url AS image, m.alt_text AS image_alt,
           COALESCE((SELECT json_agg(f.text ORDER BY f.sort_order, f.id)
                     FROM service_features f WHERE f.service_id = s.id), '[]') AS features,
           COALESCE((SELECT json_agg(u.text ORDER BY u.sort_order, u.id)
                     FROM service_suitable_for u WHERE u.service_id = s.id), '[]') AS suitable_for
    FROM services s
    LEFT JOIN service_categories c ON c.id = s.category_id
    LEFT JOIN media m ON m.id = s.image_media_id
    WHERE s.is_active
    ORDER BY s.sort_order, s.id`)
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    shortTitle: r.short_title || undefined,
    category: r.category,
    icon: r.icon_key,
    image: r.image,
    imageAlt: r.image_alt || '',
    summary: r.summary,
    description: r.description,
    features: r.features,
    suitableFor: r.suitable_for,
  }))
}

async function getServiceCategories() {
  const { rows } = await query('SELECT slug, label FROM service_categories WHERE is_active ORDER BY sort_order, id')
  return [{ id: 'all', label: 'All Services' }, ...rows.map((r) => ({ id: r.slug, label: r.label }))]
}

async function getCareDurations() {
  const { rows } = await query(
    'SELECT code, label, description, icon_key FROM care_durations WHERE is_active ORDER BY sort_order, id',
  )
  return rows.map((r) => ({ value: r.code, label: r.label, text: r.description, icon: r.icon_key }))
}

async function getFaqs() {
  const [{ rows: cats }, { rows: faqs }] = await Promise.all([
    query('SELECT slug, label FROM faq_categories ORDER BY sort_order, id'),
    query(`
      SELECT f.id, f.question, f.answer, c.slug AS category
      FROM faqs f LEFT JOIN faq_categories c ON c.id = f.category_id
      WHERE f.is_active ORDER BY f.sort_order, f.id`),
  ])
  return {
    faqCategories: [{ id: 'all', label: 'All' }, ...cats.map((c) => ({ id: c.slug, label: c.label }))],
    faqs: faqs.map((f) => ({ id: `faq-${f.id}`, category: f.category, question: f.question, answer: f.answer })),
  }
}

async function getTestimonials() {
  const { rows } = await query(`
    SELECT t.*, s.title AS service_title
    FROM testimonials t LEFT JOIN services s ON s.id = t.service_id
    WHERE t.is_active ORDER BY t.sort_order, t.id`)
  return rows.map((t) => ({
    id: `t-${t.id}`,
    isSample: t.is_sample,
    name: t.customer_name,
    relation: t.relation,
    rating: t.rating,
    service: t.service_title || '',
    feedback: t.feedback,
  }))
}

async function getTeam() {
  const { rows } = await query(`
    SELECT t.id, t.role_title, t.description, t.is_sample, m.url AS image, m.alt_text AS image_alt,
           COALESCE((SELECT json_agg(k.skill ORDER BY k.sort_order, k.id)
                     FROM team_member_skills k WHERE k.team_member_id = t.id), '[]') AS skills
    FROM team_members t LEFT JOIN media m ON m.id = t.image_media_id
    WHERE t.is_active ORDER BY t.sort_order, t.id`)
  return rows.map((t) => ({
    id: `team-${t.id}`,
    isSample: t.is_sample,
    role: t.role_title,
    image: t.image,
    imageAlt: t.image_alt || '',
    text: t.description,
    skills: t.skills,
  }))
}

async function getLegal() {
  const { rows } = await query(`
    SELECT p.slug, p.title, p.intro, p.updated_at,
           COALESCE((SELECT json_agg(json_build_object('heading', s.heading, 'body', s.body)
                                     ORDER BY s.sort_order, s.id)
                     FROM legal_sections s WHERE s.page_id = p.id), '[]') AS sections
    FROM legal_pages p`)
  return Object.fromEntries(
    rows.map((p) => [
      p.slug,
      {
        title: p.title,
        intro: p.intro,
        updatedAt: p.updated_at,
        sections: p.sections.map((s) => ({ heading: s.heading, body: splitParagraphs(s.body) })),
      },
    ]),
  )
}

export async function getBootstrap() {
  const [settings, social, navigation, sections, services, serviceCategories, careDurations, faqData, testimonials, team, legal] =
    await Promise.all([
      getSettings(),
      getSocial(),
      getNavigation(),
      getSections(),
      getServices(),
      getServiceCategories(),
      getCareDurations(),
      getFaqs(),
      getTestimonials(),
      getTeam(),
      getLegal(),
    ])
  return {
    settings,
    social,
    navigation,
    sections,
    services,
    serviceCategories,
    careDurations,
    ...faqData,
    testimonials,
    team,
    legal,
  }
}
