import { BaseConnector } from '../engine/base-connector.js';
import { load } from 'cheerio';
import type { MangaInfo, ChapterInfo, PageInfo, Source } from '../index.js';

export class AsuraScansConnector extends BaseConnector {
  readonly source: Source = {
    id: 'asurascans',
    name: 'Asura Scans',
    url: 'https://asurascans.com',
    language: 'en',
    type: 'manga',
    enabled: true,
  };

  private readonly baseUrl = 'https://asurascans.com';

  /**
   * Extract series cards from a browse page using cheerio.
   *
   * AsuraScans uses Astro v5 which embeds data in HTML entities, but the
   * actual <a href="/comics/{slug-hash}"> links with <img alt="Title"> are
   * rendered in the HTML and parseable with cheerio.
   */
  private extractSeriesFromPage(html: string): MangaInfo[] {
    const $ = load(html);
    const results: MangaInfo[] = [];

    $('a[href*="/comics/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      const match = href.match(/\/comics\/([a-z0-9][a-z0-9-]+)/);
      if (!match) return;

      const slugHash = match[1];

      // Get title from img alt attribute (most reliable) or link text
      const title =
        $(el).find('img').attr('alt')?.trim() ||
        $(el).text().trim();
      const cover =
        $(el).find('img').attr('src') ||
        $(el).find('img').attr('data-src') ||
        undefined;

      if (!title || results.some((r) => r.id === slugHash)) return;

      results.push({
        id: slugHash,
        sourceId: this.source.id,
        title,
        url: `${this.baseUrl}/comics/${slugHash}`,
        cover,
        status: 'unknown',
      });
    });

    return results;
  }

  async search(query: string): Promise<MangaInfo[]> {
    // AsuraScans supports server-side search via browse?q= parameter
    const searchUrl = query
      ? `${this.baseUrl}/browse?q=${encodeURIComponent(query)}`
      : `${this.baseUrl}/browse`;

    const html = await this.fetchText(searchUrl);
    return this.extractSeriesFromPage(html);
  }

  async getManga(id: string): Promise<MangaInfo | null> {
    const url = `${this.baseUrl}/comics/${id}`;

    let html: string;
    try {
      html = await this.fetchText(url);
    } catch (err: unknown) {
      // Only swallow 404 — re-throw network / rate-limit / 5xx errors
      if (err instanceof Error && 'status' in err && (err as { status: number }).status === 404) {
        return null;
      }
      throw err;
    }

    const $ = load(html);

    const title = $('h1').first().text().trim();
    if (!title) return null;

    const description =
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      '';

    const cover =
      $('meta[property="og:image"]').attr('content') ||
      '';

    // Extract genres from browse-style links
    const genres: string[] = [];
    $('a[href*="/browse?genres="]').each((_, el) => {
      const genre = $(el).text().trim();
      if (genre) genres.push(genre);
    });

    return {
      id,
      sourceId: this.source.id,
      title,
      url,
      cover: cover || undefined,
      synopsis: description ? this.cleanHtml(description) : undefined,
      genres: genres.length > 0 ? genres : undefined,
    };
  }

  async getChapters(mangaId: string): Promise<ChapterInfo[]> {
    const html = await this.fetchText(`${this.baseUrl}/comics/${mangaId}`);
    const $ = load(html);
    const chapters: ChapterInfo[] = [];
    const seen = new Set<number>();

    // Select chapter links — format: /comics/{slug-hash}/chapter/{num}
    $('a[href*="/chapter/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      const numMatch = href.match(/\/chapter\/(\d+)/);
      if (!numMatch) return;

      const chapterNum = parseFloat(numMatch[1]);
      // Skip duplicate chapter numbers (the page has "First Chapter" / "Latest Chapter" links)
      if (seen.has(chapterNum)) return;
      seen.add(chapterNum);

      const rawText = $(el).text().trim();
      // Clean up text like "Chapter 2Jul 26, 2022" → "Chapter 2"
      const chapterTitle =
        rawText
          .replace(
            /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s*\d{4}.*$/,
            '',
          )
          .trim() || `Chapter ${chapterNum}`;

      // Extract date if embedded in the text
      const dateMatch = rawText.match(
        /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s*\d{4})/,
      );

      chapters.push({
        id: href.startsWith('/') ? href : `/${href}`,
        mangaId,
        title: chapterTitle,
        number: chapterNum,
        language: 'en',
        url: `${this.baseUrl}${href.startsWith('/') ? href : `/${href}`}`,
        date: dateMatch ? dateMatch[1] : undefined,
      });
    });

    // Sort descending (newest first)
    chapters.sort((a, b) => b.number - a.number);
    return chapters;
  }

  async getPages(chapterId: string): Promise<PageInfo[]> {
    // chapterId is a path like /comics/{slug-hash}/chapter/{num}
    const url = chapterId.startsWith('http')
      ? chapterId
      : `${this.baseUrl}${chapterId}`;
    const html = await this.fetchText(url);

    // AsuraScans embeds chapter images inside Astro serialization in the HTML.
    // Standard cheerio <img> parsing only finds ~2 visible images.
    // The real image URLs are in the raw HTML matching the CDN pattern:
    //   https://cdn.asurascans.com/asura-images/chapters/{slug}/{chapter}/{filename}.webp
    const imageRegex =
      /https?:\/\/cdn\.asurascans\.com\/asura-images\/chapters\/[^\s"'&<>]+\.(?:webp|jpg|png|jpeg)/gi;
    const matches = html.match(imageRegex) || [];

    // Deduplicate and preserve order
    const uniqueUrls = [...new Set(matches)];

    // Sort by filename to ensure correct page order (001.webp, 002.webp, ...)
    uniqueUrls.sort((a, b) => {
      const fileA = a.split('/').pop() || '';
      const fileB = b.split('/').pop() || '';
      return fileA.localeCompare(fileB, undefined, { numeric: true });
    });

    return uniqueUrls.map((imgUrl, index) => ({
      index,
      url: imgUrl,
      referer: url,
    }));
  }

  private cleanHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }
}
