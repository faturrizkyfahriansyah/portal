/**
 * SPPG JEUNGJING — PORTAL RELAWAN
 * Pengaturan.gs — Pengaturan Portal fungsional (BARU)
 *
 * Prinsip: TIDAK duplikasi konfigurasi yang sudah ada di modul lain.
 * - Pengaturan Presensi -> link ke Master Lokasi SPPG existing (Lokasi.gs),
 *   TIDAK ada field radius/lokasi baru di sini.
 * - Pengaturan Akun & Akses -> link ke Akun Relawan / Pengelola SPPG / Role
 *   ASN existing, TIDAK ada CRUD akun baru di sini.
 * - Pengaturan Keamanan (Log Aktivitas) -> baca 24_AUDIT_LOG yang SUDAH ADA
 *   dan SUDAH DIPAKAI di banyak modul (logAudit_), TIDAK bikin sheet baru.
 *
 * Yang GENUINELY baru & butuh penyimpanan di sini: Nama Portal, Template
 * Notifikasi default, Timezone -- disimpan di Script Properties (ringan,
 * cocok untuk beberapa nilai konfigurasi sederhana, sudah jadi pola yang
 * dipakai untuk FCM_PROJECT_ID dkk).
 */

const KUNCI_PENGATURAN_PORTAL = ['NAMA_PORTAL', 'TEMPLATE_NOTIFIKASI_DEFAULT', 'TIMEZONE_SISTEM', 'TARGET_DEFAULT_NOTIF'];

function getPengaturanPortal(token) {
  requireAuth(token);
  const props = PropertiesService.getScriptProperties();
  const hasil = {};
  KUNCI_PENGATURAN_PORTAL.forEach(k => { hasil[k] = props.getProperty(k) || ''; });
  // Nilai default kalau belum pernah diisi -- supaya form tidak kosong total di percobaan pertama.
  if (!hasil.NAMA_PORTAL) hasil.NAMA_PORTAL = 'PORTAL SPPG JEUNGJING';
  if (!hasil.TIMEZONE_SISTEM) hasil.TIMEZONE_SISTEM = 'Asia/Jakarta';
  if (!hasil.TARGET_DEFAULT_NOTIF) hasil.TARGET_DEFAULT_NOTIF = 'SEMUA';
  return hasil;
}

function setPengaturanPortal(body) {
  const akses = requireAuth(body.token);
  const props = PropertiesService.getScriptProperties();
  const perubahan = {};
  KUNCI_PENGATURAN_PORTAL.forEach(k => {
    if (body[k] !== undefined) {
      props.setProperty(k, sanitize(body[k]));
      perubahan[k] = sanitize(body[k]);
    }
  });
  logAudit_('UBAH_PENGATURAN_PORTAL', 'PENGATURAN', '', akses, perubahan);
  return { success: true };
}

/** Log Aktivitas Pengelola -- baca 24_AUDIT_LOG yang sudah ada, 50 entri terakhir. */
function getLogAktivitas(token) {
  requireAuth(token);
  const sheet = getSheet(NAMA_SHEET.AUDIT_LOG);
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0].map(h => String(h).trim());
  const idx = {};
  headers.forEach((h, i) => { idx[h] = i; });

  const baris = data.slice(1).filter(r => r[idx.ID_AUDIT]);
  // Terbaru dulu, maksimal 50 entri (supaya tidak berat kalau log sudah panjang).
  return baris.slice(-50).reverse().map(r => ({
    waktu: r[idx.WAKTU],
    aktor: r[idx.AKTOR],
    aksi: r[idx.AKSI],
    modul: r[idx.MODUL],
    idTerkait: r[idx.ID_TERKAIT],
    detail: r[idx.DETAIL]
  }));
}

