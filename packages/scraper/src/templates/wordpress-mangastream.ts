/**
 * WordPressMangastream Template Connector
 *
 * Server-side TypeScript adaptation of HakuNeko's WordPressMangastream template.
 * Covers sites using the Themesia MangaStream WordPress theme.
 *
 * Key differences from HakuNeko:
 * - Uses Cheerio instead of browser DOM (no Electron dependency)
 * - Extracts ts_reader JSON from <script> tags via regex (no fetchUI)
 * - Falls back to Cheerio image queries when ts_reader is unavailable
 */
import { BaseConnector } from '../engine/base-connector.js';
import type { Source, MangaInfo, ChapterInfo, PageInfo } from '../index.js';
import type { WPMangastreamSiteConfig } from './types.js';

// Default selectors matching the stock Themesia MangaStream theme
const DEFAULTS = {
  path: '/manga/list-mode/',
  queryMangas: 'div.soralist ul li a.series',
  queryChapters: 'div#chapterlist ul li div.eph-num a, div#chapterlist ul li a',
  queryChaptersTitle: 'span.chapternum',
  queryPages: 'div#readerarea img[src]:not([src=""])',
  queryMangaTitle: 'div#content div.postbody article h1, div.seriestuheader h1',
  searchPath: '/',
  querySearchResults: 'div.bsx a, div.bs a',
  querySearchCover: 'img',
  queryCover: 'div.thumb img, div.seriestucontent img',
  querySynopsis: 'div.entry-content p, div.synp p, div[itemprop="description"] p',
} as const;

/**
 * Create a connector instance for a WordPressMangastream site.
 */
export class WPMangastreamConnector extends BaseConnector {
  readonly source: Source;
  private config: Required<
    Pick<
      WPMangastreamSiteConfig,
      | 'path'
      | 'queryMangas'
      | 'queryChapters'
      | 'queryChaptersTitle'
      | 'queryPages'
      | 'queryMangaTitle'
      | 'searchPath'
      | 'querySearchResults'
      | 'querySearchCover'
      | 'queryCover'
      | 'querySynopsis'
    >
  > &
    Pick<WPMangastreamSiteConfig, 'pageExcludes' | 'headers'>;

  constructor(site: WPMangastreamSiteConfig) {
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
      queryChaptersTitle: site.queryChaptersTitle ?? DEFAULTS.queryChaptersTitle,
      queryPages: site.queryPages ?? DEFAULTS.queryPages,
      queryMangaTitle: site.queryMangaTitle ?? DEFAULTS.queryMangaTitle,
      searchPath: site.searchPath ?? DEFAULTS.searchPath,
      querySearchResults: site.querySearchResults ?? DEFAULTS.querySearchResults,
      querySearchCover: site.querySearchCover ?? DEFAULTS.querySearchCover,
      queryCover: site.queryCover ?? DEFAULTS.queryCover,
      querySynopsis: site.querySynopsis ?? DEFAULTS.querySynopsis,
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

  // ─── Search ───────────────────────────────────────────────────────

  async search(query: string): Promise<MangaInfo[]> {
    const searchUrl = new URL(this.config.searchPath, this.baseUrl);
    searchUrl.searchParams.set('s', query);

    const html = await this.fetchText(searchUrl.href, {
      headers: this.config.headers,
    });
    const $ = this.parseHTML(html);

    const results: MangaInfo[] = [];

    $(this.config.querySearchResults).each((_i, el) => {
      const $el = $(el);
      const href = $el.attr('href');
      if (!href) return;

      const title = $el.attr('title') || $el.text().trim();
      const $img = $el.find(this.config.querySearchCover);
      const cover =
        $img.attr('data-lazy-src') ||
        $img.attr('data-src') ||
        $img.attr('src') ||
        undefined;

      const mangaId = this.toRelativeOrAbsolute(href, this.baseUrl);

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
      $cover.attr('data-lazy-src') ||
      $cover.attr('data-src') ||
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

  async getChapters(mangaId: string): Promise<ChapterInfo[]> {
    const url = this.resolveUrl(mangaId, this.baseUrl);
    const html = await this.fetchText(url, {
      headers: this.config.headers,
    });
    const $ = this.parseHTML(html);

    const chapters: ChapterInfo[] = [];

    $(this.config.queryChapters).each((_i, el) => {
      const $el = $(el);
      const href = $el.attr('href');
      if (!href) return;

      let title: string;
      const $title = $el.find(this.config.queryChaptersTitle);
      title = $title.length ? $title.text().trim() : $el.text().trim();

      const chapterId = this.toRelativeOrAbsolute(href, this.baseUrl);

      // Try to extract chapter number from title
      const numMatch = title.match(/(?:ch(?:apter)?\.?\s*|#)(\d+(?:\.\d+)?)/i);
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

  async getPages(chapterId: string): Promise<PageInfo[]> {
    const url = this.resolveUrl(chapterId, this.baseUrl);
    const html = await this.fetchText(url, {
      headers: this.config.headers,
    });

    // Strategy 1: Extract from ts_reader.params.sources (embedded JSON)
    // This is HakuNeko's primary method - the data is in a <script> tag
    let images = this.extractTsReaderImages(html);

    // Strategy 2: Fallback to Cheerio image query
    if (!images.length) {
      images = this.extractImagesFromDom(html, url);
    }

    // Filter out ad/banner images
    if (this.config.pageExcludes?.length) {
      images = images.filter(
        (img) => !this.config.pageExcludes!.some((rx) => rx.test(img))
      );
    }

    // Strip i0.wp.com CDN proxy (matches HakuNeko behavior)
    images = images.map((img) => img.replace(/\/i\d+\.wp\.com/, ''));

    // Filter histats tracking pixels
    images = images.filter((img) => !img.includes('histats.com'));

    return images.map((imgUrl, index) => ({
      index,
      url: imgUrl,
      referer: url,
    }));
  }

  /**
   * Extract image URLs from ts_reader JSON embedded in the HTML.
   *
   * The Themesia MangaStream theme embeds reader data as:
   *   ts_reader.run({ "sources": [{ "images": [...] }] })
   *
   * or as a JSON assignment:
   *   "sources": [{ "images": [...] }]
   */
  private extractTsReaderImages(html: string): string[] {
    // Pattern 1: ts_reader.run({...}) call
    const tsRunMatch = html.match(/ts_reader\.run\((\{[^}]+("sources"\s*:\s*\[[\s\S]*?\])\s*\})\)/);
    if (tsRunMatch) {
      try {
        const data = JSON.parse(tsRunMatch[1]);
        if (data.sources?.[0]?.images) {
          return data.sources[0].images;
        }
      } catch {
        // JSON parse failed, try next pattern
      }
    }

    // Pattern 2: "sources":[{...images...}] anywhere in HTML
    const sourcesMatch = html.match(/"sources"\s*:\s*(\[\s*\{[\s\S]*?"images"\s*:\s*\[[\s\S]*?\]\s*\}\s*\])/);
    if (sourcesMatch) {
      try {
        const sources = JSON.parse(sourcesMatch[1]);
        if (sources[0]?.images) {
          return sources[0].images;
        }
      } catch {
        // JSON parse failed, fall through
      }
    }

    return [];
  }

  /**
   * Extract image URLs from the page DOM using Cheerio.
   */
  private extractImagesFromDom(html: string, pageUrl: string): string[] {
    const $ = this.parseHTML(html);
    const images: string[] = [];

    $(this.config.queryPages).each((_i, el) => {
      const $el = $(el);
      const src =
        $el.attr('data-lazy-src') ||
        $el.attr('data-src') ||
        $el.attr('original') ||
        $el.attr('src');

      if (src) {
        images.push(this.resolveUrl(src, pageUrl));
      }
    });

    return images;
  }
}
