import { Router } from 'express'
import { query } from '../../db/pool.js'
import { badRequest, notFound } from '../../utils/httpError.js'
import { camelRow, validateBody } from '../../utils/validate.js'

const router = Router()

const fields = [
  { key: 'siteName', label: 'Site name', required: true, max: 120 },
  { key: 'legalName', label: 'Legal name', required: true, max: 150 },
  { key: 'shortName', label: 'Short name', required: true, max: 20 },
  { key: 'tagline', label: 'Tagline', max: 200 },
  { key: 'metaDescription', label: 'Meta description', max: 300 },
  { key: 'logoMediaId', label: 'Logo', type: 'fk' },
  { key: 'phoneDisplay', label: 'Phone (display)', max: 30 },
  { key: 'phoneDial', label: 'Phone (dial)', max: 20 },
  { key: 'whatsappNumber', label: 'WhatsApp number', max: 20 },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'address', label: 'Address', max: 300 },
  { key: 'city', label: 'City', max: 100 },
  { key: 'workingHours', label: 'Working hours', max: 150 },
  { key: 'mapEmbedUrl', label: 'Google Maps embed URL', max: 1000 },
  { key: 'footerAbout', label: 'Footer text', type: 'text', max: 1000 },
]

const SELECT = `
  SELECT s.*, m.url AS logo_url
  FROM site_settings s LEFT JOIN media m ON m.id = s.logo_media_id
  WHERE s.id = 1`

router.get('/', async (_req, res) => {
  const { rows } = await query(SELECT)
  if (!rows[0]) throw notFound('Settings not found. Run 02_seed_data.sql.')
  res.json({ data: camelRow(rows[0]) })
})

router.put('/', async (req, res) => {
  const values = validateBody(fields, req.body, { partial: true })
  if (values.phone_dial && !/^\+?\d{6,15}$/.test(values.phone_dial)) {
    throw badRequest('Please check the highlighted fields.', { phoneDial: 'Use digits only, e.g. +919876543210.' })
  }
  if (values.whatsapp_number && !/^\d{8,15}$/.test(values.whatsapp_number)) {
    throw badRequest('Please check the highlighted fields.', {
      whatsappNumber: 'Use digits with country code and no +, e.g. 919876543210.',
    })
  }
  if (values.map_embed_url && !/^https:\/\/(www\.)?google\.[a-z.]+\/maps\/embed/.test(values.map_embed_url)) {
    throw badRequest('Please check the highlighted fields.', {
      mapEmbedUrl: 'Paste the "Embed a map" link from Google Maps (https://www.google.com/maps/embed?...).',
    })
  }
  const columns = Object.keys(values)
  if (!columns.length) throw badRequest('Nothing to update.')
  const sets = columns.map((c, i) => `${c} = $${i + 1}`)
  await query(`UPDATE site_settings SET ${sets.join(', ')} WHERE id = 1`, Object.values(values))
  const { rows } = await query(SELECT)
  res.json({ data: camelRow(rows[0]), message: 'Settings saved.' })
})

export default router
