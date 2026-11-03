/**
 * SPPG JEUNGJING — PORTAL
 * MigrasiJadwal.gs — JADWAL & PENUGASAN HANYA DARI PENUGASAN PER RELAWAN (BARU 4 Nov 2026, keputusan Admin).
 *
 * Keputusan Admin: hilangkan jadwal OTOMATIS yang memilih divisi (Shift Divisi 21_, Pola Kerja/Multi-shift 35_/36_/37_); pakai satu jalur saja, yaitu
 * penugasan per relawan (dulu "Penugasan Khusus", 22_PENUGASAN_KHUSUS), yang kini disebut "Jadwal & Penugasan". Pilihan "per divisi" tetap ada
 * HANYA sebagai alat bantu isi massal (hasilnya tetap satu baris per relawan per hari).
 *
 * AGAR TIDAK ADA HARI YANG KEHILANGAN SHIFT: sebelum jadwal otomatis dimatikan, setiap pasangan (tanggal operasional, relawan) yang SAAT INI shiftnya
 * berasal dari jadwal otomatis DIUBAH menjadi baris penugasan eksplisit dengan jam yang SAMA. Sesudahnya mematikan jadwal otomatis tidak mengubah hasil
 * apa pun (diuji pasangan demi pasangan). Sakelar = Script Property JADWAL_OTOMATIS ('TIDAK' = mati; kosong/'YA' = perilaku lama), dapat dibalikkan.
 */
const JADWAL_OTOMATIS_PROP = 'JADWAL_OTOMATIS';
function jadwalOtomatisMati_() { return PropertiesService.getScriptProperties().getProperty(JADWAL_OTOMATIS_PROP) === 'TIDAK'; }

/** Penugasan yang HARUS dibuat agar hasil jadwal tidak berubah saat jadwal otomatis dimatikan. */
function hitungMigrasiJadwal_() {
  const ada = {}; getPenugasanKhususRows_().forEach(p => { if (p.JAM_MASUK) ada[p.ID_OPERASIONAL + '|' + p.ID_RELAWAN] = true; });
  const relawan = getRelawanList(null, false), perlu = [];
  getKalenderRows_().filter(k => String(k.STATUS).toUpperCase() === 'AKTIF').forEach(k => {
    const khusus = k.DIVISI_KHUSUS ? String(k.DIVISI_KHUSUS).split(',').map(d => d.trim()).filter(Boolean) : [];
    relawan.forEach(r => {
      if (khusus.length && khusus.indexOf(r.divisi) === -1) return;          // tanggal khusus divisi lain: relawan ini memang tidak dijadwalkan
      if (ada[k.ID_OPERASIONAL + '|' + r.id]) return;                         // sudah penugasan eksplisit
      const s = resolveShiftUntukRelawan_(r.id, k.ID_OPERASIONAL, true);      // true = abaikan sakelar, hitung dgn jadwal otomatis
      if (s && s.jamMasuk && s.sumber !== 'KHUSUS') perlu.push({ idOperasional: k.ID_OPERASIONAL, tanggal: k.TANGGAL_OPERASIONAL, idRelawan: r.id, nama: r.nama, divisi: r.divisi, jamMasuk: s.jamMasuk, jamPulang: s.jamPulang || '', sumber: s.sumber, lintasTengahMalam: !!s.lintasTengahMalam, aturanTanggalAcuan: s.aturanTanggalAcuan || '' });
    });
  });
  return perlu;
}
function getStatusJadwalOtomatis(body) {
  requireAuth(body.token, true);
  const perlu = hitungMigrasiJadwal_(), mati = jadwalOtomatisMati_();
  return { otomatisAktif: !mati, perluDimigrasi: perlu.length, contoh: perlu.slice(0, 5), konfigurasiOtomatis: { shiftDivisi: getShiftDivisiRows_().length } };
}
/** Migrasi + matikan jadwal otomatis. body: { token, konfirmasi:true } */
function matikanJadwalOtomatis(body) {
  const aktor = requireAuth(body.token);
  if (body.konfirmasi !== true) throw new Error('Konfirmasi diperlukan: jadwal otomatis per divisi akan dimatikan dan jadwal hanya dari penugasan per relawan.');
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    if (jadwalOtomatisMati_()) return { sudahMati: true, dibuat: 0 };
    const perlu = hitungMigrasiJadwal_();
    if (perlu.length) {
      // Dua atribut yang dibaca Roster.gs (shift malam & aturan tanggal) DISIMPAN di penugasan agar tanggal rekap tidak bergeser.
      tambahKolomJikaBelumAda_(NAMA_SHEET.PENUGASAN_KHUSUS, ['LINTAS_TENGAH_MALAM', 'ATURAN_TANGGAL_ACUAN']);
      const sheet = getPenugasanKhususSheet(), awal = generateIdPenugasanKhusus_(sheet), m = /^(\D*)(\d+)$/.exec(String(awal)), idx = akunHeaderIndex_(sheet);
      if (!m) throw new Error('Format ID penugasan tidak dikenali; migrasi dibatalkan, tidak ada yang diubah.');
      const lebar = m[2].length, mulai = parseInt(m[2], 10), sekarang = new Date(), lebarSheet = sheet.getLastColumn();
      const baris = perlu.map((p, i) => { const b = new Array(lebarSheet).fill(''); b[idx.ID_PENUGASAN] = m[1] + String(mulai + i).padStart(lebar, '0'); b[idx.ID_OPERASIONAL] = p.idOperasional; b[idx.ID_RELAWAN] = p.idRelawan; b[idx.JAM_MASUK] = p.jamMasuk; b[idx.JAM_PULANG] = p.jamPulang; b[idx.CATATAN] = 'Migrasi dari jadwal otomatis (' + p.sumber + ')'; b[idx.DIBUAT_PADA] = sekarang; b[idx.LINTAS_TENGAH_MALAM] = p.lintasTengahMalam ? 'YA' : ''; b[idx.ATURAN_TANGGAL_ACUAN] = p.aturanTanggalAcuan; return b; });
      sheet.getRange(sheet.getLastRow() + 1, 1, baris.length, lebarSheet).setValues(baris);
      _invalidasiCachePenugasanKhusus_();
      // pemeriksaan: setelah penulisan, tidak boleh tersisa pasangan yang masih bergantung pada jadwal otomatis
      if (hitungMigrasiJadwal_().length) throw new Error('Migrasi tidak lengkap; jadwal otomatis TIDAK dimatikan. Hubungi asisten.');
    }
    PropertiesService.getScriptProperties().setProperty(JADWAL_OTOMATIS_PROP, 'TIDAK');
    logAudit_('MATIKAN_JADWAL_OTOMATIS', 'JADWAL', '-', aktor, { dibuat: perlu.length });
    return { sudahMati: false, dibuat: perlu.length };
  } finally { lock.releaseLock(); }
}
/** Pembalik: hidupkan lagi jadwal otomatis (penugasan hasil migrasi tetap ada). */
function hidupkanJadwalOtomatis(body) {
  const aktor = requireAuth(body.token);
  PropertiesService.getScriptProperties().deleteProperty(JADWAL_OTOMATIS_PROP);
  logAudit_('HIDUPKAN_JADWAL_OTOMATIS', 'JADWAL', '-', aktor, {});
  return { otomatisAktif: true };
}
