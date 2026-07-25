import type { Metadata } from 'next';

import { CommercialLandingPage } from '@/components/marketing/commercial-landing-page';
import { getCanonicalUrl } from '@/lib/site-url';

const path = '/wati-alternative';
const canonicalUrl = getCanonicalUrl(path);
const title = 'WATI Alternative for WhatsApp CRM Teams';
const description =
  'Compare Talk Wagon as a WATI alternative for team inboxes, CRM workflows, broadcasts, automation, permissions, and transparent plan evaluation.';
const socialImage =
  '/hostiko-crm/generated/commercial/talk-wagon-wati-alternative-evaluation-v2.webp';
const socialImageAlt =
  'Conceptual Talk Wagon evaluation of WhatsApp CRM inbox, broadcast, automation, cost, and workflow-fit considerations';

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    'WATI alternative',
    'WhatsApp CRM alternative',
    'WhatsApp team inbox software',
    'WhatsApp automation platform comparison',
  ],
  alternates: { canonical: canonicalUrl },
  openGraph: {
    title: 'Talk Wagon as a WATI Alternative for WhatsApp CRM Teams',
    description,
    url: canonicalUrl,
    siteName: 'Talk Wagon',
    type: 'website',
    images: [
      {
        url: socialImage,
        width: 1168,
        height: 880,
        alt: socialImageAlt,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Talk Wagon as a WATI Alternative for WhatsApp CRM Teams',
    description,
    images: [socialImage],
  },
  robots: { index: true, follow: true },
};

const outcomes = [
  {
    title: 'Compare the daily team workflow',
    description:
      'Review how each option handles shared conversations, contact context, agent access, assignments, and the move from customer message to next action.',
  },
  {
    title: 'Separate CRM fees from messaging costs',
    description:
      'Compare the software subscription with Meta messaging charges and any optional provider or add-on costs instead of treating them as one price.',
  },
  {
    title: 'Check automation against real use cases',
    description:
      'Map the workflows your team needs, such as routing, templates, waits, tags, webhooks, pipeline actions, and human handoff, to the features and limits that affect daily operations.',
  },
  {
    title: 'Compare real operating limits',
    description:
      'Compare users, broadcasts, automation triggers, API calls, webhooks, integrations, AI credits, support level, and message-charge structure before choosing a platform.',
  },
] as const;

const steps = [
  {
    title: 'List required workflows',
    description:
      'Write down the team inbox, contact, campaign, automation, reporting, and permission needs that matter now.',
  },
  {
    title: 'Compare the plan structure',
    description:
      'Review Growth, Pro, Business, and Talk Wagon Pro as complete operating models, not just headline subscription prices.',
  },
  {
    title: 'Separate all cost layers',
    description:
      'Compare subscription, Meta messaging, optional add-ons, setup, and any infrastructure or provider charges.',
  },
  {
    title: 'Test the working flow',
    description:
      'Use a realistic customer journey to evaluate assignment, template sending, automation, and agent follow-up.',
  },
  {
    title: 'Choose from evidence',
    description:
      "Select the option that fits your team's inbox, campaign, automation, reporting, and budget requirements instead of relying on a generic feature checklist.",
  },
] as const;

const sections = [
  {
    eyebrow: 'Talk Wagon workflow',
    title: 'A CRM Workspace Around WhatsApp Conversations',
    description:
      'Talk Wagon combines a shared inbox with contacts, team permissions, approved-template broadcasts, visual flows, automations, pipeline work, and reporting.',
    points: [
      'Workspace-scoped team access and conversation assignment',
      'Contacts, tags, custom fields, and pipeline deals',
      'Broadcast and automation workflows using the connected WhatsApp setup',
    ],
  },
  {
    eyebrow: 'WATI evidence reviewed',
    title: 'WATI Uses Tiered Plans With Separate Usage Charges',
    description:
      "Research reviewed on July 19, 2026 shows WATI positions Growth, Pro, and Business plans around different usage allowances. Its public pricing materials separate the subscription from WhatsApp message charges and optional add-ons.",
    points: [
      'Growth is positioned for one connected channel, 3 included users, 15k broadcasts/month, 1,000 automation triggers/month, 10k API calls/month, 2 select Commerce/CRM integrations, no webhooks, and 24x5 email support.',
      'Pro adds 5 included users, additional users listed at $24/user/month, unlimited broadcasts at standard rates, 2,000 automation triggers/month, 5 integrations including HubSpot, 200k API calls/month, limited webhooks, and 24x7 email/chat support.',
      'Business adds higher-scale operations such as additional users listed at $69/user/month, volume-discount messaging positioning, 5,000 automation triggers/month, unlimited integrations including Salesforce, 20M API calls/month, extensive webhooks, multiple numbers, round-robin assignment, priority support, and dedicated success support positioning.',
    ],
  },
  {
    eyebrow: 'Decision criteria',
    title: 'Evaluate Fit by Workflow, Limits and Total Cost',
    description:
      'Talk Wagon and WATI are separate products. A useful comparison looks at what your team actually needs: number of agents, broadcast volume, automation depth, API usage, webhooks, CRM pipeline work, reporting, and the cost of Meta messaging outside the CRM subscription.',
    points: [
      'For simple CRM operations, compare the shared inbox, contacts, team permissions, templates, broadcasts, flows, automations, pipelines, and reporting in one workspace.',
      'For high-volume or ecommerce-heavy operations, compare the cost of extra users, integrations, add-ons, webhook/API limits, AI features, and message-rate handling.',
      'For migration decisions, compare the complete journey from inbound message to assignment, contact update, approved template, campaign queue, automation, human handoff, and follow-up reporting.',
    ],
  },
] as const;

const comparisonRows = [
  {
    factor: 'Core workflow',
    talkWagon:
      'Built around a shared WhatsApp team inbox, contacts, broadcasts, visual flows, automations, pipelines, reporting, and workspace permissions.',
    alternative:
      'WATI is an AI-powered customer engagement platform with a Team Inbox, customer information in a built-in CRM, AI agents or chatbots, assignment to team members, campaign tools, and multi-channel conversation support including WhatsApp, Instagram, Facebook, RCS, SMS, and TikTok.',
    evidence:
      'WATI public product and help pages reviewed on July 19, 2026 describe messaging, automation, AI, CRM, analytics, Team Inbox, and multi-channel customer engagement. Talk Wagon copy is limited to features present in this CRM.',
  },
  {
    factor: 'Cost model',
    talkWagon:
      'Talk Wagon Pro is positioned as a CRM subscription for the workspace, with Meta WhatsApp API messaging charges and provider costs kept separate. The public Pro page currently presents $1 for the first month, then $9.99/month, with a 250,000 CRM-side broadcast message allowance.',
    alternative:
      'WATI describes total cost as three layers: subscription plan, WhatsApp messaging charges, and optional add-ons. Its pricing page also states that message charges apply separately and vary by marketing, utility, and authentication message type.',
    evidence:
      "WATI's official pricing-structure article states that total cost depends on subscription plan, messaging charges, and optional add-ons. Talk Wagon pricing remains separate from Meta WhatsApp API charges.",
  },
  {
    factor: 'Team access',
    talkWagon:
      'Workspace roles and permissions are designed for owners, managers, agents, and team members who need controlled CRM access.',
    alternative:
      'WATI Growth lists 3 included users with no additional users, while Pro and Business list 5 included users. Additional users are shown as $24/user/month on Pro and $69/user/month on Business in the reviewed public pricing content.',
    evidence:
      "The reviewed WATI pricing page listed 3 users on Growth, 5 users on Pro and Business, and additional-user pricing for Pro and Business. Talk Wagon's public pricing page presents its own plan limits separately, and this comparison does not change those plan terms.",
  },
  {
    factor: 'Automation fit',
    talkWagon:
      'Includes CRM automations and visual flows for routing, follow-ups, tags, delays, handoff steps, and connected WhatsApp actions.',
    alternative:
      "WATI's reviewed plan content lists 1,000 free automation triggers/month on Growth, 2,000 on Pro, and 5,000 on Business. Pro also promotes advanced chatbots, forms, integrations, Instagram automation, smart retargeting, and AI/agent add-on positioning.",
    evidence:
      'These automation-trigger allowances and feature groupings come from WATI public pricing/help content reviewed on July 19, 2026. This page omits any WATI feature where the public evidence is not clear enough to summarize safely.',
  },
  {
    factor: 'Best evaluation method',
    talkWagon:
      'Test a real workflow from incoming message to assignment, contact update, broadcast, automation, reporting, and follow-up.',
    alternative:
      'Evaluate WATI against the same workflow: inbox routing, assignment, customer data, broadcast campaign setup, automation trigger usage, integrations, webhook/API limits, support availability, and the final monthly cost after messages and add-ons.',
    evidence:
      'This row is a buyer checklist, not a superiority claim. It keeps both tools measured against the same workflow so the page is useful without assuming one-to-one feature parity.',
  },
] as const;

const sources = [
  {
    label: 'WATI official pricing page',
    href: 'https://www.wati.io/pricing/',
    description:
      'Current public WATI pricing and plan information provided by WATI.',
  },
  {
    label: "Understanding WATI's pricing structure",
    href: 'https://support.wati.io/en/articles/11462993-understanding-wati-s-pricing-structure',
    description:
      'WATI Help Center explanation of subscription costs, messaging fees, optional add-ons, and billing structure.',
  },
  {
    label: "Understanding WATI's pricing plans",
    href: 'https://support.wati.io/en/articles/11462997-understanding-wati-s-pricing-plans',
    description:
      'WATI Help Center overview of the Growth, Pro, and Business plan structure and usage model.',
  },
  {
    label: 'WATI plans and pricing collection',
    href: 'https://support.wati.io/en/collections/15525494-wati-plans-pricing',
    description:
      "WATI's official collection of plan, billing, credit, and pricing guidance.",
  },
] as const;

const faqs = [
  {
    question: 'Is Talk Wagon a WATI alternative?',
    answer:
      'Yes. Talk Wagon can be evaluated as a WATI alternative for teams that want a WhatsApp CRM workspace with shared inbox, contacts, broadcasts, automations, visual flows, permissions, pipeline tools, and reporting. WATI is broader in some areas, including multi-channel conversation support and ecommerce-focused integrations; Talk Wagon focuses on a lean WhatsApp CRM workflow with clear pricing and workspace controls.',
  },
  {
    question: 'Does Talk Wagon claim to have every WATI feature?',
    answer:
      'No. Talk Wagon does not claim one-to-one feature parity with WATI. The practical difference is positioning: WATI presents a larger AI-powered customer engagement suite with tiered allowances and add-ons, while Talk Wagon focuses on WhatsApp CRM operations such as team inbox, contacts, broadcasts, flows, automations, pipelines, permissions, and reporting.',
  },
  {
    question: 'How should I compare WATI and Talk Wagon pricing?',
    answer:
      'Compare all cost layers. Talk Wagon Pro is presented as $1 for the first month and then $9.99/month for CRM access, with Meta WhatsApp API charges separate. WATI describes three cost components: subscription plan, messaging charges, and optional add-ons. For WATI, also account for user-seat pricing, automation-trigger allowance, integrations, webhooks, API-call limits, and any paid AI or ecommerce add-ons your team needs.',
  },
  {
    question: 'Does Talk Wagon include Meta WhatsApp messaging fees?',
    answer:
      'No. Talk Wagon CRM pricing is separate from Meta WhatsApp API messaging charges and third-party provider costs. Businesses connect and maintain their own approved WhatsApp configuration.',
  },
  {
    question: 'What should a team test before switching WhatsApp CRM software?',
    answer:
      'Test a real workflow from incoming customer message through assignment, contact updates, approved template sending, broadcast queueing, automation triggers, pipeline movement, reporting, and human follow-up. Also compare data migration effort, team permissions, user-seat needs, message volume, API/webhook limits, support level, and Meta requirements.',
  },
  {
    question: 'Is Talk Wagon affiliated with WATI?',
    answer:
      'No. Talk Wagon is not affiliated with, endorsed by, or sponsored by WATI. WATI is a trademark of its respective owner and is referenced only for factual comparison.',
  },
] as const;

export default function WatiAlternativePage() {
  return (
    <CommercialLandingPage
      path={path}
      breadcrumbLabel="WATI Alternative"
      eyebrow="A factual WhatsApp CRM evaluation guide"
      title={title}
      description={description}
      image={socialImage}
      imageAlt={socialImageAlt}
      trustItems={[
        'Team Inbox',
        'Contacts',
        'Broadcasts',
        'Automation',
        'Permissions',
      ]}
      outcomesEyebrow="Comparison framework"
      outcomesTitle="Compare the Workflow, Costs and Current Plan Details"
      outcomesDescription="A responsible alternative page should give buyers enough detail to understand fit: workflow, pricing layers, team access, automation limits, integrations, support, and connected WhatsApp requirements."
      outcomes={outcomes}
      processEyebrow="Evaluation process"
      processTitle="How to Evaluate a WATI Alternative"
      processDescription="Use current official evidence and a real team workflow to compare the options that matter to your business."
      steps={steps}
      supportingVisuals={[
        {
          image:
            '/hostiko-crm/generated/commercial/talk-wagon-wati-workflow-evaluation-v2.webp',
          imageAlt:
            'Talk Wagon platform evaluation dashboard showing decision matrix cards, automation workflow builder, broadcast planning, and team roles',
          title: 'Workflow evaluation dashboard',
          description:
            'Help visitors compare operational fit by looking at inbox workflows, automation needs, broadcast handling, and team permissions together.',
        },
        {
          image:
            '/hostiko-crm/generated/commercial/talk-wagon-wati-decision-framework-v2.webp',
          imageAlt:
            'Talk Wagon alternative evaluation dashboard showing workflow comparison, pricing transparency, campaign queue, automation flow, and migration checklist',
          title: 'Decision framework view',
          description:
            'Use the second view to support careful vendor evaluation without claiming feature parity or showing competitor-owned interfaces.',
        },
      ]}
      comparison={{
        eyebrow: 'Side-by-side evaluation',
        title: 'Talk Wagon vs WATI: What to Compare Before Choosing',
        description:
          'Use this comparison table as a buying checklist. It explains how to evaluate workflow, cost, team access, and automation fit without assuming the two products have identical features.',
        alternativeLabel: 'WATI',
        rows: comparisonRows,
      }}
      sections={sections}
      notice={{
        title: 'Independent comparison and trademark notice',
        description:
          'Talk Wagon is not affiliated with, endorsed by, or sponsored by WATI. WATI is a trademark of its respective owner. Third-party information on this page was researched from public WATI sources and Meta/WhatsApp platform context on July 19, 2026. Pricing, allowances, and product packaging can change, so this page avoids claiming permanent feature parity.',
      }}
      sources={sources}
      relatedLinks={[
        {
          label: 'Talk Wagon Features',
          href: '/features',
          description:
            'Review the current CRM modules and follow links to detailed workflow pages.',
        },
        {
          label: 'Talk Wagon Pricing',
          href: '/pricing',
          description:
            'See current Talk Wagon plan terms and the separate Meta API cost explanation.',
        },
        {
          label: 'WhatsApp Team Inbox',
          href: '/features/team-inbox',
          description:
            'Explore assignments, contact context, role-based access, and shared conversation workflows.',
        },
      ]}
      faqs={faqs}
      faqTitle="WATI Alternative FAQ"
      ctaTitle="Evaluate Talk Wagon With Your Real Team Workflow"
      ctaDescription="Review the features, pricing context, and connected WhatsApp requirements before choosing the CRM that fits your team."
    />
  );
}
