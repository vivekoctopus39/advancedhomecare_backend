import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { getBootstrap } from '../services/publicContent.js'
import { createEnquiry } from '../services/enquiries.js'

const router = Router()

// Protect the public forms from spam / abuse.
const enquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many enquiries from this device. Please try again later or call us.' },
})

/** Everything the website renders: settings, menus, sections, services, FAQs, … */
router.get('/bootstrap', async (_req, res) => {
  const data = await getBootstrap()
  res.set('Cache-Control', 'no-cache')
  res.json({ data })
})

router.post('/enquiries', enquiryLimiter, async (req, res) => {
  const result = await createEnquiry(req.body, 'contact-form')
  res.status(201).json({ data: result, message: 'Enquiry received.' })
})

router.post('/booking-enquiries', enquiryLimiter, async (req, res) => {
  const result = await createEnquiry(req.body, 'booking-form')
  res.status(201).json({ data: result, message: 'Booking enquiry received.' })
})

export default router
