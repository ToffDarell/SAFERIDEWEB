import csv
import io
from datetime import datetime, timedelta

from django.db.models import Count, Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
import django_filters
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import landscape, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer,
    HRFlowable, KeepTogether,
)
from reportlab.graphics.shapes import Drawing, Rect, String
from reportlab.graphics import renderPDF

from .models import Violation
from .serializers import (
    ViolationSerializer,
    ViolationSummarySerializer,
    ViolationWeeklyChartSerializer,
)
from users.models import AdminNotification
from users.permissions import IsAdmin, IsYoloService


class ViolationFilter(django_filters.FilterSet):
    detected_at__gte = django_filters.IsoDateTimeFilter(field_name='detected_at', lookup_expr='gte')
    detected_at__lte = django_filters.IsoDateTimeFilter(field_name='detected_at', lookup_expr='lte')
    
    year = django_filters.NumberFilter(field_name='detected_at', lookup_expr='year')

    class Meta:
        model = Violation
        fields = ['detection_status', 'classification', 'camera', 'review_status', 'year']


class ViolationViewSet(viewsets.ModelViewSet):
    queryset = Violation.objects.select_related('reviewed_by__profile').all().order_by('-detected_at')
    serializer_class = ViolationSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_class = ViolationFilter
    ordering_fields = ['detected_at', 'confidence_score']
    ordering = ['-detected_at']

    def get_queryset(self):
        qs = super().get_queryset()
        date_filter = self.request.query_params.get('date')
        location = self.request.query_params.get('location')
        search = self.request.query_params.get('search')
        status = self.request.query_params.get('status')

        if status and not self.request.query_params.get('detection_status'):
            qs = qs.filter(detection_status=status)

        if date_filter in ['today', 'week', 'month']:
            from django.utils import timezone
            from datetime import timedelta
            now = timezone.localdate()
            if date_filter == 'today':
                qs = qs.filter(detected_at__date=now)
            elif date_filter == 'week':
                qs = qs.filter(detected_at__date__gte=now - timedelta(days=6))
            elif date_filter == 'month':
                qs = qs.filter(detected_at__date__gte=now.replace(day=1))

        if location:
            qs = qs.filter(
                Q(camera__name__icontains=location) |
                Q(camera__location__icontains=location)
            )

        if search:
            qs = qs.filter(
                Q(plate_number__icontains=search) |
                Q(camera__name__icontains=search) |
                Q(camera__location__icontains=search)
            )

        return qs

    def get_permissions(self):
        if self.action == 'create':
            return [IsYoloService()]
        return [IsAuthenticated()]

    def perform_update(self, serializer):
        instance = self.get_object()
        previous_status = instance.review_status
        new_status = serializer.validated_data.get('review_status')

        if new_status and new_status != instance.review_status and new_status in ('reviewed', 'resolved'):
            updated_violation = serializer.save(reviewed_by=self.request.user, reviewed_at=timezone.now())
        elif new_status == 'pending':
            updated_violation = serializer.save(reviewed_by=None, reviewed_at=None)
        else:
            updated_violation = serializer.save()

        if new_status and new_status != previous_status:
            AdminNotification.create_for_violation_action(
                actor=self.request.user,
                violation=updated_violation,
                previous_status=instance.get_review_status_display(),
                new_status=updated_violation.get_review_status_display(),
            )


class ViolationSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.localdate()
        week_start = today - timedelta(days=6)
        queryset = Violation.objects.select_related("camera")

        # Apply filters
        date = request.query_params.get('date')
        location = request.query_params.get('location')
        status = request.query_params.get('status')
        review_status = request.query_params.get('review_status')
        year = request.query_params.get('year')

        if date:
            if date == 'today':
                queryset = queryset.filter(detected_at__date=today)
            elif date == 'week':
                queryset = queryset.filter(detected_at__date__gte=week_start)
            elif date == 'month':
                month_start = today.replace(day=1)
                queryset = queryset.filter(detected_at__date__gte=month_start)
            else:
                queryset = queryset.filter(detected_at__date=date)
        if location:
            if location.isdigit():
                queryset = queryset.filter(camera_id=location)
            else:
                queryset = queryset.filter(camera__name__icontains=location)
        if status:
            queryset = queryset.filter(detection_status=status)
        if review_status:
            queryset = queryset.filter(review_status=review_status)
        if year:
            queryset = queryset.filter(detected_at__year=year)

        class_counts = {
            row["classification"]: row["count"]
            for row in queryset.values("classification").annotate(count=Count("id"))
        }
        camera_counts = queryset.values("camera__name").annotate(count=Count("id")).order_by("-count", "camera__name")

        summary = {
            "total_violations": queryset.count(),
            "pending_violations": queryset.filter(review_status="pending").count(),
            "today_violations": queryset.filter(detected_at__date=today).count(),
            "this_week_violations": queryset.filter(detected_at__date__range=(week_start, today)).count(),
            "by_class": [
                {
                    "classification": code,
                    "label": label,
                    "count": class_counts.get(code, 0),
                }
                for code, label in Violation.CLASSIFICATION_CHOICES
            ],
            "by_camera": [
                {
                    "camera_name": row["camera__name"] or "Unknown",
                    "count": row["count"],
                }
                for row in camera_counts
            ],
        }

        serializer = ViolationSummarySerializer(summary)
        return Response(serializer.data)


class ViolationWeeklyChartView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.localdate()
        start_date = today - timedelta(days=6)

        queryset = Violation.objects.filter(detected_at__date__range=(start_date, today))

        # Apply filters
        location = request.query_params.get('location')
        status = request.query_params.get('status')
        review_status = request.query_params.get('review_status')

        if location:
            if location.isdigit():
                queryset = queryset.filter(camera_id=location)
            else:
                queryset = queryset.filter(camera__name__icontains=location)
        if status:
            queryset = queryset.filter(detection_status=status)
        if review_status:
            queryset = queryset.filter(review_status=review_status)

        counts_by_day = {
            row["detected_at__date"]: row["count"]
            for row in (
                queryset
                .values("detected_at__date")
                .annotate(count=Count("id"))
            )
        }

        payload = [
            {
                "date": start_date + timedelta(days=offset),
                "count": counts_by_day.get(start_date + timedelta(days=offset), 0),
            }
            for offset in range(7)
        ]

        serializer = ViolationWeeklyChartSerializer(payload, many=True)
        return Response(serializer.data)


class ViolationExportView(APIView):
    permission_classes = [IsAdmin]

    def _get_qs(self, request):
        qs = Violation.objects.all().order_by('-detected_at')
        
        # Apply filters
        date = request.query_params.get('date')
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        year = request.query_params.get('year')
        status = request.query_params.get('detection_status') or request.query_params.get('status')
        review_status = request.query_params.get('review_status')
        camera = request.query_params.get('camera') or request.query_params.get('location')
        
        if date:
            from django.utils import timezone
            from datetime import timedelta
            now = timezone.localdate()
            if date == 'today':
                qs = qs.filter(detected_at__date=now)
            elif date == 'week':
                qs = qs.filter(detected_at__date__gte=now - timedelta(days=6))
            elif date == 'month':
                qs = qs.filter(detected_at__date__gte=now.replace(day=1))
            else:
                qs = qs.filter(detected_at__date=date)
        if year:
            qs = qs.filter(detected_at__year=year)
        if status:
            qs = qs.filter(detection_status=status)
        if review_status:
            qs = qs.filter(review_status=review_status)
        if camera:
            if camera.isdigit():
                qs = qs.filter(camera_id=camera)
            else:
                qs = qs.filter(camera__name__icontains=camera)

        if date_from:
            try:
                qs = qs.filter(detected_at__date__gte=datetime.strptime(date_from, '%Y-%m-%d').date())
            except ValueError:
                pass
        if date_to:
            try:
                qs = qs.filter(detected_at__date__lte=datetime.strptime(date_to, '%Y-%m-%d').date())
            except ValueError:
                pass
        return qs

    def get(self, request):
        fmt = request.query_params.get('export_format', 'csv').lower()
        qs = self._get_qs(request)

        if fmt == 'pdf':
            return self._pdf(qs)
        return self._csv(qs)

    def _csv(self, qs):
        now = datetime.now()
        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = (
            f'attachment; filename="saferide_violations_'
            f'{now.strftime("%Y%m%d_%H%M%S")}.csv"'
        )

        # BOM for Excel UTF-8 recognition
        response.write('\ufeff')
        w = csv.writer(response)

        # ── report header rows ───────────────────────────────────
        w.writerow(['SafeRide — Violation Report'])
        w.writerow([f'Generated: {now.strftime("%B %d, %Y %I:%M %p")}'])
        w.writerow([f'Total Records: {qs.count()}'])
        w.writerow([])  # blank separator

        # ── summary stats ────────────────────────────────────────
        violations_count = qs.filter(detection_status='violation').count()
        reviewed_count = qs.filter(review_status='reviewed').count()
        resolved_count = qs.filter(review_status='resolved').count()
        pending_count = (
            qs.filter(review_status='pending').count()
            + qs.filter(review_status__isnull=True).count()
        )

        w.writerow(['Summary'])
        w.writerow(['Violations', 'Reviewed', 'Resolved', 'Pending'])
        w.writerow([violations_count, reviewed_count, resolved_count, pending_count])
        w.writerow([])  # blank separator

        # ── column headers ───────────────────────────────────────
        w.writerow([
            '#', 'ID', 'Date', 'Time', 'Camera', 'Classification',
            'Plate Number', 'Detection Status', 'Confidence (%)',
            'Review Status',
        ])

        # ── data rows ───────────────────────────────────────────
        for idx, v in enumerate(qs, 1):
            w.writerow([
                idx,
                v.id,
                v.detected_at.strftime('%Y-%m-%d'),
                v.detected_at.strftime('%H:%M:%S'),
                v.camera.name if v.camera else 'Unknown',
                v.get_classification_display(),
                v.plate_number or 'N/A',
                v.get_detection_status_display(),
                f'{v.confidence_score * 100:.1f}%',
                v.get_review_status_display(),
            ])

        # ── footer ───────────────────────────────────────────────
        w.writerow([])
        w.writerow([f'End of Report — {qs.count()} records exported'])

        return response

    def _pdf(self, qs):
        buffer = io.BytesIO()
        page_w, page_h = landscape(A4)
        doc = SimpleDocTemplate(
            buffer, pagesize=landscape(A4),
            rightMargin=0.5 * inch, leftMargin=0.5 * inch,
            topMargin=0.5 * inch, bottomMargin=0.7 * inch,
        )

        # ── colours ──────────────────────────────────────────────
        BRAND      = colors.HexColor('#1e293b')   # slate-800
        ACCENT     = colors.HexColor('#3b82f6')   # blue-500
        LIGHT_BG   = colors.HexColor('#f8fafc')   # slate-50
        BORDER     = colors.HexColor('#e2e8f0')   # slate-200
        TEXT_DARK  = colors.HexColor('#1e293b')
        TEXT_MUTED = colors.HexColor('#64748b')   # slate-500
        SUCCESS    = colors.HexColor('#16a34a')
        WARNING    = colors.HexColor('#f59e0b')
        DANGER     = colors.HexColor('#ef4444')

        # ── styles ───────────────────────────────────────────────
        styles = getSampleStyleSheet()
        s_title = ParagraphStyle(
            'RTitle', parent=styles['Title'],
            fontName='Helvetica-Bold', fontSize=20,
            textColor=BRAND, spaceAfter=2,
        )
        s_subtitle = ParagraphStyle(
            'RSub', parent=styles['Normal'],
            fontName='Helvetica', fontSize=9,
            textColor=TEXT_MUTED, spaceAfter=6,
        )
        s_section = ParagraphStyle(
            'RSection', parent=styles['Normal'],
            fontName='Helvetica-Bold', fontSize=11,
            textColor=BRAND, spaceBefore=14, spaceAfter=6,
        )
        s_cell = ParagraphStyle(
            'RCell', parent=styles['Normal'],
            fontName='Helvetica', fontSize=7.5,
            textColor=TEXT_DARK, leading=10,
        )
        s_cell_center = ParagraphStyle(
            'RCellC', parent=s_cell, alignment=TA_CENTER,
        )
        s_header_cell = ParagraphStyle(
            'RHCell', parent=styles['Normal'],
            fontName='Helvetica-Bold', fontSize=7.5,
            textColor=colors.white, alignment=TA_CENTER, leading=10,
        )

        elements = []

        # ── page footer (page number) ───────────────────────────
        def _footer(canvas, doc):
            canvas.saveState()
            canvas.setFont('Helvetica', 7)
            canvas.setFillColor(TEXT_MUTED)
            canvas.drawRightString(
                page_w - 0.5 * inch, 0.35 * inch,
                f'Page {doc.page}',
            )
            canvas.drawString(
                0.5 * inch, 0.35 * inch,
                'SafeRide Violation Management System — Confidential',
            )
            # thin line above footer
            canvas.setStrokeColor(BORDER)
            canvas.setLineWidth(0.5)
            canvas.line(0.5 * inch, 0.5 * inch, page_w - 0.5 * inch, 0.5 * inch)
            canvas.restoreState()

        # ── header section ───────────────────────────────────────
        now = datetime.now()
        total = qs.count()

        elements.append(Paragraph('SafeRide', s_title))
        elements.append(Paragraph('Violation Report', ParagraphStyle(
            'RSubtitle2', parent=styles['Normal'],
            fontName='Helvetica', fontSize=13,
            textColor=ACCENT, spaceAfter=4,
        )))
        elements.append(HRFlowable(
            width='100%', thickness=1.5, color=ACCENT,
            spaceAfter=10, spaceBefore=2,
        ))

        # meta row
        meta_text = (
            f'<font color="#64748b">'
            f'<b>Generated:</b> {now.strftime("%B %d, %Y  %I:%M %p")} &nbsp;&nbsp;|&nbsp;&nbsp; '
            f'<b>Total Records:</b> {total}'
            f'</font>'
        )
        elements.append(Paragraph(meta_text, s_subtitle))
        elements.append(Spacer(1, 6))

        # ── summary cards ────────────────────────────────────────
        violations_count = qs.filter(detection_status='violation').count()
        reviewed_count = qs.filter(review_status='reviewed').count()
        resolved_count = qs.filter(review_status='resolved').count()
        pending_count = qs.filter(review_status='pending').count() + qs.filter(review_status__isnull=True).count()

        card_data = [
            [
                Paragraph(f'<font size="14"><b>{violations_count}</b></font><br/>'
                          f'<font size="7" color="#64748b">Violations</font>', s_cell_center),
                Paragraph(f'<font size="14"><b>{reviewed_count}</b></font><br/>'
                          f'<font size="7" color="#64748b">Reviewed</font>', s_cell_center),
                Paragraph(f'<font size="14"><b>{resolved_count}</b></font><br/>'
                          f'<font size="7" color="#64748b">Resolved</font>', s_cell_center),
                Paragraph(f'<font size="14"><b>{pending_count}</b></font><br/>'
                          f'<font size="7" color="#64748b">Pending</font>', s_cell_center),
            ]
        ]
        card_w = (page_w - 1.0 * inch) / 4
        card_table = Table(card_data, colWidths=[card_w] * 4, rowHeights=[48])
        card_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, 0), colors.HexColor('#fef2f2')),   # red-50
            ('BACKGROUND', (1, 0), (1, 0), colors.HexColor('#eff6ff')),   # blue-50
            ('BACKGROUND', (2, 0), (2, 0), colors.HexColor('#f0fdf4')),   # green-50
            ('BACKGROUND', (3, 0), (3, 0), colors.HexColor('#fffbeb')),   # amber-50
            ('BOX', (0, 0), (0, 0), 0.75, colors.HexColor('#fecaca')),
            ('BOX', (1, 0), (1, 0), 0.75, colors.HexColor('#bfdbfe')),
            ('BOX', (2, 0), (2, 0), 0.75, colors.HexColor('#bbf7d0')),
            ('BOX', (3, 0), (3, 0), 0.75, colors.HexColor('#fde68a')),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('ROUNDEDCORNERS', [6, 6, 6, 6]),
        ]))
        elements.append(card_table)
        elements.append(Spacer(1, 14))

        # ── section label ────────────────────────────────────────
        elements.append(Paragraph('Violation Details', s_section))

        # ── data table ───────────────────────────────────────────
        headers = ['#', 'ID', 'Date', 'Time', 'Camera', 'Classification',
                   'Plate', 'Status', 'Confidence', 'Review']
        header_row = [Paragraph(h, s_header_cell) for h in headers]
        data = [header_row]

        def _status_color(status):
            s = (status or '').lower()
            if s == 'resolved':
                return f'<font color="#16a34a"><b>{status}</b></font>'
            elif s == 'reviewed':
                return f'<font color="#3b82f6"><b>{status}</b></font>'
            return f'<font color="#f59e0b"><b>{status}</b></font>'

        def _conf_color(score):
            pct = score * 100
            label = f'{pct:.1f}%'
            if pct >= 75:
                return f'<font color="#16a34a"><b>{label}</b></font>'
            elif pct >= 50:
                return f'<font color="#f59e0b"><b>{label}</b></font>'
            return f'<font color="#ef4444"><b>{label}</b></font>'

        for idx, v in enumerate(qs, 1):
            review_display = v.get_review_status_display()
            data.append([
                Paragraph(str(idx), s_cell_center),
                Paragraph(str(v.id), s_cell_center),
                Paragraph(v.detected_at.strftime('%Y-%m-%d'), s_cell_center),
                Paragraph(v.detected_at.strftime('%H:%M:%S'), s_cell_center),
                Paragraph(v.camera.name if v.camera else 'Unknown', s_cell_center),
                Paragraph(v.get_classification_display(), s_cell_center),
                Paragraph(v.plate_number or 'N/A', s_cell_center),
                Paragraph(v.get_detection_status_display(), s_cell_center),
                Paragraph(_conf_color(v.confidence_score), s_cell_center),
                Paragraph(_status_color(review_display), s_cell_center),
            ])

        col_widths = [28, 36, 68, 56, 72, 90, 72, 64, 60, 60]
        table = Table(data, colWidths=col_widths, repeatRows=1)

        style_cmds = [
            # header
            ('BACKGROUND', (0, 0), (-1, 0), BRAND),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('TOPPADDING', (0, 0), (-1, 0), 7),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 7),
            # body
            ('TOPPADDING', (0, 1), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 5),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            # grid
            ('LINEBELOW', (0, 0), (-1, 0), 1.5, ACCENT),
            ('LINEBELOW', (0, 1), (-1, -2), 0.5, BORDER),
            ('LINEBELOW', (0, -1), (-1, -1), 1, BRAND),
            ('LINEBEFORE', (0, 0), (0, -1), 0.5, BORDER),
            ('LINEAFTER', (-1, 0), (-1, -1), 0.5, BORDER),
        ]

        # alternating row colours
        for i in range(1, len(data)):
            if i % 2 == 0:
                style_cmds.append(('BACKGROUND', (0, i), (-1, i), LIGHT_BG))

        table.setStyle(TableStyle(style_cmds))
        elements.append(table)

        # ── build ────────────────────────────────────────────────
        doc.build(elements, onFirstPage=_footer, onLaterPages=_footer)

        buffer.seek(0)
        response = HttpResponse(buffer, content_type='application/pdf')
        response['Content-Disposition'] = (
            f'attachment; filename="saferide_violations_'
            f'{now.strftime("%Y%m%d_%H%M%S")}.pdf"'
        )
        return response
