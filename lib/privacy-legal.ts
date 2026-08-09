export type PrivacyPublicProfile = {
  supportEmail: string;
};

// TODO(after incorporation): verify and publish the final legal entity name; French SAS
// registration plus SIREN/SIRET; registered office; VAT number if applicable; DPO details
// only if one is later appointed or required; the final retention schedule; and verified
// processor locations, contracts, international-transfer facts and safeguards.
export function privacyPublicProfile(): PrivacyPublicProfile {
  return {
    supportEmail: process.env.SMTP_REPLY_TO?.trim() || "support@todijo.com",
  };
}
