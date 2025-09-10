from django.db import migrations, models
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Organization',
            fields=[
                ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ('name', models.CharField(max_length=255, unique=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={'ordering': ['name']},
        ),
        migrations.CreateModel(
            name='OrganizationMember',
            fields=[
                ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ('role', models.CharField(max_length=10, choices=[('ADMIN','Admin'),('USER','User')], default='ADMIN')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('organization', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='members', to='api.organization')),
                ('user', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='memberships', to='auth.user')),
            ],
            options={'verbose_name': 'Organization Member', 'verbose_name_plural': 'Organization Members', 'unique_together': {('user', 'organization')}},
        ),
        migrations.AddField(
            model_name='verificationlog',
            name='organization',
            field=models.ForeignKey(blank=True, null=True, on_delete=models.deletion.CASCADE, related_name='verification_logs', to='api.organization'),
        ),
    ]
