import type { FoolSlideSiteConfig } from '../templates/types.js';

/**
 * FoolSlide-based site configurations.
 * FoolSlide is a self-hosted manga reader popular with scanlation groups.
 *
 * 9 sites
 */
export const foolSlideSites: FoolSlideSiteConfig[] = [
  {
    id: 'sensescans',
    label: 'Sense Scans',
    url: 'https://sensescans.com',
    path: '/reader/directory/',
    language: 'en',
  },
  {
    id: 'silentskyscans',
    label: 'Silent Sky Scans',
    url: 'https://reader.silentsky-scans.net',
    language: 'en',
  },
  {
    id: 'deathtollscans',
    label: 'Death Toll Scans',
    url: 'https://reader.deathtollscans.net',
    language: 'en',
  },
  {
    id: 'tukimoop',
    label: 'Tuki Scans',
    url: 'https://tukimoop.pw',
    path: '/reader/directory/',
    language: 'en',
  },
  {
    id: 'hni-scantrad',
    label: 'HNI-Scantrad',
    url: 'https://hni-scantrad.com',
    path: '/lel/directory/',
    language: 'fr',
  },
  {
    id: 'lecercleduscan',
    label: 'Le Cercle du Scan',
    url: 'https://lel.lecercleduscan.com',
    language: 'fr',
  },
  {
    id: 'phoenixscans',
    label: 'Phoenix Scans',
    url: 'https://www.phoenixscans.com',
    path: '/reader/directory/',
    language: 'it',
  },
  {
    id: 'tuttoanimemanga',
    label: 'Tutto Anime Manga',
    url: 'https://tuttoanimemanga.net',
    path: '/slide/directory/',
    language: 'it',
  },
  {
    id: 'menudofansub',
    label: 'Menudo Fansub',
    url: 'https://www.menudo-fansub.com',
    path: '/slide/directory/',
    language: 'es',
  },
];
