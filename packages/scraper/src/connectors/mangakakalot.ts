/**
 * MangaKakalot Connector
 *
 * Based on HakuNeko's MangaNel / MangaKakalot pattern.
 * MangaKakalot (.gg) and Manganato (.gg) share the same HTML structure
 * (both inherit from MangaNel in HakuNeko).
 *
 * Key notes:
 *   - Primary domain: https://www.mangakakalot.gg
 *   - Sister domain:  https://www.manganato.gg
 *   - Page images use <source data-src="..."> (lazy-loaded), NOT <img src="...">
 *   - Image CDNs include: https://v*.mkklcdnv6tempv5.com
 *
 * Reference: https://github.com/manga-download/hakuneko/blob/master/src/web/mjs/connectors/MangaNel.mjs
 */
import { BaseConnector } from '../engine/base-connector.js';
import type { Source, MangaInfo, ChapterInfo, PageInfo } from '../index.js';

const BASE_URL = 'https://www.mangakakalot.gg';
const SEARCH_URL = `${BASE_URL}/search/story`;
// Manganato is a sister domain that shares content (same HTML structure)
const ALT_BASE = 'https://www.manganato.gg';

export class MangaKakalotConnector extends BaseConnector {
  readonly source: Source = {
    id: 'mangakakalot',
    name: 'MangaKakalot',
    url: BASE_URL,
    language: 'en',
    type: 'manga',
    enabled: true,
  };

  async search(query: string): Promise<MangaInfo[]> {
    // MangaKakalot search expects underscores for spaces
    const encodedQuery = query.trim().replace(/\s+/g, '_');
    const html = await this.fetchText(`${SEARCH_URL}/${encodeURIComponent(encodedQuery)}`);
    const $ = this.parseHTML(html);

    const results: MangaInfo[] = [];

    $('div.story_item').each((_i, el) => {
      const $el = $(el);
      const $link = $el.find('h3 a').first();
      const title = $link.text().trim();
      const url = $link.attr('href') || '';
      const cover = $el.find('img').attr('src') || undefined;

      // Extract manga ID from URL
      const id = this.extractMangaId(url);
      if (!id || !title) return;

      // Authors from the "Author(s)" row
      const authors: string[] = [];
      $el.find('span:contains("Author")').next().find('a').each((_j, aEl) => {
        const name = $(aEl).text().trim();
        if (name) authors.push(name);
      });

      results.push({
        id,
        sourceId: this.source.id,
        title,
        url: this.normalizeUrl(url),
        cover,
        authors: authors.length > 0 ? authors : undefined,
        status: 'unknown',
      });
    });

    // Also try the panel_story_list format (newer layout)
    if (results.length === 0) {
      $('div.search-story-item, div.list-truyen-item-wrap').each((_i, el) => {
        const $el = $(el);
        const $link = $el.find('a.item-title, h3 a, a.item-img').first();
        const title = $link.text().trim() || $el.find('img').attr('alt')?.trim() || '';
        const url = $link.attr('href') || '';
        const cover = $el.find('img').attr('src') || undefined;

        const id = this.extractMangaId(url);
        if (!id || !title) return;

        results.push({
          id,
          sourceId: this.source.id,
          title,
          url: this.normalizeUrl(url),
          cover,
          status: 'unknown',
        });
      });
    }

    return results.slice(0, 30);
  }

  async getManga(mangaId: string): Promise<MangaInfo | null> {
    const url = this.buildMangaUrl(mangaId);

    try {
      const html = await this.fetchText(url);
      const $ = this.parseHTML(html);

      // Two possible layouts depending on the domain
      const isManganato = url.includes('manganato');

      let title: string;
      let synopsis: string | undefined;
      let cover: string | undefined;
      const authors: string[] = [];
      const genres: string[] = [];
      let status: MangaInfo['status'] = 'unknown';

      if (isManganato) {
        // Manganato layout
        title = $('div.story-info-right h1').text().trim() ||
                $('div.panel-story-info .story-info-right h1').text().trim() || mangaId;
        cover = $('span.info-image img').attr('src') || undefined;
        synopsis = $('div.panel-story-info-description').text().replace('Description :', '').trim() || undefined;

        $('td.table-label:contains("Author") + td a, ' +
          'li:contains("Author") a').each((_i, el) => {
          const name = $(el).text().trim();
          if (name && name !== '-') authors.push(name);
        });

        $('td.table-label:contains("Genre") + td a, ' +
          'li:contains("Genres") a').each((_i, el) => {
          const genre = $(el).text().trim();
          if (genre) genres.push(genre);
        });

        const statusText = $('td.table-label:contains("Status") + td, ' +
                             'li:contains("Status") a').first().text().trim().toLowerCase();
        status = this.mapStatus(statusText);
      } else {
        // MangaKakalot layout
        title = $('ul.manga-info-text li h1, h1').first().text().trim() || mangaId;
        cover = $('div.manga-info-pic img').attr('src') || undefined;
        synopsis = $('div#noidungm, div#panel-story-info-description').text().trim() || undefined;

        $('ul.manga-info-text li:contains("Author") a').each((_i, el) => {
          const name = $(el).text().trim();
          if (name && name !== '-') authors.push(name);
        });

        $('ul.manga-info-text li:contains("Genres") a').each((_i, el) => {
          const genre = $(el).text().trim();
          if (genre) genres.push(genre);
        });

        const statusText = $('ul.manga-info-text li:contains("Status")').text().toLowerCase();
        status = this.mapStatus(statusText);
      }

      return {
        id: mangaId,
        sourceId: this.source.id,
        title,
        url,
        cover,
        synopsis,
        authors: authors.length > 0 ? authors : undefined,
        genres: genres.length > 0 ? genres : undefined,
        status,
      };
    } catch {
      return null;
    }
  }

  async getChapters(mangaId: string): Promise<ChapterInfo[]> {
    const url = this.buildMangaUrl(mangaId);
    const html = await this.fetchText(url);
    const $ = this.parseHTML(html);

    const chapters: ChapterInfo[] = [];

    // Try all known chapter list selectors (HakuNeko uses: 'div.chapter-list div.row span a')
    const chapterLinks = $('div.chapter-list div.row span a, ' +
                          'ul.row-content-chapter li a, ' +
                          'div.panel-story-chapter-list li a');

    chapterLinks.each((_i, el) => {
      const $el = $(el);
      const chapterUrl = $el.attr('href') || '';
      const chapterTitle = $el.text().trim();

      if (!chapterUrl) return;

      // Try to extract chapter number from the title or URL
      const numMatch = chapterTitle.match(/chapter\s+([\d.]+)/i)
        || chapterUrl.match(/chapter[_-]([\d.]+)/i);
      const num = numMatch ? parseFloat(numMatch[1]) : 0;

      // Extract a chapter ID from the URL
      const chapterId = this.extractChapterId(chapterUrl);

      // Get date from sibling element
      const $parent = $el.closest('li, div.row');
      const dateText = $parent.find('span[title], span.chapter-time').attr('title')
        || $parent.find('span:last-child').text().trim()
        || '';

      chapters.push({
        id: chapterId || chapterUrl,
        mangaId,
        title: chapterTitle || `Chapter ${num}`,
        number: num,
        language: 'en',
        url: this.normalizeUrl(chapterUrl),
        date: dateText || undefined,
      });
    });

    // Reverse to get ascending order (MangaKakalot lists newest first)
    chapters.reverse();
    return chapters;
  }

  async getPages(chapterId: string): Promise<PageInfo[]> {
    // chapterId could be a full URL or a path-like ID
    const url = chapterId.startsWith('http') ? chapterId : `${BASE_URL}/${chapterId}`;

    const html = await this.fetchText(url);
    const $ = this.parseHTML(html);

    const pages: PageInfo[] = [];

    // HakuNeko uses: 'div.container-chapter-reader source' with dataset['src'] (data-src)
    // These sites lazy-load images via <source data-src="..."> or <img data-src="...">
    // We try: 1) <source data-src>, 2) <img data-src>, 3) <img src> as fallback
    $('div.container-chapter-reader source, div#vungdoc source, div.container-chapter-reader img, div#vungdoc img').each((i, el) => {
      // Prefer data-src (lazy-loaded actual URL), fall back to src
      const src = $(el).attr('data-src')?.trim() || $(el).attr('src')?.trim();
      if (!src || !src.startsWith('http')) return;

      // Skip non-manga images (ads, banners, logos)
      if (src.includes('ads') || src.includes('banner') || src.includes('logo')) return;

      // Deduplicate: <source> and <img> may have the same URL in a <picture> element
      if (pages.some((p) => p.url === src)) return;

      pages.push({
        index: i,
        url: src,
        referer: url, // Use the chapter page URL as referer (matches HakuNeko's request.url)
      });
    });

    // Re-index sequentially
    pages.forEach((p, idx) => { p.index = idx; });

    return pages;
  }

  // --- Helpers ---

  private extractMangaId(url: string): string | null {
    // mangakakalot.gg/manga/slug or mangakakalot.com/manga/slug → slug
    const mkMatch = url.match(/mangakakalot\.(?:gg|com)\/manga\/([^/?]+)/);
    if (mkMatch) return `mk:${mkMatch[1]}`;

    // manganato.gg/manga-{id} or chapmanganato.to/manga-{id} → manga-{id}
    const mnMatch = url.match(/(?:chapmanganato|manganato)\.(?:gg|to|com)\/(manga-[^/?]+)/);
    if (mnMatch) return `mn:${mnMatch[1]}`;

    // read.mangakakalot slug
    const readMatch = url.match(/\/read-([^/?]+)/);
    if (readMatch) return `mk:${readMatch[1]}`;

    return null;
  }

  private buildMangaUrl(mangaId: string): string {
    if (mangaId.startsWith('mn:')) {
      return `${ALT_BASE}/${mangaId.slice(3)}`;
    }
    if (mangaId.startsWith('mk:')) {
      return `${BASE_URL}/manga/${mangaId.slice(3)}`;
    }
    // Fallback: assume it's a MangaKakalot slug
    return `${BASE_URL}/manga/${mangaId}`;
  }

  private extractChapterId(url: string): string {
    // Use the full URL as the chapter ID so getPages can use it directly
    return url;
  }

  private normalizeUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    if (url.startsWith('//')) return `https:${url}`;
    if (url.startsWith('/')) return `${BASE_URL}${url}`;
    return url;
  }

  private mapStatus(text: string): MangaInfo['status'] {
    if (text.includes('ongoing')) return 'ongoing';
    if (text.includes('completed') || text.includes('finished')) return 'completed';
    if (text.includes('hiatus')) return 'hiatus';
    return 'unknown';
  }
}
