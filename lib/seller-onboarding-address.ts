export type SellerPersonalAddress = {
  address: string;
  postalCode: string;
  city: string;
  country: string;
  phone: string;
};

type BuyerShippingAddress = {
  addressLine1: string;
  addressLine2: string | null;
  postalCode: string;
  city: string;
  country: string;
  phone: string | null;
} | null;

type UserProfileAddress = {
  profileAddress: string | null;
  profilePostalCode: string | null;
  profileCity: string | null;
  profileCountry: string | null;
  phone: string | null;
};

function completeAddress(value: SellerPersonalAddress): SellerPersonalAddress | null {
  const country = value.country.trim().toUpperCase();
  const address = value.address.trim();
  const postalCode = value.postalCode.trim();
  const city = value.city.trim();
  if (!address || !postalCode || !city || !/^[A-Z]{2}$/.test(country)) return null;
  return { address, postalCode, city, country, phone: value.phone.trim() };
}

/** Prefer the user's personal account profile; fall back to a saved shipping address.
 * This only returns a prefill/copy source and never mutates either record.
 */
export function resolveSellerPersonalAddress(
  shippingAddress: BuyerShippingAddress,
  profile: UserProfileAddress,
  phoneFallback = "",
): SellerPersonalAddress | null {
  if (profile.profileAddress && profile.profilePostalCode && profile.profileCity && profile.profileCountry) {
    const personal = completeAddress({
      address: profile.profileAddress,
      postalCode: profile.profilePostalCode,
      city: profile.profileCity,
      country: profile.profileCountry,
      phone: profile.phone ?? phoneFallback,
    });
    if (personal) return personal;
  }

  if (shippingAddress) {
    const saved = completeAddress({
      address: [shippingAddress.addressLine1, shippingAddress.addressLine2].filter(Boolean).join(", "),
      postalCode: shippingAddress.postalCode,
      city: shippingAddress.city,
      country: shippingAddress.country,
      phone: shippingAddress.phone ?? profile.phone ?? phoneFallback,
    });
    if (saved) return saved;
  }

  return null;
}
