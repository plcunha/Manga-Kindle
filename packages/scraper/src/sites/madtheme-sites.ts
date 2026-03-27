import type { MadThemeSiteConfig } from '../templates/types.js';

/**
 * MadTheme-based site configurations.
 * MadTheme is a manga CMS with paginated AZ listings and
 * chapter images served via window.chapImages + window.mainServer.
 *
 * 8 sites
 */
export const madThemeSites: MadThemeSiteConfig[] = [
  {
    id: 'mangabuddy',
    label: 'MangaBuddy',
    url: 'https://mangabuddy.com',
    language: 'en',
  },
  {
    id: 'mangaforest',
    label: 'MangaForest',
    url: 'https://mangaforest.me',
    language: 'en',
  },
  {
    id: 'mangamirror',
    label: 'MangaMirror',
    url: 'https://mangamirror.com',
    language: 'en',
  },
  {
    id: 'mangatx-mt',
    label: 'MangaTX (MadTheme)',
    url: 'https://mangatx.org',
    language: 'en',
  },
  {
    id: 'mangamonk',
    label: 'MangaMonk',
    url: 'https://mangamonk.com',
    language: 'en',
  },
  {
    id: 'mangaread-mt',
    label: 'MangaRead (MadTheme)',
    url: 'https://mangaread.org',
    language: 'en',
  },
  {
    id: 'zinmanga-mt',
    label: 'ZinManga (MadTheme)',
    url: 'https://zinmanga.com',
    language: 'en',
  },
  {
    id: 'mangaclash-mt',
    label: 'MangaClash (MadTheme)',
    url: 'https://mangaclash.com',
    language: 'en',
  },
];
