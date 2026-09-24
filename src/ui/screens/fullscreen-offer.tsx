import { useState, useRef, useEffect } from 'react';
import { buildScreen } from './mount-screen.js';
import { MenuButton } from './menu-button.js';
import { enterFullscreen } from '../fullscreen.js';

function FullscreenOffer({ onDone }: { onDone: () => void }) {
  const active = useRef(true);
  useEffect(() => () => { active.current = false; }, []);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const accept = async () => {
    setPending(true);
    // Keep this call in the native click handler: fullscreen needs user activation.
    const entered = await enterFullscreen();
    if (!active.current) return;
    if (entered) onDone();
    else { setPending(false); setFailed(true); }
  };
  return <section className="overlay fullscreen-offer" role="dialog" aria-modal="true"
    aria-labelledby="fullscreen-title" aria-describedby="fullscreen-description">
    <span className="fullscreen-illustration" aria-hidden="true">⛶</span>
    <h2 id="fullscreen-title">Mais espaço para brincar</h2>
    <p id="fullscreen-description">Quer jogar em tela cheia? No celular, fica mais fácil ver o cenário e usar os controles.</p>
    <p className="fullscreen-exit-help">Para sair, toque no botão de tela cheia no canto superior direito. No computador, você também pode usar Esc.</p>
    {failed && <p role="status">O navegador não permitiu a tela cheia. Você pode continuar normalmente e tentar pelo botão ⛶ depois.</p>}
    <div className="overlay-actions">
      <MenuButton className="btn-retro btn-primary-gold" disabled={pending} onClick={accept}>
        {pending ? 'Abrindo…' : 'Usar tela cheia'}
      </MenuButton>
      <MenuButton className="btn-retro" onClick={onDone}>Agora não</MenuButton>
    </div>
  </section>;
}

export function buildFullscreenOffer(options: { onDone: () => void }) {
  // Abstract confirmation cannot call fullscreen from a game-loop frame.
  return buildScreen(<FullscreenOffer {...options} />, { back: options.onDone });
}
