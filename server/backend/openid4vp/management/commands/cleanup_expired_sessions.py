"""
Django management command to clean up expired OpenID4VP sessions.
Usage: python manage.py cleanup_expired_sessions
"""
from django.core.management.base import BaseCommand
from openid4vp.services import OpenID4VPSessionService


class Command(BaseCommand):
    help = 'Clean up expired OpenID4VP verification sessions'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be cleaned up without making changes',
        )
    
    def handle(self, *args, **options):
        """Execute the cleanup command."""
        
        if options['dry_run']:
            self.stdout.write(
                self.style.WARNING('DRY RUN MODE - No changes will be made')
            )
        
        # Get count of expired sessions before cleanup
        from openid4vp.models import OpenID4VPSession
        from django.utils import timezone
        
        expired_count = OpenID4VPSession.objects.filter(
            status='pending',
            expires_at__lt=timezone.now()
        ).count()
        
        if expired_count == 0:
            self.stdout.write(
                self.style.SUCCESS('No expired sessions found.')
            )
            return
        
        self.stdout.write(f'Found {expired_count} expired sessions.')
        
        if not options['dry_run']:
            # Perform the actual cleanup
            cleaned_count = OpenID4VPSessionService.cleanup_expired_sessions()
            
            self.stdout.write(
                self.style.SUCCESS(
                    f'Successfully marked {cleaned_count} sessions as expired.'
                )
            )
        else:
            self.stdout.write(
                self.style.WARNING(
                    f'Would mark {expired_count} sessions as expired (dry run).'
                )
            )