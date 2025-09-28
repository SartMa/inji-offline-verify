import { VerificationResult } from '@mosip/react-inji-verify-sdk';

export type VCVisualVariant = 'success' | 'warning' | 'error';

export const VC_VARIANT_COLORS: Record<VCVisualVariant, { accent: string; soft: string }> = {
	success: { accent: '#10b981', soft: '#ecfdf5' },
	warning: { accent: '#f59e0b', soft: '#fef3c7' },
	error: { accent: '#ef4444', soft: '#fee2e2' },
};

export const resolveVCVariant = (result: VerificationResult): VCVisualVariant => {
	if (!result.verificationStatus) {
		return 'error';
	}

	const normalizedErrorCode = result.verificationErrorCode?.toLowerCase() ?? '';
	const normalizedMessage = result.verificationMessage?.toLowerCase() ?? '';
	const isExpired = normalizedErrorCode.includes('expired') || normalizedMessage.includes('expired');

	return isExpired ? 'warning' : 'success';
};
