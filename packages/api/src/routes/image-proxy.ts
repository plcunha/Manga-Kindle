/**
 * Image Proxy Route
 *
 * Proxies image requests to external manga CDNs that require specific
 * headers (e.g., Referer) that browsers won't send from cross-origin <img> tags.
 *
 * GET /api/image-proxy?url=<encoded-url>
 *
 * Only whitelisted domains are allowed to prevent open-proxy abuse.
 */
import { Router } from 'express';
import { AppError } from '../middleware/error-handler.js';

export const imageProxyRouter = Router();

// Domains that are allowed to be proxied
const ALLOWED_DOMAINS = [
  // MangaKakalot / Manganato image CDNs
  'avt.mkklcdnv6temp.com',
  'v1.mkklcdnv6tempv5.com',
  'v2.mkklcdnv6tempv5.com',
  'v3.mkklcdnv6tempv5.com',
  'v4.mkklcdnv6tempv5.com',
  'v5.mkklcdnv6tempv5.com',
  'v6.mkklcdnv6tempv5.com',
  'v7.mkklcdnv6tempv5.com',
  'v8.mkklcdnv6tempv5.com',
  'mangakakalot.com',
  'mangakakalot.gg',
  'www.mangakakalot.gg',
  'chapmanganato.to',
  'manganato.gg',
  'www.manganato.gg',
  // MangaSee CDNs
  'temp.compsci88.com',
  'official-ongoing-2.gcdn.co',
  // MangaDex CDNs
  'uploads.mangadex.org',
];

function isDomainAllowed(hostname: string): boolean {
  return ALLOWED_DOMAINS.some(
    (d) => hostname === d || hostname.endsWith(`.${d}`)
  );
}

// GET /api/image-proxy?url=<encoded-url>
imageProxyRouter.get('/', async (req, res) => {
  const imageUrl = req.query.url as string;
  if (!imageUrl) {
    throw new AppError(400, 'Missing "url" query parameter');
  }

  let parsed: URL;
  try {
    parsed = new URL(imageUrl);
  } catch {
    throw new AppError(400, 'Invalid URL');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new AppError(400, 'Only HTTP(S) URLs are allowed');
  }

  if (!isDomainAllowed(parsed.hostname)) {
    throw new AppError(403, `Domain "${parsed.hostname}" is not allowed`);
  }

  try {
    // Determine Referer based on the target domain
    let referer = parsed.origin;
    if (parsed.hostname.includes('mkklcdn') || parsed.hostname.includes('mangakakalot')) {
      referer = 'https://www.mangakakalot.gg';
    } else if (parsed.hostname.includes('manganato')) {
      referer = 'https://www.manganato.gg';
    } else if (parsed.hostname.includes('chapmanganato')) {
      referer = 'https://www.manganato.gg';
    }

    const upstream = await fetch(imageUrl, {
      headers: {
        'Referer': referer,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
      redirect: 'follow',
    });

    if (!upstream.ok) {
      res.status(upstream.status).end();
      return;
    }

    // Forward content-type and cache headers
    const contentType = upstream.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);

    const contentLength = upstream.headers.get('content-length');
    if (contentLength) res.setHeader('Content-Length', contentLength);

    // Cache for 1 hour
    res.setHeader('Cache-Control', 'public, max-age=3600, immutable');

    // Stream the image body
    if (upstream.body) {
      const reader = upstream.body.getReader();
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      };
      await pump();
    } else {
      // Fallback: buffer the whole response (shouldn't happen with modern fetch)
      const buffer = Buffer.from(await upstream.arrayBuffer());
      res.end(buffer);
    }
  } catch (err) {
    if (!res.headersSent) {
      throw new AppError(502, 'Failed to fetch upstream image');
    }
  }
});
