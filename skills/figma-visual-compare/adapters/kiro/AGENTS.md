# Figma Visual Compare

Canonical skill instructions live in `../../SKILL.md`.

Apply this workflow when a user wants to compare an implemented UI against a Figma node or screenshot and get exact diff artifacts.

- Find the smallest stable compare target.
- Prefer dedicated Storybook stories over docs pages.
- Prefer component root selectors such as `[data-testid="..."]`.
- Run the direct compare command.
- Inspect `report.json` before trusting the result.
- Report mismatch ratio and artifact paths.

```bash
node <path-to-skill>/scripts/figma-visual-compare.cjs --story-id <story-id> --selector '<selector>' --figma '<figma-url-or-file>'
```
