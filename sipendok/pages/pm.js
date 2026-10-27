import { h, icon } from '../util.js';
import { api } from '../api.js';
import { S, refreshMaster } from '../store.js';
import { toast, modal, chip, emptyState, errMsg, field, banner } from '../ui.js';

// Dirombak 23 Okt 2026, DIKEMBALIKAN SEBAGIAN 27 Okt 2026 (DISETUJUI
// Admin, membatalkan simplifikasi 23 Okt yg menghilangkan JENIS_PM dari
// form). JENIS_PM (SEKOLAH/POSYANDU) SEKARANG DITANYAKAN LAGI --
// Sekolah pakai Porsi Kecil/Besar, Posyandu pakai Balita/Bumil/Busui
// (field TERPISAH, lihat Config.gs/Master.gs). Alasan: template BAST+SJ
// baru 2 lembar BUTUH pembedaan ini utk pilih lembar yg benar.
const JENIS_LABEL = { SEKOLAH: 'Sekolah', POSYANDU: 'Posyandu' };

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

  const kosong = (v) => v === '' || v === undefined || v === null ? '—' : v;
  const angka = (v) => v === '' || v === undefined || v === null ? 0 : Number(v);

  // Kartu: Nama+Jenis+Status atas, PIC, lalu baris acuan SESUAI JENIS_PM
  // (Porsi Kecil/Besar utk Sekolah, Balita/Bumil/Busui utk Posyandu).
  function kartuPm(p) {
    const pic = picUntukPm(p.ID_PM);
    const isPosyandu = p.JENIS_PM === 'POSYANDU';
    const baris = isPosyandu
      ? [['Balita', kosong(p.ACUAN_BALITA)], ['Bumil', kosong(p.ACUAN_BUMIL)], ['Busui', kosong(p.ACUAN_BUSUI)]]
      : [['Porsi kecil', kosong(p.ACUAN_PORSI_KECIL)], ['Porsi besar', kosong(p.ACUAN_PORSI_BESAR)]];
    const total = isPosyandu
      ? angka(p.ACUAN_BALITA) + angka(p.ACUAN_BUMIL) + angka(p.ACUAN_BUSUI)
      : angka(p.ACUAN_PORSI_KECIL) + angka(p.ACUAN_PORSI_BESAR);
    baris.push(['Total acuan', total]);

    return h('div', { class: 'card' + (p.STATUS !== 'Aktif' ? ' off' : ''), style: { marginBottom: '10px' } },
      h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'title' }, p.NAMA_PM)),
        chip(JENIS_LABEL[p.JENIS_PM] || p.JENIS_PM, isPosyandu ? '' : 'info'), chip(p.STATUS, p.STATUS === 'Aktif' ? 'ok' : '')),
      h('div', { class: 'hint', style: { margin: '2px 0 10px' } }, pic ? 'PIC: ' + pic.NAMA_PIC : h('span', { style: { color: 'var(--err)' } }, 'PIC belum diisi')),
      h('div', { class: 'row', style: { gap: '18px', textAlign: 'center' } },
        baris.map(([label, val]) => h('div', {}, h('div', { class: 'hint' }, label), h('div', { class: 'title' }, val)))),
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
            // Kirim SEMUA field acuan apa adanya (tidak peduli jenis PM --
            // backend yg validasi mana yg relevan) supaya tidak hilang saat ganti status.
            await api('pm.save', { ID_PM: p.ID_PM, NAMA_PM: p.NAMA_PM, JENIS_PM: p.JENIS_PM, ALAMAT: p.ALAMAT,
              STATUS: nonaktifkan ? 'Tidak Aktif' : 'Aktif',
              KETERANGAN: nonaktifkan && alasan.value.trim() ? alasan.value.trim() : p.KETERANGAN,
              ACUAN_PORSI_KECIL: p.ACUAN_PORSI_KECIL, ACUAN_PORSI_BESAR: p.ACUAN_PORSI_BESAR, ACUAN_NO_KENDARAAN: p.ACUAN_NO_KENDARAAN,
              ACUAN_JUMLAH_SISWA: p.ACUAN_JUMLAH_SISWA, ACUAN_BALITA: p.ACUAN_BALITA, ACUAN_BUMIL: p.ACUAN_BUMIL, ACUAN_BUSUI: p.ACUAN_BUSUI });
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
    let jenis = pm ? (pm.JENIS_PM || 'SEKOLAH') : 'SEKOLAH';
    const nama = h('input', { class: 'input', value: pm ? pm.NAMA_PM : '', maxlength: 120, autocomplete: 'off' });

    // Sekolah
    const porsiKecil = h('input', { class: 'input', type: 'number', min: '0', step: '1', value: pm && pm.ACUAN_PORSI_KECIL !== '' && pm.ACUAN_PORSI_KECIL !== undefined ? pm.ACUAN_PORSI_KECIL : '' });
    const porsiBesar = h('input', { class: 'input', type: 'number', min: '0', step: '1', value: pm && pm.ACUAN_PORSI_BESAR !== '' && pm.ACUAN_PORSI_BESAR !== undefined ? pm.ACUAN_PORSI_BESAR : '' });
    const jumlahSiswa = h('input', { class: 'input', type: 'number', min: '0', step: '1', value: pm && pm.ACUAN_JUMLAH_SISWA !== '' && pm.ACUAN_JUMLAH_SISWA !== undefined ? pm.ACUAN_JUMLAH_SISWA : '' });
    // Posyandu
    const balita = h('input', { class: 'input', type: 'number', min: '0', step: '1', value: pm && pm.ACUAN_BALITA !== '' && pm.ACUAN_BALITA !== undefined ? pm.ACUAN_BALITA : '' });
    const bumil = h('input', { class: 'input', type: 'number', min: '0', step: '1', value: pm && pm.ACUAN_BUMIL !== '' && pm.ACUAN_BUMIL !== undefined ? pm.ACUAN_BUMIL : '' });
    const busui = h('input', { class: 'input', type: 'number', min: '0', step: '1', value: pm && pm.ACUAN_BUSUI !== '' && pm.ACUAN_BUSUI !== undefined ? pm.ACUAN_BUSUI : '' });

    const totalTampil = h('div', { class: 'input', style: { background: 'var(--bg-2, #f4f6f9)', fontWeight: '700' } }, '0');
    const hitungTotal = () => {
      totalTampil.textContent = String(jenis === 'POSYANDU'
        ? (Number(balita.value) || 0) + (Number(bumil.value) || 0) + (Number(busui.value) || 0)
        : (Number(porsiKecil.value) || 0) + (Number(porsiBesar.value) || 0));
    };
    [porsiKecil, porsiBesar, balita, bumil, busui].forEach((el) => { el.oninput = hitungTotal; });

    const kendaraan = h('input', { class: 'input', maxlength: 20, value: pm ? pm.ACUAN_NO_KENDARAAN || '' : '', placeholder: 'mis. B 1234 XYZ', style: { textTransform: 'uppercase' } });
    const alamat = h('textarea', { class: 'input', maxlength: 250 }, pm ? pm.ALAMAT : '');
    const ket = h('textarea', { class: 'input', maxlength: 250 }, pm ? pm.KETERANGAN : '');
    const err = h('div', {});

    const blokSekolah = h('div', { class: 'form-grid' },
      h('div', { class: 'row', style: { gap: '10px' } }, field('Porsi kecil', porsiKecil), field('Porsi besar', porsiBesar)),
      field('Jumlah siswa acuan (opsional, utk Insentif PIC)', jumlahSiswa));
    const blokPosyandu = h('div', { class: 'form-grid' },
      h('div', { class: 'row', style: { gap: '10px' } }, field('Balita', balita), field('Bumil', bumil), field('Busui', busui)));
    const blokJenis = h('div', {});
    function gambarBlokJenis() { blokJenis.replaceChildren(jenis === 'POSYANDU' ? blokPosyandu : blokSekolah); hitungTotal(); }

    const jenisSel = h('select', { class: 'input', onchange: (e) => { jenis = e.target.value; gambarBlokJenis(); } },
      h('option', { value: 'SEKOLAH', selected: jenis === 'SEKOLAH' }, 'Sekolah'),
      h('option', { value: 'POSYANDU', selected: jenis === 'POSYANDU' }, 'Posyandu'));

    modal({
      title: pm ? 'Ubah PM' : 'Tambah PM',
      body: h('div', { class: 'form-grid' },
        field('Nama sekolah / Posyandu', nama),
        field('Jenis PM', jenisSel, pm ? 'Mengubah jenis PM tidak memindahkan data acuan lama -- isi ulang field di bawah sesuai jenis baru.' : null),
        blokJenis,
        field('Total acuan — otomatis', totalTampil),
        field('Nomor kendaraan', kendaraan, 'Opsional — digunakan sebagai nilai awal di Penerimaan Harian.'),
        field('Alamat', alamat),
        field('Keterangan', ket), err),
      actions: [{ label: 'Batal', kind: 'ghost' }, {
        label: 'Simpan', onClick: async (ev) => {
          const btn = ev.currentTarget; btn.disabled = true; err.replaceChildren();
          try {
            await api('pm.save', {
              ID_PM: pm ? pm.ID_PM : undefined, NAMA_PM: nama.value, JENIS_PM: jenis,
              ALAMAT: alamat.value, STATUS: pm ? pm.STATUS : 'Aktif', KETERANGAN: ket.value,
              ACUAN_PORSI_KECIL: jenis === 'SEKOLAH' ? porsiKecil.value : '', ACUAN_PORSI_BESAR: jenis === 'SEKOLAH' ? porsiBesar.value : '',
              ACUAN_JUMLAH_SISWA: jenis === 'SEKOLAH' ? jumlahSiswa.value : '',
              ACUAN_BALITA: jenis === 'POSYANDU' ? balita.value : '', ACUAN_BUMIL: jenis === 'POSYANDU' ? bumil.value : '', ACUAN_BUSUI: jenis === 'POSYANDU' ? busui.value : '',
              ACUAN_NO_KENDARAAN: kendaraan.value
            });
            await refreshMaster(); draw(); toast(pm ? 'PM diperbarui.' : 'PM ditambahkan.', 'ok');
          } catch (e) { err.replaceChildren(banner('err', errMsg(e))); btn.disabled = false; return false; }
        } }]
    });
    gambarBlokJenis();
  }
  draw();
}
