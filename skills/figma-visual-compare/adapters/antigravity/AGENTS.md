# Figma Visual Compare

Canonical skill instructions live in `../../SKILL.md`.

Use this when the task is to measure UI parity against a Figma design with exact visual diff artifacts.

1. Choose the smallest stable compare target.
2. Prefer a Storybook component story over a docs page.
3. Prefer a root selector such as `[data-testid="..."]`.
4. Pass Figma `node-id` URLs directly when available.
5. Run the compare command.
6. Review `report.json`, `diff.png`, `story.actual.png`, and `figma.normalized.png`.
7. If needed, patch and rerun.

```bash
node <path-to-skill>/scripts/figma-visual-compare.cjs --story-id <story-id> --selector '<selector>' --figma '<figma-url-or-file>'
```
