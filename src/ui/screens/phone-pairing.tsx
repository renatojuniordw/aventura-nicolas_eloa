import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { mountScreen, blurOnClick } from './mount-screen.js';

export type PairingStatus = 'waiting' | 'paired' | 'disconnected' | 'error';

interface PhonePairingOptions {
  pairingUrl: string;
  status: PairingStatus;
  errorMessage?: string | null;
  /** Shown after a while with nobody pairing (docs/12 §10) — nudges toward the always-available "Voltar". */
  showTimeoutHint?: boolean;
  /** Round-trip time to the signaling server, in ms, or null if unreachable. Polled while this screen is open. */
  measureLatency?: () => Promise<number | null>;
  onBack: () => void;
  onPlay: () => void;
  onSpeedrun: () => void;
}

const STATUS_TEXT: Record<PairingStatus, string> = {
  waiting: 'Aponte a câmera do celular para o QR code para parear.',
  paired: 'Celular pareado! Prenda no corpo da criança e toque em Jogar.',
  disconnected: 'O celular desconectou. Aguardando reconexão...',
  error: 'Não foi possível parear.',
};

const LATENCY_POLL_MS = 4000;

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

function latencyQuality(ms: number): 'good' | 'ok' | 'bad' {
  if (ms < 100) return 'good';
  if (ms < 300) return 'ok';
  return 'bad';
}

/**
 * Polls the signaling server's round-trip time so a parent can tell "the
 * WiFi here is bad" apart from "the phone hasn't jumped yet" before the
 * child is already mid-level (docs/12 §10, "indicador de qualidade de
 * conexão na TV"). Works before pairing too — it measures the TV's own
 * link to the server, independent of whether a phone has joined yet.
 */
function LatencyIndicator({ measureLatency }: { measureLatency: () => Promise<number | null> }) {
  const [ms, setMs] = useState<number | null | 'pending'>('pending');

  useEffect(() => {
    let cancelled = false;
    const poll = () => {
      measureLatency().then((result) => {
        if (!cancelled) setMs(result);
      });
    };
    poll();
    const interval = setInterval(poll, LATENCY_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [measureLatency]);

  if (ms === 'pending') return null;
  const label = ms === null ? 'sem conexão com o servidor' : `${ms} ms`;
  const quality = ms === null ? 'bad' : latencyQuality(ms);

  return (
    <p className={`phone-pairing-latency phone-pairing-latency-${quality}`}>
      <span className="phone-pairing-latency-dot" aria-hidden="true" />
      Conexão: {label}
    </p>
  );
}

function PhonePairingScreen({
  pairingUrl,
  status,
  errorMessage,
  showTimeoutHint,
  measureLatency,
  onBack,
  onPlay,
  onSpeedrun,
}: PhonePairingOptions) {
  return (
    <div className="overlay phone-pairing">
      <h2>Controle por celular</h2>
      <p className="phone-pairing-status" aria-live="polite">
        {status === 'error' && errorMessage ? errorMessage : STATUS_TEXT[status]}
      </p>
      {showTimeoutHint ? (
        <p className="phone-pairing-hint">
          Ainda não conseguiu parear? Toque em &quot;Voltar&quot; para jogar com teclado ou toque.
        </p>
      ) : null}
      {status !== 'paired' ? <QrCode url={pairingUrl} /> : (
        <div className="phone-pairing-paired-badge" aria-hidden="true">
          📱✅
        </div>
      )}
      {measureLatency && status !== 'error' ? <LatencyIndicator measureLatency={measureLatency} /> : null}
      <div className="overlay-actions">
        {status === 'paired' ? (
          <>
            <button className="btn-retro btn-primary-gold" type="button" tabIndex={-1} onClick={blurOnClick(onPlay)}>
              Jogar fases
            </button>
            <button className="btn-retro btn-secondary-green" type="button" tabIndex={-1} onClick={blurOnClick(onSpeedrun)}>
              ⚡ Speed Run
            </button>
          </>
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
