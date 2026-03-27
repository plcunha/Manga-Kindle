/**
 * FlatManga Template Connector
 *
 * Server-side TypeScript adaptation of HakuNeko's FlatManga template.
 * Covers sites using flat AZ manga listings, chapter tables, and
 * base64-encoded image attributes with multiple fallback sources.
 *
 * Key differences from HakuNeko:
 * - Uses Cheerio instead of browser DOM (no Electron dependency)
 * - Uses undici fetch (server-side) instead of Engine.Request
 * - Buffer.from() for base64 decode instead of browser atob()
 * - Multiple data-attribute fallbacks for page image extraction
 */
import { BaseConnector } from '../engine/base-connector.js';
import type { Source, MangaInfo, ChapterInfo, PageInfo } from '../index.js';
import type { FlatMangaSiteConfig } from './types.js';

// Default selectors matching stock FlatManga theme
const DEFAULTS = {
  path: '/manga-list.html?listType=allABC',
  queryMangas: 'span[data-toggle="mangapop"] a',
  queryChapters: 'div#tab-chapper table tr td a.chapter',
  queryPages: 'source.chapter-img, img.chapter-img',
  queryMangaTitle: 'li:last-of-type span[itemprop="name"]',
  queryCover: 'div.manga-info img',
  querySynopsis: 'div.manga-content p',
} as const;

/** Data attributes to try base64 decoding on, in priority order. */
const BASE64_ATTRS = [
  'data-aload',
  'data-src',
  'data-srcset',
  'data-original',
  'data-pagespeed-lazy-src',
] as const;

/** URL fragments that indicate non-content images to filter out. */
const BLACKLISTED_FRAGMENTS = ['3282f6a4b7_o', 'donate'];

/**
 * Attempt to base64-decode a value. Returns the decoded string if it
 * looks like a URL, otherwise returns the raw value.
 */
function tryBase64Decode(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  try {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf-8');
    // Check if the decoded result looks like a URL
    if (decoded.startsWith('http') || decoded.startsWith('/')) {
      return decoded;
    }
  } catch {
    // Decode failed — use raw value
  }

  return trimmed;
}

/**
 * Create a connector instance for a FlatManga site.
 */
export class FlatMangaConnector extends BaseConnector {
  readonly source: Source;
  private config: Required<
    Pick<
      FlatMangaSiteConfig,
      | 'path'
      | 'queryMangas'
      | 'queryChapters'
      | 'queryPages'
      | 'queryMangaTitle'
      | 'queryCover'
      | 'querySynopsis'
    >
  > &
    Pick<FlatMangaSiteConfig, 'headers'>;

  constructor(site: FlatMangaSiteConfig) {
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

  // ─── Search ───────────────────────────────────────────────────────

  async search(query: string): Promise<MangaInfo[]> {
    const lowerQuery = query.toLowerCase();

    // Strategy 1: Try site search endpoint
    try {
      const searchUrl = `${this.baseUrl}/search?q=${encodeURIComponent(query)}`;
      const html = await this.fetchText(searchUrl, {
        headers: this.config.headers,
      });
      const $ = this.parseHTML(html);

      const results: MangaInfo[] = [];
      const seen = new Set<string>();

      $(this.config.queryMangas).each((_i, el) => {
        const $el = $(el);
        const href = $el.attr('href');
        if (!href) return;

        const title = $el.text().trim();
        if (!title) return;

        const mangaId = this.toRelativeOrAbsolute(href, this.baseUrl);
        if (seen.has(mangaId)) return;
        seen.add(mangaId);

        results.push({
          id: mangaId,
          sourceId: this.source.id,
          title,
          url: this.resolveUrl(href, this.baseUrl),
        });
      });

      if (results.length > 0) return results;
    } catch {
      // Search endpoint failed — fall through to full list filtering
    }

    // Strategy 2: Fetch full manga list and filter locally
    const allManga = await this.fetchMangaList();
    return allManga.filter((m) => m.title.toLowerCase().includes(lowerQuery));
  }

  /**
   * Fetch the full manga list from the AZ listing page.
   */
  private async fetchMangaList(): Promise<MangaInfo[]> {
    const listUrl = `${this.baseUrl}${this.config.path}`;
    const html = await this.fetchText(listUrl, {
      headers: this.config.headers,
    });
    const $ = this.parseHTML(html);

    const results: MangaInfo[] = [];
    const seen = new Set<string>();

    $(this.config.queryMangas).each((_i, el) => {
      const $el = $(el);
      const href = $el.attr('href');
      if (!href) return;

      const title = $el.text().trim();
      if (!title) return;

      const mangaId = this.toRelativeOrAbsolute(href, this.baseUrl);
      if (seen.has(mangaId)) return;
      seen.add(mangaId);

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
    const url = this.resolveUrl(mangaId, this.baseUrl);
    const html = await this.fetchText(url, {
      headers: this.config.headers,
    });
    const $ = this.parseHTML(html);

    // Title: try breadcrumb first, then h1
    let title = $(this.config.queryMangaTitle).first().text().trim();
    if (!title) {
      title = $('h1').first().text().trim();
    }
    if (!title) return null;

    // Cover image
    const $cover = $(this.config.queryCover).first();
    const cover =
      $cover.attr('data-src') ||
      $cover.attr('src') ||
      undefined;

    // Synopsis
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

    // Get the manga title for cleaning chapter titles
    let mangaTitle = $(this.config.queryMangaTitle).first().text().trim();
    if (!mangaTitle) {
      mangaTitle = $('h1').first().text().trim();
    }

    const chapters: ChapterInfo[] = [];

    $(this.config.queryChapters).each((_i, el) => {
      const $el = $(el);

      // Some FlatManga sites use data-href concatenated with href
      const dataHref = $el.attr('data-href') ?? '';
      const href = $el.attr('href') ?? '';

      let fullHref: string;
      if (dataHref) {
        // Concatenate data-href + href for the full URL
        fullHref = dataHref + href;
      } else {
        fullHref = href;
      }

      if (!fullHref) return;

      const chapterId = this.toRelativeOrAbsolute(fullHref, this.baseUrl);

      // Chapter title — clean by removing manga title prefix
      let title = $el.text().trim().replace(/\s+/g, ' ');
      if (mangaTitle && title.startsWith(mangaTitle)) {
        title = title.slice(mangaTitle.length).trim();
      }
      // Remove leading separators after prefix removal
      title = title.replace(/^[\s\-:]+/, '').trim();
      if (!title) {
        title = chapterId;
      }

      // Extract chapter number from title
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
        url: this.resolveUrl(fullHref, mangaUrl),
      });
    });

    return chapters;
  }

  // ─── Pages ────────────────────────────────────────────────────────

  async getPages(chapterId: string): Promise<PageInfo[]> {
    const chapterUrl = this.resolveUrl(chapterId, this.baseUrl);
    const html = await this.fetchText(chapterUrl, {
      headers: {
        ...this.config.headers,
        Referer: chapterUrl,
      },
    });
    const $ = this.parseHTML(html);

    const images: string[] = [];

    $(this.config.queryPages).each((_i, el) => {
      const $el = $(el);
      let src: string | undefined;

      // Try base64-encoded data attributes in priority order
      for (const attr of BASE64_ATTRS) {
        const raw = $el.attr(attr);
        if (raw) {
          src = tryBase64Decode(raw);
          if (src) break;
        }
      }

      // Fallback: use src attribute directly (no decode)
      if (!src) {
        src = $el.attr('src')?.trim();
      }

      if (!src) return;

      // Skip base64 placeholder images
      if (src.startsWith('data:image')) return;

      // Filter out blacklisted URL fragments
      const lower = src.toLowerCase();
      if (BLACKLISTED_FRAGMENTS.some((frag) => lower.includes(frag))) return;

      // Resolve URL
      src = this.resolveUrl(src, chapterUrl);

      images.push(src);
    });

    return images.map((imgUrl, index) => ({
      index,
      url: imgUrl,
      referer: chapterUrl,
    }));
  }
}
