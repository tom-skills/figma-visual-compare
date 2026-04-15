#!/usr/bin/env node

const fs = require("node:fs/promises");
const path = require("node:path");
const { createRequire } = require("node:module");
const { spawn } = require("node:child_process");
const { setTimeout: delay } = require("node:timers/promises");

function loadRuntimeDependency(name) {
    const requireFromCwd = createRequire(path.join(process.cwd(), "package.json"));
    try {
        return requireFromCwd(name);
    } catch (cwdError) {
        try {
            return require(name);
        } catch (localError) {
            throw new Error(
                `Missing dependency "${name}". Install it in the target repo or make sure the command runs from a repo that already has it available.`,
                { cause: cwdError ?? localError },
            );
        }
    }
}

const { chromium } = loadRuntimeDependency("@playwright/test");
const sharp = loadRuntimeDependency("sharp");

function parseArgs(argv) {
    const args = {
        baseUrl: "http://127.0.0.1:6006",
        selector: "#storybook-root",
        outputDir: "output/figma-diff",
        waitMs: 300,
        threshold: 0.08,
        trimWhitespace: true,
        trimTolerance: 12,
        trimPadding: 0,
        referenceInset: "0",
        actualInset: "0",
        referenceOutset: "0",
        actualOutset: "0",
        topLeftAnchor: false,
        fitReferenceWindow: true,
        fitActualWindow: true,
        autoAlign: true,
        alignSearch: 48,
        maxMismatchRatio: null,
        mockDate: null,
        startStorybook: true,
        storybookCommand:
            "./node_modules/.bin/storybook dev --ci --host 127.0.0.1 --port 6006",
    };

    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];

        if (!token.startsWith("--")) {
            continue;
        }

        const [rawKey, inlineValue] = token.slice(2).split("=", 2);
        const key = rawKey.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
        const nextToken = argv[index + 1];
        const value =
            inlineValue ?? (nextToken?.startsWith("--") ? undefined : nextToken);

        switch (key) {
            case "storyId":
            case "figma":
            case "baseUrl":
            case "selector":
            case "outputDir":
            case "storybookCommand":
                args[key] = value;
                if (inlineValue == null) {
                    index += 1;
                }
                break;
            case "waitMs":
                args.waitMs = Number(value);
                if (inlineValue == null) {
                    index += 1;
                }
                break;
            case "referenceInset":
            case "actualInset":
            case "referenceOutset":
            case "actualOutset":
                args[key] = value;
                if (inlineValue == null) {
                    index += 1;
                }
                break;
            case "threshold":
                args.threshold = Number(value);
                if (inlineValue == null) {
                    index += 1;
                }
                break;
            case "trimWhitespace":
                args.trimWhitespace =
                    value == null ? true : !["false", "0"].includes(value);
                if (inlineValue == null && value != null) {
                    index += 1;
                }
                break;
            case "trimTolerance":
                args.trimTolerance = Number(value);
                if (inlineValue == null) {
                    index += 1;
                }
                break;
            case "trimPadding":
                args.trimPadding = Number(value);
                if (inlineValue == null) {
                    index += 1;
                }
                break;
            case "topLeftAnchor":
                args.topLeftAnchor =
                    value == null ? true : !["false", "0"].includes(value);
                if (inlineValue == null && value != null) {
                    index += 1;
                }
                break;
            case "fitReferenceWindow":
                args.fitReferenceWindow =
                    value == null ? true : !["false", "0"].includes(value);
                if (inlineValue == null && value != null) {
                    index += 1;
                }
                break;
            case "autoAlign":
                args.autoAlign =
                    value == null ? true : !["false", "0"].includes(value);
                if (inlineValue == null && value != null) {
                    index += 1;
                }
                break;
            case "fitActualWindow":
                args.fitActualWindow =
                    value == null ? true : !["false", "0"].includes(value);
                if (inlineValue == null && value != null) {
                    index += 1;
                }
                break;
            case "alignSearch":
                args.alignSearch = Number(value);
                if (inlineValue == null) {
                    index += 1;
                }
                break;
            case "maxMismatchRatio":
                args.maxMismatchRatio = Number(value);
                if (inlineValue == null) {
                    index += 1;
                }
                break;
            case "mockDate":
                args.mockDate = value;
                if (inlineValue == null) {
                    index += 1;
                }
                break;
            case "startStorybook":
                args.startStorybook =
                    value == null ? true : !["false", "0"].includes(value);
                if (inlineValue == null && value != null) {
                    index += 1;
                }
                break;
            case "help":
                args.help = true;
                break;
            default:
                throw new Error(`Unknown argument: --${rawKey}`);
        }
    }

    return args;
}

function assertRequiredArgs(args) {
    if (args.help) {
        return;
    }

    if (!args.storyId) {
        throw new Error("Missing required argument: --story-id");
    }

    if (!args.figma) {
        throw new Error("Missing required argument: --figma");
    }
}

function printHelp() {
    console.log(`
Compare a Storybook story against a Figma reference image.

Required:
  --story-id <id>       Storybook story id, ex: ui-button--primary
  --figma <path|url>    Local image path or remote image URL

Optional:
  --base-url <url>              Storybook base URL (default: http://127.0.0.1:6006)
  --selector <css>              Element to screenshot (default: #storybook-root; auto-resolves a tighter component target)
  --output-dir <dir>            Diff artifact directory (default: output/figma-diff)
  --wait-ms <number>            Extra wait after story render (default: 300)
  --threshold <0-1>             Per-channel diff threshold (default: 0.08)
  --trim-whitespace <bool>      Crop outer white margins before diff (default: true)
  --trim-tolerance <0-255>      How far from white counts as content (default: 12)
  --trim-padding <pixels>       Extra padding to keep around cropped content (default: 0)
  --reference-inset <css-like>  Crop reference edges first, ex: 2 or 2,4,2,4
  --actual-inset <css-like>     Crop actual edges first, ex: 2 or 2,4,2,4
  --reference-outset <css-like> Add white margins around reference, ex: 12 or 12,16,12,16
  --actual-outset <css-like>    Add white margins around actual, ex: 12 or 12,16,12,16
  --top-left-anchor <bool>      Compare from shared top-left corner only (default: false)
  --fit-reference-window <bool> Crop the best-matching window from a larger Figma image (default: true)
  --fit-actual-window <bool>    Crop the best-matching window from a larger actual screenshot (default: true)
  --auto-align <bool>           Search small x/y shifts before diff (default: true)
  --align-search <pixels>       Max shift in each direction for auto align (default: 48)
  --max-mismatch-ratio <0-1>    Fail when ratio is above this value
  --mock-date <ISO date>        Freeze browser Date, ex: 2025-06-29T00:00:00Z
  --start-storybook <bool>      Auto-start Storybook if unavailable (default: true)
  --storybook-command <cmd>     Command used to start Storybook

Example:
  node /path/to/skill/scripts/figma-visual-compare.cjs \\
    --story-id ui-button--primary \\
    --figma ./designs/button-primary.png
`.trim());
}

function sanitizeForPath(input) {
    return input.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "");
}

function isFigmaDesignUrl(value) {
    try {
        const url = new URL(value);
        return (
            /(^|\.)figma\.com$/i.test(url.hostname) &&
            /^\/(?:design|file)\//.test(url.pathname) &&
            url.searchParams.has("node-id")
        );
    } catch {
        return false;
    }
}

function parseDotEnv(content) {
    const entries = {};
    for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) {
            continue;
        }
        const separator = trimmed.indexOf("=");
        if (separator <= 0) {
            continue;
        }
        const key = trimmed.slice(0, separator).trim();
        let value = trimmed.slice(separator + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        entries[key] = value;
    }
    return entries;
}

async function loadProjectEnv() {
    const envPaths = [".env.local", ".env"];
    const merged = {};
    for (const relativePath of envPaths) {
        const absolutePath = path.resolve(relativePath);
        if (!(await exists(absolutePath))) {
            continue;
        }
        const fileContent = await fs.readFile(absolutePath, "utf8");
        Object.assign(merged, parseDotEnv(fileContent));
    }
    return merged;
}

function parseFigmaNodeUrl(source) {
    const url = new URL(source);
    const pathMatch = url.pathname.match(/\/(?:design|file)\/([a-zA-Z0-9]+)/);
    if (!pathMatch) {
        throw new Error(`Invalid Figma design URL: ${source}`);
    }

    const nodeId = url.searchParams.get("node-id");
    if (!nodeId) {
        throw new Error(`Missing node-id in Figma URL: ${source}`);
    }

    return {
        fileKey: pathMatch[1],
        nodeId: decodeURIComponent(nodeId).replace(/-/g, ":"),
    };
}

async function exportFigmaNodeImageBuffer(source) {
    const env = {
        ...process.env,
        ...(await loadProjectEnv()),
    };
    const token =
        env.FIGMA_API_TOKEN ||
        env.FIGMA_TOKEN ||
        env.FIGMA_ACCESS_TOKEN ||
        env.FIGMA_API_KEY;

    if (!token) {
        throw new Error(
            "Figma design URL requires FIGMA_API_TOKEN or FIGMA_TOKEN in process env or .env",
        );
    }

    const { fileKey, nodeId } = parseFigmaNodeUrl(source);
    const exportUrl = new URL(`https://api.figma.com/v1/images/${fileKey}`);
    exportUrl.searchParams.set("ids", nodeId);
    exportUrl.searchParams.set("format", "png");
    exportUrl.searchParams.set("scale", "1");
    exportUrl.searchParams.set("use_absolute_bounds", "true");

    const exportResponse = await fetch(exportUrl, {
        headers: {
            "X-Figma-Token": token,
        },
    });

    if (!exportResponse.ok) {
        throw new Error(
            `Failed to export Figma node image: ${source} (${exportResponse.status})`,
        );
    }

    const exportJson = await exportResponse.json();
    const imageUrl = exportJson.images?.[nodeId];

    if (!imageUrl) {
        throw new Error(
            `Figma export did not return an image URL for node ${nodeId}`,
        );
    }

    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
        throw new Error(
            `Failed to fetch exported Figma node image: ${imageUrl} (${imageResponse.status})`,
        );
    }

    return Buffer.from(await imageResponse.arrayBuffer());
}

async function exists(target) {
    try {
        await fs.access(target);
        return true;
    } catch {
        return false;
    }
}

async function isUrlReachable(url) {
    try {
        const response = await fetch(url, { method: "GET" });
        return response.ok;
    } catch {
        return false;
    }
}

async function waitForUrl(url, timeoutMs) {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
        if (await isUrlReachable(url)) {
            return true;
        }

        await delay(1_000);
    }

    return false;
}

function startStorybookServer(command, cwd) {
    const child = spawn(command, {
        cwd,
        shell: true,
        stdio: "ignore",
    });

    return child;
}

async function loadImageBuffer(source) {
    if (isFigmaDesignUrl(source)) {
        return exportFigmaNodeImageBuffer(source);
    }

    if (/^https?:\/\//i.test(source)) {
        const response = await fetch(source);

        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${source} (${response.status})`);
        }

        return Buffer.from(await response.arrayBuffer());
    }

    const absolutePath = path.resolve(source);

    if (!(await exists(absolutePath))) {
        throw new Error(`Image not found: ${absolutePath}`);
    }

    return fs.readFile(absolutePath);
}

async function writeImageBuffer(targetPath, buffer) {
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, buffer);
}

async function runPythonImageDiff({
    actualPath,
    actualInset,
    actualOutset,
    alignSearch,
    autoAlign,
    diffOverlayOutputName,
    diffOutputName,
    exactOutputDir,
    maxMismatchRatio,
    outputDir,
    referenceInset,
    referenceOutset,
    referenceOutputName,
    referencePath,
    reportOutputName,
    threshold,
    topLeftAnchor,
    fitReferenceWindow,
    fitActualWindow,
    trimPadding,
    trimTolerance,
    trimWhitespace,
    actualOutputName,
}) {
    const imageDiffScript = path.join(__dirname, "image_diff.py");
    const commandArgs = [
        imageDiffScript,
        "--reference",
        referencePath,
        "--actual",
        actualPath,
        "--output-dir",
        outputDir,
        "--threshold",
        String(threshold),
        "--trim-whitespace",
        String(trimWhitespace),
        "--trim-tolerance",
        String(trimTolerance),
        "--trim-padding",
        String(trimPadding),
        "--top-left-anchor",
        String(topLeftAnchor),
        "--fit-reference-window",
        String(fitReferenceWindow),
        "--fit-actual-window",
        String(fitActualWindow),
        "--auto-align",
        String(autoAlign),
        "--align-search",
        String(alignSearch),
        "--exact-output-dir",
        String(exactOutputDir),
        "--reference-output-name",
        referenceOutputName,
        "--actual-output-name",
        actualOutputName,
        "--diff-output-name",
        diffOutputName,
        "--diff-overlay-output-name",
        diffOverlayOutputName,
        "--report-output-name",
        reportOutputName,
    ];

    if (maxMismatchRatio != null) {
        commandArgs.push("--max-mismatch-ratio", String(maxMismatchRatio));
    }

    if (referenceInset != null) {
        commandArgs.push("--reference-inset", String(referenceInset));
    }

    if (actualInset != null) {
        commandArgs.push("--actual-inset", String(actualInset));
    }

    if (referenceOutset != null) {
        commandArgs.push("--reference-outset", String(referenceOutset));
    }

    if (actualOutset != null) {
        commandArgs.push("--actual-outset", String(actualOutset));
    }

    const result = await new Promise((resolve, reject) => {
        const child = spawn("python3", commandArgs, {
            cwd: process.cwd(),
            stdio: ["ignore", "pipe", "pipe"],
        });
        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (chunk) => {
            stdout += chunk.toString();
        });
        child.stderr.on("data", (chunk) => {
            stderr += chunk.toString();
        });
        child.on("error", reject);
        child.on("close", (code) => {
            if (code !== 0 && code !== 1) {
                reject(
                    new Error(
                        stderr.trim() ||
                            `image_diff.py failed with exit code ${code ?? "unknown"}`,
                    ),
                );
                return;
            }

            try {
                resolve({
                    exitCode: code ?? 0,
                    report: JSON.parse(stdout),
                });
            } catch (error) {
                reject(
                    new Error(
                        `Failed to parse image_diff.py output: ${
                            error instanceof Error ? error.message : String(error)
                        }\n${stdout}\n${stderr}`,
                    ),
                );
            }
        });
    });

    return result;
}

async function normalizeToCanvas(buffer, width, height) {
    return sharp({
        create: {
            width,
            height,
            channels: 4,
            background: { r: 255, g: 255, b: 255, alpha: 1 },
        },
    })
        .composite([
            {
                input: await sharp(buffer).flatten({ background: "#ffffff" }).png().toBuffer(),
                left: 0,
                top: 0,
            },
        ])
        .png()
        .toBuffer();
}

function growMask(mask, width, height, radius) {
    if (radius <= 0) {
        return mask;
    }

    const grown = new Uint8Array(mask.length);

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const index = y * width + x;

            if (mask[index] === 0) {
                continue;
            }

            for (let dy = -radius; dy <= radius; dy += 1) {
                for (let dx = -radius; dx <= radius; dx += 1) {
                    const nextX = x + dx;
                    const nextY = y + dy;

                    if (
                        nextX < 0 ||
                        nextY < 0 ||
                        nextX >= width ||
                        nextY >= height
                    ) {
                        continue;
                    }

                    grown[nextY * width + nextX] = 1;
                }
            }
        }
    }

    return grown;
}

function detectDifferenceRegions(mask, width, height) {
    const expanded = growMask(mask, width, height, 2);
    const visited = new Uint8Array(expanded.length);
    const regions = [];

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const startIndex = y * width + x;

            if (expanded[startIndex] === 0 || visited[startIndex] === 1) {
                continue;
            }

            const queue = [startIndex];
            visited[startIndex] = 1;
            let head = 0;
            let left = x;
            let right = x;
            let top = y;
            let bottom = y;
            let expandedPixels = 0;
            let mismatchPixels = 0;

            while (head < queue.length) {
                const index = queue[head];
                head += 1;
                const currentX = index % width;
                const currentY = Math.floor(index / width);
                expandedPixels += 1;
                mismatchPixels += mask[index];
                left = Math.min(left, currentX);
                right = Math.max(right, currentX);
                top = Math.min(top, currentY);
                bottom = Math.max(bottom, currentY);

                const neighbors = [
                    index - 1,
                    index + 1,
                    index - width,
                    index + width,
                ];

                for (const nextIndex of neighbors) {
                    if (nextIndex < 0 || nextIndex >= expanded.length) {
                        continue;
                    }

                    const nextX = nextIndex % width;
                    const nextY = Math.floor(nextIndex / width);
                    const isWrapped =
                        Math.abs(nextX - currentX) + Math.abs(nextY - currentY) !== 1;

                    if (
                        isWrapped ||
                        expanded[nextIndex] === 0 ||
                        visited[nextIndex] === 1
                    ) {
                        continue;
                    }

                    visited[nextIndex] = 1;
                    queue.push(nextIndex);
                }
            }

            const regionWidth = right - left + 1;
            const regionHeight = bottom - top + 1;
            const regionArea = regionWidth * regionHeight;

            if (
                mismatchPixels < 24 ||
                regionArea < 600 ||
                regionWidth < 12 ||
                regionHeight < 12
            ) {
                continue;
            }

            regions.push({
                left,
                top,
                width: regionWidth,
                height: regionHeight,
                mismatchPixels,
                expandedPixels,
                area: regionArea,
            });
        }
    }

    return regions
        .sort((a, b) => b.mismatchPixels - a.mismatchPixels)
        .slice(0, 12);
}

async function createRegionOverlay(baseBuffer, regions, outputPath) {
    if (regions.length === 0) {
        await fs.writeFile(outputPath, baseBuffer);
        return;
    }

    const meta = await sharp(baseBuffer).metadata();
    const width = meta.width || 1;
    const height = meta.height || 1;
    const labels = regions
        .map((region, index) => {
            const labelWidth = 34;
            const labelHeight = 24;
            const labelX = Math.max(0, Math.min(region.left, width - labelWidth));
            const labelY = Math.max(0, region.top - labelHeight - 4);

            return `
                <rect x="${region.left}" y="${region.top}" width="${region.width}" height="${region.height}"
                    fill="rgba(255,59,48,0.12)" stroke="#ff3b30" stroke-width="2" />
                <rect x="${labelX}" y="${labelY}" width="${labelWidth}" height="${labelHeight}" rx="4"
                    fill="#ff3b30" />
                <text x="${labelX + 11}" y="${labelY + 17}"
                    font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#ffffff">
                    ${index + 1}
                </text>
            `;
        })
        .join("");
    const svg = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            ${labels}
        </svg>
    `;

    await sharp(baseBuffer)
        .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
        .png()
        .toFile(outputPath);
}

async function flattenToRaw(buffer) {
    const image = sharp(buffer).flatten({ background: "#ffffff" });
    const meta = await image.metadata();
    const raw = await image.raw().toBuffer();

    return {
        raw,
        width: meta.width,
        height: meta.height,
    };
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function detectContentBounds(raw, width, height, tolerance, padding) {
    let left = width;
    let top = height;
    let right = -1;
    let bottom = -1;

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const index = (y * width + x) * 4;
            const red = raw[index];
            const green = raw[index + 1];
            const blue = raw[index + 2];
            const alpha = raw[index + 3];
            const isContent =
                alpha < 255 ||
                red < 255 - tolerance ||
                green < 255 - tolerance ||
                blue < 255 - tolerance;

            if (!isContent) {
                continue;
            }

            left = Math.min(left, x);
            top = Math.min(top, y);
            right = Math.max(right, x);
            bottom = Math.max(bottom, y);
        }
    }

    if (right === -1 || bottom === -1) {
        return {
            left: 0,
            top: 0,
            width,
            height,
        };
    }

    const paddedLeft = clamp(left - padding, 0, width - 1);
    const paddedTop = clamp(top - padding, 0, height - 1);
    const paddedRight = clamp(right + padding, 0, width - 1);
    const paddedBottom = clamp(bottom + padding, 0, height - 1);

    return {
        left: paddedLeft,
        top: paddedTop,
        width: paddedRight - paddedLeft + 1,
        height: paddedBottom - paddedTop + 1,
    };
}

async function prepareImageBuffer(buffer, { trimWhitespace, trimTolerance, trimPadding }) {
    const flattened = await flattenToRaw(buffer);

    if (!flattened.width || !flattened.height) {
        throw new Error("Failed to read image dimensions.");
    }

    const bounds = trimWhitespace
        ? detectContentBounds(
              flattened.raw,
              flattened.width,
              flattened.height,
              trimTolerance,
              trimPadding,
          )
        : {
              left: 0,
              top: 0,
              width: flattened.width,
              height: flattened.height,
          };

    const cropped = await sharp(buffer)
        .flatten({ background: "#ffffff" })
        .extract(bounds)
        .png()
        .toBuffer();

    return {
        buffer: cropped,
        bounds,
        original: {
            width: flattened.width,
            height: flattened.height,
        },
    };
}

async function toSmallGray(buffer) {
    const meta = await sharp(buffer).metadata();
    const width = meta.width || 1;
    const height = meta.height || 1;
    const targetWidth = Math.min(240, width);
    const targetHeight = Math.max(1, Math.round((height / width) * targetWidth));
    const raw = await sharp(buffer)
        .resize({
            width: targetWidth,
            height: targetHeight,
            fit: "fill",
        })
        .grayscale()
        .raw()
        .toBuffer();

    return {
        raw,
        width: targetWidth,
        height: targetHeight,
    };
}

function scoreOffset(reference, actual, offsetX, offsetY) {
    const refStartX = Math.max(0, -offsetX);
    const refStartY = Math.max(0, -offsetY);
    const actualStartX = Math.max(0, offsetX);
    const actualStartY = Math.max(0, offsetY);
    const overlapWidth = Math.min(
        reference.width - refStartX,
        actual.width - actualStartX,
    );
    const overlapHeight = Math.min(
        reference.height - refStartY,
        actual.height - actualStartY,
    );

    if (overlapWidth <= 0 || overlapHeight <= 0) {
        return Number.POSITIVE_INFINITY;
    }

    const overlapArea = overlapWidth * overlapHeight;
    const minArea = Math.min(
        reference.width * reference.height,
        actual.width * actual.height,
    );

    if (overlapArea < minArea * 0.6) {
        return Number.POSITIVE_INFINITY;
    }

    let sum = 0;

    for (let y = 0; y < overlapHeight; y += 1) {
        const refRow = (refStartY + y) * reference.width;
        const actualRow = (actualStartY + y) * actual.width;

        for (let x = 0; x < overlapWidth; x += 1) {
            const refValue = reference.raw[refRow + refStartX + x];
            const actualValue = actual.raw[actualRow + actualStartX + x];
            sum += Math.abs(refValue - actualValue);
        }
    }

    return sum / overlapArea;
}

async function findBestOffset(referenceBuffer, actualBuffer, maxSearch) {
    const [reference, actual] = await Promise.all([
        toSmallGray(referenceBuffer),
        toSmallGray(actualBuffer),
    ]);
    const scaleX = (await sharp(referenceBuffer).metadata()).width / reference.width;
    const scaleY = (await sharp(referenceBuffer).metadata()).height / reference.height;
    const scaledSearch = Math.max(1, Math.round(maxSearch / Math.max(scaleX, scaleY)));
    let best = {
        x: 0,
        y: 0,
        score: scoreOffset(reference, actual, 0, 0),
    };

    for (let y = -scaledSearch; y <= scaledSearch; y += 1) {
        for (let x = -scaledSearch; x <= scaledSearch; x += 1) {
            const score = scoreOffset(reference, actual, x, y);

            if (score < best.score) {
                best = { x, y, score };
            }
        }
    }

    return {
        x: Math.round(best.x * scaleX),
        y: Math.round(best.y * scaleY),
        score: best.score,
    };
}

async function compareImages({
    figmaBuffer,
    storyBuffer,
    threshold,
    outputDir,
    trimWhitespace,
    trimTolerance,
    trimPadding,
    topLeftAnchor,
    autoAlign,
    alignSearch,
}) {
    const [figmaPrepared, storyPrepared] = await Promise.all([
        prepareImageBuffer(figmaBuffer, {
            trimWhitespace,
            trimTolerance,
            trimPadding,
        }),
        prepareImageBuffer(storyBuffer, {
            trimWhitespace,
            trimTolerance,
            trimPadding,
        }),
    ]);
    const figmaMeta = await sharp(figmaPrepared.buffer).metadata();
    const storyMeta = await sharp(storyPrepared.buffer).metadata();

    if (!figmaMeta.width || !figmaMeta.height || !storyMeta.width || !storyMeta.height) {
        throw new Error("Failed to read image dimensions.");
    }

    const alignment = topLeftAnchor
        ? { x: 0, y: 0, score: null, mode: "top-left-anchor" }
        : autoAlign
        ? await findBestOffset(figmaPrepared.buffer, storyPrepared.buffer, alignSearch)
        : { x: 0, y: 0, score: null, mode: "none" };
    let width;
    let height;
    let figmaNormalized;
    let storyNormalized;

    if (topLeftAnchor) {
        width = Math.min(figmaMeta.width, storyMeta.width);
        height = Math.min(figmaMeta.height, storyMeta.height);
        [figmaNormalized, storyNormalized] = await Promise.all([
            sharp(figmaPrepared.buffer)
                .extract({ left: 0, top: 0, width, height })
                .png()
                .toBuffer(),
            sharp(storyPrepared.buffer)
                .extract({ left: 0, top: 0, width, height })
                .png()
                .toBuffer(),
        ]);
    } else {
        const figmaLeft = Math.max(0, -alignment.x);
        const figmaTop = Math.max(0, -alignment.y);
        const storyLeft = Math.max(0, alignment.x);
        const storyTop = Math.max(0, alignment.y);
        width = Math.max(figmaMeta.width + figmaLeft, storyMeta.width + storyLeft);
        height = Math.max(figmaMeta.height + figmaTop, storyMeta.height + storyTop);
        [figmaNormalized, storyNormalized] = await Promise.all([
            sharp({
                create: {
                    width,
                    height,
                    channels: 4,
                    background: { r: 255, g: 255, b: 255, alpha: 1 },
                },
            })
                .composite([{ input: figmaPrepared.buffer, left: figmaLeft, top: figmaTop }])
                .png()
                .toBuffer(),
            sharp({
                create: {
                    width,
                    height,
                    channels: 4,
                    background: { r: 255, g: 255, b: 255, alpha: 1 },
                },
            })
                .composite([{ input: storyPrepared.buffer, left: storyLeft, top: storyTop }])
                .png()
                .toBuffer(),
        ]);
    }
    const figmaRaw = await sharp(figmaNormalized).raw().toBuffer();
    const storyRaw = await sharp(storyNormalized).raw().toBuffer();
    const diffRaw = Buffer.alloc(width * height * 4);
    const mismatchMask = new Uint8Array(width * height);
    const limit = Math.round(threshold * 255);
    let mismatchedPixels = 0;

    for (let index = 0; index < figmaRaw.length; index += 4) {
        const redDiff = Math.abs(figmaRaw[index] - storyRaw[index]);
        const greenDiff = Math.abs(figmaRaw[index + 1] - storyRaw[index + 1]);
        const blueDiff = Math.abs(figmaRaw[index + 2] - storyRaw[index + 2]);
        const alphaDiff = Math.abs(figmaRaw[index + 3] - storyRaw[index + 3]);
        const hasDiff =
            redDiff > limit ||
            greenDiff > limit ||
            blueDiff > limit ||
            alphaDiff > limit;

        if (hasDiff) {
            mismatchedPixels += 1;
            mismatchMask[index / 4] = 1;
            diffRaw[index] = 255;
            diffRaw[index + 1] = 59;
            diffRaw[index + 2] = 48;
            diffRaw[index + 3] = 255;
            continue;
        }

        const gray = Math.round(
            figmaRaw[index] * 0.299 +
                figmaRaw[index + 1] * 0.587 +
                figmaRaw[index + 2] * 0.114,
        );

        diffRaw[index] = gray;
        diffRaw[index + 1] = gray;
        diffRaw[index + 2] = gray;
        diffRaw[index + 3] = 80;
    }

    const totalPixels = width * height;
    const mismatchRatio = mismatchedPixels / totalPixels;
    const diffPng = await sharp(diffRaw, {
        raw: {
            width,
            height,
            channels: 4,
        },
    })
        .png()
        .toBuffer();
    const regions = detectDifferenceRegions(mismatchMask, width, height);
    const overlayPath = path.join(outputDir, "diff.overlay.png");

    await Promise.all([
        fs.writeFile(path.join(outputDir, "figma.normalized.png"), figmaNormalized),
        fs.writeFile(path.join(outputDir, "story.actual.png"), storyNormalized),
        fs.writeFile(path.join(outputDir, "diff.png"), diffPng),
        createRegionOverlay(storyNormalized, regions, overlayPath),
    ]);

    return {
        width,
        height,
        mismatchRatio,
        mismatchedPixels,
        totalPixels,
        figma: {
            width: figmaPrepared.original.width,
            height: figmaPrepared.original.height,
            croppedWidth: figmaMeta.width,
            croppedHeight: figmaMeta.height,
            crop: figmaPrepared.bounds,
        },
        story: {
            width: storyPrepared.original.width,
            height: storyPrepared.original.height,
            croppedWidth: storyMeta.width,
            croppedHeight: storyMeta.height,
            crop: storyPrepared.bounds,
        },
        alignment,
        differenceRegions: regions,
    };
}

async function captureStoryScreenshot({
    baseUrl,
    mockDate,
    expectedSize,
    selector,
    storyId,
    waitMs,
}) {
    const browser = await chromium.launch({ headless: true });

    try {
        const page = await browser.newPage({
            viewport: { width: 1440, height: 1200 },
            deviceScaleFactor: 1,
        });
        const storyUrl = `${baseUrl.replace(/\/$/, "")}/iframe.html?id=${storyId}&viewMode=story`;

        if (mockDate) {
            const mockTimestamp = new Date(mockDate).getTime();

            if (Number.isNaN(mockTimestamp)) {
                throw new Error(`Invalid --mock-date value: ${mockDate}`);
            }

            await page.addInitScript((timestamp) => {
                const RealDate = Date;

                class MockDate extends RealDate {
                    constructor(...args) {
                        if (args.length === 0) {
                            super(timestamp);
                            return;
                        }

                        super(...args);
                    }

                    static now() {
                        return timestamp;
                    }
                }

                Object.setPrototypeOf(MockDate, RealDate);
                // @ts-ignore - injected in browser only
                window.Date = MockDate;
            }, mockTimestamp);
        }

        await page.goto(storyUrl, {
            waitUntil: "domcontentloaded",
            timeout: 60_000,
        });

        await page.evaluate(async () => {
            await document.fonts.ready;
        });
        await page
            .waitForFunction(() => {
                const isVisible = (node) => {
                    if (!(node instanceof HTMLElement)) {
                        return false;
                    }
                    const style = window.getComputedStyle(node);
                    const rect = node.getBoundingClientRect();
                    return (
                        style.display !== "none" &&
                        style.visibility !== "hidden" &&
                        rect.width > 0 &&
                        rect.height > 0
                    );
                };

                const preparingStory = document.querySelector(".sb-preparing-story");
                const root = document.querySelector("#storybook-root");
                const visibleTestId = Array.from(
                    document.querySelectorAll("[data-testid]"),
                ).some(isVisible);
                const visibleRootContent =
                    root instanceof HTMLElement &&
                    isVisible(root) &&
                    root.querySelector("*") !== null;

                return !isVisible(preparingStory) && (visibleTestId || visibleRootContent);
            }, {
                timeout: 10_000,
            })
            .catch(() => {});

        let requestedSelector = selector;
        let resolvedSelector = selector;
        let targetStrategy = "explicit";
        let targetBounds = null;

        if (selector === "#storybook-root") {
            const autoTarget = await page.evaluate((expected) => {
                const markerAttribute = "data-codex-compare-target";
                document
                    .querySelectorAll(`[${markerAttribute}]`)
                    .forEach((node) => node.removeAttribute(markerAttribute));

                const root = document.querySelector("#storybook-root");
                const body = document.body;

                const isVisible = (node) => {
                    if (!(node instanceof HTMLElement)) {
                        return false;
                    }

                    const style = window.getComputedStyle(node);
                    const rect = node.getBoundingClientRect();
                    return (
                        style.display !== "none" &&
                        style.visibility !== "hidden" &&
                        rect.width > 0 &&
                        rect.height > 0
                    );
                };

                const rootReady =
                    root instanceof HTMLElement &&
                    isVisible(root) &&
                    root.querySelector("*") !== null;
                const searchScope = rootReady ? root : body;
                const scopeRect =
                    searchScope instanceof HTMLElement
                        ? searchScope.getBoundingClientRect()
                        : {
                              width: document.documentElement.clientWidth,
                              height: document.documentElement.clientHeight,
                          };

                const visibleChildren = (node) =>
                    Array.from(node.children).filter(isVisible);

                const expectedWidth = expected?.width ?? null;
                const expectedHeight = expected?.height ?? null;
                const expectedAspect =
                    expectedWidth && expectedHeight
                        ? expectedWidth / expectedHeight
                        : null;
                const rootArea = Math.max(1, scopeRect.width * scopeRect.height);

                const buildCandidate = (node, strategyBase) => {
                    if (
                        !(node instanceof HTMLElement) ||
                        node === searchScope ||
                        !isVisible(node)
                    ) {
                        return null;
                    }

                    const rect = node.getBoundingClientRect();
                    const width = Math.round(rect.width);
                    const height = Math.round(rect.height);
                    const area = width * height;

                    if (width < 40 || height < 24 || area < 5_000) {
                        return null;
                    }

                    const descendants = node.querySelectorAll("*").length;
                    const areaRatio = area / rootArea;

                    if (areaRatio < 0.05 || areaRatio > 0.98) {
                        return null;
                    }

                    let score = 0;
                    if (expectedWidth && expectedHeight) {
                        score += Math.abs(width - expectedWidth) / expectedWidth;
                        score += Math.abs(height - expectedHeight) / expectedHeight;
                        if (expectedAspect) {
                            score += Math.abs(width / height - expectedAspect) * 1.5;
                        }
                    } else {
                        score += Math.abs(areaRatio - 0.6);
                    }

                    if (node.hasAttribute("data-testid")) {
                        score -= 0.8;
                    }
                    if (descendants >= 8) {
                        score -= 0.25;
                    }
                    if (node.getAttribute("role") === "dialog") {
                        score -= 0.15;
                    }

                    return {
                        node,
                        rect,
                        score,
                        descendants,
                        strategy: node.hasAttribute("data-testid")
                            ? `${strategyBase}-data-testid`
                            : strategyBase,
                    };
                };

                const visibleTestIds = Array.from(
                    searchScope.querySelectorAll("[data-testid]"),
                )
                    .map((node) => buildCandidate(node, "data-testid"))
                    .filter(Boolean);

                const visibleDescendants = Array.from(searchScope.querySelectorAll("*"))
                    .map((node) => buildCandidate(node, "best-descendant"))
                    .filter(Boolean);

                let target = searchScope;
                let strategy = rootReady ? "root" : "body";
                let bounds = {
                    x: Math.round(
                        searchScope instanceof HTMLElement ? scopeRect.x : 0,
                    ),
                    y: Math.round(
                        searchScope instanceof HTMLElement ? scopeRect.y : 0,
                    ),
                    width: Math.round(scopeRect.width),
                    height: Math.round(scopeRect.height),
                };

                const bestByScore = (candidates) =>
                    [...candidates].sort((left, right) => left.score - right.score)[0];

                if (visibleTestIds.length > 0) {
                    const best = bestByScore(visibleTestIds);
                    target = best.node;
                    strategy =
                        visibleTestIds.length === 1
                            ? "single-data-testid"
                            : best.strategy;
                    bounds = {
                        x: Math.round(best.rect.x),
                        y: Math.round(best.rect.y),
                        width: Math.round(best.rect.width),
                        height: Math.round(best.rect.height),
                    };
                } else if (visibleDescendants.length > 0 && expectedWidth && expectedHeight) {
                    const best = bestByScore(visibleDescendants);
                    target = best.node;
                    strategy = best.strategy;
                    bounds = {
                        x: Math.round(best.rect.x),
                        y: Math.round(best.rect.y),
                        width: Math.round(best.rect.width),
                        height: Math.round(best.rect.height),
                    };
                } else {
                    let current = searchScope;
                    while (true) {
                        const children = visibleChildren(current);
                        if (children.length !== 1) {
                            break;
                        }
                        current = children[0];
                    }
                    target = current;
                    strategy =
                        target === searchScope ? strategy : "single-child-chain";
                    const rect = target.getBoundingClientRect();
                    bounds = {
                        x: Math.round(rect.x),
                        y: Math.round(rect.y),
                        width: Math.round(rect.width),
                        height: Math.round(rect.height),
                    };
                }

                target.setAttribute(markerAttribute, "true");

                return {
                    resolvedSelector: `[${markerAttribute}="true"]`,
                    targetStrategy: strategy,
                    bounds,
                };
            }, expectedSize ?? null);

            resolvedSelector = autoTarget.resolvedSelector;
            targetStrategy = autoTarget.targetStrategy;
            targetBounds = autoTarget.bounds;
        }

        const target = page.locator(resolvedSelector);
        await target.waitFor({ state: "visible", timeout: 15_000 });
        await delay(waitMs);

        const locatorBounds = await target.boundingBox();
        const measuredBounds = locatorBounds
            ? {
                  x: Math.round(locatorBounds.x),
                  y: Math.round(locatorBounds.y),
                  width: Math.round(locatorBounds.width),
                  height: Math.round(locatorBounds.height),
              }
            : targetBounds;

        const screenshot = await target.screenshot({
            animations: "disabled",
            caret: "hide",
            scale: "css",
            omitBackground: false,
        });

        return {
            buffer: screenshot,
            requestedSelector,
            resolvedSelector,
            targetStrategy,
            targetBounds: measuredBounds,
        };
    } finally {
        await browser.close();
    }
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    assertRequiredArgs(args);

    if (args.help) {
        printHelp();
        return;
    }

    const storyUrl = `${args.baseUrl.replace(/\/$/, "")}/iframe.html`;
    let storybookProcess = null;

    if (!(await isUrlReachable(storyUrl))) {
        if (!args.startStorybook) {
            throw new Error(
                `Storybook is not reachable at ${storyUrl}. Start it manually or set --start-storybook true.`,
            );
        }

        storybookProcess = startStorybookServer(args.storybookCommand, process.cwd());
        const ready = await waitForUrl(storyUrl, 120_000);

        if (!ready) {
            throw new Error("Timed out waiting for Storybook to start.");
        }
    }

    const outputDir = path.resolve(
        args.outputDir,
        sanitizeForPath(args.storyId),
        new Date().toISOString().replace(/[:.]/g, "-"),
    );

    await fs.mkdir(outputDir, { recursive: true });

    try {
        const figmaBuffer = await loadImageBuffer(args.figma);
        const figmaMetadata = await sharp(figmaBuffer).metadata();
        const storyCapture = await captureStoryScreenshot({
            baseUrl: args.baseUrl,
            mockDate: args.mockDate,
            expectedSize:
                figmaMetadata.width && figmaMetadata.height
                    ? {
                          width: figmaMetadata.width,
                          height: figmaMetadata.height,
                      }
                    : null,
            selector: args.selector,
            storyId: args.storyId,
            waitMs: args.waitMs,
        });
        const tempInputDir = path.join(outputDir, "inputs");
        const figmaInputPath = path.join(tempInputDir, "figma.source.png");
        const storyInputPath = path.join(tempInputDir, "story.source.png");

        await Promise.all([
            writeImageBuffer(figmaInputPath, figmaBuffer),
            writeImageBuffer(storyInputPath, storyCapture.buffer),
        ]);

        const pythonResult = await runPythonImageDiff({
            referencePath: figmaInputPath,
            actualPath: storyInputPath,
            outputDir,
            threshold: args.threshold,
            trimWhitespace: args.trimWhitespace,
            trimTolerance: args.trimTolerance,
            trimPadding: args.trimPadding,
            referenceInset: args.referenceInset,
            actualInset: args.actualInset,
            referenceOutset: args.referenceOutset,
            actualOutset: args.actualOutset,
            topLeftAnchor: args.topLeftAnchor,
            fitReferenceWindow: args.fitReferenceWindow,
            fitActualWindow: args.fitActualWindow,
            autoAlign: args.autoAlign,
            alignSearch: args.alignSearch,
            maxMismatchRatio: args.maxMismatchRatio,
            exactOutputDir: true,
            referenceOutputName: "figma.normalized.png",
            actualOutputName: "story.actual.png",
            diffOutputName: "diff.png",
            diffOverlayOutputName: "diff.overlay.png",
            reportOutputName: "python.report.json",
        });
        const result = pythonResult.report;

        const report = {
            createdAt: new Date().toISOString(),
            storyId: args.storyId,
            figmaSource: args.figma,
            selector: storyCapture.requestedSelector,
            resolvedSelector: storyCapture.resolvedSelector,
            targetStrategy: storyCapture.targetStrategy,
            targetBounds: storyCapture.targetBounds,
            threshold: args.threshold,
            trimWhitespace: args.trimWhitespace,
            trimTolerance: args.trimTolerance,
            trimPadding: args.trimPadding,
            referenceInset: args.referenceInset,
            actualInset: args.actualInset,
            referenceOutset: args.referenceOutset,
            actualOutset: args.actualOutset,
            topLeftAnchor: args.topLeftAnchor,
            fitReferenceWindow: args.fitReferenceWindow,
            fitActualWindow: args.fitActualWindow,
            autoAlign: args.autoAlign,
            alignSearch: args.alignSearch,
            maxMismatchRatio: args.maxMismatchRatio,
            mockDate: args.mockDate,
            outputDir,
            artifacts: {
                figma: path.join(outputDir, "figma.normalized.png"),
                story: path.join(outputDir, "story.actual.png"),
                diff: path.join(outputDir, "diff.png"),
                diffOverlay: path.join(outputDir, "diff.overlay.png"),
                pythonReport: path.join(outputDir, "python.report.json"),
            },
            width: result.width,
            height: result.height,
            mismatchRatio: result.mismatchRatio,
            mismatchedPixels: result.mismatchedPixels,
            totalPixels: result.totalPixels,
            figma: result.reference,
            story: result.actual,
            alignment: result.alignment,
            referenceFitWindow: result.referenceFitWindow,
            actualFitWindow: result.actualFitWindow,
            differenceRegions: result.differenceRegions,
            diffEngine: "python",
        };

        await fs.writeFile(
            path.join(outputDir, "report.json"),
            `${JSON.stringify(report, null, 2)}\n`,
        );

        console.log(JSON.stringify(report, null, 2));

        if (pythonResult.exitCode === 1) {
            process.exitCode = 1;
        }
    } finally {
        if (storybookProcess) {
            storybookProcess.kill("SIGTERM");
        }
    }
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
