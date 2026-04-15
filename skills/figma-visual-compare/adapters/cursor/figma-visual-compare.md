# Figma Visual Compare

Source of truth: `../../SKILL.md`

Use this skill when the user wants to compare an implementation against a Figma node, screenshot, or design URL and produce exact visual diff artifacts.

## Workflow

1. Identify the smallest stable compare target.
   - Prefer a dedicated Storybook story over a docs page.
   - Prefer a component root selector such as `--selector '[data-testid="..."]'`.
   - Use `#storybook-root > *` only as the last fallback.
   - Never use `#storybook-root` itself for component-level visual diff.
2. If the user gives a Figma design or file URL with `node-id`, pass it directly to the compare script.
3. If the component depends on relative time, freeze it with `--mock-date`.
4. Run:

```bash
node <path-to-skill>/scripts/figma-visual-compare.cjs --story-id <story-id> --selector '<selector>' --figma '<figma-url-or-file>'
```

5. Report:
   - `mismatchRatio`
   - `diff.png`
   - `story.actual.png`
   - `figma.normalized.png`
   - the main remaining visual mismatches
6. If the user asks to keep fixing the UI, inspect the largest diff regions, patch the code, and rerun compare.
