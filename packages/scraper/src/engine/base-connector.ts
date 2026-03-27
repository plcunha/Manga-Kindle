/**
 * Base Connector class - provides common utilities for all connectors.
 * Adapted from HakuNeko's connector pattern for server-side use.
 */
import * as cheerio from 'cheerio';
import { fetch, type RequestInit } from 'undici';
import type { Connector, Source, MangaInfo, ChapterInfo, PageInfo } from '../index.js';

export abstract class BaseConnector implements Connector {
  abstract readonly source: Source;

  /**
   * Fetch a URL with standard headers and error handling.
   */
  protected async fetchText(url: string, init?: RequestInit): Promise<string> {
    const response = await fetch(url, {
      ...init,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        ...(init?.headers as Record<string, string>),
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} fetching ${url}`);
    }

    return response.text();
  }

  /**
   * Fetch JSON from a URL.
   */
  protected async fetchJSON<T = unknown>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...init,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        Accept: 'application/json',
        ...(init?.headers as Record<string, string>),
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} fetching ${url}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Load HTML into Cheerio for DOM-like parsing (replaces browser DOM APIs).
   */
  protected parseHTML(html: string): cheerio.CheerioAPI {
    return cheerio.load(html);
  }

  // Subclasses must implement these
  abstract search(query: string): Promise<MangaInfo[]>;
  abstract getManga(mangaId: string): Promise<MangaInfo | null>;
  abstract getChapters(mangaId: string): Promise<ChapterInfo[]>;
  abstract getPages(chapterId: string): Promise<PageInfo[]>;
}
