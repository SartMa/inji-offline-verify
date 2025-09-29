import * as vc from '@digitalbazaar/vc';
import { Ed25519VerificationKey2020 } from '@digitalbazaar/ed25519-verification-key-2020';
import { Ed25519Signature2020 } from '@digitalbazaar/ed25519-signature-2020';

import { CredentialVerifierConstants } from './constants/CredentialVerifierConstants.js';
import { PresentationVerificationResult, VCResult, VerificationStatus, VPVerificationStatus } from './data/data.js';
import { UnknownException } from './exception/index.js';
import { OfflineDocumentLoader } from './utils/OfflineDocumentLoader.js';
import { PublicKeyService } from './publicKey/PublicKeyService.js';
import { buildEd25519VerificationDocuments } from './signature/ed25519Presentation.js';

interface PresentationVerifyOptions {
	challenge?: string;
	domain?: string;
	unsignedPresentation?: boolean;
}

export class PresentationVerifier {
	private readonly logger = console;
	private readonly publicKeyService = new PublicKeyService();

	async verify(
		presentationInput: string | Record<string, any>,
		options: PresentationVerifyOptions = {}
	): Promise<PresentationVerificationResult> {
		try {
			const presentation = this.normalizePresentationInput(presentationInput);
			const proof = this.extractProof(presentation);

			if (proof.type !== CredentialVerifierConstants.ED25519_PROOF_TYPE_2020) {
				this.logger.error(`❌ Unsupported presentation proof type: ${proof.type}`);
				return new PresentationVerificationResult(VPVerificationStatus.INVALID, []);
			}

			const verificationMethodUrl = proof.verificationMethod;
			if (typeof verificationMethodUrl !== 'string' || verificationMethodUrl.length === 0) {
				this.logger.error('❌ Presentation proof is missing a verificationMethod');
				return new PresentationVerificationResult(VPVerificationStatus.INVALID, []);
			}

			const expectedChallenge = this.resolveChallenge(presentation, proof, options);

			const publicKeyData = await this.publicKeyService.getPublicKey(verificationMethodUrl);
			if (!publicKeyData) {
				this.logger.error(`❌ Unable to resolve public key for presentation VM: ${verificationMethodUrl}`);
				if (typeof navigator !== 'undefined' && !navigator.onLine) {
					throw new Error(CredentialVerifierConstants.ERROR_CODE_OFFLINE_DEPENDENCIES_MISSING);
				}
				return new PresentationVerificationResult(VPVerificationStatus.INVALID, []);
			}

			const docs = buildEd25519VerificationDocuments(publicKeyData, verificationMethodUrl, this.logger);
			if (!docs) {
				return new PresentationVerificationResult(VPVerificationStatus.INVALID, []);
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

			if (typeof expectedChallenge !== 'undefined') {
				verificationOptions.challenge = expectedChallenge;
			}
			if (options.domain) {
				verificationOptions.domain = options.domain;
			}

			const vcLib = vc as any;
			const verification = await vcLib.verify(verificationOptions);

			const proofStatus = this.mapPresentationStatus(verification);
			const vcResults = this.mapCredentialResults(verification, presentation);

			return new PresentationVerificationResult(proofStatus, vcResults);
		} catch (error: any) {
			const message = error?.message ?? String(error);
			if (message === CredentialVerifierConstants.ERROR_CODE_OFFLINE_DEPENDENCIES_MISSING) {
				throw error;
			}
			this.logger.error('💥 An unexpected error occurred during presentation verification:', message);
			throw new UnknownException(`Error during presentation verification: ${message}`);
		}
	}

	private normalizePresentationInput(input: string | Record<string, any>): Record<string, any> {
		if (typeof input === 'string') {
			return JSON.parse(input);
		}
		if (input && typeof input === 'object') {
			return input;
		}
		throw new Error('Invalid presentation input');
	}

	private extractProof(presentation: Record<string, any>): Record<string, any> {
		const proof = presentation?.proof;
		if (!proof) {
			throw new Error('Presentation is missing proof');
		}
		return proof;
	}

	private resolveChallenge(
		presentation: Record<string, any>,
		proof: Record<string, any>,
		options: PresentationVerifyOptions
	): string | undefined {
		if (options.unsignedPresentation) {
			return undefined;
		}

		if (options.challenge) {
			return options.challenge;
		}

		const embeddedChallenge = proof?.challenge ?? presentation?.challenge;
		if (embeddedChallenge) {
			return embeddedChallenge;
		}

		throw new Error('A challenge must be supplied or embedded in the presentation proof.');
	}

	private mapPresentationStatus(verification: any): VPVerificationStatus {
		if (verification?.verified) {
			return VPVerificationStatus.VALID;
		}

		const messages = this.collectMessages(verification?.error);
		if (messages.some((m) => m.toLowerCase().includes('expired'))) {
			return VPVerificationStatus.EXPIRED;
		}

		return VPVerificationStatus.INVALID;
	}

	private mapCredentialResults(verification: any, presentation: Record<string, any>): VCResult[] {
		const vcResults: VCResult[] = [];
		const credentialResults = Array.isArray(verification?.credentialResults)
			? verification.credentialResults
			: [];

		const embeddedCredentials = Array.isArray(presentation?.verifiableCredential)
			? presentation.verifiableCredential
			: [];

		if (credentialResults.length > 0) {
			credentialResults.forEach((result: any, index: number) => {
				const vcId = result?.credential?.id
					|| result?.credentialId
					|| this.extractCredentialId(embeddedCredentials[index])
					|| `vc-${index + 1}`;
				const status = result?.verified
					? VerificationStatus.SUCCESS
					: this.deriveCredentialStatusFromErrors(result?.error);
				vcResults.push(new VCResult(vcId, status));
			});
			return vcResults;
		}

		embeddedCredentials.forEach((vc: any, index: number) => {
			const vcId = this.extractCredentialId(vc) || `vc-${index + 1}`;
			const status = verification?.verified ? VerificationStatus.SUCCESS : VerificationStatus.INVALID;
			vcResults.push(new VCResult(vcId, status));
		});

		return vcResults;
	}

	private extractCredentialId(vc: any): string | undefined {
		if (!vc) return undefined;
		if (typeof vc === 'string') {
			try {
				const parsed = JSON.parse(vc);
				return parsed?.id;
			} catch {
				return undefined;
			}
		}
		if (typeof vc === 'object') {
			return vc?.id;
		}
		return undefined;
	}

	private deriveCredentialStatusFromErrors(error: any): VerificationStatus {
		const messages = this.collectMessages(error);
		if (messages.some((m) => m.toLowerCase().includes('expired'))) {
			return VerificationStatus.EXPIRED;
		}
		return VerificationStatus.INVALID;
	}

	private collectMessages(error: any): string[] {
		if (!error) return [];
		const messages: string[] = [];
		const walk = (err: any) => {
			if (!err) return;
			if (typeof err.message === 'string') {
				messages.push(err.message);
			}
			if (Array.isArray(err.errors)) {
				err.errors.forEach(walk);
			}
			if (Array.isArray(err.details)) {
				err.details.forEach(walk);
			}
		};
		walk(error);
		return messages;
	}
}
