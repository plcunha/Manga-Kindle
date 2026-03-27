import { Router } from 'express';
import { createReadStream, existsSync, statSync } from 'fs';
import { basename } from 'path';
import { prisma } from '../services/db.js';
import {
  runConversionJob,
  cancelConversion,
  DEVICE_PROFILES,
} from '../services/conversion-service.js';
import { AppError } from '../middleware/error-handler.js';

export const conversionsRouter = Router();

// ---------------------------------------------------------------------------
// GET /api/conversions/profiles — List available KCC device profiles
// (must be registered before the /:id route)
// ---------------------------------------------------------------------------
conversionsRouter.get('/profiles', async (_req, res) => {
  res.json({ profiles: DEVICE_PROFILES });
});

// ---------------------------------------------------------------------------
// POST /api/conversions — Start a new conversion job
// ---------------------------------------------------------------------------
conversionsRouter.post('/', async (req, res) => {
  const { downloadJobId, format, deviceProfile, mangaMode, title } = req.body as {
    downloadJobId?: string;
    format?: string;
    deviceProfile?: string;
    mangaMode?: boolean;
    title?: string;
  };

  if (!downloadJobId) {
    throw new AppError(400, 'downloadJobId is required');
  }

  // Verify the download job exists
  const dlJob = await prisma.downloadJob.findUnique({ where: { id: downloadJobId } });
  if (!dlJob) {
    throw new AppError(404, `Download job "${downloadJobId}" not found`);
  }

  // Create the conversion job record
  const job = await prisma.conversionJob.create({
    data: {
      downloadJobId,
      format: (format || 'EPUB').toUpperCase(),
      deviceProfile: deviceProfile || 'KPW5',
      status: 'queued',
      progress: 0,
    },
  });

  // Fire-and-forget
  runConversionJob({
    jobId: job.id,
    downloadJobId,
    format,
    deviceProfile,
    mangaMode,
    title,
  }).catch((err) => {
    console.error(`[Conversions] Uncaught error in job ${job.id}:`, err);
  });

  res.status(201).json({ job });
});

// ---------------------------------------------------------------------------
// GET /api/conversions — List all conversion jobs
// ---------------------------------------------------------------------------
conversionsRouter.get('/', async (_req, res) => {
  const jobs = await prisma.conversionJob.findMany({
    orderBy: { createdAt: 'desc' },
    include: { downloadJob: true },
  });
  res.json({ jobs });
});

// ---------------------------------------------------------------------------
// GET /api/conversions/:id/download — Download the converted file
// ---------------------------------------------------------------------------
conversionsRouter.get('/:id/download', async (req, res) => {
  const job = await prisma.conversionJob.findUnique({
    where: { id: req.params.id },
  });

  if (!job) throw new AppError(404, 'Conversion job not found');
  if (job.status !== 'completed' || !job.outputPath) {
    throw new AppError(400, 'Conversion is not completed or has no output file');
  }

  // Verify file exists on disk
  if (!existsSync(job.outputPath)) {
    throw new AppError(404, `Output file not found on disk: ${job.outputPath}`);
  }

  const stat = statSync(job.outputPath);
  const filename = basename(job.outputPath);

  // Determine content type from extension
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const contentTypes: Record<string, string> = {
    epub: 'application/epub+zip',
    mobi: 'application/x-mobipocket-ebook',
    azw3: 'application/x-mobi8-ebook',
    cbz: 'application/x-cbz',
    pdf: 'application/pdf',
  };

  res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
  res.setHeader('Content-Length', stat.size);

  const stream = createReadStream(job.outputPath);
  stream.pipe(res);
});

// ---------------------------------------------------------------------------
// GET /api/conversions/:id — Get a single conversion job
// ---------------------------------------------------------------------------
conversionsRouter.get('/:id', async (req, res) => {
  const job = await prisma.conversionJob.findUnique({
    where: { id: req.params.id },
    include: { downloadJob: true },
  });

  if (!job) throw new AppError(404, 'Conversion job not found');
  res.json({ job });
});

// ---------------------------------------------------------------------------
// DELETE /api/conversions/:id — Cancel a conversion job
// ---------------------------------------------------------------------------
conversionsRouter.delete('/:id', async (req, res) => {
  const { id } = req.params;

  const job = await prisma.conversionJob.findUnique({ where: { id } });
  if (!job) throw new AppError(404, 'Conversion job not found');

  if (job.status === 'converting' || job.status === 'queued') {
    cancelConversion(id);
    await prisma.conversionJob.update({
      where: { id },
      data: { status: 'cancelled' },
    });
  }

  res.json({ message: `Conversion job ${id} cancelled` });
});
