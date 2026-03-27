/**
 * Download Service
 *
 * Handles downloading manga chapter images to disk.
 * For each chapter: resolves page URLs via the scraper engine,
 * downloads each image, saves to a structured folder, and
 * reports progress via Prisma + WebSocket.
 */
import { mkdir, writeFile } from 'fs/promises';
import { join, extname } from 'path';
import { fetch } from 'undici';
import { prisma } from './db.js';
import { broadcastProgress } from './websocket.js';
import { engine, type Connector, type PageInfo } from '@manga-kindle/scraper';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DOWNLOAD_DIR = process.env.DOWNLOAD_DIR || './downloads';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const CONCURRENT_PAGES = 4; // parallel image downloads per chapter
const INTER_CHAPTER_DELAY_MS = 500;

// ---------------------------------------------------------------------------
// Active-job tracking (for cancellation)
// ---------------------------------------------------------------------------

/** Set of job IDs currently in progress — remove to signal cancellation. */
const activeJobs = new Set<string>();

export function cancelJob(jobId: string): void {
  activeJobs.delete(jobId);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface StartDownloadOpts {
  jobId: string;
  sourceId: string;
  mangaId: string;
  chapterIds: string[];
}

/**
 * Run an entire download job (fire-and-forget — call without await from route).
 * Updates the DownloadJob row in Prisma and broadcasts WebSocket events.
 */
export async function runDownloadJob(opts: StartDownloadOpts): Promise<void> {
  const { jobId, sourceId, mangaId, chapterIds } = opts;

  activeJobs.add(jobId);
  const connector = engine.getConnector(sourceId);
  if (!connector) {
    await failJob(jobId, `Source "${sourceId}" not found`);
    return;
  }

  await updateJob(jobId, { status: 'downloading', progress: 0 });
  broadcast(jobId, 'downloading', 0, 'Starting download…');

  try {
    // Resolve manga title for the folder name
    const manga = await connector.getManga(mangaId);
    const mangaTitle = sanitizePath(manga?.title ?? mangaId);
    const mangaDir = join(DOWNLOAD_DIR, mangaTitle);

    const totalChapters = chapterIds.length;

    for (let ci = 0; ci < totalChapters; ci++) {
      // Check cancellation
      if (!activeJobs.has(jobId)) {
        await updateJob(jobId, { status: 'cancelled' });
        broadcast(jobId, 'cancelled', 0, 'Download cancelled');
        return;
      }

      const chapterId = chapterIds[ci];
      const chapterLabel = `Chapter ${ci + 1}/${totalChapters}`;

      broadcast(jobId, 'downloading', chapterProgress(ci, 0, totalChapters), `Fetching pages for ${chapterLabel}…`);

      // 1. Get page URLs
      let pages: PageInfo[];
      try {
        pages = await connector.getPages(chapterId);
      } catch (err) {
        console.error(`[Download] Failed to get pages for chapter ${chapterId}:`, err);
        // Skip this chapter but keep going
        continue;
      }

      if (pages.length === 0) continue;

      // 2. Prepare chapter directory
      const chapterDir = join(mangaDir, sanitizePath(`chapter-${String(ci + 1).padStart(4, '0')}-${chapterId}`));
      await mkdir(chapterDir, { recursive: true });

      // 3. Download pages in batches of CONCURRENT_PAGES
      for (let pi = 0; pi < pages.length; pi += CONCURRENT_PAGES) {
        if (!activeJobs.has(jobId)) {
          await updateJob(jobId, { status: 'cancelled' });
          broadcast(jobId, 'cancelled', 0, 'Download cancelled');
          return;
        }

        const batch = pages.slice(pi, pi + CONCURRENT_PAGES);
        const results = await Promise.allSettled(
          batch.map((page) => downloadPage(page, chapterDir)),
        );
        // Log failed pages but don't abort the job
        for (const r of results) {
          if (r.status === 'rejected') {
            console.warn(`[Download] Skipped page (non-fatal): ${r.reason}`);
          }
        }

        // Update progress
        const pagesDownloaded = Math.min(pi + CONCURRENT_PAGES, pages.length);
        const progress = chapterProgress(ci, pagesDownloaded / pages.length, totalChapters);
        await updateJob(jobId, { progress });
        broadcast(jobId, 'downloading', progress, `${chapterLabel}: ${pagesDownloaded}/${pages.length} pages`);
      }

      // Small delay between chapters to avoid hammering the CDN
      if (ci < totalChapters - 1) {
        await delay(INTER_CHAPTER_DELAY_MS);
      }
    }

    // Done
    await updateJob(jobId, { status: 'completed', progress: 100, outputPath: mangaDir });
    broadcast(jobId, 'completed', 100, 'Download complete');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await failJob(jobId, message);
  } finally {
    activeJobs.delete(jobId);
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function downloadPage(page: PageInfo, destDir: string): Promise<void> {
  const ext = extname(new URL(page.url).pathname) || '.jpg';
  const filename = `page-${String(page.index + 1).padStart(4, '0')}${ext}`;
  const filePath = join(destDir, filename);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const headers: Record<string, string> = {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      };
      if (page.referer) {
        headers['Referer'] = page.referer;
      }

      const res = await fetch(page.url, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const buffer = Buffer.from(await res.arrayBuffer());
      await writeFile(filePath, buffer);
      return; // success
    } catch (err) {
      if (attempt === MAX_RETRIES) {
        console.error(`[Download] Failed page ${page.index} after ${MAX_RETRIES} attempts:`, err);
        throw err;
      }
      await delay(RETRY_DELAY_MS * attempt);
    }
  }
}

/** Calculate overall progress (0-100) given chapter index + intra-chapter fraction. */
function chapterProgress(chapterIndex: number, fractionWithinChapter: number, totalChapters: number): number {
  return Math.round(((chapterIndex + fractionWithinChapter) / totalChapters) * 100);
}

async function updateJob(jobId: string, data: Record<string, unknown>): Promise<void> {
  try {
    await prisma.downloadJob.update({ where: { id: jobId }, data });
  } catch (err) {
    console.error(`[Download] DB update failed for job ${jobId}:`, err);
  }
}

async function failJob(jobId: string, message: string): Promise<void> {
  console.error(`[Download] Job ${jobId} failed: ${message}`);
  await updateJob(jobId, { status: 'failed', error: message });
  broadcast(jobId, 'failed', 0, message);
}

function broadcast(jobId: string, status: string, progress: number, message: string): void {
  broadcastProgress({ type: 'download', jobId, status, progress, message });
}

function sanitizePath(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').substring(0, 200);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
