import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { sourcesRouter } from './routes/sources.js';
import { mangaRouter } from './routes/manga.js';
import { downloadsRouter } from './routes/downloads.js';
import { conversionsRouter } from './routes/conversions.js';
import { settingsRouter } from './routes/settings.js';
import { imageProxyRouter } from './routes/image-proxy.js';
import { errorHandler } from './middleware/error-handler.js';
import { setupWebSocket } from './services/websocket.js';

const app = express();
const server = createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/sources', sourcesRouter);
app.use('/api/manga', mangaRouter);
app.use('/api/downloads', downloadsRouter);
app.use('/api/conversions', conversionsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/image-proxy', imageProxyRouter);

// Error handler (must be last)
app.use(errorHandler);

// WebSocket for real-time progress
setupWebSocket(server);

const PORT = parseInt(process.env.PORT || '3001', 10);
server.listen(PORT, () => {
  console.log(`[API] Server running on http://localhost:${PORT}`);
});

export { app, server };
