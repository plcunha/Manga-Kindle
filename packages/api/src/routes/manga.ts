import { Router } from 'express';
import { engine } from '@manga-kindle/scraper';
import type { MangaInfo, ChapterInfo, PageInfo } from '@manga-kindle/scraper';
import { AppError } from '../middleware/error-handler.js';

/** Detect Cloudflare-related errors and rethrow as a user-friendly AppError */
function handleConnectorError(err: unknown, sourceId: string): never {
  if (err instanceof AppError) throw err;

  const msg = err instanceof Error ? err.message : String(err);

  // Cloudflare block (403/503 without FlareSolverr)
  if (msg.includes('403/503') || msg.includes('Cloudflare-protected')) {
    throw new AppError(
      503,
      `Source "${sourceId}" is protected by Cloudflare and requires FlareSolverr to work. ` +
      `Set the FLARESOLVERR_URL environment variable to enable automatic bypass.`,
      'CLOUDFLARE_PROTECTED',
    );
  }

  // Generic HTTP errors from connectors
  const httpMatch = msg.match(/^HTTP (\d+)/);
  if (httpMatch) {
    const status = parseInt(httpMatch[1], 10);
    throw new AppError(
      status >= 400 && status < 600 ? status : 502,
      `Source "${sourceId}" returned HTTP ${httpMatch[1]}. The site may be down or blocking requests.`,
    );
  }

  // Network / DNS / timeout errors
  if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND') || msg.includes('ETIMEDOUT') || msg.includes('fetch failed')) {
    throw new AppError(
      502,
      `Source "${sourceId}" is unreachable. The site may be down.`,
    );
  }

  // Unknown connector error — still surface the message
  throw new AppError(500, `Source "${sourceId}" error: ${msg}`);
}

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
  // Always proxy page images so the browser can load them (CORS)
  const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(p.url)}`;
  return {
    url: proxyUrl,
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

  try {
    const results = await connector.search(query);
    res.json({ results: results.map(mapManga), query, source: sourceId });
  } catch (err) {
    handleConnectorError(err, sourceId);
  }
});

// GET /api/manga/:sourceId/:mangaId - Get manga details + chapters
mangaRouter.get('/:sourceId/:mangaId', async (req, res) => {
  const { sourceId, mangaId } = req.params;

  const connector = engine.getConnector(sourceId);
  if (!connector) {
    throw new AppError(404, `Source "${sourceId}" not found`);
  }

  try {
    const [manga, chapters] = await Promise.all([
      connector.getManga(mangaId),
      connector.getChapters(mangaId),
    ]);

    if (!manga) {
      throw new AppError(404, `Manga "${mangaId}" not found on source "${sourceId}"`);
    }

    res.json({ manga: mapManga(manga), chapters: chapters.map(mapChapter) });
  } catch (err) {
    handleConnectorError(err, sourceId);
  }
});

// GET /api/manga/:sourceId/:mangaId/:chapterId/pages - Get chapter pages
mangaRouter.get('/:sourceId/:mangaId/:chapterId/pages', async (req, res) => {
  const { sourceId, chapterId } = req.params;

  const connector = engine.getConnector(sourceId);
  if (!connector) {
    throw new AppError(404, `Source "${sourceId}" not found`);
  }

  try {
    const pages = await connector.getPages(chapterId);
    res.json({ pages: pages.map(mapPage) });
  } catch (err) {
    handleConnectorError(err, sourceId);
  }
});
