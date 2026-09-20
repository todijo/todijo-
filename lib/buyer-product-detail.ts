type BuyerStoreInput = {
  id: string;
  slug: string;
  name: string;
  logo: string | null;
  description: string | null;
  city: string;
  country: string;
  sellerType: string;
};

type BuyerMediaInput = {
  type: string;
  url: string;
  posterUrl: string | null;
  position: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
};

/** Explicit public store boundary. Never spread a Prisma store record into a buyer response. */
export function serializeBuyerStore(store: BuyerStoreInput) {
  return {
    id: store.id,
    slug: store.slug,
    name: store.name,
    logo: store.logo,
    description: store.description,
    city: store.city,
    country: store.country,
    sellerType: store.sellerType,
  };
}

/**
 * Public-media invariant: only media attached to an already-public Product and used by
 * the production web PDP is accepted. Provider/publicId/sourceUrl are never serialized.
 */
export function serializeBuyerMedia(productImages: string[], imageRecordUrls: string[], media: BuyerMediaInput[]) {
  const images = [...new Map([...productImages, ...imageRecordUrls].filter(Boolean).map((url) => [url, url])).values()]
    .map((url, position) => ({ type: "IMAGE" as const, url, position }));
  const videos = media.filter((item) => item.type === "VIDEO").slice(0, 1).map((item) => ({
    type: item.type,
    url: item.url,
    posterUrl: item.posterUrl,
    position: item.position,
    width: item.width,
    height: item.height,
    durationMs: item.durationMs,
  }));
  return { images, videos };
}
