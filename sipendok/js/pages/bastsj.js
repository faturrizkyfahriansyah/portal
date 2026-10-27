// bastsj.js — BARU 23 Okt 2026 (dokumen Pembaruan SIPENDOK §14, sesuai
// mockup "Konsep UI Generate Dokumen"). Halaman TERPISAH dari
// dokumen.js (Dokumen Penerimaan lama) -- memanggil bastSj.pratinjau/
// bastSj.generate (BastSj.gs), BUKAN dokumen.validasi/dokumen.generate.
import { h, icon, num, todayJakarta, tglIndo, hariIndo } from '../util.js';
import { api } from '../api.js';
import { toast, modal, confirmDialog, showBusy, hideBusy, chip, banner, skeleton, emptyState, errMsg, field } from '../ui.js';

const LABEL_STATUS = {
  SIAP: 'Siap generate', SUDAH_DIBUAT: 'Sudah dibuat',
  DILEWATI: 'Dilewati (libur/nonaktif)', BELUM_ADA_PENERIMAAN: 'Belum ada penerimaan valid'
};
const WARNA_STATUS = { SIAP: 'ok', SUDAH_DIBUAT: '', DILEWATI: 'warn', BELUM_ADA_PENERIMAAN: 'err' };

export async function render(root, ctx) {
  let tgl = ctx.params.tanggal || todayJakarta();
  let pre = null, busy = false;
  const body = h('div', { class: 'stack' });
  const dateIn = h('input', { class: 'input', type: 'date', value: tgl, onchange: (e) => { if (e.target.value) { tgl = e.target.value; load(); } } });
  root.append(
    h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Generate Dokumen'), h('div', { class: 'sub' }, 'BAST + Surat Jalan — satu paket PDF per Penerima Manfaat'))),
    h('div', { class: 'card' }, field('Tanggal operasional', dateIn)), h('div', { style: { height: '12px' } }), body);

  async function load() {
    body.replaceChildren(skeleton(3));
    try { pre = await api('bastSj.pratinjau', { tanggal: tgl }); } catch (e) { if (ctx.alive()) body.replaceChildren(banner('err', errMsg(e))); return; }
    if (ctx.alive()) draw();
  }

  function draw() {
    const nodes = [];

    // Periode operasional -- sesuai mockup "P01 — diambil dari pengaturan periode yang berlaku"
    nodes.push(h('div', { class: 'card' },
      h('div', { class: 'hint' }, hariIndo(tgl) + ', ' + tglIndo(tgl)),
      h('div', { class: 'row', style: { marginTop: '6px' } },
        h('div', { class: 'grow' }, h('div', { class: 'hint' }, 'Periode operasional'),
          h('div', { style: { fontWeight: 700 } }, pre.periode ? 'P' + pre.periode.kode + ' — ' + (pre.periode.nama || '') : '—')),
        h('div', {}, h('div', { class: 'hint' }, 'Menu hari ini'),
          h('div', { style: { fontWeight: 700 } }, pre.menu ? pre.menu.tema || 'Tersedia' : '—')))));

    if (pre.blokir.length) {
      nodes.push(banner('err', h('b', {}, 'Belum bisa generate. '), pre.blokir.join(' ')));
      body.replaceChildren(...nodes);
      return;
    }

    // Ringkasan sebelum generate -- persis sesuai mockup
    const r = pre.ringkasan;
    nodes.push(h('div', { class: 'card' }, h('h2', {}, 'Ringkasan sebelum generate'),
      baris('PM aktif dan beroperasi', r.pmAktif - r.pmLiburNonaktif),
      baris('PM libur/nonaktif', r.pmLiburNonaktif),
      baris('Penerimaan valid tersimpan', r.penerimaanValid),
      baris('Siap digenerate', r.siapGenerate),
      baris('Sudah dibuat sebelumnya', r.sudahDibuat),
      r.belumAdaPenerimaan ? baris('Belum ada penerimaan', r.belumAdaPenerimaan) : null));

    // Daftar PM per status
    nodes.push(h('div', { class: 'card' }, h('h2', {}, 'Rincian per PM'),
      pre.items.length ? pre.items.map((it) => h('div', { class: 'row', style: { padding: '7px 0', borderBottom: '1px solid var(--line-2)' } },
        h('div', { class: 'grow' }, h('div', { style: { fontWeight: 700 } }, it.nama_pm), it.alasan ? h('div', { class: 'hint' }, it.alasan) : null),
        it.status === 'SIAP' || it.status === 'SUDAH_DIBUAT' ? h('b', { class: 'num' }, num(it.total)) : null,
        chip(LABEL_STATUS[it.status], WARNA_STATUS[it.status]),
        // BARU 28 Okt 2026 (diminta Admin -- bisa buka hasil LANGSUNG
        // dari sini, tanpa perlu buka halaman Arsip terpisah).
        it.fileDokumen ? h('a', { href: it.fileDokumen, target: '_blank', rel: 'noopener', class: 'btn-mini ghost', style: { marginLeft: '6px' } }, icon('file', 14), 'Buka') : null
      )) : emptyState('users', 'Belum ada PM aktif')));

    nodes.push(h('button', { class: 'btn big gold block', disabled: !r.siapGenerate || busy, onclick: klikGenerate },
      icon('bolt', 20), 'GENERATE ' + r.siapGenerate + ' DOKUMEN'));

    body.replaceChildren(...nodes);
  }

  function baris(label, v) {
    return h('div', { class: 'row', style: { padding: '4px 0' } }, h('span', { class: 'grow' }, label), h('b', { class: 'num' }, num(v)));
  }

  async function klikGenerate() {
    const r = pre.ringkasan;
    const ok = await confirmDialog({
      title: 'Generate dokumen?',
      message: h('div', {}, h('p', { style: { margin: '0 0 8px' } }, hariIndo(tgl) + ', ' + tglIndo(tgl)),
        h('p', { style: { margin: 0 } }, r.siapGenerate + ' PM akan dibuatkan BAST + Surat Jalan. PM yang sudah pernah dibuat atau libur/nonaktif dilewati otomatis.')),
      confirmText: 'Generate'
    });
    if (!ok) return;
    busy = true; showBusy('Membuat dokumen…', 'Mohon tunggu dan jangan tutup halaman. Untuk banyak PM, proses dapat memakan waktu 1–2 menit.');
    let hasil;
    try { hasil = await api('bastSj.generate', { tanggal: tgl }, { timeout: 300000 }); }
    catch (e) {
      hideBusy(); busy = false;
      modal({ title: 'Generate gagal', body: banner('err', errMsg(e)), actions: [{ label: 'Tutup', kind: 'ghost' }] });
      await load(); return;
    }
    hideBusy(); busy = false;
    if (hasil.status === 'TIDAK_ADA') { toast('Tidak ada PM yang siap digenerate.', 'warn'); await load(); return; }
    selesai(hasil); await load();
  }

  function selesai(hasil) {
    const h2 = hasil.hasil;
    modal({
      title: 'Generate selesai',
      body: h('div', { class: 'stack' },
        banner(h2.gagal.length ? 'warn' : 'ok', h2.berhasil.length + ' berhasil' + (h2.gagal.length ? ', ' + h2.gagal.length + ' gagal' : '') + '.'),
        h2.berhasil.length ? h('div', { style: { maxHeight: '200px', overflow: 'auto', border: '1px solid var(--line)', borderRadius: '10px', padding: '4px 10px' } },
          h2.berhasil.map((b) => h('div', { class: 'row', style: { padding: '5px 0', fontSize: '13.5px' } },
            h('div', { class: 'grow' }, b.nama_pm), h('code', {}, b.nomorBast)))) : null,
        h2.gagal.length ? h('div', { style: { marginTop: '8px' } },
          h2.gagal.map((g) => h('div', { class: 'issue error' }, h('span', { class: 'dot' }), h('div', {}, h('b', {}, g.nama_pm), h('div', { class: 'hint' }, g.pesan))))) : null),
      actions: [{ label: 'Tutup', kind: 'ghost' }, { label: 'Buka Arsip', onClick: () => { location.hash = '#/arsip?tanggal=' + tgl; return false; } }]
    });
  }

  await load();
}
