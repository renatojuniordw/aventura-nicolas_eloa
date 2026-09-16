import { describe, it, expect, vi } from 'vitest';
import { EventBus } from './event-bus.js';

describe('EventBus', () => {
  it('calls subscribers with the payload', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('ping', handler);
    bus.emit('ping', { n: 1 });
    expect(handler).toHaveBeenCalledWith({ n: 1 });
  });

  it('stops calling after unsubscribe', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    const off = bus.on('ping', handler);
    off();
    bus.emit('ping');
    expect(handler).not.toHaveBeenCalled();
  });

  it('once fires a single time', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.once('ping', handler);
    bus.emit('ping');
    bus.emit('ping');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('allows handlers to unsubscribe during dispatch', () => {
    const bus = new EventBus();
    const first = vi.fn(() => off());
    const second = vi.fn();
    const off = bus.on('ping', first);
    bus.on('ping', second);
    bus.emit('ping');
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('clear removes all handlers', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('ping', handler);
    bus.clear();
    bus.emit('ping');
    expect(handler).not.toHaveBeenCalled();
  });
});
