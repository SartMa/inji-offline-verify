from django.core.management.base import BaseCommand, CommandError
from api.models import JsonLdContext
import requests


DEFAULT_URLS = [
    'https://www.w3.org/2018/credentials/v1',
    'https://w3id.org/security/v1',
    'https://w3id.org/security/v2',
]


class Command(BaseCommand):
    help = 'Fetch official JSON-LD context documents from source URLs and store/update in DB.'

    def add_arguments(self, parser):
        parser.add_argument('--urls', nargs='*', default=DEFAULT_URLS, help='Context URLs to fetch')
        parser.add_argument('--timeout', type=int, default=15)

    def handle(self, *args, **options):
        urls = options['urls']
        timeout = options['timeout']
        updated = 0
        for url in urls:
            self.stdout.write(f'Fetching {url} ...')
            try:
                r = requests.get(url, timeout=timeout, headers={'Accept': 'application/ld+json, application/json'})
                r.raise_for_status()
                doc = r.json()
                JsonLdContext.objects.update_or_create(url=url, defaults={'document': doc})
                updated += 1
                self.stdout.write(self.style.SUCCESS(f'✔ Stored {url}'))
            except Exception as e:
                self.stderr.write(self.style.ERROR(f'✖ Failed {url}: {e}'))
        self.stdout.write(self.style.SUCCESS(f'Done. Updated {updated}/{len(urls)} contexts.'))
