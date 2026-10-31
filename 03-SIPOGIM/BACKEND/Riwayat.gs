/**
 * SIPOGIM — Riwayat.gs
 * Baca RIWAYAT (jejak audit). Dibatasi 100 baris terbaru per
 * permintaan (filter opsional per entitas) -- sheet riwayat bisa
 * tumbuh besar, tidak dikirim semuanya tiap kali.
 */
function getRiwayat(body) {
  const filterEntitas = sanitizeSipogim_(body.entitas || '');
  const semua = sheetToObjectsSipogim_(getSheetSipogim_('RIWAYAT'));
  const dipilih = (filterEntitas ? semua.filter(r => r.ENTITAS === filterEntitas) : semua)
    .sort((a, b) => new Date(b.WAKTU) - new Date(a.WAKTU))
    .slice(0, 100);

  return dipilih.map(r => ({
    waktu: r.WAKTU, aktorNama: r.AKTOR_NAMA, entitas: r.ENTITAS, entitasId: r.ENTITAS_ID,
    aksi: r.AKSI, ringkasan: r.RINGKASAN
  }));
}

