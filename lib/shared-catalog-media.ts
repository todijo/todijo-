export type SharedCatalogMediaProvenance = { imageUrl: string; sourceUrl: string; rightsConfirmedByAdminId: string; rightsConfirmedAt: string };

export function hasSharedCatalogMediaProvenance(images: readonly string[], value: unknown): value is SharedCatalogMediaProvenance[] {
  if (!Array.isArray(value) || value.length !== images.length) return false;
  return images.every((imageUrl, index) => {
    const entry = value[index];
    return Boolean(entry && typeof entry === "object" && !Array.isArray(entry)
      && (entry as SharedCatalogMediaProvenance).imageUrl === imageUrl
      && typeof (entry as SharedCatalogMediaProvenance).sourceUrl === "string"
      && typeof (entry as SharedCatalogMediaProvenance).rightsConfirmedByAdminId === "string"
      && Boolean((entry as SharedCatalogMediaProvenance).rightsConfirmedByAdminId)
      && typeof (entry as SharedCatalogMediaProvenance).rightsConfirmedAt === "string"
      && Number.isFinite(Date.parse((entry as SharedCatalogMediaProvenance).rightsConfirmedAt)));
  });
}
