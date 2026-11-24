import { Router } from 'express'
import { query, withTransaction } from '../../db/pool.js'
import { badRequest, notFound } from '../../utils/httpError.js'
import { camelRow, parseId, slugify, validateBody, validateStringList } from '../../utils/validate.js'

const router = Router()

const fields = [
  { key: 'slug', label: 'Slug', max: 120 },
  { key: 'title', label: 'Title', required: true, max: 150 },
  { key: 'shortTitle', label: 'Short title', max: 80 },
  { key: 'categoryId', label: 'Category', type: 'fk' },
  { key: 'iconKey', label: 'Icon', max: 50, default: 'heartPulse' },
  { key: 'imageMediaId', label: 'Image', type: 'fk' },
  { key: 'summary', label: 'Summary', required: true, max: 500 },
  { key: 'description', label: 'Description', type: 'text', max: 5000 },
  { key: 'sortOrder', type: 'int', min: 0 },
  { key: 'isActive', type: 'bool', default: true },
]

const SELECT = `
  SELECT s.*, c.label AS category_label, m.url AS image_url, m.alt_text AS image_alt,
         COALESCE((SELECT json_agg(f.text ORDER BY f.sort_order, f.id) FROM service_features f WHERE f.service_id = s.id), '[]') AS features,
         COALESCE((SELECT json_agg(u.text ORDER BY u.sort_order, u.id) FROM service_suitable_for u WHERE u.service_id = s.id), '[]') AS suitable_for
  FROM services s
  LEFT JOIN service_categories c ON c.id = s.category_id
  LEFT JOIN media m ON m.id = s.image_media_id`

async function getOne(id) {
  const { rows } = await query(`${SELECT} WHERE s.id = $1`, [id])
  if (!rows[0]) throw notFound('Service not found.')
  return camelRow(rows[0])
}

async function replaceList(client, table, serviceId, items) {
  if (items === undefined) return
  await client.query(`DELETE FROM ${table} WHERE service_id = $1`, [serviceId])
  for (const [i, text] of items.entries()) {
    await client.query(`INSERT INTO ${table} (service_id, text, sort_order) VALUES ($1, $2, $3)`, [serviceId, text, i + 1])
  }
}

function readLists(body) {
  return {
    features: validateStringList(body.features, { label: 'Features' }),
    suitableFor: validateStringList(body.suitableFor, { label: 'Who it is for' }),
  }
}

router.get('/', async (_req, res) => {
  const { rows } = await query(`${SELECT} ORDER BY s.sort_order, s.id`)
  res.json({ data: rows.map(camelRow) })
})

/** PUT /reorder  { ids: [3, 1, 2] } */
router.put('/reorder', async (req, res) => {
  const ids = req.body?.ids
  if (!Array.isArray(ids) || !ids.length) throw badRequest('"ids" must be a non-empty list.')
  const clean = ids.map((raw) => parseId(raw))
  await withTransaction(async (client) => {
    for (const [i, id] of clean.entries()) {
      await client.query('UPDATE services SET sort_order = $1 WHERE id = $2', [i + 1, id])
    }
  })
  res.json({ message: 'Order updated.' })
})

router.get('/:id', async (req, res) => {
  res.json({ data: await getOne(parseId(req.params.id)) })
})

/** POST  { title, summary, …, features: [..], suitableFor: [..] } */
router.post('/', async (req, res) => {
  const values = validateBody(fields, req.body)
  values.slug = slugify(values.slug || values.title)
  if (!values.slug) throw badRequest('Please provide a valid title or slug.')
  const lists = readLists(req.body)

  const id = await withTransaction(async (client) => {
    if (values.sort_order === undefined) {
      const { rows } = await client.query('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM services')
      values.sort_order = rows[0].next
    }
    const columns = Object.keys(values)
    const { rows } = await client.query(
      `INSERT INTO services (${columns.join(', ')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
      Object.values(values),
    )
    await replaceList(client, 'service_features', rows[0].id, lists.features || [])
    await replaceList(client, 'service_suitable_for', rows[0].id, lists.suitableFor || [])
    return rows[0].id
  })
  res.status(201).json({ data: await getOne(id), message: 'Service created.' })
})

/** PUT  send only what changed; sending features/suitableFor replaces that list. */
router.put('/:id', async (req, res) => {
  const id = parseId(req.params.id)
  const values = validateBody(fields, req.body, { partial: true })
  if (values.slug !== undefined) {
    values.slug = slugify(values.slug)
    if (!values.slug) throw badRequest('Slug cannot be empty.')
  }
  const lists = readLists(req.body)

  await withTransaction(async (client) => {
    const columns = Object.keys(values)
    if (columns.length) {
      const { rowCount } = await client.query(
        `UPDATE services SET ${columns.map((c, i) => `${c} = $${i + 1}`).join(', ')} WHERE id = $${columns.length + 1}`,
        [...Object.values(values), id],
      )
      if (!rowCount) throw notFound('Service not found.')
    } else {
      const { rowCount } = await client.query('SELECT 1 FROM services WHERE id = $1', [id])
      if (!rowCount) throw notFound('Service not found.')
    }
    await replaceList(client, 'service_features', id, lists.features)
    await replaceList(client, 'service_suitable_for', id, lists.suitableFor)
  })
  res.json({ data: await getOne(id), message: 'Service updated.' })
})

router.delete('/:id', async (req, res) => {
  const { rowCount } = await query('DELETE FROM services WHERE id = $1', [parseId(req.params.id)])
  if (!rowCount) throw notFound('Service not found.')
  res.json({ message: 'Service deleted. Existing enquiries keep their record without a service link.' })
})

export default router
