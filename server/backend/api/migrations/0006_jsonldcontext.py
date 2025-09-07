from django.db import migrations, models
import uuid


def seed_default_contexts(apps, schema_editor):
    JsonLdContext = apps.get_model('api', 'JsonLdContext')
    defaults = {
        'https://www.w3.org/2018/credentials/v1': {
            '@context': {
                '@version': 1.1,
                '@protected': True,
                'VerifiableCredential': {
                    '@id': 'https://www.w3.org/2018/credentials#VerifiableCredential',
                    '@context': {
                        '@version': 1.1,
                        '@protected': True,
                        'id': '@id',
                        'type': '@type',
                        'credentialSubject': {
                            '@id': 'https://www.w3.org/2018/credentials#credentialSubject',
                            '@type': '@id'
                        },
                        'issuer': {
                            '@id': 'https://www.w3.org/2018/credentials#issuer',
                            '@type': '@id'
                        },
                        'issuanceDate': {
                            '@id': 'https://www.w3.org/2018/credentials#issuanceDate',
                            '@type': 'http://www.w3.org/2001/XMLSchema#dateTime'
                        },
                        'expirationDate': {
                            '@id': 'https://www.w3.org/2018/credentials#expirationDate',
                            '@type': 'http://www.w3.org/2001/XMLSchema#dateTime'
                        }
                    }
                },
                'credentialSubject': 'https://www.w3.org/2018/credentials#credentialSubject',
                'issuer': 'https://www.w3.org/2018/credentials#issuer',
                'issuanceDate': 'https://www.w3.org/2018/credentials#issuanceDate',
                'expirationDate': 'https://www.w3.org/2018/credentials#expirationDate',
                'credentialStatus': 'https://www.w3.org/2018/credentials#credentialStatus'
            }
        },
        'https://w3id.org/security/v1': {
            '@context': {
                '@version': 1.1,
                '@protected': True,
                'proof': {
                    '@id': 'https://w3id.org/security#proof',
                    '@type': '@id',
                    '@container': '@graph'
                },
                'Ed25519Signature2020': 'https://w3id.org/security#Ed25519Signature2020',
                'Ed25519VerificationKey2020': 'https://w3id.org/security#Ed25519VerificationKey2020',
                'verificationMethod': {
                    '@id': 'https://w3id.org/security#verificationMethod',
                    '@type': '@id'
                },
                'proofPurpose': {
                    '@id': 'https://w3id.org/security#proofPurpose',
                    '@type': '@vocab'
                },
                'proofValue': {
                    '@id': 'https://w3id.org/security#proofValue',
                    '@type': 'https://w3id.org/security#multibase'
                },
                'jws': 'https://w3id.org/security#jws',
                'created': {
                    '@id': 'http://purl.org/dc/terms/created',
                    '@type': 'http://www.w3.org/2001/XMLSchema#dateTime'
                }
            }
        },
        'https://w3id.org/security/v2': {
            '@context': {
                '@version': 1.1,
                '@protected': True,
                'proof': {
                    '@id': 'https://w3id.org/security#proof',
                    '@type': '@id',
                    '@container': '@graph'
                },
                'Ed25519Signature2020': 'https://w3id.org/security#Ed25519Signature2020',
                'Ed25519VerificationKey2020': 'https://w3id.org/security#Ed25519VerificationKey2020',
                'verificationMethod': {
                    '@id': 'https://w3id.org/security#verificationMethod',
                    '@type': '@id'
                },
                'proofPurpose': {
                    '@id': 'https://w3id.org/security#proofPurpose',
                    '@type': '@vocab'
                },
                'proofValue': {
                    '@id': 'https://w3id.org/security#proofValue',
                    '@type': 'https://w3id.org/security#multibase'
                },
                'jws': 'https://w3id.org/security#jws',
                'created': {
                    '@id': 'http://purl.org/dc/terms/created',
                    '@type': 'http://www.w3.org/2001/XMLSchema#dateTime'
                }
            }
        },
    }
    for url, doc in defaults.items():
        JsonLdContext.objects.update_or_create(url=url, defaults={'document': doc})


def unseed_default_contexts(apps, schema_editor):
    JsonLdContext = apps.get_model('api', 'JsonLdContext')
    JsonLdContext.objects.filter(url__in=[
        'https://www.w3.org/2018/credentials/v1',
        'https://w3id.org/security/v1',
        'https://w3id.org/security/v2',
    ]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0005_organizationdid_publickey'),
    ]

    operations = [
        migrations.CreateModel(
            name='JsonLdContext',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('url', models.URLField(max_length=500, unique=True)),
                ('document', models.JSONField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'JSON-LD Context',
                'verbose_name_plural': 'JSON-LD Contexts',
            },
        ),
        migrations.AddIndex(
            model_name='jsonldcontext',
            index=models.Index(fields=['url'], name='idx_ctx_url'),
        ),
        migrations.RunPython(seed_default_contexts, reverse_code=unseed_default_contexts),
    ]
