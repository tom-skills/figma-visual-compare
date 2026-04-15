# Figma Visual Compare

Canonical skill instructions live in `../../SKILL.md`.

Use this workflow when the user wants exact visual comparison between a local implementation and a Figma reference.

## Rules

- Prefer the smallest stable compare selector.
- Prefer component root selectors over page-level selectors.
- Never trust a run whose selector is `#storybook-root`.
- Keep `--trim-whitespace false` unless whitespace is the bug.
- Keep `--top-left-anchor true` for fixed-size component screenshots.
- Prefer fixing compare input before changing implementation layout.

## Command

```bash
node <path-to-skill>/scripts/figma-visual-compare.cjs --story-id <story-id> --selector '<selector>' --figma '<figma-url-or-file>'
```

Direct image diff:

```bash
python3 <path-to-skill>/scripts/image_diff.py --reference <figma.png> --actual <impl.png>
```
