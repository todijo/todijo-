export const PDP_DESKTOP_ALSO_LIMIT = 12;
export const PDP_MOBILE_ALSO_LIMIT = 40;
export const PDP_MOBILE_RECOMMENDATION_PAGE_SIZE = 8;
export const PDP_DESKTOP_RECOMMENDATION_QUERY_LIMIT = 32;
export const PDP_MOBILE_RECOMMENDATION_QUERY_LIMIT = 48;

const MOBILE_USER_AGENT = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i;

export function isMobilePdpRequest(userAgent: string | null, mobileClientHint: string | null = null) {
  return mobileClientHint === "?1" || Boolean(userAgent && MOBILE_USER_AGENT.test(userAgent));
}

export function pdpRecommendationLimits(mobile: boolean) {
  return mobile
    ? { resultLimit: PDP_MOBILE_ALSO_LIMIT, queryLimit: PDP_MOBILE_RECOMMENDATION_QUERY_LIMIT }
    : { resultLimit: PDP_DESKTOP_ALSO_LIMIT, queryLimit: PDP_DESKTOP_RECOMMENDATION_QUERY_LIMIT };
}

export function pdpRecommendationPage(requestedPage: number, resultCount: number) {
  const pages = Math.max(1, Math.ceil(resultCount / PDP_MOBILE_RECOMMENDATION_PAGE_SIZE));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, pages) : 1;
  const start = (page - 1) * PDP_MOBILE_RECOMMENDATION_PAGE_SIZE;
  return { page, pages, start, end: start + PDP_MOBILE_RECOMMENDATION_PAGE_SIZE };
}
