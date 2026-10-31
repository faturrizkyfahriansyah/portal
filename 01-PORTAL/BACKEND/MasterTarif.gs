/**
 * MasterTarif.gs — BARU 29 Okt 2026.
 *
 * admin-master-tarif.js (komentar filenya sendiri menyebut "MasterTarif.gs"
 * sbg sumber data) dan admin.js (Rekap Per Periode/penggajian) memanggil
 * getMasterTarifStandingAdmin, updateTarifRelawanAdmin, dan
 * getRekapPenggajianAdmin -- KETIGANYA TIDAK PERNAH DIBANGUN. Dibangun
 * di sini, MENGGUNAKAN ULANG getRekapDuaMinggu (Absensi.gs, SUDAH ADA
 * & dipakai tempat lain) utk data kehadiran -- fungsi ini HANYA
 * menambahkan tarif & perhitungan Rp di atasnya, bukan menghitung ulang
 * kehadiran dari nol.
 *
 * Sheet baru: 26_MASTER_TARIF (ID_TARIF | ID_RELAWAN | JABATAN | TARIF_HARIAN).
 * "Standing" (istilah dari komentar admin-master-tarif.js) berarti TIDAK
 * terikat periode -- satu baris per relawan, berlaku terus sampai diubah.
 */

function getSheetMasterTarif_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('26_MASTER_TARIF');
  if (!sheet) {
    sheet = ss.insertSheet('26_MASTER_TARIF');
    sheet.getRange(1, 1, 1, 4).setValues([['ID_TARIF', 'ID_RELAWAN', 'JABATAN', 'TARIF_HARIAN']]);
  }
  return sheet;
}

/** Daftar SEMUA relawan + tarif standing-nya (kalau sudah diatur). */
function getMasterTarifStandingAdmin(token) {
  requireAuth(token);
  const relawanList = getRelawanList(null, false);
  const tarifRows = sheetToObjects(getSheetMasterTarif_());
  return relawanList.map(function (r) {
    const t = tarifRows.find(function (x) { return String(x.ID_RELAWAN) === String(r.id); });
    return {
      idRelawan: r.id, namaRelawan: r.nama, divisi: r.divisi,
      idTarif: t ? t.ID_TARIF : null,
      jabatan: t ? t.JABATAN : null,
      tarifHarian: t ? Number(t.TARIF_HARIAN) : null
    };
  });
}

/** Simpan/ubah tarif standing 1 relawan (idTarif kosong = baris baru). */
function updateTarifRelawanAdmin(body) {
  requireAuth(body.token);
  const idRelawan = sanitize(body.idRelawan);
  const jabatan = sanitize(body.jabatan);
  const tarifHarian = Number(body.tarifHarian);
  if (!idRelawan) throw new Error('ID relawan wajib diisi.');
  if (!jabatan) throw new Error('Jabatan wajib dipilih.');
  if (!tarifHarian || tarifHarian < 0) throw new Error('Tarif harian wajib diisi dengan angka valid.');

  const sheet = getSheetMasterTarif_();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]) === idRelawan) {
      sheet.getRange(i + 1, 3, 1, 2).setValues([[jabatan, tarifHarian]]);
      return { idTarif: data[i][0], idRelawan: idRelawan, jabatan: jabatan, tarifHarian: tarifHarian };
    }
  }
  const idTarif = 'MT-' + Utilities.getUuid().substring(0, 8);
  sheet.appendRow([idTarif, idRelawan, jabatan, tarifHarian]);
  return { idTarif: idTarif, idRelawan: idRelawan, jabatan: jabatan, tarifHarian: tarifHarian };
}

/**
 * Rekap kehadiran + gaji 1 periode. Bentuk data IDENTIK dgn
 * getRekapDuaMinggu (dipakai ULANG, bukan ditulis ulang) + 2 field
 * tambahan (totalInsentif, tarifLengkap) per baris.
 */
function getRekapPenggajianAdmin(body) {
  requireAuth(body.token);
  const idPeriode = sanitize(body.idPeriode);
  if (!idPeriode) throw new Error('Periode wajib dipilih.');
  const periode = getPeriodeById_(idPeriode);
  if (!periode) throw new Error('Periode tidak ditemukan.');

  const awalIso = tanggalSheetKeIso_(periode.tanggalMulai);
  const akhirIso = tanggalSheetKeIso_(periode.tanggalSelesai);
  if (!awalIso || !akhirIso) throw new Error('Tanggal periode tidak valid.');

  // DIPERBAIKI 30 Okt 2026 (ditemukan saat membangun Rekap Per Minggu):
  // panggilan ini TIDAK menyertakan token -- getRekapDuaMinggu (Absensi.gs)
  // cek requireAuth(token, true) di baris PERTAMA, jadi tanpa token di
  // sini SEHARUSNYA selalu melempar "Sesi tidak valid" setiap dipanggil.
  // requireAuth(body.token) SUDAH dipanggil di baris pertama fungsi INI
  // (atas), jadi body.token SUDAH pasti valid pada titik ini -- tinggal
  // diteruskan.
  const rekapKehadiran = getRekapDuaMinggu(awalIso, akhirIso, body.token); // Absensi.gs -- SUDAH ADA
  const tarifRows = sheetToObjects(getSheetMasterTarif_());

  let jumlahBelumLengkap = 0;
  // DIPERBAIKI 30 Okt 2026 (bug KEDUA, ditemukan sama spt bug token di
  // atas): getRekapDuaMinggu mengembalikan OBJEK {data:[...]}, bukan
  // array langsung -- .map() di objek akan error "is not a function".
  // Tanpa perbaikan token di atas, baris ini TIDAK PERNAH tercapai
  // (requireAuth sudah melempar error duluan) -- itu sebabnya bug KEDUA
  // ini baru ketahuan sekarang, bersembunyi di belakang bug PERTAMA.
  const hasilData = rekapKehadiran.data.map(function (r) {
    const t = tarifRows.find(function (x) { return String(x.ID_RELAWAN) === String(r.id); });
    const tarifLengkap = !!(t && Number(t.TARIF_HARIAN) > 0);
    if (!tarifLengkap) jumlahBelumLengkap++;
    const totalInsentif = tarifLengkap ? Number(t.TARIF_HARIAN) * (r.hadir + r.terlambat) : 0;
    return {
      id: r.id, namaRelawan: r.nama, divisi: r.divisi,
      hadir: r.hadir, terlambat: r.terlambat, izin: r.izin, sakit: r.sakit,
      tidakHadir: r.tidakHadir, totalHariKerja: r.totalHariKerja,
      tarifLengkap: tarifLengkap, totalInsentif: totalInsentif
    };
  });

  return { data: hasilData, jumlahBelumLengkap: jumlahBelumLengkap };
}

/**
 * BARU 30 Okt 2026 -- "Rekap Per Minggu" (SIPRES), konsep & pola PERSIS
 * sama dengan getRekapPenggajianAdmin di atas (bahkan rumus insentif
 * sama persis), BEDA UTAMA: tidak terikat objek Periode (14_PERIODE_KERJA
 * cuma punya siklus 14 hari utk penggajian -- tidak ada "Periode
 * Mingguan" sbg entitas tersimpan), jadi admin kirim TANGGAL AWAL+AKHIR
 * langsung (idealnya 7 hari, TAPI fungsi ini TIDAK memaksakan validasi
 * "harus 7 hari" -- terserah Admin pilih rentang berapa pun, sama
 * fleksibelnya dgn getRekapDuaMinggu yg memang generik thd rentang
 * tanggal apa pun).
 */
function getRekapMingguanAdmin(body) {
  requireAuth(body.token);
  const tanggalAwal = sanitize(body.tanggalAwal);
  const tanggalAkhir = sanitize(body.tanggalAkhir);
  if (!tanggalAwal || !tanggalAkhir) throw new Error('Tanggal awal dan akhir wajib diisi.');
  if (tanggalAwal > tanggalAkhir) throw new Error('Tanggal awal tidak boleh setelah tanggal akhir.');

  const rekapKehadiran = getRekapDuaMinggu(tanggalAwal, tanggalAkhir, body.token); // Absensi.gs -- SUDAH ADA, generik thd rentang tanggal
  const tarifRows = sheetToObjects(getSheetMasterTarif_());

  let jumlahBelumLengkap = 0;
  const hasilData = rekapKehadiran.data.map(function (r) {
    const t = tarifRows.find(function (x) { return String(x.ID_RELAWAN) === String(r.id); });
    const tarifLengkap = !!(t && Number(t.TARIF_HARIAN) > 0);
    if (!tarifLengkap) jumlahBelumLengkap++;
    const totalInsentif = tarifLengkap ? Number(t.TARIF_HARIAN) * (r.hadir + r.terlambat) : 0;
    return {
      id: r.id, namaRelawan: r.nama, divisi: r.divisi,
      hadir: r.hadir, terlambat: r.terlambat, izin: r.izin, sakit: r.sakit,
      tidakHadir: r.tidakHadir, totalHariKerja: r.totalHariKerja,
      tarifLengkap: tarifLengkap, totalInsentif: totalInsentif
    };
  });

  return { data: hasilData, jumlahBelumLengkap: jumlahBelumLengkap, tanggalAwal: tanggalAwal, tanggalAkhir: tanggalAkhir };
}

