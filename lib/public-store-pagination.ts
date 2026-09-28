export const PUBLIC_STORE_DESKTOP_PAGE_SIZE = 24;
export const PUBLIC_STORE_MOBILE_PAGE_SIZE = 100;

const MOBILE_USER_AGENT = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i;

export function publicStorePageSize(userAgent: string | null, mobileClientHint: string | null = null) {
  return mobileClientHint === "?1" || (userAgent && MOBILE_USER_AGENT.test(userAgent))
    ? PUBLIC_STORE_MOBILE_PAGE_SIZE
    : PUBLIC_STORE_DESKTOP_PAGE_SIZE;
}
