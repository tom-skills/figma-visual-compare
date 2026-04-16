# Figma Visual Compare Skill

> **中文說明請見 [README.zh-TW.md](README.zh-TW.md)**

A reusable agent skill that lets your AI agent automatically compare local UI component implementations against Figma design nodes — producing pixel-level diff reports and iterating until the layout matches.

![Workflow](docs/workflow.png)

---

## What It Does

When you ask your agent to compare a component with a Figma design, the skill:

1. **Captures** a screenshot of the component from your running Storybook
2. **Fetches** the corresponding Figma design node via the Figma API
3. **Compares** them pixel-by-pixel using the bundled comparison scripts
4. **Reports** the mismatch ratio, highlights the largest diff regions, and suggests fixes
5. **Iterates** — applies code changes and reruns until the score drops materially

---

## Real-World Example

### Iteration Progress

The agent ran the comparison, applied fixes, and reran — three times total:

| | ① Initial | ② After layout fix | ③ After inset tuning |
|---|:---:|:---:|:---:|
| **mismatchRatio** | **11.81%** | **3.52%** | **1.78%** |
| **Storybook** | ![run 1 actual](docs/iter-1-actual.png) | ![run 2 actual](docs/iter-2-actual.png) | ![run 3 actual](docs/iter-3-actual.png) |
| **diff.png** | ![run 1](docs/iter-1-diff.png) | ![run 2](docs/iter-2-diff.png) | ![run 3](docs/iter-3-diff.png) |
| **What changed** | Baseline — spacing, padding, and key widths all off | Applied `px-24`, `gap-48`, `gap-24`; corrected bottom-row widths | Tuned `--actual-inset`; layout pixel-perfect |
| **Remaining diff** | All keys and buttons misaligned | Background tint + one button label | One button label only (font rendering) |

**Figma reference** (target throughout all runs):

![Figma reference](docs/iter-figma-ref.png)


---

## How to Use

### Ask Your Agent

Once the skill is installed, just tell your agent in natural language:

> *"Compare the `<ComponentName>` Storybook story against this Figma node: `<figma-url>`. Show me the mismatch ratio and the biggest visual differences."*

> *"Run a visual diff for `<story-id>` using the Figma design at `<figma-url>`. If there are layout issues, fix them and rerun until the score improves."*

> *"How close is the current `<ComponentName>` implementation to the Figma design? Identify the diff regions and tell me what to fix."*

The agent handles everything — capturing, comparing, reporting, and iterating — until the layout converges.

### What the Agent Does Step by Step

```
1. Identify the correct Storybook story for the target component
2. Determine the best CSS selector to isolate the component
3. Capture a screenshot via Playwright + Storybook
4. Fetch the Figma design node via the Figma API
5. Run pixel comparison and output diff artifacts
6. Analyze the largest diff regions
7. Apply code fixes, then rerun — repeat until the score drops materially
```

---

## Outputs

| File | Description |
|------|-------------|
| `mismatchRatio` | Overall pixel difference ratio — `0` means perfect match |
| `diff.png` | Heatmap highlighting mismatched pixels |
| `diff.overlay.png` | Annotated diff with numbered mismatch regions |
| `story.actual.png` | Screenshot captured from Storybook |
| `figma.normalized.png` | Figma export, scaled and aligned to match the implementation |
| `report.json` | Full JSON report with region-level diff data |

---

## Prerequisites

**Quick Installer (Recommended)**

If you have already installed the skill into your repository (e.g., in `skills/figma-visual-compare`), you can run the one-click installer from your project root. It will check and install all required Node.js and Python dependencies automatically:

```bash
./skills/figma-visual-compare/install-deps.sh
```

<details>
<summary><b>Manual Installation Details</b></summary><br>

Your project needs the following before this skill can work. If anything is missing, use the install commands below.

### Node.js packages (resolved from your project)

The compare script looks for these in your **project's** `node_modules` first.

| Package | Install if missing |
|---------|--------------------|
| `@playwright/test` | `npm install --save-dev @playwright/test` |
| `sharp` | `npm install --save-dev sharp` |

After installing Playwright, also install the browser binary:

```bash
npx playwright install chromium
```

### Python packages

The pixel diff script requires Python 3.10+ with:

| Package | Install if missing |
|---------|--------------------|
| `numpy` | `pip install numpy` |
| `Pillow` | `pip install Pillow` |

Or install both at once:

```bash
pip install numpy Pillow
```

### Figma access

| Requirement | How to set it up |
|-------------|------------------|
| **Figma MCP** | Configure Figma MCP in your agent's MCP settings so the agent can read design node data |
| **Figma API Token** | Create a token at [figma.com/settings](https://www.figma.com/settings) → Personal access tokens, then set `FIGMA_API_TOKEN=<token>` in your `.env` or shell |

### Storybook

The skill starts Storybook automatically if it isn't already running. Your project must have Storybook installed and the target component must have a story.

If Storybook fails to start, run it manually before triggering the agent:

```bash
npm run storybook
```

</details>

---

## Installation

### Using `npx skill add` (Recommended)

Project-local install:

```bash
npx skill add https://github.com/gh286991/figma-visual-compare --skill figma-visual-compare
```

Global install:

```bash
npx skill add https://github.com/gh286991/figma-visual-compare --skill figma-visual-compare --global
```

Preview available skills before installing:

```bash
npx skill add https://github.com/gh286991/figma-visual-compare --list
```

### Claude

Copy `skills/figma-visual-compare/` to:

```
~/.claude/skills/figma-visual-compare/
```

If your Claude environment supports custom skill uploads, package and upload the folder directly.

### Cursor

Copy the adapter file into your project:

```
skills/figma-visual-compare/adapters/cursor/figma-visual-compare.md
  → .cursor/skills/figma-visual-compare.md
```

### AGENTS-style Tools

Copy the appropriate file from `skills/figma-visual-compare/adapters/` into your tool's `AGENTS.md` or equivalent instruction file.

---

## Compatibility

| Tool | Install Method |
|------|---------------|
| Claude | `~/.claude/skills/` or `npx skill add` |
| Codex | `~/.codex/skills/` or `npx skill add` |
| Cursor | `.cursor/skills/` adapter |
| AGENTS-style tools | `AGENTS.md` adapter |

---

## Repository Structure

```
figma-visual-compare-skill/
├── README.md
├── README.zh-TW.md
├── docs/
│   ├── workflow.png
│   ├── example-actual.png
│   ├── example-figma.png
│   ├── example-diff.png
│   └── example-diff-after.png
└── skills/
    └── figma-visual-compare/
        ├── SKILL.md
        ├── scripts/
        │   ├── figma-visual-compare.cjs
        │   └── image_diff.py
        └── adapters/
            ├── cursor/
            │   └── figma-visual-compare.md
            └── agents/
                └── AGENTS.md
```
---

## License

See [LICENSE](LICENSE) for details.
