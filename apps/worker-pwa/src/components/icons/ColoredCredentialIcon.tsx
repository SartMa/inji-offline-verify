import React from 'react';
import { Box } from '@mui/material';

type CredentialStatusVariant = 'success' | 'warning' | 'error';

interface ColoredCredentialIconProps {
	variant?: CredentialStatusVariant;
	size?: number;
}

const VARIANT_TOKENS: Record<CredentialStatusVariant, {
	docFill: string;
	docStroke: string;
	foldFill: string;
	textFill: string;
	accentFill: string;
	accentStroke: string;
	symbolColor: string;
}> = {
	success: {
		docFill: '#f0fdf4',
		docStroke: '#22c55e',
		foldFill: '#dcfce7',
		textFill: '#bbf7d0',
		accentFill: '#22c55e',
		accentStroke: '#15803d',
		symbolColor: '#f0fdf4',
	},
	warning: {
		docFill: '#fefce8',
		docStroke: '#f59e0b',
		foldFill: '#fef3c7',
		textFill: '#fde68a',
		accentFill: '#f59e0b',
		accentStroke: '#b45309',
		symbolColor: '#fff7ed',
	},
	error: {
		docFill: '#fef2f2',
		docStroke: '#ef4444',
		foldFill: '#fee2e2',
		textFill: '#fecaca',
		accentFill: '#ef4444',
		accentStroke: '#b91c1c',
		symbolColor: '#fee2e2',
	},
};

const ColoredCredentialIcon: React.FC<ColoredCredentialIconProps> = ({ variant = 'success', size = 64 }) => {
	const palette = VARIANT_TOKENS[variant];

	return (
		<Box
			component="svg"
			viewBox="0 0 64 64"
			role="presentation"
			aria-hidden="true"
			focusable="false"
			sx={{
				width: size,
				height: size,
				display: 'block',
			}}
		>
			<path
				d="M18 8h18l10 10v28c0 3.3-2.7 6-6 6H18c-3.3 0-6-2.7-6-6V14c0-3.3 2.7-6 6-6z"
				fill={palette.docFill}
				stroke={palette.docStroke}
				strokeWidth={2.4}
				strokeLinejoin="round"
			/>
			<path d="M36 8v8c0 3.3 2.7 6 6 6h8" fill={palette.foldFill} />
			<path
				d="M36 8h0l10 10h-8c-1.1 0-2-.9-2-2z"
				fill={palette.docStroke}
				opacity={0.18}
			/>
			<line x1={22} y1={26} x2={38} y2={26} stroke={palette.textFill} strokeWidth={2.4} strokeLinecap="round" />
			<line x1={22} y1={32} x2={38} y2={32} stroke={palette.textFill} strokeWidth={2.4} strokeLinecap="round" />
			<line x1={22} y1={38} x2={32} y2={38} stroke={palette.textFill} strokeWidth={2.4} strokeLinecap="round" />

			<circle
				cx={44}
				cy={46}
				r={10}
				fill={palette.accentFill}
				stroke={palette.accentStroke}
				strokeWidth={2.4}
			/>

			{variant === 'success' && (
				<path
					d="M39.5 45l3.4 3.8 6.6-7.8"
					fill="none"
					stroke={palette.symbolColor}
					strokeWidth={3}
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			)}

			{variant === 'warning' && (
				<g stroke={palette.symbolColor} strokeWidth={3} strokeLinecap="round">
					<line x1={44} y1={41} x2={44} y2={47} />
					<circle cx={44} cy={50.5} r={1.8} fill={palette.symbolColor} stroke="none" />
				</g>
			)}

			{variant === 'error' && (
				<g stroke={palette.symbolColor} strokeWidth={3} strokeLinecap="round">
					<line x1={40} y1={42} x2={48} y2={50} />
					<line x1={48} y1={42} x2={40} y2={50} />
				</g>
			)}
		</Box>
	);
};

export default ColoredCredentialIcon;
