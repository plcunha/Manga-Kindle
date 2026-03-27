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
sourcesRouter.get('/', async (_req, res) => {
  const sources = engine.getSources();
  res.json({ sources: sources.map(mapSource) });
});

// GET /api/sources/:id - Get source details
sourcesRouter.get('/:id', async (req, res) => {
  const { id } = req.params;
  const source = engine.getSource(id);

  if (!source) {
    throw new AppError(404, `Source "${id}" not found`);
  }

  res.json({ source: mapSource(source) });
});
