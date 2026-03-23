"""
ocr.py
License plate OCR helpers:
  - fix_plate_format() corrects common letter/digit mix-ups in PH plates
  - read_plate_text() crops, preprocesses and reads text from a detected plate region
"""

import re

import cv2

LETTER_TO_NUMBER = {"O": "0", "I": "1", "Z": "2", "S": "5", "B": "8", "G": "6"}
NUMBER_TO_LETTER = {"0": "O", "1": "I", "2": "Z", "5": "S", "8": "B", "6": "G"}
PLATE_PATTERN = re.compile(r"^[A-Z]{3}\d{4}$")


def normalize_ocr_text(text: str) -> str:
    return "".join(ch for ch in text.upper() if ch.isalnum())


def fix_plate_format(text: str) -> str:
    """
    Normalize a 7-character candidate into AAA1234.
    First 3 chars should be letters; last 4 chars should be digits.
    """
    clean = normalize_ocr_text(text)
    if len(clean) != 7:
        return ""

    letters_part = clean[:3]
    numbers_part = clean[3:]

    fixed_letters = "".join(NUMBER_TO_LETTER.get(ch, ch) for ch in letters_part)
    fixed_numbers = "".join(LETTER_TO_NUMBER.get(ch, ch) for ch in numbers_part)
    candidate = fixed_letters + fixed_numbers

    return candidate if PLATE_PATTERN.fullmatch(candidate) else ""


def extract_plate_candidate(texts) -> str:
    """
    Return the first valid plate-like candidate from OCR output.
    Keeps the format strict to avoid saving random words like "MODERN" or "TOMTI".
    """
    for raw_text in texts:
        clean = normalize_ocr_text(raw_text)
        if len(clean) < 7:
            continue

        for start in range(len(clean) - 6):
            candidate = fix_plate_format(clean[start:start + 7])
            if candidate:
                return candidate

    return ""


def read_plate_text(frame_bgr, x1, y1, x2, y2, reader, ocr_conf=0.2):
    """
    Crop the license plate region, preprocess it, and run EasyOCR.
    Returns a strict plate-like value, or "" if nothing valid was found.
    """
    try:
        h, w = frame_bgr.shape[:2]
        x1 = max(0, min(x1, w - 1))
        x2 = max(0, min(x2, w))
        y1 = max(0, min(y1, h - 1))
        y2 = max(0, min(y2, h))

        if x2 <= x1 or y2 <= y1:
            return ""

        crop = frame_bgr[y1:y2, x1:x2]
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        gray = cv2.resize(gray, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        results = reader.readtext(thresh)
        texts = [
            text for (_, text, prob) in results
            if prob >= ocr_conf and len(normalize_ocr_text(text)) >= 3
        ]
        if not texts:
            return ""

        combined_text = "".join(texts)
        return extract_plate_candidate([combined_text, *texts])
    except Exception:
        return ""
