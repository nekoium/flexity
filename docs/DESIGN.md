<!-- SEED: re-run $impeccable document once there's code to capture the actual tokens and components. -->

---
name: Flexity
description: A JSON-native, markdown-first information model — one composable model, many views.
---

# Design System: Flexity

## 1. Overview

**Creative North Star: "The Quiet Workbench"**

Flexity is a tool, not a stage. The interface is a calm, clear workbench where knowledge workers rearrange composable objects into outlines, trackers, and SOPs — and the surface gets out of the way of the data. Personality is calm, clear, capable; voice is quiet confidence. References that capture the feel: Notion's clean composable blocks, Obsidian's markdown-first calm, Trello's Kanban clarity.

The system explicitly rejects glassmorphism and decorative blur (fuzzy layers between user and data), cluttered enterprise dashboards (feature overload, SaaS-by-the-pound), and overly playful or animated interfaces (bouncy motion, mascots, gamified consumer tone). Motion is responsive — feedback and transitions, never choreography. Color is restrained: tinted neutrals carry the surface, a single warm accent appears on ≤10% of any screen.

**Key Characteristics:**
- Restrained warm-neutral palette with one warm accent at ≤10% surface share
- Single humanist sans-serif, used across all hierarchy
- Flat-by-default elevation; depth conveyed through tonal layering, not shadows
- Responsive motion: state changes and feedback only, no orchestrated entrances
- Kanban-clarity in layout: columns, cards, and spatial arrangement as primary affordance

## 2. Colors

The palette is restrained: warm-neutral tinted neutrals carry the surface, a single warm accent appears sparingly to mark active state, selection, and primary action. Body background must NOT default to the saturated cream/sand/paper band — warmth is carried by the accent and typography, not by tinting the body bg toward warm. A true off-white or near-neutral surface is preferred; the accent carries the warmth.

### Primary
- **Warm Accent** (`[to be resolved during implementation]`): The single saturated warm hue. Used for active state, selection, primary action. Anchor hue family: warm neutral / sand-adjacent (terracotta, ochre, warm clay). Resolved at implementation.

### Neutral
- **Surface** (`[to be resolved]`): Primary body background. True off-white or near-neutral; NOT a cream/sand tint. Lightness ~0.97-0.98, chroma ≤0.005.
- **Surface Raised** (`[to be resolved]`): Cards, columns, raised containers. One tonal step above Surface.
- **Ink** (`[to be resolved]`): Primary body text. Near-black with slight warm undertone. ≥4.5:1 contrast on Surface.
- **Ink Muted** (`[to be resolved]`): Secondary text, labels, metadata. Still ≥4.5:1 on Surface — never the muted-gray-on-tinted-white failure.
- **Border / Divider** (`[to be resolved]`): Hairline separators and card outlines. Subtle, warm-neutral.

### The Restrained Rule
The warm accent is used on ≤10% of any given screen. Its rarity is the point — it marks what matters (active card, selected column, primary action) and nothing else.

## 3. Typography

**Display Font:** Single humanist sans-serif (Inter, Geist Humanist, or similar) — `[font to be chosen at implementation]`
**Body Font:** Same family, varied weight and size.
**Label/Mono Font:** Same family at smaller sizes for labels; a mono companion may be added later for JSON/code samples (markdown-first model).

**Character:** One humanist sans does all the work. Hierarchy is carried by weight and size, not by font pairing. Calm, legible, tool-like — never editorial or decorative.

### Hierarchy
- **Display** (600, `clamp(2rem, 5vw, 3.5rem)`, 1.1): Page-level headings; the page title of a board or view. `text-wrap: balance`.
- **Headline** (600, ~1.75rem, 1.2): Section headings within a view.
- **Title** (500, ~1.25rem, 1.3): Card titles, column headers, dialog titles.
- **Body** (400, 1rem / 16px, 1.5): Primary text, descriptions, card content. Capped at 65–75ch.
- **Label** (500, 0.8125rem / 13px, 0.02em letter-spacing): Buttons, metadata, column counts. Sentence case, not uppercase-tracked.

### The One Voice Rule
One family. Hierarchy through weight and size only. Don't introduce a second sans "for variety" — that's the AI-pairing reflex.

## 4. Elevation

Flat by default. Depth is conveyed through tonal layering (Surface → Surface Raised → Surface Raised Higher) and hairline borders, not shadows. The Kanban metaphor already provides spatial structure (columns, cards); piling shadows on top would muddy it.

Shadows appear only as a response to state — a card being dragged, a dialog open — and even then, sparingly. Restrained motion energy means restrained elevation.

### The Flat-By-Default Rule
Surfaces are flat at rest. A shadow is a state signal (dragging, modal), never decoration.

## 5. Components

*No components are documented yet — this is a seed. The next `$impeccable document` pass, once there's code, will extract the canonical primitives: board, column, card, view-switcher (outline / tracker / SOP), and primary action. Until then, the principles above guide any implementation: flat surfaces, hairline borders, single warm accent on state only, single humanist sans.*

## 6. Do's and Don'ts

### Do:
- **Do** keep the warm accent to ≤10% of any screen. It marks state and primary action — nothing else.
- **Do** use a true off-white or near-neutral body background. Warmth is carried by the accent and typography, not by tinting the surface toward cream/sand.
- **Do** keep body text at ≥4.5:1 contrast against its background, including muted labels.
- **Do** use tonal layering (Surface → Surface Raised) and hairline borders for depth, not shadows.
- **Do** cap body line length at 65–75ch and use `text-wrap: balance` on headings.
- **Do** respect `prefers-reduced-motion`: state transitions crossfade or go instant, never rely on choreography.

### Don't:
- **Don't** use glassmorphism, frosted blur, or decorative backdrop-filter. The model is the product; fuzzy layers between user and data are wrong.
- **Don't** tint the body background into the cream/sand/paper band (OKLCH L 0.84-0.97, C < 0.06, hue 40-100). That's the saturated AI default of 2026 and reads as "AI made that."
- **Don't** use shadow as decoration. Shadows are state signals only (drag, modal), never resting elevation.
- **Don't** pair a second sans "for variety." One humanist sans does all the work; hierarchy is weight and size.
- **Don't** add bouncy, elastic, or choreographed motion. Responsive feedback only — state changes and transitions, never orchestrated entrances.
- **Don't** add a tiny uppercase tracked eyebrow above every section, or `01 / 02 / 03` numbered markers as scaffolding. These are AI-template tells.
- **Don't** build cluttered enterprise-style toolbars or feature-overloaded surfaces. One model, many views — not every feature on one screen.
- **Don't** use `border-left` greater than 1px as a colored accent stripe on cards or list items. Use full borders, background tints, or nothing.
