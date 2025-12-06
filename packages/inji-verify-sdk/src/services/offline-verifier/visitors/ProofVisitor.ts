import { Ed25519VerificationKey2020 } from '@digitalbazaar/ed25519-verification-key-2020';
import { Ed25519Signature2020 } from '@digitalbazaar/ed25519-signature-2020';
import { CredentialVerifierConstants } from '../constants/CredentialVerifierConstants.js';
import { VPVerificationStatus } from '../data/data.js';
import { PublicKeyService } from '../publicKey/PublicKeyService.js';
import { buildEd25519VerificationDocuments } from '../signature/ed25519Presentation.js';
import { OfflineDocumentLoader } from '../utils/OfflineDocumentLoader.js';
import { SdkLogger } from '../../../utils/logger.js';
export interface ProofVisitor {
	visitEd25519Proof(
		proof: Record<string, any>,
		presentation: Record<string, any>,
		options: any
	): Promise<{ suite: any; documentLoader: any; verificationOptions: any } | null>;
}

export class DefaultProofVisitor implements ProofVisitor {
	constructor(
		private readonly publicKeyService: PublicKeyService,
		private readonly logger: SdkLogger
	) {}

	async visitEd25519Proof(
		proof: Record<string, any>,
		presentation: Record<string, any>,
		options: any
	): Promise<{ suite: any; documentLoader: any; verificationOptions: any } | null> {
		const verificationMethodUrl = proof.verificationMethod;
		if (typeof verificationMethodUrl !== 'string' || verificationMethodUrl.length === 0) {
			this.logger.debug?.('❌ Presentation proof is missing a verificationMethod');
			return null;
		}

		const publicKeyData = await this.publicKeyService.getPublicKey(verificationMethodUrl);
		if (!publicKeyData) {
			this.logger.debug?.(`❌ Unable to resolve public key for presentation VM: ${verificationMethodUrl}`);
			if (typeof navigator !== 'undefined' && !navigator.onLine) {
				throw new Error(CredentialVerifierConstants.ERROR_CODE_OFFLINE_DEPENDENCIES_MISSING);
			}
			return null;
		}

		const docs = buildEd25519VerificationDocuments(publicKeyData, verificationMethodUrl, this.logger);
		if (!docs) {
			return null;
		}

		const keyPair = await Ed25519VerificationKey2020.from({
			id: docs.verificationMethodDoc.id,
			controller: docs.verificationMethodDoc.controller,
			publicKeyMultibase: docs.verificationMethodDoc.publicKeyMultibase
		});

		const suite = new Ed25519Signature2020({
			key: keyPair,
			verificationMethod: docs.verificationMethodDoc.id
		});

		const baseLoader = OfflineDocumentLoader.getDocumentLoader();
		const controllerId = docs.controllerDoc.id;
		const documentLoader = async (url: string) => {
			if (url === verificationMethodUrl) {
				return {
					contextUrl: null,
					documentUrl: url,
					document: docs.verificationMethodDoc
				};
			}
			if (controllerId && url === controllerId) {
				return {
					contextUrl: null,
					documentUrl: url,
					document: docs.controllerDoc
				};
			}
			return baseLoader(url);
		};

		const verificationOptions: any = {
			presentation,
			suite,
			documentLoader,
			unsignedPresentation: options.unsignedPresentation ?? false
		};

		if (typeof options.challenge !== 'undefined') {
			verificationOptions.challenge = options.challenge;
		}
		if (options.domain) {
			verificationOptions.domain = options.domain;
		}

		return { suite, documentLoader, verificationOptions };
	}
}
