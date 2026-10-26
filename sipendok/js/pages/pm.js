import { h, icon } from '../util.js';
import { api } from '../api.js';
import { S, refreshMaster } from '../store.js';
import { toast, modal, chip, emptyState, errMsg, field, banner } from '../ui.js';

// Dirombak total 23 Okt 2026 (diminta Admin, dokumen Pembaruan SIPENDOK
// §5) -- Data Acuan PM: Nama, PIC (dari tabel PIC terpisah, TIDAK
// diubah di sini), Porsi Kecil/Besar/Total (otomatis), No. Kendaraan.
// JENIS_PM (SEKOLAH/POSYANDU) SENGAJA TIDAK ditanyakan lagi di form --
// backend default 'SEKOLAH' diam2 (field lama dipertahankan, lihat
// Master.gs) supaya data Posyandu LAMA & 03_PENERIMAAN yg sudah ada
// tidak rusak, tapi pengguna baru tidak perlu memikirkannya.
export async function render(root, ctx) {
  let q = '', showOff = false;
  const list = h('div', { class: 'list' });
  const search = h('input', { class: 'input', type: 'search', placeholder: 'Cari nama PM…', 'aria-label': 'Cari PM', oninput: (e) => { q = e.target.value.trim().toLowerCase(); draw(); } });
  const sw = h('input', { type: 'checkbox', onchange: (e) => { showOff = e.target.checked; draw(); } });
  root.append(
    h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Data Acuan PM'), h('div', { class: 'sub' }, 'Nama & profil Penerima Manfaat — dipakai otomatis di Penerimaan Harian')), h('div', { class: 'spacer' }),
      h('button', { class: 'btn', onclick: () => openForm(null) }, icon('plus', 18), 'Tambah PM')),
    h('div', { class: 'card' }, search, h('label', { class: 'switch', style: { marginTop: '10px' } }, sw, 'Tampilkan PM tidak aktif')), h('div', { style: { height: '12px' } }), list);

  function picUntukPm(idPm) {
    return (S.pic || []).find((p) => p.ID_PM === idPm && p.STATUS === 'Aktif') || null;
  }

  function draw() {
    const rows = S.pm.filter((p) => (showOff || p.STATUS === 'Aktif') && (!q || p.NAMA_PM.toLowerCase().includes(q)));
    if (!rows.length) { list.replaceChildren(emptyState('users', 'PM tidak ditemukan')); return; }
    list.replaceChildren(...rows.map((p) => kartuPm(p)));
  }

  // Susunan kartu sesuai dokumen §5.A: Nama+Status atas, PIC di bawah
  // nama, baris Porsi Kecil/Besar/Total, No. Kendaraan, lalu aksi.
  function kartuPm(p) {
    const pic = picUntukPm(p.ID_PM);
    const porsiKecil = p.ACUAN_PORSI_KECIL === '' || p.ACUAN_PORSI_KECIL === undefined ? '—' : p.ACUAN_PORSI_KECIL;
    const porsiBesar = p.ACUAN_PORSI_BESAR === '' || p.ACUAN_PORSI_BESAR === undefined ? '—' : p.ACUAN_PORSI_BESAR;
    const totalAcuan = (porsiKecil === '—' && porsiBesar === '—') ? '—' : (Number(porsiKecil === '—' ? 0 : porsiKecil) + Number(porsiBesar === '—' ? 0 : porsiBesar));

    return h('div', { class: 'card' + (p.STATUS !== 'Aktif' ? ' off' : ''), style: { marginBottom: '10px' } },
      h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'title' }, p.NAMA_PM)), chip(p.STATUS, p.STATUS === 'Aktif' ? 'ok' : '')),
      h('div', { class: 'hint', style: { margin: '2px 0 10px' } }, pic ? 'PIC: ' + pic.NAMA_PIC : h('span', { style: { color: 'var(--err)' } }, 'PIC belum diisi')),
      h('div', { class: 'row', style: { gap: '18px', textAlign: 'center' } },
        h('div', {}, h('div', { class: 'hint' }, 'Porsi kecil'), h('div', { class: 'title' }, porsiKecil)),
        h('div', {}, h('div', { class: 'hint' }, 'Porsi besar'), h('div', { class: 'title' }, porsiBesar)),
        h('div', {}, h('div', { class: 'hint' }, 'Total acuan'), h('div', { class: 'title' }, totalAcuan))),
      h('div', { style: { marginTop: '10px' } }, h('div', { class: 'hint' }, 'Nomor kendaraan'), h('div', {}, p.ACUAN_NO_KENDARAAN || '—')),
      p.KETERANGAN ? h('div', { class: 'hint', style: { marginTop: '6px' } }, p.KETERANGAN) : null,
      h('div', { class: 'row', style: { gap: '8px', marginTop: '12px', flexWrap: 'wrap' } },
        h('button', { class: 'btn ghost', onclick: () => openForm(p) }, icon('edit', 16), 'Edit Data'),
        h('button', { class: 'btn ghost', onclick: () => konfirmasiStatus(p) }, icon(p.STATUS === 'Aktif' ? 'slash' : 'check', 16), p.STATUS === 'Aktif' ? 'Nonaktifkan' : 'Aktifkan'),
        h('button', { class: 'btn ghost', style: { color: 'var(--err)' }, onclick: () => konfirmasiHapus(p) }, icon('trash', 16), 'Hapus')));
  }

  // §6.A -- dialog konfirmasi Nonaktifkan/Aktifkan dgan alasan opsional.
  function konfirmasiStatus(p) {
    const nonaktifkan = p.STATUS === 'Aktif';
    const alasan = h('textarea', { class: 'input', maxlength: 250, placeholder: 'Contoh: sekolah tidak lagi menjadi penerima manfaat' });
    modal({
      title: (nonaktifkan ? 'Nonaktifkan' : 'Aktifkan') + ' ' + p.NAMA_PM + '?',
      body: h('div', {},
        h('p', {}, nonaktifkan
          ? 'PM ini tidak akan disertakan pada penerimaan baru dan proses generate dokumen selama status nonaktif berlaku.'
          : 'PM ini akan kembali disertakan pada penerimaan baru sesuai tanggal operasional.'),
        h('p', {}, 'Data acuan dan riwayat dokumen sebelumnya tetap tersimpan.'),
        nonaktifkan ? field('Alasan (opsional)', alasan) : null),
      actions: [{ label: 'Batal', kind: 'ghost' }, {
        label: 'Konfirmasi ' + (nonaktifkan ? 'Nonaktifkan' : 'Aktifkan'), kind: nonaktifkan ? 'danger' : 'primary',
        onClick: async (ev) => {
          ev.currentTarget.disabled = true;
          try {
            await api('pm.save', { ID_PM: p.ID_PM, NAMA_PM: p.NAMA_PM, JENIS_PM: p.JENIS_PM, ALAMAT: p.ALAMAT,
              STATUS: nonaktifkan ? 'Tidak Aktif' : 'Aktif',
              KETERANGAN: nonaktifkan && alasan.value.trim() ? alasan.value.trim() : p.KETERANGAN,
              ACUAN_PORSI_KECIL: p.ACUAN_PORSI_KECIL, ACUAN_PORSI_BESAR: p.ACUAN_PORSI_BESAR, ACUAN_NO_KENDARAAN: p.ACUAN_NO_KENDARAAN });
            await refreshMaster(); draw();
            toast(p.NAMA_PM + (nonaktifkan ? ' dinonaktifkan.' : ' diaktifkan.'), 'ok');
          } catch (e) { toast(errMsg(e), 'err'); ev.currentTarget.disabled = false; return false; }
        } }]
    });
  }

  // §6.C -- Hapus: backend MENOLAK kalau PM sudah punya riwayat
  // penerimaan (lihat Pm.hapus, Master.gs) -- pesan error itu
  // ditampilkan apa adanya, bukan ditebak di frontend.
  function konfirmasiHapus(p) {
    modal({
      title: 'Hapus ' + p.NAMA_PM + '?',
      body: h('div', {},
        h('p', {}, 'Tindakan ini permanen. Hanya PM yang belum pernah memiliki riwayat penerimaan yang bisa dihapus.'),
        h('p', { class: 'hint' }, 'Kalau PM ini sudah pernah dipakai, gunakan "Nonaktifkan" sebagai gantinya.')),
      actions: [{ label: 'Batal', kind: 'ghost' }, {
        label: 'Hapus Permanen', kind: 'danger',
        onClick: async (ev) => {
          ev.currentTarget.disabled = true;
          try {
            await api('pm.delete', { ID_PM: p.ID_PM });
            await refreshMaster(); draw();
            toast(p.NAMA_PM + ' dihapus.', 'ok');
          } catch (e) { toast(errMsg(e), 'err'); ev.currentTarget.disabled = false; return false; }
        } }]
    });
  }

  function openForm(pm) {
    const nama = h('input', { class: 'input', value: pm ? pm.NAMA_PM : '', maxlength: 120, autocomplete: 'off' });
    const porsiKecil = h('input', { class: 'input', type: 'number', min: '0', step: '1', value: pm && pm.ACUAN_PORSI_KECIL !== '' && pm.ACUAN_PORSI_KECIL !== undefined ? pm.ACUAN_PORSI_KECIL : '' });
    const porsiBesar = h('input', { class: 'input', type: 'number', min: '0', step: '1', value: pm && pm.ACUAN_PORSI_BESAR !== '' && pm.ACUAN_PORSI_BESAR !== undefined ? pm.ACUAN_PORSI_BESAR : '' });
    const totalTampil = h('div', { class: 'input', style: { background: 'var(--bg-2, #f4f6f9)', fontWeight: '700' } },
      (pm && pm.ACUAN_PORSI_KECIL !== '' && pm.ACUAN_PORSI_BESAR !== '') ? (Number(pm.ACUAN_PORSI_KECIL || 0) + Number(pm.ACUAN_PORSI_BESAR || 0)) : '0');
    const hitungTotal = () => { totalTampil.textContent = String((Number(porsiKecil.value) || 0) + (Number(porsiBesar.value) || 0)); };
    porsiKecil.oninput = hitungTotal; porsiBesar.oninput = hitungTotal;
    const kendaraan = h('input', { class: 'input', maxlength: 20, value: pm ? pm.ACUAN_NO_KENDARAAN || '' : '', placeholder: 'mis. B 1234 XYZ', style: { textTransform: 'uppercase' } });
    const alamat = h('textarea', { class: 'input', maxlength: 250 }, pm ? pm.ALAMAT : '');
    const ket = h('textarea', { class: 'input', maxlength: 250 }, pm ? pm.KETERANGAN : '');
    const err = h('div', {});
    modal({
      title: pm ? 'Ubah PM' : 'Tambah PM',
      body: h('div', { class: 'form-grid' },
        field('Nama sekolah / PM', nama),
        h('div', { class: 'row', style: { gap: '10px' } }, field('Porsi kecil', porsiKecil), field('Porsi besar', porsiBesar)),
        field('Total porsi acuan — otomatis', totalTampil),
        field('Nomor kendaraan', kendaraan, 'Opsional — digunakan sebagai nilai awal di Penerimaan Harian.'),
        field('Alamat', alamat),
        field('Keterangan', ket), err),
      actions: [{ label: 'Batal', kind: 'ghost' }, {
        label: 'Simpan', onClick: async (ev) => {
          const btn = ev.currentTarget; btn.disabled = true; err.replaceChildren();
          try {
            await api('pm.save', {
              ID_PM: pm ? pm.ID_PM : undefined, NAMA_PM: nama.value, JENIS_PM: pm ? pm.JENIS_PM : undefined,
              ALAMAT: alamat.value, STATUS: pm ? pm.STATUS : 'Aktif', KETERANGAN: ket.value,
              ACUAN_PORSI_KECIL: porsiKecil.value, ACUAN_PORSI_BESAR: porsiBesar.value, ACUAN_NO_KENDARAAN: kendaraan.value
            });
            await refreshMaster(); draw(); toast(pm ? 'PM diperbarui.' : 'PM ditambahkan.', 'ok');
          } catch (e) { err.replaceChildren(banner('err', errMsg(e))); btn.disabled = false; return false; }
        } }]
    });
  }
  draw();
}
