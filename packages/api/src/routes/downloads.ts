import { Router } from 'express';
import { engine } from '@manga-kindle/scraper';
import { prisma } from '../services/db.js';
import { runDownloadJob, cancelJob } from '../services/download-service.js';
import { AppError } from '../middleware/error-handler.js';

export const downloadsRouter = Router();

// ---------------------------------------------------------------------------
// POST /api/downloads — Start a new download job
// ---------------------------------------------------------------------------
downloadsRouter.post('/', async (req, res) => {
  const { mangaId, chapterIds, sourceId } = req.body as {
    mangaId?: string;
    chapterIds?: string[];
    sourceId?: string;
  };

  if (!mangaId || !sourceId || !Array.isArray(chapterIds) || chapterIds.length === 0) {
    throw new AppError(400, 'mangaId, sourceId, and a non-empty chapterIds array are required');
  }

  const connector = engine.getConnector(sourceId);
  if (!connector) {
    throw new AppError(404, `Source "${sourceId}" not found`);
  }

  // Ensure the Source row exists in DB
  const src = connector.source;
  await prisma.source.upsert({
    where: { url: src.url },
    update: { name: src.name, language: src.language, type: src.type, enabled: src.enabled },
    create: { id: src.id, name: src.name, url: src.url, language: src.language, type: src.type, enabled: src.enabled },
  });

  // Ensure the Manga row exists in DB (fetch live info from source)
  const mangaInfo = await connector.getManga(mangaId);
  if (!mangaInfo) {
    throw new AppError(404, `Manga "${mangaId}" not found on source "${sourceId}"`);
  }

  const manga = await prisma.manga.upsert({
    where: { sourceId_url: { sourceId: src.id, url: mangaInfo.url } },
    update: {
      title: mangaInfo.title,
      cover: mangaInfo.cover ?? null,
      synopsis: mangaInfo.synopsis ?? null,
      authors: mangaInfo.authors ? JSON.stringify(mangaInfo.authors) : null,
      genres: mangaInfo.genres ? JSON.stringify(mangaInfo.genres) : null,
      status: mangaInfo.status ?? 'unknown',
    },
    create: {
      id: mangaInfo.id,
      sourceId: src.id,
      title: mangaInfo.title,
      url: mangaInfo.url,
      cover: mangaInfo.cover ?? null,
      synopsis: mangaInfo.synopsis ?? null,
      authors: mangaInfo.authors ? JSON.stringify(mangaInfo.authors) : null,
      genres: mangaInfo.genres ? JSON.stringify(mangaInfo.genres) : null,
      status: mangaInfo.status ?? 'unknown',
    },
  });

  // Create the download job (FK to the upserted Manga row)
  const job = await prisma.downloadJob.create({
    data: {
      mangaId: manga.id,
      sourceId: src.id,
      chapterIds: JSON.stringify(chapterIds),
      status: 'queued',
      progress: 0,
    },
  });

  // Fire-and-forget — the service updates status via Prisma + WS
  runDownloadJob({
    jobId: job.id,
    sourceId,
    mangaId,
    chapterIds,
  }).catch((err) => {
    console.error(`[Downloads] Uncaught error in job ${job.id}:`, err);
  });

  res.status(201).json({ job });
});

// ---------------------------------------------------------------------------
// GET /api/downloads — List all download jobs
// ---------------------------------------------------------------------------
downloadsRouter.get('/', async (_req, res) => {
  const jobs = await prisma.downloadJob.findMany({
    orderBy: { createdAt: 'desc' },
  });
  res.json({ jobs });
});

// ---------------------------------------------------------------------------
// GET /api/downloads/:id — Get a single download job
// ---------------------------------------------------------------------------
downloadsRouter.get('/:id', async (req, res) => {
  const job = await prisma.downloadJob.findUnique({
    where: { id: req.params.id },
  });

  if (!job) throw new AppError(404, 'Download job not found');
  res.json({ job });
});

// ---------------------------------------------------------------------------
// DELETE /api/downloads/:id — Cancel a download job
// ---------------------------------------------------------------------------
downloadsRouter.delete('/:id', async (req, res) => {
  const { id } = req.params;

  const job = await prisma.downloadJob.findUnique({ where: { id } });
  if (!job) throw new AppError(404, 'Download job not found');

  if (job.status === 'downloading' || job.status === 'queued') {
    cancelJob(id);
    await prisma.downloadJob.update({
      where: { id },
      data: { status: 'cancelled' },
    });
  }

  res.json({ message: `Job ${id} cancelled` });
});
