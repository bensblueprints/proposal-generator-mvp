// Starter proposal templates. Each creates a proposal pre-filled with blocks
// and line items the user then edits — nothing here is locked in.
const TEMPLATES = [
  {
    id: 'web-design',
    name: 'Website Design & Build',
    description: 'Fixed-scope website project with optional care plan add-on.',
    title: 'Website Design & Development Proposal',
    blocks: [
      { type: 'cover', content: { heading: 'Website Design & Development', subheading: 'A modern, fast website that turns visitors into customers.' } },
      { type: 'text', content: { heading: 'The problem', body: 'Your current site is slow, dated, and invisible on Google. Every week it stays live costs you leads you never see.' } },
      { type: 'text', content: { heading: 'Our approach', body: '1. Discovery workshop and sitemap\n2. Design mockups (2 revision rounds)\n3. Build, content migration, QA on real devices\n4. Launch + 30 days of post-launch support' } },
      { type: 'pricing', content: { heading: 'Investment' } },
      { type: 'testimonial', content: { quote: 'They rebuilt our site in three weeks and inbound leads doubled the next month.', attribution: 'Dana R., Meridian Physio' } },
      { type: 'terms', content: { heading: 'Terms', body: '50% deposit to book, 50% on launch. Two revision rounds included per design phase. Quote valid 30 days.' } }
    ],
    items: [
      { name: 'Design & development (5 pages)', qty: 1, price: 4800, optional: 0 },
      { name: 'Copywriting', qty: 5, price: 180, optional: 1, selected_default: 1 },
      { name: 'Monthly care plan (12 months)', qty: 12, price: 95, optional: 1, selected_default: 0 }
    ]
  },
  {
    id: 'marketing-retainer',
    name: 'Marketing Retainer',
    description: 'Monthly retainer with tiered optional channels.',
    title: 'Marketing Retainer Proposal',
    blocks: [
      { type: 'cover', content: { heading: 'Growth Marketing Retainer', subheading: 'Consistent pipeline, reported monthly, cancel anytime.' } },
      { type: 'text', content: { heading: 'What you get every month', body: '- Strategy call and 90-day roadmap review\n- Campaign builds and landing pages\n- Monthly performance report in plain English' } },
      { type: 'pricing', content: { heading: 'Monthly investment' } },
      { type: 'terms', content: { heading: 'Terms', body: 'Month-to-month, 30-day notice to cancel. Ad spend billed directly to your accounts.' } }
    ],
    items: [
      { name: 'Core retainer (strategy + execution)', qty: 1, price: 2500, optional: 0 },
      { name: 'Paid ads management', qty: 1, price: 900, optional: 1, selected_default: 1 },
      { name: 'SEO content (4 articles/mo)', qty: 1, price: 1200, optional: 1, selected_default: 0 }
    ]
  },
  {
    id: 'consulting',
    name: 'Consulting Engagement',
    description: 'Fixed-fee advisory project, phased.',
    title: 'Consulting Engagement Proposal',
    blocks: [
      { type: 'cover', content: { heading: 'Consulting Engagement', subheading: 'Clear findings, a concrete plan, and support to execute it.' } },
      { type: 'text', content: { heading: 'Scope', body: 'Phase 1 — Audit: interviews, systems review, findings report.\nPhase 2 — Roadmap: prioritized plan with owners and timelines.\nPhase 3 (optional) — Implementation support.' } },
      { type: 'pricing', content: { heading: 'Fees' } },
      { type: 'terms', content: { heading: 'Terms', body: 'Phases 1-2 invoiced on kickoff. Phase 3 invoiced monthly. Expenses billed at cost with prior approval.' } }
    ],
    items: [
      { name: 'Phase 1 — Audit & findings', qty: 1, price: 3500, optional: 0 },
      { name: 'Phase 2 — Roadmap', qty: 1, price: 2000, optional: 0 },
      { name: 'Phase 3 — Implementation support (4 weeks)', qty: 1, price: 4000, optional: 1, selected_default: 0 }
    ]
  },
  {
    id: 'video-production',
    name: 'Video Production',
    description: 'Brand video package with optional extra deliverables.',
    title: 'Video Production Proposal',
    blocks: [
      { type: 'cover', content: { heading: 'Brand Video Production', subheading: 'One shoot day. A hero film plus a month of social cutdowns.' } },
      { type: 'text', content: { heading: 'Deliverables', body: '- 1x 90-second hero brand film (4K)\n- Full pre-production: script, shot list, location scout\n- Licensed music and color grade' } },
      { type: 'pricing', content: { heading: 'Package pricing' } },
      { type: 'terms', content: { heading: 'Terms', body: '50% to book the shoot date. Two revision rounds on the edit. Raw footage available as an add-on.' } }
    ],
    items: [
      { name: 'Hero film package (shoot + edit)', qty: 1, price: 6500, optional: 0 },
      { name: 'Social cutdowns (8x vertical)', qty: 1, price: 1400, optional: 1, selected_default: 1 },
      { name: 'Raw footage delivery', qty: 1, price: 500, optional: 1, selected_default: 0 }
    ]
  },
  {
    id: 'freelance-dev',
    name: 'Freelance Development',
    description: 'Hourly/sprint software work with clear milestones.',
    title: 'Software Development Proposal',
    blocks: [
      { type: 'cover', content: { heading: 'Software Development Proposal', subheading: 'Senior hands on your codebase, shipped in weekly increments.' } },
      { type: 'text', content: { heading: 'How we work', body: 'Weekly sprints with a demo every Friday. You see working software every week, not a big reveal at the end. Code delivered to your repo with tests.' } },
      { type: 'pricing', content: { heading: 'Estimate' } },
      { type: 'terms', content: { heading: 'Terms', body: 'Estimate based on discovery so far; re-scoped together if requirements change. Invoiced per sprint, net 14.' } }
    ],
    items: [
      { name: 'Sprint 1 — Core feature build', qty: 1, price: 3200, optional: 0 },
      { name: 'Sprint 2 — Integrations & polish', qty: 1, price: 3200, optional: 0 },
      { name: 'Sprint 3 — Nice-to-haves backlog', qty: 1, price: 3200, optional: 1, selected_default: 0 }
    ]
  },
  {
    id: 'blank',
    name: 'Blank proposal',
    description: 'Start from scratch — a cover, one text block, and a pricing table.',
    title: 'New Proposal',
    blocks: [
      { type: 'cover', content: { heading: 'Proposal title', subheading: 'One line on the outcome you deliver.' } },
      { type: 'text', content: { heading: 'Overview', body: 'Describe the problem, your approach, and what the client gets.' } },
      { type: 'pricing', content: { heading: 'Pricing' } }
    ],
    items: [
      { name: 'Line item', qty: 1, price: 1000, optional: 0 }
    ]
  }
];

module.exports = { TEMPLATES };
