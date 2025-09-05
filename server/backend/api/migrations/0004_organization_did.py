from django.db import migrations, models


class Migration(migrations.Migration):

	dependencies = [
		('api', '0003_worker_fields'),
	]

	operations = [
		migrations.AddField(
			model_name='organization',
			name='did',
			field=models.CharField(max_length=255, unique=True, null=True, blank=True),
		),
	]
