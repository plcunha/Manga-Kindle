/**
 * Smoke test — validates scraper engine registration and live connectivity.
 *
 * Run: npx tsx packages/scraper/test-smoke.ts
 */
import { engine } from './src/index.js';

const DIVIDER = '─'.repeat(60);

async function main() {
  // ── 1. Registration check ────────────────────────────────────────
  const sources = engine.getSources();
  console.log(`\n${DIVIDER}`);
  console.log(`✓ Total sources registered: ${sources.length}`);
  console.log(DIVIDER);

  // Group by language
  const byLang = new Map<string, number>();
  for (const s of sources) {
    byLang.set(s.language, (byLang.get(s.language) || 0) + 1);
  }
  console.log('By language:');
  for (const [lang, count] of [...byLang.entries()].sort()) {
    console.log(`  ${lang}: ${count}`);
  }

  // ── 2. Live test: MangaDex search ────────────────────────────────
  console.log(`\n${DIVIDER}`);
  console.log('TEST: MangaDex search "solo leveling"');
  console.log(DIVIDER);
  try {
    const mdx = engine.getConnector('mangadex');
    if (!mdx) throw new Error('mangadex connector not found');
    const results = await mdx.search('solo leveling');
    console.log(`  Results: ${results.length}`);
    if (results.length > 0) {
      const first = results[0];
      console.log(`  First: "${first.title}" → ${first.url}`);
      console.log(`  Cover: ${first.cover ? 'yes' : 'no'}`);
    }
  } catch (e: any) {
    console.error(`  ✗ ERROR: ${e.message}`);
  }

  // ── 3. Live test: WPMadara (Toonily) search ──────────────────────
  console.log(`\n${DIVIDER}`);
  console.log('TEST: Toonily (WPMadara) search "solo leveling"');
  console.log(DIVIDER);
  try {
    const toonily = engine.getConnector('toonily');
    if (!toonily) throw new Error('toonily connector not found');
    const results = await toonily.search('solo leveling');
    console.log(`  Results: ${results.length}`);
    if (results.length > 0) {
      const first = results[0];
      console.log(`  First: "${first.title}"`);
      console.log(`  URL: ${first.url}`);
      console.log(`  Cover: ${first.cover ? 'yes' : 'no'}`);

      // ── 3b. getChapters ────────────────────────────────────────
      console.log(`\n  → getChapters("${first.id}")...`);
      const chapters = await toonily.getChapters(first.id);
      console.log(`  Chapters: ${chapters.length}`);
      if (chapters.length > 0) {
        const last = chapters[chapters.length - 1];
        console.log(`  Last chapter: "${last.title}" (#${last.number})`);

        // ── 3c. getPages ───────────────────────────────────────
        console.log(`\n  → getPages("${last.id}")...`);
        const pages = await toonily.getPages(last.id);
        console.log(`  Pages: ${pages.length}`);
        if (pages.length > 0) {
          console.log(`  First image: ${pages[0].url}`);
          console.log(`  Referer: ${pages[0].referer}`);
        }
      }
    }
  } catch (e: any) {
    console.error(`  ✗ ERROR: ${e.message}`);
  }

  // ── 4. Live test: WPMadara (MangaRead) search ────────────────────
  console.log(`\n${DIVIDER}`);
  console.log('TEST: MangaRead (WPMadara) search "one piece"');
  console.log(DIVIDER);
  try {
    const mr = engine.getConnector('mangaread');
    if (!mr) throw new Error('mangaread connector not found');
    const results = await mr.search('one piece');
    console.log(`  Results: ${results.length}`);
    if (results.length > 0) {
      const first = results[0];
      console.log(`  First: "${first.title}"`);
      console.log(`  URL: ${first.url}`);
    }
  } catch (e: any) {
    console.error(`  ✗ ERROR: ${e.message}`);
  }

  // ── 5. Live test: WPMangastream (Luminous Scans) search ─────────
  console.log(`\n${DIVIDER}`);
  console.log('TEST: Luminous Scans (WPMangastream) search "martial"');
  console.log(DIVIDER);
  try {
    const lumi = engine.getConnector('luminousscans');
    if (!lumi) throw new Error('luminousscans connector not found');
    const results = await lumi.search('martial');
    console.log(`  Results: ${results.length}`);
    if (results.length > 0) {
      const first = results[0];
      console.log(`  First: "${first.title}"`);
      console.log(`  URL: ${first.url}`);
    }
  } catch (e: any) {
    console.error(`  ✗ ERROR: ${e.message}`);
  }

  // ── 6. Live test: Coffee Manga (WPMadara) search ─────────────────
  console.log(`\n${DIVIDER}`);
  console.log('TEST: Coffee Manga (WPMadara) search "tower"');
  console.log(DIVIDER);
  try {
    const cm = engine.getConnector('coffeemanga');
    if (!cm) throw new Error('coffeemanga connector not found');
    const results = await cm.search('tower');
    console.log(`  Results: ${results.length}`);
    if (results.length > 0) {
      const first = results[0];
      console.log(`  First: "${first.title}"`);
      console.log(`  URL: ${first.url}`);

      // getChapters
      console.log(`\n  → getChapters("${first.id}")...`);
      const chapters = await cm.getChapters(first.id);
      console.log(`  Chapters: ${chapters.length}`);
      if (chapters.length > 0) {
        const ch = chapters[chapters.length - 1];
        console.log(`  Last: "${ch.title}" (#${ch.number})`);

        // getPages
        console.log(`\n  → getPages("${ch.id}")...`);
        const pages = await cm.getPages(ch.id);
        console.log(`  Pages: ${pages.length}`);
        if (pages.length > 0) {
          console.log(`  First image: ${pages[0].url}`);
        }
      }
    }
  } catch (e: any) {
    console.error(`  ✗ ERROR: ${e.message}`);
  }

  console.log(`\n${DIVIDER}`);
  console.log('SMOKE TEST COMPLETE');
  console.log(DIVIDER);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
