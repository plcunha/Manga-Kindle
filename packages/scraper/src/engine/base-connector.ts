/**
 * Base Connector class - provides common utilities for all connectors.
 * Adapted from HakuNeko's connector pattern for server-side use.
 */
import * as cheerio from 'cheerio';
import { fetch, type RequestInit } from 'undici';
import type { Connector, Source, MangaInfo, ChapterInfo, PageInfo } from '../index.js';
import { getFlareSolverrUrl, solveCloudflarePage, type FlareSolverrCookie } from './flaresolverr.js';

/** HTTP status codes that indicate Cloudflare / DDoS protection */
const CF_STATUS_CODES = new Set([403, 503]);

export abstract class BaseConnector implements Connector {
  abstract readonly source: Source;

  /**
   * Cached FlareSolverr cookies per domain.
   * After a successful solve, we cache the cf_clearance cookie
   * so subsequent requests can use plain fetch.
   */
  private static cfCookieCache = new Map<string, { cookies: string; userAgent: string; expires: number }>();

  /**
   * Whether this connector's site requires FlareSolverr.
   * Set to true by subclasses for known Cloudflare-protected sites.
   */
  protected useFlareSolverr = false;

  // ── Fetch Methods ──────────────────────────────────────

  /**
   * Standard headers for browser-like requests.
   */
  private get defaultHeaders(): Record<string, string> {
    return {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
    };
  }

  /**
   * Fetch a URL with standard headers and error handling.
   * If the response is a Cloudflare challenge (403/503) and FlareSolverr
   * is available, automatically retries through FlareSolverr.
   */
  protected async fetchText(url: string, init?: RequestInit): Promise<string> {
    // If we know this site needs FlareSolverr, try cached cookies first
    const cached = this.getCachedCFCookies(url);
    const extraHeaders: Record<string, string> = {};
    if (cached) {
      extraHeaders.Cookie = cached.cookies;
      extraHeaders['User-Agent'] = cached.userAgent;
    }

    const response = await fetch(url, {
      ...init,
      headers: {
        ...this.defaultHeaders,
        ...extraHeaders,
        ...(init?.headers as Record<string, string>),
      },
    });

    // If blocked by Cloudflare, try FlareSolverr fallback
    if (CF_STATUS_CODES.has(response.status)) {
      return this.fetchTextViaCF(url, init);
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} fetching ${url}`);
    }

    return response.text();
  }

  /**
   * Fetch JSON from a URL.
   */
  protected async fetchJSON<T = unknown>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...init,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'application/json',
        ...(init?.headers as Record<string, string>),
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} fetching ${url}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Load HTML into Cheerio for DOM-like parsing (replaces browser DOM APIs).
   */
  protected parseHTML(html: string): cheerio.CheerioAPI {
    return cheerio.load(html);
  }

  // ── FlareSolverr Fallback ──────────────────────────────

  /**
   * Fetch text via FlareSolverr for Cloudflare-protected pages.
   * Caches the resulting cookies for future requests.
   */
  private async fetchTextViaCF(url: string, _init?: RequestInit): Promise<string> {
    if (!getFlareSolverrUrl()) {
      throw new Error(
        `HTTP 403/503 fetching ${url}. Site appears to be Cloudflare-protected. ` +
        `Set FLARESOLVERR_URL env var to enable automatic bypass.`,
      );
    }

    const result = await solveCloudflarePage(url);

    // Cache cookies for this domain
    this.cacheCFCookies(url, result.cookies, result.userAgent);

    return result.html;
  }

  /**
   * Get cached CF cookies for a URL's domain.
   */
  private getCachedCFCookies(url: string): { cookies: string; userAgent: string } | null {
    const domain = new URL(url).hostname;
    const cached = BaseConnector.cfCookieCache.get(domain);
    if (!cached) return null;
    if (Date.now() > cached.expires) {
      BaseConnector.cfCookieCache.delete(domain);
      return null;
    }
    return { cookies: cached.cookies, userAgent: cached.userAgent };
  }

  /**
   * Cache CF cookies from a FlareSolverr solve.
   */
  private cacheCFCookies(url: string, cookies: FlareSolverrCookie[], userAgent: string): void {
    const domain = new URL(url).hostname;
    const cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    // Find cf_clearance expiry, default to 15 min
    const cfCookie = cookies.find((c) => c.name === 'cf_clearance');
    const expires = cfCookie ? cfCookie.expires * 1000 : Date.now() + 15 * 60 * 1000;

    BaseConnector.cfCookieCache.set(domain, { cookies: cookieStr, userAgent, expires });
    console.log(`[BaseConnector] Cached CF cookies for ${domain} (expires in ${Math.round((expires - Date.now()) / 1000)}s)`);
  }

  // Subclasses must implement these
  abstract search(query: string): Promise<MangaInfo[]>;
  abstract getManga(mangaId: string): Promise<MangaInfo | null>;
  abstract getChapters(mangaId: string): Promise<ChapterInfo[]>;
  abstract getPages(chapterId: string): Promise<PageInfo[]>;
}
