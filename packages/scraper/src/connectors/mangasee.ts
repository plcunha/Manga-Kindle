/**
 * MangaSee Connector
 *
 * NOTE: MangaSee123.com and Manga4Life.com migrated to WeebCentral.com in February 2025.
 * This connector now points to WeebCentral and uses HTMX for search.
 * 
 * CDN: https://temp.compsci88.com/cover/{id}.webp (covers)
 */
import { BaseConnector } from '../engine/base-connector.js';
import { load } from 'cheerio';
import type { Source, MangaInfo, ChapterInfo, PageInfo } from '../index.js';

const BASE_URL = 'https://weebcentral.com';
const CDN_COVER = 'https://temp.compsci88.com/cover';

export class MangaSeeConnector extends BaseConnector {
  readonly source: Source = {
    id: 'mangasee',
    name: 'MangaSee',
    url: BASE_URL,
    language: 'en',
    type: 'manga',
    enabled: true,
  };

  async search(query: string): Promise<MangaInfo[]> {
    const body = new URLSearchParams({ text: query }).toString();
    const html = await this.fetchText(`${BASE_URL}/search/simple?location=main`, {
      method: 'POST',
      headers: {
        'HX-Request': 'true',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    const $ = load(html);
    const results: MangaInfo[] = [];

    $('a.btn.join-item').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      const match = href.match(/\/series\/([^/]+)\//);
      if (!match) return;

      const id = match[1];
      const title = $(el).find('.flex-1').text().trim();
      const coverImg = $(el).find('img').attr('src') || '';
      const coverId = coverImg.match(/cover\/(?:small|fallback)\/([^.]+)\./)?.[1] || id;

      results.push({
        id,
        sourceId: this.source.id,
        title,
        url: `${BASE_URL}${href}`,
        cover: `${CDN_COVER}/small/${coverId}.webp`,
      });
    });

    return results;
  }

  async getManga(seriesId: string): Promise<MangaInfo | null> {
    try {
      const html = await this.fetchText(`${BASE_URL}/series/${seriesId}`);
      const $ = load(html);

      const title = $('h1.text-2xl').first().text().trim() || seriesId;

      let coverId = seriesId;
      const ogImage = $('meta[property="og:image"]').attr('content');
      if (ogImage) {
        const match = ogImage.match(/cover\/(?:small|fallback)\/([^.]+)\./);
        if (match) coverId = match[1];
      }

      const description = $('div.line-clamp-6').first().text().trim() || 
                         $('meta[property="og:description"]').attr('content') || 
                         undefined;

      const authors: string[] = [];
      $('a[href*="/author/"]').each((_, el) => {
        const author = $(el).text().trim();
        if (author) authors.push(author);
      });

      const genres: string[] = [];
      $('a[href*="/tags/"]').each((_, el) => {
        const genre = $(el).text().trim();
        if (genre) genres.push(genre);
      });

      const statusText = $('dt:contains("Status:") + dd').text().trim().toLowerCase();
      const status = this.mapStatus(statusText);

      return {
        id: seriesId,
        sourceId: this.source.id,
        title,
        url: `${BASE_URL}/series/${seriesId}`,
        cover: `${CDN_COVER}/small/${coverId}.webp`,
        synopsis: description,
        authors: authors.length > 0 ? authors : undefined,
        genres: genres.length > 0 ? genres : undefined,
        status,
      };
    } catch {
      return null;
    }
  }

  async getChapters(seriesId: string): Promise<ChapterInfo[]> {
    const html = await this.fetchText(`${BASE_URL}/series/${seriesId}`);
    const $ = load(html);

    const chapters: ChapterInfo[] = [];

    $('li.flex.gap-2').each((_, el) => {
      const a = $(el).find('a[href*="/chapters/"]').first();
      const href = a.attr('href');
      if (!href) return;

      const title = a.text().trim();
      const chapterNum = parseFloat(title.replace(/Chapter\s*/i, '')) || 0;
      const date = $(el).find('time').attr('datetime') || undefined;

      const chapterId = href.match(/\/chapters\/([^/]+)/)?.[1];
      if (!chapterId) return;

      chapters.push({
        id: chapterId,
        mangaId: seriesId,
        title: title || `Chapter ${chapterNum}`,
        number: chapterNum,
        language: 'en',
        url: `${BASE_URL}${href}`,
        date,
      });
    });

    chapters.reverse();
    return chapters;
  }

  async getPages(chapterId: string): Promise<PageInfo[]> {
    const html = await this.fetchText(`${BASE_URL}/chapters/${chapterId}`);
    const $ = load(html);

    const pages: PageInfo[] = [];

    $('img[data-src]').each((i, el) => {
      const src = $(el).attr('data-src');
      if (src && (src.includes('gcdn.co') || src.includes('official-ongoing'))) {
        pages.push({
          index: i,
          url: src,
          referer: BASE_URL,
        });
      }
    });

    if (pages.length === 0) {
      $('img[src]').each((i, el) => {
        const src = $(el).attr('src');
        if (src && (src.includes('gcdn.co') || src.includes('official-ongoing'))) {
          pages.push({
            index: i,
            url: src,
            referer: BASE_URL,
          });
        }
      });
    }

    return pages;
  }

  private mapStatus(s: string): MangaInfo['status'] {
    if (s.includes('ongoing') || s.includes('publishing')) return 'ongoing';
    if (s.includes('finished') || s.includes('complete')) return 'completed';
    if (s.includes('hiatus')) return 'hiatus';
    return 'unknown';
  }
}
