import React, { useEffect, useState } from 'react';
import {
	Dialog,
	DialogContent,
	DialogTitle,
	Box,
	Typography,
	IconButton,
	Paper,
	Button,
	Badge,
	Avatar,
    Chip,
} from '@mui/material';
import { Close, CloudUpload, CheckCircle, Error as ErrorIcon, Warning } from '@mui/icons-material';
import { QRCodeVerification, VerificationResult, CredentialFormat } from '@mosip/react-inji-verify-sdk';
import './styles/FileUploadModal.css';
import VerificationResultModal from './VerificationResultModal';
import { WorkerCacheService } from '../services/WorkerCacheService';
import { useVCStorage } from '../context/VCStorageContext';
import { v4 as uuidv4 } from 'uuid';

// Helper to create a simple hash of the payload for logging
async function createHash(data: string) {
  const buffer = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

interface FileUploadModalProps {
	open: boolean;
	onClose: () => void;
	onResult: (result: VerificationResult) => void;
}

interface UploadedVC {
  id: string;
  timestamp: number;
  result: VerificationResult;
}

export default function FileUploadModal({ open, onClose, onResult }: FileUploadModalProps) {
	const [cacheReady, setCacheReady] = useState(false);
	const [showResult, setShowResult] = useState(false);
	const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
	const [uploadedVCs, setUploadedVCs] = useState<UploadedVC[]>([]);
	const [selectedVCForView, setSelectedVCForView] = useState<VerificationResult | null>(null);

	const { storeVerificationResult } = useVCStorage();

	// Check cache status when modal opens
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const offlineDepsMissingMessage = "⚠️ Offline dependencies are missing. Please check your connection.";

	useEffect(() => {
		if (!open) return;
		(async () => {
			try {
				const stats = WorkerCacheService.getCacheStats();
				console.log('Cache status (upload modal):', stats);
				setCacheReady(true);
			} catch (e) {
				console.error('Failed to check cache status:', e);
				setCacheReady(false);
			}
		})();
	}, [open]);

	const handleVerificationResult = async (result: VerificationResult) => {
		try {
			// Persist to local DB logs similar to QRScannerModal
			const payload = (result as any).payload || {};
			const vc_hash = payload ? await createHash(JSON.stringify(payload)) : null;

			const verificationData = {
				uuid: uuidv4(),
				verification_status: result.verificationStatus ? 'SUCCESS' : 'FAILED',
				verified_at: new Date().toISOString(),
				vc_hash: vc_hash,
				credential_subject: payload?.credentialSubject || null,
				error_message: result.verificationStatus ? null : result.verificationMessage,
				synced: false,
			};

			await storeVerificationResult(verificationData);
			console.log('✅ Stored upload verification in VCStorageContext', verificationData);
		} catch (e) {
			setErrorMessage(offlineDepsMissingMessage);
			console.error('❌ Failed to store upload verification:', e);
		}

		// Maintain local gallery list
		setUploadedVCs((prev) => [
			...prev,
			{
				id: `vc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
				timestamp: Date.now(),
				result,
			},
		]);

		setVerificationResult(result);
		setShowResult(true);
		onResult(result);
		if (errorMessage) {
			alert(errorMessage); // Display the error message to the user
		}
	};

	// In offline mode, the SDK already turns errors into a VerificationResult via onVerificationResult.
	// Keep onError for logging only to avoid duplicate DB writes.
	const handleError = (error: Error) => {
		console.error('File upload verification error:', error);
	};

	const handleCloseResult = () => {
		setShowResult(false);
		setVerificationResult(null);
		setSelectedVCForView(null);
	};

	const handleClose = () => {
		setVerificationResult(null);
		setShowResult(false);
		setUploadedVCs([]);
		setSelectedVCForView(null);
		onClose();
	};

	const getVCIcon = (result: VerificationResult) => {
		if (!result.verificationStatus) return <ErrorIcon />;
		const isExpired = result.verificationErrorCode === 'VC_EXPIRED' || result.verificationErrorCode === 'EXPIRED';
		return isExpired ? <Warning /> : <CheckCircle />;
	};

	const getVCColor = (result: VerificationResult) => {
		if (!result.verificationStatus) return '#ef4444';
		const isExpired = result.verificationErrorCode === 'VC_EXPIRED' || result.verificationErrorCode === 'EXPIRED';
		return isExpired ? '#f59e0b' : '#10b981';
	};

	// Trigger the SDK file input programmatically (optional helper)
	const openFilePicker = () => {
		const el = document.getElementById('file-upload-modal-input') as HTMLInputElement | null;
		el?.click();
	};

	return (
		<>
			<Dialog
				open={open}
				onClose={handleClose}
				maxWidth="sm"
				fullWidth
				PaperProps={{
					sx: {
						borderRadius: 3,
						minHeight: '500px',
						backgroundColor: 'background.paper',
						backgroundImage: 'none',
					},
				}}
			>
				<DialogTitle sx={{ p: 2, pb: 1 }}>
					<Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
						<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
							<CloudUpload sx={{ color: '#7c3aed' }} />
							<Typography variant="h6" component="span">
								Upload QR Image/PDF
							</Typography>
							{uploadedVCs.length > 0 && (
								<Badge badgeContent={uploadedVCs.length} color="primary" sx={{ ml: 1 }} />
							)}
						</Box>
						<IconButton onClick={handleClose} size="small">
							<Close />
						</IconButton>
					</Box>
				</DialogTitle>

				<DialogContent sx={{ p: 3 }}>
					{/* Preview/Instruction card */}
											<Paper
						sx={{
													border: '2px dashed',
													borderColor: (theme) => theme.palette.mode === 'dark' ? '#8b5cf6' : '#a855f7',
							borderRadius: 3,
							p: { xs: 3, sm: 6 },
							mb: 3,
													backgroundColor: (theme) =>
														theme.palette.mode === 'dark' ? 'rgba(139, 92, 246, 0.08)' : 'rgba(168, 85, 247, 0.06)',
						}}
					>
												<Box
													sx={{
														width: 80,
														height: 80,
														borderRadius: 2,
														background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
														display: 'flex',
														alignItems: 'center',
														justifyContent: 'center',
														margin: '0 auto 24px',
														boxShadow: (theme) =>
															theme.palette.mode === 'dark'
																? '0 4px 12px rgba(124, 58, 237, 0.35)'
																: '0 4px 12px rgba(139, 92, 246, 0.25)',
													}}
												>
													<CloudUpload sx={{ fontSize: 40, color: 'white' }} />
												</Box>

																<Typography variant="h5" gutterBottom sx={{ color: 'text.primary', fontWeight: 700, textAlign: 'center' }}>
							Choose an Image or PDF
						</Typography>
						<Typography variant="body1" color="text.secondary" gutterBottom textAlign="center">
							The file will be processed offline using the pre-fetched cache.
						</Typography>

						{!cacheReady && (
							<Typography
								variant="caption"
								sx={{
									display: 'block',
									mt: 2,
									color: (theme) => (theme.palette.mode === 'dark' ? '#ffb74d' : 'warning.main'),
									backgroundColor: (theme) =>
										theme.palette.mode === 'dark' ? 'rgba(255, 183, 77, 0.1)' : 'rgba(255, 152, 0, 0.1)',
									p: 1,
									borderRadius: 1,
									border: (theme) =>
										theme.palette.mode === 'dark'
											? '1px solid rgba(255, 183, 77, 0.3)'
											: '1px solid rgba(255, 152, 0, 0.3)',
									textAlign: 'center',
								}}
							>
								⚠️ Cache not ready - verification may require network
							</Typography>
						)}

									<Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 2 }}>
							<Button
								variant="outlined"
								onClick={handleClose}
								sx={{
									borderRadius: '20px',
									minWidth: 100,
									fontWeight: 600,
									borderColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.3)' : undefined),
									color: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.9)' : undefined),
									'&:hover': {
										borderColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.5)' : undefined),
										backgroundColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : undefined),
									},
								}}
							>
								Cancel
							</Button>
															<Button
																variant="outlined"
																onClick={openFilePicker}
																sx={{
																	borderRadius: '20px',
																	minWidth: 140,
																	fontWeight: 700,
																	color: '#7c3aed',
																	borderColor: '#a855f7',
																	'&:hover': {
																		backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(139,92,246,0.12)' : 'rgba(168,85,247,0.08)',
																		borderColor: '#8b5cf6',
																	},
																}}
															>
																Choose File
															</Button>
						</Box>
					</Paper>

								{/* SDK Uploader (upload-only, offline) - visually hidden input */}
								<Box sx={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
									<QRCodeVerification
										onVerificationResult={handleVerificationResult}
										onError={handleError}
										credentialFormat={CredentialFormat.LDP_VC}
										isEnableUpload={true}
										isEnableScan={false}
										isEnableZoom={false}
										uploadButtonId="file-upload-modal-input"
										uploadButtonStyle="hidden-upload-input"
									/>
								</Box>

														{/* Uploaded count + Done actions (appears after first upload) */}
														{uploadedVCs.length > 0 && (
															<Box
																sx={{
																	mb: 2,
																	p: 2,
																	display: 'flex',
																	justifyContent: 'space-between',
																	alignItems: 'center',
																	backgroundColor: (theme) =>
																		theme.palette.mode === 'dark'
																			? 'rgba(255, 255, 255, 0.02)'
																			: 'rgba(0, 0, 0, 0.02)',
																	borderRadius: 2,
																	border: (theme) =>
																		theme.palette.mode === 'dark'
																			? '1px solid rgba(255, 255, 255, 0.08)'
																			: '1px solid rgba(0, 0, 0, 0.08)',
																}}
															>
																<Badge badgeContent={uploadedVCs.length} color="primary">
																	<Chip
																		label={`${uploadedVCs.length} VC${uploadedVCs.length > 1 ? 's' : ''} Uploaded`}
																		color="primary"
																		variant="outlined"
																		sx={{
																			backgroundColor: (theme) =>
																				theme.palette.mode === 'dark'
																					? 'rgba(139, 92, 246, 0.10)'
																					: 'rgba(168, 85, 247, 0.06)',
																			fontWeight: 600,
																		}}
																	/>
																</Badge>
																<Button
																	variant="outlined"
																	size="small"
																	onClick={handleClose}
																	sx={{
																		borderRadius: '20px',
																		borderColor: (theme) =>
																			theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.3)' : undefined,
																		color: (theme) =>
																			theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.9)' : undefined,
																		'&:hover': {
																			borderColor: (theme) =>
																				theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.5)' : undefined,
																			backgroundColor: (theme) =>
																				theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : undefined,
																		},
																	}}
																>
																	Done
																</Button>
															</Box>
														)}

														{/* Uploaded VCs Gallery */}
					{uploadedVCs.length > 0 && (
						<Box
							sx={{
								p: 2,
								backgroundColor: '#f8fafc',
								borderRadius: 2,
								maxHeight: '120px',
								overflowY: 'auto',
								border: '1px solid rgba(0, 0, 0, 0.08)',
								scrollbarWidth: 'none',
								'&::-webkit-scrollbar': { display: 'none' },
								'[data-mui-color-scheme="dark"] &': {
									backgroundColor: '#1a1a1a !important',
									color: '#ffffff !important',
									border: '1px solid rgba(255, 255, 255, 0.2)',
								},
							}}
						>
							<Typography
								variant="subtitle2"
								gutterBottom
								sx={{
									fontWeight: 600,
									mb: 1.5,
									color: '#1f2937',
									'[data-mui-color-scheme="dark"] &': { color: '#ffffff !important' },
								}}
							>
								Uploaded Credentials
							</Typography>
							<Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'flex-start' }}>
								{uploadedVCs.map((vc, index) => (
									<Box key={vc.id}>
										<Box
											onClick={() => {
												setSelectedVCForView(vc.result);
												setShowResult(true);
											}}
											sx={{
												position: 'relative',
												cursor: 'pointer',
												borderRadius: 1,
												overflow: 'hidden',
												border: '2px solid',
												borderColor: getVCColor(vc.result),
												transition: 'all 0.2s ease',
												boxShadow: (theme) =>
													theme.palette.mode === 'dark'
														? '0 4px 12px rgba(0,0,0,0.5)'
														: '0 2px 8px rgba(0,0,0,0.12)',
												'&:hover': {
													transform: 'scale(1.05)',
													boxShadow: (theme) =>
														theme.palette.mode === 'dark'
															? '0 8px 24px rgba(0,0,0,0.6)'
															: '0 4px 16px rgba(0,0,0,0.2)',
												},
											}}
										>
											<Avatar
												sx={{
													width: 60,
													height: 60,
													backgroundColor: getVCColor(vc.result),
													fontSize: '0.75rem',
													fontWeight: 'bold',
													color: 'white',
													boxShadow: (theme) =>
														theme.palette.mode === 'dark'
															? '0 2px 8px rgba(0,0,0,0.4)'
															: '0 2px 8px rgba(0,0,0,0.1)',
												}}
											>
												{index + 1}
											</Avatar>
											<Box
												sx={{
													position: 'absolute',
													top: -2,
													right: -2,
													backgroundColor: (theme) =>
														theme.palette.mode === 'dark' ? 'rgba(20, 20, 20, 0.95)' : 'rgba(255, 255, 255, 0.95)',
													borderRadius: '50%',
													p: 0.25,
													boxShadow: (theme) =>
														theme.palette.mode === 'dark'
															? '0 2px 6px rgba(0,0,0,0.6)'
															: '0 2px 4px rgba(0,0,0,0.1)',
													border: (theme) =>
														theme.palette.mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
												}}
											>
												{React.cloneElement(getVCIcon(vc.result), { sx: { fontSize: 16, color: getVCColor(vc.result) } })}
											</Box>
										</Box>
									</Box>
								))}
							</Box>
						</Box>
					)}
				</DialogContent>
			</Dialog>

			{/* Verification Result Modal */}
			<VerificationResultModal open={showResult} onClose={handleCloseResult} result={selectedVCForView || verificationResult} />
		</>
	);
}

