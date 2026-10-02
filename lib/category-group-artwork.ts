// Optional presentation assets only; taxonomy and canonical IDs remain authoritative.
const groupArtwork: Readonly<Record<string, string>> = {
  "home--furniture": "/images/category-groups/home--furniture.webp",
};

export function categoryGroupImagePath(categoryId: string, groupId: string, failedSrc?: string): string | null {
  const key = `${categoryId}--${groupId}`;
  const src = Object.prototype.hasOwnProperty.call(groupArtwork, key) ? groupArtwork[key] : null;
  return src && src !== failedSrc ? src : null;
}
