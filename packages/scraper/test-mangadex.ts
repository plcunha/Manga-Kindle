import { MangaDexConnector } from './src/connectors/mangadex.js';

async function main() {
  console.log('Starting MangaDex test...');
  const md = new MangaDexConnector();

  try {
    const results = await md.search('chainsaw man');
    console.log(`Search results: ${results.length}`);
    if (results.length > 0) {
      console.log(`First result: ${results[0].title}`);
      console.log(`Cover: ${results[0].cover}`);
      console.log(`Status: ${results[0].status}`);
    }

    if (results.length > 0) {
      const chapters = await md.getChapters(results[0].id);
      console.log(`Chapters: ${chapters.length}`);
      if (chapters.length > 0) {
        console.log(`First chapter: ${chapters[0].title} (${chapters[0].number})`);

        const pages = await md.getPages(chapters[0].id);
        console.log(`Pages: ${pages.length}`);
        if (pages.length > 0) {
          console.log(`First page URL: ${pages[0].url.substring(0, 80)}...`);
        }
      }
    }
  } catch (e) {
    console.error('Error:', e);
  }
}

main();
