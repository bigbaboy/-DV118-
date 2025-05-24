# dashboard_app/urls.py

from django.urls import path
from . import views # Import view bạn vừa tạo

urlpatterns = [
    # Khi người dùng truy cập gốc của ứng dụng (ví dụ: yoursite.com/),
    # nó sẽ gọi dashboard_view
    path('', views.dashboard_view, name='dashboard'),
]