import { h, num, rp, todayJakarta, BULAN } from '../util.js';
import { api } from '../api.js';
import { S, tahunAktif } from '../store.js';
import { skeleton, banner, emptyState, errMsg, chip } from '../ui.js';

export async function render(root, ctx) {
  const now = todayJakarta();
  const st = { mode: 'harian', tahun: tahunAktif(), bulan: Number(now.slice(5, 7)) };
  const years = []; for (let y = tahunAktif() + 1; y >= 2024; y--) years.push(y);
  const ctl = h('div', { class: 'card' }), out = h('div', { class: 'stack', style: { marginTop: '12px' } });
  root.append(h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Pagu & Perhitungan'), h('div', { class: 'sub' }, 'Dihitung otomatis dari penerimaan × tarif'))), ctl, out);

  const sel = (opts, v, on, label) => h('select', { class: 'select', 'aria-label': label, onchange: (e) => on(e.target.value) }, opts.map(([val, t]) => h('option', { value: val, selected: String(val) === String(v) }, t)));
  function drawCtl() {
    ctl.replaceChildren(h('div', { class: 'seg' }, [['harian', 'Harian'], ['bulanan', 'Bulanan'], ['tahunan', 'Tahunan']].map(([m, t]) => h('button', { type: 'button', class: st.mode === m ? 'on' : '', onclick: () => { st.mode = m; drawCtl(); load(); } }, t))),
      st.mode === 'tahunan' ? null : h('div', { class: 'grid2', style: { marginTop: '10px' } },
        st.mode === 'harian' ? sel(BULAN.map((b, i) => [i + 1, b]), st.bulan, (v) => { st.bulan = +v; load(); }, 'Bulan') : null,
        sel(years.map((y) => [y, y]), st.tahun, (v) => { st.tahun = +v; load(); }, 'Tahun')));
  }

  let req = 0;
  async function load() {
    const my = ++req; out.replaceChildren(skeleton(3));
    try { const r = await api('pagu.rekap', { mode: st.mode, tahun: st.tahun, bulan: st.bulan }); if (my === req && ctx.alive()) draw(r); }
    catch (e) { if (my === req) out.replaceChildren(banner('err', errMsg(e))); }
  }

  function draw(r) {
    const s = r.ringkasan, nodes = [];
    nodes.push(h('div', { class: 'card' }, h('h2', {}, 'Ringkasan ' + (st.mode === 'harian' ? `${BULAN[st.bulan - 1]} ${st.tahun}` : st.mode === 'bulanan' ? `Tahun ${st.tahun}` : 'Semua tahun')),
      h('div', { class: 'grid2' }, kv('Total paket', num(s.totalPaket)), kv('Hari ada penerimaan', num(s.hariAktif)), kv('Porsi Kecil', num(s.porsiKecil)), kv('Porsi Besar', num(s.porsiBesar))),
      h('div', { class: 'divider' }), kv('Pagu Bahan Baku', rp(s.bahanBaku), true), kv('Mitra / Fasilitas', rp(s.mitraFasilitas), true), kv('Operasional', rp(s.operasional), true),
      h('div', { class: 'pagu-total' }, h('span', { class: 'l' }, 'TOTAL PAGU'), h('span', { class: 'v num' }, rp(s.totalPagu)))));
    if (!r.rows.length) nodes.push(emptyState('chart', 'Belum ada data pada periode ini'));
    else {
      const wide = h('div', { class: 'card only-wide', style: { overflowX: 'auto' } }, h('table', { class: 'tbl' },
        h('thead', {}, h('tr', {}, ['Periode', 'P. Kecil', 'P. Besar', 'Total Paket', 'Bahan Baku', 'Mitra/Fasilitas', 'Operasional', 'Total Pagu'].map((t, i) => h('th', { class: i ? 'r' : '' }, t)))),
        h('tbody', {}, r.rows.map((x) => h('tr', {}, h('td', {}, x.label), cell(x.porsiKecil), cell(x.porsiBesar), cell(x.totalPaket), cell(rp(x.bahanBaku), 1), cell(rp(x.mitraFasilitas), 1), cell(rp(x.operasional), 1), h('td', { class: 'r num', style: { fontWeight: 800 } }, rp(x.totalPagu))))),
        h('tfoot', {}, h('tr', {}, h('td', {}, 'Total'), cell(s.porsiKecil), cell(s.porsiBesar), cell(s.totalPaket), cell(rp(s.bahanBaku)), cell(rp(s.mitraFasilitas)), cell(rp(s.operasional)), cell(rp(s.totalPagu))))));
      const narrow = h('div', { class: 'list only-narrow' }, r.rows.map((x) => h('div', { class: 'item' },
        h('div', { class: 'row' }, h('div', { class: 'grow title' }, x.label), h('b', { class: 'num', style: { color: 'var(--navy)' } }, rp(x.totalPagu))),
        h('div', { class: 'sub num' }, `${num(x.totalPaket)} paket · ${num(x.porsiKecil)} kecil · ${num(x.porsiBesar)} besar`),
        h('div', { class: 'hint num' }, `Bahan ${rp(x.bahanBaku)} · Mitra ${rp(x.mitraFasilitas)} · Ops ${rp(x.operasional)}`))));
      nodes.push(wide, narrow);
    }
    const t = r.tarif;
    nodes.push(h('div', { class: 'card' }, h('h2', {}, 'Tarif & pemetaan kategori'),
      h('div', { style: { overflowX: 'auto' } }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ['Jenis', 'Total', 'Bahan baku', 'Mitra/Fasilitas', 'Operasional'].map((x, i) => h('th', { class: i ? 'r' : '' }, x)))),
        h('tbody', {}, ['Porsi Kecil', 'Porsi Besar'].map((j) => h('tr', {}, h('td', {}, j), cell(rp(t[j].TOTAL)), cell(rp(t[j].BAHAN_BAKU)), cell(rp(t[j].MITRA_FASILITAS)), cell(rp(t[j].OPERASIONAL))))))),
      h('div', { class: 'hint', style: { marginTop: '8px' } }, 'Porsi Kecil = Porsi Kecil + Balita · Porsi Besar = Porsi Besar + Tenaga Pendidik + Bumil + Busui. Data detail tetap tersimpan. Ubah tarif di sheet 04_TARIF (berlaku untuk seluruh periode).')));
    out.replaceChildren(...nodes);
  }
  const kv = (l, v, line) => line ? h('div', { class: 'pagu-line' }, h('span', {}, l), h('b', { class: 'num' }, v)) : h('div', {}, h('div', { class: 'hint' }, l), h('div', { class: 'num', style: { fontWeight: 800, fontSize: '18px' } }, v));
  const cell = (v) => h('td', { class: 'r num' }, typeof v === 'number' ? num(v) : v);
  drawCtl(); await load();
}
