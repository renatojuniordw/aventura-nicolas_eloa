import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { mountScreen, blurOnClick } from './mount-screen.js';

export type PairingStatus = 'waiting' | 'paired' | 'disconnected' | 'error';

interface PhonePairingOptions {
  pairingUrl: string;
  status: PairingStatus;
  errorMessage?: string | null;
  onBack: () => void;
  onPlay: () => void;
}

const STATUS_TEXT: Record<PairingStatus, string> = {
  waiting: 'Aponte a câmera do celular para o QR code para parear.',
  paired: 'Celular pareado! Prenda no corpo da criança e toque em Jogar.',
  disconnected: 'O celular desconectou. Aguardando reconexão...',
  error: 'Não foi possível parear.',
};

/** Renders `pairingUrl` as a QR code image the moment it changes. */
function QrCode({ url }: { url: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, { margin: 1, width: 220 }).then((result) => {
      if (!cancelled) setDataUrl(result);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!dataUrl) return <div className="phone-pairing-qr-placeholder" aria-hidden="true" />;
  return <img className="phone-pairing-qr" src={dataUrl} alt="QR code para parear o celular" />;
}

function PhonePairingScreen({ pairingUrl, status, errorMessage, onBack, onPlay }: PhonePairingOptions) {
  return (
    <div className="overlay phone-pairing">
      <h2>Controle por celular</h2>
      <p className="phone-pairing-status" aria-live="polite">
        {status === 'error' && errorMessage ? errorMessage : STATUS_TEXT[status]}
      </p>
      {status !== 'paired' ? <QrCode url={pairingUrl} /> : (
        <div className="phone-pairing-paired-badge" aria-hidden="true">
          📱✅
        </div>
      )}
      <div className="overlay-actions">
        {status === 'paired' ? (
          <button className="btn-retro btn-primary-gold" type="button" tabIndex={-1} onClick={blurOnClick(onPlay)}>
            Jogar
          </button>
        ) : null}
        <button className="btn-retro btn-secondary-green" type="button" tabIndex={-1} onClick={blurOnClick(onBack)}>
          Voltar
        </button>
      </div>
    </div>
  );
}

export function buildPhonePairingScreen(options: PhonePairingOptions) {
  const { node, cleanup } = mountScreen(<PhonePairingScreen {...options} />);
  return {
    node,
    primary: options.status === 'paired' ? options.onPlay : null,
    back: options.onBack,
    cleanup,
  };
}
