from django.shortcuts import render

# Create your views here.
# dashboard_app/views.py

from django.shortcuts import render

def dashboard_view(request):
    # Hàm này chỉ đơn giản là render file index.html của bạn
    return render(request, 'dashboard_app/index.html')