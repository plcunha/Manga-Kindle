import type { FlatMangaSiteConfig } from '../templates/types.js';

/**
 * FlatManga-based site configurations.
 * Sites use flat AZ listing with base64-encoded image attributes.
 *
 * 6 sites
 */
export const flatMangaSites: FlatMangaSiteConfig[] = [
  {
    id: 'mangakakalots',
    label: 'MangaKakalots',
    url: 'https://mangakakalots.com',
    language: 'en',
  },
  {
    id: 'manganelo',
    label: 'Manganelo',
    url: 'https://manganelo.com',
    language: 'en',
  },
  {
    id: 'manganato',
    label: 'Manganato',
    url: 'https://manganato.com',
    language: 'en',
  },
  {
    id: 'readmanganato',
    label: 'ReadManganato',
    url: 'https://readmanganato.com',
    language: 'en',
  },
  {
    id: 'mangabat',
    label: 'MangaBat',
    url: 'https://mangabat.com',
    language: 'en',
  },
  {
    id: 'oremanga',
    label: 'OreManga',
    url: 'https://oremanga.org',
    language: 'th',
  },
];
