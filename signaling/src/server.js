import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { RoomManager } from './room-manager.js';

/**
 * Wires socket.io to the RoomManager. This is the only file allowed to know
 * about socket.io — everything that decides *what* happens to a message
 * lives in RoomManager, unit tested on its own without a real socket.
 */
export function createSignalingServer({ port = 3001, corsOrigin = false } = {}) {
  const httpServer = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('ok');
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const io = new Server(httpServer, {
    cors: corsOrigin ? { origin: corsOrigin } : undefined,
    // Small, fixed payloads only (see docs/12 §2) — reject anything else
    // outright instead of buffering an oversized frame.
    maxHttpBufferSize: 4 * 1024,
  });

  const rooms = new RoomManager();

  io.on('connection', (socket) => {
    socket.on('join', (payload) => {
      const result = rooms.join(socket, payload);
      if (!result.ok) socket.emit('join-error', { error: result.error });
    });

    socket.on('action', (payload) => {
      rooms.action(socket, payload);
    });

    socket.on('disconnect', () => {
      rooms.disconnect(socket);
    });
  });

  return {
    listen: () => httpServer.listen(port, () => {
      // eslint-disable-next-line no-console
      console.log(`signaling server listening on :${port}`);
    }),
    close: () => new Promise((resolve) => io.close(() => resolve())),
    rooms,
  };
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const port = Number(process.env.PORT) || 3001;
  createSignalingServer({ port }).listen();
}
