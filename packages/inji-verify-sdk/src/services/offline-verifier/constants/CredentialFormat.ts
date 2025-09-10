export const CredentialFormat = {
    LDP_VC: "ldp_vc",
    MSO_MDOC: "mso_mdoc"
} as const;

export type CredentialFormat = typeof CredentialFormat[keyof typeof CredentialFormat];

// Helper function to get enum from string value (equivalent to Kotlin's fromValue)
function getCredentialFormatFromValue(value: string): CredentialFormat | null {
    return Object.values(CredentialFormat).find(format => format === value) ?? null;
}

export { getCredentialFormatFromValue };