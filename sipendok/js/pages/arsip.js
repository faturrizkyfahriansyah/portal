import { h, icon, num, todayJakarta, tglIndo, hariIndo, waktuIndo, BULAN } from '../util.js';
import { api } from '../api.js';
import { S, tahunAktif } from '../store.js';
import { chip, banner, skeleton, emptyState, linkBtn, errMsg } from '../ui.js';

export async function render(root, ctx) {
  const st = { tahun: tahunAktif(), bulan: '' };
  const years = []; for (let y = tahunAktif() + 1; y >= 2024; y--) years.push(y);
  const sel = (opts, v, on, label) => h('select', { class: 'select', 'aria-label': label, onchange: (e) => on(e.target.value) }, opts.map(([val, t]) => h('option', { value: val, selected: String(val) === String(v) }, t)));
  const out = h('div', { class: 'list', style: { marginTop: '12px' } });
  root.append(
    h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Arsip Dokumen'), h('div', { class: 'sub' }, 'Dokumen Penerimaan (Word & PDF) yang tersimpan di Google Drive')), h('div', { class: 'spacer' }),
      S.folderRoot ? h('a', { class: 'btn ghost sm', href: S.folderRoot, target: '_blank', rel: 'noopener noreferrer' }, icon('folder', 16), 'Folder Drive') : null),
    h('div', { class: 'card' }, h('div', { class: 'grid2' },
      sel([['', 'Semua bulan'], ...BULAN.map((b, i) => [i + 1, b])], st.bulan, (v) => { st.bulan = v; load(); }, 'Bulan'),
      sel(years.map((y) => [y, y]), st.tahun, (v) => { st.tahun = v; load(); }, 'Tahun'))), out);

  let req = 0;
  async function load() {
    const my = ++req; out.replaceChildren(skeleton(3));
    try { const r = await api('dokumen.list', { tahun: st.tahun, bulan: st.bulan || undefined }); if (my === req && ctx.alive()) draw(r); }
    catch (e) { if (my === req) out.replaceChildren(banner('err', errMsg(e))); }
  }

  function status(d) {
    if (!d.aktif) return chip('Diganti revisi', '');
    if (d.perluRevisi) return chip('Perlu dibuat ulang', 'err');
    if (/TANPA PDF/.test(d.STATUS)) return chip('Selesai · tanpa PDF', 'warn');
    return chip('Selesai', 'ok');
  }
  function draw(rows) {
    if (!rows.length) { out.replaceChildren(emptyState('archive', 'Belum ada dokumen', 'Dokumen muncul di sini setelah Anda menekan Generate Semua Dokumen.')); return; }
    out.replaceChildren(...rows.map((d) => h('div', { class: 'item' + (d.aktif ? '' : ' off') },
      h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'title' }, `${hariIndo(d.TANGGAL)}, ${tglIndo(d.TANGGAL)}`), h('div', { class: 'sub num' }, `${num(d.JUMLAH_PM)} PM · ${num(d.TOTAL_PAKET)} paket`)), status(d)),
      h('div', { class: 'row wrap', style: { marginTop: '10px' } }, linkBtn('Buka Word', d.FILE_WORD, 'ghost sm', 'file'), d.FILE_PDF ? linkBtn('Buka PDF', d.FILE_PDF, 'ghost sm', 'file') : null,
        h('span', { class: 'hint', style: { marginLeft: 'auto' } }, `${d.ID_DOKUMEN} · ${waktuIndo(d.WAKTU_GENERATE)} · ${d.USER_GENERATE || '-'}`)))));
  }
  await load();
}
