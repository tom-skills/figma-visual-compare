---
name: figma-visual-compare
description: Use when the user wants to compare an implementation against a Figma node, screenshot, or design URL and produce exact visual diff artifacts. Best for Storybook- or Playwright-based UI checks that should report mismatch ratio, diff images, and the biggest remaining visual mismatches.
---

# Figma Visual Compare

Use this skill when a user asks how close an implementation is to a Figma design.

## Goal

Compare a local implementation against a Figma design as precisely as possible, using this skill's bundled compare scripts instead of manual screenshot guessing.

## Workflow

1. Identify the smallest stable compare target.
   - Prefer a dedicated Storybook story over a docs page.
   - Prefer a component root selector such as `--selector '[data-testid="..."]'`.
   - Selector priority:
     1. component data-testid root
     2. component story wrapper selector
     3. `#storybook-root > *` as the last fallback
   - Never use `#storybook-root` itself as the compare selector for component-level visual diff.
   - If the compare report shows `"selector": "#storybook-root"`, treat that run as invalid and rerun.
2. If the user gives a Figma design or file URL with `node-id`, pass it directly to the compare script.
3. If the component depends on relative time, freeze it with `--mock-date`.
4. Run the bundled compare script from the repository root. Replace `<path-to-skill>` with this skill folder path:

```bash
node <path-to-skill>/scripts/figma-visual-compare.cjs --story-id <story-id> --figma <figma-source>
```

5. Report:
   - `mismatchRatio`
   - `diff.png`
   - `story.actual.png`
   - `figma.normalized.png`
   - the main remaining visual mismatches
6. If the user asks to keep fixing the UI, inspect the largest diff regions, patch the code, and rerun compare.

## Supported Figma sources

`--figma` may be:

- a local image file
- a direct image URL
- a Figma design or file URL with `node-id`

The bundled compare script supports direct Figma design and file URLs. It reads `FIGMA_API_TOKEN` or `FIGMA_TOKEN` from local env files and exports the node PNG with `use_absolute_bounds=true`.

## Compare guidance

- Keep `--trim-whitespace false` unless whitespace itself is the bug.
- Keep `--top-left-anchor true` when comparing fixed-size component screenshots.
- Keep `--fit-reference-window true` when the Figma export may include extra frame padding.
- After each run, inspect `report.json` before trusting the result:
  - `selector` should be the component root or fallback `#storybook-root > *`, never `#storybook-root`
  - `story.width` and `story.height` should be close to the component bounds, not a much larger canvas
- If the diff shows a solid bar on the left or top edge, suspect Figma export padding first.
- Prefer fixing compare input with `--reference-inset` or `--actual-inset` before changing implementation layout.
- Do not change Storybook chrome or docs layout just to satisfy the diff.

## Patching guidance

- Fix structure and spacing before text rendering details.
- If structure is already aligned, then adjust:
  - font size
  - line-height
  - inline spacing
  - border thickness
  - icon placement
- Do not change font family unless the user explicitly asks for that.

## Repo commands

Primary compare command:

```bash
node <path-to-skill>/scripts/figma-visual-compare.cjs --story-id <story-id> --selector '<selector>' --figma '<figma-url-or-file>'
```

Direct file-to-file diff:

```bash
python3 <path-to-skill>/scripts/image_diff.py --reference <figma.png> --actual <impl.png>
```

## DayPicker example for this repo

```bash
node <path-to-skill>/scripts/figma-visual-compare.cjs \
  --story-id compositions-daypicker--figma-last-seven-days-reference \
  --selector '[data-testid="daypicker-root"]' \
  --figma 'https://www.figma.com/design/9dw6LAxiZBhDdPzFjxpy76/Galaxy-Library?node-id=1573-14555&m=dev' \
  --mock-date 2025-06-29T00:00:00Z \
  --trim-whitespace false \
  --top-left-anchor true
```

For `DayPicker`, the selector should be:

```bash
--selector '[data-testid="daypicker-root"]'
```

If a run used `#storybook-root`, discard it and rerun.
If `daypicker-root` is temporarily unavailable, fallback to:

```bash
--selector '#storybook-root > *'
```

## Expected behavior

When the user says things like:

- compare this component with Figma
- run visual diff
- how close is this to the design

you should:

1. identify or create the correct Storybook state
2. run the compare command
3. inspect the biggest diff regions
4. patch the implementation
5. rerun until the score drops materially

## Notes for portability

- This skill bundles `figma-visual-compare.cjs` and `image_diff.py` under `scripts/`.
- It still expects to be run from a repository that has Storybook, Playwright, and the target implementation available.
- Product-specific adapters live under `adapters/`. Treat `SKILL.md` as the source of truth.
