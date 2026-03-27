/**
 * FlareSolverr Client
 *
 * FlareSolverr is a proxy server that solves Cloudflare and DDoS-Guard
 * JavaScript challenges using a headless browser.
 * https://github.com/FlareSolverr/FlareSolverr
 *
 * This client sends requests to FlareSolverr's v1 API and returns the
 * rendered HTML + cookies so the scraper can proceed as normal.
 */
import { fetch } from 'undici';

export interface FlareSolverrResponse {
  status: string;
  message: string;
  startTimestamp: number;
  endTimestamp: number;
  version: string;
  solution: {
    url: string;
    status: number;
    headers: Record<string, string>;
    response: string; // The HTML body
    cookies: FlareSolverrCookie[];
    userAgent: string;
  };
}

export interface FlareSolverrCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  size: number;
  httpOnly: boolean;
  secure: boolean;
  session: boolean;
  sameSite: string;
}

/** Default timeout for FlareSolverr requests (60 seconds) */
const DEFAULT_TIMEOUT = 60_000;

/**
 * Get the FlareSolverr endpoint URL from environment.
 * Returns null if not configured (feature is disabled).
 */
export function getFlareSolverrUrl(): string | null {
  return process.env.FLARESOLVERR_URL || null;
}

/**
 * Check if FlareSolverr is available and responding.
 */
export async function isFlareSolverrAvailable(): Promise<boolean> {
  const baseUrl = getFlareSolverrUrl();
  if (!baseUrl) return false;

  try {
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cmd: 'sessions.list' }),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Solve a Cloudflare-protected page via FlareSolverr.
 *
 * @param url - The URL to fetch through FlareSolverr
 * @param options - Additional options
 * @returns The rendered HTML and cookies from the solved page
 * @throws Error if FlareSolverr is not configured or request fails
 */
export async function solveCloudflarePage(
  url: string,
  options: {
    maxTimeout?: number;
    cookies?: Array<{ name: string; value: string }>;
    headers?: Record<string, string>;
  } = {},
): Promise<{ html: string; cookies: FlareSolverrCookie[]; userAgent: string }> {
  const baseUrl = getFlareSolverrUrl();
  if (!baseUrl) {
    throw new Error(
      'FlareSolverr is not configured. Set FLARESOLVERR_URL env var (e.g. http://localhost:8191/v1).',
    );
  }

  const timeout = options.maxTimeout ?? DEFAULT_TIMEOUT;

  const body: Record<string, unknown> = {
    cmd: 'request.get',
    url,
    maxTimeout: timeout,
  };

  // Pass cookies if provided (e.g. login cookies, age-verification)
  if (options.cookies?.length) {
    body.cookies = options.cookies;
  }

  console.log(`[FlareSolverr] Solving: ${url}`);
  const startTime = Date.now();

  const res = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout + 10_000), // Extra buffer over FlareSolverr timeout
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`FlareSolverr HTTP ${res.status}: ${text}`);
  }

  const data = (await res.json()) as FlareSolverrResponse;
  const elapsed = Date.now() - startTime;

  if (data.status !== 'ok') {
    throw new Error(`FlareSolverr error: ${data.message}`);
  }

  console.log(
    `[FlareSolverr] Solved ${url} in ${elapsed}ms (status: ${data.solution.status})`,
  );

  return {
    html: data.solution.response,
    cookies: data.solution.cookies,
    userAgent: data.solution.userAgent,
  };
}
