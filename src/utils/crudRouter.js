import { Router } from 'express'
import { query, withTransaction } from '../db/pool.js'
import { badRequest, notFound } from './httpError.js'
import { camelRow, parseId, validateBody } from './validate.js'

/**
 * Builds a standard admin CRUD router for a simple table.
 *
 *   GET    /           list (optionally filtered by a parent id query param)
 *   GET    /:id        one row
 *   POST   /           create
 *   PUT    /:id        update (send only the fields you want to change)
 *   DELETE /:id        delete
 *   PUT    /reorder    { ids: [3, 1, 2] } → sort_order follows the array order
 *
 * Table/column names come only from this config (never from the request);
 * all values are passed as query parameters.
 */
export function crudRouter({
  table,
  fields,
  orderBy = 'sort_order, id',
  parent, // { param: 'sectionId', column: 'section_id', required: true }
  hasSortOrder = true,
  allowCreate = true,
  allowDelete = true,
  label = 'Item',
}) {
  const router = Router()

  router.get('/', async (req, res) => {
    const params = []
    let where = ''
    if (parent && req.query[parent.param] !== undefined) {
      params.push(parseId(req.query[parent.param], parent.param))
      where = `WHERE ${parent.column} = $1`
    } else if (parent?.required) {
      throw badRequest(`Query parameter "${parent.param}" is required.`)
    }
    const { rows } = await query(`SELECT * FROM ${table} ${where} ORDER BY ${orderBy}`, params)
    res.json({ data: rows.map(camelRow) })
  })

  if (hasSortOrder) {
    router.put('/reorder', async (req, res) => {
      const ids = req.body?.ids
      if (!Array.isArray(ids) || !ids.length) throw badRequest('"ids" must be a non-empty list.')
      const clean = ids.map((id) => parseId(id))
      await withTransaction(async (client) => {
        for (const [index, id] of clean.entries()) {
          await client.query(`UPDATE ${table} SET sort_order = $1 WHERE id = $2`, [index + 1, id])
        }
      })
      res.json({ message: 'Order updated.' })
    })
  }

  router.get('/:id', async (req, res) => {
    const { rows } = await query(`SELECT * FROM ${table} WHERE id = $1`, [parseId(req.params.id)])
    if (!rows[0]) throw notFound(`${label} not found.`)
    res.json({ data: camelRow(rows[0]) })
  })

  if (allowCreate) {
    router.post('/', async (req, res) => {
      const values = validateBody(fields, req.body)
      if (hasSortOrder && values.sort_order === undefined) {
        const parentClause = parent && values[parent.column] ? `WHERE ${parent.column} = $1` : ''
        const { rows } = await query(
          `SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM ${table} ${parentClause}`,
          parentClause ? [values[parent.column]] : [],
        )
        values.sort_order = rows[0].next
      }
      const columns = Object.keys(values)
      const placeholders = columns.map((_, i) => `$${i + 1}`)
      const { rows } = await query(
        `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
        Object.values(values),
      )
      res.status(201).json({ data: camelRow(rows[0]), message: `${label} created.` })
    })
  }

  router.put('/:id', async (req, res) => {
    const id = parseId(req.params.id)
    const values = validateBody(fields, req.body, { partial: true })
    const columns = Object.keys(values)
    if (!columns.length) throw badRequest('Nothing to update.')
    const sets = columns.map((col, i) => `${col} = $${i + 1}`)
    const { rows } = await query(
      `UPDATE ${table} SET ${sets.join(', ')} WHERE id = $${columns.length + 1} RETURNING *`,
      [...Object.values(values), id],
    )
    if (!rows[0]) throw notFound(`${label} not found.`)
    res.json({ data: camelRow(rows[0]), message: `${label} updated.` })
  })

  if (allowDelete) {
    router.delete('/:id', async (req, res) => {
      const { rowCount } = await query(`DELETE FROM ${table} WHERE id = $1`, [parseId(req.params.id)])
      if (!rowCount) throw notFound(`${label} not found.`)
      res.json({ message: `${label} deleted.` })
    })
  }

  return router
}
