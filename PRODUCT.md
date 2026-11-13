# Product

## Register

product

## Users

Solo operator or single household: someone self-hosting a workflow to find pharmacies, call them, and record what they were told about medication availability. Context is often stress, time pressure, or repeat outreach—not a clinical team or multi-tenant admin.

## Product Purpose

Personal Medfinder organizes pharmacy discovery and outreach: search sessions (medication, location, radius), a stock-status map, per-pharmacy contact logs (notes, quotes, next steps), optional AI voice calls (Vapi), and exports. It is explicitly **not** a real-time inventory guarantee; it helps you **coordinate calls and notes** when public stock data is unavailable.

## Brand Personality

Practical, calm, and honest: the UI should feel like a trustworthy notebook with a map, not a growth-marketed health app. Voice: plain language, clear limits (disclaimers welcome), no manufactured urgency. Three words: **straightforward**, **grounded**, **respectful**.

## Anti-references

- Fake certainty about stock or “live” inventory heroics.
- Dense clinical or insurance jargon as default chrome.
- SaaS dashboard clichés: gradient hero metrics, ornamental motion, or novelty for its own sake.
- Anything that implies HIPAA-grade or enterprise deployment when this is a **personal, self-hosted** tool.

## Design Principles

1. **Task first** — Every screen answers “what do I do next?” (call, log, scan map, export) before secondary stats.
2. **Honest limits** — Surfaces uncertainty where the domain is uncertain; disclaimers are part of the product, not fine print buried away.
3. **Earned familiarity** — Controls and patterns should feel predictable for a tool someone lives in during a shortage; avoid decorative one-offs.
4. **Density with relief** — Tables, maps, and logs can be information-rich; use hierarchy, spacing, and semantic color—not noise—to scan.
5. **Personal scope** — Optimize for one person’s workflow; multi-user and org features are out of scope unless explicitly added later.

## Accessibility & Inclusion

Target **WCAG 2.2 AA** for text contrast, focus visibility, and keyboard paths on forms, nav, map fallbacks, and drawers. Respect **prefers-reduced-motion** for page and drawer animations. Do not rely on color alone for stock status (pair with labels or icons). Voice and telephony features are optional; core flows must work without them.
