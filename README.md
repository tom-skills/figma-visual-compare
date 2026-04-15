# Figma Visual Compare Skill

Figma Visual Compare Skill is a reusable agent skill for validating local UI implementations against Figma references with precise visual diff artifacts.

- Canonical skill: [skills/figma-visual-compare/SKILL.md](skills/figma-visual-compare/SKILL.md)
- Anthropic Agent Skills overview: [English documentation](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
- OpenAI Codex skills: [English documentation](https://developers.openai.com/codex/skills)
- OpenSkills: [GitHub](https://github.com/numman-ali/openskills)

---

## 中文說明

### 簡介

Figma Visual Compare Skill 用於將本地 UI 實作與 Figma 節點、截圖或設計連結進行精準視覺比對，並輸出標準化差異成果，包含 mismatch ratio、diff 圖片與報告檔。

### 功能

- 支援 Storybook 或 Playwright 擷取的實作畫面
- 支援本地圖片、直連圖片 URL、以及帶有 `node-id` 的 Figma design/file URL
- 輸出下列 artifacts：
  - `mismatchRatio`
  - `diff.png`
  - `story.actual.png`
  - `figma.normalized.png`
  - JSON report
- skill 內已包含比對所需腳本，無須額外複製 compare script

### 專案結構

```text
figma-visual-compare-skill/
├── README.md
├── AGENTS.md
├── CLAUDE.md
└── skills/
    └── figma-visual-compare/
        ├── SKILL.md
        ├── agents/
        │   └── openai.yaml
        ├── scripts/
        │   ├── figma-visual-compare.cjs
        │   └── image_diff.py
        └── adapters/
```

### 相容性

本專案目前提供以下使用方式：

- Claude: 透過 skill 資料夾安裝
- Codex: 透過 skill 資料夾安裝
- Cursor: 透過 adapter 檔案接入 `.cursor/skills/`
- AGENTS 類工具: 透過 `AGENTS.md` adapter 接入
- OpenSkills: 可作為 GitHub repo 或 local path 安裝來源

### 安裝

#### Claude

將 `skills/figma-visual-compare/` 複製到：

```text
~/.claude/skills/figma-visual-compare/
```

若你的 Claude 環境支援 custom skill 上傳，也可將該 skill 資料夾打包後上傳。

#### Codex

將 `skills/figma-visual-compare/` 複製到：

```text
~/.codex/skills/figma-visual-compare/
```

安裝後請重新啟動 Codex。

#### Cursor

將下列檔案複製到目標專案：

- [skills/figma-visual-compare/adapters/cursor/figma-visual-compare.md](skills/figma-visual-compare/adapters/cursor/figma-visual-compare.md)

目標位置通常為：

```text
.cursor/skills/figma-visual-compare.md
```

#### AGENTS 類工具

可依工具需求，選用 `skills/figma-visual-compare/adapters/` 下的對應檔案，複製到該工具支援的 `AGENTS.md` 或等價指令檔。

#### OpenSkills

本 repository 可作為 OpenSkills 的安裝來源。發佈到 GitHub 後，請將下列指令中的 `<owner>/<repo>` 替換為實際 repository 路徑。

從 GitHub 安裝：

```bash
npx openskills install <owner>/<repo>
```

例如：

```bash
npx openskills install yourname/figma-visual-compare-skill
```

若要使用本地路徑進行安裝測試：

```bash
npx openskills install /absolute/path/to/figma-visual-compare-skill
```

安裝完成後，可依你的 OpenSkills 工作流執行同步：

```bash
openskills sync
```

說明：

- 本 repo 目前封裝一個 skill：`figma-visual-compare`
- OpenSkills 安裝的是整個 skill 資料夾，因此 `SKILL.md`、`scripts/` 與其他隨附檔案會一起被帶入
- 建議在實際要執行比對的目標專案內使用此 skill，讓 compare script 可以優先解析該專案的依賴

### 使用方式

請在目標專案根目錄執行：

```bash
node /absolute/path/to/skill/scripts/figma-visual-compare.cjs \
  --story-id <story-id> \
  --selector '<selector>' \
  --figma '<figma-url-or-file>'
```

直接執行圖片對圖片比對：

```bash
python3 /absolute/path/to/skill/scripts/image_diff.py \
  --reference <figma.png> \
  --actual <impl.png>
```

### 執行需求

- 目標專案需具備 Node.js
- 目標專案需具備 Python 3
- 若要擷取 Storybook 畫面，目標專案需具備 Storybook
- compare script 會優先從目標專案載入 `@playwright/test` 與 `sharp`
- 若使用 Figma design/file URL，請提供：
  - `FIGMA_API_TOKEN`
  - 或 `FIGMA_TOKEN`

### 發佈建議

建議將本資料夾作為獨立 GitHub repository 維護，並於發佈前完成以下事項：

1. 更新 README 中的 GitHub 安裝路徑
2. 補充 `LICENSE`
3. 建立第一個 release
4. 驗證 OpenSkills、Claude 與 Codex 的安裝流程

---

## English

### Overview

Figma Visual Compare Skill is designed to compare local UI implementations against Figma nodes, screenshots, or design URLs and produce standardized visual diff artifacts.

### Features

- Supports Storybook- or Playwright-captured implementation images
- Supports local image files, direct image URLs, and Figma design/file URLs with `node-id`
- Produces:
  - `mismatchRatio`
  - `diff.png`
  - `story.actual.png`
  - `figma.normalized.png`
  - JSON report
- Bundles the required comparison scripts inside the skill package

### Compatibility

This repository currently supports:

- Claude via skill-folder installation
- Codex via skill-folder installation
- Cursor via `.cursor/skills/` adapter
- AGENTS-style tools via adapter files
- OpenSkills as a GitHub or local-path installation source

### Installation

#### Claude

Copy `skills/figma-visual-compare/` to:

```text
~/.claude/skills/figma-visual-compare/
```

If your Claude environment supports custom skill uploads, you may also package and upload that folder directly.

#### Codex

Copy `skills/figma-visual-compare/` to:

```text
~/.codex/skills/figma-visual-compare/
```

Restart Codex after installation.

#### Cursor

Copy the following file into your target repository:

- [skills/figma-visual-compare/adapters/cursor/figma-visual-compare.md](skills/figma-visual-compare/adapters/cursor/figma-visual-compare.md)

Typical destination:

```text
.cursor/skills/figma-visual-compare.md
```

#### AGENTS-style tools

Use the appropriate file under `skills/figma-visual-compare/adapters/` and copy it into the tool's supported `AGENTS.md` or equivalent instruction file.

#### OpenSkills

This repository can be used as an OpenSkills installation source. After publishing to GitHub, replace `<owner>/<repo>` with the actual repository path.

Install from GitHub:

```bash
npx openskills install <owner>/<repo>
```

Example:

```bash
npx openskills install yourname/figma-visual-compare-skill
```

For local-path testing:

```bash
npx openskills install /absolute/path/to/figma-visual-compare-skill
```

After installation, you may sync according to your OpenSkills workflow:

```bash
openskills sync
```

Notes:

- This repository currently packages one skill: `figma-visual-compare`
- OpenSkills installs the full skill folder, including `SKILL.md`, `scripts/`, and bundled resources
- Run the skill from the target repository where the comparison should happen so the bundled script can resolve that repository's dependencies first

### Usage

Run from the target repository root:

```bash
node /absolute/path/to/skill/scripts/figma-visual-compare.cjs \
  --story-id <story-id> \
  --selector '<selector>' \
  --figma '<figma-url-or-file>'
```

Direct image-to-image comparison:

```bash
python3 /absolute/path/to/skill/scripts/image_diff.py \
  --reference <figma.png> \
  --actual <impl.png>
```

### Requirements

- Node.js must be available in the target repository
- Python 3 must be available in the target repository
- Storybook is required when capturing implementation views from stories
- The compare script resolves `@playwright/test` and `sharp` from the target repository first
- Figma design/file URL workflows require:
  - `FIGMA_API_TOKEN`
  - or `FIGMA_TOKEN`

### Publishing Notes

This repository is intended to be maintained as a standalone GitHub project. Before release:

1. Update the GitHub installation path in this README
2. Add a `LICENSE`
3. Create the first release
4. Verify installation flows for OpenSkills, Claude, and Codex
