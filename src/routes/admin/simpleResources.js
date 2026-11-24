import { crudRouter } from '../../utils/crudRouter.js'

/* Field definitions for tables that only need standard CRUD.
   Keys are camelCase in the API and map to snake_case columns. */

const sortAndActive = [
  { key: 'sortOrder', type: 'int', min: 0 },
  { key: 'isActive', type: 'bool', default: true },
]

export const socialLinks = crudRouter({
  table: 'social_links',
  label: 'Social link',
  allowCreate: false,
  allowDelete: false,
  fields: [{ key: 'url', label: 'URL', type: 'link', max: 500 }, ...sortAndActive],
})

export const navMenus = crudRouter({
  table: 'nav_menus',
  label: 'Menu',
  fields: [
    { key: 'code', label: 'Code', required: true, max: 50 },
    { key: 'title', label: 'Title', required: true, max: 100 },
    { key: 'sortOrder', type: 'int', min: 0 },
  ],
})

export const navItems = crudRouter({
  table: 'nav_items',
  label: 'Menu link',
  parent: { param: 'menuId', column: 'menu_id' },
  fields: [
    { key: 'menuId', label: 'Menu', type: 'fk', required: true },
    { key: 'label', label: 'Label', required: true, max: 100 },
    { key: 'url', label: 'Link', type: 'link', required: true, max: 300 },
    ...sortAndActive,
  ],
})

export const sectionItems = crudRouter({
  table: 'section_items',
  label: 'Section item',
  parent: { param: 'sectionId', column: 'section_id' },
  fields: [
    { key: 'sectionId', label: 'Section', type: 'fk', required: true },
    { key: 'iconKey', label: 'Icon', max: 50 },
    { key: 'title', label: 'Title', max: 200 },
    { key: 'text', label: 'Text', type: 'text', max: 2000 },
    { key: 'value', label: 'Value', max: 50 },
    { key: 'badge', label: 'Badge', max: 50 },
    { key: 'isFeatured', type: 'bool', default: false },
    ...sortAndActive,
  ],
})

export const serviceCategories = crudRouter({
  table: 'service_categories',
  label: 'Service category',
  fields: [
    { key: 'slug', label: 'Slug', required: true, max: 60 },
    { key: 'label', label: 'Label', required: true, max: 100 },
    ...sortAndActive,
  ],
})

export const careDurations = crudRouter({
  table: 'care_durations',
  label: 'Care duration',
  fields: [
    { key: 'code', label: 'Code', required: true, max: 40 },
    { key: 'label', label: 'Label', required: true, max: 100 },
    { key: 'description', label: 'Description', max: 300 },
    { key: 'iconKey', label: 'Icon', max: 50, default: 'clock' },
    ...sortAndActive,
  ],
})

export const faqCategories = crudRouter({
  table: 'faq_categories',
  label: 'FAQ category',
  fields: [
    { key: 'slug', label: 'Slug', required: true, max: 60 },
    { key: 'label', label: 'Label', required: true, max: 100 },
    { key: 'sortOrder', type: 'int', min: 0 },
  ],
})

export const faqs = crudRouter({
  table: 'faqs',
  label: 'FAQ',
  parent: { param: 'categoryId', column: 'category_id' },
  fields: [
    { key: 'categoryId', label: 'Category', type: 'fk' },
    { key: 'question', label: 'Question', required: true, max: 300 },
    { key: 'answer', label: 'Answer', type: 'text', required: true, max: 5000 },
    ...sortAndActive,
  ],
})

export const testimonials = crudRouter({
  table: 'testimonials',
  label: 'Testimonial',
  fields: [
    { key: 'customerName', label: 'Customer name', required: true, max: 100 },
    { key: 'relation', label: 'Relation', max: 60 },
    { key: 'rating', label: 'Rating', type: 'int', min: 1, maxValue: 5, default: 5 },
    { key: 'feedback', label: 'Feedback', type: 'text', required: true, max: 3000 },
    { key: 'serviceId', label: 'Service', type: 'fk' },
    { key: 'isSample', type: 'bool', default: false },
    ...sortAndActive,
  ],
})

export const enquiryStatuses = crudRouter({
  table: 'enquiry_statuses',
  label: 'Enquiry status',
  fields: [
    { key: 'code', label: 'Code', required: true, max: 30 },
    { key: 'label', label: 'Label', required: true, max: 60 },
    { key: 'sortOrder', type: 'int', min: 0 },
  ],
})
