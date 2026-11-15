// Komponen kecil yang dipakai di banyak layar.
import { fmtKkal, fmtGram, STATUS } from '../lib/nutrition.js';

/** Pernyataan batasan (FR-12, KP-12.1). Dipakai di Beranda, Catat (hasil), dan Profil. */
export function Disclaimer() {
  return (
    <p className="note" role="note">
      Nilai gizi dan kebutuhan energi di aplikasi ini adalah <strong>perkiraan acuan</strong>, bukan diagnosis medis dan bukan
      pengganti saran tenaga kesehatan.
    </p>
  );
}

export function Alert({ kind = 'info', children }) {
  return (
    <div className={`alert ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

/** Empat kotak ringkas: kalori, protein, lemak, karbohidrat. */
export function NutrientBoxes({ nilai }) {
  return (
    <div className="nutri" aria-label="Perkiraan nilai gizi">
      <div><b>{fmtKkal(nilai.kkal)}</b><span>kkal</span></div>
      <div><b>{fmtGram(nilai.proteinG)}</b><span>protein (g)</span></div>
      <div><b>{fmtGram(nilai.lemakG)}</b><span>lemak (g)</span></div>
      <div><b>{fmtGram(nilai.karboG)}</b><span>karbo (g)</span></div>
    </div>
  );
}

const STATUS_CLASS = {
  [STATUS.within]: 'within',
  [STATUS.below]: 'below',
  [STATUS.above]: 'above',
  [STATUS.none]: 'none',
};
export function StatusBadge({ status }) {
  return <span className={`badge ${STATUS_CLASS[status] || 'none'}`}>{status}</span>;
}

export function SubmissionBadge({ status }) {
  const cls = status === 'Disetujui' ? 'ok' : status === 'Perlu perbaikan' ? 'fix' : 'wait';
  return <span className={`badge ${cls}`}>{status}</span>;
}

export function Field({ id, label, error, hint, children }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && !error && <div className="hint">{hint}</div>}
      {error && (
        <div className="err" id={`${id}-err`} role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

/** Grafik batang 7 hari dengan garis target (KP-07.1). SVG murni, tanpa library. */
export function BarChart({ data, target }) {
  const W = 640;
  const H = 240;
  const pad = { l: 44, r: 12, t: 16, b: 34 };
  const max = Math.max(target * 1.15, ...data.map((d) => d.value), 100);
  const bw = (W - pad.l - pad.r) / data.length;
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const summary = data.map((d) => `${d.label}: ${fmtKkal(d.value)} kkal`).join('; ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Grafik kalori 7 hari terakhir. Target ${fmtKkal(target)} kkal. ${summary}`}>
      <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} stroke="#9aa9a0" />
      {data.map((d, i) => {
        const x = pad.l + i * bw + bw * 0.18;
        const h = y(0) - y(d.value);
        return (
          <g key={d.label}>
            <rect x={x} y={y(d.value)} width={bw * 0.64} height={Math.max(h, 0)} rx="3" fill={d.value > target ? '#b26a00' : '#1f7a4d'} />
            <text x={x + bw * 0.32} y={y(d.value) - 4} textAnchor="middle" fontSize="11" fill="#1d2a22">
              {d.value > 0 ? fmtKkal(d.value) : '0'}
            </text>
            <text x={x + bw * 0.32} y={H - 12} textAnchor="middle" fontSize="11" fill="#5b6b61">
              {d.label}
            </text>
          </g>
        );
      })}
      <line x1={pad.l} x2={W - pad.r} y1={y(target)} y2={y(target)} stroke="#1b5fd1" strokeDasharray="6 4" strokeWidth="1.5" />
      <text x={W - pad.r} y={y(target) - 5} textAnchor="end" fontSize="11" fill="#1b5fd1">
        Target {fmtKkal(target)} kkal
      </text>
    </svg>
  );
}
