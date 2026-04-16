# Figma Visual Compare Skill — 中文說明

> **English README: [README.md](README.md)**

`figma-visual-compare` 是一個可重複使用的 agent skill，讓 AI agent 能自動比對你的 UI 元件實作與 Figma 設計節點之間的視覺差距，輸出像素級的差異報告，並迭代修正直到版面對齊。

![Workflow](docs/workflow.png)

---

## 用途

當你請 agent 比對元件與 Figma 設計稿，skill 會：

1. **擷取** 元件在 Storybook 中的截圖
2. **取得** Figma 設計節點（透過 Figma API）
3. **比對** 兩張圖片的像素差異
4. **回報** mismatch ratio、差異覆蓋圖，以及修正建議
5. **迭代** — 套用程式碼修改後重新比對，直到分數有明顯改善

---

## 真實範例

### 迭代進度

Agent 共比對了三次，每次比對後套用修正再重跑：

| | ① 初始 | ② 修正版面後 | ③ 調整 inset 後 |
|---|:---:|:---:|:---:|
| **mismatchRatio** | **11.81%** | **3.52%** | **1.78%** |
| **Storybook** | ![run 1](docs/iter-1-actual.png) | ![run 2](docs/iter-2-actual.png) | ![run 3](docs/iter-3-actual.png) |
| **diff.png** | ![run 1](docs/iter-1-diff.png) | ![run 2](docs/iter-2-diff.png) | ![run 3](docs/iter-3-diff.png) |
| **修改內容** | 基準比對 — 間距、padding、鍵位寬度全部偏差 | 套用 `px-24`、`gap-48`、`gap-24`；修正最後一列鍵位寬度 | 調整 `--actual-inset`；版面已像素對齊 |
| **剩餘差異** | 所有按鍵與按鈕未對齊 | 背景色 + 一個按鈕文字 | 僅一個按鈕文字（字型渲染誤差） |

**Figma 設計稿**（三輪比對的目標）：

![Figma reference](docs/iter-figma-ref.png)

---

## 使用方式

### 請 Agent 執行

安裝 skill 後，直接用自然語言告訴 agent：

> *「請幫我比對 `<元件名稱>` 的 Storybook Story 和這個 Figma 節點：`<figma-url>`，告訴我 mismatch ratio 和最大的視覺差異在哪裡。」*

> *「針對 `<story-id>` 這個 Story，用 `<figma-url>` 的 Figma 設計稿跑視覺比對。如果有 layout 問題，幫我修掉再重跑，直到分數有明顯改善。」*

> *「現在的 `<元件名稱>` 實作和 Figma 設計稿有多接近？找出差異區域，告訴我要改哪裡。」*

Agent 會自動處理擷取、比對、報告、迭代修正的全流程。

### Agent 的執行步驟

```
1. 找到目標元件對應的 Storybook Story
2. 決定最適合的 CSS selector 來隔離元件範圍
3. 透過 Playwright + Storybook 擷取截圖
4. 透過 Figma API 取得設計節點圖片
5. 執行像素比對並輸出 diff 成果
6. 分析最大差異區域
7. 套用程式碼修正，重新比對，直到分數顯著改善
```

---

## 產出物

| 檔案 | 說明 |
|------|------|
| `mismatchRatio` | 整體像素差異比率，0 代表完全一致 |
| `diff.png` | 標示差異像素的熱圖 |
| `diff.overlay.png` | 帶編號差異區域的覆蓋圖 |
| `story.actual.png` | 從 Storybook 擷取的截圖 |
| `figma.normalized.png` | Figma 匯出的參考圖（縮放對齊後） |
| `report.json` | 完整 JSON 報告，含各區域差異資料 |

---

## 前置需求

**一鍵安裝指令（推薦）**

如果你已經將 skill 安裝在你的專案中（例如在 `skills/figma-visual-compare`），你可以直接在專案根目錄執行一鍵腳本。它會自動檢查並安裝所需的 Node.js 與 Python 依賴：

```bash
./skills/figma-visual-compare/install-deps.sh
```

<details>
<summary><b>手動安裝與需求設定詳細說明</b></summary><br>

### Node.js 套件（從專案解析）

Compare script 會優先從你的**專案 `node_modules`** 載入這些套件：

| 套件 | 沒有的話怎麼裝 |
|------|--------------|
| `@playwright/test` | `npm install --save-dev @playwright/test` |
| `sharp` | `npm install --save-dev sharp` |

安裝 Playwright 後，還需要安裝瀏覽器執行檔：

```bash
npx playwright install chromium
```

### Python 套件

像素比對腳本需要 Python 3.10+ 以及：

| 套件 | 沒有的話怎麼裝 |
|------|--------------|
| `numpy` | `pip install numpy` |
| `Pillow` | `pip install Pillow` |

或一次安裝兩個：

```bash
pip install numpy Pillow
```

### Figma 存取設定

| 需求 | 設定方式 |
|------|---------|
| **Figma MCP** | 在 agent 的 MCP 設定中啟用 Figma MCP，讓 agent 能讀取設計節點資料 |
| **Figma API Token** | 到 [figma.com/settings](https://www.figma.com/settings) → Personal access tokens 建立 token，然後在 `.env` 或 shell 中設定 `FIGMA_API_TOKEN=<token>` |

### Storybook

Skill 在 Storybook 未執行時會嘗試自動啟動。你的專案需要已安裝 Storybook，且目標元件需有對應的 Story。

若 Storybook 無法自動啟動，請先手動執行再觸發 agent：

```bash
npm run storybook
```

</details>

---

## 安裝

### 使用 `npx skill add`（推薦）

專案內安裝：

```bash
npx skill add https://github.com/gh286991/figma-visual-compare --skill figma-visual-compare
```

全域安裝：

```bash
npx skill add https://github.com/gh286991/figma-visual-compare --skill figma-visual-compare --global
```

列出 repo 中可用的 skill：

```bash
npx skill add https://github.com/gh286991/figma-visual-compare --list
```

### Claude

將 `skills/figma-visual-compare/` 複製到：

```
~/.claude/skills/figma-visual-compare/
```

若 Claude 環境支援 custom skill 上傳，也可將資料夾打包後上傳。

### Cursor

將 adapter 檔案複製到目標專案：

```
skills/figma-visual-compare/adapters/cursor/figma-visual-compare.md
  → .cursor/skills/figma-visual-compare.md
```

### AGENTS 類工具

從 `skills/figma-visual-compare/adapters/` 選用對應檔案，複製到工具支援的 `AGENTS.md` 或等價指令檔。

---

## 相容性

| 工具 | 安裝方式 |
|------|----------|
| Claude | `~/.claude/skills/` 或 `npx skill add` |
| Codex | `~/.codex/skills/` 或 `npx skill add` |
| Cursor | `.cursor/skills/` adapter |
| AGENTS 類工具 | `AGENTS.md` adapter |

---

## License

See [LICENSE](LICENSE) for details.