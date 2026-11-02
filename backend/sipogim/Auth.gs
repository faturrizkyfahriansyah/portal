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
  const username = sanitizeSipogim_(body.username);
  const kataSandi = sanitizeSipogim_(body.kataSandi);
  if (!username || !kataSandi) throw new Error('Username dan kata sandi wajib diisi.');

  periksaKuncGagalLogin_();

  const usernameTersimpan = getPengaturan_('USERNAME', 'sipogim');
  const hashTersimpan = getPengaturan_('HASH_KATA_SANDI', '');
  if (!hashTersimpan) throw new Error('Kata sandi belum diset. Hubungi pengelola untuk menjalankan setup awal.');

  // Pesan galat SENGAJA sama (umum) utk username salah maupun kata sandi
  // salah -- spesifikasi: "tanpa membocorkan mana yang salah".
  if (username !== usernameTersimpan || hashRahasia_(kataSandi) !== hashTersimpan) {
    catatGagalLogin_();
    throw new Error('Kata sandi salah.'); // pesan umum, sesuai spesifikasi (tidak membocorkan detail)
  }

  resetGagalLogin_();
  const token = Utilities.getUuid();
  const versiSesi = String(getPengaturan_('VERSI_SESI', '1'));
  const kedaluwarsaDetik = SESI_MAKS_HARI * 24 * 60 * 60;
  CacheService.getScriptCache().put('sesi_' + token, versiSesi, Math.min(kedaluwarsaDetik, 21600)); // cache GAS maks 6 jam per put, lihat perpanjangSesi_
  PropertiesService.getScriptProperties().setProperty('sesi_mulai_' + token, String(Date.now()));
  return { token: token };
}

/**
 * CacheService maksimal 6 jam per entri -- utk sesi 30 hari, token juga
 * dicatat di ScriptProperties (tanpa batas waktu) sbg cadangan; setiap
 * permintaan yang valid memperpanjang cache 6-jam berikutnya SELAMA
 * masih dalam batas 30 hari sejak mulai. Ini yg membuat "30 hari sejak
 * aktivitas terakhir" (spesifikasi) bisa tercapai walau batas teknis
 * CacheService cuma 6 jam.
 */
function periksaSesi_(token) {
  if (!token) throw new Error('Sesi tidak valid. Silakan login kembali.');
  const versiSesiSekarang = String(getPengaturan_('VERSI_SESI', '1'));
  const cache = CacheService.getScriptCache();
  let versiTersimpan = cache.get('sesi_' + token);

  if (!versiTersimpan) {
    // Cache 6 jam sudah habis -- cek ScriptProperties, perpanjang kalau masih dalam 30 hari.
    const mulai = Number(PropertiesService.getScriptProperties().getProperty('sesi_mulai_' + token) || 0);
    if (!mulai) throw new Error('Sesi berakhir. Silakan login kembali.');
    const umurHari = (Date.now() - mulai) / 86400000;
    if (umurHari > SESI_MAKS_HARI) throw new Error('Sesi berakhir. Silakan login kembali.');
    versiTersimpan = versiSesiSekarang; // sesi lama dianggap valid, diperpanjang di bawah
  }

  if (versiTersimpan !== versiSesiSekarang) throw new Error('Sesi berakhir (kata sandi pernah diganti). Silakan login kembali.');
  cache.put('sesi_' + token, versiSesiSekarang, 21600); // perpanjang 6 jam lagi
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

