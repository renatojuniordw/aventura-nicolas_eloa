import { overlap, type Box } from '../physics/aabb.js';
import type { Discovery } from '../content/discoveries.js';

/** Contact activates once; leaving and returning allows free repetition. */
export class DiscoveryRun {
  private touching = new Set<string>();
  private cooldown = 0;
  active: Discovery | null = null;
  animation = 0;

  constructor(readonly objects: Discovery[]) {}

  update(body: Box, dt: number): Discovery | null {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.animation = Math.max(0, this.animation - dt);
    const contact = this.objects.filter((item) => overlap(body, item));
    const discovered = contact.find((item) => !this.touching.has(item.id));
    this.touching = new Set(contact.map((item) => item.id));
    if (!discovered || this.cooldown > 0) return null;
    this.active = discovered;
    this.cooldown = 1.5;
    this.animation = 1.2;
    return discovered;
  }
}
