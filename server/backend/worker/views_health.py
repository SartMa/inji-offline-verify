# backend/api/views_health.py
from django.http import JsonResponse

def health(request):
    return JsonResponse({"status": "ok"}, status=200)