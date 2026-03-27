import { Router } from 'express';
import { prisma } from '../services/db.js';
import { AppError } from '../middleware/error-handler.js';

export const settingsRouter = Router();

// ---------------------------------------------------------------------------
// GET /api/settings — Get all user preferences
// ---------------------------------------------------------------------------
settingsRouter.get('/', async (_req, res) => {
  const prefs = await prisma.userPreference.findMany();

  // Convert rows to a key-value object for easier frontend consumption
  const settings: Record<string, string> = {};
  for (const p of prefs) {
    settings[p.key] = p.value;
  }

  res.json({ settings });
});

// ---------------------------------------------------------------------------
// PUT /api/settings — Upsert one or more user preferences
// Body: { settings: { key: value, ... } }
// ---------------------------------------------------------------------------
settingsRouter.put('/', async (req, res) => {
  const { settings } = req.body as { settings?: Record<string, string> };

  if (!settings || typeof settings !== 'object') {
    throw new AppError(400, 'Body must contain a "settings" object with key-value pairs');
  }

  const entries = Object.entries(settings);
  if (entries.length === 0) {
    throw new AppError(400, 'At least one setting is required');
  }

  // Upsert each key-value pair
  const upserted = await Promise.all(
    entries.map(([key, value]) =>
      prisma.userPreference.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      }),
    ),
  );

  // Return updated settings as flat object
  const result: Record<string, string> = {};
  for (const p of upserted) {
    result[p.key] = p.value;
  }

  res.json({ settings: result });
});
