import type { Metadata } from 'next';

import { CommercialLandingPage } from '@/components/marketing/commercial-landing-page';
import { getCanonicalUrl } from '@/lib/site-url';

const path = '/use-cases/sales';
const canonicalUrl = getCanonicalUrl(path);
const title = 'WhatsApp Sales CRM for Leads and Follow-Ups';
const description =
  'Turn WhatsApp sales conversations into assigned leads, organized contact context, CRM pipeline stages, and timely follow-ups with Talk Wagon.';
const socialImage =
  '/hostiko-crm/generated/commercial/talk-wagon-whatsapp-sales-workflow-v2.webp';
const socialImageAlt =
  'Conceptual Talk Wagon WhatsApp sales workflow with conversations, team assignment, follow-ups, and pipeline stages';

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    'WhatsApp sales',
    'WhatsApp sales CRM',
    'WhatsApp commerce',
    'WhatsApp lead management',
    'WhatsApp sales pipeline',
  ],
  alternates: { canonical: canonicalUrl },
  openGraph: {
    title: 'WhatsApp Sales CRM for Organized Lead Follow-Ups',
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
    title: 'WhatsApp Sales CRM for Organized Lead Follow-Ups',
    description,
    images: [socialImage],
  },
  robots: { index: true, follow: true },
};

const outcomes = [
  {
    title: 'Give every sales conversation an owner',
    description:
      'Assign inbound WhatsApp conversations to permitted team members so new enquiries do not remain unowned in a shared queue.',
  },
  {
    title: 'Keep lead context beside the conversation',
    description:
      'Use contact details, tags, notes, conversation history, and custom fields so agents can see who the customer is, what they asked, and what follow-up is already due.',
  },
  {
    title: 'Move qualified leads into a pipeline',
    description:
      'Create and manage deals with stages and assigned owners so the sales team can see what needs attention next.',
  },
  {
    title: 'Build repeatable follow-up workflows',
    description:
      'Use visual flows and automations for routing, waits, approved template sends, tags, field updates, deal creation, and human handoff when the sale needs a person.',
  },
] as const;

const steps = [
  {
    title: 'Receive the enquiry',
    description:
      "A customer starts a conversation through the business's connected WhatsApp setup, such as a website button, ad, QR code, wa.me link, or saved contact.",
  },
  {
    title: 'Assign an agent',
    description:
      'Route the conversation to a sales team member with the right workspace access.',
  },
  {
    title: 'Qualify the lead',
    description:
      'Add tags, update custom fields, capture the request, and mark whether the lead is new, returning, urgent, high value, or ready for a deal stage.',
  },
  {
    title: 'Track the opportunity',
    description:
      'Create a deal and move it through the sales pipeline as the conversation progresses.',
  },
  {
    title: 'Follow up consistently',
    description:
      'Use permitted manual replies, approved templates, or configured automation steps when appropriate.',
  },
] as const;

const sections = [
  {
    eyebrow: 'Shared sales inbox',
    title: 'Organize WhatsApp Sales Conversations',
    description:
      "A shared workspace helps sales teams manage WhatsApp leads without sharing an owner's login, copying screenshots between agents, or losing context inside personal phones.",
    points: [
      'Conversation assignment and clear ownership',
      'Contact records connected to message history',
      'Role-based access for sales agents, managers, and workspace owners',
    ],
  },
  {
    eyebrow: 'Pipeline visibility',
    title: 'Connect Conversations to Deal Stages',
    description:
      'Turn qualified enquiries into pipeline deals so the team can track progress after the first reply. A lead can move from new enquiry to quoted, follow-up, negotiation, won, or lost without disappearing in chat history.',
    points: [
      'Deal stages and assigned team members',
      'Customer context available during follow-up',
      'A clearer view of open sales work, stale leads, and next actions',
    ],
  },
  {
    eyebrow: 'WhatsApp commerce workflows',
    title: 'Support the Customer Journey Around a Sale',
    description:
      'Use CRM workflows around product questions, quotations, abandoned conversations, reminders, payment follow-ups, and post-sale check-ins while keeping commercial communication inside your configured business process.',
    points: [
      'Keyword, tag, and field-based automation options',
      'Approved template steps for business-initiated follow-ups outside the active service window',
      'Human handoff when a conversation needs an agent',
    ],
  },
] as const;

const faqs = [
  {
    question: 'What is WhatsApp sales CRM software?',
    answer:
      'WhatsApp sales CRM software helps a business turn WhatsApp messages into organized sales work: lead ownership, contact context, tags, notes, pipeline stages, follow-up reminders, approved template replies, and reporting in one workspace.',
  },
  {
    question: 'Can Talk Wagon assign WhatsApp leads to sales agents?',
    answer:
      'Yes. Workspace owners and permitted managers can use team and conversation assignment controls so a lead has a clear owner.',
  },
  {
    question: 'Can a WhatsApp conversation become a pipeline deal?',
    answer:
      'Yes. Talk Wagon includes a sales pipeline where teams can create deals, assign owners, add stages, and keep the opportunity connected to the customer workflow instead of treating chat and CRM as separate tools.',
  },
  {
    question: 'Does Talk Wagon support automated sales follow-ups?',
    answer:
      'Talk Wagon supports configured automations and visual flows with actions such as waits, tags, assignment, contact updates, deal creation, approved template sends, and handoff to a human agent. It is designed to automate the repeatable steps while keeping final sales decisions with your team.',
  },
  {
    question: 'Does Talk Wagon provide WhatsApp Business API access?',
    answer:
      "Talk Wagon provides the CRM workflow around a business's own approved WhatsApp Business API or Meta Cloud API configuration. Meta approval, template approval, messaging charges, phone number quality, and policy requirements remain separate from the CRM subscription.",
  },
  {
    question: 'Can Talk Wagon guarantee more sales?',
    answer:
      'No software can guarantee sales results. Talk Wagon helps organize the conversations, assignments, pipeline stages, and follow-ups that your team configures and manages.',
  },
] as const;

export default function WhatsAppSalesUseCasePage() {
  return (
    <CommercialLandingPage
      path={path}
      breadcrumbLabel="WhatsApp Sales"
      eyebrow="WhatsApp sales workflows for growing teams"
      title={title}
      description={description}
      image={socialImage}
      imageAlt={socialImageAlt}
      trustItems={[
        'Shared Inbox',
        'Lead Assignment',
        'Contact Context',
        'Sales Pipeline',
        'Follow-Ups',
      ]}
      outcomesEyebrow="Sales workflow outcomes"
      outcomesTitle="Move From First Message to an Organized Next Step"
      outcomesDescription="Talk Wagon connects the customer conversation with the people, contact details, pipeline stages, and follow-up actions that a sales team needs to manage."
      outcomes={outcomes}
      processEyebrow="How the workflow fits together"
      processTitle="A Practical WhatsApp Sales Process"
      processDescription="The CRM provides the structure; your team controls the sales process, customer communication, and final commercial decisions."
      steps={steps}
      supportingVisuals={[
        {
          image:
            '/hostiko-crm/generated/commercial/talk-wagon-whatsapp-sales-team-workflow-v2.webp',
          imageAlt:
            'Talk Wagon sales CRM dashboard showing contact queues, deal pipeline stages, and automated follow-up workflow panels',
          title: 'Team assignment and contact context',
          description:
            'Show sales teams how conversations, contact details, assigned owners, and lead stages stay visible in one CRM workspace.',
        },
        {
          image:
            '/hostiko-crm/generated/commercial/talk-wagon-whatsapp-sales-pipeline-follow-up-v2.webp',
          imageAlt:
            'Talk Wagon sales dashboard with messaging inbox, contact profile, pipeline stages, follow-up tasks, and performance widgets',
          title: 'Pipeline follow-up view',
          description:
            'Use the second view to reinforce the path from a customer message to follow-up tasks, pipeline work, and team performance tracking.',
        },
      ]}
      sections={sections}
      notice={{
        title: 'Use approved, consent-based WhatsApp communication',
        description:
          'Talk Wagon does not bypass Meta rules or create customer consent. Businesses remain responsible for their WhatsApp Business API approval, opt-in records, message templates, policy compliance, and any Meta or provider charges.',
      }}
      relatedLinks={[
        {
          label: 'WhatsApp Team Inbox',
          href: '/features/team-inbox',
          description:
            'Review shared conversation, assignment, contact context, and agent-access workflows.',
        },
        {
          label: 'WhatsApp Automation',
          href: '/features/automation',
          description:
            'See the triggers and actions available for configured customer follow-up workflows.',
        },
        {
          label: 'Talk Wagon Pricing',
          href: '/pricing',
          description:
            'Compare current CRM plans and the separate WhatsApp API billing context.',
        },
      ]}
      faqs={faqs}
      faqTitle="WhatsApp Sales CRM FAQ"
      ctaTitle="Organize Your WhatsApp Sales Workflow"
      ctaDescription="Start with the team inbox, contact context, pipeline, and follow-up tools your sales team needs."
    />
  );
}
