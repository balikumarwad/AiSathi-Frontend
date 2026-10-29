# AIsathi homepage design and implementation plan

29 October 2026 · Homepage only · Proposed development folder A:\Aisathi-Frontend

## Direction

Build an approachable Nepali AI brand around a practical promise: leading AI models, accessible through local payments. Keep the AIsathi name, recognizable existing symbol, and coral accent. Make the experience useful to both chat users and developers without implying that enterprise features are already available.

The supplied screenshot is the visual baseline. Its dark surfaces, coral action buttons, model-logo collection, and bilingual headline provide useful continuity. The crowded particle effects compete with the product message; the mixed model counts and credit presentation require clearer explanation. The current source repository and original vector logo have not been supplied, so stack, integrations, and precise logo geometry remain unverified.

Springbase's welcome page provides inspiration for concise language and product demonstrations. Borrow the principle of showing what the product does; develop AIsathi's own composition and identity. Its subscription, agents, and connected-workspace claims do not transfer to AIsathi.

## Brand concept — Your local connection to AI

Use an editorial, warm-paper canvas with near-black typography, coral actions, and occasional dark product panels. This preserves the current accent while creating a more welcoming reading experience. Avoid a generic national flag treatment or Himalayan illustration unrelated to the product.

Proposed tokens: paper #F7F5EF; ink #20211F; muted ink #595B55; coral #B93629 for accessible primary buttons; light coral #FCE7E1; border #D8D9D1. Verify actual contrast for every use. Prefer a clear sans-serif with a suitable Devanagari fallback, restrained weights, generous line spacing, and tabular numbers for prices. Self-host licensed fonts where available; preserve a reliable system fallback.

Keep the current logo as the primary mark once a usable asset is located. Explore an optional secondary motif of two interlocking paths suggesting companionship and connection. It should work at favicon size and in one color. Do not replace the official mark with a guessed tracing from the screenshot. Use the wordmark temporarily if the source asset cannot be recovered.

Voice: practical, friendly, precise. Use Nepali selectively where it improves recognition. No revolutionary, cheapest, enterprise-ready, guaranteed privacy, or uptime claims without evidence.

## Signature visual and interaction ideas

1. **A local connection diagram:** eSewa/Khalti labels flow through the AIsathi symbol toward a small set of verified model families. One subtle path highlight explains the relationship; the static version remains complete. Present providers as supported technology, not partners.
2. **Two useful entry points:** a compact Chat / Build with the API switch changes a clearly labeled product explanation. Chat shows the actual model-selection workflow; API shows a copyable, tested request. No fake model response or invented dashboard.
3. **Rupee-first pricing:** show what the user pays, what the balance represents, and where model-specific consumption is explained. Avoid an invented token calculator until authoritative tariffs are available.
4. **Evidence in the interface:** use working docs, transparent model pricing, and clear billing explanations as trust signals. Do not fill empty space with fake testimonials or certifications.

## Homepage sequence

**Header:** existing brand, Models, How it works, Pricing, Docs, Sign in. A mobile menu with keyboard focus, Escape dismissal, and proper expanded state. Use verified existing destinations.

**Opening:** headline proposal: “Your AI. Your choice. Pay in रुपैयाँ.” Supporting copy: “Chat with leading AI models or connect them to your app. Top up in Nepali rupees with eSewa or Khalti.” Verify operational availability before release. Primary action: Start chatting. Secondary: Explore the API. Pair with the connection diagram, not a fabricated live dashboard.

**Product explanation:** “One place to choose your model.” Show a faithful, labeled preview and the Chat/API switch. Keep the main proposition legible without interaction. Do not imply model subscriptions are included or that every API feature is compatible.

**How payment works:** a short horizontal sequence on desktop, vertical on mobile: choose a model, add balance, pay for usage. Explain variable costs and link to exact pricing. Clarify whether package bonuses are already included.

**Developer section:** a dark, quiet code panel with copy feedback and verified base URL. Explain the supported endpoint and link to current docs. Do not promise unrestricted compatibility with all coding tools.

**Pricing:** two restrained package columns only after credit/bonus totals and current prices are confirmed; otherwise link to the authoritative pricing page. Explain consumption and relevant conditions beside the prices, not only in an FAQ.

**Practical questions:** local payments, chat versus API, how credits are consumed, model availability, and privacy. Answers must reflect current product behavior and actual policies.

**Closing and footer:** repeat the primary action, show verified support/legal destinations and legal identity when available. No invented addresses or company registration details.

## Implementation sequence

1. Make A:\Aisathi-Frontend writable by opening it as the project workspace. Inspect any existing frontend source, instructions, package manifest, routes, assets, and uncommitted changes before editing.
2. Save this plan under docs/ in the development folder. Record verified routes and claims in a small content checklist.
3. Reuse the existing stack if source is available. If this is a separate frontend concept, use the smallest suitable implementation and label integration boundaries explicitly. Do not infer Next.js merely from the prior audit.
4. Define scoped design tokens and reusable header, buttons, section layout, pricing, and FAQ primitives. Avoid changing styles for internal pages.
5. Build the complete responsive page, then the small product-mode switch, accessible navigation, FAQ, and copy control. Use CSS/SVG for the connection visual; no animation library is needed.
6. Inspect rendered layouts at 360, 390, 768, 1280, and 1440 pixels. Check keyboard operation, focus, contrast, reduced motion, overflow, font loading, CTA destinations, and copying. Run applicable project build/lint checks.
7. Deliver the local preview and source with a short verification record and any integration dependencies. Publishing is outside this initial local build.

## Scope and efficiency

One chosen design direction, one homepage, one coherent review pass followed by necessary fixes. Reuse the research already completed. No new business audit, backend changes, speculative internal pages, broad dependency installation, or generated imagery unless a concrete need appears.

## Current blockers

The attempt to create A:\Aisathi-Frontend returned access denied. This chat can write in its Documents workspace, but A:\ is outside its allowed writable roots and approval escalation is disabled. Open the A-drive folder as a project to authorize implementation there. No development folder or homepage implementation has been created on A:\.

The source repository and original logo asset need discovery in the selected development workspace. A PDF capture cannot verify framework conventions or preserve live integrations by itself.
