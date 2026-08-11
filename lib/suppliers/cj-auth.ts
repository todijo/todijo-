const CJ_BASE_URL = "https://developers.cjdropshipping.com/api2.0/v1";
const EXPIRY_SAFETY_WINDOW_MS = 5 * 60 * 1000;

type Fetcher = typeof fetch;
type TokenPayload = {
  accessToken: string;
  accessTokenExpiryDate: string;
  refreshToken?: string;
  refreshTokenExpiryDate?: string;
};

type CachedToken = {
  accessToken: string;
  accessTokenExpiresAt: number;
  refreshToken?: string;
  refreshTokenExpiresAt?: number;
};

export type CjAuthOptions = {
  apiKey?: string;
  staticAccessToken?: string;
  fetcher?: Fetcher;
  now?: () => number;
};

function clean(value: string | undefined) {
  const result = value?.trim();
  return result || undefined;
}

function expiry(value: string | undefined) {
  const parsed = value ? Date.parse(value) : Number.NaN;
  if (!Number.isFinite(parsed)) throw new Error("CJ_AUTHENTICATION_FAILED");
  return parsed;
}

export class CjAuthService {
  private readonly apiKey: string | undefined;
  private readonly staticAccessToken: string | undefined;
  private readonly fetcher: Fetcher;
  private readonly now: () => number;
  private cached: CachedToken | null = null;
  private pending: Promise<string> | null = null;

  constructor(options: CjAuthOptions = {}) {
    this.apiKey = clean(options.apiKey ?? process.env.CJ_API_KEY);
    this.staticAccessToken = clean(options.staticAccessToken ?? process.env.CJ_ACCESS_TOKEN);
    this.fetcher = options.fetcher ?? fetch;
    this.now = options.now ?? Date.now;
  }

  isConfigured() {
    return Boolean(this.apiKey || this.staticAccessToken);
  }

  invalidateAccessToken() {
    if (this.cached) this.cached.accessTokenExpiresAt = 0;
  }

  async getAccessToken() {
    if (!this.apiKey) {
      if (this.staticAccessToken) return this.staticAccessToken;
      throw new Error("CJ_NOT_CONFIGURED");
    }
    if (this.cached && this.cached.accessTokenExpiresAt > this.now() + EXPIRY_SAFETY_WINDOW_MS) return this.cached.accessToken;
    if (!this.pending) this.pending = this.refreshOrAcquire().finally(() => { this.pending = null; });
    return this.pending;
  }

  private async refreshOrAcquire() {
    if (this.cached?.refreshToken && (this.cached.refreshTokenExpiresAt ?? 0) > this.now() + EXPIRY_SAFETY_WINDOW_MS) {
      try {
        return await this.requestToken("/authentication/refreshAccessToken", { refreshToken: this.cached.refreshToken });
      } catch {
        this.cached = null;
      }
    }
    return this.requestToken("/authentication/getAccessToken", { apiKey: this.apiKey });
  }

  private async requestToken(path: string, body: Record<string, string | undefined>) {
    let response: Response;
    try {
      response = await this.fetcher(`${CJ_BASE_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      });
    } catch {
      throw new Error("CJ_UNAVAILABLE");
    }
    let payload: { result?: boolean; success?: boolean; data?: TokenPayload };
    try {
      payload = await response.json() as typeof payload;
    } catch {
      throw new Error(response.ok ? "CJ_AUTHENTICATION_FAILED" : "CJ_UNAVAILABLE");
    }
    const data = payload.data;
    if (!response.ok || payload.result === false || payload.success === false || !clean(data?.accessToken)) {
      throw new Error(response.status >= 500 ? "CJ_UNAVAILABLE" : "CJ_AUTHENTICATION_FAILED");
    }
    const token: CachedToken = {
      accessToken: data!.accessToken.trim(),
      accessTokenExpiresAt: expiry(data!.accessTokenExpiryDate),
      refreshToken: clean(data!.refreshToken),
      refreshTokenExpiresAt: data!.refreshToken ? expiry(data!.refreshTokenExpiryDate) : undefined,
    };
    if (token.accessTokenExpiresAt <= this.now()) throw new Error("CJ_AUTHENTICATION_FAILED");
    this.cached = token;
    return token.accessToken;
  }
}

export const cjAuth = new CjAuthService();
