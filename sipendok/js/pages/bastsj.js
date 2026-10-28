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

    // BARU 28 Okt 2026 (DIMINTA Admin: satu file gabungan per hari --
    // ikuti Master Prompt §9.1 "jangan tampilkan tombol Buka utk tiap
    // PM" dan Prompt Tambahan Fitur Cetak §1-2. Tombol di sini SATU
    // level-hari, bukan per-PM, krn skr semua PM hari yg sama berbagi
    // 1 file yg SAMA (lihat BastSj.gs prosesGenerate_).
    // "Cetak": membuka PDF di tab baru -- penampil PDF bawaan browser
    // (Chrome/Edge) punya ikon cetak sendiri di situ, ini pendekatan
    // paling andal krn web app TIDAK BISA memaksa dialog print browser
    // terbuka tanpa interaksi pengguna scr langsung (lihat Prompt
    // Tambahan §4). "Buka" & "Cetak" menuju file yg SAMA -- dipisah
    // labelnya spy maksud tombol jelas bagi pengguna.
    if (pre.fileDokumenHariIni) {
      nodes.push(h('div', { class: 'card' },
        h('div', { class: 'row', style: { alignItems: 'center' } },
          h('div', { class: 'grow' }, h('div', { style: { fontWeight: 700 } }, 'Dokumen gabungan hari ini sudah ada'),
            h('div', { class: 'hint' }, r.sudahDibuat + ' PM dalam 1 file')),
          h('a', { href: pre.fileDokumenHariIni, target: '_blank', rel: 'noopener', class: 'btn-mini ghost' }, icon('file', 14), 'Buka'),
          h('a', { href: pre.fileDokumenHariIni, target: '_blank', rel: 'noopener', class: 'btn-mini primary', style: { marginLeft: '6px' } }, icon('printer', 14), 'Cetak'))));
    }

    // Daftar PM per status
    nodes.push(h('div', { class: 'card' }, h('h2', {}, 'Rincian per PM'),
      pre.items.length ? pre.items.map((it) => h('div', { class: 'row', style: { padding: '7px 0', borderBottom: '1px solid var(--line-2)' } },
        h('div', { class: 'grow' }, h('div', { style: { fontWeight: 700 } }, it.nama_pm), it.alasan ? h('div', { class: 'hint' }, it.alasan) : null),
        it.status === 'SIAP' || it.status === 'SUDAH_DIBUAT' ? h('b', { class: 'num' }, num(it.total)) : null,
        chip(LABEL_STATUS[it.status], WARNA_STATUS[it.status])
      )) : emptyState('users', 'Belum ada PM aktif')));

    nodes.push(h('button', { class: 'btn big gold block', disabled: !r.siapGenerate || busy, onclick: klikGenerate },
      icon('bolt', 20), 'GENERATE ' + r.siapGenerate + ' DOKUMEN'));

    // BARU 28 Okt 2026 (Master Prompt Bagian 7 -- sebelumnya TIDAK ADA
    // cara mengulang dokumen yg sudah dibuat). Muncul HANYA kalau sudah
    // ada dokumen utk hari ini (r.sudahDibuat > 0) -- supaya PM baru yg
    // ditambahkan belakangan, atau menu yg diperbaiki, bisa disertakan
    // tanpa mengubah nomor PM yg sudah ada (lihat prosesGenerate_).
    if (r.sudahDibuat > 0) {
      nodes.push(h('button', { class: 'btn big block', style: { marginTop: '8px', background: 'var(--surface-2, #eef1f6)', color: 'var(--text)' }, disabled: busy, onclick: klikRegenerate },
        icon('refresh', 18), 'Regenerate (buat ulang ' + r.sudahDibuat + ' PM + ' + r.siapGenerate + ' PM baru)'));
    }

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

  /**
   * BARU 28 Okt 2026. Beda dgn klikGenerate: menyertakan PM yg SUDAH
   * dibuat sebelumnya (data/menu terbaru dipakai ulang, nomor BAST/SJ
   * TIDAK berubah -- lihat Bast.gs alokasi() & tes simulasi terverifikasi).
   */
  async function klikRegenerate() {
    const r = pre.ringkasan;
    const ok = await confirmDialog({
      title: 'Regenerate dokumen?',
      message: h('div', {}, h('p', { style: { margin: '0 0 8px' } }, hariIndo(tgl) + ', ' + tglIndo(tgl)),
        h('p', { style: { margin: '0 0 8px' } }, 'Dokumen gabungan akan dibuat ULANG dengan data terbaru (menu, kendaraan, dll).'),
        h('p', { style: { margin: 0 } }, h('b', {}, 'Nomor BAST dan Surat Jalan PM yang sudah ada TIDAK akan berubah.') + ' PM baru (jika ada) akan mendapat nomor lanjutan.')),
      confirmText: 'Regenerate',
      danger: false
    });
    if (!ok) return;
    busy = true; showBusy('Membuat ulang dokumen…', 'Mohon tunggu dan jangan tutup halaman. Nomor PM yang sudah ada tidak berubah.');
    let hasil;
    try { hasil = await api('bastSj.regenerate', { tanggal: tgl }, { timeout: 300000 }); }
    catch (e) {
      hideBusy(); busy = false;
      modal({ title: 'Regenerate gagal', body: banner('err', errMsg(e)), actions: [{ label: 'Tutup', kind: 'ghost' }] });
      await load(); return;
    }
    hideBusy(); busy = false;
    if (hasil.status === 'TIDAK_ADA') { toast('Tidak ada PM yang bisa diregenerate.', 'warn'); await load(); return; }
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
