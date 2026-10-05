import { h, icon, num, rp, todayJakarta, tglIndo, hariIndo, KAT_LABEL } from '../util.js';
import { api } from '../api.js';
import { S } from '../store.js';
import { chip, banner, linkBtn, skeleton, errMsg } from '../ui.js';

export async function render(root, ctx) {
  let tgl = todayJakarta();
  const wrap = h('div', { class: 'stack' });
  root.append(wrap);

  async function load() {
    wrap.replaceChildren(skeleton(3));
    let d;
    try { d = await api('dashboard', { tanggal: tgl }); }
    catch (e) { if (ctx.alive()) wrap.replaceChildren(banner('err', errMsg(e))); return; }
    if (!ctx.alive()) return;
    wrap.replaceChildren(...build(d));
  }

  function build(d) {
    const hi = d.hitung, hariIni = tgl === todayJakarta();
    const picker = h('input', { class: 'datepick', type: 'date', value: tgl, 'aria-label': 'Ubah tanggal', onchange: (e) => { if (e.target.value) { tgl = e.target.value; load(); } } });
    const dok = d.dokumen;
    const statusChip = !dok ? chip('Dokumen belum dibuat', 'warn') : d.perluRevisi ? chip('Dokumen perlu dibuat ulang', 'err') : chip('Dokumen sudah dibuat', 'ok');
    const belum = d.jumlahPmAktif - d.jumlahPmTerisi;

    const out = [];
    out.push(h('section', { class: 'hero' },
      h('div', { class: 'eyebrow' }, `${S.settings.NAMA_SPPG || 'SPPG Jeungjing'} · ${hariIni ? 'Penerimaan Hari Ini' : 'Penerimaan'}`),
      h('div', { class: 'date' }, tglIndo(tgl)), h('div', { class: 'day' }, hariIndo(tgl)),
      h('div', { class: 'row wrap' }, picker, statusChip)));

    if (d.sudahDiinput === 0) out.push(banner('warn', h('b', {}, 'Belum ada penerimaan tercatat. '), 'Mulai dengan menekan Input Penerimaan.'));
    else if (belum > 0) out.push(banner('warn', h('b', {}, `${belum} PM aktif belum diisi.`), ' Lengkapi sebelum membuat dokumen.'));
    if (d.perluRevisi) out.push(banner('err', h('b', {}, 'Data berubah setelah dokumen dibuat. '), 'Buat dokumen ulang agar sesuai (nomor BAST tetap dipertahankan).'));

    out.push(h('div', { class: 'grid2' },
      stat('Jumlah PM', num(d.jumlahPmTerisi), `dari ${num(d.jumlahPmAktif)} PM aktif`),
      stat('Total Paket', num(hi.totalPaket), 'paket makanan')));
    out.push(h('div', { class: 'card' }, h('h2', {}, 'Rincian penerimaan'), h('div', { class: 'cat-grid' },
      ['PORSI_KECIL', 'PORSI_BESAR', 'TENAGA_PENDIDIK', 'BALITA', 'BUMIL', 'BUSUI'].map((k) => h('div', {}, h('div', { class: 'k' }, KAT_LABEL[k]), h('div', { class: 'v num' }, num(d.kategori[k])))))));

    out.push(h('div', { class: 'card' }, h('h2', {}, 'Pagu / Budget'),
      line('Pagu Bahan Baku', rp(hi.bahanBaku)), line('Mitra / Fasilitas', rp(hi.mitraFasilitas)), line('Operasional', rp(hi.operasional)),
      h('div', { class: 'pagu-total' }, h('span', { class: 'l' }, 'TOTAL PAGU'), h('span', { class: 'v num' }, rp(hi.totalPagu)))));

    if (dok) out.push(h('div', { class: 'card' }, h('h2', {}, 'Dokumen penerimaan'),
      h('div', { class: 'row wrap' }, h('div', { class: 'grow muted' }, `${num(dok.JUMLAH_PM)} PM · ${num(dok.TOTAL_PAKET)} paket`), linkBtn('Word', dok.FILE_WORD, 'ghost sm', 'file'), dok.FILE_PDF ? linkBtn('PDF', dok.FILE_PDF, 'ghost sm', 'file') : null)));

    out.push(h('div', { class: 'cta' },
      h('a', { class: 'btn big', href: `#/penerimaan?tanggal=${tgl}` }, icon('inbox', 20), 'INPUT PENERIMAAN'),
      h('a', { class: 'btn big gold', href: `#/dokumen?tanggal=${tgl}` }, icon('bolt', 20), 'GENERATE SEMUA DOKUMEN')));
    return out;
  }
  await load();
}

const stat = (l, v, s) => h('div', { class: 'stat' }, h('div', { class: 'l' }, l), h('div', { class: 'v num' }, v), h('div', { class: 's' }, s));
const line = (l, v) => h('div', { class: 'pagu-line' }, h('span', {}, l), h('b', { class: 'num' }, v));
