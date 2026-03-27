import type { MangaReaderCMSSiteConfig } from '../templates/types.js';

/**
 * MangaReaderCMS-based site configurations.
 * These sites use the MangaReaderCMS with AJAX manga listing and
 * base64-encoded or direct image sources.
 *
 * 6 sites
 */
export const mangaReaderCMSSites: MangaReaderCMSSiteConfig[] = [
  {
    id: 'mangareader',
    label: 'MangaReader',
    url: 'https://www.mangareader.cc',
    language: 'en',
  },
  {
    id: 'readmng',
    label: 'ReadMng',
    url: 'https://www.readmng.com',
    language: 'en',
  },
  {
    id: 'mangainn',
    label: 'MangaInn',
    url: 'https://www.mangainn.net',
    language: 'en',
  },
  {
    id: 'ninemanga-en',
    label: 'NineManga (EN)',
    url: 'https://en.ninemanga.com',
    language: 'en',
  },
  {
    id: 'ninemanga-es',
    label: 'NineManga (ES)',
    url: 'https://es.ninemanga.com',
    language: 'es',
  },
  {
    id: 'ninemanga-pt',
    label: 'NineManga (PT)',
    url: 'https://pt.ninemanga.com',
    language: 'pt',
  },
];
