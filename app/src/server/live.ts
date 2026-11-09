// Server-sent events: the live map, the phone app and the door staff page
// all listen here for the clock, room status, capybara moves and Plan B
// decisions.
import type { FastifyReply } from 'fastify';
import type { StreamEvent } from '../shared/live-types';

class LiveHub {
  private clients = new Set<FastifyReply>();

  add(reply: FastifyReply, first: StreamEvent) {
    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    this.write(reply, first);
    this.clients.add(reply);
    const keepAlive = setInterval(() => reply.raw.write(': keep-alive\n\n'), 15_000);
    reply.raw.on('close', () => {
      clearInterval(keepAlive);
      this.clients.delete(reply);
    });
  }

  private write(reply: FastifyReply, event: StreamEvent) {
    reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
  }

  broadcast(event: StreamEvent) {
    for (const client of this.clients) this.write(client, event);
  }

  get size() {
    return this.clients.size;
  }
}

export const hub = new LiveHub();
