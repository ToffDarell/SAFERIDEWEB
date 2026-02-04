from rest_framework.routers import SimpleRouter
from .views import ViolationViewSet

router = SimpleRouter()
router.register(r'', ViolationViewSet, basename='violation')

urlpatterns = router.urls