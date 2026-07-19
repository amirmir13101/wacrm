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
      'Map the workflows your team needs—such as routing, templates, waits, tags, webhooks, pipeline actions, and human handoff—to documented capabilities.',
  },
  {
    title: 'Verify current limits before deciding',
    description:
      'Plan names, allowances, add-ons, and pricing can change. Confirm the current vendor documentation and your connected Meta account requirements.',
  },
] as const;

const steps = [
  {
    title: 'List required workflows',
    description:
      'Write down the team inbox, contact, campaign, automation, reporting, and permission needs that matter now.',
  },
  {
    title: 'Check official documentation',
    description:
      'Use current vendor pages to verify plan structure, usage allowances, add-ons, and billing conditions.',
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
      "Select the option that fits your team's operating model instead of relying on an undated feature checklist.",
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
    title: 'Official WATI Documentation Describes Tiered Plans',
    description:
      "As reviewed on July 18, 2026, WATI's official help center describes Growth, Pro, and Business plans and says total cost can combine a subscription, messaging fees, and optional add-ons.",
    points: [
      'Plan features and allowances vary by tier',
      'Messaging charges depend on the applicable country and Meta pricing model',
      'Optional capabilities can introduce additional add-on or usage costs',
    ],
  },
  {
    eyebrow: 'Decision criteria',
    title: 'Evaluate Fit Instead of Assuming Feature Parity',
    description:
      'Talk Wagon and WATI are separate products. A useful comparison checks the exact current plan, region, connected Meta setup, team workflow, and operating requirements.',
    points: [
      'Verify current plan limits directly with each vendor',
      'Test the full journey from inbound message to team follow-up',
      'Confirm the total cost for your actual message volume and add-ons',
    ],
  },
] as const;

const comparisonRows = [
  {
    factor: 'Core workflow',
    talkWagon:
      'Built around a shared WhatsApp team inbox, contacts, broadcasts, visual flows, automations, pipelines, reporting, and workspace permissions.',
    alternative:
      'WATI should be reviewed against its current official plan pages and help-center documentation for the exact inbox, campaign, automation, and team capabilities included in each plan.',
  },
  {
    factor: 'Cost model',
    talkWagon:
      'Talk Wagon CRM pricing is separate from Meta WhatsApp API messaging charges, so teams can compare the CRM subscription and message usage as separate cost layers.',
    alternative:
      'WATI documentation describes plan subscription costs, messaging fees, and optional add-ons. Confirm the current total for your country, plan, and expected message volume.',
  },
  {
    factor: 'Team access',
    talkWagon:
      'Workspace roles and permissions are designed for owners, managers, agents, and team members who need controlled CRM access.',
    alternative:
      'Compare the current WATI plan you are considering for user seats, role controls, permissions, and any add-on or tier requirements.',
  },
  {
    factor: 'Automation fit',
    talkWagon:
      'Includes CRM automations and visual flows for routing, follow-ups, tags, delays, handoff steps, and connected WhatsApp actions.',
    alternative:
      'Review current WATI automation and flow documentation directly to confirm the specific triggers, actions, limits, and integrations your team needs.',
  },
  {
    factor: 'Best evaluation method',
    talkWagon:
      'Test a real workflow from incoming message to assignment, contact update, broadcast, automation, reporting, and follow-up.',
    alternative:
      'Test the same workflow in WATI or with current WATI documentation so the comparison is based on live requirements instead of a generic checklist.',
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
      'Talk Wagon can be evaluated as a WATI alternative by teams comparing a WhatsApp CRM workspace, shared inbox, contacts, broadcasts, automations, visual flows, permissions, pipeline tools, and reporting. The products are separate and should be compared against current official documentation.',
  },
  {
    question: 'Does Talk Wagon claim to have every WATI feature?',
    answer:
      'No. This page does not claim feature parity. Buyers should verify the exact current capabilities, limits, regional availability, integrations, add-ons, and plan terms they need with each vendor.',
  },
  {
    question: 'How should I compare WATI and Talk Wagon pricing?',
    answer:
      'Compare all cost layers: the CRM subscription, Meta WhatsApp messaging charges, optional add-ons, setup requirements, and any provider or infrastructure costs. Use current vendor pricing for your country and usage rather than an undated total.',
  },
  {
    question: 'Does Talk Wagon include Meta WhatsApp messaging fees?',
    answer:
      'No. Talk Wagon CRM pricing is separate from Meta WhatsApp API messaging charges and third-party provider costs. Businesses connect and maintain their own approved WhatsApp configuration.',
  },
  {
    question: 'What should a team test before switching WhatsApp CRM software?',
    answer:
      'Test a real workflow from incoming customer message through assignment, contact updates, template sending, automation, reporting, and human follow-up. Also verify data migration, permissions, current plan limits, and Meta requirements.',
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
      outcomesDescription="A responsible alternative page should help buyers verify fit. It should not invent prices, imply affiliation, or assume two separate products have identical features."
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
          'Talk Wagon is not affiliated with, endorsed by, or sponsored by WATI. WATI is a trademark of its respective owner. Third-party information on this page was reviewed from official public sources on July 18, 2026 and may change; confirm current details directly with WATI.',
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
