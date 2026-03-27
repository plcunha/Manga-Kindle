/**
 * MangaDex Connector
 *
 * Uses the official MangaDex API v5 (https://api.mangadex.org)
 * No authentication required for reading.
 */
import { BaseConnector } from '../engine/base-connector.js';
import type { Source, MangaInfo, ChapterInfo, PageInfo } from '../index.js';

const API_BASE = 'https://api.mangadex.org';

interface MdRelationship {
  id: string;
  type: string;
  attributes?: Record<string, unknown>;
}

interface MdMangaAttributes {
  title: Record<string, string>;
  altTitles?: Record<string, string>[];
  description?: Record<string, string>;
  status?: string;
  tags?: { attributes: { name: Record<string, string> } }[];
}

interface MdChapterAttributes {
  title: string | null;
  chapter: string | null;
  translatedLanguage: string;
  publishAt: string;
  externalUrl: string | null;
}

export class MangaDexConnector extends BaseConnector {
  readonly source: Source = {
    id: 'mangadex',
    name: 'MangaDex',
    url: 'https://mangadex.org',
    language: 'multi',
    type: 'manga',
    enabled: true,
  };

  async search(query: string): Promise<MangaInfo[]> {
    const params = new URLSearchParams({
      title: query,
      limit: '20',
      'includes[]': 'cover_art',
      'order[relevance]': 'desc',
      'contentRating[]': 'safe',
    });
    // MangaDex allows multiple contentRating values
    params.append('contentRating[]', 'suggestive');
    params.append('contentRating[]', 'erotica');
    params.append('contentRating[]', 'pornographic');

    const data = await this.fetchJSON<{
      data: { id: string; attributes: MdMangaAttributes; relationships: MdRelationship[] }[];
    }>(`${API_BASE}/manga?${params}`);

    return data.data.map((manga) => this.mapManga(manga));
  }

  async getManga(mangaId: string): Promise<MangaInfo | null> {
    const params = new URLSearchParams({
      'includes[]': 'cover_art',
    });
    params.append('includes[]', 'author');

    try {
      const data = await this.fetchJSON<{
        data: { id: string; attributes: MdMangaAttributes; relationships: MdRelationship[] };
      }>(`${API_BASE}/manga/${mangaId}?${params}`);

      return this.mapManga(data.data);
    } catch (err: unknown) {
      // Only treat 404 as "not found"; re-throw network/rate-limit/5xx errors
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('404') || msg.includes('Not Found')) return null;
      throw err;
    }
  }

  /** Languages to fetch chapters for (order = preference for dedup) */
  static readonly LANGUAGES = ['pt-br', 'pt', 'en', 'es-la', 'es'];

  async getChapters(mangaId: string): Promise<ChapterInfo[]> {
    const chapters: ChapterInfo[] = [];
    let offset = 0;
    const limit = 100;

    // Paginate through all chapters
    while (true) {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
        'order[chapter]': 'asc',
        includeExternalUrl: '0',
      });
      // Request multiple languages
      for (const lang of MangaDexConnector.LANGUAGES) {
        params.append('translatedLanguage[]', lang);
      }

      const data = await this.fetchJSON<{
        data: { id: string; attributes: MdChapterAttributes }[];
        total: number;
      }>(`${API_BASE}/manga/${mangaId}/feed?${params}`);

      for (const ch of data.data) {
        const attrs = ch.attributes;
        if (attrs.externalUrl) continue; // skip external chapters

        const chapterNum = attrs.chapter ? parseFloat(attrs.chapter) : 0;
        const title = attrs.title || `Chapter ${attrs.chapter || '?'}`;

        chapters.push({
          id: ch.id,
          mangaId,
          title,
          number: chapterNum,
          language: attrs.translatedLanguage,
          url: `https://mangadex.org/chapter/${ch.id}`,
          date: attrs.publishAt,
        });
      }

      offset += limit;
      if (offset >= data.total) break;

      // Rate limit: MangaDex asks for 5 req/s max
      await this.delay(250);
    }

    return chapters;
  }

  async getPages(chapterId: string): Promise<PageInfo[]> {
    const data = await this.fetchJSON<{
      baseUrl: string;
      chapter: {
        hash: string;
        data: string[];
        dataSaver: string[];
      };
    }>(`${API_BASE}/at-home/server/${chapterId}`);

    return data.chapter.data.map((filename, index) => ({
      index,
      url: `${data.baseUrl}/data/${data.chapter.hash}/${filename}`,
    }));
  }

  // --- Helpers ---

  private mapManga(manga: {
    id: string;
    attributes: MdMangaAttributes;
    relationships: MdRelationship[];
  }): MangaInfo {
    const attrs = manga.attributes;

    // Get title (prefer PT, then EN, then romanised Japanese, then first available)
    const title =
      attrs.title['pt-br'] ||
      attrs.title['pt'] ||
      attrs.title['en'] ||
      attrs.title['ja-ro'] ||
      attrs.title['ja'] ||
      Object.values(attrs.title)[0] ||
      'Unknown';

    // Get synopsis (prefer PT, then EN)
    const synopsis =
      attrs.description?.['pt-br'] ||
      attrs.description?.['pt'] ||
      attrs.description?.['en'] ||
      attrs.description?.['ja-ro'] ||
      undefined;

    // Get cover URL
    const coverRel = manga.relationships.find((r) => r.type === 'cover_art');
    const coverFilename = coverRel?.attributes?.['fileName'] as string | undefined;
    const cover = coverFilename
      ? `https://uploads.mangadex.org/covers/${manga.id}/${coverFilename}.256.jpg`
      : undefined;

    // Get authors
    const authors = manga.relationships
      .filter((r) => r.type === 'author')
      .map((r) => (r.attributes?.['name'] as string) || '')
      .filter(Boolean);

    // Get genres from tags
    const genres = attrs.tags?.map((t) => t.attributes.name['en'] || '').filter(Boolean);

    // Map status
    const statusMap: Record<string, MangaInfo['status']> = {
      ongoing: 'ongoing',
      completed: 'completed',
      hiatus: 'hiatus',
    };

    return {
      id: manga.id,
      sourceId: this.source.id,
      title,
      url: `https://mangadex.org/title/${manga.id}`,
      cover,
      synopsis,
      authors: authors.length > 0 ? authors : undefined,
      genres,
      status: statusMap[attrs.status || ''] || 'unknown',
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
