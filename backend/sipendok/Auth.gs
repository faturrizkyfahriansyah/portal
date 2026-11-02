/**
 * Auth.gs — Login sederhana (nama pengguna + PIN) dengan token bertanda tangan HMAC.
 * Akun & secret disimpan di Script Properties (BUKAN di sheet / frontend / GitHub).
 * Kelola akun lewat fungsi tambahPengguna() / hapusPengguna() di editor Apps Script.
 */
var Auth = {
  _props: function () { return PropertiesService.getScriptProperties(); },

  _users: function () {
    var raw = Auth._props().getProperty('USERS');
    return raw ? JSON.parse(raw) : {};
  },
  _saveUsers: function (u) { Auth._props().setProperty('USERS', JSON.stringify(u)); },

  _secret: function () {
    var s = Auth._props().getProperty('AUTH_SECRET');
    if (!s) throw new AppError('Aplikasi belum disetup. Jalankan setup().', 'BELUM_SETUP');
    return s;
  },

  _hex: function (bytes) {
    return bytes.map(function (b) { var v = (b < 0 ? b + 256 : b).toString(16); return v.length < 2 ? '0' + v : v; }).join('');
  },
  _hash: function (salt, pin) {
    return Auth._hex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + pin, Utilities.Charset.UTF_8));
  },

  buatPengguna: function (username, nama, pin) {
    username = U.str(username).toLowerCase();
    if (!/^[a-z0-9_.-]{3,30}$/.test(username)) throw new AppError('Nama pengguna 3–30 karakter (huruf kecil, angka, . _ -).');
    if (String(pin).length < 6) throw new AppError('PIN minimal 6 karakter.');
    var users = Auth._users(), salt = Utilities.getUuid();
    users[username] = { nama: U.str(nama) || username, salt: salt, hash: Auth._hash(salt, String(pin)) };
    Auth._saveUsers(users);
  },
  hapusPengguna: function (username) {
    var users = Auth._users();
    delete users[U.str(username).toLowerCase()];
    Auth._saveUsers(users);
  },

  _sign: function (payload) {
    var b = Utilities.base64EncodeWebSafe(JSON.stringify(payload), Utilities.Charset.UTF_8);
    var sig = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(b, Auth._secret()));
    return b + '.' + sig;
  },

  login: function (username, pin) {
    username = U.str(username).toLowerCase();
    var cache = CacheService.getScriptCache(), key = 'lf:' + username;
    var fails = Number(cache.get(key) || 0);
    if (fails >= 5) throw new AppError('Terlalu banyak percobaan gagal. Coba lagi dalam 10 menit.', 'TERKUNCI');
    var u = Auth._users()[username];
    if (!u || Auth._hash(u.salt, String(pin || '')) !== u.hash) {
      cache.put(key, String(fails + 1), 600);
      throw new AppError('Nama pengguna atau PIN salah.', 'LOGIN_GAGAL');
    }
    cache.remove(key);
    var exp = Date.now() + Cfg.SESSION_HARI * 24 * 3600 * 1000;
    return { token: Auth._sign({ u: username, n: u.nama, exp: exp }), nama: u.nama, username: username, exp: exp };
  },

  /** Verifikasi token; kembalikan {username, nama} atau lempar AppError('SESI_HABIS'). */
  verify: function (token) {
    var bad = new AppError('Sesi berakhir. Silakan masuk kembali.', 'SESI_HABIS');
    if (!token || String(token).indexOf('.') < 0) throw bad;
    var parts = String(token).split('.');
    var expect = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(parts[0], Auth._secret()));
    if (parts[1] !== expect) throw bad;
    var p;
    try {
      p = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString('UTF-8'));
    } catch (e) { throw bad; }
    if (!p.exp || p.exp < Date.now()) throw bad;
    if (!Auth._users()[p.u]) throw bad;   // akun sudah dihapus
    return { username: p.u, nama: p.n };
  }
};

