#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import sys
from collections import deque
from dataclasses import dataclass
from datetime import datetime, UTC
from pathlib import Path
from typing import Iterable

import numpy as np
from PIL import Image, ImageDraw, ImageFont


@dataclass
class PreparedImage:
    image: Image.Image
    original_width: int
    original_height: int
    crop: dict[str, int]


def parse_bool(value: str) -> bool:
    return value.lower() not in {"0", "false", "no"}


def parse_inset(value: str) -> tuple[int, int, int, int]:
    parts = [part.strip() for part in value.split(",") if part.strip()]
    if not parts:
        return (0, 0, 0, 0)

    numbers = [max(0, int(part)) for part in parts]
    if len(numbers) == 1:
        top = right = bottom = left = numbers[0]
    elif len(numbers) == 2:
        top = bottom = numbers[0]
        right = left = numbers[1]
    elif len(numbers) == 3:
        top = numbers[0]
        right = left = numbers[1]
        bottom = numbers[2]
    elif len(numbers) == 4:
        top, right, bottom, left = numbers
    else:
        raise argparse.ArgumentTypeError(
            "Inset must be 1, 2, 3, or 4 comma-separated integers"
        )

    return (top, right, bottom, left)


def parse_box(value: str) -> tuple[int, int, int, int]:
    return parse_inset(value)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Compare two images and output diff artifacts."
    )
    parser.add_argument("--reference", required=True, help="Reference image path")
    parser.add_argument("--actual", required=True, help="Actual image path")
    parser.add_argument(
        "--output-dir",
        default="output/image-diff",
        help="Diff artifact directory",
    )
    parser.add_argument(
        "--exact-output-dir",
        type=parse_bool,
        default=False,
        help="Write artifacts directly into output-dir without nested timestamp folders",
    )
    parser.add_argument(
        "--reference-output-name",
        default="reference.normalized.png",
        help="Normalized reference image file name",
    )
    parser.add_argument(
        "--actual-output-name",
        default="actual.normalized.png",
        help="Normalized actual image file name",
    )
    parser.add_argument(
        "--diff-output-name",
        default="diff.png",
        help="Diff image file name",
    )
    parser.add_argument(
        "--diff-overlay-output-name",
        default="diff.overlay.png",
        help="Overlay diff image file name",
    )
    parser.add_argument(
        "--report-output-name",
        default="report.json",
        help="Report JSON file name",
    )
    parser.add_argument(
        "--reference-inset",
        type=parse_inset,
        default=(0, 0, 0, 0),
        help="Crop reference image edges before diff. Format: 2 or 2,4,2,4",
    )
    parser.add_argument(
        "--actual-inset",
        type=parse_inset,
        default=(0, 0, 0, 0),
        help="Crop actual image edges before diff. Format: 2 or 2,4,2,4",
    )
    parser.add_argument(
        "--reference-outset",
        type=parse_box,
        default=(0, 0, 0, 0),
        help="Add white margins around reference image before diff. Format: 12 or 12,16,12,16",
    )
    parser.add_argument(
        "--actual-outset",
        type=parse_box,
        default=(0, 0, 0, 0),
        help="Add white margins around actual image before diff. Format: 12 or 12,16,12,16",
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=0.08,
        help="Per-channel diff threshold in 0-1 range",
    )
    parser.add_argument(
        "--trim-whitespace",
        type=parse_bool,
        default=True,
        help="Crop outer white margins before diff",
    )
    parser.add_argument(
        "--trim-tolerance",
        type=int,
        default=12,
        help="How far from white counts as content (0-255)",
    )
    parser.add_argument(
        "--trim-padding",
        type=int,
        default=0,
        help="Extra padding to keep around cropped content",
    )
    parser.add_argument(
        "--top-left-anchor",
        type=parse_bool,
        default=False,
        help="Compare from shared top-left corner only",
    )
    parser.add_argument(
        "--fit-reference-window",
        type=parse_bool,
        default=False,
        help="When reference is larger than actual, crop the best-matching window before diff",
    )
    parser.add_argument(
        "--fit-actual-window",
        type=parse_bool,
        default=False,
        help="When actual is larger than reference, crop the best-matching window before diff",
    )
    parser.add_argument(
        "--auto-align",
        type=parse_bool,
        default=True,
        help="Search small x/y shifts before diff",
    )
    parser.add_argument(
        "--align-search",
        type=int,
        default=48,
        help="Max shift in each direction for auto align",
    )
    parser.add_argument(
        "--max-mismatch-ratio",
        type=float,
        default=None,
        help="Fail when ratio is above this value",
    )
    return parser


def sanitize_for_path(value: str) -> str:
    sanitized = "".join(char if char.isalnum() or char in "._-" else "-" for char in value)
    return sanitized.strip("-") or "image"


def load_rgba_image(path: Path) -> Image.Image:
    if not path.exists():
        raise FileNotFoundError(f"Image not found: {path}")
    return Image.open(path).convert("RGBA")


def apply_inset(image: Image.Image, inset: tuple[int, int, int, int]) -> tuple[Image.Image, dict[str, int]]:
    top, right, bottom, left = inset
    crop_left = min(max(0, left), image.width - 1)
    crop_top = min(max(0, top), image.height - 1)
    crop_right = max(crop_left + 1, image.width - max(0, right))
    crop_bottom = max(crop_top + 1, image.height - max(0, bottom))
    cropped = image.crop((crop_left, crop_top, crop_right, crop_bottom))
    return (
        cropped,
        {
            "top": crop_top,
            "right": image.width - crop_right,
            "bottom": image.height - crop_bottom,
            "left": crop_left,
        },
    )


def apply_outset(
    image: Image.Image, outset: tuple[int, int, int, int]
) -> tuple[Image.Image, dict[str, int]]:
    top, right, bottom, left = outset
    width = image.width + left + right
    height = image.height + top + bottom
    canvas = Image.new("RGBA", (width, height), (255, 255, 255, 255))
    canvas.paste(image, (left, top))
    return (
        canvas,
        {
            "top": max(0, top),
            "right": max(0, right),
            "bottom": max(0, bottom),
            "left": max(0, left),
        },
    )


def detect_content_bounds(image: Image.Image, tolerance: int, padding: int) -> tuple[int, int, int, int]:
    rgba = np.asarray(image)
    alpha = rgba[:, :, 3]
    rgb = rgba[:, :, :3]
    content_mask = (alpha < 255) | np.any(rgb < 255 - tolerance, axis=2)

    coords = np.argwhere(content_mask)
    if coords.size == 0:
        return (0, 0, image.width, image.height)

    top = int(coords[:, 0].min())
    bottom = int(coords[:, 0].max())
    left = int(coords[:, 1].min())
    right = int(coords[:, 1].max())

    left = max(0, left - padding)
    top = max(0, top - padding)
    right = min(image.width - 1, right + padding)
    bottom = min(image.height - 1, bottom + padding)

    return (left, top, right + 1, bottom + 1)


def prepare_image(
    image: Image.Image,
    trim_whitespace: bool,
    trim_tolerance: int,
    trim_padding: int,
    inset: tuple[int, int, int, int],
    outset: tuple[int, int, int, int],
) -> PreparedImage:
    inset_applied, inset_meta = apply_inset(image, inset)
    outset_applied, outset_meta = apply_outset(inset_applied, outset)
    crop_box = (
        detect_content_bounds(outset_applied, trim_tolerance, trim_padding)
        if trim_whitespace
        else (0, 0, outset_applied.width, outset_applied.height)
    )
    cropped = outset_applied.crop(crop_box)
    return PreparedImage(
        image=cropped,
        original_width=image.width,
        original_height=image.height,
        crop={
            "left": inset_meta["left"] + crop_box[0] - outset_meta["left"],
            "top": inset_meta["top"] + crop_box[1] - outset_meta["top"],
            "width": crop_box[2] - crop_box[0],
            "height": crop_box[3] - crop_box[1],
            "inset": inset_meta,
            "outset": outset_meta,
        },
    )


def image_to_small_gray(image: Image.Image, max_width: int = 240) -> np.ndarray:
    width, height = image.size
    target_width = min(max_width, width)
    target_height = max(1, round(height / width * target_width))
    resized = image.convert("L").resize((target_width, target_height), Image.Resampling.BILINEAR)
    return np.asarray(resized, dtype=np.uint8)


def score_offset(reference: np.ndarray, actual: np.ndarray, offset_x: int, offset_y: int) -> float:
    ref_height, ref_width = reference.shape
    act_height, act_width = actual.shape

    ref_start_x = max(0, -offset_x)
    ref_start_y = max(0, -offset_y)
    act_start_x = max(0, offset_x)
    act_start_y = max(0, offset_y)

    overlap_width = min(ref_width - ref_start_x, act_width - act_start_x)
    overlap_height = min(ref_height - ref_start_y, act_height - act_start_y)

    if overlap_width <= 0 or overlap_height <= 0:
        return float("inf")

    overlap_area = overlap_width * overlap_height
    min_area = min(ref_width * ref_height, act_width * act_height)
    if overlap_area < min_area * 0.6:
        return float("inf")

    ref_patch = reference[
        ref_start_y : ref_start_y + overlap_height,
        ref_start_x : ref_start_x + overlap_width,
    ]
    act_patch = actual[
        act_start_y : act_start_y + overlap_height,
        act_start_x : act_start_x + overlap_width,
    ]
    return float(np.abs(ref_patch.astype(np.int16) - act_patch.astype(np.int16)).mean())


def find_best_offset(reference_image: Image.Image, actual_image: Image.Image, max_search: int) -> dict[str, float | int]:
    small_reference = image_to_small_gray(reference_image)
    small_actual = image_to_small_gray(actual_image)
    ref_height, ref_width = small_reference.shape
    act_height, act_width = small_actual.shape

    scale_x = reference_image.width / ref_width
    scale_y = reference_image.height / ref_height
    scaled_search = max(1, round(max_search / max(scale_x, scale_y)))

    best_x = 0
    best_y = 0
    best_score = score_offset(small_reference, small_actual, 0, 0)

    for offset_y in range(-scaled_search, scaled_search + 1):
        for offset_x in range(-scaled_search, scaled_search + 1):
            score = score_offset(small_reference, small_actual, offset_x, offset_y)
            if score < best_score:
                best_score = score
                best_x = offset_x
                best_y = offset_y

    return {
        "x": round(best_x * scale_x),
        "y": round(best_y * scale_y),
        "score": best_score,
        "mode": "auto-align",
    }


def find_best_window(
    larger_image: Image.Image,
    smaller_image: Image.Image,
    max_search: int,
) -> dict[str, float | int]:
    if (
        larger_image.width < smaller_image.width
        or larger_image.height < smaller_image.height
    ):
        return {
            "left": 0,
            "top": 0,
            "width": min(larger_image.width, smaller_image.width),
            "height": min(larger_image.height, smaller_image.height),
            "score": None,
            "mode": "none",
        }

    max_left = larger_image.width - smaller_image.width
    max_top = larger_image.height - smaller_image.height
    search_left = min(max_left, max_search)
    search_top = min(max_top, max_search)

    small_target = image_to_small_gray(smaller_image)
    target_height, target_width = small_target.shape

    best_left = 0
    best_top = 0
    best_score = float("inf")

    for top in range(search_top + 1):
        for left in range(search_left + 1):
            window = larger_image.crop(
                (left, top, left + smaller_image.width, top + smaller_image.height)
            )
            small_window = np.asarray(
                window.convert("L").resize(
                    (target_width, target_height), Image.Resampling.BILINEAR
                ),
                dtype=np.uint8,
            )
            score = float(
                np.abs(
                    small_window.astype(np.int16) - small_target.astype(np.int16)
                ).mean()
            )
            if score < best_score:
                best_score = score
                best_left = left
                best_top = top

    return {
        "left": best_left,
        "top": best_top,
        "width": smaller_image.width,
        "height": smaller_image.height,
        "score": best_score,
        "mode": "fit-reference-window",
    }


def paste_on_canvas(image: Image.Image, width: int, height: int, left: int, top: int) -> Image.Image:
    canvas = Image.new("RGBA", (width, height), (255, 255, 255, 255))
    canvas.paste(image, (left, top))
    return canvas


def grow_mask(mask: np.ndarray, radius: int) -> np.ndarray:
    if radius <= 0:
        return mask

    height, width = mask.shape
    grown = np.zeros_like(mask, dtype=bool)
    ys, xs = np.where(mask)
    for y, x in zip(ys, xs, strict=False):
        y0 = max(0, y - radius)
        y1 = min(height, y + radius + 1)
        x0 = max(0, x - radius)
        x1 = min(width, x + radius + 1)
        grown[y0:y1, x0:x1] = True
    return grown


def detect_regions(mask: np.ndarray) -> list[dict[str, int]]:
    expanded = grow_mask(mask, 2)
    height, width = expanded.shape
    visited = np.zeros_like(expanded, dtype=bool)
    regions: list[dict[str, int]] = []

    for y in range(height):
        for x in range(width):
            if not expanded[y, x] or visited[y, x]:
                continue

            queue: deque[tuple[int, int]] = deque([(x, y)])
            visited[y, x] = True
            left = right = x
            top = bottom = y
            expanded_pixels = 0
            mismatch_pixels = 0

            while queue:
                current_x, current_y = queue.popleft()
                expanded_pixels += 1
                mismatch_pixels += int(mask[current_y, current_x])
                left = min(left, current_x)
                right = max(right, current_x)
                top = min(top, current_y)
                bottom = max(bottom, current_y)

                for next_x, next_y in (
                    (current_x - 1, current_y),
                    (current_x + 1, current_y),
                    (current_x, current_y - 1),
                    (current_x, current_y + 1),
                ):
                    if (
                        next_x < 0
                        or next_y < 0
                        or next_x >= width
                        or next_y >= height
                        or visited[next_y, next_x]
                        or not expanded[next_y, next_x]
                    ):
                        continue

                    visited[next_y, next_x] = True
                    queue.append((next_x, next_y))

            region_width = right - left + 1
            region_height = bottom - top + 1
            region_area = region_width * region_height

            if (
                mismatch_pixels < 24
                or region_area < 600
                or region_width < 12
                or region_height < 12
            ):
                continue

            regions.append(
                {
                    "left": left,
                    "top": top,
                    "width": region_width,
                    "height": region_height,
                    "mismatchPixels": mismatch_pixels,
                    "expandedPixels": expanded_pixels,
                    "area": region_area,
                }
            )

    regions.sort(key=lambda region: region["mismatchPixels"], reverse=True)
    return regions[:12]


def create_overlay(base_image: Image.Image, regions: Iterable[dict[str, int]], output_path: Path) -> None:
    overlay = base_image.convert("RGBA")
    draw = ImageDraw.Draw(overlay, "RGBA")
    font = ImageFont.load_default()

    for index, region in enumerate(regions, start=1):
        left = region["left"]
        top = region["top"]
        right = left + region["width"] - 1
        bottom = top + region["height"] - 1
        draw.rectangle(
            [(left, top), (right, bottom)],
            outline=(255, 59, 48, 255),
            width=2,
            fill=(255, 59, 48, 30),
        )

        label = str(index)
        label_w = 22
        label_h = 18
        label_x = max(0, min(left, overlay.width - label_w))
        label_y = max(0, top - label_h - 4)
        draw.rounded_rectangle(
            [(label_x, label_y), (label_x + label_w, label_y + label_h)],
            radius=4,
            fill=(255, 59, 48, 255),
        )
        draw.text((label_x + 7, label_y + 3), label, fill=(255, 255, 255, 255), font=font)

    overlay.save(output_path)


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    reference_path = Path(args.reference).resolve()
    actual_path = Path(args.actual).resolve()
    output_dir = (
        Path(args.output_dir).resolve()
        if args.exact_output_dir
        else Path(args.output_dir).resolve()
        / f"{sanitize_for_path(reference_path.name)}-vs-{sanitize_for_path(actual_path.name)}"
        / datetime.now(UTC).isoformat().replace(":", "-").replace(".", "-")
    )
    output_dir.mkdir(parents=True, exist_ok=True)

    reference_source = load_rgba_image(reference_path)
    actual_source = load_rgba_image(actual_path)
    reference_prepared = prepare_image(
        reference_source,
        trim_whitespace=args.trim_whitespace,
        trim_tolerance=args.trim_tolerance,
        trim_padding=args.trim_padding,
        inset=args.reference_inset,
        outset=args.reference_outset,
    )
    actual_prepared = prepare_image(
        actual_source,
        trim_whitespace=args.trim_whitespace,
        trim_tolerance=args.trim_tolerance,
        trim_padding=args.trim_padding,
        inset=args.actual_inset,
        outset=args.actual_outset,
    )

    reference_fit = {
        "left": 0,
        "top": 0,
        "width": reference_prepared.image.width,
        "height": reference_prepared.image.height,
        "score": None,
        "mode": "none",
    }
    actual_fit = {
        "left": 0,
        "top": 0,
        "width": actual_prepared.image.width,
        "height": actual_prepared.image.height,
        "score": None,
        "mode": "none",
    }

    if args.fit_reference_window:
        reference_fit = find_best_window(
            reference_prepared.image,
            actual_prepared.image,
            args.align_search,
        )
        if reference_fit["mode"] == "fit-reference-window":
            left = int(reference_fit["left"])
            top = int(reference_fit["top"])
            width = int(reference_fit["width"])
            height = int(reference_fit["height"])
            reference_prepared = PreparedImage(
                image=reference_prepared.image.crop(
                    (left, top, left + width, top + height)
                ),
                original_width=reference_prepared.original_width,
                original_height=reference_prepared.original_height,
                crop={
                    **reference_prepared.crop,
                    "left": reference_prepared.crop["left"] + left,
                    "top": reference_prepared.crop["top"] + top,
                    "width": width,
                    "height": height,
                },
            )

    if args.fit_actual_window:
        actual_fit = find_best_window(
            actual_prepared.image,
            reference_prepared.image,
            args.align_search,
        )
        if actual_fit["mode"] == "fit-reference-window":
            left = int(actual_fit["left"])
            top = int(actual_fit["top"])
            width = int(actual_fit["width"])
            height = int(actual_fit["height"])
            actual_prepared = PreparedImage(
                image=actual_prepared.image.crop(
                    (left, top, left + width, top + height)
                ),
                original_width=actual_prepared.original_width,
                original_height=actual_prepared.original_height,
                crop={
                    **actual_prepared.crop,
                    "left": actual_prepared.crop["left"] + left,
                    "top": actual_prepared.crop["top"] + top,
                    "width": width,
                    "height": height,
                },
            )

    if args.top_left_anchor:
        alignment = {"x": 0, "y": 0, "score": None, "mode": "top-left-anchor"}
        width = min(reference_prepared.image.width, actual_prepared.image.width)
        height = min(reference_prepared.image.height, actual_prepared.image.height)
        reference_normalized = reference_prepared.image.crop((0, 0, width, height))
        actual_normalized = actual_prepared.image.crop((0, 0, width, height))
    else:
        alignment = (
            find_best_offset(reference_prepared.image, actual_prepared.image, args.align_search)
            if args.auto_align
            else {"x": 0, "y": 0, "score": None, "mode": "none"}
        )
        reference_left = max(0, -int(alignment["x"]))
        reference_top = max(0, -int(alignment["y"]))
        actual_left = max(0, int(alignment["x"]))
        actual_top = max(0, int(alignment["y"]))
        width = max(
            reference_prepared.image.width + reference_left,
            actual_prepared.image.width + actual_left,
        )
        height = max(
            reference_prepared.image.height + reference_top,
            actual_prepared.image.height + actual_top,
        )
        reference_normalized = paste_on_canvas(
            reference_prepared.image, width, height, reference_left, reference_top
        )
        actual_normalized = paste_on_canvas(
            actual_prepared.image, width, height, actual_left, actual_top
        )

    reference_array = np.asarray(reference_normalized, dtype=np.uint8)
    actual_array = np.asarray(actual_normalized, dtype=np.uint8)
    limit = round(args.threshold * 255)
    channel_diff = np.abs(reference_array.astype(np.int16) - actual_array.astype(np.int16))
    mismatch_mask = np.any(channel_diff > limit, axis=2)
    mismatched_pixels = int(mismatch_mask.sum())
    total_pixels = width * height

    gray = (
        reference_array[:, :, 0] * 0.299
        + reference_array[:, :, 1] * 0.587
        + reference_array[:, :, 2] * 0.114
    ).round().astype(np.uint8)

    diff_array = np.zeros((height, width, 4), dtype=np.uint8)
    diff_array[:, :, 0] = gray
    diff_array[:, :, 1] = gray
    diff_array[:, :, 2] = gray
    diff_array[:, :, 3] = 80
    diff_array[mismatch_mask] = np.array([255, 59, 48, 255], dtype=np.uint8)
    diff_image = Image.fromarray(diff_array, mode="RGBA")

    regions = detect_regions(mismatch_mask)

    reference_output = output_dir / args.reference_output_name
    actual_output = output_dir / args.actual_output_name
    diff_output = output_dir / args.diff_output_name
    diff_overlay_output = output_dir / args.diff_overlay_output_name

    reference_normalized.save(reference_output)
    actual_normalized.save(actual_output)
    diff_image.save(diff_output)
    create_overlay(actual_normalized, regions, diff_overlay_output)

    report = {
        "createdAt": datetime.now(UTC).isoformat(),
        "threshold": args.threshold,
        "trimWhitespace": args.trim_whitespace,
        "trimTolerance": args.trim_tolerance,
        "trimPadding": args.trim_padding,
        "referenceInset": list(args.reference_inset),
        "actualInset": list(args.actual_inset),
        "referenceOutset": list(args.reference_outset),
        "actualOutset": list(args.actual_outset),
        "topLeftAnchor": args.top_left_anchor,
        "fitReferenceWindow": args.fit_reference_window,
        "fitActualWindow": args.fit_actual_window,
        "autoAlign": args.auto_align,
        "alignSearch": args.align_search,
        "maxMismatchRatio": args.max_mismatch_ratio,
        "outputDir": str(output_dir),
        "artifacts": {
            "reference": str(reference_output),
            "actual": str(actual_output),
            "diff": str(diff_output),
            "diffOverlay": str(diff_overlay_output),
        },
        "width": width,
        "height": height,
        "mismatchedPixels": mismatched_pixels,
        "totalPixels": total_pixels,
        "mismatchRatio": mismatched_pixels / total_pixels if total_pixels else 0,
        "reference": {
            "width": reference_prepared.original_width,
            "height": reference_prepared.original_height,
            "croppedWidth": reference_normalized.width,
            "croppedHeight": reference_normalized.height,
            "crop": reference_prepared.crop,
        },
        "actual": {
            "width": actual_prepared.original_width,
            "height": actual_prepared.original_height,
            "croppedWidth": actual_normalized.width,
            "croppedHeight": actual_normalized.height,
            "crop": actual_prepared.crop,
        },
        "alignment": alignment,
        "referenceFitWindow": reference_fit,
        "actualFitWindow": actual_fit,
        "differenceRegions": regions,
    }

    report_output = output_dir / args.report_output_name
    report_output.write_text(f"{json.dumps(report, indent=2, ensure_ascii=False)}\n")
    print(json.dumps(report, indent=2, ensure_ascii=False))

    if (
        args.max_mismatch_ratio is not None
        and report["mismatchRatio"] > args.max_mismatch_ratio
    ):
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
