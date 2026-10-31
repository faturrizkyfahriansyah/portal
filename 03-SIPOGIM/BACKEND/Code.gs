/**
 * SIPOGIM — Code.gs
 * Dispatcher utama. Pola respons JSON seragam { success, data } atau
 * { success:false, message } -- SAMA PERSIS gaya yang dipakai backend
 * Portal SPPG Jeungjing, supaya frontend bisa pakai helper apiPost/
 * apiGet yang nyaris identik dengan punya Portal.
 *
 * SEMUA aksi lewat POST (doPost) kecuali /health. Ini pilihan sengaja
 * (beda dari Portal yang punya doGet+doPost) supaya tidak ada lagi
 * risiko "aksi terdaftar di GET tapi dipanggil lewat POST" -- bug yang
 * beberapa kali muncul di Portal karena 2 dispatcher terpisah.
 */

function doGet(e) {
  const action = e.parameter.action;
  if (action === 'health') {
    return jsonSipogim_({ success: true, data: { status: 'ok', waktuServer: sekarangSipogim_().toISOString(), sinkronTerakhir: getPengaturan_('SINKRON_TERAKHIR', null) } });
  }
  return jsonSipogim_({ success: false, message: 'Gunakan POST untuk aksi ini.' });
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); }
  catch (err) { return jsonSipogim_({ success: false, message: 'Permintaan tidak terbaca.' }); }

  const action = body.action;
  const PUBLIK = ['login', 'health']; // tidak butuh sesi

  try {
    if (PUBLIK.indexOf(action) === -1) periksaSesi_(body.token);

    let data;
    switch (action) {
      case 'login': data = login(body); break;
      case 'logout': data = logout(body); break;
      case 'cekSesi': data = cekSesi(body); break;
      case 'gantiKataSandi': data = gantiKataSandi(body); break;
      case 'gantiPin': data = gantiPin(body); break;

      case 'getBeranda': data = getBeranda(body); break;

      case 'getPeriodeList': data = getPeriodeList(body); break;
      case 'getMenuPeriode': data = getMenuPeriode(body); break;
      case 'getMenuHarian': data = getMenuHarian(body); break;
      case 'catatSalin': data = catatSalin(body); break;

      case 'getResepList': data = getResepList(body); break;
      case 'getResepDetail': data = getResepDetail(body); break;
      case 'tambahResep': data = tambahResep(body); break;
      case 'ubahResep': data = ubahResep(body); break;
      case 'duplikatResep': data = duplikatResep(body); break;
      case 'setujuiResep': data = setujuiResep(body); break;

      case 'getBahanList': data = getBahanList(body); break;
      case 'getBahanDetail': data = getBahanDetail(body); break;
      case 'tambahBahan': data = tambahBahan(body); break;
      case 'ubahBahan': data = ubahBahan(body); break;
      case 'setujuiBahan': data = setujuiBahan(body); break;

      case 'getPadananList': data = getPadananList(body); break;
      case 'konfirmasiPadanan': data = konfirmasiPadanan(body); break;
      case 'buatResepDariPadanan': data = buatResepDariPadanan(body); break;

      case 'hitungBebas': data = hitungBebas(body); break;

      case 'getRiwayat': data = getRiwayat(body); break;

      case 'getPengaturan': data = getPengaturanSemua(body); break;
      case 'ubahPengaturan': data = ubahPengaturan(body); break;

      case 'sinkronSekarang': data = sinkronSekarang(body); break;
      case 'getSinkronStatus': data = getSinkronStatus(body); break;

      default: return jsonSipogim_({ success: false, message: 'Aksi tidak dikenali: ' + action });
    }
    return jsonSipogim_({ success: true, data: data });
  } catch (err) {
    return jsonSipogim_({ success: false, message: err.message || 'Terjadi kesalahan.' });
  }
}

function jsonSipogim_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

