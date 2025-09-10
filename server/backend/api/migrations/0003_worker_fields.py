from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0002_organization_and_membership'),
    ]

    operations = [
        migrations.AddField(
            model_name='organizationmember',
            name='full_name',
            field=models.CharField(max_length=255, blank=True, null=True),
        ),
        migrations.AddField(
            model_name='organizationmember',
            name='phone_number',
            field=models.CharField(max_length=32, blank=True, null=True),
        ),
        migrations.AddField(
            model_name='organizationmember',
            name='gender',
            field=models.CharField(max_length=1, choices=[('M','Male'),('F','Female'),('O','Other')], blank=True, null=True),
        ),
        migrations.AddField(
            model_name='organizationmember',
            name='dob',
            field=models.DateField(blank=True, null=True),
        ),
    ]
