import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import * as simple from './simpleResources.js'
import adminsRoutes from './admins.routes.js'
import customersRoutes from './customers.routes.js'
import dashboardRoutes from './dashboard.routes.js'
import enquiriesRoutes from './enquiries.routes.js'
import legalRoutes from './legal.routes.js'
import mediaRoutes from './media.routes.js'
import sectionsRoutes from './sections.routes.js'
import servicesRoutes from './services.routes.js'
import settingsRoutes from './settings.routes.js'
import teamRoutes from './team.routes.js'

/** Everything under /api/admin requires a valid JWT. */
const router = Router()
router.use(requireAuth)

router.use('/', dashboardRoutes) // /dashboard, /meta/icons

router.use('/settings', settingsRoutes)
router.use('/social-links', simple.socialLinks)
router.use('/nav-menus', simple.navMenus)
router.use('/nav-items', simple.navItems)
router.use('/media', mediaRoutes)

router.use('/sections', sectionsRoutes)
router.use('/section-items', simple.sectionItems)

router.use('/service-categories', simple.serviceCategories)
router.use('/services', servicesRoutes)
router.use('/care-durations', simple.careDurations)

router.use('/faq-categories', simple.faqCategories)
router.use('/faqs', simple.faqs)
router.use('/testimonials', simple.testimonials)
router.use('/team-members', teamRoutes)
router.use('/legal-pages', legalRoutes)

router.use('/enquiries', enquiriesRoutes)
router.use('/enquiry-statuses', simple.enquiryStatuses)
router.use('/customers', customersRoutes)

router.use('/admins', adminsRoutes)

export default router
