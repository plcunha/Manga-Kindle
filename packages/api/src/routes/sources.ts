import { Router } from 'express';
import { engine } from '@manga-kindle/scraper';
import type { Source } from '@manga-kindle/scraper';
import { AppError } from '../middleware/error-handler.js';

export const sourcesRouter = Router();

function mapSource(s: Source) {
  return {
    id: s.id,
    name: s.name,
    url: s.url,
    language: s.language,
    nsfw: false,
  };
}

// GET /api/sources - List all available manga/anime sources
// Query params:
//   ?language=en,pt  — filter by language (comma-separated ISO 639-1 codes)
sourcesRouter.get('/', async (req, res) => {
  let sources = engine.getSources();

  const langParam = req.query.language;
  if (typeof langParam === 'string' && langParam.trim()) {
    const langs = new Set(
      langParam.split(',').map((l) => l.trim().toLowerCase()).filter(Boolean),
    );
    sources = sources.filter((s) => langs.has(s.language.toLowerCase()));
  }

  res.json({
    sources: sources.map(mapSource),
    languages: getAvailableLanguages(),
  });
});

/** Returns sorted list of unique languages across all registered sources */
function getAvailableLanguages(): string[] {
  const langs = new Set(engine.getSources().map((s) => s.language));
  return [...langs].sort();
}

// GET /api/sources/:id - Get source details
sourcesRouter.get('/:id', async (req, res) => {
  const { id } = req.params;
  const source = engine.getSource(id);

  if (!source) {
    throw new AppError(404, `Source "${id}" not found`);
  }

  res.json({ source: mapSource(source) });
});
