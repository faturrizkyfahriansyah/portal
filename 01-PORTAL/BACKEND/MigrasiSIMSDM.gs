/**
 * SPPG JEUNGJING — PORTAL RELAWAN
 * MigrasiSIMSDM.gs — Eksekusi migrasi Tahap 2 (SIMSDM & Hak Akses
 * Terpusat), BARU 30 Okt 2026.
 *
 * Mengikuti pola PERSIS dgn migrasi yg SUDAH ADA & terbukti aman di
 * ManajemenHakAkses.gs (jalankanMigrasiRoleBaru): IDEMPOTEN (aman
 * dipanggil berkali-kali), ADITIF (kolom lama TIDAK PERNAH dihapus,
 * tetap sbg jalur rollback), dijalankan SEKALI manual lewat tombol UI
 * (atau sekali dari editor Apps Script), BUKAN otomatis saat deploy.
 *
 * Mengerjakan 3 bagian keputusan Admin (30 Okt 2026, lihat dokumen
 * Fase B/C -- Analisis SIMSDM):
 *   1. Tambah KATEGORI_SDM eksplisit (STAFF/RELAWAN) di 01_DATA_RELAWAN
 *   2. Bersihkan nilai DIVISI (Driver/Asisten Driver terpisah dari
 *      "Distribusi"; 3 Peran Staf pindah dari DIVISI ke JABATAN)
 *   3. Gabung 06_ADMIN ke 01_DATA_RELAWAN + 07_AKUN_RELAWAN
 *
 * TIDAK mengerjakan (sesuai keputusan Admin 30 Okt -- ditunda ke Tahap
 * 3 Autentikasi Terpusat): perubahan adminLogin/requireAuth/jembatan
 * SIPANDU di Admin.gs. 06_ADMIN TIDAK dihapus fisik -- cuma ditandai,
 * tetap dipakai adminLogin APA ADANYA sampai Tahap 3.
 */

// Sama persis isinya dgn peta di Relawan.gs (generateIdRelawan) -- lihat
// catatan di sana soal sumber kode 3 huruf. Didefinisikan ULANG di sini
// (bukan reuse langsung) supaya file migrasi ini bisa dibaca & diaudit
// berdiri sendiri, terpisah dari logika operasional harian Relawan.gs.
var PEMETAAN_DIVISI_LAMA_KE_BARU_ = {
  'DRIVER/DISTRIBUSI': { kolom: 'DIVISI', nilaiBaru: 'DRIVER' },
  'ASISTEN DISTRIBUSI': { kolom: 'DIVISI', nilaiBaru: 'ASISTEN DRIVER' },
  'CLEANING SERVICE/OB': { kolom: 'DIVISI', nilaiBaru: 'CLEANING SERVICE' },
  // 3 Peran Staf -- PINDAH dari kolom DIVISI ke kolom JABATAN, nilai teks tidak berubah.
  'KA SPPG': { kolom: 'JABATAN', nilaiBaru: 'KA SPPG' },
  'PENGAWAS GIZI': { kolom: 'JABATAN', nilaiBaru: 'PENGAWAS GIZI' },
  'PENGAWASAN KEUANGAN': { kolom: 'JABATAN', nilaiBaru: 'PENGAWAS KEUANGAN' } // dirapikan jadi "PENGAWAS" (konsisten dgn GIZI), bukan "PENGAWASAN"
};

/**
 * Jalankan SEKALI dari editor Apps Script (pilih fungsi ini di dropdown,
 * klik Run) ATAU sambungkan ke tombol admin.html kalau mau dipicu dari
 * UI (lihat pola jalankanMigrasiRoleBaru utk contoh pemanggilan dari
 * frontend). IDEMPOTEN -- aman ditekan berkali-kali.
 *
 * @return {Object} ringkasan tiap bagian + daftar yg BUTUH TINJAUAN MANUAL (JANGAN diabaikan)
 */
function jalankanMigrasiSIMSDM(body) {
  if (body && body.token) requireAuth(body.token); // dari UI, wajib login. Dari editor manual (body kosong), lewati -- developer sudah py akses penuh ke spreadsheet.

  const hasil = {
    kategoriSdm: { diproses: 0, dilewati: 0 },
    bersihkanDivisi: { diproses: 0, dilewati: 0 },
    gabungAdmin: { diproses: 0, dilewati: 0, butuhTinjauanManual: [] }
  };

  const sheetRelawan = getSheet(NAMA_SHEET.RELAWAN);
  const dataRelawan = sheetRelawan.getDataRange().getValues();
  const headerRelawan = dataRelawan[0].map(h => String(h).trim());

  // ===== BAGIAN 1: KATEGORI_SDM =====
  let idxKategori = headerRelawan.indexOf('KATEGORI_SDM');
  if (idxKategori === -1) {
    sheetRelawan.getRange(1, headerRelawan.length + 1).setValue('KATEGORI_SDM');
    idxKategori = headerRelawan.length;
    headerRelawan.push('KATEGORI_SDM');
  }
  const idxId = headerRelawan.indexOf('ID_RELAWAN');
  const idxDivisi = headerRelawan.indexOf('DIVISI');
  const idxJabatan = headerRelawan.indexOf('JABATAN');

  for (let i = 1; i < dataRelawan.length; i++) {
    const id = String(dataRelawan[i][idxId] || '');
    if (!id) continue;
    if (dataRelawan[i][idxKategori]) { hasil.kategoriSdm.dilewati++; continue; } // sudah di-migrasi
    const kategori = id.toUpperCase().startsWith('S-') ? 'STAFF' : 'RELAWAN';
    sheetRelawan.getRange(i + 1, idxKategori + 1).setValue(kategori);
    hasil.kategoriSdm.diproses++;
  }

  // ===== BAGIAN 2: BERSIHKAN NILAI DIVISI (termasuk pindah 3 Peran Staf ke JABATAN) =====
  // Dibaca ULANG stlh Bagian 1 (kolom baru KATEGORI_SDM sudah ada, tapi kita baca ulang spy getRange baris konsisten).
  const dataRelawan2 = sheetRelawan.getDataRange().getValues();
  for (let i = 1; i < dataRelawan2.length; i++) {
    const id = String(dataRelawan2[i][idxId] || '');
    if (!id) continue;
    const divisiLama = String(dataRelawan2[i][idxDivisi] || '').trim().toUpperCase();
    const pemetaan = PEMETAAN_DIVISI_LAMA_KE_BARU_[divisiLama];
    if (!pemetaan) { hasil.bersihkanDivisi.dilewati++; continue; } // nilai sudah bersih / tidak perlu diubah

    if (pemetaan.kolom === 'DIVISI') {
      sheetRelawan.getRange(i + 1, idxDivisi + 1).setValue(pemetaan.nilaiBaru);
    } else if (pemetaan.kolom === 'JABATAN' && idxJabatan !== -1) {
      sheetRelawan.getRange(i + 1, idxJabatan + 1).setValue(pemetaan.nilaiBaru);
      sheetRelawan.getRange(i + 1, idxDivisi + 1).setValue(''); // kosongkan DIVISI -- Peran Staf bukan Divisi lagi
    }
    hasil.bersihkanDivisi.diproses++;
  }

  // ===== BAGIAN 3: GABUNG 06_ADMIN =====
  const sheetAdmin = getSheet(NAMA_SHEET.ADMIN);
  const dataAdmin = sheetAdmin.getDataRange().getValues();
  const headerAdmin = dataAdmin[0].map(h => String(h).trim());
  const idxAdminUser = headerAdmin.indexOf('USERNAME');
  const idxAdminNama = headerAdmin.indexOf('NAMA');
  const idxAdminHash = headerAdmin.indexOf('PASSWORD_HASH');
  const idxAdminSalt = headerAdmin.indexOf('SALT');
  const idxAdminTerkait = headerAdmin.indexOf('ID_RELAWAN_TERKAIT');
  const idxAdminRoleBaru = headerAdmin.indexOf('ROLE_BARU');
  let idxSudahDigabung = headerAdmin.indexOf('SUDAH_DIGABUNG_SIMSDM'); // penanda idempoten KHUSUS migrasi ini
  if (idxSudahDigabung === -1) {
    sheetAdmin.getRange(1, headerAdmin.length + 1).setValue('SUDAH_DIGABUNG_SIMSDM');
    idxSudahDigabung = headerAdmin.length;
  }

  const sheetAkun = getSheet(NAMA_SHEET.AKUN_RELAWAN);
  const dataAkun = sheetAkun.getDataRange().getValues();
  const headerAkun = dataAkun[0].map(h => String(h).trim());

  for (let i = 1; i < dataAdmin.length; i++) {
    const username = String(dataAdmin[i][idxAdminUser] || '');
    if (!username) continue;
    if (dataAdmin[i][idxSudahDigabung]) { hasil.gabungAdmin.dilewati++; continue; } // sudah digabung sebelumnya

    const idTerkait = idxAdminTerkait !== -1 ? String(dataAdmin[i][idxAdminTerkait] || '').trim() : '';
    let idRelawanTujuan = '';

    if (idTerkait) {
      // Cek ID_RELAWAN_TERKAIT benar-benar ada di 01_DATA_RELAWAN.
      const adaDiRelawan = dataRelawan2.some(r => String(r[idxId] || '') === idTerkait);
      if (adaDiRelawan) idRelawanTujuan = idTerkait;
    }

    if (!idRelawanTujuan) {
      // TIDAK py padanan jelas -- JANGAN DITEBAK (divisi/jabatan admin teknis
      // tidak diketahui dari data 06_ADMIN semata). Catat utk tinjauan manual,
      // JANGAN proses otomatis baris ini.
      hasil.gabungAdmin.butuhTinjauanManual.push({
        username: username,
        nama: idxAdminNama !== -1 ? dataAdmin[i][idxAdminNama] : '',
        alasan: idTerkait ? ('ID_RELAWAN_TERKAIT ("' + idTerkait + '") tidak ditemukan di 01_DATA_RELAWAN') : 'Tidak punya ID_RELAWAN_TERKAIT sama sekali -- perlu ditentukan manual mau jadi STAFF dengan JABATAN apa'
      });
      continue;
    }

    // Tulis/perbarui baris 07_AKUN_RELAWAN utk ID_RELAWAN ini dgn kredensial dari 06_ADMIN.
    let baris07 = -1;
    for (let j = 1; j < dataAkun.length; j++) {
      if (String(dataAkun[j][0] || '') === idRelawanTujuan) { baris07 = j; break; }
    }
    const idxAkunUser = headerAkun.indexOf('USERNAME');
    const idxAkunHash = headerAkun.indexOf('PASSWORD_HASH');
    const idxAkunSalt = headerAkun.indexOf('SALT');
    const idxAkunStatus = headerAkun.indexOf('STATUS_AKUN');

    if (baris07 === -1) {
      // Belum py baris 07_AKUN_RELAWAN (mis. admin teknis yg relawan-nya blm py akun) -- buat baru, aditif.
      const barisBaru = new Array(headerAkun.length).fill('');
      barisBaru[0] = idRelawanTujuan;
      if (idxAkunUser !== -1) barisBaru[idxAkunUser] = username;
      if (idxAkunHash !== -1) barisBaru[idxAkunHash] = dataAdmin[i][idxAdminHash];
      if (idxAkunSalt !== -1) barisBaru[idxAkunSalt] = dataAdmin[i][idxAdminSalt];
      if (idxAkunStatus !== -1) barisBaru[idxAkunStatus] = 'AKTIF';
      sheetAkun.appendRow(barisBaru);
    } else {
      // SUDAH py baris 07_AKUN_RELAWAN (relawan yg SAMA py akun relawan biasa) --
      // TIMPA dgn kredensial admin (username+password admin jadi satu-satunya
      // login utk orang ini, sesuai "satu identitas" -- relawan ybs login
      // dgn username ADMIN-nya, bukan dua login terpisah lagi).
      if (idxAkunUser !== -1) sheetAkun.getRange(baris07 + 1, idxAkunUser + 1).setValue(username);
      if (idxAkunHash !== -1) sheetAkun.getRange(baris07 + 1, idxAkunHash + 1).setValue(dataAdmin[i][idxAdminHash]);
      if (idxAkunSalt !== -1) sheetAkun.getRange(baris07 + 1, idxAkunSalt + 1).setValue(dataAdmin[i][idxAdminSalt]);
    }

    // Pastikan ROLE_BARU di 01_DATA_RELAWAN ikut terisi dari 06_ADMIN (kalau belum).
    if (idxAdminRoleBaru !== -1) {
      const idxRoleBaruRelawan = headerRelawan.indexOf('ROLE_BARU');
      if (idxRoleBaruRelawan !== -1) {
        for (let k = 1; k < dataRelawan2.length; k++) {
          if (String(dataRelawan2[k][idxId] || '') === idRelawanTujuan) {
            if (!dataRelawan2[k][idxRoleBaruRelawan]) { // JANGAN timpa kalau sudah terisi
              sheetRelawan.getRange(k + 1, idxRoleBaruRelawan + 1).setValue(dataAdmin[i][idxAdminRoleBaru]);
            }
            break;
          }
        }
      }
    }

    sheetAdmin.getRange(i + 1, idxSudahDigabung + 1).setValue('YA — ' + new Date().toISOString());
    hasil.gabungAdmin.diproses++;
  }

  logAudit_('MIGRASI_SIMSDM_TAHAP2', 'SIMSDM', '-', (body && body.token) ? requireAuth(body.token) : 'DEVELOPER_MANUAL', hasil);
  return hasil;
}

/**
 * BARU 30 Okt 2026 -- bagian RAPIKAN STRUKTUR SPREADSHEET dari rancangan
 * Fase C yg BELUM dikerjakan oleh jalankanMigrasiSIMSDM di atas (itu cuma
 * urus identitas+divisi+06_ADMIN). Fungsi ini TERPISAH sengaja -- supaya
 * bisa dijalankan kapan pun siap, tidak harus bersamaan dgn migrasi
 * identitas. IDEMPOTEN & ADITIF spt semua migrasi lain di proyek ini.
 *
 * Mengerjakan 2 bagian:
 *   1. Revisi isi 02_DATA_DIVISI jadi 12 nilai bersih final (lihat
 *      KODE_DIVISI_JABATAN_ di Relawan.gs utk daftar sama persis)
 *   2. Buat sheet 01b_KONTAK_DARURAT & 01c_KARTU_IDENTITAS (kosong siap
 *      pakai kalau belum ada), DAN pindahkan data yg SUDAH ADA dari
 *      01_DATA_RELAWAN kalau ada baris yg terisi (TIDAK mengasumsikan
 *      kosong -- dicek dulu per baris)
 */
function jalankanRapikanSpreadsheetSIMSDM(body) {
  if (body && body.token) requireAuth(body.token);

  const hasil = { divisi: { ditulisUlang: false, jumlahNilai: 0 }, kontakDarurat: { dibuat: false, dipindah: 0 }, kartuIdentitas: { dibuat: false, dipindah: 0 } };

  // ===== BAGIAN 1: 02_DATA_DIVISI -- 12 nilai bersih final =====
  const DIVISI_FINAL_ = ['Persiapan', 'Pengolahan', 'Pemorsian', 'Cuci Ompreng', 'Driver', 'Asisten Driver', 'Admin', 'Security', 'Cleaning Service', 'Asisten Lapangan', 'Petugas Logistik', 'Head Chef'];
  const sheetDivisi = getSheet(NAMA_SHEET.DIVISI);
  const dataDivisiAda = sheetDivisi.getDataRange().getValues().slice(1).map(r => String(r[0] || '').trim()).filter(Boolean);
  const sudahBersih = DIVISI_FINAL_.length === dataDivisiAda.length && DIVISI_FINAL_.every(v => dataDivisiAda.includes(v));
  if (!sudahBersih) {
    // TIDAK menghapus baris lama secara fisik -- tulis ulang mulai baris 2,
    // sisa baris lama (kalau ada lebih banyak drpd 12) dikosongkan isinya
    // (bukan dihapus barisnya, supaya nomor baris/referensi lama tidak geser).
    const maxBarisLama = sheetDivisi.getLastRow();
    sheetDivisi.getRange(2, 1, Math.max(maxBarisLama - 1, DIVISI_FINAL_.length), 1).clearContent();
    sheetDivisi.getRange(2, 1, DIVISI_FINAL_.length, 1).setValues(DIVISI_FINAL_.map(v => [v]));
    hasil.divisi.ditulisUlang = true;
    hasil.divisi.jumlahNilai = DIVISI_FINAL_.length;
  }

  // ===== BAGIAN 2a: 01b_KONTAK_DARURAT =====
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let shKontak = ss.getSheetByName('01b_KONTAK_DARURAT');
  if (!shKontak) {
    shKontak = ss.insertSheet('01b_KONTAK_DARURAT');
    shKontak.getRange(1, 1, 1, 4).setValues([['ID_RELAWAN', 'NAMA_KONTAK', 'HUBUNGAN', 'NO_HP']]);
    hasil.kontakDarurat.dibuat = true;
  }
  const sheetRelawan2 = getSheet(NAMA_SHEET.RELAWAN);
  const dataR = sheetRelawan2.getDataRange().getValues();
  const headerR = dataR[0].map(h => String(h).trim());
  const idxId2 = headerR.indexOf('ID_RELAWAN');
  const idxKN = headerR.indexOf('KONTAK_DARURAT_NAMA'), idxKH = headerR.indexOf('KONTAK_DARURAT_HUBUNGAN'), idxKP = headerR.indexOf('KONTAK_DARURAT_NO_HP');
  const idRelawanSudahDiKontak = new Set(shKontak.getDataRange().getValues().slice(1).map(r => String(r[0] || '')));
  if (idxKN !== -1) {
    for (let i = 1; i < dataR.length; i++) {
      const id = String(dataR[i][idxId2] || '');
      if (!id || idRelawanSudahDiKontak.has(id)) continue;
      const nama = dataR[i][idxKN];
      if (!nama) continue; // tidak ada data kontak darurat utk baris ini -- lewati, bukan buat baris kosong
      shKontak.appendRow([id, nama, dataR[i][idxKH] || '', dataR[i][idxKP] || '']);
      hasil.kontakDarurat.dipindah++;
    }
  }

  // ===== BAGIAN 2b: 01c_KARTU_IDENTITAS =====
  let shKartu = ss.getSheetByName('01c_KARTU_IDENTITAS');
  if (!shKartu) {
    shKartu = ss.insertSheet('01c_KARTU_IDENTITAS');
    shKartu.getRange(1, 1, 1, 4).setValues([['ID_RELAWAN', 'TOKEN_KARTU', 'STATUS_KARTU', 'DIBUAT_PADA']]);
    hasil.kartuIdentitas.dibuat = true;
  }
  const idxTK = headerR.indexOf('TOKEN_KARTU'), idxSK = headerR.indexOf('STATUS_KARTU'), idxKDP = headerR.indexOf('KARTU_DIBUAT_PADA');
  const idRelawanSudahDiKartu = new Set(shKartu.getDataRange().getValues().slice(1).map(r => String(r[0] || '')));
  if (idxTK !== -1) {
    for (let i = 1; i < dataR.length; i++) {
      const id = String(dataR[i][idxId2] || '');
      if (!id || idRelawanSudahDiKartu.has(id)) continue;
      const token = dataR[i][idxTK];
      if (!token) continue;
      shKartu.appendRow([id, token, dataR[i][idxSK] || '', dataR[i][idxKDP] || '']);
      hasil.kartuIdentitas.dipindah++;
    }
  }

  logAudit_('RAPIKAN_SPREADSHEET_SIMSDM', 'SIMSDM', '-', (body && body.token) ? requireAuth(body.token) : 'DEVELOPER_MANUAL', hasil);
  return hasil;
}

/**
 * BARU 30 Okt 2026 (Tahap 7) -- pastikan SEMUA 8 kode modul roadmap
 * (BAB II.2.2 Draft Final) terdaftar di 33_MODUL_PORTAL, fondasi RBAC
 * terpusat spy getAksesModulSaya bisa benar2 menandai status tiap modul
 * (bukan fail-open krn barisnya belum ada). HANYA MENAMBAH yg belum
 * ada -- baris yg SUDAH ada (nama/deskripsi beda sekalipun) TIDAK
 * disentuh, supaya tidak menimpa penyesuaian yg mungkin sudah dibuat
 * Admin manual.
 */
function jalankanPastikanModulRbacLengkap(body) {
  if (body && body.token) requireAuth(body.token);
  const MODUL_WAJIB_ = [
    ['SIMSDM', 'SIMSDM — Manajemen SDM', 'Identitas relawan/staf, akun, divisi, jabatan, hak akses.'],
    ['SIPRES', 'SIPRES — Presensi & Kartu QR', 'Absensi relawan, koreksi presensi, dan kartu QR.'],
    ['SIKOP', 'SIKOP — Koordinasi Penugasan', 'Periode kerja, kalender operasional, lokasi, jadwal penugasan.'],
    ['SIRAGA', 'SIRAGA — Stok & Persediaan', 'Pengelolaan stok, supplier, dan transaksi barang gudang.'],
    ['SIPANDU', 'SIPANDU — Operasional Produksi', 'Persiapan, pengolahan, pemorsian, distribusi, dan work order dapur.'],
    ['SIPENDOK', 'SIPENDOK — Dokumen & Administrasi', 'Penerima manfaat, PIC, penerimaan, BAST, surat jalan.'],
    ['SIPOGIM', 'SIPOGIM — Gizi & Menu', 'Siklus menu, bahan, resep, kandungan gizi.'],
    ['SIPIKA', 'SIPIKA — Informasi & Komunikasi', 'Notifikasi, pengumuman, informasi, dokumen, penerima manfaat (akses publik/relawan).']
  ];
  const sheet = getModulPortalSheet_();
  const adaSekarang = new Set(sheetToObjects(sheet).map(m => m.KODE_MODUL));
  let ditambahkan = [];
  MODUL_WAJIB_.forEach(([kode, nama, deskripsi]) => {
    if (!adaSekarang.has(kode)) { sheet.appendRow([kode, nama, deskripsi]); ditambahkan.push(kode); }
  });
  const hasil = { ditambahkan: ditambahkan, sudahAdaSebelumnya: MODUL_WAJIB_.length - ditambahkan.length };
  logAudit_('PASTIKAN_MODUL_RBAC', 'SIMSDM', '-', (body && body.token) ? requireAuth(body.token) : 'DEVELOPER_MANUAL', hasil);
  return hasil;
}
