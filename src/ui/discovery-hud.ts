export class DiscoveryHud {
  private root: HTMLElement;
  private title: HTMLElement;
  private message: HTMLElement;
  constructor() {
    this.root = document.createElement('aside');
    this.root.className = 'discovery-hud';
    this.root.setAttribute('role', 'status');
    this.root.setAttribute('aria-live', 'polite');
    this.root.setAttribute('aria-atomic', 'true');
    this.title = document.createElement('strong');
    this.message = document.createElement('span');
    this.root.append(this.title, this.message);
    document.querySelector('.game-viewport')?.append(this.root);
    this.show('Quintal de descobertas', 'Ande e pule perto das figuras. Você pode brincar em qualquer ordem.');
  }
  show(title: string, message: string, discovered = false): void {
    this.title.textContent = title;
    this.message.textContent = message;
    this.root.classList.toggle('discovery-hud-active', discovered);
  }
  destroy(): void { this.root.remove(); }
}
