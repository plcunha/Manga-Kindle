/**
 * FoolSlide Template Connector
 *
 * Server-side TypeScript adaptation of HakuNeko's FoolSlide template.
 * Covers self-hosted FoolSlide manga reader instances used by scanlation groups.
 *
 * Key differences from HakuNeko:
 * - Uses Cheerio instead of browser DOM (no Electron dependency)
 * - Uses undici fetch (server-side) instead of Engine.Request
 * - Pages extracted via regex from embedded JS variables (direct JSON or base64)
 */
import { BaseConnector } from '../engine/base-connector.js';
import type { Source, MangaInfo, ChapterInfo, PageInfo } from '../index.js';
import type { FoolSlideSiteConfig } from './types.js';

// Default selectors matching stock FoolSlide theme
const DEFAULTS = {
  path: '/directory/',
  queryMangas: 'div.list div.group > div.title a',
  queryMangasPageCount: 'div.prevnext div.next a:first-of-type',
  queryChapters: 'div.list div.element div.title a',
} as const;

/**
 * Create a connector instance for a FoolSlide site.
 */
export class FoolSlideConnector extends BaseConnector {
  readonly source: Source;
  private config: Required<
    Pick<
      FoolSlideSiteConfig,
      'path' | 'queryMangas' | 'queryMangasPageCount' | 'queryChapters'
    >
  > &
    Pick<FoolSlideSiteConfig, 'headers'>;

  constructor(site: FoolSlideSiteConfig) {
    super();

    this.source = {
      id: site.id,
      name: site.label,
      url: site.url,
      language: site.language ?? 'en',
      type: 'manga',
      enabled: true,
    };

    this.config = {
      path: site.path ?? DEFAULTS.path,
      queryMangas: site.queryMangas ?? DEFAULTS.queryMangas,
      queryMangasPageCount: site.queryMangasPageCount ?? DEFAULTS.queryMangasPageCount,
      queryChapters: site.queryChapters ?? DEFAULTS.queryChapters,
      headers: site.headers,
    };
  }

  private get baseUrl(): string {
    return this.source.url.replace(/\/+$/, '');
  }

  /**
   * Resolve a potentially-relative URL against a base.
   */
  private resolveUrl(href: string, base: string): string {
    try {
      return new URL(href, base).href;
    } catch {
      return href;
    }
  }

  /**
   * Make path root-relative or absolute.
   */
  private toRelativeOrAbsolute(href: string, base: string): string {
    try {
      const url = new URL(href, base);
      return url.pathname + url.search + url.hash;
    } catch {
      return href;
    }
  }

  // ─── Search ───────────────────────────────────────────────────────

  /**
   * FoolSlide doesn't provide a built-in search API.
   * Fetch the first page of the manga directory and filter by title.
   */
  async search(query: string): Promise<MangaInfo[]> {
    const directoryUrl = this.baseUrl + this.config.path;
    const html = await this.fetchText(directoryUrl, {
      headers: this.config.headers,
    });
    const $ = this.parseHTML(html);

    const results: MangaInfo[] = [];
    const lowerQuery = query.toLowerCase();

    $(this.config.queryMangas).each((_i, el) => {
      const $el = $(el);
      const href = $el.attr('href');
      if (!href) return;

      const title = $el.text().trim();
      if (!title.toLowerCase().includes(lowerQuery)) return;

      const mangaId = this.toRelativeOrAbsolute(href, this.baseUrl);

      results.push({
        id: mangaId,
        sourceId: this.source.id,
        title,
        url: this.resolveUrl(href, this.baseUrl),
      });
    });

    return results;
  }

  // ─── Manga Detail ─────────────────────────────────────────────────

  async getManga(mangaId: string): Promise<MangaInfo | null> {
    const mangaUrl = this.resolveUrl(mangaId, this.baseUrl);

    const html = await this.fetchText(mangaUrl, {
      method: 'POST',
      body: 'adult=true',
      headers: {
        ...this.config.headers,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    const $ = this.parseHTML(html);

    // Extract title from first heading
    const title =
      $('h1.title').first().text().trim() ||
      $('h1').first().text().trim();

    if (!title) return null;

    return {
      id: mangaId,
      sourceId: this.source.id,
      title,
      url: mangaUrl,
    };
  }

  // ─── Chapters ─────────────────────────────────────────────────────

  async getChapters(mangaId: string): Promise<ChapterInfo[]> {
    const mangaUrl = this.resolveUrl(mangaId, this.baseUrl);

    // FoolSlide requires POST with adult=true to show all chapters
    const html = await this.fetchText(mangaUrl, {
      method: 'POST',
      body: 'adult=true',
      headers: {
        ...this.config.headers,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    const $ = this.parseHTML(html);

    const chapters: ChapterInfo[] = [];

    $(this.config.queryChapters).each((_i, el) => {
      const $el = $(el);
      const href = $el.attr('href');
      if (!href) return;

      const title = $el.text().trim();
      const chapterId = this.toRelativeOrAbsolute(href, this.baseUrl);

      // Extract chapter number from title
      // Matches patterns like: "Ch. 10", "Chapter 5.5", "Vol.1 Ch.2", "#3"
      const numMatch = title.match(
        /(?:ch(?:apter)?\.?\s*|#|cap[ií]tulo\s*)(\d+(?:\.\d+)?)/i
      );
      const number = numMatch ? parseFloat(numMatch[1]) : chapters.length;

      chapters.push({
        id: chapterId,
        mangaId,
        title,
        number,
        language: this.source.language,
        url: this.resolveUrl(href, mangaUrl),
      });
    });

    return chapters;
  }

  // ─── Pages ────────────────────────────────────────────────────────

  /**
   * Extract page images from a FoolSlide chapter.
   *
   * FoolSlide embeds page data in JavaScript variables using two patterns:
   * 1. Direct JSON: var pages = [{...}, {...}]
   * 2. Base64-encoded: JSON.parse(atob("..."))
   *
   * Each page object has a `.url` property pointing to the image.
   */
  async getPages(chapterId: string): Promise<PageInfo[]> {
    const chapterUrl = this.resolveUrl(chapterId, this.baseUrl);

    // POST with adult=true to access all pages
    const html = await this.fetchText(chapterUrl, {
      method: 'POST',
      body: 'adult=true',
      headers: {
        ...this.config.headers,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const pages = this.extractPagesFromHtml(html);

    return pages.map((pageUrl, index) => ({
      index,
      url: pageUrl,
      referer: chapterUrl,
    }));
  }

  /**
   * Extract page image URLs from embedded JavaScript in the HTML.
   *
   * Pattern 1: var pages = [{url: "..."}, ...] (direct JSON array)
   * Pattern 2: JSON.parse(atob("...")) (base64-encoded JSON array)
   */
  private extractPagesFromHtml(html: string): string[] {
    // Pattern 1: Direct JSON array assignment
    // Matches: var pages = [...];
    const directMatch = html.match(/var\s+pages\s*=\s*(\[[\s\S]*?\])\s*;/);
    if (directMatch) {
      try {
        const pages = JSON.parse(directMatch[1]) as Array<{ url?: string }>;
        const urls = pages
          .map((p) => p.url)
          .filter((u): u is string => typeof u === 'string' && u.length > 0);
        if (urls.length > 0) return urls;
      } catch {
        // JSON parse failed, try next pattern
      }
    }

    // Pattern 2: Base64-encoded JSON
    // Matches: JSON.parse(atob("..."))
    const base64Match = html.match(/JSON\.parse\s*\(\s*atob\s*\(\s*"([^"]+)"\s*\)/);
    if (base64Match) {
      try {
        const decoded = Buffer.from(base64Match[1], 'base64').toString('utf-8');
        const pages = JSON.parse(decoded) as Array<{ url?: string }>;
        const urls = pages
          .map((p) => p.url)
          .filter((u): u is string => typeof u === 'string' && u.length > 0);
        if (urls.length > 0) return urls;
      } catch {
        // Base64 decode or JSON parse failed
      }
    }

    return [];
  }
}
