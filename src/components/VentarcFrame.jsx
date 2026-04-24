import React from 'react';
import { Link } from 'react-router-dom';
import VentarcSceneBackground from './VentarcSceneBackground';

const PAGE_COPY = {
  home: {
    eyebrow: 'For Clubs & Organizations',
    title: ['Run Events.', 'Without the Chaos.'],
    description:
      'Create an event, paste participant CSV, save a certificate template, generate certificates, email them to recipients, publish a student download page, and verify every certificate from one repo.',
    primary: { label: 'Create Event', to: '/dashboard' },
    secondary: { label: 'See Features', to: '/features' },
    panelLabel: 'Current Workflow',
    panelTitle: 'Event Launch',
    panelRows: [
      ['Event setup', 'Dashboard'],
      ['Participant import', 'CSV'],
      ['Template save', 'Per event'],
      ['Certificate output', 'Generate'],
      ['Verification', '/verify'],
    ],
    heroStats: [
      { label: 'Core Flows', value: '05' },
      { label: 'Delivery', value: 'Email' },
      { label: 'Public Route', value: 'Live' },
    ],
    highlights: [
      { label: 'Event Setup', value: 'Live', detail: 'Create events and assign public download slugs' },
      { label: 'Participant Import', value: 'CSV', detail: 'Paste participant rows directly into the dashboard' },
      { label: 'Certificates', value: 'Generate', detail: 'Create certificates and attach public verification IDs' },
      { label: 'Delivery', value: 'Email + Page', detail: 'Send by email and expose a public student download page' },
    ],
    cards: [
      {
        eyebrow: 'Intake',
        title: 'CSV Participant Intake',
        body: 'Paste participant rows as `name,email,category` and validate them before generation. The dashboard persists the CSV against the selected event.',
      },
      {
        eyebrow: 'Generation',
        title: 'Template to Certificate',
        body: 'Upload a template image, position the recipient name and verify line, then generate certificates and PDFs for the event in one run.',
      },
      {
        eyebrow: 'Public Access',
        title: 'Download and Verify',
        body: 'Every generated certificate gets a public verification path, and each event can expose a student download page using its own slug.',
      },
    ],
    rail: [
      'Create event',
      'Paste participant CSV',
      'Save certificate template',
      'Generate certificates',
      'Send and verify',
    ],
    ctaTitle: 'Ready to deploy your next event?',
    ctaBody: 'The current build already supports the full certificate workflow and a separate Ultron QR check-in route.',
    ctaPrimary: { label: 'Initiate Sequence', to: '/dashboard' },
    ctaSecondary: { label: 'Open Check-in', to: '/ultron/checkin' },
  },
  features: {
    eyebrow: 'Operational Modules',
    title: ['One Platform.', 'Real Working Steps.'],
    description:
      'The current product surface is concrete: event setup, participant CSV import, template storage, certificate generation, email delivery, public download pages, certificate verification, and a separate QR check-in flow.',
    primary: { label: 'Start Deployment', to: '/dashboard' },
    secondary: { label: 'Open Verify', to: '/verify' },
    panelLabel: 'Module Map',
    panelTitle: 'Flow Matrix',
    panelRows: [
      ['Event setup', 'Slug + date'],
      ['Participants', 'CSV'],
      ['Template', 'Saved'],
      ['Issuance', 'Generate'],
      ['Delivery', 'Email + verify'],
    ],
    heroStats: [
      { label: 'Modules', value: '05' },
      { label: 'Delivery', value: 'Email' },
      { label: 'Verification', value: 'Live' },
    ],
    highlights: [
      { label: 'CSV Import', value: 'Structured', detail: 'Rows are validated before generation' },
      { label: 'Template Save', value: 'Per event', detail: 'Template image and text settings are persisted' },
      { label: 'Public Page', value: 'Slug-based', detail: 'Each event can expose its own student download page' },
      { label: 'QR Check-in', value: 'Separate route', detail: 'Ultron scanner lives at /ultron/checkin' },
    ],
    cards: [
      {
        eyebrow: 'Module 01',
        title: 'Event and Participant Setup',
        body: 'Create an event, assign a public slug, then paste participant rows directly into the dashboard before moving on to template and generation.',
      },
      {
        eyebrow: 'Module 02',
        title: 'Generation and Delivery',
        body: 'Generate certificates and PDFs, configure a Gmail sender, then send unsent certificates only to recipients with valid email addresses.',
      },
      {
        eyebrow: 'Module 03',
        title: 'Public Access and Verification',
        body: 'Recipients can find certificates through the event slug page, while organizers and third parties can verify a certificate directly through `/certvault/verify?id=...`.',
      },
    ],
    rail: [
      'Create event',
      'Save slug',
      'Paste CSV',
      'Generate',
      'Send + verify',
    ],
    ctaTitle: 'Everything needed to run the current certificate workflow',
    ctaBody: 'The generated certificates, public download page, verify route, and sender config are all already wired in this codebase.',
    ctaPrimary: { label: 'Create Event', to: '/dashboard' },
    ctaSecondary: { label: 'Open Check-in', to: '/ultron/checkin' },
  },
  solutions: {
    eyebrow: 'Real Workflows',
    title: ['Three Flows.', 'One Codebase.'],
    description:
      'The repo currently exposes three concrete organizer flows: certificate operations in the dashboard, public certificate verification, and Ultron QR check-in.',
    primary: { label: 'Open Dashboard', to: '/dashboard' },
    secondary: { label: 'Open Check-in', to: '/ultron/checkin' },
    panelLabel: 'Workflow Matrix',
    panelTitle: 'Live Routes',
    panelRows: [
      ['Dashboard', '/dashboard'],
      ['Verification', '/verify'],
      ['Student download', '/:eventSlug'],
      ['QR check-in', '/ultron/checkin'],
      ['Team portal', '/ultron/team'],
    ],
    heroStats: [
      { label: 'Flows', value: '03' },
      { label: 'Public Routes', value: '02+' },
      { label: 'Check-in', value: 'Live' },
    ],
    highlights: [
      { label: 'Dashboard Flow', value: 'Create to send', detail: 'Event creation through certificate email delivery' },
      { label: 'Verify Flow', value: 'Public', detail: 'Lookup by certificate ID through the verify route' },
      { label: 'Download Flow', value: 'Slug-based', detail: 'Recipients can match certificates on the event page' },
      { label: 'Ultron Flow', value: 'QR entry', detail: 'Browser QR scanner for event check-in' },
    ],
    cards: [
      {
        eyebrow: 'Flow 01',
        title: 'Certificate Operations',
        body: 'Use the dashboard to create an event, paste participant CSV, save the template, generate certificates, configure the sender, and send them.',
      },
      {
        eyebrow: 'Flow 02',
        title: 'Public Verification',
        body: 'Use the verify route to validate certificate IDs and expose a public per-event slug page so recipients can find their certificates by name or email.',
      },
      {
        eyebrow: 'Flow 03',
        title: 'Ultron QR Check-in',
        body: 'Use the separate Ultron route when you need QR-based entry operations. It resolves QR payloads and processes check-in through the API.',
      },
    ],
    rail: [
      'Dashboard',
      'Public download page',
      'Verify route',
      'QR scanner',
      'Team portal',
    ],
    ctaTitle: 'Use the workflow you actually need',
    ctaBody: 'The dashboard, verify route, public download slug, and Ultron check-in are already live in this project.',
    ctaPrimary: { label: 'Start in Dashboard', to: '/dashboard' },
    ctaSecondary: { label: 'Verify a Certificate', to: '/verify' },
  },
  pricing: {
    eyebrow: 'Current Access',
    title: ['Public Pricing', 'Is Not Listed In-App.'],
    description:
      'This repository exposes working product routes, but it does not expose a live billing system or a public pricing API. The truthful view is scope and access, not fabricated dollar tiers.',
    primary: { label: 'Open Dashboard', to: '/dashboard' },
    secondary: { label: 'Read Features', to: '/features' },
    panelLabel: 'Current Scope',
    panelTitle: 'Access Map',
    panelRows: [
      ['Dashboard flow', 'Available'],
      ['Verify route', 'Available'],
      ['Ultron check-in', 'Available'],
      ['Billing engine', 'Not present'],
      ['Public pricing', 'Not listed'],
    ],
    heroStats: [
      { label: 'Dashboard', value: 'Live' },
      { label: 'Verify', value: 'Live' },
      { label: 'Billing', value: 'None' },
    ],
    highlights: [
      { label: 'Truthful State', value: 'No fake tiers', detail: 'The app does not currently surface public prices' },
      { label: 'Dashboard', value: 'Ready', detail: 'Event setup, CSV import, generation, and send flow exist now' },
      { label: 'Verification', value: 'Ready', detail: 'Certificate lookup is public and route-backed' },
      { label: 'Ultron', value: 'Separate', detail: 'QR check-in is shipped as its own route and API surface' },
    ],
    tiers: [
      {
        label: 'Current Build',
        title: 'Dashboard',
        price: 'Live',
        cadence: '',
        body: 'The event dashboard is already wired for event creation, slugs, participant CSV, template save, generation, and email sending.',
        bullets: ['Create events', 'Paste participant CSV', 'Generate certificates and PDFs'],
      },
      {
        label: 'Public Routes',
        title: 'Verification',
        price: 'Live',
        cadence: '',
        body: 'Recipients and third parties can use the slug page and the verify route without any fake pricing layer in the middle.',
        bullets: ['Public event slug pages', 'Certificate verify route', 'Public certificate matching'],
        featured: true,
      },
      {
        label: 'Separate Flow',
        title: 'Ultron',
        price: 'Live',
        cadence: '',
        body: 'Ultron handles QR-based check-in and team operations as a separate route set in the same codebase.',
        bullets: ['QR scanner route', 'Team route', 'Check-in API flow'],
      },
    ],
    specs: [
      ['Dashboard Route', '/dashboard'],
      ['Verify Route', '/verify'],
      ['Public Download', '/:eventSlug'],
      ['QR Check-in Route', '/ultron/checkin'],
    ],
    ctaTitle: 'Use the working routes instead of placeholder pricing',
    ctaBody: 'If you need the product today, the dashboard, verify route, and check-in flow are the real entry points in this repository.',
    ctaPrimary: { label: 'Open Dashboard', to: '/dashboard' },
    ctaSecondary: { label: 'Open Check-in', to: '/ultron/checkin' },
  },
  resources: {
    eyebrow: 'Reference Layer',
    title: ['Resources.', 'Mapped To Real Routes.'],
    description:
      'This page now reflects the actual operator surface in the app: dashboard setup, public download pages, verification, sender config, generation, and Ultron QR check-in.',
    primary: { label: 'Open Dashboard', to: '/dashboard' },
    secondary: { label: 'Open Verify', to: '/verify' },
    panelLabel: 'Reference Queue',
    panelTitle: 'Route Guide',
    panelRows: [
      ['Event setup', '/dashboard'],
      ['Verify route', '/verify'],
      ['Download page', '/:eventSlug'],
      ['QR check-in', '/ultron/checkin'],
      ['Team portal', '/ultron/team'],
    ],
    heroStats: [
      { label: 'Routes', value: '05' },
      { label: 'Public', value: '02+' },
      { label: 'Reference', value: 'Live' },
    ],
    highlights: [
      { label: 'Dashboard', value: 'How-to', detail: 'Event creation, CSV paste, template save, generation, and sending' },
      { label: 'Verification', value: 'Public', detail: 'Certificate validation by ID through the verify route' },
      { label: 'Download Pages', value: 'Slug-based', detail: 'Recipients can match certificates on the event route' },
      { label: 'Ultron', value: 'Ops route', detail: 'QR check-in and team operations live separately' },
    ],
    articles: [
      {
        category: 'Dashboard',
        title: 'Create Events And Slugs',
        body: 'Use the dashboard to create an event, set the event date, and assign the public slug recipients will use later.',
      },
      {
        category: 'Participants',
        title: 'Paste CSV And Validate Rows',
        body: 'Participant input is currently email-first and CSV-based, with invalid rows blocked before certificate generation starts.',
      },
      {
        category: 'Template',
        title: 'Save Template Per Event',
        body: 'Template image and text settings are stored against the selected event so generation and later sends stay aligned.',
      },
      {
        category: 'Generation',
        title: 'Generate Certificates And PDFs',
        body: 'Generation creates certificate IDs and PDFs for valid participant rows once the template is ready.',
      },
      {
        category: 'Delivery',
        title: 'Send Through Gmail Sender Config',
        body: 'The send step is wired to Gmail sender credentials and sends only certificates that are valid, ready, and still unsent.',
      },
      {
        category: 'Ultron',
        title: 'Run QR Check-in Separately',
        body: 'Ultron QR check-in is available through its own route and API flow, rather than being fused into the certificate dashboard.',
      },
    ],
    ctaTitle: 'Use the real routes as your documentation surface',
    ctaBody: 'The dashboard, verify route, slug page, and Ultron routes are the working product references in this codebase right now.',
    ctaPrimary: { label: 'Create Event', to: '/dashboard' },
    ctaSecondary: { label: 'Open Check-in', to: '/ultron/checkin' },
  },
};

const FOOTER_LINKS = [
  { label: 'Features', to: '/features' },
  { label: 'Solutions', to: '/solutions' },
  { label: 'Pricing', to: '/pricing' },
  { label: 'Resources', to: '/resources' },
];

function ActionLink({ action, primary }) {
  const className = primary
    ? 'ventarc-btn-primary'
    : 'ventarc-btn-secondary';

  return (
    <Link to={action.to} className={className}>
      {action.label}
    </Link>
  );
}

function HeroPanel({ data }) {
  return (
    <div className="ventarc-panel relative w-full max-w-[520px] min-w-0 justify-self-end self-start overflow-hidden p-5 md:p-6 xl:max-w-[560px]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#8fb8ff] to-transparent opacity-50" />
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 text-[11px] uppercase tracking-[0.28em] text-[#8aa9d2]" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
            {data.panelLabel}
          </div>
          <div className="text-[clamp(2rem,3.2vw,2.8rem)] font-bold leading-none tracking-tight text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            {data.panelTitle}
          </div>
        </div>
        <div className="h-10 w-10 shrink-0 rounded-full border border-[#8fb8ff]/30 bg-[#0b1320]/80 shadow-[0_0_40px_rgba(92,160,255,0.15)] md:h-12 md:w-12" />
      </div>

      <div className="space-y-3 min-w-0">
        {data.panelRows.map(([label, value]) => (
          <div key={label} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-5 rounded-sm border border-white/[0.06] bg-white/[0.03] px-4 py-3.5 md:px-5 md:py-4">
            <span className="min-w-0 text-[1rem] text-[#c7d4e5] whitespace-nowrap">{label}</span>
            <span
              className="shrink-0 whitespace-nowrap text-right text-[10px] uppercase tracking-[0.18em] text-[#8fb8ff] md:text-[11px] md:tracking-[0.2em]"
              style={{ fontFamily: 'IBM Plex Mono, monospace' }}
            >
              {value}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)_minmax(0,1fr)] gap-3">
        {data.heroStats.map((stat) => (
          <div key={stat.label} className="min-w-0 rounded-sm border border-white/[0.06] bg-[#07101b]/80 px-4 py-4 md:px-5 md:py-5">
            <div className="mb-2 text-[10px] uppercase tracking-[0.22em] text-[#7994b8]" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
              {stat.label}
            </div>
            <div className="min-w-0 whitespace-nowrap text-[clamp(0.95rem,1.3vw,1.45rem)] font-bold leading-[1.1] tracking-tight text-white">
              {stat.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StandardCards({ cards }) {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {cards.map((card) => (
        <article key={card.title} className="ventarc-panel p-6 md:p-7">
          <div className="mb-4 text-[11px] uppercase tracking-[0.26em] text-[#8aa9d2]" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
            {card.eyebrow}
          </div>
          <h3 className="mb-4 text-2xl font-bold tracking-tight text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            {card.title}
          </h3>
          <p className="text-[15px] leading-7 text-[#bcc8da]">{card.body}</p>
        </article>
      ))}
    </div>
  );
}

function PricingGrid({ tiers, specs }) {
  return (
    <>
      <div className="grid gap-6 lg:grid-cols-3">
        {tiers.map((tier) => (
          <article
            key={tier.title}
            className={`ventarc-panel p-7 ${tier.featured ? 'ring-1 ring-[#8fb8ff]/30 shadow-[0_30px_90px_-38px_rgba(92,160,255,0.55)]' : ''}`}
          >
            <div className="mb-3 text-[11px] uppercase tracking-[0.26em] text-[#8aa9d2]" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
              {tier.label}
            </div>
            <h3 className="mb-3 text-3xl font-bold tracking-tight text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              {tier.title}
            </h3>
            <div className="mb-6 flex items-end gap-2">
              <span className="text-5xl font-black tracking-tight text-[#dce8ff]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                {tier.price}
              </span>
              {tier.cadence ? (
                <span className="pb-2 text-[11px] uppercase tracking-[0.22em] text-[#89a3c6]" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                  {tier.cadence}
                </span>
              ) : null}
            </div>
            <p className="mb-6 text-[15px] leading-7 text-[#bcc8da]">{tier.body}</p>
            <div className="space-y-3">
              {tier.bullets.map((bullet) => (
                <div key={bullet} className="rounded-sm border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm text-[#d2deed]">
                  {bullet}
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>

      <div className="ventarc-panel mt-6 overflow-hidden">
        <div className="grid md:grid-cols-2">
          {specs.map(([label, value]) => (
            <div key={label} className="border-b border-white/[0.06] px-6 py-5 md:border-r md:border-white/[0.06]">
              <div className="mb-2 text-[11px] uppercase tracking-[0.24em] text-[#89a3c6]" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                {label}
              </div>
              <div className="text-base font-semibold text-white">{value}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function ArticleGrid({ articles }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {articles.map((article) => (
        <article key={article.title} className="ventarc-panel p-6 md:p-7">
          <div className="mb-4 inline-flex rounded-full border border-[#8fb8ff]/20 bg-[#0b1320]/80 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-[#8fb8ff]" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
            {article.category}
          </div>
          <h3 className="mb-4 text-2xl font-bold tracking-tight text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            {article.title}
          </h3>
          <p className="text-[15px] leading-7 text-[#bcc8da]">{article.body}</p>
        </article>
      ))}
    </div>
  );
}

function Highlights({ items }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="ventarc-panel p-5">
          <div className="mb-3 text-[11px] uppercase tracking-[0.24em] text-[#89a3c6]" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
            {item.label}
          </div>
          <div className="mb-2 text-3xl font-black tracking-tight text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            {item.value}
          </div>
          <p className="text-sm leading-6 text-[#aeb9ca]">{item.detail}</p>
        </div>
      ))}
    </div>
  );
}

function Rail({ items }) {
  return (
    <div className="ventarc-panel p-6 md:p-7">
      <div className="mb-5 text-[11px] uppercase tracking-[0.26em] text-[#8aa9d2]" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
        Operational Rail
      </div>
      <div className="grid gap-3 md:grid-cols-5">
        {items.map((item, index) => (
          <div key={item} className="rounded-sm border border-white/[0.06] bg-[#08101a]/80 px-4 py-4">
            <div className="mb-2 text-[10px] uppercase tracking-[0.22em] text-[#6f89ad]" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
              {String(index + 1).padStart(2, '0')}
            </div>
            <div className="text-sm font-medium leading-6 text-white">{item}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function VentarcFrame({ page }) {
  const data = PAGE_COPY[page] || PAGE_COPY.home;

  return (
    <div className="relative -mt-20 min-h-screen overflow-hidden bg-[#05070b] pt-20 text-white">
      <VentarcSceneBackground page={page} />

      <div className="relative z-10">
        <section className="mx-auto max-w-7xl px-6 pb-12 pt-12 md:px-8 md:pb-16 md:pt-20 xl:px-12">
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(460px,560px)] xl:items-start xl:gap-10 2xl:grid-cols-[minmax(0,1fr)_560px]">
            <div className="max-w-4xl">
              <div className="mb-6 inline-flex rounded-full border border-[#8fb8ff]/20 bg-[#09111c]/80 px-4 py-2 text-[11px] uppercase tracking-[0.3em] text-[#8fb8ff]" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                {data.eyebrow}
              </div>
              <h1 className="max-w-5xl text-5xl font-black leading-[0.92] tracking-[-0.08em] text-white md:text-7xl xl:text-[5.8rem]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                {data.title[0]}
                <br />
                <span className="ventarc-text-gradient">{data.title[1]}</span>
              </h1>
              <p className="mt-8 max-w-2xl text-lg leading-8 text-[#bcc8da] md:text-xl">
                {data.description}
              </p>
              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <ActionLink action={data.primary} primary />
                <ActionLink action={data.secondary} />
              </div>
            </div>
            <HeroPanel data={data} />
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-8 md:px-8 xl:px-12">
          <Highlights items={data.highlights} />
        </section>

        <section className="mx-auto max-w-7xl px-6 py-8 md:px-8 xl:px-12">
          {page === 'pricing' ? <PricingGrid tiers={data.tiers} specs={data.specs} /> : null}
          {page === 'resources' ? <ArticleGrid articles={data.articles} /> : null}
          {page !== 'pricing' && page !== 'resources' ? <StandardCards cards={data.cards} /> : null}
        </section>

        <section className="mx-auto max-w-7xl px-6 py-8 md:px-8 xl:px-12">
          {page !== 'resources' ? <Rail items={data.rail || []} /> : null}
        </section>

        <section className="mx-auto max-w-7xl px-6 py-16 md:px-8 xl:px-12">
          <div className="ventarc-panel relative overflow-hidden px-6 py-12 md:px-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(143,184,255,0.16),transparent_50%)] opacity-80" />
            <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <div className="mb-4 text-[11px] uppercase tracking-[0.28em] text-[#8aa9d2]" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                  Final Sequence
                </div>
                <h2 className="text-4xl font-black leading-tight tracking-[-0.05em] text-white md:text-5xl" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                  {data.ctaTitle}
                </h2>
                <p className="mt-5 text-lg leading-8 text-[#bcc8da]">{data.ctaBody}</p>
              </div>
              <div className="flex flex-col gap-4 sm:flex-row">
                <ActionLink action={data.ctaPrimary} primary />
                <ActionLink action={data.ctaSecondary} />
              </div>
            </div>
          </div>
        </section>

        <footer className="border-t border-white/[0.06] bg-[#04060a]/90">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-10 md:flex-row md:items-center md:justify-between md:px-8 xl:px-12">
            <div>
              <div className="text-2xl font-black tracking-[-0.08em] text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                VENTARC
              </div>
              <div className="mt-2 text-[11px] uppercase tracking-[0.28em] text-[#7086a7]" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                Event systems with controlled motion
              </div>
            </div>
            <div className="flex flex-wrap gap-6">
              {FOOTER_LINKS.map((link) => (
                <Link key={link.to} to={link.to} className="text-sm text-[#c1cede] no-underline transition-colors hover:text-white">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default VentarcFrame;
