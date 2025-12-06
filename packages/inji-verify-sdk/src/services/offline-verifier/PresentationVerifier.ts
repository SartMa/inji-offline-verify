import * as vc from '@digitalbazaar/vc';

import { CredentialVerifierConstants } from './constants/CredentialVerifierConstants.js';
import { PresentationVerificationResult, VPVerificationStatus } from './data/data.js';
import { UnknownException } from './exception/index.js';
import { PublicKeyService } from './publicKey/PublicKeyService.js';
import { createSdkLogger } from '../../utils/logger.js';
import { DefaultProofVisitor, Ed25519VerificationVisitor, ProofVisitor, VerificationVisitor } from './visitors/index.js';

interface PresentationVerifyOptions {
	challenge?: string;
	domain?: string;
	unsignedPresentation?: boolean;
}

export class PresentationVerifier {
	private readonly logger = createSdkLogger('PresentationVerifier');
	private readonly publicKeyService = new PublicKeyService();
	private readonly proofVisitor: ProofVisitor;
	private readonly verificationVisitor: VerificationVisitor;

	constructor(
		proofVisitor?: ProofVisitor,
		verificationVisitor?: VerificationVisitor
	) {
		this.proofVisitor = proofVisitor ?? new DefaultProofVisitor(this.publicKeyService, this.logger);
		this.verificationVisitor = verificationVisitor ?? new Ed25519VerificationVisitor();
	}

	async verify(
		presentationInput: string | Record<string, any>,
		options: PresentationVerifyOptions = {}
	): Promise<PresentationVerificationResult> {
		try {
			const presentation = this.normalizePresentationInput(presentationInput);
			const proof = this.extractProof(presentation);

			if (proof.type !== CredentialVerifierConstants.ED25519_PROOF_TYPE_2020) {
				this.logger.debug?.(`❌ Unsupported presentation proof type: ${proof.type}`);
				return new PresentationVerificationResult(VPVerificationStatus.INVALID, []);
			}

			const expectedChallenge = this.resolveChallenge(presentation, proof, options);

			const proofResult = await this.proofVisitor.visitEd25519Proof(
				proof,
				presentation,
				{ ...options, challenge: expectedChallenge }
			);

			if (!proofResult) {
				return new PresentationVerificationResult(VPVerificationStatus.INVALID, []);
			}

			const vcLib = vc as any;
			const verification = await vcLib.verify(proofResult.verificationOptions);

			const proofStatus = this.verificationVisitor.visitPresentationStatus(verification);
			const vcResults = this.verificationVisitor.visitCredentialResults(verification, presentation);

			return new PresentationVerificationResult(proofStatus, vcResults);
		} catch (error: any) {
			const message = error?.message ?? String(error);
			if (message === CredentialVerifierConstants.ERROR_CODE_OFFLINE_DEPENDENCIES_MISSING) {
				throw error;
			}
			this.logger.debug?.('💥 An unexpected error occurred during presentation verification:', message);
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
}
