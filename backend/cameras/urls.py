from rest_framework.routers import SimpleRouter
from .views import CameraViewSet

router = SimpleRouter()
router.register(r'', CameraViewSet, basename='camera')

urlpatterns = router.urls