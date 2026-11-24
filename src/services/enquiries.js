import { withTransaction } from '../db/pool.js'
import { badRequest } from '../utils/httpError.js'
import { validateBody } from '../utils/validate.js'

const today = () => new Date().toISOString().slice(0, 10)

/** Normalise Indian mobile numbers to 10 digits; returns null if invalid. */
export function normaliseMobile(value) {
  // Strip +91 / 91 / 0 only when followed by exactly 10 digits, so numbers that
  // themselves start with 91 (e.g. 9123456780) are not cut short.
  const digits = String(value || '').replace(/[\s()-]/g, '').replace(/^(\+91|91|0)(?=\d{10}$)/, '')
  return /^[6-9]\d{9}$/.test(digits) ? digits : null
}

/**
 * Accepts the website's enquiry payload (see buildEnquiryPayload in the
 * website's services/enquiryService.js), validates it server-side and
 * stores it. Booking-form enquiries additionally require service details.
 */
export async function createEnquiry(payload, source) {
  if (!payload || typeof payload !== 'object') throw badRequest('Invalid enquiry.')
  const contact = payload.contact || {}
  const patient = payload.patient || {}
  const care = payload.care || {}
  const location = payload.location || {}
  const strict = source === 'booking-form' || source === 'contact-form'

  const v = validateBody(
    [
      { key: 'fullName', label: 'Full Name', required: true, min: 2, max: 100 },
      { key: 'email', label: 'Email Address', type: 'email' },
      { key: 'patientName', label: 'Patient Name', required: true, min: 2, max: 100 },
      { key: 'patientAge', label: 'Patient Age', type: 'int', required: strict, min: 0, maxValue: 120 },
      { key: 'patientCondition', label: 'Patient Condition', type: 'text', max: 1000 },
      { key: 'serviceSlug', label: 'Required Service', required: true, max: 120 },
      { key: 'duration', label: 'Care Duration', required: true, max: 40 },
      { key: 'preferredStartDate', label: 'Preferred Start Date', type: 'date', required: true },
      { key: 'city', label: 'City', required: true, min: 2, max: 100 },
      { key: 'address', label: 'Full Address', required: true, min: 8, max: 500 },
      { key: 'notes', label: 'Additional Requirements', type: 'text', max: 2000 },
    ],
    {
      fullName: contact.fullName,
      email: contact.email,
      patientName: patient.name,
      patientAge: patient.age,
      patientCondition: patient.condition,
      serviceSlug: care.serviceSlug,
      duration: care.duration,
      preferredStartDate: care.preferredStartDate,
      city: location.city,
      address: location.address,
      notes: payload.notes,
    },
  )

  const mobile = normaliseMobile(contact.mobile)
  if (!mobile) throw badRequest('Please check the highlighted fields.', { mobile: 'Please enter a valid 10-digit mobile number.' })
  if (v.preferred_start_date < today()) {
    throw badRequest('Please check the highlighted fields.', { preferredStartDate: 'Please choose today or a future date.' })
  }

  return withTransaction(async (client) => {
    const [{ rows: svc }, { rows: dur }, { rows: status }] = await Promise.all([
      client.query('SELECT id FROM services WHERE slug = $1 AND is_active', [v.service_slug]),
      client.query('SELECT id FROM care_durations WHERE code = $1 AND is_active', [v.duration]),
      client.query("SELECT id FROM enquiry_statuses WHERE code = 'new'"),
    ])
    if (!svc[0]) throw badRequest('Please check the highlighted fields.', { service: 'Please choose a valid service.' })
    if (!dur[0]) throw badRequest('Please check the highlighted fields.', { careDuration: 'Please choose a valid care duration.' })
    if (!status[0]) throw new Error('Enquiry status "new" is missing. Run 02_seed_data.sql.')

    // One customer per mobile number; keep their latest name/email.
    const { rows: customer } = await client.query(
      `INSERT INTO customers (full_name, mobile, email) VALUES ($1, $2, $3)
       ON CONFLICT (mobile) DO UPDATE
         SET full_name = EXCLUDED.full_name,
             email = COALESCE(NULLIF(EXCLUDED.email, ''), customers.email)
       RETURNING id`,
      [v.full_name, mobile, v.email],
    )

    const { rows } = await client.query(
      `INSERT INTO enquiries (customer_id, source, service_id, care_duration_id, status_id, patient_name,
                              patient_age, patient_condition, preferred_start_date, city, address, requirements)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id, created_at`,
      [
        customer[0].id,
        source,
        svc[0].id,
        dur[0].id,
        status[0].id,
        v.patient_name,
        v.patient_age,
        v.patient_condition,
        v.preferred_start_date,
        v.city,
        v.address,
        v.notes,
      ],
    )
    return { id: rows[0].id, createdAt: rows[0].created_at }
  })
}
