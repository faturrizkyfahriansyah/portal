import { h, icon, num, tglIndo, hariIndo } from '../util.js';
import { api } from '../api.js';
import { chip, banner, skeleton, emptyState, linkBtn, errMsg } from '../ui.js';

// Dirombak 27 Okt 2026 (DIMINTA Admin -- GAP ditemukan: Arsip
// sebelumnya HANYA menampilkan dokumen Dokumen Penerimaan lama, yg
// sekarang disembunyikan dari navigasi, jadi dokumen BAST+SJ baru
// TIDAK PERNAH terlihat di mana pun). Sekarang: daftar dokumen BAST+SJ
// (06_BAST), dikelompokkan per TANGGAL, disaring per PERIODE (dropdown
// auto-pilih periode AKTIF, sesuai permintaan Admin). Fitur lama
// (dokumen.list) TIDAK dihapus dari backend, cuma halaman ini tidak
// lagi memanggilnya.
export async function render(root, ctx) {
  let periodeList = [];
  try { periodeList = await api('periode.list'); } catch (e) { /* non-fatal */ }
  if (!ctx.alive()) return;

  const st = { kodePeriode: (periodeList.find((p) => p.status === 'AKTIF') || periodeList[0] || {}).kode || '' };
  const sel = (opts, v, on, label) => h('select', { class: 'select', 'aria-label': label, onchange: (e) => on(e.target.value) }, opts.map(([val, t]) => h('option', { value: val, selected: String(val) === String(v) }, t)));
  const out = h('div', { class: 'list', style: { marginTop: '12px' } });
  root.append(
    h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Arsip Dokumen'), h('div', { class: 'sub' }, 'BAST + Surat Jalan yang tersimpan di Google Drive, per tanggal operasional'))),
    h('div', { class: 'card' },
      sel(periodeList.length ? [['', 'Semua periode'], ...periodeList.map((p) => [p.kode, p.nama + (p.status === 'AKTIF' ? ' (aktif)' : '')])] : [['', 'Tidak ada periode']],
        st.kodePeriode, (v) => { st.kodePeriode = v; load(); }, 'Periode')),
    out);

  let req = 0;
  async function load() {
    const my = ++req; out.replaceChildren(skeleton(3));
    try { const r = await api('bastSj.daftarArsip', { kodePeriode: st.kodePeriode || undefined }); if (my === req && ctx.alive()) draw(r); }
    catch (e) { if (my === req) out.replaceChildren(banner('err', errMsg(e))); }
  }

  // DIROMBAK 28 Okt 2026 (ikuti Master Prompt §8.1 & §9.2: "satu entri
  // utama per hari... jangan tampilkan satu entri utama per PM jika
  // seluruh PM sudah digabungkan menjadi satu file harian"). SEBELUMNYA:
  // tombol "Buka" PER-PM (d.dokumen.map(...)) -- sejak digabung jadi 1
  // file/hari, SEMUA tombol itu menuju URL yg SAMA PERSIS (mubazir, dan
  // bertentangan dgn Master Prompt). SEKARANG: SATU tombol Buka + Cetak
  // di level HARI, daftar PM di bawahnya HANYA informatif (nama+nomor
  // BAST, tanpa tombol per-item).
  function draw(hari) {
    if (!hari.length) { out.replaceChildren(emptyState('archive', 'Belum ada dokumen', 'Dokumen muncul di sini setelah Generate Dokumen dijalankan.')); return; }
    out.replaceChildren(...hari.map((d) => {
      const fileHariIni = (d.dokumen.find((doc) => doc.status === 'AKTIF' && doc.fileDokumen) || {}).fileDokumen || '';
      return h('div', { class: 'item' },
        h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'title' }, `${hariIndo(d.tanggal)}, ${tglIndo(d.tanggal)}`),
          h('div', { class: 'sub num' }, `${num(d.jumlahPm)} PM · ${num(d.totalPaket)} paket`)), chip('P' + d.kodePeriode, 'info')),
        fileHariIni ? h('div', { class: 'row', style: { marginTop: '8px', gap: '6px' } },
          h('a', { href: fileHariIni, target: '_blank', rel: 'noopener', class: 'btn-mini ghost' }, icon('file', 14), 'Buka'),
          h('a', { href: fileHariIni, target: '_blank', rel: 'noopener', class: 'btn-mini primary' }, icon('printer', 14), 'Cetak')) : null,
        h('div', { class: 'stack', style: { marginTop: '10px', gap: '4px' } }, d.dokumen.map((doc) => h('div', { class: 'row', style: { fontSize: '12.5px', color: 'var(--text-muted)' } },
          h('div', { class: 'grow' }, doc.namaPm + ' — ' + doc.nomorBast),
          doc.status !== 'AKTIF' ? chip('Diganti', '') : null))));
    }));
  }
  await load();
}
