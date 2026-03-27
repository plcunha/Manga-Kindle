/**
 * MangaReaderCMS Template Connector
 *
 * Server-side TypeScript adaptation of HakuNeko's MangaReaderCMS template.
 * Covers sites using the MangaReaderCMS with AJAX manga listing
 * and base64-encoded or direct image sources for pages.
 *
 * Key differences from HakuNeko:
 * - Uses Cheerio instead of browser DOM (no Electron dependency)
 * - Uses undici fetch (server-side) instead of Engine.Request
 * - Base64 page URL decoding with fallback to direct URLs
 */
import { BaseConnector } from '../engine/base-connector.js';
import type { Source, MangaInfo, ChapterInfo, PageInfo } from '../index.js';
import type { MangaReaderCMSSiteConfig } from './types.js';

// Default selectors matching stock MangaReaderCMS theme
const DEFAULTS = {
  path: '/',
  queryMangas: 'ul.manga-list li a',
  queryChapters: 'ul.chapters li h5.chapter-title-rtl',
  queryPages: 'div#all source.img-responsive, div#all img.img-responsive',
  queryMangaTitle: 'h1.widget-title, h2.widget-title, h2.listmanga-header',
  queryCover: 'div.boxed img.img-responsive',
  querySynopsis: 'div.well p, div.manga-content p',
} as const;

/**
 * Create a connector instance for a MangaReaderCMS site.
 */
export class MangaReaderCMSConnector extends BaseConnector {
  readonly source: Source;
  private config: Required<
    Pick<
      MangaReaderCMSSiteConfig,
      | 'path'
      | 'queryMangas'
      | 'queryChapters'
      | 'queryPages'
      | 'queryMangaTitle'
      | 'queryCover'
      | 'querySynopsis'
    >
  > &
    Pick<MangaReaderCMSSiteConfig, 'headers'>;

  constructor(site: MangaReaderCMSSiteConfig) {
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
      queryChapters: site.queryChapters ?? DEFAULTS.queryChapters,
      queryPages: site.queryPages ?? DEFAULTS.queryPages,
      queryMangaTitle: site.queryMangaTitle ?? DEFAULTS.queryMangaTitle,
      queryCover: site.queryCover ?? DEFAULTS.queryCover,
      querySynopsis: site.querySynopsis ?? DEFAULTS.querySynopsis,
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

  // ─── Manga List (AJAX) ──────────────────────────────────────────────

  /**
   * Fetch the full manga list via the AJAX changeMangaList endpoint.
   */
  private async fetchMangaList(): Promise<MangaInfo[]> {
    const listUrl = `${this.baseUrl}/changeMangaList?type=text`;
    const html = await this.fetchText(listUrl, {
      headers: {
        ...this.config.headers,
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    const $ = this.parseHTML(html);
    const results: MangaInfo[] = [];

    $(this.config.queryMangas).each((_i, el) => {
      const $el = $(el);
      const href = $el.attr('href');
      if (!href) return;

      const title = $el.text().trim();
      if (!title) return;

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

  // ─── Search ───────────────────────────────────────────────────────

  async search(query: string): Promise<MangaInfo[]> {
    // Try search endpoint first
    try {
      const searchUrl = `${this.baseUrl}/search?query=${encodeURIComponent(query)}`;
      const html = await this.fetchText(searchUrl, {
        headers: this.config.headers,
      });
      const $ = this.parseHTML(html);
      const results: MangaInfo[] = [];

      // Parse search results from common MangaReaderCMS search containers
      $('div.media, div.result-item, li.list-group-item').each((_i, el) => {
        const $el = $(el);
        const $link = $el.find('a').first();
        const href = $link.attr('href');
        if (!href) return;

        const title =
          $link.attr('title') ||
          $el.find('h4, h3, .media-heading, .result-title').first().text().trim() ||
          $link.text().trim();
        if (!title) return;

        const mangaId = this.toRelativeOrAbsolute(href, this.baseUrl);

        const $img = $el.find('img').first();
        const cover =
          $img.attr('data-src') || $img.attr('src') || undefined;

        results.push({
          id: mangaId,
          sourceId: this.source.id,
          title,
          url: this.resolveUrl(href, this.baseUrl),
          cover: cover ? this.resolveUrl(cover, this.baseUrl) : undefined,
        });
      });

      if (results.length > 0) return results;
    } catch {
      // Search endpoint not available, fall through to manga list filter
    }

    // Fallback: fetch full manga list and filter by query
    const allMangas = await this.fetchMangaList();
    const lowerQuery = query.toLowerCase();
    return allMangas.filter((m) => m.title.toLowerCase().includes(lowerQuery));
  }

  // ─── Manga Detail ─────────────────────────────────────────────────

  async getManga(mangaId: string): Promise<MangaInfo | null> {
    const url = this.resolveUrl(mangaId, this.baseUrl);
    const html = await this.fetchText(url, {
      headers: this.config.headers,
    });
    const $ = this.parseHTML(html);

    // Extract title
    const title = $(this.config.queryMangaTitle).first().text().trim();
    if (!title) return null;

    // Extract cover
    const $cover = $(this.config.queryCover).first();
    const cover =
      $cover.attr('data-src') || $cover.attr('src') || undefined;

    // Extract synopsis
    const synopsisParts: string[] = [];
    $(this.config.querySynopsis).each((_i, el) => {
      const text = $(el).text().trim();
      if (text) synopsisParts.push(text);
    });

    return {
      id: mangaId,
      sourceId: this.source.id,
      title,
      url,
      cover: cover ? this.resolveUrl(cover, this.baseUrl) : undefined,
      synopsis: synopsisParts.join('\n') || undefined,
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
      const $el = $(el);

      // If element is <a>, use it directly; otherwise find <a> inside
      const $link = $el.is('a') ? $el : $el.find('a').first();
      const href = $link.attr('href');
      if (!href) return;

      const title = $link.text().trim().replace(/\s+/g, ' ');
      const chapterId = this.toRelativeOrAbsolute(href, this.baseUrl);

      // Extract chapter number
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
   * Try to decode a base64-encoded page URL.
   * MangaReaderCMS encodes the image URL by prepending a fake protocol
   * then base64-encoding the rest. Strip the protocol and decode.
   */
  private tryDecodeBase64Url(raw: string): string | null {
    try {
      // Strip protocol prefix (e.g. "https://") from the raw value
      const parts = raw.split('://');
      if (parts.length < 2) return null;
      const encoded = parts.slice(1).join('://');
      const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
      // Validate that the decoded value looks like a URL
      if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
        return decoded;
      }
      return null;
    } catch {
      return null;
    }
  }

  async getPages(chapterId: string): Promise<PageInfo[]> {
    const chapterUrl = this.resolveUrl(chapterId, this.baseUrl);
    const html = await this.fetchText(chapterUrl, {
      headers: this.config.headers,
    });
    const $ = this.parseHTML(html);

    const pages: PageInfo[] = [];
    let index = 0;

    $(this.config.queryPages).each((_i, el) => {
      const $el = $(el);
      const dataSrc = ($el.attr('data-src') || '').trim();
      const src = ($el.attr('src') || '').trim();

      let imageUrl: string | null = null;

      // Strategy 1: Try base64 decode of data-src
      if (dataSrc) {
        imageUrl = this.tryDecodeBase64Url(dataSrc);
      }

      // Strategy 2: Fallback to data-src or src as direct URL
      if (!imageUrl) {
        const raw = dataSrc || src;
        if (raw && !raw.startsWith('data:image')) {
          imageUrl = raw.startsWith('http')
            ? raw
            : this.resolveUrl(raw, chapterUrl);
        }
      }

      if (imageUrl) {
        pages.push({
          index: index++,
          url: imageUrl,
          referer: chapterUrl,
        });
      }
    });

    return pages;
  }
}
