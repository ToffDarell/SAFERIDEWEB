"""
detection.py
Detection utilities:
  - filter_overlapping_boxes()  — removes duplicate detections across classes using IoU
"""


def filter_overlapping_boxes(boxes, iou_threshold=0.5):
    """
    Removes lower-confidence boxes that significantly overlap with a higher-confidence box.
    Sorted by confidence descending — the best detection wins when boxes overlap.
    """
    if not boxes:
        return boxes

    kept = []
    boxes_sorted = sorted(boxes, key=lambda b: float(b.conf[0]), reverse=True)

    for box in boxes_sorted:
        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)
        overlap = False

        for kept_box in kept:
            kx1, ky1, kx2, ky2 = kept_box.xyxy[0].cpu().numpy().astype(int)
            inter_x1 = max(x1, kx1)
            inter_y1 = max(y1, ky1)
            inter_x2 = min(x2, kx2)
            inter_y2 = min(y2, ky2)
            inter_area = max(0, inter_x2 - inter_x1) * max(0, inter_y2 - inter_y1)
            box_area  = (x2 - x1) * (y2 - y1)
            kept_area = (kx2 - kx1) * (ky2 - ky1)
            union_area = box_area + kept_area - inter_area

            if union_area > 0 and inter_area / union_area >= iou_threshold:
                overlap = True
                break

        if not overlap:
            kept.append(box)

    return kept
