/**
 * SIPOGIM — Auth.gs
 * Akun bersama satu tim. Tidak ada peran/akun per orang (sesuai
 * keputusan terkunci di spesifikasi) -- siapa bertindak dicatat lewat
 * header X-Nama-Saya (dikirim tiap request tulis), BUKAN lewat login.
 * PIN terpisah dari kata sandi, hanya dipakai utk tombol Setujui.
 *
 * Sesi disimpan di CacheService (bukan cookie HttpOnly spt di
 * spesifikasi asli -- Apps Script Web App tidak mengizinkan backend
 * mengatur cookie sendiri). Token sesi dikirim balik sebagai field
 * biasa di body/token, sama persis pola yang sudah dipakai Portal SPPG
 * Jeungjing (bukan deviasi baru, konsisten dgn proyek induk).
 */

const SESI_MAKS_HARI = 30;
const BATAS_GAGAL_LOGIN = 5;
const JENDELA_GAGAL_LOGIN_MENIT = 15;

function login(body) {
  // 4 Nov 2026: login SIPOGIM DIMATIKAN (keputusan Admin) -- masuk hanya lewat Portal dengan akses per relawan.
  throw new Error('Login SIPOGIM sudah dinonaktifkan. Buka SIPOGIM dari Portal; akun Anda harus diberi akses oleh Pengelola.');
}

function periksaSesi_(token) {
  // 4 Nov 2026: sesi SIPOGIM sendiri DIGANTI token aplikasi dari Portal + pemeriksaan ulang akses per relawan (AksesPortal.gs).
  if (!token) throw new Error('Sesi tidak valid. Buka SIPOGIM dari Portal.');
  const p = verifikasiTokenAplikasi_(token, 'SIPOGIM');
  cekAksesPortalSheet_(p, 'SIPOGIM');
  return true;
}

function logout(body) {
  if (body.token) CacheService.getScriptCache().remove('sesi_' + body.token);
  return { ok: true };
}

function cekSesi(body) {
  try { periksaSesi_(body.token); return { valid: true }; }
  catch (e) { return { valid: false }; }
}

// ---- Pembatasan percobaan gagal (5x dalam 15 menit -> tunda 15 menit) ----
function periksaKuncGagalLogin_() {
  const props = PropertiesService.getScriptProperties();
  const kunci = 'login_gagal';
  const raw = props.getProperty(kunci);
  if (!raw) return;
  const data = JSON.parse(raw);
  if (data.jumlah >= BATAS_GAGAL_LOGIN && (Date.now() - data.sejak) < JENDELA_GAGAL_LOGIN_MENIT * 60000) {
    const sisaMenit = Math.ceil((JENDELA_GAGAL_LOGIN_MENIT * 60000 - (Date.now() - data.sejak)) / 60000);
    throw new Error('Terlalu banyak percobaan gagal. Coba lagi dalam ' + sisaMenit + ' menit.');
  }
}
function catatGagalLogin_() {
  const props = PropertiesService.getScriptProperties();
  const kunci = 'login_gagal';
  const raw = props.getProperty(kunci);
  let data = raw ? JSON.parse(raw) : { jumlah: 0, sejak: Date.now() };
  if ((Date.now() - data.sejak) > JENDELA_GAGAL_LOGIN_MENIT * 60000) data = { jumlah: 0, sejak: Date.now() };
  data.jumlah++;
  props.setProperty(kunci, JSON.stringify(data));
}
function resetGagalLogin_() { PropertiesService.getScriptProperties().deleteProperty('login_gagal'); }

/**
 * Dipanggil di AWAL setiap aksi TULIS (bukan baca) -- memastikan sesi
 * valid DAN header Nama Saya terisi. Mengembalikan nama aktor yang
 * sudah divalidasi, dipakai pemanggil utk mengisi kolom diubah_oleh/dst.
 * Ini BUKAN keamanan (nama tidak diverifikasi identitasnya) -- murni
 * pencatatan siapa bertindak, persis sesuai spesifikasi.
 */
function wajibNamaSaya_(body) {
  periksaSesi_(body.token);
  const nama = sanitizeSipogim_(body.namaSaya);
  if (nama.length < 2 || nama.length > 40) throw new Error('Nama Saya wajib diisi (2-40 karakter) sebelum melakukan perubahan.');
  return nama;
}

// ---- PIN (hanya utk tombol Setujui) ----
const BATAS_GAGAL_PIN = 5;
const JENDELA_GAGAL_PIN_MENIT = 15;

function periksaPin_(pin) {
  periksaKuncGagalPin_();
  const hashTersimpan = getPengaturan_('HASH_PIN', '');
  if (!hashTersimpan) throw new Error('PIN belum diset. Hubungi pengelola untuk menjalankan setup awal.');
  if (!pin || hashRahasia_(String(pin)) !== hashTersimpan) {
    catatGagalPin_();
    throw new Error('PIN salah.');
  }
  resetGagalPin_();
}
function periksaKuncGagalPin_() {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty('pin_gagal');
  if (!raw) return;
  const data = JSON.parse(raw);
  if (data.jumlah >= BATAS_GAGAL_PIN && (Date.now() - data.sejak) < JENDELA_GAGAL_PIN_MENIT * 60000) {
    const sisaMenit = Math.ceil((JENDELA_GAGAL_PIN_MENIT * 60000 - (Date.now() - data.sejak)) / 60000);
    throw new Error('Tombol Setujui terkunci. Coba lagi dalam ' + sisaMenit + ' menit.');
  }
}
function catatGagalPin_() {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty('pin_gagal');
  let data = raw ? JSON.parse(raw) : { jumlah: 0, sejak: Date.now() };
  if ((Date.now() - data.sejak) > JENDELA_GAGAL_PIN_MENIT * 60000) data = { jumlah: 0, sejak: Date.now() };
  data.jumlah++;
  props.setProperty('pin_gagal', JSON.stringify(data));
}
function resetGagalPin_() { PropertiesService.getScriptProperties().deleteProperty('pin_gagal'); }

// ---- Ganti kata sandi / PIN (dari layar Pengaturan) ----
function gantiKataSandi(body) {
  wajibNamaSaya_(body);
  const lama = sanitizeSipogim_(body.kataSandiLama);
  const baru = sanitizeSipogim_(body.kataSandiBaru);
  if (hashRahasia_(lama) !== getPengaturan_('HASH_KATA_SANDI', '')) throw new Error('Kata sandi lama salah.');
  if (baru.length < 6) throw new Error('Kata sandi baru minimal 6 karakter.');
  setPengaturan_('HASH_KATA_SANDI', hashRahasia_(baru));
  // Naikkan versi sesi -- otomatis membatalkan SEMUA sesi lain (termasuk sesi sendiri, sesuai spesifikasi).
  const versiBaru = Number(getPengaturan_('VERSI_SESI', '1')) + 1;
  setPengaturan_('VERSI_SESI', String(versiBaru));
  return { ok: true };
}

function gantiPin(body) {
  const nama = wajibNamaSaya_(body);
  const lama = sanitizeSipogim_(body.pinLama);
  const baru = sanitizeSipogim_(body.pinBaru);
  if (hashRahasia_(lama) !== getPengaturan_('HASH_PIN', '')) throw new Error('PIN lama salah.');
  if (!/^\d{4,6}$/.test(baru)) throw new Error('PIN baru harus 4-6 digit angka.');
  setPengaturan_('HASH_PIN', hashRahasia_(baru));
  catatRiwayatSipogim_(nama, 'pengaturan', 'PIN', 'ubah', null, null, nama + ' mengganti PIN.');
  return { ok: true };
}

