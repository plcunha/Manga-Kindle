import type { GenkanSiteConfig } from '../templates/types.js';

/**
 * Genkan-based site configurations.
 * Genkan is a manga CMS with paginated comic listings.
 *
 * 7 sites
 */
export const genkanSites: GenkanSiteConfig[] = [
  {
    id: 'leviatanscans',
    label: 'Leviatan Scans',
    url: 'https://lscomic.com',
    language: 'en',
  },
  {
    id: 'reaperscans',
    label: 'Reaper Scans',
    url: 'https://reaperscans.com',
    language: 'en',
  },
  {
    id: 'zeroscans',
    label: 'Zero Scans',
    url: 'https://zeroscans.com',
    language: 'en',
  },
  {
    id: 'methodscans',
    label: 'Method Scans',
    url: 'https://methodscans.com',
    language: 'en',
  },
  {
    id: 'skscans',
    label: 'SK Scans',
    url: 'https://skscans.com',
    language: 'en',
  },
  {
    id: 'hunlightscans',
    label: 'Hunlight Scans',
    url: 'https://hunlightscans.com',
    language: 'en',
  },
  {
    id: 'nightcomic',
    label: 'Night Comic',
    url: 'https://nightcomic.com',
    language: 'en',
  },
];
