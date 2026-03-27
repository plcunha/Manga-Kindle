/**
 * Genkan Template Connector
 *
 * Server-side TypeScript adaptation of HakuNeko's Genkan template.
 * Covers Genkan CMS manga reader instances with paginated comic listings.
 *
 * Key differences from HakuNeko:
 * - Uses Cheerio instead of browser DOM (no Electron dependency)
 * - Uses undici fetch (server-side) instead of Engine.Request
 * - Pages extracted via regex from chapterPages JS variable
 */
import { BaseConnector } from '../engine/base-connector.js';
import type { Source, MangaInfo, ChapterInfo, PageInfo } from '../index.js';
import type { GenkanSiteConfig } from './types.js';

// Default selectors matching stock Genkan theme
const DEFAULTS = {
  path: '/comics',
  queryMangas: 'div.list-item div.list-content div.list-body a.list-title',
  queryPagination: 'ul.pagination li:nth-last-child(2) a.page-link',
  queryChapters: 'div.col-lg-9 div.card div.list div.list-item',
  queryChapterLink: 'a.item-author',
  queryChapterNumber: 'span.text-muted',
} as const;

/**
 * Create a connector instance for a Genkan site.
 */
export class GenkanConnector extends BaseConnector {
  readonly source: Source;
  private config: Required<
    Pick<
      GenkanSiteConfig,
      | 'path'
      | 'queryMangas'
      | 'queryPagination'
      | 'queryChapters'
      | 'queryChapterLink'
      | 'queryChapterNumber'
    >
  > &
    Pick<GenkanSiteConfig, 'headers'>;

  constructor(site: GenkanSiteConfig) {
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
      queryPagination: site.queryPagination ?? DEFAULTS.queryPagination,
      queryChapters: site.queryChapters ?? DEFAULTS.queryChapters,
      queryChapterLink: site.queryChapterLink ?? DEFAULTS.queryChapterLink,
      queryChapterNumber: site.queryChapterNumber ?? DEFAULTS.queryChapterNumber,
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
   * Search for manga on a Genkan site.
   *
   * Genkan supports a ?title= query parameter on the comics list.
   * Falls back to fetching all comics and filtering client-side.
   */
  async search(query: string): Promise<MangaInfo[]> {
    const searchUrl = `${this.baseUrl}${this.config.path}?title=${encodeURIComponent(query)}`;
    const html = await this.fetchText(searchUrl, {
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
      headers: this.config.headers,
    });
    const $ = this.parseHTML(html);

    // Extract title from og:title meta tag
    const title =
      $('meta[property="og:title"]').attr('content')?.trim() ||
      $('h1').first().text().trim();

    if (!title) return null;

    // Extract cover from og:image meta tag
    const cover = $('meta[property="og:image"]').attr('content')?.trim() || undefined;

    return {
      id: mangaId,
      sourceId: this.source.id,
      title,
      url: mangaUrl,
      cover,
    };
  }

  // ─── Chapters ─────────────────────────────────────────────────────

  async getChapters(mangaId: string): Promise<ChapterInfo[]> {
    const mangaUrl = this.resolveUrl(mangaId, this.baseUrl);

    const html = await this.fetchText(mangaUrl, {
      headers: this.config.headers,
    });
    const $ = this.parseHTML(html);

    const chapters: ChapterInfo[] = [];

    $(this.config.queryChapters).each((_i, el) => {
      const $item = $(el);
      const $link = $item.find(this.config.queryChapterLink);
      const $number = $item.find(this.config.queryChapterNumber);

      const href = $link.attr('href');
      if (!href) return;

      const linkText = $link.text().trim();
      const numberText = $number.text().trim();
      const chapterId = this.toRelativeOrAbsolute(href, this.baseUrl);

      // Build title as "{number} - {link text}"
      const title = numberText ? `${numberText} - ${linkText}` : linkText;

      // Extract chapter number from the number text
      const numMatch = numberText.match(/(\d+(?:\.\d+)?)/);
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
   * Extract page images from a Genkan chapter.
   *
   * Genkan embeds page data in a JavaScript variable:
   *   chapterPages = ["url1", "url2", ...]
   *
   * Fallback: var pages = [...]
   */
  async getPages(chapterId: string): Promise<PageInfo[]> {
    const chapterUrl = this.resolveUrl(chapterId, this.baseUrl);

    const html = await this.fetchText(chapterUrl, {
      headers: this.config.headers,
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
   * Pattern 1: chapterPages = ["url1", "url2", ...]
   * Pattern 2: var pages = ["url1", "url2", ...]
   */
  private extractPagesFromHtml(html: string): string[] {
    // Pattern 1: chapterPages variable (primary Genkan pattern)
    const chapterPagesMatch = html.match(/chapterPages\s*=\s*(\[.*?\])\s*;?/);
    if (chapterPagesMatch) {
      try {
        const urls = JSON.parse(chapterPagesMatch[1]) as string[];
        const valid = urls.filter((u) => typeof u === 'string' && u.length > 0);
        if (valid.length > 0) return valid;
      } catch {
        // JSON parse failed, try next pattern
      }
    }

    // Pattern 2: var pages = [...] (alternative variable name)
    const pagesMatch = html.match(/var\s+pages\s*=\s*(\[.*?\])\s*;?/);
    if (pagesMatch) {
      try {
        const urls = JSON.parse(pagesMatch[1]) as string[];
        const valid = urls.filter((u) => typeof u === 'string' && u.length > 0);
        if (valid.length > 0) return valid;
      } catch {
        // JSON parse failed
      }
    }

    return [];
  }
}
