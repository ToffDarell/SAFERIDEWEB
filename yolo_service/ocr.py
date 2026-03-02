"""
ocr.py
License plate OCR helpers:
  - fix_plate_format()  — corrects common letter/digit mix-ups in PH plates
  - read_plate_text()   — crops, preprocesses and reads text from a detected plate region
"""

import cv2


def fix_plate_format(text: str) -> str:
    """
    Fix common OCR mix-ups for Philippine license plates (AAA-1234 format).
    First 3 chars should be letters; last chars should be digits.
    """
    LETTER_TO_NUMBER = {"O": "0", "I": "1", "Z": "2", "S": "5", "B": "8", "G": "6"}
    NUMBER_TO_LETTER = {"0": "O", "1": "I", "2": "Z", "5": "S", "8": "B", "6": "G"}

    clean = text.replace(" ", "")

    if len(clean) >= 6:
        letters_part = clean[:3]
        numbers_part = clean[3:]

        fixed_letters = "".join(NUMBER_TO_LETTER.get(ch, ch) for ch in letters_part)
        fixed_numbers = "".join(LETTER_TO_NUMBER.get(ch, ch) for ch in numbers_part)

        return fixed_letters + fixed_numbers

    return text


def read_plate_text(frame_bgr, x1, y1, x2, y2, reader, ocr_conf=0.2):
    """
    Crop the license plate region, preprocess it, and run EasyOCR.
    Returns the cleaned plate string, or "" if nothing readable was found.
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
            if prob >= ocr_conf and len(text) >= 3
        ]

        text = " ".join(texts)
        text = "".join(ch for ch in text if ch.isalnum() or ch == " ").strip().upper()
        text = fix_plate_format(text)

        return text if len(text) >= 3 else ""
    except Exception:
        return ""
