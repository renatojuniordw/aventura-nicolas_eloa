export class DiscoveryHud {
  private root: HTMLElement;
  private title: HTMLElement;
  private message: HTMLElement;
  private progress: HTMLElement;
  constructor() {
    this.root = document.createElement('aside');
    this.root.className = 'discovery-hud';
    this.root.setAttribute('role', 'status');
    this.root.setAttribute('aria-live', 'polite');
    this.root.setAttribute('aria-atomic', 'true');
    this.title = document.createElement('strong');
    this.message = document.createElement('span');
    this.progress = document.createElement('span');
    this.root.append(this.title, this.message, this.progress);
    document.querySelector('.game-viewport')?.append(this.root);
    this.show('Quintal de descobertas', 'Ande e pule perto das figuras. Você pode brincar em qualquer ordem.');
  }
  show(title: string, message: string, discovered = false): void {
    this.title.textContent = title;
    this.message.textContent = message;
    this.root.classList.toggle('discovery-hud-active', discovered);
  }
  updateProgress(found: number, total: number): void {
    this.progress.textContent = found === total
      ? `Você encontrou as ${total} descobertas! Pode continuar brincando e revisitar suas favoritas.`
      : `Descobertas: ${found} de ${total} · Explore também as plataformas!`;
  }
  destroy(): void { this.root.remove(); }
}
