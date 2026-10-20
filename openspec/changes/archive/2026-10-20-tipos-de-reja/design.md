# Design

## Context

See proposal.md — Why. The app is a React + TypeScript + Vite calculator whose domain lives in `src/core/` (geometry, cutting, materials, obra, budget) and whose persistence is `localStorage` via `obra.ts`. The geometry engine (`computeDesign`) currently assumes a single style (structural pipe frame + round bars) and a single product (window). Types, profiles, and UI are tightly coupled to that assumption. This design adds a style axis and a product-kind axis without breaking the existing pipeline.

## Goals / Non-Goals

**Goals:**
- Introduce `RejaStyle` (`moderna` | `clasica`) and `ProductKind` (`ventana` | reserved future values) into `ProjectConfig`.
- Make `computeDesign` dispatch by `(productKind, style)` via a single resolver, keeping `moderna`/`ventana` behavior identical.
- Implement `clasica`/`ventana` by reusing the inserted-bar geometry with a planchuela frame profile.
- Extend the default catalog with Argentine-standard planchuelas and solid bars.
- Normalize persisted configs to `moderna`/`ventana`.
- Keep cutting, materials, budget, and PDF pipelines product/style-agnostic.

**Non-Goals:**
- No geometry for puertas, portones or frentes (reserved values only).
- No square solid bars in this change (round solid bars only); square bars are a future extension.
- No change to the optimizer, budget formulas, or PDF layout beyond labels.
- No migration of the catalog beyond adding new default entries (existing user catalogs keep their entries).

## Decisions

### D1 — Style and product kind live in `ProjectConfig`

Add two fields to `ProjectConfig`: `style: RejaStyle` and `productKind: ProductKind`. They are per-reja (like the rest of the config) so an obra can mix styles. Default both to `moderna` and `ventana`. This keeps the migration path simple: `normalizeConfig` fills missing fields via `deepFill` against `DEFAULT_CONFIG`, which now includes them.

Alternative considered: a separate `RejaMeta` object outside `ProjectConfig`. Rejected because persistence, duplication, and `configWithCutting` already operate on `ProjectConfig`; splitting would require touching every call site.

### D2 — Single dispatch point in geometry

Introduce `computeDesignFor(config, catalog)` that switches on `config.productKind` then `config.style`, delegating to `computeWindowModerna` (the current `computeDesign` body, renamed) and `computeWindowClasica`. The public `computeDesign(config, catalog)` becomes the dispatcher. This gives one extension point: a new product only needs a new branch and its own function, and the rest of the pipeline is untouched.

Alternative considered: subclassing/strategy objects. Rejected as over-engineering for a TS codebase that already uses plain functions; a switch is simpler and tree-shakeable.

### D3 — Clásica reuses inserted-bar geometry

The classic reja (planchuela frame + solid round bars inserted in side holes) maps directly onto the existing `ends: 'inserted'` path with a planchuela as the frame profile and the solid bar as the round profile. Therefore `computeWindowClasica` can call the same core calculation with `ends` forced to `inserted` and a planchuela-compatible frame, rather than duplicating the formula. The only differences are catalog defaults and which profiles are recommended.

Trade-off: forcing `inserted` means the classic style does not support butt-ended bars. That matches the real construction (bars always pass through the planchuela holes), so it is acceptable. If a butt variant is needed later, it becomes a new style value.

### D4 — Planchuelas are `RectProfile`, solid bars are `RoundProfile`

No new profile kinds are introduced. A planchuela is a `RectProfile` with a large in-plane side and a small thickness (e.g. 25.4 × 4.76). A solid bar is a `RoundProfile` (existing). This keeps `sectionKey`, `computeMaterials`, and the optimizer working unchanged, and avoids a migration of the catalog shape.

Alternative considered: a dedicated `FlatProfile` kind. Rejected because it would require changes across types, materials, cutting, and UI for no behavioral gain; the existing rect profile already models width × thickness.

### D5 — Catalog additions are defaults only

`DEFAULT_CATALOG` gains planchuela and solid-bar entries. Existing persisted catalogs are not overwritten (the UI already lets users restore defaults). This avoids destroying user edits while making the standard measures available out of the box. Labels follow the existing Spanish conventions ("Planchuela 1" × 3/16"", "Hierro macizo redondo Ø12,7 mm").

### D6 — Product-kind resolution returns "not implemented"

For any `productKind !== 'ventana'`, `computeDesign` returns a design with a single error issue (`product-not-implemented`) and no pieces, so the app shows the message and produces no cuts. This keeps the reserved values type-safe and exercisable in tests without faking geometry.

### D7 — UI selector placement

The style selector goes in section 2 (Perfiles), next to the profile pickers, because the available profiles depend on the style (classic shows planchuela/solid-bar defaults). The product-kind selector is hidden until more than `ventana` is implemented, but the type and plumbing are present so future work only adds UI.

## Risks / Trade-offs

- [Clásica reuses inserted geometry] → The classic frame depth (planchuela thickness) is much smaller than the bar OD, so the existing `bar-wider-than-frame` warning will fire. Mitigation: make that warning style-aware (skip for `clasica`, where bars intentionally protrude through a thin planchuela).
- [Catalog growth] → Adding planchuelas to the same rect list mixes them with structural profiles in the dropdowns. Mitigation: filter/label in the UI by a `usage` hint or by style; acceptable for now because the profile pickers are already long.
- [Persisted data] → Older configs lack `style`/`productKind`. Mitigation: `deepFill` + explicit normalization in `normalizeConfig` and `makeConfig` defaults.
- [Future products] → Reserved enum values with no implementation could be mistaken for working features. Mitigation: UI does not expose them and `computeDesign` emits `product-not-implemented`.

## Migration Plan

1. Add types and defaults.
2. Add catalog entries.
3. Refactor `computeDesign` into dispatcher + `computeWindowModerna` + `computeWindowClasica`.
4. Update `normalizeConfig` and `makeConfig`.
5. Add UI selector and style-aware warnings.
6. Update docs.
7. Rollback: revert the commit; persisted configs with extra fields are ignored by `deepFill` of older code only if fields are unknown — older code's `normalizeConfig` would drop them via `deepFill` (base has no such keys), so rollback is safe.

## Open Questions

None — all decisions needed to start implementation are resolved above.