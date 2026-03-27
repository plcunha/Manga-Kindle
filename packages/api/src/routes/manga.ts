import { Router } from 'express';
import { engine } from '@manga-kindle/scraper';
import type { MangaInfo, ChapterInfo, PageInfo } from '@manga-kindle/scraper';
import { AppError } from '../middleware/error-handler.js';

export const mangaRouter = Router();

// ── Mappers: scraper types → web-friendly response shapes ──

/** Domains that need to be proxied through /api/image-proxy for Referer requirements */
const PROXY_DOMAINS = ['mkklcdn', 'mangakakalot.com', 'mangakakalot.gg', 'chapmanganato', 'manganato'];

function needsProxy(url: string): boolean {
  return PROXY_DOMAINS.some((d) => url.includes(d));
}

function proxyCoverUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (needsProxy(url)) {
    return `/api/image-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}

function mapManga(m: MangaInfo) {
  return {
    id: m.id,
    title: m.title,
    coverUrl: proxyCoverUrl(m.cover),
    description: m.synopsis || undefined,
    authors: m.authors,
    genres: m.genres,
    status: m.status,
    url: m.url,
  };
}

function mapChapter(ch: ChapterInfo) {
  return {
    id: ch.id,
    title: ch.title,
    chapter: ch.number != null ? String(ch.number) : undefined,
    volume: undefined,
    language: ch.language,
    pages: 0, // page count unknown until pages are fetched
    publishedAt: ch.date || undefined,
    url: ch.url,
  };
}

function mapPage(p: PageInfo) {
  return {
    url: p.url,
    headers: p.referer ? { Referer: p.referer } : undefined,
  };
}

// GET /api/manga/search?source=xxx&q=query
mangaRouter.get('/search', async (req, res) => {
  const sourceId = req.query.source as string;
  const query = req.query.q as string;

  if (!sourceId) {
    throw new AppError(400, 'Missing "source" query parameter');
  }
  if (!query) {
    throw new AppError(400, 'Missing "q" query parameter');
  }

  const connector = engine.getConnector(sourceId);
  if (!connector) {
    throw new AppError(404, `Source "${sourceId}" not found`);
  }

  const results = await connector.search(query);
  res.json({ results: results.map(mapManga), query, source: sourceId });
});

// GET /api/manga/:sourceId/:mangaId - Get manga details + chapters
mangaRouter.get('/:sourceId/:mangaId', async (req, res) => {
  const { sourceId, mangaId } = req.params;

  const connector = engine.getConnector(sourceId);
  if (!connector) {
    throw new AppError(404, `Source "${sourceId}" not found`);
  }

  const [manga, chapters] = await Promise.all([
    connector.getManga(mangaId),
    connector.getChapters(mangaId),
  ]);

  if (!manga) {
    throw new AppError(404, `Manga "${mangaId}" not found on source "${sourceId}"`);
  }

  res.json({ manga: mapManga(manga), chapters: chapters.map(mapChapter) });
});

// GET /api/manga/:sourceId/:mangaId/:chapterId/pages - Get chapter pages
mangaRouter.get('/:sourceId/:mangaId/:chapterId/pages', async (req, res) => {
  const { sourceId, chapterId } = req.params;

  const connector = engine.getConnector(sourceId);
  if (!connector) {
    throw new AppError(404, `Source "${sourceId}" not found`);
  }

  const pages = await connector.getPages(chapterId);
  res.json({ pages: pages.map(mapPage) });
});
