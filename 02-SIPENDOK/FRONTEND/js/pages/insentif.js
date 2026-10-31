// insentif.js — BARU 25 Okt 2026 (dokumen Master Instruction SIPENDOK
// §M/§N). Insentif PIC Sekolah & Posyandu, dipecah tab, sumber BAST
// (bukan Penerimaan/EJ) -- lihat Insentif.gs utk rincian aturan.
import { h, num, rp } from '../util.js';
import { api } from '../api.js';
import { skeleton, banner, emptyState, errMsg, chip } from '../ui.js';

export async function render(root, ctx) {
  let periodeList = [];
  try { periodeList = await api('periode.list'); } catch (e) { root.append(banner('err', errMsg(e))); return; }
  if (!ctx.alive()) return;

  const st = { tab: 'sekolah', idPeriode: (periodeList.find((p) => p.status === 'AKTIF') || periodeList[0] || {}).idPeriode || '' };
  const ctl = h('div', { class: 'card' }), out = h('div', { class: 'stack', style: { marginTop: '12px' } });
  root.append(
    h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Rekap Biaya & Insentif'), h('div', { class: 'sub' }, 'Insentif PIC -- dihitung dari BAST yang berhasil terbit, bukan dari Penerimaan harian.'))),
    ctl, out
  );

  function drawCtl() {
    ctl.replaceChildren(
      h('select', { class: 'select', onchange: (e) => { st.idPeriode = e.target.value; load(); } },
        periodeList.length ? periodeList.map((p) => h('option', { value: p.idPeriode, selected: p.idPeriode === st.idPeriode }, p.nama + (p.status === 'AKTIF' ? ' (aktif)' : ''))) : h('option', {}, 'Tidak ada periode')),
      h('div', { class: 'seg', style: { marginTop: '10px' } }, [['sekolah', 'PIC Sekolah'], ['posyandu', 'PIC Posyandu']].map(([t, label]) =>
        h('button', { type: 'button', class: st.tab === t ? 'on' : '', onclick: () => { st.tab = t; drawCtl(); drawTab(); } }, label)))
    );
  }

  let hasilTerakhir = null;
  let req = 0;
  async function load() {
    if (!st.idPeriode) { out.replaceChildren(emptyState('alert', 'Belum ada Periode Operasional. Buat dulu di Portal Pengelola.')); return; }
    const my = ++req; out.replaceChildren(skeleton(3));
    try {
      const r = await api('insentif.rekapPeriode', { idPeriode: st.idPeriode });
      if (my !== req || !ctx.alive()) return;
      hasilTerakhir = r;
      drawTab();
    } catch (e) { if (my === req) out.replaceChildren(banner('err', errMsg(e))); }
  }

  function kartuRingkasan(r) {
    const s = r.ringkasan;
    return h('div', { class: 'card' }, h('h2', {}, 'Ringkasan ' + r.periode.nama),
      h('div', { class: 'grid3' },
        h('div', { class: 'stat' }, h('div', { class: 'stat-label' }, 'Insentif PIC Sekolah'), h('div', { class: 'stat-value' }, rp(s.totalSekolah))),
        h('div', { class: 'stat' }, h('div', { class: 'stat-label' }, 'Insentif PIC Posyandu'), h('div', { class: 'stat-value' }, rp(s.totalPosyandu))),
        h('div', { class: 'stat' }, h('div', { class: 'stat-label' }, 'Total Gabungan'), h('div', { class: 'stat-value', style: { color: 'var(--navy)', fontWeight: 800 } }, rp(s.totalGabungan)))),
      (s.perluData || s.tarifBelumAda) ? h('div', { style: { marginTop: '10px' } },
        s.perluData ? banner('warn', s.perluData + ' PM Sekolah belum diisi jumlah siswa acuan -- belum ikut dihitung.') : null,
        s.tarifBelumAda ? banner('warn', s.tarifBelumAda + ' PM Sekolah di atas 3.000 siswa -- tarif belum ditetapkan, belum dihitung.') : null) : null);
  }

  function baris(cells) { return h('tr', {}, cells.map((c) => h('td', {}, c))); }

  function tabelSekolah(rows) {
    if (!rows.length) return emptyState('users', 'Tidak ada PM Sekolah.');
    return h('div', { class: 'table-wrap' }, h('table', {},
      h('thead', {}, h('tr', {}, ['PM', 'PIC', 'Jumlah Siswa', 'Kelompok', 'Tarif/Hari', 'Hari Memenuhi', 'Total Insentif'].map((t) => h('th', {}, t)))),
      h('tbody', {}, rows.map((r) => {
        if (r.status !== 'OK') return baris([r.namaPm, r.pic || '-', r.jumlahSiswa ?? '-', h('span', { class: 'hint' }, r.pesan), '-', '-', chip(r.status === 'PERLU_DATA_SISWA' ? 'Perlu data' : 'Tarif belum ada', 'warn')]);
        return baris([r.namaPm, r.pic || '-', num(r.jumlahSiswa), r.kelompok, rp(r.tarifPerHari), num(r.hariMemenuhi), h('b', {}, rp(r.totalInsentif))]);
      }))));
  }

  function tabelPosyandu(rows) {
    if (!rows.length) return emptyState('users', 'Tidak ada PM Posyandu.');
    return h('div', { class: 'table-wrap' }, h('table', {},
      h('thead', {}, h('tr', {}, ['PM', 'PIC', 'Total Porsi Memenuhi', 'Tarif/Porsi', 'Total Insentif'].map((t) => h('th', {}, t)))),
      h('tbody', {}, rows.map((r) => baris([r.namaPm, r.pic || '-', num(r.totalPorsi), rp(r.tarifPerPorsi), h('b', {}, rp(r.totalInsentif))])))));
  }

  function drawTab() {
    if (!hasilTerakhir) return;
    const r = hasilTerakhir;
    out.replaceChildren(kartuRingkasan(r), h('div', { class: 'card' },
      h('h2', {}, st.tab === 'sekolah' ? 'PIC Sekolah' : 'PIC Posyandu'),
      st.tab === 'sekolah' ? tabelSekolah(r.sekolah) : tabelPosyandu(r.posyandu)));
  }

  drawCtl();
  await load();
}
