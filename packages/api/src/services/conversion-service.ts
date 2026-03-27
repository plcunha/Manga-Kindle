/**
 * Conversion Service — KCC (Kindle Comic Converter) wrapper
 *
 * Invokes the `kcc-c2e` Python CLI to convert a directory of manga images
 * into EPUB, MOBI, AZW3, CBZ, or PDF for e-reader devices.
 *
 * KCC docs: https://github.com/ciromattia/kcc
 *
 * CLI synopsis (kcc-c2e):
 *   kcc-c2e [options] <input>
 *     -p PROFILE  Device profile (KPW5, KO, KS, etc.)
 *     -m          Manga mode (right-to-left reading)
 *     -u          Upscale small images
 *     -s          Stretch images to device resolution
 *     -r SPLIT    Split mode: 0=none, 1=auto, 2=always
 *     --forcecolor  Keep color (default is grayscale for Kindle)
 *     -f FORMAT   Output format: EPUB, MOBI, AZW3, CBZ, KFX (default: EPUB)
 *     -o OUTPUT   Output directory
 *     -t TITLE    Book title
 */
import { execFile } from 'child_process';
import { mkdir, access, readdir } from 'fs/promises';
import { join, basename } from 'path';
import { prisma } from './db.js';
import { broadcastProgress } from './websocket.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const KCC_PATH = process.env.KCC_PATH || 'kcc-c2e';
const CONVERTED_DIR = process.env.CONVERTED_DIR || './converted';

// Valid device profiles supported by KCC
export const DEVICE_PROFILES = [
  { id: 'KPW5', name: 'Kindle Paperwhite 5', resolution: '1236x1648' },
  { id: 'KO', name: 'Kindle Oasis 2/3', resolution: '1264x1680' },
  { id: 'KS', name: 'Kindle Scribe', resolution: '1860x2480' },
  { id: 'KV', name: 'Kindle Voyage', resolution: '1072x1448' },
  { id: 'K578', name: 'Kindle (2019-2022)', resolution: '1072x1448' },
  { id: 'KoMT', name: 'Kobo Mini/Touch', resolution: '600x800' },
  { id: 'KoG', name: 'Kobo Glo', resolution: '768x1024' },
  { id: 'KoA', name: 'Kobo Aura', resolution: '758x1024' },
  { id: 'KoF', name: 'Kobo Forma', resolution: '1440x1920' },
  { id: 'KoS', name: 'Kobo Sage', resolution: '1440x1920' },
] as const;

export type DeviceProfileId = (typeof DEVICE_PROFILES)[number]['id'];

const VALID_FORMATS = ['EPUB', 'MOBI', 'AZW3', 'CBZ', 'PDF'] as const;
export type OutputFormat = (typeof VALID_FORMATS)[number];

// ---------------------------------------------------------------------------
// Active-job tracking (for cancellation)
// ---------------------------------------------------------------------------

const activeJobs = new Map<string, { abort: () => void }>();

export function cancelConversion(jobId: string): void {
  const entry = activeJobs.get(jobId);
  if (entry) {
    entry.abort();
    activeJobs.delete(jobId);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface StartConversionOpts {
  jobId: string;
  downloadJobId: string;
  format?: string;
  deviceProfile?: string;
  mangaMode?: boolean;
  title?: string;
}

/**
 * Run a KCC conversion job (fire-and-forget).
 * Updates the ConversionJob row in Prisma and broadcasts WebSocket events.
 */
export async function runConversionJob(opts: StartConversionOpts): Promise<void> {
  const { jobId, downloadJobId } = opts;
  const format = normalizeFormat(opts.format);
  const profile = opts.deviceProfile || 'KPW5';
  const mangaMode = opts.mangaMode !== false; // default true

  try {
    // 1. Validate the download job exists and is completed
    const dlJob = await prisma.downloadJob.findUnique({ where: { id: downloadJobId } });
    if (!dlJob) {
      await failJob(jobId, `Download job "${downloadJobId}" not found`);
      return;
    }
    if (dlJob.status !== 'completed' || !dlJob.outputPath) {
      await failJob(jobId, `Download job "${downloadJobId}" is not completed (status: ${dlJob.status})`);
      return;
    }

    // 2. Verify the download directory exists and has chapter subdirectories
    const inputDir = dlJob.outputPath;
    try {
      await access(inputDir);
    } catch {
      await failJob(jobId, `Download directory not found: ${inputDir}`);
      return;
    }

    const entries = await readdir(inputDir, { withFileTypes: true });
    const chapterDirs = entries.filter((e) => e.isDirectory());
    if (chapterDirs.length === 0) {
      await failJob(jobId, `No chapter directories found in: ${inputDir}`);
      return;
    }

    // 3. Prepare output directory
    await mkdir(CONVERTED_DIR, { recursive: true });

    // Build KCC title from manga info or directory name
    const title = opts.title || basename(inputDir);

    // 4. Build KCC command arguments
    const args: string[] = [
      '-p', profile,
      '-f', format,
      '-o', CONVERTED_DIR,
      '-t', title,
      '-r', '2',         // split double-page spreads
      '-u',              // upscale small images
    ];
    if (mangaMode) {
      args.push('-m');   // right-to-left reading
    }
    args.push(inputDir);

    // 5. Update status to converting
    await updateJob(jobId, { status: 'converting', progress: 10 });
    broadcast(jobId, 'converting', 10, `Starting KCC conversion (${format}, profile: ${profile})…`);

    // 6. Execute KCC
    console.log(`[Conversion] Running: ${KCC_PATH} ${args.join(' ')}`);

    const outputFile = await runKcc(jobId, KCC_PATH, args);

    // 7. Done
    await updateJob(jobId, { status: 'completed', progress: 100, outputPath: outputFile ?? CONVERTED_DIR });
    broadcast(jobId, 'completed', 100, 'Conversion complete');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await failJob(jobId, message);
  } finally {
    activeJobs.delete(jobId);
  }
}

// ---------------------------------------------------------------------------
// KCC subprocess execution
// ---------------------------------------------------------------------------

function runKcc(jobId: string, command: string, args: string[]): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const child = execFile(command, args, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      activeJobs.delete(jobId);

      if (err) {
        console.error(`[Conversion] KCC stderr:\n${stderr}`);
        console.error(`[Conversion] KCC stdout:\n${stdout}`);
        reject(new Error(`KCC failed: ${err.message}\n${stderr}`));
        return;
      }

      console.log(`[Conversion] KCC output:\n${stdout}`);

      // Try to extract output file path from KCC stdout
      // KCC typically prints: "Saving images to: /path/to/output.epub"
      const match = stdout.match(/Saving to[:\s]+(.+\.\w+)/i)
        || stdout.match(/Output[:\s]+(.+\.\w+)/i);
      const outputFile = match?.[1]?.trim() ?? null;

      resolve(outputFile);
    });

    // Track for cancellation
    activeJobs.set(jobId, {
      abort: () => {
        child.kill('SIGTERM');
      },
    });

    // Fake progress updates while KCC runs (it doesn't emit progress)
    let progress = 10;
    const timer = setInterval(() => {
      if (!activeJobs.has(jobId)) {
        clearInterval(timer);
        return;
      }
      progress = Math.min(progress + 5, 90);
      updateJob(jobId, { progress }).catch(() => {});
      broadcast(jobId, 'converting', progress, 'KCC processing…');
    }, 3000);

    child.on('exit', () => clearInterval(timer));
  });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function normalizeFormat(format?: string): OutputFormat {
  const upper = (format || 'EPUB').toUpperCase();
  if ((VALID_FORMATS as readonly string[]).includes(upper)) {
    return upper as OutputFormat;
  }
  return 'EPUB';
}

async function updateJob(jobId: string, data: Record<string, unknown>): Promise<void> {
  try {
    await prisma.conversionJob.update({ where: { id: jobId }, data });
  } catch (err) {
    console.error(`[Conversion] DB update failed for job ${jobId}:`, err);
  }
}

async function failJob(jobId: string, message: string): Promise<void> {
  console.error(`[Conversion] Job ${jobId} failed: ${message}`);
  await updateJob(jobId, { status: 'failed', error: message });
  broadcast(jobId, 'failed', 0, message);
}

function broadcast(jobId: string, status: string, progress: number, message: string): void {
  broadcastProgress({ type: 'conversion', jobId, status, progress, message });
}
