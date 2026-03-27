/**
 * End-to-end test: download Chainsaw Man chapter 1 from MangaDex.
 *
 * Usage:  npx tsx packages/api/test-download.ts
 *
 * 1. Searches MangaDex for "chainsaw man"
 * 2. Picks the first result
 * 3. Gets its chapters
 * 4. Picks chapter 1
 * 5. Creates a download job via the API
 * 6. Polls the job until it finishes
 */
import 'dotenv/config';
import { engine } from '@manga-kindle/scraper';
// We drive the download service directly (no HTTP server needed for this test)
import { prisma } from './src/services/db.js';
import { runDownloadJob } from './src/services/download-service.js';
async function main() {
    console.log('--- E2E Download Test ---\n');
    // 1. Search
    const connector = engine.getConnector('mangadex');
    console.log('[1] Searching MangaDex for "chainsaw man"…');
    const results = await connector.search('chainsaw man');
    console.log(`    Found ${results.length} results`);
    const manga = results[0];
    if (!manga)
        throw new Error('No search results');
    console.log(`    Using: "${manga.title}" (${manga.id})\n`);
    // 2. Get chapters
    console.log('[2] Fetching chapters…');
    const chapters = await connector.getChapters(manga.id);
    console.log(`    Found ${chapters.length} chapters`);
    // Find chapter 1 (or the lowest numbered chapter)
    const ch1 = chapters.find((c) => c.number === 1) || chapters[0];
    if (!ch1)
        throw new Error('No chapters found');
    console.log(`    Downloading: "${ch1.title}" (number: ${ch1.number}, id: ${ch1.id})\n`);
    // 3. Upsert Source + Manga in DB (mimic what the route does)
    const src = connector.source;
    await prisma.source.upsert({
        where: { url: src.url },
        update: {},
        create: { id: src.id, name: src.name, url: src.url, language: src.language, type: src.type, enabled: src.enabled },
    });
    const dbManga = await prisma.manga.upsert({
        where: { sourceId_url: { sourceId: src.id, url: manga.url } },
        update: { title: manga.title },
        create: {
            id: manga.id,
            sourceId: src.id,
            title: manga.title,
            url: manga.url,
            cover: manga.cover ?? null,
            synopsis: manga.synopsis ?? null,
            status: manga.status ?? 'unknown',
        },
    });
    // 4. Create DownloadJob
    const job = await prisma.downloadJob.create({
        data: {
            mangaId: dbManga.id,
            sourceId: src.id,
            chapterIds: JSON.stringify([ch1.id]),
            status: 'queued',
            progress: 0,
        },
    });
    console.log(`[3] Created download job: ${job.id}\n`);
    // 5. Run the download
    console.log('[4] Running download…');
    const start = Date.now();
    await runDownloadJob({
        jobId: job.id,
        sourceId: src.id,
        mangaId: manga.id,
        chapterIds: [ch1.id],
    });
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    // 6. Check final status
    const final = await prisma.downloadJob.findUnique({ where: { id: job.id } });
    console.log(`\n[5] Finished in ${elapsed}s`);
    console.log(`    Status:  ${final?.status}`);
    console.log(`    Progress: ${final?.progress}%`);
    console.log(`    Output:  ${final?.outputPath || '(none)'}`);
    if (final?.error)
        console.log(`    Error:   ${final.error}`);
    await prisma.$disconnect();
    process.exit(final?.status === 'completed' ? 0 : 1);
}
main().catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
});
//# sourceMappingURL=test-download.js.map