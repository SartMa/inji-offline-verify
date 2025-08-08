from django.shortcuts import render
from rest_framework.response import Response
from rest_framework import status
from rest_framework.views import APIView
from .serializers import VerificationLogSerializer  
from django.db import transaction
# Create your views here.


class SyncVerificationLogsView(APIView):
    """
    View to handle synchronization of verification logs.
    """

    def post(self, request, *args, **kwargs):
        """
        Handle POST requests to create or update verification logs.
        """
        logs_data = request.data
        if not isinstance(logs_data, list):
            return Response(
                {"error": "Request body must be a list of log objects."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = VerificationLogSerializer(data=logs_data, many=True)

        if serializer.is_valid():
            try:
                # Use a database transaction to ensure all logs are saved
                # or none are, maintaining data integrity.
                with transaction.atomic():
                    serializer.save()
                return Response(
                    {"status": "success", "synced_count": len(serializer.data)},
                    status=status.HTTP_201_CREATED
                )
            except Exception as e:
                return Response(
                    {"error": f"An error occurred during database transaction: {str(e)}"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        else:
            # If validation fails, return the errors to the client.
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
