import { BaseConnector } from '../engine/base-connector.js';
import { load } from 'cheerio';
import type { MangaInfo, ChapterInfo, PageInfo, Source } from '../index.js';

interface AsuraSeries {
  id: number;
  slug: string;
  title: string;
  alt_titles?: string[];
  description?: string;
  cover: string;
  banner?: string;
  status: 'ongoing' | 'completed' | 'hiatus' | 'dropped';
  type: 'manhwa' | 'manga' | 'manhua';
  author?: string;
  artist?: string;
  release_year?: number;
  popularity_rank: number;
  bookmark_count: number;
  rating: number;
  chapter_count: number;
  last_chapter_at: string;
  genres?: { id: number; name: string; slug: string }[];
  latest_chapters?: { id: number; number: number; title?: string; slug: string; published_at: string }[];
  public_url: string;
  source_url: string;
}

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

  private extractSeriesFromHtml(html: string): AsuraSeries[] | null {
    try {
      // Look for embedded JSON in the HTML (Astro passes data via props)
      // Format: "initialSeries":[1,[[0,{...series data...}]]]
      const seriesMatch = html.match(/"initialSeries":\[1,\[\[0,({[\s\S]*?"source_url":[\s\S]*?"\/s\/\d+"})\]/);
      if (seriesMatch) {
        const series = JSON.parse(seriesMatch[1]) as AsuraSeries;
        return [series];
      }
      
      // Try to find series data in browse page format (multiple series)
      const browseMatch = html.match(/"initialSeries":\[1,\[([\s\S]*?)\]\]/);
      if (browseMatch) {
        const seriesData = browseMatch[1];
        const series: AsuraSeries[] = [];
        
        // Extract individual series objects from the nested array structure
        const objMatches = seriesData.match(/\[0,({[\s\S]*?"source_url":[\s\S]*?"\/s\/\d+"})\]/g);
        if (objMatches) {
          for (const objMatch of objMatches) {
            const innerMatch = objMatch.match(/\[0,({[\s\S]*})\]/);
            if (innerMatch) {
              try {
                series.push(JSON.parse(innerMatch[1]));
              } catch {
                // Skip invalid entries
              }
            }
          }
        }
        
        if (series.length > 0) {
          return series;
        }
      }
      
      return null;
    } catch {
      return null;
    }
  }

  async search(query: string): Promise<MangaInfo[]> {
    // AsuraScans doesn't have a direct search API exposed in HTML
    // We'll use the browse page and filter client-side
    const html = await this.fetchText(`${this.baseUrl}/browse`);
    const series = this.extractSeriesFromHtml(html);
    
    if (!series || series.length === 0) {
      return [];
    }

    // Filter by query if provided
    const results = query
      ? series.filter(s => 
          s.title.toLowerCase().includes(query.toLowerCase()) ||
          s.alt_titles?.some(t => t.toLowerCase().includes(query.toLowerCase()))
        )
      : series;

    return results.map(s => ({
      id: s.id.toString(),
      sourceId: this.source.id,
      title: s.title,
      url: `${this.source.url}${s.public_url}`,
      cover: s.cover,
      synopsis: s.description ? this.cleanHtml(s.description) : undefined,
      authors: [s.author, s.artist].filter(Boolean) as string[],
      genres: s.genres?.map(g => g.name) || [],
      status: this.mapStatus(s.status),
    }));
  }

  async getManga(id: string): Promise<MangaInfo | null> {
    // Fetch the manga page
    const html = await this.fetchText(`${this.source.url}/comics/${id}`);
    const $ = load(html);
    
    // Extract data from embedded JSON first
    const series = this.extractSeriesFromHtml(html);
    if (series && series.length > 0) {
      const s = series[0];
      return {
        id: s.id.toString(),
        sourceId: this.source.id,
        title: s.title,
        url: `${this.source.url}${s.public_url}`,
        cover: s.cover,
        synopsis: s.description ? this.cleanHtml(s.description) : undefined,
        authors: [s.author, s.artist].filter(Boolean) as string[],
        genres: s.genres?.map(g => g.name) || [],
        status: this.mapStatus(s.status),
      };
    }

    // Fallback: parse from HTML
    const title = $('h1').first().text().trim();
    const description = $('#description-text').text().trim() || 
                       $('meta[property="og:description"]').attr('content') || 
                       '';
    const cover = $('meta[property="og:image"]').attr('content') || 
                  $('.rounded-lg.overflow-hidden img').first().attr('src') || '';
    
    // Extract genres
    const genres: string[] = [];
    $('a[href*="/browse?genres="]').each((_, el) => {
      const genre = $(el).text().trim();
      if (genre) genres.push(genre);
    });

    if (!title) return null;

    return {
      id,
      sourceId: this.source.id,
      title,
      url: `${this.source.url}/comics/${id}`,
      cover: cover || undefined,
      synopsis: description || undefined,
      genres,
    };
  }

  async getChapters(mangaId: string): Promise<ChapterInfo[]> {
    const html = await this.fetchText(`${this.source.url}/comics/${mangaId}`);
    const $ = load(html);
    const chapters: ChapterInfo[] = [];

    // Parse chapter list from HTML
    const chapterLinks = $('a[href*="/chapter/"]');
    chapterLinks.each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      const chapterNum = parseFloat(href.match(/chapter\/(\d+)/)?.[1] || '0');
      if (!chapterNum) return;

      const chapterTitle = $(el).text().trim() || `Chapter ${chapterNum}`;
      const timeAgo = $(el).find('time').text().trim();

      chapters.push({
        id: href,
        mangaId,
        title: chapterTitle,
        number: chapterNum,
        language: 'en',
        url: `${this.source.url}${href}`,
        date: timeAgo || undefined,
      });
    });

    // Sort chapters in descending order (newest first)
    chapters.sort((a, b) => b.number - a.number);

    return chapters;
  }

  async getPages(chapterId: string): Promise<PageInfo[]> {
    const html = await this.fetchText(chapterId);
    const $ = load(html);
    const pages: PageInfo[] = [];

    // Look for chapter images
    const images = $('main img, article img, .chapter-content img, .reading-content img');
    
    let imageIndex = 0;
    images.each((i, el) => {
      const src = $(el).attr('src');
      if (!src) return;
      
      // Skip non-chapter images (logos, covers, etc.)
      if (src.includes('logo') || src.includes('cover') || src.includes('avatar') || src.includes('banner')) {
        return;
      }
      
      // Only include images that look like chapter pages
      if (src.includes('asura-images') || src.includes('chapters') || src.includes('cdn.asurascans.com')) {
        pages.push({
          index: imageIndex++,
          url: src.startsWith('http') ? src : `${this.source.url}${src}`,
          referer: chapterId,
        });
      }
    });

    // If no images found with specific patterns, try all images in content areas
    if (pages.length === 0) {
      $('img').each((i, el) => {
        const src = $(el).attr('src');
        if (!src) return;
        
        // Skip UI images
        if (src.includes('logo') || src.includes('cover') || src.includes('avatar') || 
            src.includes('banner') || src.includes('icon') || src.includes('placeholder')) {
          return;
        }
        
        // Include images that look like they could be chapter pages
        if (src.includes('asura-images') || src.includes('cdn.asurascans.com')) {
          pages.push({
            index: imageIndex++,
            url: src.startsWith('http') ? src : `${this.source.url}${src}`,
            referer: chapterId,
          });
        }
      });
    }

    return pages;
  }

  private cleanHtml(html: string): string {
    // Remove HTML tags and decode entities
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

  private mapStatus(status: string): 'ongoing' | 'completed' | 'hiatus' | 'unknown' {
    switch (status.toLowerCase()) {
      case 'ongoing':
        return 'ongoing';
      case 'completed':
        return 'completed';
      case 'hiatus':
        return 'hiatus';
      default:
        return 'unknown';
    }
  }
}
