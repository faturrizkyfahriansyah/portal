// ============================================================
// SPPG JEUNGJING — SIPANDU: helper API terpisah
// File BARU, terpisah dari common.js -- supaya common.js yang sudah
// dipakai semua halaman lain tidak perlu diubah/beresiko lagi. Menyusul
// pola persis sama dengan apiGet/apiPost (Content-Type sengaja tidak
// diisi di POST untuk menghindari CORS preflight -- lihat catatan di
// common.js), cuma target URL-nya beda (SIPANDU_API_URL, backend & Google
// Sheets terpisah dari Portal Relawan sesuai PROMPT MASTER FINAL).
// Butuh common.js sudah dimuat lebih dulu (pakai fetchDenganTimeout_/logDebug_).
// ============================================================

async function sipanduApiGet(action, params, _attempt) {
  const attempt = _attempt || 1;
  if (!action) throw new Error('Aksi SIPANDU belum ditentukan (kesalahan pada kode halaman).');
  if (!SIPANDU_API_URL || SIPANDU_API_URL === 'GANTI_DENGAN_URL_WEB_APP_SIPANDU') {
    throw new Error('SIPANDU belum terhubung ke server. Admin perlu mengisi SIPANDU_API_URL di config.js.');
  }
  const url = new URL(SIPANDU_API_URL);
  url.searchParams.set('action', action);
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  });

  const mulai = Date.now();
  let res;
  try {
    res = await fetchDenganTimeout_(url.toString(), { method: 'GET' });
  } catch (err) {
    const jaringanBermasalah = err.name === 'AbortError' || err instanceof TypeError;
    if (jaringanBermasalah && attempt < 3) {
      logDebug_('SIPANDU-RETRY', action, 'percobaan ke-' + (attempt + 1));
      await new Promise(r => setTimeout(r, 600 * attempt));
      return sipanduApiGet(action, params, attempt + 1);
    }
    logDebug_('SIPANDU-ERROR', action, err.name);
    if (err.name === 'AbortError') throw new Error('Server SIPANDU tidak merespons. Silakan muat ulang halaman.');
    throw new Error('Tidak dapat terhubung ke server SIPANDU. Periksa koneksi internet dan coba kembali.');
  }

  let json;
  try {
    const teksMentah = await res.text();
    try {
      json = JSON.parse(teksMentah);
    } catch (e2) {
      const cuplikan = teksMentah.replace(/\s+/g, ' ').trim().slice(0, 160);
      throw new Error('Server SIPANDU memberikan respons yang tidak bisa dibaca. Cuplikan: "' + (cuplikan || '(kosong)') + '"');
    }
  } catch (err) {
    if (err.message && err.message.indexOf('Cuplikan') !== -1) throw err;
    throw new Error('Server SIPANDU memberikan respons yang tidak terduga. Coba beberapa saat lagi.');
  }
  logDebug_('SIPANDU-OK', action, (Date.now() - mulai) + 'ms');
  if (!json.success) throw new Error(json.message || 'Terjadi kesalahan pada server SIPANDU.');
  return json.data;
}

async function sipanduApiPost(action, payload, timeoutMs) {
  if (!action) throw new Error('Aksi SIPANDU belum ditentukan (kesalahan pada kode halaman).');
  if (!SIPANDU_API_URL || SIPANDU_API_URL === 'GANTI_DENGAN_URL_WEB_APP_SIPANDU') {
    throw new Error('SIPANDU belum terhubung ke server. Admin perlu mengisi SIPANDU_API_URL di config.js.');
  }
  const mulai = Date.now();
  let res;
  try {
    res = await fetchDenganTimeout_(SIPANDU_API_URL, {
      method: 'POST',
      // Sengaja TIDAK ada header Content-Type -- sama alasannya seperti apiPost() di common.js.
      body: JSON.stringify(Object.assign({}, payload, { action }))
    }, timeoutMs);
  } catch (err) {
    logDebug_('SIPANDU-ERROR', action, err.name);
    if (err.name === 'AbortError') throw new Error('Server SIPANDU tidak merespons. Data mungkin belum tersimpan — periksa kembali sebelum mengulang.');
    throw new Error('Data belum dapat dikirim ke SIPANDU. Silakan periksa koneksi internet dan coba kembali.');
  }
  let json;
  try {
    const teksMentah = await res.text();
    try {
      json = JSON.parse(teksMentah);
    } catch (e2) {
      const cuplikan = teksMentah.replace(/\s+/g, ' ').trim().slice(0, 160);
      throw new Error('Server SIPANDU memberikan respons yang tidak bisa dibaca. Cuplikan: "' + (cuplikan || '(kosong)') + '"');
    }
  } catch (err) {
    if (err.message && err.message.indexOf('Cuplikan') !== -1) throw err;
    throw new Error('Server SIPANDU memberikan respons yang tidak terduga. Coba beberapa saat lagi.');
  }
  logDebug_('SIPANDU-OK', action, (Date.now() - mulai) + 'ms');
  if (!json.success) throw new Error(json.message || 'Terjadi kesalahan pada server SIPANDU.');
  return json.data;
}
