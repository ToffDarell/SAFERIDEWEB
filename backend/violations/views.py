import csv
import io
from datetime import datetime

from django.http import HttpResponse
from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from reportlab.lib import colors
from reportlab.lib.pagesizes import landscape, A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer

from .models import Violation
from .serializers import ViolationSerializer


class ViolationViewSet(viewsets.ModelViewSet):
    queryset = Violation.objects.all().order_by('-detected_at')
    serializer_class = ViolationSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['detection_status', 'classification', 'camera', 'review_status']
    ordering_fields = ['detected_at', 'confidence_score']
    ordering = ['-detected_at']


class ViolationExportView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_qs(self, request):
        qs = Violation.objects.all().order_by('-detected_at')
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')

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
        fmt = request.query_params.get('format', 'csv').lower()
        qs = self._get_qs(request)

        if fmt == 'pdf':
            return self._pdf(qs)
        return self._csv(qs)

    def _csv(self, qs):
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="saferide_violations_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv"'
        w = csv.writer(response)
        w.writerow(['ID', 'Date', 'Time', 'Camera', 'Classification', 'Plate Number', 'Detection Status', 'Confidence (%)', 'Review Status'])
        for v in qs:
            w.writerow([
                v.id,
                v.detected_at.strftime('%Y-%m-%d'),
                v.detected_at.strftime('%H:%M:%S'),
                v.camera.name if v.camera else 'Unknown',
                v.get_classification_display(),
                v.plate_number or 'N/A',
                v.get_detection_status_display(),
                f'{v.confidence_score * 100:.1f}',
                v.get_review_status_display(),
            ])
        return response

    def _pdf(self, qs):
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer, pagesize=landscape(A4),
            rightMargin=0.5 * inch, leftMargin=0.5 * inch,
            topMargin=0.5 * inch, bottomMargin=0.5 * inch
        )
        styles = getSampleStyleSheet()
        elements = [
            Paragraph('SafeRide — Violation Report', styles['Title']),
            Paragraph(f'Generated: {datetime.now().strftime("%B %d, %Y %I:%M %p")} | Total Records: {qs.count()}', styles['Normal']),
        ]

        data = [['ID', 'Date', 'Time', 'Camera', 'Classification', 'Plate', 'Status', 'Conf.%', 'Review']]
        for v in qs:
            data.append([
                str(v.id),
                v.detected_at.strftime('%Y-%m-%d'),
                v.detected_at.strftime('%H:%M:%S'),
                v.camera.name if v.camera else 'Unknown',
                v.get_classification_display(),
                v.plate_number or 'N/A',
                v.get_detection_status_display(),
                f'{v.confidence_score * 100:.1f}%',
                v.get_review_status_display(),
            ])

        table = Table(data, repeatRows=1)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e293b')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ]))
        elements.append(table)
        doc.build(elements)

        buffer.seek(0)
        response = HttpResponse(buffer, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="saferide_violations_{datetime.now().strftime("%Y%m%d_%H%M%S")}.pdf"'
        return response