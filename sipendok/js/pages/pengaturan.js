import { h, icon } from '../util.js';
import { api, session } from '../api.js';
import { S } from '../store.js';
import { toast, banner, chip, errMsg, field, skeleton } from '../ui.js';

export async function render(root, ctx) {
  let cfg;
  try { cfg = await api('pengaturan.get'); } catch (e) { root.append(banner('err', errMsg(e))); return; }
  if (!ctx.alive()) return;
  const f = {
    NAMA_SPPG: h('input', { class: 'input', value: cfg.NAMA_SPPG || '', maxlength: 80 }),
    TAHUN_AKTIF: h('input', { class: 'input', value: cfg.TAHUN_AKTIF || '', inputmode: 'numeric', maxlength: 4 }),
    BUAT_PDF: h('select', { class: 'select' }, ['YA', 'TIDAK'].map((x) => h('option', { value: x, selected: (cfg.BUAT_PDF || 'YA') === x }, x))),
    TEMPLATE_DOKUMEN: h('input', { class: 'input', value: cfg.TEMPLATE_DOKUMEN || '', autocomplete: 'off', spellcheck: 'false' }),
    // BARU 25 Okt 2026 (ditemukan Admin salah isi field TEMPLATE_DOKUMEN
    // di atas dgn File ID template BAST+SJ -- field itu memang utk
    // Dokumen Penerimaan lama, BUKAN utk ini). Field terpisah supaya
    // tidak tertukar lagi.
    TEMPLATE_BAST_SJ: h('input', { class: 'input', value: cfg.TEMPLATE_BAST_SJ || '', autocomplete: 'off', spellcheck: 'false' }),
    FOLDER_DOKUMEN: h('input', { class: 'input', value: cfg.FOLDER_DOKUMEN || '', autocomplete: 'off', spellcheck: 'false' })
  };
  const ro = (v) => h('input', { class: 'input', value: v, readOnly: true });
  const result = h('div', {}), btnSave = h('button', { class: 'btn', onclick: simpan }, icon('check', 18), 'Simpan pengaturan'), btnCek = h('button', { class: 'btn ghost', onclick: cek }, icon('file', 18), 'Cek template Dokumen Penerimaan');
  const resultBastSj = h('div', {}), btnCekBastSj = h('button', { class: 'btn ghost', onclick: cekBastSj }, icon('file', 18), 'Cek template BAST + Surat Jalan');

  async function simpan() {
    btnSave.disabled = true; result.replaceChildren();
    try {
      const r = await api('pengaturan.save', Object.fromEntries(Object.entries(f).map(([k, el]) => [k, el.value])));
      S.settings = { NAMA_SPPG: r.NAMA_SPPG, KODE_SPPG: r.KODE_SPPG, TAHUN_AKTIF: r.TAHUN_AKTIF, BUAT_PDF: r.BUAT_PDF };
      toast('Pengaturan disimpan.', 'ok');
    } catch (e) { result.replaceChildren(banner('err', errMsg(e))); } finally { btnSave.disabled = false; }
  }
  async function cek() {
    btnCek.disabled = true; result.replaceChildren(skeleton(1));
    try {
      const r = await api('pengaturan.cekTemplate');
      result.replaceChildren(banner(r.ok ? 'ok' : 'err', r.pesan, r.ok ? h('div', { class: 'hint', style: { marginTop: '4px' } }, 'Placeholder: ' + r.placeholders.map((p) => `{{${p}}}`).join(' ')) : null));
    } catch (e) { result.replaceChildren(banner('err', errMsg(e))); } finally { btnCek.disabled = false; }
  }
  // BARU 25 Okt 2026 -- cek template BAST+Surat Jalan TERPISAH dari
  // cek() di atas (template & placeholder yg diperiksa beda sama sekali).
  async function cekBastSj() {
    btnCekBastSj.disabled = true; resultBastSj.replaceChildren(skeleton(1));
    try {
      const r = await api('pengaturan.cekTemplateBastSj');
      resultBastSj.replaceChildren(banner(r.ok ? 'ok' : 'err', r.pesan, r.ok ? h('div', { class: 'hint', style: { marginTop: '4px' } }, 'Placeholder: ' + r.placeholders.map((p) => `{{${p}}}`).join(' ')) : null));
    } catch (e) { resultBastSj.replaceChildren(banner('err', errMsg(e))); } finally { btnCekBastSj.disabled = false; }
  }

  const u = session.user || {};
  root.append(
    h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Pengaturan'), h('div', { class: 'sub' }, 'Konfigurasi SIPENDOK (tersimpan di sheet 08_PENGATURAN)'))),
    h('div', { class: 'stack' },
      h('div', { class: 'card' }, h('h2', {}, 'Umum'), h('div', { class: 'form-grid' },
        field('Nama SPPG', f.NAMA_SPPG), field('Kode SPPG (dipakai pada nomor BAST/SJ)', ro(cfg.KODE_SPPG || ''), 'Ubah langsung di sheet bila perlu — jangan di tengah tahun.'),
        field('Tahun aktif', f.TAHUN_AKTIF),
        // Diperbaiki 25 Okt 2026 -- label & keterangan SEBELUMNYA masih
        // bilang "BULANAN"/"setiap bulan" walau nilai sesungguhnya
        // sudah diganti 'PER_PERIODE' (lihat Config.gs, Bast.gs) --
        // info ini jadi MENYESATKAN Admin. Diperbaiki pakai nilai
        // SESUNGGUHNYA dari cfg, bukan teks tetap.
        field('Reset nomor BAST/SJ', ro(cfg.RESET_NOMOR_BAST || '-'), cfg.RESET_NOMOR_BAST === 'PER_PERIODE' ? 'Nomor dimulai dari 001 setiap Periode Operasional baru (dari Portal Pengelola), bukan per bulan.' : 'Nomor dimulai dari 001 setiap bulan.'))),
      h('div', { class: 'card' }, h('h2', {}, 'Dokumen Penerimaan (fitur lama)'), h('div', { class: 'form-grid' },
        field('Template dokumen (Drive File ID)', f.TEMPLATE_DOKUMEN, 'File .docx master berisi 2 lembar: SEKOLAH dan POSYANDU (BA + Surat Jalan satu lembar per PM). JANGAN diisi dengan template BAST+SJ baru — pakai kolom terpisah di bawah.'),
        field('Folder dokumen (Drive Folder ID)', f.FOLDER_DOKUMEN, 'Folder root “SIPENDOK”; subfolder tahun/bulan/WORD|PDF dibuat otomatis.'),
        field('Buat PDF otomatis', f.BUAT_PDF)),
        h('div', { class: 'row wrap', style: { marginTop: '14px' } }, btnSave, btnCek), h('div', { style: { marginTop: '12px' } }, result)),
      h('div', { class: 'card' }, h('h2', {}, 'Generate Dokumen — BAST + Surat Jalan (fitur baru)'), h('div', { class: 'form-grid' },
        field('Template BAST + Surat Jalan (Drive File ID)', f.TEMPLATE_BAST_SJ, 'Satu file .docx berisi BAST dan Surat Jalan dalam satu lembar per kegiatan distribusi — TERPISAH dari template Dokumen Penerimaan di atas.')),
        h('div', { class: 'row wrap', style: { marginTop: '14px' } }, btnCekBastSj), h('div', { style: { marginTop: '12px' } }, resultBastSj)),
      h('div', { class: 'card' }, h('h2', {}, 'Aplikasi'), h('dl', { class: 'kv' }, h('dt', {}, 'Pengguna'), h('dd', {}, u.nama || '-'), h('dt', {}, 'Versi backend'), h('dd', {}, S.versi || '-'), h('dt', {}, 'Tarif'), h('dd', {}, 'sheet 04_TARIF')),
        h('div', { class: 'row wrap', style: { marginTop: '12px' } },
          window.__installEvt ? h('button', { class: 'btn ghost', onclick: async () => { const e = window.__installEvt; e.prompt(); await e.userChoice; window.__installEvt = null; ctx.go('pengaturan'); } }, icon('download', 18), 'Pasang ke layar utama') : null,
          h('a', { class: 'btn ghost', href: '#/dashboard' }, 'Kembali')))));
}
