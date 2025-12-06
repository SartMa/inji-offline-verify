import { VCResult, VerificationStatus, VPVerificationStatus } from '../data/data.js';

export interface VerificationVisitor {
	visitPresentationStatus(verification: any): VPVerificationStatus;
	visitCredentialResults(verification: any, presentation: Record<string, any>): VCResult[];
}

export class Ed25519VerificationVisitor implements VerificationVisitor {
	visitPresentationStatus(verification: any): VPVerificationStatus {
		if (verification?.verified) {
			return VPVerificationStatus.VALID;
		}

		const messages = this.collectMessages(verification?.error);
		if (messages.some((m) => m.toLowerCase().includes('expired'))) {
			return VPVerificationStatus.EXPIRED;
		}

		return VPVerificationStatus.INVALID;
	}

	visitCredentialResults(verification: any, presentation: Record<string, any>): VCResult[] {
		const vcResults: VCResult[] = [];
		const credentialResults = Array.isArray(verification?.credentialResults)
			? verification.credentialResults
			: [];

		const embeddedCredentials = Array.isArray(presentation?.verifiableCredential)
			? presentation.verifiableCredential
			: [];

		if (credentialResults.length > 0) {
			credentialResults.forEach((result: any, index: number) => {
				const vcId =
					result?.credential?.id ||
					result?.credentialId ||
					this.extractCredentialId(embeddedCredentials[index]) ||
					`vc-${index + 1}`;
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
