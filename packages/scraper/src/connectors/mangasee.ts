/**
 * MangaSee Connector (WeebCentral)
 *
 * NOTE: MangaSee123.com and Manga4Life.com migrated to WeebCentral.com in February 2025.
 * This connector now points to WeebCentral.
 *
 * Key endpoints:
 *   - Search: POST /search/simple?location=main  (HTMX, returns HTML)
 *   - Series: GET /series/{id}/{slug}
 *   - Full chapter list: GET /series/{id}/full-chapter-list
 *   - Chapter images: GET /chapters/{id}/images?reading_style=long_strip&is_prev=False&current_page=1  (HTMX)
 *
 * CDN domains:
 *   - Covers: https://temp.compsci88.com/cover/{size}/{id}.webp
 *   - Pages:  https://hot.planeptune.us/manga/{title}/{chapter}-{page}.png
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

      // Full URL: https://weebcentral.com/series/{ULID}/{Slug}
      const match = href.match(/\/series\/([^/]+)/);
      if (!match) return;

      const id = match[1];
      const title = $(el).find('.flex-1').text().trim();

      // Cover: <source srcset="...small/{id}.webp"> or <img src="...fallback/{id}.jpg">
      const coverSrc = $(el).find('source').attr('srcset') || $(el).find('img').attr('src') || '';
      const coverId = coverSrc.match(/cover\/(?:small|fallback)\/([^.]+)\./)?.[1] || id;

      results.push({
        id,
        sourceId: this.source.id,
        title,
        url: href.startsWith('http') ? href : `${BASE_URL}${href}`,
        cover: `${CDN_COVER}/small/${coverId}.webp`,
      });
    });

    return results;
  }

  async getManga(seriesId: string): Promise<MangaInfo | null> {
    try {
      const html = await this.fetchText(`${BASE_URL}/series/${seriesId}`);
      const $ = load(html);

      const title = $('h1').first().text().trim() || seriesId;

      // Cover from og:image or fallback
      let coverId = seriesId;
      const ogImage = $('meta[property="og:image"]').attr('content');
      if (ogImage) {
        const match = ogImage.match(/cover\/(?:small|fallback)\/([^.]+)\./);
        if (match) coverId = match[1];
      }

      // Description: og:description is the most reliable; series page has no visible description block
      const description = $('meta[property="og:description"]').attr('content') || undefined;

      // Authors and tags return 0 on series page (loaded via JS/HTMX).
      // We skip them rather than returning wrong data.

      return {
        id: seriesId,
        sourceId: this.source.id,
        title,
        url: `${BASE_URL}/series/${seriesId}`,
        cover: `${CDN_COVER}/small/${coverId}.webp`,
        synopsis: description,
        status: 'unknown',
      };
    } catch (err: unknown) {
      // Only swallow 404 (series not found). Re-throw network/5xx errors.
      if (err instanceof Error && 'status' in err && (err as { status: number }).status === 404) {
        return null;
      }
      throw err;
    }
  }

  async getChapters(seriesId: string): Promise<ChapterInfo[]> {
    // The series page only shows ~9 chapters. The full list is at /full-chapter-list.
    const html = await this.fetchText(`${BASE_URL}/series/${seriesId}/full-chapter-list`);
    const $ = load(html);

    const chapters: ChapterInfo[] = [];

    $('a[href*="/chapters/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      const chapterId = href.match(/\/chapters\/([^/]+)/)?.[1];
      if (!chapterId) return;

      // Text is like "Chapter 200 \n ... \n Last Read" — extract the number
      const rawText = $(el).text().trim();
      const numMatch = rawText.match(/Chapter\s+([\d.]+)/i);
      const chapterNum = numMatch ? parseFloat(numMatch[1]) : 0;

      chapters.push({
        id: chapterId,
        mangaId: seriesId,
        title: `Chapter ${chapterNum || '?'}`,
        number: chapterNum,
        language: 'en',
        url: href.startsWith('http') ? href : `${BASE_URL}${href}`,
      });
    });

    // WeebCentral lists newest first, reverse to ascending
    chapters.reverse();
    return chapters;
  }

  async getPages(chapterId: string): Promise<PageInfo[]> {
    // Images are loaded via HTMX: GET /chapters/{id}/images?reading_style=long_strip&is_prev=False&current_page=1
    const url = `${BASE_URL}/chapters/${chapterId}/images?reading_style=long_strip&is_prev=False&current_page=1`;
    const html = await this.fetchText(url, {
      headers: {
        'HX-Request': 'true',
        'HX-Current-URL': `${BASE_URL}/chapters/${chapterId}`,
      },
    });

    const $ = load(html);
    const pages: PageInfo[] = [];

    $('img').each((i, el) => {
      const src = $(el).attr('src');
      if (!src || !src.startsWith('http')) return;
      // Skip site UI images
      if (src.includes('/static/') || src.includes('brand') || src.includes('logo')) return;

      pages.push({
        index: pages.length,
        url: src,
        referer: BASE_URL,
      });
    });

    return pages;
  }
}
