import { Router } from 'express'
import { query } from '../../db/pool.js'
import { camelRow } from '../../utils/validate.js'
import { ICONS } from '../../utils/icons.js'

const router = Router()

/** GET /api/admin/dashboard → counts and recent enquiries */
router.get('/dashboard', async (_req, res) => {
  const [{ rows: totals }, { rows: byStatus }, { rows: recent }] = await Promise.all([
    query(`
      SELECT
        (SELECT COUNT(*) FROM enquiries)::int AS total_enquiries,
        (SELECT COUNT(*) FROM enquiries WHERE created_at >= CURRENT_DATE)::int AS enquiries_today,
        (SELECT COUNT(*) FROM enquiries WHERE created_at >= CURRENT_DATE - INTERVAL '6 days')::int AS enquiries_last_7_days,
        (SELECT COUNT(*) FROM customers)::int AS total_customers,
        (SELECT COUNT(*) FROM services WHERE is_active)::int AS active_services,
        (SELECT COUNT(*) FROM faqs WHERE is_active)::int AS active_faqs,
        (SELECT COUNT(*) FROM testimonials WHERE is_active)::int AS active_testimonials`),
    query(`
      SELECT st.code, st.label, COUNT(e.id)::int AS count
      FROM enquiry_statuses st LEFT JOIN enquiries e ON e.status_id = st.id
      GROUP BY st.id ORDER BY st.sort_order`),
    query(`
      SELECT e.id, e.source, e.patient_name, e.created_at, c.full_name AS customer_name, c.mobile AS customer_mobile,
             s.title AS service_title, st.code AS status_code, st.label AS status_label
      FROM enquiries e
      JOIN customers c ON c.id = e.customer_id
      JOIN enquiry_statuses st ON st.id = e.status_id
      LEFT JOIN services s ON s.id = e.service_id
      ORDER BY e.created_at DESC LIMIT 5`),
  ])
  res.json({
    data: {
      totals: camelRow(totals[0]),
      enquiriesByStatus: byStatus.map(camelRow),
      recentEnquiries: recent.map(camelRow),
    },
  })
})

/** GET /api/admin/meta/icons → icon keys the website understands */
router.get('/meta/icons', (_req, res) => {
  res.json({ data: ICONS })
})

export default router
