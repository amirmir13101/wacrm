import type { Metadata } from 'next';

import { CommercialLandingPage } from '@/components/marketing/commercial-landing-page';
import { getCanonicalUrl } from '@/lib/site-url';

const path = '/use-cases/newsletter';
const canonicalUrl = getCanonicalUrl(path);
const title = 'WhatsApp Newsletter Software for Teams';
const description =
  'Plan opt-in WhatsApp newsletter campaigns with approved templates, audience checks, queue processing, delivery tracking, and CRM follow-ups.';
const socialImage =
  '/hostiko-crm/generated/commercial/talk-wagon-whatsapp-newsletter-workflow-v2.webp';
const socialImageAlt =
  'Conceptual Talk Wagon WhatsApp newsletter workflow with an opt-in audience, approval checks, campaign queue, delivery status, and inbox replies';

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    'WhatsApp newsletter',
    'WhatsApp newsletter software',
    'WhatsApp broadcast software',
    'WhatsApp campaign management',
    'opt-in WhatsApp marketing',
  ],
  alternates: { canonical: canonicalUrl },
  openGraph: {
    title: 'WhatsApp Newsletter Software for Opt-In Campaigns',
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
    title: 'WhatsApp Newsletter Software for Opt-In Campaigns',
    description,
    images: [socialImage],
  },
  robots: { index: true, follow: true },
};

const outcomes = [
  {
    title: 'Prepare an eligible audience',
    description:
      'Use contact records, tags, custom fields, consent information, or an uploaded recipient list to prepare the intended campaign audience.',
  },
  {
    title: 'Use an approved WhatsApp template',
    description:
      'Select a template and language that are available in the connected Meta account before a campaign enters the sending queue.',
  },
  {
    title: 'Review the campaign before queueing',
    description:
      'Check audience selection, template readiness, variables, exclusions, and the final recipient estimate during preflight.',
  },
  {
    title: 'Track message outcomes',
    description:
      'Monitor queued, sent, delivered, read, and failed status information as Meta returns updates to the CRM.',
  },
] as const;

const steps = [
  {
    title: 'Confirm consent',
    description:
      'Build a recipient list from customers who have given the required permission to receive messages.',
  },
  {
    title: 'Choose a template',
    description:
      'Select the approved WhatsApp template, language, and campaign variables for the message.',
  },
  {
    title: 'Select the audience',
    description:
      'Use contacts, tags, custom fields, exclusions, or an uploaded list to define recipients.',
  },
  {
    title: 'Run preflight',
    description:
      'Review template availability, recipient eligibility, message count, and estimated API cost context.',
  },
  {
    title: 'Queue and monitor',
    description:
      'Let the server-side worker process the campaign and review status updates in the CRM.',
  },
] as const;

const sections = [
  {
    eyebrow: 'Campaign preparation',
    title: 'Create a Structured WhatsApp Newsletter Workflow',
    description:
      'A newsletter-style WhatsApp campaign needs more than a message box. Talk Wagon keeps the template, audience, exclusions, variables, and preflight review in one process.',
    points: [
      'Meta-approved template and language selection',
      'Audience selection from CRM contact data',
      'Preflight checks before queueing',
    ],
  },
  {
    eyebrow: 'Reliable processing',
    title: 'Keep Sending Work on the Server',
    description:
      'Campaigns are queued for server-side processing so the browser does not need to remain open while eligible recipients are handled.',
    points: [
      'Queue progress recorded in the CRM',
      'Pause, resume, cancel, and retry controls where permitted',
      'Workspace-scoped template and WhatsApp configuration',
    ],
  },
  {
    eyebrow: 'Customer follow-up',
    title: 'Connect Replies to the Team Inbox',
    description:
      'A campaign is only one part of the customer journey. Replies can return to the shared inbox so permitted agents can continue the conversation with CRM context.',
    points: [
      'Shared inbox for customer replies',
      'Tags, assignment, and contact updates',
      'Follow-up automations and pipeline actions',
    ],
  },
] as const;

const faqs = [
  {
    question: 'What is a WhatsApp newsletter?',
    answer:
      'A WhatsApp newsletter is a planned update sent to an eligible, opted-in audience through WhatsApp. Business-initiated campaigns generally require an approved message template and must follow Meta policies.',
  },
  {
    question: 'Can Talk Wagon send a WhatsApp newsletter to every contact?',
    answer:
      'No. Businesses should send only to eligible recipients with the required consent and must follow WhatsApp Business messaging rules. Talk Wagon includes audience and preflight controls, but the business remains responsible for compliance.',
  },
  {
    question: 'Do WhatsApp newsletter campaigns use approved templates?',
    answer:
      "Yes. Talk Wagon's broadcast workflow uses templates and languages available in the connected Meta account and checks template readiness before queueing.",
  },
  {
    question: 'Can I segment a WhatsApp newsletter audience?',
    answer:
      'Talk Wagon supports contact-based audience selection using available CRM data such as tags, custom fields, exclusions, and uploaded recipient lists.',
  },
  {
    question: 'Can I see whether newsletter messages were delivered?',
    answer:
      'Talk Wagon records campaign and recipient status updates such as queued, sent, delivered, read, and failed when those updates are available from the connected WhatsApp workflow.',
  },
  {
    question:
      'Are Meta WhatsApp messaging charges included in Talk Wagon pricing?',
    answer:
      'No. Talk Wagon CRM pricing is separate from Meta WhatsApp API messaging charges and any third-party provider fees. Those costs depend on the connected account and current Meta pricing.',
  },
] as const;

export default function WhatsAppNewsletterUseCasePage() {
  return (
    <CommercialLandingPage
      path={path}
      breadcrumbLabel="WhatsApp Newsletter"
      eyebrow="Opt-in WhatsApp newsletter campaign workflows"
      title={title}
      description={description}
      image={socialImage}
      imageAlt={socialImageAlt}
      trustItems={[
        'Approved Templates',
        'Audience Checks',
        'Preflight',
        'Server Queue',
        'Delivery Status',
      ]}
      outcomesEyebrow="Campaign controls"
      outcomesTitle="Plan, Review and Monitor WhatsApp Newsletter Campaigns"
      outcomesDescription="Talk Wagon gives marketing and customer teams a structured workflow around the approved template, opted-in audience, campaign queue, and customer replies."
      outcomes={outcomes}
      processEyebrow="Campaign workflow"
      processTitle="From Consent to Campaign Follow-Up"
      processDescription="Each stage keeps a separate operational concern visible before and after the campaign is queued."
      steps={steps}
      supportingVisuals={[
        {
          image:
            '/hostiko-crm/generated/commercial/talk-wagon-whatsapp-newsletter-campaign-prep-v2.webp',
          imageAlt:
            'Talk Wagon newsletter broadcast workflow dashboard showing template selection, message preview, campaign performance, and reply management',
          title: 'Campaign preparation view',
          description:
            'Show the planning side of newsletter work: approved templates, schedule controls, delivery checks, and reply management before sending.',
        },
        {
          image:
            '/hostiko-crm/generated/commercial/talk-wagon-whatsapp-newsletter-queue-replies-v2.webp',
          imageAlt:
            'Talk Wagon newsletter CRM dashboard showing broadcast setup, audience segments, delivery queue, analytics widgets, and reply inbox preview',
          title: 'Queue and reply follow-up',
          description:
            'Reinforce that a campaign does not end at send time; replies, queue state, and customer follow-ups stay connected to the CRM.',
        },
      ]}
      sections={sections}
      notice={{
        title: 'Consent and Meta policy remain essential',
        description:
          'Talk Wagon does not create opt-in consent, guarantee delivery, or bypass WhatsApp template approval. Businesses remain responsible for lawful recipient consent, message content, Meta policy compliance, and all Meta or provider charges.',
      }}
      relatedLinks={[
        {
          label: 'WhatsApp Broadcast Software',
          href: '/features/broadcasts',
          description:
            'Review the full broadcast workflow, preflight checks, queue processing, and tracking features.',
        },
        {
          label: 'WhatsApp Team Inbox',
          href: '/features/team-inbox',
          description:
            'See how permitted agents can manage customer replies and follow-up conversations.',
        },
        {
          label: 'Talk Wagon Pricing',
          href: '/pricing',
          description:
            'Compare CRM plans and understand the separate Meta WhatsApp API cost context.',
        },
      ]}
      faqs={faqs}
      faqTitle="WhatsApp Newsletter FAQ"
      ctaTitle="Build a More Organized WhatsApp Campaign Workflow"
      ctaDescription="Prepare approved templates, eligible audiences, preflight checks, queue processing, and customer follow-ups in one CRM."
    />
  );
}
