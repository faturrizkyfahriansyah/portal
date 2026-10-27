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

  function draw(hari) {
    hari.forEach((d) => { d.terpisah = new Set(d.dokumen.filter((x) => x.status === 'AKTIF' && x.fileDokumen).map((x) => x.fileDokumen)).size > 1; });
    if (!hari.length) { out.replaceChildren(emptyState('archive', 'Belum ada dokumen', 'Dokumen muncul di sini setelah Generate Dokumen dijalankan.')); return; }
    out.replaceChildren(...hari.map((d) => h('div', { class: 'item' },
      h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'title' }, `${hariIndo(d.tanggal)}, ${tglIndo(d.tanggal)}`),
        h('div', { class: 'sub num' }, `${num(d.jumlahPm)} PM · ${num(d.totalPaket)} paket`)), d.fileHari ? linkBtn(d.fileWord ? 'PDF' : 'Buka', d.fileHari, 'gold sm', 'file') : null, d.fileWord ? linkBtn('Word', d.fileWord, 'ghost sm', 'file') : null, chip('P' + d.kodePeriode, 'info')),
      h('div', { class: 'stack', style: { marginTop: '10px', gap: '6px' } }, d.dokumen.map((doc) => h('div', { class: 'row', style: { fontSize: '13px', alignItems: 'center' } },
        h('div', { class: 'grow' }, h('div', {}, doc.namaPm), h('div', { class: 'hint' }, doc.nomorBast)),
        doc.status !== 'AKTIF' ? chip('Diganti', '') : null,
        // hari lama (format 1 file per PM) masih punya file terpisah -> tetap tampilkan tombol Buka per PM
        d.terpisah && doc.fileDokumen ? linkBtn(doc.fileWord ? 'PDF' : 'Buka', doc.fileDokumen, 'ghost sm', 'file') : null,
        d.terpisah && doc.fileWord ? linkBtn('Word', doc.fileWord, 'ghost sm', 'file') : null))))));
  }
  await load();
}
