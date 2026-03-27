/**
 * MangaSee / MangaLife Connector
 *
 * MangaSee123.com uses server-side rendered HTML with an embedded JSON blob
 * (vm.Directory) containing the full manga database. Search is done client-side
 * by filtering this directory. Chapters and page images use predictable URL patterns.
 *
 * CDN: https://temp.compsci88.com/cover/{slug}.jpg (covers)
 * Images: https://official-ongoing-2.gcdn.co/manga/{slug}/{chapter}-{page}.png
 */
import { BaseConnector } from '../engine/base-connector.js';
import type { Source, MangaInfo, ChapterInfo, PageInfo } from '../index.js';

const BASE_URL = 'https://mangasee123.com';
const CDN_COVER = 'https://temp.compsci88.com/cover';
const CDN_IMAGE = 'https://official-ongoing-2.gcdn.co/manga';

interface DirectoryEntry {
  /** Internal slug like "Chainsaw-Man" */
  i: string;
  /** Display title */
  s: string;
  /** Official title (sometimes empty) */
  o?: string;
  /** Alternate names (array of strings) */
  al?: string[];
  /** Author(s) */
  a?: string[];
  /** Genre(s) */
  g?: string[];
  /** Status string — e.g. "Ongoing", "Complete" */
  ss?: string;
  /** Publication status */
  ps?: string;
  /** Latest chapter number string */
  lt?: number;
  /** Year */
  y?: string;
  /** Hot/trending flag */
  h?: string;
  /** Last updated timestamp */
  ls?: string;
  /** Type — "Manga", "Manhwa", etc. */
  t?: string;
  /** View count */
  v?: string;
  /** VM type */
  vm?: string;
}

interface ChapterEntry {
  /** Chapter identifier like "101350" → 1013.5 */
  Chapter: string;
  /** Chapter type label */
  Type: string;
  /** Release date string */
  Date: string;
  /** Chapter name (sometimes empty) */
  ChapterName: string | null;
  /** Page count (if available) */
  Page?: string;
  /** Directory (usually empty string or a specific folder) */
  Directory?: string;
}

export class MangaSeeConnector extends BaseConnector {
  readonly source: Source = {
    id: 'mangasee',
    name: 'MangaSee',
    url: BASE_URL,
    language: 'en',
    type: 'manga',
    enabled: true,
  };

  // Cache the directory to avoid refetching on every search
  private directoryCache: DirectoryEntry[] | null = null;
  private directoryCacheTime = 0;
  private static readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  /**
   * Fetch and cache the full manga directory from MangaSee.
   * The directory is embedded as `vm.Directory = [...]` in the search page.
   */
  private async getDirectory(): Promise<DirectoryEntry[]> {
    const now = Date.now();
    if (this.directoryCache && now - this.directoryCacheTime < MangaSeeConnector.CACHE_TTL) {
      return this.directoryCache;
    }

    const html = await this.fetchText(`${BASE_URL}/search/`);

    // Extract vm.Directory JSON from the HTML
    const match = html.match(/vm\.Directory\s*=\s*(\[[\s\S]*?\]);/);
    if (!match) {
      throw new Error('Failed to extract manga directory from MangaSee');
    }

    try {
      const directory: DirectoryEntry[] = JSON.parse(match[1]);
      this.directoryCache = directory;
      this.directoryCacheTime = now;
      return directory;
    } catch {
      throw new Error('Failed to parse MangaSee directory JSON');
    }
  }

  async search(query: string): Promise<MangaInfo[]> {
    const directory = await this.getDirectory();
    const q = query.toLowerCase().trim();

    // Client-side filtering (same as MangaSee's Angular search)
    const matches = directory.filter((entry) => {
      if (entry.s.toLowerCase().includes(q)) return true;
      if (entry.al?.some((alt) => alt.toLowerCase().includes(q))) return true;
      return false;
    });

    // Limit results
    return matches.slice(0, 30).map((entry) => this.mapDirectoryEntry(entry));
  }

  async getManga(mangaId: string): Promise<MangaInfo | null> {
    // mangaId is the slug (e.g. "Chainsaw-Man")
    try {
      const html = await this.fetchText(`${BASE_URL}/manga/${mangaId}`);
      const $ = this.parseHTML(html);

      const title = $('ul.list-group li:first-child h1').text().trim() || mangaId;
      const cover = `${CDN_COVER}/${mangaId}.jpg`;

      // Extract info from the detail page
      const synopsis = $('div.top-5.Content').text().trim() || undefined;

      const authors: string[] = [];
      $('a[href*="/search/?author="]').each((_i, el) => {
        const author = $(el).text().trim();
        if (author) authors.push(author);
      });

      const genres: string[] = [];
      $('a[href*="/search/?genre="]').each((_i, el) => {
        const genre = $(el).text().trim();
        if (genre) genres.push(genre);
      });

      const statusText = $('a[href*="/search/?status="]').first().text().trim().toLowerCase();
      const status = this.mapStatus(statusText);

      return {
        id: mangaId,
        sourceId: this.source.id,
        title,
        url: `${BASE_URL}/manga/${mangaId}`,
        cover,
        synopsis,
        authors: authors.length > 0 ? authors : undefined,
        genres: genres.length > 0 ? genres : undefined,
        status,
      };
    } catch {
      // Fallback: try the directory
      const directory = await this.getDirectory();
      const entry = directory.find((e) => e.i === mangaId);
      if (entry) return this.mapDirectoryEntry(entry);
      return null;
    }
  }

  async getChapters(mangaId: string): Promise<ChapterInfo[]> {
    const html = await this.fetchText(`${BASE_URL}/manga/${mangaId}`);

    // Chapters are stored in vm.Chapters = [...] JSON blob
    const match = html.match(/vm\.Chapters\s*=\s*(\[[\s\S]*?\]);/);
    if (!match) return [];

    let rawChapters: ChapterEntry[];
    try {
      rawChapters = JSON.parse(match[1]);
    } catch {
      return [];
    }

    return rawChapters.map((ch) => {
      const num = this.decodeChapterNumber(ch.Chapter);
      const title = ch.ChapterName || `Chapter ${num}`;
      const slug = this.chapterURLEncode(ch.Chapter);

      return {
        id: `${mangaId}::${ch.Chapter}`,
        mangaId,
        title,
        number: num,
        language: 'en',
        url: `${BASE_URL}/read-online/${mangaId}-chapter-${slug}.html`,
        date: ch.Date || undefined,
      };
    });
  }

  async getPages(chapterId: string): Promise<PageInfo[]> {
    // chapterId format: "{slug}::{chapterCode}"
    const [mangaSlug, chapterCode] = chapterId.split('::');
    if (!mangaSlug || !chapterCode) {
      throw new Error(`Invalid chapter ID format: ${chapterId}`);
    }

    const slug = this.chapterURLEncode(chapterCode);
    const readUrl = `${BASE_URL}/read-online/${mangaSlug}-chapter-${slug}.html`;

    const html = await this.fetchText(readUrl);

    // Extract vm.CurChapter to get page count and directory info
    const curChapterMatch = html.match(/vm\.CurChapter\s*=\s*(\{[\s\S]*?\});/);
    if (!curChapterMatch) {
      throw new Error('Failed to extract chapter data from MangaSee reader page');
    }

    let curChapter: ChapterEntry;
    try {
      curChapter = JSON.parse(curChapterMatch[1]);
    } catch {
      throw new Error('Failed to parse chapter data JSON');
    }

    const pageCount = parseInt(curChapter.Page || '0', 10);
    if (pageCount === 0) return [];

    const directory = curChapter.Directory && curChapter.Directory !== ''
      ? curChapter.Directory
      : '';

    const chapterNum = this.decodeChapterNumber(curChapter.Chapter);
    const chapterStr = chapterNum % 1 === 0
      ? String(Math.floor(chapterNum)).padStart(4, '0')
      : `${String(Math.floor(chapterNum)).padStart(4, '0')}.${String(chapterNum).split('.')[1]}`;

    const pages: PageInfo[] = [];
    for (let i = 1; i <= pageCount; i++) {
      const pageStr = String(i).padStart(3, '0');
      const url = `${CDN_IMAGE}/${mangaSlug}/${directory ? directory + '/' : ''}${chapterStr}-${pageStr}.png`;
      pages.push({
        index: i - 1,
        url,
        referer: BASE_URL,
      });
    }

    return pages;
  }

  // --- Helpers ---

  private mapDirectoryEntry(entry: DirectoryEntry): MangaInfo {
    const status = this.mapStatus((entry.ss || '').toLowerCase());
    return {
      id: entry.i,
      sourceId: this.source.id,
      title: entry.s,
      url: `${BASE_URL}/manga/${entry.i}`,
      cover: `${CDN_COVER}/${entry.i}.jpg`,
      authors: entry.a && entry.a.length > 0 ? entry.a : undefined,
      genres: entry.g && entry.g.length > 0 ? entry.g : undefined,
      status,
    };
  }

  private mapStatus(s: string): MangaInfo['status'] {
    if (s.includes('ongoing') || s.includes('publishing')) return 'ongoing';
    if (s.includes('complete') || s.includes('finished')) return 'completed';
    if (s.includes('hiatus') || s.includes('discontinued')) return 'hiatus';
    return 'unknown';
  }

  /**
   * MangaSee chapter codes are encoded as a 6-digit string: "LCCCCP"
   * where L = season/type digit, CCCC = chapter number (4 digits), P = decimal part.
   * Example: "101350" → chapter 135.0, "101235" → chapter 123.5
   */
  private decodeChapterNumber(code: string): number {
    const num = code.slice(1, -1); // remove first and last digit
    const major = parseInt(num, 10);
    const decimal = parseInt(code.slice(-1), 10);
    return decimal === 0 ? major : major + decimal * 0.1;
  }

  /**
   * Encode a chapter code into the URL segment used by MangaSee.
   * "101350" → "135" (strip leading season digit, strip trailing 0,
   *  add decimal if present)
   */
  private chapterURLEncode(code: string): string {
    const num = this.decodeChapterNumber(code);
    if (num % 1 === 0) return String(Math.floor(num));
    return String(num);
  }
}
