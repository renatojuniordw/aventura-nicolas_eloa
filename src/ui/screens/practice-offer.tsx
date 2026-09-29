import { buildScreen } from './mount-screen.js';
import { MenuButton } from './menu-button.js';

interface PracticeOfferOptions {
  onPractice: () => void;
  onSkip: () => void;
}

/**
 * First touch play only (docs/18 §8): a gentle, one-time offer to try the
 * controls before the adventure. Declining is as easy as accepting, and the
 * practice stays available in Configurações.
 */
export function buildPracticeOfferScreen({ onPractice, onSkip }: PracticeOfferOptions) {
  return buildScreen(
    <div className="overlay screen practice-offer">
      <h2>Quer treinar os controles?</h2>
      <p>Um minutinho para andar e pular, sem perder corações. Dá para repetir depois em Configurações.</p>
      <div className="overlay-actions">
        <MenuButton className="btn-retro btn-primary-gold" data-autofocus="" onClick={onPractice}>🎮 Treinar</MenuButton>
        <MenuButton className="btn-util" onClick={onSkip}>Já sei, vamos brincar</MenuButton>
      </div>
    </div>,
    { primary: onPractice, back: onSkip },
  );
}
