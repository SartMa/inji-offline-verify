# Generated migration for StatusListCredential

import django.db.models.deletion
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('organization', '0003_revokedvc'),
    ]

    operations = [
        # First, create the new StatusListCredential model
        migrations.CreateModel(
            name='StatusListCredential',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('status_list_id', models.CharField(help_text='StatusList credential identifier (credential.id)', max_length=1000)),
                ('issuer', models.CharField(help_text='Issuer DID', max_length=500)),
                ('status_purpose', models.CharField(default='revocation', help_text='Purpose from credentialSubject.statusPurpose', max_length=50)),
                ('full_credential', models.JSONField(help_text='Complete StatusList credential JSON document')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='status_list_credentials', to='organization.organization')),
            ],
            options={
                'verbose_name': 'StatusList Credential',
                'verbose_name_plural': 'StatusList Credentials',
                'indexes': [
                    models.Index(fields=['organization'], name='idx_statuslist_org'),
                    models.Index(fields=['status_list_id'], name='idx_statuslist_id'),
                    models.Index(fields=['issuer'], name='idx_statuslist_issuer'),
                    models.Index(fields=['status_purpose'], name='idx_statuslist_purpose'),
                ],
                'constraints': [
                    models.UniqueConstraint(fields=('organization', 'status_list_id'), name='uniq_statuslist_org_id'),
                ],
            },
        ),
        
        # Then remove the old RevokedVC model
        migrations.DeleteModel(
            name='RevokedVC',
        ),
    ]