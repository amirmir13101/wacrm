# Current CRM UI Style Guide

## 1. Purpose

This guide documents the current Talk Wagon CRM frontend style so the same look and feel can be recreated in another CRM project.

The focus is visual and structural: theme, layout, colors, typography, components, dashboard patterns, public marketing patterns, image assets, and reusable image-generation guidance. It does not document business copy, CRM product strategy, backend behavior, database schema, or private configuration.

Primary audited areas:

- `src/app`
- `src/components`
- `src/app/globals.css`
- `src/components/ui`
- `src/components/layout`
- `src/components/marketing`
- `src/components/dashboard`
- `public/hostiko-crm`
- `docs`
- `.agents/skills`
- `skills-lock.json`
- package/config files that affect UI

## 2. Overall Visual Direction

The CRM has two connected visual modes:

1. **Authenticated dashboard style**
   - Dark forest-green SaaS dashboard.
   - Premium business CRM feel.
   - Deep green page backgrounds with radial emerald glow.
   - Rounded cards with thin green borders.
   - Bright emerald active states.
   - Soft amber/yellow warning and highlight accents.
   - Compact, readable dashboard typography.
   - Lucide line icons.
   - Subtle shadows, not heavy glassmorphism.

2. **Public marketing website style**
   - Light marketing sections mixed with dark green hero/feature bands.
   - White and pale mint cards.
   - Dark green typography.
   - Emerald CTAs with amber hover/secondary CTAs.
   - Large generated dashboard mockup images.
   - Rounded 24px-34px containers.
   - High-trust SaaS presentation.

The overall design language should feel like:

- professional SaaS CRM;
- dark forest-green dashboard;
- premium but practical business UI;
- rounded panels;
- subtle borders;
- emerald success/action accents;
- amber status/offer accents;
- high contrast;
- clean readable typography;
- realistic production dashboard screenshots for generated images.

## 3. Color Palette

The project uses Tailwind v4 with CSS variables in `src/app/globals.css`, plus many direct hex utilities in React components.

Core theme variables:

| Purpose | Color/Class | Usage | Use in second CRM |
| --- | --- | --- | --- |
| Main dashboard background | `#07130e`, `bg-background` | Dashboard shell, sidebar, headers, modal base | Use as the dominant authenticated app background |
| Deep page gradient end | `#05100c` | Dashboard main radial/linear gradient | Use for extra depth at page bottom |
| Card background | `#0b241c`, `bg-card` | shadcn/base card background | Use for generic dark cards |
| Dashboard panel background | `#0d1b15` | Metric cards, auth panels, public dark footer | Use for raised dark panels |
| Secondary dark surface | `#10261c`, `#102a20` | Auth shell, secondary panels, muted blocks | Use for nested dark panels |
| Hover/active dark surface | `#123226` | Sidebar hover, dropdown hover, dark action hovers | Use for hover surface states |
| Primary emerald | `#3ddf84`, `bg-primary`, `text-primary` | Primary buttons, active sidebar, success, badges, icons, progress | Use for all main CTAs and active/success states |
| Primary foreground | `#07130e` | Text on emerald buttons/badges | Use for strong contrast on green buttons |
| Amber/yellow accent | `#ffbd29` | Warnings, offer labels, CTA hover, logo “Talk” text | Use for warnings, highlights, secondary CTAs |
| Teal accent | `#08bba4` | Public page eyebrow text, feature icons, active public nav | Use mainly on public marketing pages |
| Border green | `#17402f` | Sidebar/header borders, dashboard card borders | Use for default dark borders |
| Input border | `#315846` | Inputs, modals, forms, nested cards | Use for form and inner-panel borders |
| Strong emerald card border | `#3ddf84/60` | AI Chatbot dashboard cards | Use for high-importance cards |
| Panel emerald border | `#3ddf84/40` | AI Chatbot nested panels | Use for secondary panels inside cards |
| Amber warning border | `#ffbd29/55`, `#ffbd29/70` | Inactive setup cards, warnings, notes | Use when setup/action is incomplete |
| Main text dark dashboard | `#ffffff`, `text-white` | Dashboard headings and key labels | Use for primary text on dark surfaces |
| Light mint text | `#d8fff1` | Dark-card body text and badges | Use for secondary readable text |
| Muted dashboard text | `#b8cfc7`, `#8bb4a5`, `#7fb9a9`, `#a9c6bb` | Helper text, placeholders, metadata | Use for descriptions and helper text |
| Public page background | `#f7fbf8` | Public marketing body background | Use for light marketing sections |
| Public card tint | `#f4fff9` | Public feature pills/cards | Use for soft mint cards |
| Public border | `#dbe9e2`, `#dce9e2`, `#e1eee8` | Light section card borders | Use for light mode card outlines |
| Public text | `#07130e` | Public headings and dark text | Use for main public text |
| Public muted text | `#5b7169` | Public body/paragraph text | Use for secondary public text |
| Dark CTA black | `#181818` | Public dark buttons/cards | Use sparingly for high-contrast dark CTAs |
| Error/destructive | Tailwind red / `oklch(0.577 0.245 27.325)` | Error alerts, destructive actions | Use only for errors/destructive states |

Observed high-frequency colors from the source:

| Color | Role |
| --- | --- |
| `#3ddf84` | Main brand/action/success emerald |
| `#07130e` | Main dark background |
| `#ffbd29` | Amber highlight/warning/hover |
| `#315846` | Form and panel border |
| `#d8fff1` | Light mint text |
| `#08bba4` | Public teal accent |
| `#0d1b15` | Dark panel background |
| `#5b7169` | Public muted copy |
| `#8bb4a5` | Dashboard muted copy |
| `#dbe9e2` | Light public borders |
| `#f7fbf8` | Public light background |
| `#1b372b` | Public dark green section |
| `#123226` | Dashboard hover background |
| `#f4fff9` | Public mint card background |

Usage guidance:

- Use emerald for “ready”, “active”, “save”, “send”, “publish”, “configured”, and selected navigation.
- Use amber for “warning”, “pending”, “attention”, “offer”, “trial”, and incomplete setup states.
- Do not introduce blue/purple as a primary app color. `src/app/globals.css` intentionally remaps many old blue/purple utility classes inside `.dashboard-theme` to emerald.
- Keep dark dashboard surfaces very dark. The style depends on contrast between near-black green backgrounds and bright emerald accents.

## 4. Typography

The app uses Tailwind v4 theme variables:

- `--font-sans: var(--font-sans)`
- `--font-heading: var(--font-sans)`
- `--font-mono: var(--font-geist-mono)`

The exact font family is not explicitly visible in the inspected files; it is likely injected by the Next.js app layout or default Tailwind/shadcn setup. Treat the production typography as a clean modern sans-serif with strong weights.

Observed type patterns:

| Element | Typical classes/pattern | Visual behavior |
| --- | --- | --- |
| Dashboard page title | `text-2xl font-bold text-white` | Compact, clear page heading |
| Dashboard header title | `text-base font-semibold sm:text-lg` | Smaller title in top bar |
| Metric value | `text-[28px] leading-none font-bold tabular-nums` | Big numeric KPI |
| Public hero title | `text-4xl font-extrabold sm:text-5xl lg:text-6xl` | Strong marketing headline |
| Public section title | `text-3xl font-extrabold sm:text-4xl` | Bold section hierarchy |
| Card title | `text-xl`/`text-2xl font-extrabold`, or shadcn `text-base font-medium` | Depends on marketing vs dashboard card |
| Body copy | `text-sm`, `text-base`, `leading-7`, `leading-8` | Readable, spacious marketing copy |
| Dashboard helper text | `text-sm text-[#b8cfc7]` or `text-xs text-[#8bb4a5]` | Muted but readable |
| Buttons | `text-xs`/`text-sm font-bold` or `font-black` | Compact, confident SaaS actions |
| Badges/eyebrows | `text-xs uppercase tracking-[0.16em-0.22em] font-bold` | Label-like status/categorical text |

Typography rules for reuse:

- Use bold/extrabold headings, not thin display text.
- Prefer `text-sm` for dashboard controls and helper text.
- Use tabular numbers for metrics and billing values.
- Keep line heights generous in public copy (`leading-7`, `leading-8`).
- Use uppercase tracking for section eyebrows, status labels, and modal overlines.

## 5. Layout System

### Dashboard shell

Key files:

- `src/app/(dashboard)/dashboard-shell.tsx`
- `src/components/layout/sidebar.tsx`
- `src/components/layout/header.tsx`

Dashboard layout:

- Full-height app shell: `h-screen overflow-hidden bg-[#07130e]`.
- Left sidebar:
  - mobile drawer: fixed, `w-64`;
  - desktop: static `lg:w-60`;
  - border-right `border-[#17402f]`;
  - background `#07130e`.
- Header:
  - height `h-14`;
  - border-bottom `border-[#17402f]`;
  - background `#07130e`;
  - subtle shadow `shadow-[0_14px_40px_rgba(0,0,0,0.22)]`.
- Main content:
  - scrollable `overflow-y-auto`;
  - no horizontal overflow;
  - padding `p-4 sm:p-6`;
  - radial emerald glow and dark vertical gradient:
    `radial-gradient(circle_at_50%_0%, rgba(61,223,132,0.13), transparent_34%)`,
    then `#0d1b15 -> #07130e -> #05100c`.

### Dashboard spacing

- Page sections usually use `space-y-5`.
- Card grids use `gap-4` or `gap-5`.
- KPI grid uses `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`.
- Chart and panel grids use `lg:grid-cols-5` or custom `xl:grid-cols[...]`.
- Card padding is usually `p-4`, `p-5`, `p-6`, or `sm:p-7`.

### Public site layout

Key files:

- `src/app/page.tsx`
- `src/app/features/*`
- `src/app/pricing/page.tsx`
- `src/components/marketing/public-header.tsx`
- `src/components/marketing/public-footer.tsx`

Public layout:

- Body background `#f7fbf8` or white.
- Header max width up to `max-w-[1600px]`; content usually `max-w-7xl`.
- Hero sections:
  - dark green background;
  - large gradient/radial overlays;
  - `lg:grid-cols-[0.92fr_1.08fr]` style split;
  - big generated dashboard image inside rounded `34px` frame.
- Content sections:
  - `px-5 sm:px-8 lg:px-10`;
  - vertical padding often `py-20`;
  - cards rounded `24px-32px`;
  - grid card layouts.

### Responsive behavior

- Sidebar becomes mobile drawer below `lg`.
- Public nav becomes hamburger menu below `lg`.
- Buttons stack vertically on mobile and become horizontal from `sm`.
- Dashboard cards collapse to one column first, then `sm`/`lg` grids.
- Modals use `max-h-[90vh]`/`max-h-[94vh]` with inner scrollable areas.

## 6. Component Style Patterns

### Buttons

Base component:

- `src/components/ui/button.tsx`
- `rounded-lg`, compact heights (`h-8`, `h-9`, `h-11`, `h-12` depending context)
- `font-medium` in primitive; many feature-specific buttons override to `font-bold`/`font-black`.

Dashboard primary button pattern:

```tsx
className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#3ddf84] bg-[#3ddf84] px-3 text-xs font-bold text-[#07130e] transition hover:bg-[#ffbd29] disabled:cursor-not-allowed disabled:border-[#3ddf84] disabled:bg-[#3ddf84] disabled:text-[#07130e] disabled:opacity-70"
```

Public primary CTA pattern:

```tsx
className="inline-flex h-12 items-center justify-center rounded-full bg-[#3ddf84] px-7 text-sm font-bold text-[#07130e] hover:bg-[#ffbd29]"
```

Secondary/dark CTA:

```tsx
className="bg-[#181818] text-white hover:bg-[#ffbd29] hover:text-[#07130e]"
```

Button rules:

- Use emerald fill for primary app actions.
- Use amber hover where it feels like a brand-highlight interaction.
- Use rounded-full for public marketing CTAs.
- Use rounded-xl for dashboard card actions.
- Disabled primary buttons should remain green with lower opacity, not grey, when preserving visual consistency is important.

### Cards

Generic shadcn card:

- `src/components/ui/card.tsx`
- `rounded-xl bg-card py-4 ring-1 ring-foreground/10`.

Dashboard metric card:

```tsx
rounded-2xl border border-[#17402f] bg-[#0d1b15]/95 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)]
```

AI Chatbot card pattern:

```tsx
border border-[#3ddf84]/60 shadow-[0_18px_50px_rgba(0,0,0,0.22)] transition hover:border-[#3ddf84]/80
rounded-3xl bg-[#07130e]/85 p-5
```

AI nested panel pattern:

```tsx
border border-[#3ddf84]/40 shadow-[0_12px_35px_rgba(0,0,0,0.14)] transition hover:border-[#3ddf84]/60
bg-[#0d1b15]/70 rounded-2xl p-4
```

Public card pattern:

```tsx
rounded-[30px] bg-white shadow-[0_20px_60px_rgba(7,19,14,0.10)] ring-1 ring-[#e1eee8]
```

Rules:

- Dashboard cards: dark background, green border, soft shadow.
- Public cards: white/pale mint background, very soft green-grey border, larger radius.
- Use persistent borders on important dashboard cards so cards remain clearly separated.

### Inputs, selects, textareas

Dashboard form pattern:

```tsx
h-11 w-full rounded-xl border border-[#315846] bg-[#07130e] px-3 text-sm text-white outline-none transition placeholder:text-[#789486] focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/20
```

Auth form pattern:

```tsx
h-11 rounded-full border-[#315846] bg-[#0d1b15] px-4 text-white placeholder:text-[#7fb9a9] focus-visible:border-[#3ddf84] focus-visible:ring-[#3ddf84]/25
```

Rules:

- Use dark inputs on dashboard.
- Use `#315846` for form borders.
- Use emerald focus rings.
- Use muted green placeholders.
- Prefer rounded-xl in dashboard and rounded-full in public/auth marketing-like forms.

### Toggles

Observed dashboard toggles use green active states and dark tracks. Keep active toggle emerald and inactive/warning states amber only when the surrounding card is explicitly warning.

### Badges

Badge styles:

- Success/active: emerald fill, dark text.
- Warning: amber fill/border, dark text or amber text on transparent background.
- Neutral: dark surface `#0d1b15`, border `#315846`, text `#d8fff1`.
- Public active nav badge/pill: white background, teal/dark text.

Examples:

```tsx
rounded-full border border-[#3ddf84]/60 bg-[#3ddf84] px-2.5 py-1 text-[11px] font-black uppercase text-[#07130e]
```

```tsx
rounded-full border border-[#ffbd29]/40 bg-[#ffbd29]/10 px-2.5 py-1 text-[11px] font-bold uppercase text-[#ffbd29]
```

### Modals

Generic modal primitive:

- `src/components/ui/dialog.tsx`
- `rounded-xl bg-popover p-4 ring-1 ring-foreground/10`.

AI Chatbot large modal pattern:

```tsx
fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm
max-h-[94vh] w-full max-w-6xl overflow-hidden rounded-3xl border border-[#3ddf84]/70 bg-[#07130e] shadow-[0_34px_110px_rgba(0,0,0,0.58)]
```

Modal rules:

- Use dark forest-green modal bodies.
- Use emerald border at `60-70%` opacity.
- Header/footer use slightly different dark green `#0b1d15`.
- Keep body scroll inside modal, not page.
- Use compact footer actions aligned right on desktop.

### Progress bars

Pattern:

- outer: `overflow-hidden rounded-full border border-[#315846] bg-[#04100b]`;
- inner: emerald for normal, amber for warning;
- text labels in `text-xs` muted mint.

Use for import, embedding, setup progress, and readiness flows.

### Tables/lists

Patterns:

- dark list container: `rounded-2xl border border-[#3ddf84]/40 bg-[#0d1b15]/70`;
- divider: `divide-y divide-[#3ddf84]/25`;
- row hover: `hover:bg-[#123226]`;
- badges for type/status;
- action buttons compact `h-8/h-9`.

### Sidebar menu

File: `src/components/layout/sidebar.tsx`

Rules:

- Dark static background.
- Active item: bright emerald pill, dark text, soft emerald shadow.
- Inactive item: muted mint text, dark hover background.
- Icon size `h-4 w-4`.
- Nav row radius `rounded-lg`.
- Sidebar footer account block has top border and dark hover.

### Header/top bar

File: `src/components/layout/header.tsx`

Rules:

- Height `h-14`.
- Dark green background.
- Bottom border.
- Page title compact.
- Avatar/account dropdown on right.
- Mobile hamburger button with 40px target.

### Empty states

File: `src/components/dashboard/empty-state.tsx`

Pattern:

```tsx
rounded-xl border border-dashed border-[#315846] bg-[#07130e]/70 px-4 py-6 text-center
```

Rules:

- Use dashed muted green border.
- Center icon in dark hover surface with emerald icon.
- Title in light mint/white.
- Hint in muted green.

### Alerts/status messages

- Success: `border-[#3ddf84]/30 bg-[#3ddf84]/10 text-[#b8ffe0]`.
- Warning: amber border/background, usually `border-[#ffbd29]/40 bg-[#ffbd29]/10 text-amber-100`.
- Error: red border/background, e.g. `border-red-400/30 bg-red-500/10 text-red-200`.

### Loading states

- Dashboard full-screen loading uses dark background and emerald spinner:
  `border-2 border-[#3ddf84] border-t-transparent`.
- Skeletons should stay dark green and subdued.

## 7. Dashboard Design Pattern

The authenticated dashboard is structured as:

1. Left navigation sidebar.
2. Top header.
3. Main content area with dark gradient.
4. Page-level title/subtitle.
5. Optional usage/status card.
6. KPI cards.
7. Main functional cards or grids.

Dashboard design rules:

- Use a persistent dark green background; do not switch to light surfaces inside the app.
- Use a clear visual hierarchy:
  - white headings;
  - muted mint descriptions;
  - emerald for action/status;
  - amber only when something needs attention.
- Use card grids instead of dense tables unless the data is truly tabular.
- Keep controls compact and high contrast.
- Prefer rounded `2xl/3xl` panels.
- Maintain `overflow-x-hidden` at page shell level to avoid horizontal scrolling.

## 8. Public Website Design Pattern

The public site is a lighter marketing layer around the same brand palette.

### Header

File: `src/components/marketing/public-header.tsx`

- Top trust strip on desktop: dark green `#0d1b15`.
- Main nav: white background, rounded pill nav group.
- Active nav: white pill with teal text and subtle shadow.
- Logo: image from `/hostiko-crm/brand/talk-wagon-logo-public.webp`.
- CTA: black/near-black button with amber hover, or emerald CTA depending context.
- Mobile: dark circular hamburger, mint menu panel.

### Hero sections

Public hero pattern:

- dark green background `#07130e`;
- radial emerald glow;
- subtle grid overlay;
- large headline;
- mint paragraph text;
- primary emerald CTA;
- secondary bordered white CTA;
- generated dashboard screenshot in rounded frame with soft shadow.

### Feature cards

- White cards on light background.
- Dark green headers or icon blocks.
- Generated images inside rounded mint containers.
- Rings/borders `#e1eee8`.
- Hover image scale `group-hover:scale-[1.03]`.

### Pricing cards

- Rounded `32px`.
- Normal cards: `bg-[#f7fbf8] text-[#07130e] ring-[#e1eee8]`.
- Featured card: `bg-[#1b372b] text-white ring-[#1b372b]`, sometimes slight scale and upward offset.
- Offer badges: amber.
- CTA button: emerald or dark button with amber hover.

### Footer

File: `src/components/marketing/public-footer.tsx`

- Dark green `#0d1b15`.
- Logo inside pale mint rounded block.
- Link columns with muted green text.
- Hover links become emerald.

## 9. AI Chatbot Tab UI Pattern

File: `src/app/(dashboard)/ai-chatbot/page.tsx`

The AI Chatbot tab is the most specialized dashboard UI. It uses stronger green card borders and a setup-oriented layout.

### Main visual language

- Page background inherits dashboard dark gradient.
- Cards use persistent emerald borders:
  `border-[#3ddf84]/60`, hover `border-[#3ddf84]/80`.
- Nested panels use `border-[#3ddf84]/40`.
- Warning/inactive cards use amber:
  `border-[#ffbd29]/55 bg-[#2a220b]/20`.
- Buttons are compact green dashboard buttons with amber hover.

### Top status/setup cards

Cards represent:

- provider/API configuration;
- WhatsApp auto-reply state;
- knowledge base/chunking readiness.

Rules:

- Active/ready cards stay green.
- Off/unconfigured cards use subtle amber warning treatment.
- Keep status text unchanged; only color communicates state.

### Provider settings

- Dark card with rounded controls.
- Fields use `#07130e` inputs, `#315846` borders.
- Save/test buttons use compact emerald style.
- Sensitive values should be masked in UI.

### Firecrawl settings and Website Import

- Firecrawl cards follow the same dark card structure.
- Website import uses a large review modal.
- Review modal structure:
  - header with status;
  - large editable draft content area;
  - stats/quality notes side panel;
  - footer with compact embedding progress on the left and actions on the right.
- Pricing preview cards were intentionally removed from the modal; pricing remains in the actual draft content.

### Manual Knowledge Base

- Manual editor uses dark textarea, compact toolbar/action row.
- Save button uses the same CRM green style as import/provider buttons.
- Chunk status labels should be one-line and compact.

### Saved Knowledge

- Dark list container with persistent emerald border.
- Items have type/source badges, preview text, and compact edit/delete actions.
- Default list can be visually limited with “See More / Show Less” while backend data remains unchanged.

### Chatbot Instructions

- Card controls tone, fallback, handoff, and instruction text.
- Enabled badge uses green active styling.
- Save Settings button matches other compact green actions.

### Test Chatbot

- Dashboard-only test panel.
- “Dashboard only” badge should be one line.
- Ask button uses the same compact green button pattern.
- Answer preview is a dark bordered panel.

### Activity, unanswered questions, schedule/import history

- Use the same dark nested list panels.
- Statuses use emerald for complete/ready, amber for attention, red only for failures.
- Debug/sensitive data is not displayed.

## 10. Image/Asset Style

Assets are stored under `public/hostiko-crm`.

### Folder structure

| Folder | Purpose |
| --- | --- |
| `public/hostiko-crm/brand` | Logo assets |
| `public/hostiko-crm/generated` | Generated dashboard/marketing WebP images |
| `public/hostiko-crm/generated/automation` | Automation page images |
| `public/hostiko-crm/generated/broadcasts` | Broadcast page images |
| `public/hostiko-crm/generated/checkout` | Checkout image |
| `public/hostiko-crm/generated/features` | Feature page images |
| `public/hostiko-crm/generated/pricing` | Pricing page images |
| `public/hostiko-crm/generated/team-inbox` | Team inbox page images |
| `public/hostiko-crm/illustrations` | Lightweight SVG illustrations |

### Logo assets

| File | Dimensions/type |
| --- | --- |
| `public/hostiko-crm/brand/logo.png` | 2508x627 PNG |
| `public/hostiko-crm/brand/talk-wagon-logo-public.png` | 520x79 PNG |
| `public/hostiko-crm/brand/talk-wagon-logo-public.webp` | 520x79 WebP |
| `public/hostiko-crm/brand/talk-wagon-logo-public-small.webp` | 360x55 WebP |
| `public/hostiko-crm/brand/talk-wagon-logo.svg` | SVG |

### Generated WebP images

Most generated images use:

- 1168x880 WebP;
- rounded dashboard/mockup composition;
- dark forest-green dashboard surfaces;
- emerald active accents;
- occasional amber highlights;
- clean SaaS cards, charts, lists, and CRM panels.

Main hero image:

- `public/hostiko-crm/generated/talk-wagon-home-hero-dashboard.webp`
- 2336x1744 WebP

Common generated image naming pattern:

```text
talk-wagon-{page-or-section}-{topic}.webp
```

Examples:

- `talk-wagon-home-team-inbox.webp`
- `talk-wagon-features-ai-automation.webp`
- `talk-wagon-pricing-plan-comparison-usd.webp`
- `talk-wagon-team-inbox-agent-assignment.webp`

### SVG illustrations

SVG illustrations are simple line/shape visuals for feature concepts, e.g.:

- `ai-automation-flow.svg`
- `broadcast-campaigns.svg`
- `contact-management.svg`
- `crm-features-overview.svg`
- `sales-pipeline.svg`
- `whatsapp-crm-dashboard.svg`

Use SVG illustrations when a lightweight conceptual graphic is needed; use generated WebP dashboard mockups for hero/feature image cards.

### Image placement rules

- Public hero images sit inside rounded dark/transparent frames:
  `rounded-[34px] border border-white/10 bg-white/8 p-4 shadow-[0_32px_95px_rgba(0,0,0,0.35)]`.
- Public feature images sit inside rounded cards and often receive `group-hover:scale-[1.03]`.
- Pricing/feature images use `rounded-[24px]` or `rounded-[30px]`.
- Dashboard UI generally does not use large images; it relies on cards, icons, and tables.

## 11. Higgsfield Image Prompts

Exact original Higgsfield prompts were not found in the repo. The following templates are reconstructed from the current image style.

Installed Higgsfield-related skills exist in `.agents/skills` and `skills-lock.json`, but no exact historical prompt document was found in audited project docs/code.

### Reconstructed dashboard mockup prompt

```text
Create a realistic production SaaS dashboard screenshot for Talk Wagon CRM.

Style: dark forest-green CRM dashboard, premium business interface, bright emerald active accents, subtle amber/yellow status highlights, clean rounded cards, thin green borders, soft shadows, high contrast, readable modern typography.

Canvas: wide 16:9 desktop dashboard screenshot, no browser chrome.

Layout: left sidebar with Talk Wagon logo, navigation items, selected active emerald pill, user profile at bottom. Main area with top header, KPI cards, charts, conversation/activity panels, CRM workflow cards, status badges, and compact action buttons.

Visual details: rounded 24px-34px cards, dark green/black backgrounds, emerald icons and progress indicators, amber warning/offer badges, clean spacing, realistic SaaS UI, no clutter.

Avoid: official WhatsApp logo, Meta logo, people/faces, real API keys, private credentials, watermarks, browser chrome, blue/purple theme, noisy gradients.
```

### Reconstructed public hero image prompt

```text
Create a premium SaaS marketing hero image showing a CRM dashboard mockup.

Style: dark forest-green dashboard inside a rounded card frame, emerald green active states, subtle amber highlights, clean charts, message inbox panels, customer cards, workflow steps, and polished production UI.

Composition: dashboard mockup angled or front-facing inside a rounded frame, suitable for a website hero section. Use high contrast, soft shadows, realistic UI spacing, no browser chrome.

Colors: #07130e background, #0d1b15 panels, #3ddf84 active accents, #ffbd29 status highlights, #d8fff1 text accents.

Avoid: real personal data, real API keys, official WhatsApp/Meta logos, people/faces, cluttered cards, blue/purple theme.
```

### Reconstructed feature-card prompt

```text
Generate a 1168x880 WebP-style SaaS product illustration for a CRM feature.

Subject: [feature name, e.g. team inbox, broadcast campaigns, automation workflows, sales pipeline, permissions].

Style: realistic dashboard UI panel, dark forest-green theme, rounded cards, emerald primary accents, subtle amber status details, clean data tables/charts/messages, modern readable typography, high contrast.

Output should look like a real production CRM screenshot cropped for a website feature card. No browser chrome. No private data. No official third-party logos.
```

### Reconstructed pricing image prompt

```text
Create a pricing/plan comparison dashboard image for a SaaS CRM.

Style: dark forest-green dashboard card layout, plan cards with rounded corners, emerald CTAs, amber offer badges, clean billing metrics, usage analytics, comparison rows, premium SaaS polish.

Canvas: 1168x880, website card image, no browser chrome, no real payment card details, no private credentials.
```

Prompt guidance:

- Keep generated images consistent with existing WebPs.
- Prefer 1168x880 for page/card images.
- Use 2336x1744 only for large homepage hero/dashboard images.
- Use dark dashboard UI inside public light pages.
- Do not use unrelated illustration styles.

## 12. Installed Skills / Tools in This Project

The following project-local tools/skills were visible.

| Skill/tool | Location | Purpose | UI/image relevance | Limitations |
| --- | --- | --- | --- | --- |
| `firecrawl-scrape` | `.agents/skills/firecrawl-scrape/SKILL.md` | Extract clean markdown from URLs, including JS-rendered pages | Useful for auditing external pages/content before designing import UI or documentation | Not a UI generator |
| `higgsfield-generate` | `.agents/skills/higgsfield-generate/SKILL.md` | Generate images/videos via Higgsfield models | Main project-local image generation skill for dashboard mockups, marketing images, and UI visuals | Requires external Higgsfield setup/API; do not expose secrets |
| `higgsfield-marketplace-cards` | `.agents/skills/higgsfield-marketplace-cards/SKILL.md` | Marketplace product image card generation | Mostly not relevant to CRM dashboard unless creating marketplace/listing visuals | Not for generic CRM dashboards |
| `higgsfield-product-photoshoot` | `.agents/skills/higgsfield-product-photoshoot/SKILL.md` | Brand/product image generation and prompt enhancement | Useful for brand hero/banner/product-like visuals, less relevant to CRM UI screenshots | Better for product photography than dashboard screenshots |
| `higgsfield-soul-id` | `.agents/skills/higgsfield-soul-id/SKILL.md` | Train/use identity-faithful avatar/face model | Not recommended for current CRM UI style because assets avoid people/faces | Requires personal images and identity handling |
| `skills-lock.json` | project root | Locks installed skill metadata and source hashes | Useful for recreating the same local skill setup in another environment | Does not contain prompts |
| `.agents/*.mjs/json` scratch files | `.agents/` | Prior local testing scripts/results | Not design-system source; avoid copying to second CRM | Scratch/testing artifacts |
| `scripts/tmp-ui-200-test.mjs` | `scripts/` | Prior UI/RAG testing helper | Not part of design system | Scratch/testing artifact |

Also relevant non-skill UI tooling:

| Tool/library | Location | Purpose |
| --- | --- | --- |
| Tailwind CSS v4 | `src/app/globals.css`, `package.json` | Utility-first styling and CSS theme variables |
| shadcn/base-nova config | `components.json` | UI primitive configuration and aliases |
| Base UI React | `package.json`, `src/components/ui/*` | Primitive UI components |
| Lucide React | `package.json` | Icon system throughout dashboard/public UI |
| `tw-animate-css` | `src/app/globals.css`, `package.json` | Animation utility classes |

No secrets, API keys, or environment values were inspected or documented.

## 13. Reusable UI Rules for Second CRM

Checklist for recreating this style:

- Use `#07130e` as the main dashboard background.
- Use a dark radial/linear gradient for dashboard main content.
- Use `#3ddf84` as the primary active/action/success color.
- Use `#ffbd29` as the warning/highlight/accent color.
- Use `#17402f` and `#315846` for dark green borders.
- Keep cards rounded: `rounded-2xl`, `rounded-3xl`, or explicit `24px-34px`.
- Use thin green borders on every important dashboard card.
- Use persistent card borders; do not rely only on hover.
- Use muted mint text for descriptions and helper text.
- Use Lucide line icons.
- Keep dashboard buttons compact and rounded-xl.
- Keep public marketing CTAs rounded-full.
- Use amber hover on important green CTAs when it fits the brand.
- Keep sidebar active state as emerald pill with dark text.
- Use dark dropdowns and modals inside the dashboard.
- Use light public sections with white/mint cards, but keep dark green/emerald brand continuity.
- Use generated dashboard mockup images with dark forest-green UI.
- Use 1168x880 WebP for feature/pricing image cards.
- Use 2336x1744 for large hero dashboard image if needed.
- Keep mobile drawer/sidebar patterns.
- Keep public header mobile hamburger menu clean and high contrast.
- Avoid horizontal overflow; use `min-w-0`, wrapping, and constrained widths.

## 14. Do/Don’t Rules

### Do

- Use consistent green/amber status colors.
- Keep dark dashboard contrast strong.
- Use rounded cards and rounded action buttons.
- Use readable typography and bold headings.
- Use compact, purposeful buttons.
- Use emerald for selected navigation and primary actions.
- Use amber for warnings, pending states, and offer highlights.
- Keep borders visible but not neon.
- Use soft shadows for depth.
- Use generated UI images that look like real SaaS screenshots.
- Keep sensitive settings masked in UI.
- Keep public pages airy with strong section spacing.

### Don’t

- Do not switch the dashboard to a blue/purple theme.
- Do not use low-contrast grey text on dark green.
- Do not overuse gradients inside cards.
- Do not clutter cards with too many competing badges.
- Do not mix image styles across pages.
- Do not use inconsistent button colors.
- Do not use official WhatsApp/Meta logos in generated imagery.
- Do not show real API keys, tokens, emails, phone numbers, or private credentials in mockups.
- Do not make dashboard cards white inside the authenticated app.
- Do not introduce heavy glassmorphism that fights the practical CRM feel.

## 15. Quick Copy Template for New CRM

Paste this into another project/Codex prompt to recreate the same visual system:

```text
Build the CRM UI in the Talk Wagon visual style:

Use a premium dark forest-green SaaS dashboard theme. Main app background should be near-black green (#07130e) with a subtle emerald radial glow and dark vertical gradient. Cards should use dark green surfaces (#0d1b15 / #0b241c), rounded 2xl/3xl corners, thin visible green borders (#3ddf84 at 40-60% opacity), and soft black shadows. Primary actions, active sidebar items, success badges, and progress bars should use bright emerald #3ddf84 with dark text #07130e. Warning, pending, offer, and incomplete setup states should use amber #ffbd29 with subtle amber borders/background tints.

Use a fixed left sidebar on desktop and a mobile drawer below lg. Sidebar background: #07130e. Active nav item: emerald rounded pill with dark text and soft emerald shadow. Header: h-14, dark green, bottom border #17402f, compact white page title, user avatar dropdown.

Dashboard typography should be modern sans-serif, high contrast, with bold white headings, muted mint descriptions (#b8cfc7 / #8bb4a5), compact text-sm controls, and tabular numeric metrics. Buttons inside the dashboard should be compact rounded-xl green buttons with amber hover. Public marketing pages can use light #f7fbf8 and white sections, dark green headings, pale mint cards (#f4fff9), rounded-full CTAs, and large generated dashboard mockup images.

Inputs/selects/textareas should be dark (#07130e), border #315846, white text, muted green placeholders, and emerald focus rings. Modals should be dark green, rounded-3xl, bordered emerald, with scrollable bodies and compact footer actions. Progress bars should use dark tracks and emerald/amber fills.

For generated images: create realistic production SaaS dashboard screenshots, wide 16:9 or 1168x880 card images, dark forest-green CRM panels, emerald active accents, subtle amber highlights, rounded cards, clean typography, no browser chrome, no people/faces, no official WhatsApp/Meta logos, no real credentials, no watermark.
```

