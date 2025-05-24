# myproject/urls.py

from django.contrib import admin
from django.urls import path, include
from django.conf import settings # IMPORT DÒNG NÀY
from django.conf.urls.static import static # IMPORT DÒNG NÀY

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('dashboard_app.urls')),
]

# THÊM CÁC DÒNG NÀY VÀO CUỐI FILE urls.py CỦA BẠN
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    # HOẶC THƯỜNG DÙNG staticfiles_urlpatterns như sau (phổ biến hơn cho dev server):
    from django.contrib.staticfiles.urls import staticfiles_urlpatterns
    urlpatterns += staticfiles_urlpatterns()