/**
 * SPPG JEUNGJING â€” SISTEM ABSENSI RELAWAN
 * Pengumuman.gs â€” Pengumuman (Modul Dashboard Admin)
 */

function getPengumumanSheet() {
  return getSheet(NAMA_SHEET.PENGUMUMAN);
}

function generateIdPengumuman_(sheet) {
  const data = sheet.getDataRange().getValues();
  let max = 0;
  for (let i = 1; i < data.length; i++) {
    const id = String(data[i][0] || '');
    const cocok = id.match(/^PGM(\d+)$/i);
    if (cocok) max = Math.max(max, parseInt(cocok[1], 10));
  }
  return 'PGM' + String(max + 1).padStart(3, '0');
}

function getPengumumanListAdmin() {
  // Fase 1: cache 5 menit, sama seperti getInformasiListAdmin.
  const cache = CacheService.getScriptCache();
  const tersimpan = cache.get('cache_pengumuman_list_admin');
  if (tersimpan) return JSON.parse(tersimpan);

  const semua = sheetToObjects(getPengumumanSheet());
  const list = semua.map(p => ({
    id: p.ID, judul: p.JUDUL, isi: p.ISI, target: p.TARGET,
    tanggalPublikasi: p.TANGGAL_PUBLIKASI, status: p.STATUS
  })).reverse();
  cache.put('cache_pengumuman_list_admin', JSON.stringify(list), 300); // 5 menit
  return list;
}

function addPengumuman(body) {
  const judul = sanitize(body.judul);
  const isi = sanitize(body.isi);
  const target = sanitize(body.target) || 'SEMUA';
  const tanggalPublikasiIso = sanitize(body.tanggalPublikasi);
  if (!judul) throw new Error('Judul pengumuman wajib diisi.');
  if (!isi) throw new Error('Isi pengumuman wajib diisi.');

  let tanggalPublikasiDMY = formatTanggal(new Date());
  if (tanggalPublikasiIso) {
    const bagian = tanggalPublikasiIso.split('-');
    if (bagian.length === 3) tanggalPublikasiDMY = `${bagian[2]}/${bagian[1]}/${bagian[0]}`;
  }

  const sheet = getPengumumanSheet();
  const id = generateIdPengumuman_(sheet);
  sheet.appendRow([id, judul, isi, target, tanggalPublikasiDMY, 'AKTIF', new Date()]);
  CacheService.getScriptCache().remove('cache_pengumuman_list_admin');

  // BUG LAMA DIPERBAIKI: sebelumnya `target` disimpan di sheet tapi TIDAK
  // PERNAH diteruskan ke addInformasi() -- akibatnya Pengumuman SELALU
  // tayang ke semua orang walau Admin sudah memilih target tertentu.
  addInformasi({ judul: judul, isi: isi, targetPenerima: target });

  return { id: id };
}

