"""
ocr.py
License plate OCR helpers:
  - fix_plate_format() corrects common letter/digit mix-ups in PH plates
  - read_plate_text() crops, preprocesses and reads text from a detected plate region
"""

import re

import cv2

LETTER_TO_NUMBER = {"O": "0", "I": "1", "Z": "2", "S": "5", "B": "8"
"", "G": "6"}
NUMBER_TO_LETTER = {"0": "O", "1": "I", "2": "Z", "5": "S", "8": "B", "6": "G"}
STANDARD_PLATE_PATTERN = re.compile(r"^[A-Z]{3}\d{4}$")
OLD_MC_PLATE_PATTERN = re.compile(r"^\d{4}[A-Z]{3}$")
TEMP_MC_NUMERIC_ALPHA_PATTERN = re.compile(r"^\d{3}[A-Z]{3}$")
TEMP_MC_ALPHA_NUMERIC_PATTERN = re.compile(r"^[A-Z]\d{3}[A-Z]{2}$")
MV_FILE_PATTERN = re.compile(r"^\d{4}-\d{6,7}$")


def normalize_ocr_text(text: str) -> str:
    return "".join(ch for ch in text.upper() if ch.isalnum())


def normalize_digits(text: str) -> str:
    return "".join(ch for ch in text if ch.isdigit())


def fix_standard_plate_format(text: str) -> str:
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

    return candidate if STANDARD_PLATE_PATTERN.fullmatch(candidate) else ""


def fix_old_motorcycle_plate_format(text: str) -> str:
    """
    Normalize a 7-character candidate into 1234ABC.
    First 4 chars should be digits; last 3 chars should be letters.
    """
    clean = normalize_ocr_text(text)
    if len(clean) != 7:
        return ""

    numbers_part = clean[:4]
    letters_part = clean[4:]

    fixed_numbers = "".join(LETTER_TO_NUMBER.get(ch, ch) for ch in numbers_part)
    fixed_letters = "".join(NUMBER_TO_LETTER.get(ch, ch) for ch in letters_part)
    candidate = fixed_numbers + fixed_letters

    return candidate if OLD_MC_PLATE_PATTERN.fullmatch(candidate) else ""


def fix_mv_file_number_format(text: str) -> str:
    """
    Normalize a motorcycle MV file number into 1234-123456 or 1234-1234567.
    OCR may return it with or without the hyphen.
    """
    digits = normalize_digits(text)
    if len(digits) not in {10, 11}:
        return ""

    candidate = f"{digits[:4]}-{digits[4:]}"
    return candidate if MV_FILE_PATTERN.fullmatch(candidate) else ""


def fix_temp_motorcycle_numeric_alpha_format(text: str) -> str:
    """
    Normalize a 6-character temporary motorcycle plate into 123ABC.
    """
    clean = normalize_ocr_text(text)
    if len(clean) != 6:
        return ""

    numbers_part = clean[:3]
    letters_part = clean[3:]

    fixed_numbers = "".join(LETTER_TO_NUMBER.get(ch, ch) for ch in numbers_part)
    fixed_letters = "".join(NUMBER_TO_LETTER.get(ch, ch) for ch in letters_part)
    candidate = fixed_numbers + fixed_letters

    return candidate if TEMP_MC_NUMERIC_ALPHA_PATTERN.fullmatch(candidate) else ""


def fix_temp_motorcycle_alpha_numeric_format(text: str) -> str:
    """
    Normalize a 6-character temporary motorcycle plate into A123BC.
    """
    clean = normalize_ocr_text(text)
    if len(clean) != 6:
        return ""

    letter_prefix = clean[:1]
    numbers_part = clean[1:4]
    letters_part = clean[4:]

    fixed_prefix = "".join(NUMBER_TO_LETTER.get(ch, ch) for ch in letter_prefix)
    fixed_numbers = "".join(LETTER_TO_NUMBER.get(ch, ch) for ch in numbers_part)
    fixed_letters = "".join(NUMBER_TO_LETTER.get(ch, ch) for ch in letters_part)
    candidate = fixed_prefix + fixed_numbers + fixed_letters

    return candidate if TEMP_MC_ALPHA_NUMERIC_PATTERN.fullmatch(candidate) else ""


def fix_plate_format(text: str) -> str:
    """
    Normalize OCR output into a supported Philippine motorcycle identifier.
    Supported formats:
      - ABC1234
      - 1234ABC
      - 123ABC
      - A123BC
      - 1234-123456
      - 1234-1234567
    """
    return (
        fix_standard_plate_format(text)
        or fix_old_motorcycle_plate_format(text)
        or fix_temp_motorcycle_numeric_alpha_format(text)
        or fix_temp_motorcycle_alpha_numeric_format(text)
        or fix_mv_file_number_format(text)
    )


def extract_plate_candidate(texts) -> str:
    """
    Return the first valid plate-like candidate from OCR output.
    Keeps the format strict to avoid saving random words like "MODERN" or "TOMTI".
    """
    for raw_text in texts:
        clean = normalize_ocr_text(raw_text)
        digits_only = normalize_digits(raw_text)

        for mv_length in (11, 10):
            if len(digits_only) < mv_length:
                continue

            for start in range(len(digits_only) - mv_length + 1):
                candidate = fix_mv_file_number_format(digits_only[start:start + mv_length])
                if candidate:
                    return candidate

        if len(clean) >= 7:
            for start in range(len(clean) - 6):
                candidate = (
                    fix_standard_plate_format(clean[start:start + 7])
                    or fix_old_motorcycle_plate_format(clean[start:start + 7])
                )
                if candidate:
                    return candidate

        if len(clean) >= 6:
            for start in range(len(clean) - 5):
                candidate = (
                    fix_temp_motorcycle_numeric_alpha_format(clean[start:start + 6])
                    or fix_temp_motorcycle_alpha_numeric_format(clean[start:start + 6])
                )
                if candidate:
                    return candidate

    return ""


# EasyOCR only emits these characters — kills lowercase / punctuation noise.
PLATE_ALLOWLIST = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-"


def _loose_plate_candidate(texts) -> str:
    """
    Best-effort fallback when nothing matches a strict PH plate format, so the
    record is not left blank. Accepts a 5-8 char alphanumeric token with >=2
    letters AND >=2 digits (covers every PH car/motorcycle format) — rejects
    shirt text like 'FINISHER' (no digits) and fragments like '42K' (too short).
    An operator can fix a near-miss via the plate-correction workflow; a blank
    they cannot. MV file numbers stay strict-only (handled above).
    """
    best = ""
    for raw_text in texts:
        clean = normalize_ocr_text(raw_text)
        if not (5 <= len(clean) <= 8):
            continue
        n_digit = sum(ch.isdigit() for ch in clean)
        n_alpha = sum(ch.isalpha() for ch in clean)
        if n_digit >= 2 and n_alpha >= 2 and len(clean) > len(best):
            best = clean
    return best


def _preprocess_variants(crop):
    """
    A couple of grayscale renderings to run OCR on. EasyOCR's recogniser often
    does better on a CLAHE-equalised grayscale than on a hard Otsu binary, but
    the binary still wins on high-contrast plates — so try both.
    """
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    gray = cv2.resize(gray, None, fx=3.0, fy=3.0, interpolation=cv2.INTER_LANCZOS4)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(gray)
    _, otsu = cv2.threshold(clahe, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return (clahe, otsu)


def read_plate_text(frame_bgr, x1, y1, x2, y2, reader, ocr_conf=0.2):
    """
    Crop the plate region, preprocess it, run EasyOCR (plate-char allowlist) on
    a few renderings, and return the best plate string. Prefers a strict PH
    format; falls back to a plausible raw token so the record is never blank.
    """
    try:
        h, w = frame_bgr.shape[:2]

        # Small margin so the ends of the characters are not clipped by a tight
        # / low-confidence YOLO box.
        bw = max(1, int(x2 - x1))
        bh = max(1, int(y2 - y1))
        x1 = max(0, min(int(x1 - bw * 0.06), w - 1))
        x2 = max(0, min(int(x2 + bw * 0.06), w))
        y1 = max(0, min(int(y1 - bh * 0.10), h - 1))
        y2 = max(0, min(int(y2 + bh * 0.10), h))
        if x2 <= x1 or y2 <= y1:
            return ""

        crop = frame_bgr[y1:y2, x1:x2]
        if crop.size == 0:
            return ""

        strong_texts, all_texts = [], []
        weak_conf = max(0.10, ocr_conf * 0.5)
        for img in _preprocess_variants(crop):
            for (_, text, prob) in reader.readtext(img, allowlist=PLATE_ALLOWLIST):
                if len(normalize_ocr_text(text)) < 3:
                    continue
                if prob >= weak_conf:
                    all_texts.append(text)
                if prob >= ocr_conf:
                    strong_texts.append(text)

        if not all_texts:
            return ""

        # 1) strict PH-format match (highest trust)
        strict = extract_plate_candidate(
            ["".join(strong_texts), *strong_texts, *all_texts]
        )
        if strict:
            return strict

        # 2) best-effort raw token so the DB gets a correctable value, not blank
        return _loose_plate_candidate(all_texts)
    except Exception:
        return ""
