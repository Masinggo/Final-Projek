// FR-06: ringkasan harian, kalori terhadap target, dan makro terhadap rentang acuan.
import {
  todayStr,
  sumNutrients,
  macroBreakdown,
  resolveTarget,
  maintenanceKcal,
  fmtKkal,
  fmtGram,
  TARGET_SOURCE_LABEL,
} from '../lib/nutrition.js';
import { Disclaimer, StatusBadge } from './ui.jsx';

export default function Home({ app }) {
  const { account, logs, goTab } = app;
  const today = todayStr();
  const todays = logs.filter((l) => l.tanggal === today);
  const total = sumNutrients(todays.map((l) => l.nilai));
  const target = resolveTarget(account.profil);
  const maint = maintenanceKcal(account.profil);
  const pct = target.value > 0 ? (total.kkal / target.value) * 100 : 0;
  const rows = macroBreakdown(total, todays.length > 0);

  return (
    <>
      <h1>Beranda</h1>
      <Disclaimer />

      <section className="card" aria-labelledby="h-kalori">
        <h2 id="h-kalori">Kalori hari ini</h2>
        <p style={{ fontSize: '1.6rem', margin: 0 }}>
          <strong>{fmtKkal(total.kkal)}</strong> <span className="muted">dari {fmtKkal(target.value)} kkal (perkiraan)</span>
        </p>
        <div
          className={`progress ${pct > 100 ? 'over' : ''}`}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(100, Math.round(pct))}
          aria-label="Kalori hari ini terhadap target"
        >
          <div style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
        <p className="muted">
          {pct > 100 ? `Melebihi target sekitar ${fmtKkal(total.kkal - target.value)} kkal. ` : ''}
          Target memakai {TARGET_SOURCE_LABEL[target.sumber]}.
        </p>
        {maint.available ? (
          <p className="muted">Perkiraan energi pemeliharaan Anda: {fmtKkal(maint.value)} kkal per hari.</p>
        ) : (
          <p className="muted">
            {maint.reason}{' '}
            <button className="btn secondary small" onClick={() => goTab('profil')}>
              Buka Profil
            </button>
          </p>
        )}
      </section>

      <section className="card" aria-labelledby="h-makro">
        <h2 id="h-makro">Makronutrien hari ini</h2>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Makro</th>
                <th>Jumlah</th>
                <th>% energi</th>
                <th>Rentang acuan</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td>{r.label}</td>
                  <td>{fmtGram(r.gram)} g</td>
                  <td>{r.persen === null ? '-' : `${Math.round(r.persen)}%`}</td>
                  <td>
                    {r.min}-{r.max}%
                  </td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note" style={{ marginTop: '0.7rem' }}>
          Rentang acuan memakai AMDR (persen energi, dewasa). Nilai akhir menunggu verifikasi AKG Indonesia.
        </p>
      </section>

      <section className="card" aria-labelledby="h-hari-ini">
        <div className="spread">
          <h2 id="h-hari-ini">Catatan hari ini</h2>
          <button className="btn small" onClick={() => goTab('catat')}>
            Catat makanan
          </button>
        </div>
        {todays.length === 0 ? (
          <p className="muted">Belum ada catatan hari ini.</p>
        ) : (
          <ul className="list">
            {todays.map((l) => (
              <li key={l.id}>
                <div className="spread">
                  <span>
                    {l.namaMakanan} <span className="muted">({fmtGram(l.jumlah)} {l.satuan}{l.sumberInput === 'foto' ? ', dari foto' : ''})</span>
                  </span>
                  <strong>{fmtKkal(l.nilai.kkal)} kkal</strong>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="muted">
          Untuk mengubah atau menghapus catatan, buka tab{' '}
          <button className="btn secondary small" onClick={() => goTab('riwayat')}>
            Riwayat
          </button>
        </p>
      </section>
    </>
  );
}
