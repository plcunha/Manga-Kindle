/**
 * Scraper Engine - Core types and interfaces
 *
 * This package adapts HakuNeko-style connectors for server-side use.
 * Each connector represents a manga/anime source website.
 */

// --- Core Types ---

export interface Source {
  id: string;
  name: string;
  url: string;
  language: string;
  type: 'manga' | 'anime' | 'both';
  enabled: boolean;
}

export interface MangaInfo {
  id: string;
  sourceId: string;
  title: string;
  url: string;
  cover?: string;
  synopsis?: string;
  authors?: string[];
  genres?: string[];
  status?: 'ongoing' | 'completed' | 'hiatus' | 'unknown';
}

export interface ChapterInfo {
  id: string;
  mangaId: string;
  title: string;
  number: number;
  language: string;
  url: string;
  date?: string;
}

export interface PageInfo {
  index: number;
  url: string;
  referer?: string;
}

// --- Connector Interface ---

export interface Connector {
  readonly source: Source;

  /** Search for manga/anime on this source */
  search(query: string): Promise<MangaInfo[]>;

  /** Get manga/anime details */
  getManga(mangaId: string): Promise<MangaInfo | null>;

  /** Get list of chapters for a manga */
  getChapters(mangaId: string): Promise<ChapterInfo[]>;

  /** Get page URLs for a chapter */
  getPages(chapterId: string): Promise<PageInfo[]>;
}

// --- Engine ---

export class ScraperEngine {
  private connectors = new Map<string, Connector>();

  register(connector: Connector): void {
    this.connectors.set(connector.source.id, connector);
    console.log(`[Scraper] Registered: ${connector.source.name}`);
  }

  getSource(id: string): Source | undefined {
    return this.connectors.get(id)?.source;
  }

  getSources(): Source[] {
    return Array.from(this.connectors.values()).map((c) => c.source);
  }

  getConnector(sourceId: string): Connector | undefined {
    return this.connectors.get(sourceId);
  }
}

// --- Singleton engine with all connectors registered ---

import { MangaDexConnector } from './connectors/mangadex.js';
import { MangaSeeConnector } from './connectors/mangasee.js';
import { MangaKakalotConnector } from './connectors/mangakakalot.js';
import { WPMangastreamConnector } from './templates/wordpress-mangastream.js';
import { wpMangastreamSites } from './sites/wordpress-mangastream-sites.js';

export const engine = new ScraperEngine();

// Register hand-written connectors
engine.register(new MangaDexConnector());
engine.register(new MangaSeeConnector());
engine.register(new MangaKakalotConnector());

// Register all WordPressMangastream template sites
for (const site of wpMangastreamSites) {
  engine.register(new WPMangastreamConnector(site));
}

// Re-export connectors and templates
export { MangaDexConnector } from './connectors/mangadex.js';
export { MangaSeeConnector } from './connectors/mangasee.js';
export { MangaKakalotConnector } from './connectors/mangakakalot.js';
export { BaseConnector } from './engine/base-connector.js';
export { WPMangastreamConnector } from './templates/wordpress-mangastream.js';
export type { WPMangastreamSiteConfig } from './templates/types.js';
