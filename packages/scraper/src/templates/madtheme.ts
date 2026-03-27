/**
 * MadTheme Template Connector
 *
 * Server-side TypeScript adaptation of HakuNeko's MadTheme template.
 * Covers sites using the MadTheme manga CMS (MangaBuddy, MangaForest, etc.).
 *
 * Key differences from HakuNeko:
 * - Uses Cheerio instead of browser DOM (no Electron dependency)
 * - Uses undici fetch (server-side) instead of Engine.Request
 * - Pages extracted via regex on window.chapImages / window.mainServer
 *   instead of fetchUI (no headless browser needed)
 */
import { BaseConnector } from '../engine/base-connector.js';
import type { Source, MangaInfo, ChapterInfo, PageInfo } from '../index.js';
import type { MadThemeSiteConfig } from './types.js';

// Default selectors matching stock MadTheme
const DEFAULTS = {
  path: '/az-list',
  queryMangas: 'div.book-detailed-item div.thumb a',
  queryMangaTitle: 'div.name.box h1',
  queryChapterTitle: 'strong.chapter-title',
  queryCover: 'div.summary-image img',
  querySynopsis: 'div.summary p, div.section-body p',
} as const;

/**
 * Create a connector instance for a MadTheme site.
 */
export class MadThemeConnector extends BaseConnector {
  readonly source: Source;
  private config: Required<
    Pick<
      MadThemeSiteConfig,
      | 'path'
      | 'queryMangas'
      | 'queryMangaTitle'
      | 'queryChapterTitle'
      | 'queryCover'
      | 'querySynopsis'
    >
  > &
    Pick<MadThemeSiteConfig, 'headers'>;

  constructor(site: MadThemeSiteConfig) {
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
      queryMangaTitle: site.queryMangaTitle ?? DEFAULTS.queryMangaTitle,
      queryChapterTitle: site.queryChapterTitle ?? DEFAULTS.queryChapterTitle,
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
    const searchUrl = new URL('/search', this.baseUrl);
    searchUrl.searchParams.set('q', query);

    const html = await this.fetchText(searchUrl.href, {
      headers: this.config.headers,
    });
    const $ = this.parseHTML(html);

    const results: MangaInfo[] = [];
    const seen = new Set<string>();

    $('div.book-detailed-item').each((_i, el) => {
      const $el = $(el);
      const $link = $el.find('div.thumb a').first();
      const href = $link.attr('href');
      if (!href) return;

      const mangaId = this.toRelativeOrAbsolute(href, this.baseUrl);
      if (seen.has(mangaId)) return;
      seen.add(mangaId);

      const title = $link.attr('title') || $link.text().trim();
      const $img = $el.find('img').first();
      const cover =
        $img.attr('data-src') ||
        $img.attr('data-lazy-src') ||
        $img.attr('src') ||
        undefined;

      results.push({
        id: mangaId,
        sourceId: this.source.id,
        title,
        url: this.resolveUrl(href, this.baseUrl),
        cover: cover ? this.resolveUrl(cover, this.baseUrl) : undefined,
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

    const title = $(this.config.queryMangaTitle).first().text().trim();
    if (!title) return null;

    const $cover = $(this.config.queryCover).first();
    const cover =
      $cover.attr('data-src') ||
      $cover.attr('data-lazy-src') ||
      $cover.attr('src') ||
      undefined;

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

  /**
   * Fetch chapters via the MadTheme API endpoint.
   * Endpoint: /api/manga/{slug}/chapters?source=detail
   * Returns an HTML fragment with <a> elements for each chapter.
   */
  async getChapters(mangaId: string): Promise<ChapterInfo[]> {
    // Extract slug from mangaId (last non-empty path segment)
    const slug = mangaId
      .replace(/\/+$/, '')
      .split('/')
      .filter(Boolean)
      .pop();
    if (!slug) return [];

    const apiUrl = `${this.baseUrl}/api/manga/${slug}/chapters?source=detail`;
    let html: string;
    try {
      html = await this.fetchText(apiUrl, {
        headers: {
          ...this.config.headers,
          'X-Requested-With': 'XMLHttpRequest',
          Referer: this.resolveUrl(mangaId, this.baseUrl),
        },
      });
    } catch {
      return [];
    }

    const $ = this.parseHTML(html);
    const chapters: ChapterInfo[] = [];

    $('a').each((_i, el) => {
      const $el = $(el);
      const href = $el.attr('href');
      if (!href) return;

      const chapterId = this.toRelativeOrAbsolute(href, this.baseUrl);

      // Extract title from strong.chapter-title or fall back to link text
      const $title = $el.find(this.config.queryChapterTitle);
      const title = $title.length
        ? $title.text().trim()
        : $el.text().trim().replace(/\s+/g, ' ');

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
        url: this.resolveUrl(href, this.baseUrl),
      });
    });

    return chapters;
  }

  // ─── Pages ────────────────────────────────────────────────────────

  /**
   * Fetch page images for a chapter.
   *
   * MadTheme stores images in JS variables:
   *   var defined_url = 'img1.jpg,img2.jpg,...'   (or window.chapImages)
   *   var defined_server = 'https://cdn.example.com/'  (or window.mainServer)
   *
   * We extract these via regex and combine server + each image path.
   */
  async getPages(chapterId: string): Promise<PageInfo[]> {
    const chapterUrl = this.resolveUrl(chapterId, this.baseUrl);
    const html = await this.fetchText(chapterUrl, {
      headers: this.config.headers,
    });

    // Extract image list: var defined_url = '...' or window.chapImages = '...'
    const imagesMatch = html.match(
      /(?:var\s+defined_url|window\.chapImages)\s*=\s*'([^']+)'/
    );
    if (!imagesMatch?.[1]) return [];

    const imagePaths = imagesMatch[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    // Extract CDN server: var defined_server = '...' or window.mainServer = '...'
    const serverMatch = html.match(
      /(?:var\s+defined_server|window\.mainServer)\s*=\s*'([^']*)'/
    );
    const server = serverMatch?.[1]?.trim() ?? '';

    const pages: PageInfo[] = imagePaths.map((imgPath, index) => {
      // If server is present, prefix it; otherwise treat as absolute URL
      let url: string;
      if (server) {
        // Ensure no double slashes between server and path
        const base = server.replace(/\/+$/, '');
        const path = imgPath.replace(/^\/+/, '');
        url = `${base}/${path}`;
      } else {
        url = this.resolveUrl(imgPath, chapterUrl);
      }

      return {
        index,
        url,
        referer: chapterUrl,
      };
    });

    return pages;
  }
}
