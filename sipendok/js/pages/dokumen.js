import { h, icon, num, todayJakarta, tglIndo, hariIndo, waktuIndo } from '../util.js';
import { api } from '../api.js';
import { S } from '../store.js';
import { toast, modal, confirmDialog, showBusy, hideBusy, chip, banner, skeleton, emptyState, linkBtn, errMsg, field } from '../ui.js';

export async function render(root, ctx) {
  let tgl = ctx.params.tanggal || todayJakarta();
  let v = null, buatPdf = S.settings.BUAT_PDF !== 'TIDAK', busy = false;
  const body = h('div', { class: 'stack' });
  const dateIn = h('input', { class: 'input', type: 'date', id: 'dtgl', value: tgl, onchange: (e) => { if (e.target.value) { tgl = e.target.value; load(); } } });
  root.append(h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Dokumen Penerimaan'), h('div', { class: 'sub' }, 'BA Penerimaan + Surat Jalan — satu lembar per PM, satu file per tanggal'))),
    h('div', { class: 'card' }, field('Tanggal dokumen', dateIn)), h('div', { style: { height: '12px' } }), body);

  async function load() {
    body.replaceChildren(skeleton(3));
    try { v = await api('dokumen.validasi', { tanggal: tgl }); } catch (e) { if (ctx.alive()) body.replaceChildren(banner('err', errMsg(e))); return; }
    if (ctx.alive()) draw();
  }

  function aksi(m) {
    if (!m.id_pm || /Template|Folder|KODE_SPPG/.test(m.field)) return h('a', { href: '#/pengaturan' }, 'Buka Pengaturan →');
    if (/^PIC/.test(m.field)) return h('a', { href: '#/pic' }, 'Lengkapi PIC →');
    if (/Nama PM|Jenis PM|Status/.test(m.field)) return h('a', { href: '#/pm' }, 'Buka data PM →');
    return h('a', { href: `#/penerimaan?tanggal=${tgl}&pm=${m.id_pm}` }, 'Buka penerimaan →');
  }

  function draw() {
    const errs = v.masalah.filter((m) => m.level === 'error'), warns = v.masalah.filter((m) => m.level === 'warning'), infos = v.masalah.filter((m) => m.level === 'info');
    const nodes = [];

    // status dokumen yang sudah ada
    if (v.dokumen) {
      nodes.push(h('div', { class: 'card' }, h('div', { class: 'row wrap' }, chip(v.perluRevisi ? 'Perlu dibuat ulang' : 'Sudah dibuat', v.perluRevisi ? 'err' : 'ok'),
        h('span', { class: 'muted grow', style: { fontSize: '13px' } }, `${waktuIndo(v.dokumen.WAKTU_GENERATE)} oleh ${v.dokumen.USER_GENERATE || '-'}`)),
        h('div', { class: 'row wrap', style: { marginTop: '10px' } }, linkBtn('Buka Word', v.dokumen.FILE_WORD, 'ghost sm', 'file'), v.dokumen.FILE_PDF ? linkBtn('Buka PDF', v.dokumen.FILE_PDF, 'ghost sm', 'file') : chip('Tanpa PDF', 'warn'))));
      if (v.perluRevisi) nodes.push(banner('warn', h('b', {}, 'Data berubah setelah dokumen dibuat. '), 'Generate ulang agar dokumen sesuai. Nomor BAST yang sudah ada dipertahankan.'));
    }

    // validasi: DATA BELUM LENGKAP — per PM beserta field yang kurang
    if (errs.length) {
      const groups = [], idx = {};
      errs.forEach((m) => { const k = m.id_pm || '_cfg'; if (idx[k] === undefined) { idx[k] = groups.length; groups.push({ nama: m.nama_pm, items: [] }); } groups[idx[k]].items.push(m); });
      const n = v.jumlahPmBermasalah;
      nodes.push(h('div', { class: 'card issue-box', style: { borderColor: '#f0b9b9' } },
        h('div', { class: 'row', style: { marginBottom: '2px' } }, icon('alert', 20), h('h3', {}, 'DATA BELUM LENGKAP')),
        h('div', { class: 'muted', style: { fontSize: '13.5px', marginBottom: '6px' } }, n ? `${n} PM belum lengkap — dokumen tidak dibuat sebagian.` : 'Pengaturan belum lengkap.'),
        groups.map((g) => h('div', { class: 'issue error' }, h('span', { class: 'dot' }), h('div', {},
          h('b', {}, g.nama), h('div', { class: 'fields' }, 'Belum lengkap: ' + g.items.map((m) => m.field).join(', ')),
          g.items.map((m) => h('div', { class: 'hint' }, m.pesan, ' ', aksi(m))))))));
    } else {
      nodes.push(banner('ok', h('b', {}, 'Data lengkap. '), `${num(v.jumlahPm)} PM · ${num(v.totalPaket)} paket siap dibuatkan dokumen.`));
    }
    if (warns.length) nodes.push(h('div', { class: 'card' }, h('div', { class: 'row', style: { marginBottom: '4px' } }, chip('Peringatan — tidak menghalangi', 'warn')),
      warns.map((m) => h('div', { class: 'issue warning' }, h('span', { class: 'dot' }), h('div', {}, h('b', {}, m.nama_pm), ' · ', m.field, h('div', { class: 'hint' }, m.pesan, ' ', aksi(m)))))));

    // daftar PM
    if (v.items.length) {
      nodes.push(h('div', { class: 'card' }, h('h2', {}, `Isi dokumen — ${tglIndo(tgl)}`),
        v.items.map((it) => h('div', { class: 'row', style: { padding: '7px 0', borderBottom: '1px solid var(--line-2)' } },
          h('div', { class: 'grow' }, h('div', { style: { fontWeight: 700 } }, it.nama_pm), h('div', { class: 'hint' }, it.sertakan ? `${it.jenis} · ${it.nomor_bast ? (v.dokumen ? it.nomor_bast : it.nomor_bast + ' (perkiraan)') : 'nomor otomatis'}` : (it.total === 0 ? 'Tidak ada penerimaan — dilewati' : 'Belum lengkap'))),
          h('b', { class: 'num' }, it.total === null ? '—' : num(it.total)), it.sertakan ? icon('check', 18) : icon('alert', 18))),
        infos.length ? h('div', { class: 'hint', style: { marginTop: '8px' } }, `${infos.length} PM tidak menerima paket pada tanggal ini dan tidak dibuatkan dokumen.`) : null));
    } else nodes.push(emptyState('inbox', 'Belum ada PM aktif'));

    // opsi & tombol
    const sw = h('input', { type: 'checkbox', checked: buatPdf, onchange: (e) => { buatPdf = e.target.checked; } });
    nodes.push(h('div', { class: 'card' }, h('label', { class: 'switch' }, sw, 'Buat juga file PDF'),
      h('div', { class: 'hint', style: { margin: '6px 0 12px' } }, 'Hasil: 1 file Word (semua PM) + 1 file PDF di Google Drive: SIPENDOK / tahun / bulan / WORD & PDF.'),
      h('button', { class: 'btn big gold block', id: 'btn-gen', disabled: !v.ok || busy, onclick: klikGenerate }, icon('bolt', 20), v.dokumen ? 'GENERATE ULANG' : 'GENERATE SEMUA DOKUMEN')));
    body.replaceChildren(...nodes);
  }

  async function klikGenerate() {
    if (v.dokumen) { tanyaAda(v.dokumen); return; }
    const ok = await confirmDialog({ title: 'Buat dokumen penerimaan?', message: h('div', {}, h('p', { style: { margin: '0 0 8px' } }, `${hariIndo(tgl)}, ${tglIndo(tgl)}`), h('p', { style: { margin: 0 } }, `${num(v.jumlahPm)} PM · ${num(v.totalPaket)} paket. Nomor BAST dibuat otomatis untuk setiap PM.`), v.masalah.some((m) => m.level === 'warning') ? h('p', { class: 'hint', style: { margin: '8px 0 0' } }, `${v.masalah.filter((m) => m.level === 'warning').length} peringatan (tidak menghalangi).`) : null), confirmText: 'Generate' });
    if (ok) await jalankan(false);
  }

  function tanyaAda(d) {
    modal({
      title: 'Dokumen sudah pernah dibuat',
      body: h('div', { class: 'stack' }, h('p', { style: { margin: 0 } }, 'Dokumen penerimaan untuk tanggal ini sudah pernah dibuat.'),
        h('dl', { class: 'kv' }, h('dt', {}, 'Dibuat'), h('dd', {}, waktuIndo(d.WAKTU_GENERATE)), h('dt', {}, 'Oleh'), h('dd', {}, d.USER_GENERATE || '-'), h('dt', {}, 'Jumlah'), h('dd', {}, `${num(d.JUMLAH_PM)} PM · ${num(d.TOTAL_PAKET)} paket`)),
        v.perluRevisi ? banner('warn', 'Data berubah sejak dokumen ini dibuat.') : null),
      actions: [
        { label: 'Buka Dokumen Sebelumnya', kind: 'ghost', onClick: () => { window.open(d.FILE_PDF || d.FILE_WORD, '_blank', 'noopener'); return false; } },
        { label: 'Generate Ulang', kind: 'danger', onClick: async () => {
          const ok = await confirmDialog({ title: 'Generate ulang?', message: 'Nomor BAST yang sudah tercatat TIDAK berubah. File baru disimpan sebagai revisi; file lama tetap ada di Drive dan ditandai “Diganti”.', confirmText: 'Ya, generate ulang' });
          if (ok) jalankan(true);
        } },
        { label: 'Batal', kind: 'ghost' }]
    });
  }

  async function jalankan(ulang) {
    busy = true; showBusy('Membuat dokumen…', 'Mohon tunggu dan jangan tutup halaman. Untuk banyak PM, proses dapat memakan waktu 1–2 menit.');
    let r;
    try { r = await api('dokumen.generate', { tanggal: tgl, generateUlang: ulang, buatPdf }, { timeout: 300000 }); }
    catch (e) {
      hideBusy(); busy = false;
      modal({ title: 'Dokumen gagal dibuat', body: h('div', { class: 'stack' }, banner('err', errMsg(e)), h('p', { class: 'hint', style: { margin: 0 } }, 'Tidak ada nomor BAST yang terpakai bila pesan menyebut pembatalan. Bila ragu (mis. koneksi putus), cek menu Arsip sebelum mengulang.')), actions: [{ label: 'Tutup', kind: 'ghost' }] });
      await load(); return;
    }
    hideBusy(); busy = false;
    if (r.status === 'INVALID') { v = r.validasi; draw(); toast('Data belum lengkap — periksa daftar masalah.', 'warn'); return; }
    if (r.status === 'SUDAH_ADA') { await load(); tanyaAda(r.dokumen); return; }
    selesai(r); await load();
  }

  function selesai(r) {
    const d = r.dokumen;
    modal({
      title: 'Dokumen berhasil dibuat',
      body: h('div', { class: 'stack' },
        banner('ok', `${num(d.JUMLAH_PM)} PM · ${num(d.TOTAL_PAKET)} paket${r.revisi > 1 ? ` · revisi ${r.revisi}` : ''}`),
        r.pdfError ? banner('warn', h('b', {}, 'PDF tidak terbuat. '), r.pdfError, ' File Word tetap tersimpan.') : null,
        h('div', { style: { maxHeight: '240px', overflow: 'auto', border: '1px solid var(--line)', borderRadius: '10px', padding: '4px 10px' } },
          r.bast.map((b) => h('div', { class: 'row', style: { padding: '5px 0', fontSize: '13.5px' } }, h('div', { class: 'grow' }, b.nama_pm), h('code', {}, b.nomor.split('/')[0]), b.baru ? null : chip('tetap', '')))),
        h('div', { class: 'hint' }, `Format nomor: ${r.bast[0].nomor}`)),
      actions: [{ label: 'Tutup', kind: 'ghost' }, { label: 'Buka Word', onClick: () => { window.open(d.FILE_WORD, '_blank', 'noopener'); return false; } }, d.FILE_PDF ? { label: 'Buka PDF', onClick: () => { window.open(d.FILE_PDF, '_blank', 'noopener'); return false; } } : null].filter(Boolean)
    });
  }
  await load();
}
