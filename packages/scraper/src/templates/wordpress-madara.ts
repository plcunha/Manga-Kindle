/**
 * WordPressMadara Template Connector
 *
 * Server-side TypeScript adaptation of HakuNeko's WordPressMadara template.
 * Covers sites using the Starter Sites / Developer Starter Starter theme
 * (wp-manga plugin by flavor "Starter Starter Developer Theme" / Starter theme).
 *
 * Key differences from HakuNeko:
 * - Uses Cheerio instead of browser DOM (no Electron dependency)
 * - Uses undici fetch (server-side) instead of Engine.Request
 * - 3-tier chapter fetching via sequential fallback
 * - Pages extracted with ?style=list, CDN stripping, webpc-passthru handling
 */
import { BaseConnector } from '../engine/base-connector.js';
import type { Source, MangaInfo, ChapterInfo, PageInfo } from '../index.js';
import type { WPMadaraSiteConfig } from './types.js';

// Default selectors matching stock Starter theme (Starter Starter Developer)
const DEFAULTS = {
  mangaPath: '/manga/',
  queryMangas: 'div.post-title h3 a, div.post-title h5 a',
  queryChapters: 'li.wp-manga-chapter > a',
  queryChaptersTitleBloat: 'span.chapter-release-date, i.c-new-tag',
  queryPlaceholder: '[id^="manga-chapters-holder"][data-id]',
  queryPages: 'div.page-break source, div.page-break img',
  queryTitleForURI: 'head meta[property="og:title"]',
  searchPath: '/',
  querySearchResults: 'div.c-tabs-item__content div.tab-thumb a, div.post-title h3 a',
  querySearchCover: 'img',
  queryCover: 'div.summary_image img',
  querySynopsis: 'div.summary__content p, div.description-summary p',
  postsPerPage: 250,
} as const;

/**
 * Create a connector instance for a WordPressMadara site.
 */
export class WPMadaraConnector extends BaseConnector {
  readonly source: Source;
  private config: Required<
    Pick<
      WPMadaraSiteConfig,
      | 'mangaPath'
      | 'queryMangas'
      | 'queryChapters'
      | 'queryChaptersTitleBloat'
      | 'queryPlaceholder'
      | 'queryPages'
      | 'queryTitleForURI'
      | 'searchPath'
      | 'querySearchResults'
      | 'querySearchCover'
      | 'queryCover'
      | 'querySynopsis'
      | 'postsPerPage'
    >
  > &
    Pick<WPMadaraSiteConfig, 'path' | 'pageExcludes' | 'headers'>;

  constructor(site: WPMadaraSiteConfig) {
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
      path: site.path,
      mangaPath: site.mangaPath ?? DEFAULTS.mangaPath,
      queryMangas: site.queryMangas ?? DEFAULTS.queryMangas,
      queryChapters: site.queryChapters ?? DEFAULTS.queryChapters,
      queryChaptersTitleBloat:
        site.queryChaptersTitleBloat ?? DEFAULTS.queryChaptersTitleBloat,
      queryPlaceholder: site.queryPlaceholder ?? DEFAULTS.queryPlaceholder,
      queryPages: site.queryPages ?? DEFAULTS.queryPages,
      queryTitleForURI: site.queryTitleForURI ?? DEFAULTS.queryTitleForURI,
      searchPath: site.searchPath ?? DEFAULTS.searchPath,
      querySearchResults: site.querySearchResults ?? DEFAULTS.querySearchResults,
      querySearchCover: site.querySearchCover ?? DEFAULTS.querySearchCover,
      queryCover: site.queryCover ?? DEFAULTS.queryCover,
      querySynopsis: site.querySynopsis ?? DEFAULTS.querySynopsis,
      postsPerPage: site.postsPerPage ?? DEFAULTS.postsPerPage,
      pageExcludes: site.pageExcludes,
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

  /**
   * Build form-urlencoded body from an object.
   */
  private buildFormBody(params: Record<string, string | number>): string {
    return Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
  }

  // ─── Search ───────────────────────────────────────────────────────

  async search(query: string): Promise<MangaInfo[]> {
    const searchUrl = new URL(this.config.searchPath, this.baseUrl);
    searchUrl.searchParams.set('s', query);
    searchUrl.searchParams.set('post_type', 'wp-manga');

    const html = await this.fetchText(searchUrl.href, {
      headers: this.config.headers,
    });
    const $ = this.parseHTML(html);

    const results: MangaInfo[] = [];
    const seen = new Set<string>();

    $(this.config.querySearchResults).each((_i, el) => {
      const $el = $(el);
      const href = $el.attr('href');
      if (!href) return;

      const mangaId = this.toRelativeOrAbsolute(href, this.baseUrl);
      if (seen.has(mangaId)) return;
      seen.add(mangaId);

      const title = $el.attr('title') || $el.text().trim();
      const $img = $el.find(this.config.querySearchCover);
      const cover =
        $img.attr('data-lazy-src') ||
        $img.attr('data-src') ||
        $img.attr('srcset')?.split(',')[0]?.split(' ')[0] ||
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

    // Title: try og:title meta first, then h1
    let title = $(this.config.queryTitleForURI).attr('content')?.trim() || '';
    if (!title) {
      title = $('div.post-title h1, h1.entry-title').first().text().trim();
    }
    if (!title) return null;

    const $cover = $(this.config.queryCover).first();
    const cover =
      $cover.attr('data-lazy-src') ||
      $cover.attr('data-src') ||
      $cover.attr('srcset')?.split(',')[0]?.split(' ')[0] ||
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
   * 3-tier chapter fetching:
   * 1. DOM scrape the manga page for li.wp-manga-chapter > a
   * 2. If AJAX placeholder exists → POST to {mangaUrl}ajax/chapters/
   * 3. Fallback → POST to admin-ajax.php with action=manga_get_chapters
   */
  async getChapters(mangaId: string): Promise<ChapterInfo[]> {
    const mangaUrl = this.resolveUrl(mangaId, this.baseUrl);
    const html = await this.fetchText(mangaUrl, {
      headers: this.config.headers,
    });
    const $ = this.parseHTML(html);

    // Tier 1: Try DOM scrape
    let chapters = this.parseChaptersFromDom($, mangaId, mangaUrl);
    if (chapters.length > 0) return chapters;

    // Check if AJAX placeholder exists
    const $placeholder = $(this.config.queryPlaceholder);
    const dataId = $placeholder.attr('data-id');

    if ($placeholder.length > 0) {
      // Tier 2: New AJAX endpoint — POST to {mangaUrl}ajax/chapters/
      const ajaxUrl = mangaUrl.replace(/\/?$/, '/') + 'ajax/chapters/';
      try {
        const ajaxHtml = await this.fetchText(ajaxUrl, {
          method: 'POST',
          headers: {
            ...this.config.headers,
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Requested-With': 'XMLHttpRequest',
            Referer: mangaUrl,
          },
        });
        const $ajax = this.parseHTML(ajaxHtml);
        chapters = this.parseChaptersFromDom($ajax, mangaId, mangaUrl);
        if (chapters.length > 0) return chapters;
      } catch {
        // Tier 2 failed, try Tier 3
      }

      // Tier 3: Old AJAX endpoint — POST to admin-ajax.php
      if (dataId) {
        try {
          const adminUrl = this.baseUrl + '/wp-admin/admin-ajax.php';
          const body = this.buildFormBody({
            action: 'manga_get_chapters',
            manga: dataId,
          });
          const adminHtml = await this.fetchText(adminUrl, {
            method: 'POST',
            body,
            headers: {
              ...this.config.headers,
              'Content-Type': 'application/x-www-form-urlencoded',
              'X-Requested-With': 'XMLHttpRequest',
              Referer: mangaUrl,
            },
          });
          const $admin = this.parseHTML(adminHtml);
          chapters = this.parseChaptersFromDom($admin, mangaId, mangaUrl);
          if (chapters.length > 0) return chapters;
        } catch {
          // All tiers failed
        }
      }
    }

    return chapters;
  }

  /**
   * Parse chapters from a Cheerio document (used by all 3 tiers).
   */
  private parseChaptersFromDom(
    $: ReturnType<typeof this.parseHTML>,
    mangaId: string,
    mangaUrl: string
  ): ChapterInfo[] {
    const chapters: ChapterInfo[] = [];

    $(this.config.queryChapters).each((_i, el) => {
      const $el = $(el);
      const href = $el.attr('href');
      if (!href) return;

      // Remove bloat elements from the chapter title
      const $clone = $el.clone();
      if (this.config.queryChaptersTitleBloat) {
        $clone.find(this.config.queryChaptersTitleBloat).remove();
      }
      const title = $clone.text().trim().replace(/\s+/g, ' ');

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
   * Fetch page images for a chapter.
   * Strategy: Fetch with ?style=list appended, extract images.
   * Fallback: retry without ?style=list (Cloudflare WAF bypass).
   */
  async getPages(chapterId: string): Promise<PageInfo[]> {
    const chapterUrl = this.resolveUrl(chapterId, this.baseUrl);

    // Strategy 1: with ?style=list
    const urlWithStyle = chapterUrl.includes('?')
      ? chapterUrl + '&style=list'
      : chapterUrl + '?style=list';

    let images = await this.extractPageImages(urlWithStyle, chapterUrl);

    // Strategy 2: Fallback without ?style=list (Cloudflare WAF bypass)
    if (!images.length) {
      images = await this.extractPageImages(chapterUrl, chapterUrl);
    }

    return images.map((imgUrl, index) => ({
      index,
      url: imgUrl,
      referer: chapterUrl,
    }));
  }

  /**
   * Extract images from a chapter page.
   */
  private async extractPageImages(
    fetchUrl: string,
    refererUrl: string
  ): Promise<string[]> {
    let html: string;
    try {
      html = await this.fetchText(fetchUrl, {
        headers: {
          ...this.config.headers,
          Referer: refererUrl,
        },
      });
    } catch {
      return [];
    }

    const $ = this.parseHTML(html);
    const images: string[] = [];

    $(this.config.queryPages).each((_i, el) => {
      const $el = $(el);

      // Priority order matching HakuNeko:
      // data-url > data-src > srcset > src
      let src =
        $el.attr('data-url') ||
        $el.attr('data-src') ||
        $el.attr('data-lazy-src') ||
        $el.attr('srcset')?.split(',')[0]?.split(' ')[0] ||
        $el.attr('src');

      if (!src) return;
      src = src.trim();

      // Skip base64 placeholder images
      if (src.startsWith('data:image')) return;

      // Resolve URL
      src = this.resolveUrl(src, fetchUrl);

      // Strip i0.wp.com CDN proxy
      // e.g. https://i0.wp.com/real-domain.com/image.jpg → https://real-domain.com/image.jpg
      src = src.replace(/https?:\/\/i\d+\.wp\.com\//, 'https://');

      // Handle webpc-passthru.php canonical URL extraction
      // e.g. ...webpc-passthru.php?src=https://real.com/img.jpg → https://real.com/img.jpg
      const webpcMatch = src.match(/webpc-passthru\.php\?.*?src=([^&]+)/);
      if (webpcMatch) {
        src = decodeURIComponent(webpcMatch[1]);
      }

      images.push(src);
    });

    // Apply exclusion filters
    let filtered = images;
    if (this.config.pageExcludes?.length) {
      filtered = filtered.filter(
        (img) => !this.config.pageExcludes!.some((rx) => rx.test(img))
      );
    }

    // Filter histats tracking pixels
    filtered = filtered.filter((img) => !img.includes('histats.com'));

    return filtered;
  }
}
