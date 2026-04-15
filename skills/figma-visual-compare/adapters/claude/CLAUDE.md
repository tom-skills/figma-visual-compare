# Figma Visual Compare

Canonical skill instructions live in `../../SKILL.md`.

When a user asks to compare an implementation against a Figma node or design:

1. Find the smallest stable compare target.
2. Prefer Storybook story iframes over docs pages.
3. Prefer a component root selector such as `[data-testid="..."]`.
4. Pass Figma `node-id` URLs directly to the compare script when available.
5. Run:

```bash
node <path-to-skill>/scripts/figma-visual-compare.cjs --story-id <story-id> --selector '<selector>' --figma '<figma-url-or-file>'
```

6. Validate `report.json` before trusting the result.
7. Report mismatch ratio, artifact paths, and the main remaining visual mismatches.
8. If asked to continue, patch the UI and rerun.
