# Election Dashboard UI Revamp Brief

## Product direction

Build a modern, map-first Nigerian election intelligence platform. The experience should feel like an operational command centre: fast to scan, easy to drill into, credible enough for public reporting, and substantially more polished and useful than a conventional collection of dashboard pages.

The visual reference is the supplied dark Flood Watch interface. ERAD is a feature and information-architecture reference, not a design to copy.

## Experience principles

- Use one consistent application shell across Overview, Population/PVC, Polling Units, and Election Results.
- Make the map the primary workspace, with supporting information in collapsible side panels and a contextual bottom drawer.
- Use a restrained dark theme, strong typography, clear status colours, compact controls, and generous spacing.
- Keep the most important national metrics visible without covering the map.
- Reveal detail progressively: Nigeria to state to LGA to ward to polling unit.
- Design desktop and mobile layouts together; avoid desktop-only fixed panels.
- Prioritise accessibility, keyboard operation, readable contrast, loading states, empty states, and clear error recovery.
- Show data source, freshness, completeness, and methodology wherever a number is presented.

## Reference layout

1. **Top command bar** — brand, global place/polling-unit search, election selector, live/data-freshness status, public/admin mode, theme and account controls.
2. **Status strip** — concise nationwide election or data-quality alerts and high-priority actions.
3. **Left context rail** — current module, filters, saved views, explanatory copy, and active selections.
4. **Map workspace** — choropleths, polling-unit points, clusters, boundaries, result coverage, and selected-place focus.
5. **Right tool rail** — layers, basemap, home/reset, locate, compare, measure, and export/snapshot tools.
6. **Context drawer** — selected geography summary, KPIs, party performance, trends, tables, provenance, and downloads.

## Feature direction

### Foundation

- Shared responsive application shell and reusable design tokens/components.
- Global state/LGA/ward/polling-unit search with recent searches.
- Light and dark map basemaps, layer manager, legends, and shareable filtered URLs.
- Skeleton loading, empty/error states, tooltips, keyboard shortcuts, and mobile drawers.

### Election intelligence

- Election and year switcher for presidential, governorship, senatorial, and local elections.
- National-to-polling-unit drill-down with breadcrumbs and synchronized map, cards, charts, and tables.
- Party vote totals, turnout, margin, winner, rejected votes, accreditation, PVC, and registered-voter metrics.
- Side-by-side geography, party, and election-year comparison.
- Result coverage and completeness indicators rather than presenting partial data as final.

### Integrity and monitoring

- IReV upload progress by time and geography.
- Result-sheet file type, missing/empty upload, blur/legibility, signed/stamped, cancellation, and anomaly summaries.
- Data freshness, source link, last updated time, methodology, and confidence/quality badges.
- Alert feed for unusual turnout, duplicate values, implausible totals, missing results, and delayed uploads.

### Public tools and reporting

- Find-my-polling-unit and find-my-result workflows using hierarchy, PU code, or location.
- Download filtered CSV/Excel/PDF reports and map snapshots.
- Saved views, share links, comparison reports, and print-friendly layouts.
- Plain-language insights and accessible chart/table alternatives.

### Administration

- Dataset upload/import status, validation results, publishing workflow, and audit trail.
- Manage elections, parties, map layers, source notes, announcements, and public visibility.
- Role-aware admin access and operational health indicators.

## Delivery sequence

1. Rebuild the shared shell and design system without changing the underlying data logic.
2. Revamp the Overview page as the visual standard for the rest of the product.
3. Convert Population/PVC and Polling Units into the new map-first workspace.
4. Expand Election Results with drill-down, comparisons, integrity metrics, and reporting.
5. Upgrade admin workflows, responsive behaviour, accessibility, performance, and final polish.

## Guardrails

- Do not copy ERAD branding, layouts, text, or proprietary visual assets.
- Do not sacrifice map space to permanently visible charts or filters that can be contextual.
- Do not show unexplained metrics, stale data, or partial results without status labels.
- Avoid one-off page styling; new UI work should extend the shared component system.
- Preserve working data and map behaviour during visual migrations.
