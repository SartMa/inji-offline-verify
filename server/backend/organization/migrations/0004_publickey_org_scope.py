from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("organization", "0003_revokedvc"),
    ]

    operations = [
        migrations.AlterField(
            model_name="publickey",
            name="key_id",
            field=models.CharField(max_length=500),
        ),
        migrations.AddConstraint(
            model_name="publickey",
            constraint=models.UniqueConstraint(
                fields=("organization", "key_id"),
                name="uniq_publickey_org_keyid",
            ),
        ),
    ]
