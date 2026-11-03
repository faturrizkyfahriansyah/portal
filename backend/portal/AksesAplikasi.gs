/**
 * SPPG JEUNGJING — PORTAL
 * AksesAplikasi.gs — PENGUNCIAN SUNGGUHAN aplikasi terhubung: SIPENDOK, SIPOGIM, SIPRES QR (BARU 4 Nov 2026, keputusan Admin).
 *
 * Aplikasi-aplikasi ini TIDAK punya login sendiri lagi. Satu-satunya pintu = login Portal + pemberian akses per relawan
 * (Manajemen Hak Akses > Akses Per Relawan, sheet 35_AKSES_RELAWAN_MODUL). Alurnya:
 *  1) Pengguna sudah login di Portal -> membuka aplikasi -> aplikasi memanggil terbitkanTokenAplikasi (di sini) dengan sesi Portal.
 *  2) Bila akun BELUM diberi akses -> ditolak (tidak ada token). Bila diberi -> token bertanda tangan HMAC dengan klaim `modul`, berlaku 6 jam.
 *  3) Server aplikasi memverifikasi tanda tangan + modul pada SETIAP permintaan, dan memeriksa ULANG pemberian akses di sheet 35_
 *     (cache 60 dtk), sehingga pencabutan akses berlaku dalam hitungan detik, bukan menunggu token habis.
 * Rahasia penandatanganan = AUTH_TERPUSAT_SECRET (AuthTerpusat.gs), harus SAMA di Script Properties tiap aplikasi.
 */
const APLIKASI_TERHUBUNG = ['SIPENDOK', 'SIPOGIM', 'SIPRES_QR'];

/** jenis: RELAWAN | ADMIN | SISTEM (panggilan server-ke-server Portal -> SIPENDOK, 5 menit). */
function buatTokenAplikasi_(idPengguna, nama, role, jenis, modul, menit) {
  const payload = { idRelawan: idPengguna, nama: nama, role: role || 'RELAWAN', jenis: jenis, modul: modul, exp: Date.now() + (menit || 360) * 60000 };
  const b = Utilities.base64EncodeWebSafe(JSON.stringify(payload), Utilities.Charset.UTF_8);
  const sig = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(b, ambilSecretAuthTerpusat_()));
  return b + '.' + sig;
}
/** Verifikasi tanda tangan, masa berlaku, dan klaim modul. Mengembalikan payload. */
function bacaTokenAplikasi_(token, modul) {
  const gagal = new Error('Sesi aplikasi tidak valid atau sudah berakhir. Buka kembali dari Portal.');
  if (!token || String(token).indexOf('.') < 0) throw gagal;
  const bagian = String(token).split('.');
  const harapan = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(bagian[0], ambilSecretAuthTerpusat_()));
  if (bagian[1] !== harapan) throw gagal;
  let payload;
  try { payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(bagian[0])).getDataAsString('UTF-8')); } catch (e) { throw gagal; }
  if (!payload.exp || payload.exp < Date.now() || payload.modul !== modul) throw gagal;
  return payload;
}
/** Pemeriksaan ULANG pemberian akses (relawan biasa). Admin/Super Admin/sistem: sudah dinilai saat token diterbitkan. */
function cekAksesAplikasiPortal_(payload, modul) {
  if (payload.jenis !== 'RELAWAN' || payload.role === 'SUPER_ADMIN') return true;
  if (!aksesRelawanPeta_()[String(payload.idRelawan).trim() + '|' + modul]) throw new Error('Akses Anda ke aplikasi ini belum diberikan atau telah dicabut oleh Pengelola.');
  return true;
}
/** Dipakai endpoint kios SIPRES QR (menggantikan kioskKey). */
function periksaAksesKiosk_(body) {
  const p = bacaTokenAplikasi_(body.tokenAplikasi, 'SIPRES_QR');
  cekAksesAplikasiPortal_(p, 'SIPRES_QR');
  return p;
}

/** Tukar sesi Portal (relawan atau admin) dengan token aplikasi. body: { token, kodeModul } */
function terbitkanTokenAplikasi(body) {
  const modul = sanitize(body.kodeModul);
  if (APLIKASI_TERHUBUNG.indexOf(modul) < 0) throw new Error('Aplikasi tidak dikenal.');
  let id, jenis, nama, role;
  try { id = requireAuthRelawan(body.token); jenis = 'RELAWAN'; const r = getRelawanById(id); nama = r ? r.nama : id; role = (r && r.roleBaru) || 'RELAWAN'; }
  catch (e1) { id = requireAuth(body.token, true); jenis = 'ADMIN'; nama = id; role = 'ADMIN'; }
  const akses = getAksesModulSaya(body.token);
  if (akses[modul] === false) throw new Error('Anda belum memiliki akses ke aplikasi ini. Hubungi Pengelola untuk diberi akses.');
  logAudit_('TOKEN_APLIKASI', 'HAK_AKSES', modul, id, { jenis: jenis });
  return { token: buatTokenAplikasi_(id, nama, role, jenis, modul, 360), modul: modul, nama: nama, jenis: jenis, berlakuMenit: 360 };
}
