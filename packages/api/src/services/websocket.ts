import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

const clients = new Set<WebSocket>();

export function setupWebSocket(server: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log(`[WS] Client connected (${clients.size} total)`);

    ws.on('close', () => {
      clients.delete(ws);
      console.log(`[WS] Client disconnected (${clients.size} total)`);
    });

    ws.on('error', (err) => {
      console.error('[WS] Error:', err.message);
      clients.delete(ws);
    });
  });

  return wss;
}

/**
 * Broadcast a progress event to all connected WebSocket clients
 */
export function broadcastProgress(event: {
  type: 'download' | 'conversion';
  jobId: string;
  status: string;
  progress: number;
  message?: string;
}): void {
  const payload = JSON.stringify(event);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}
