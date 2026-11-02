// ============================================================
// admin-target-widget.js — Widget Target Penerima (Semua/Per Divisi/
// Individu), dipakai bersama oleh form Notifikasi, Informasi, Pengumuman.
// File BARU, mandiri -- tidak mengubah struktur admin.js, cuma dipanggil
// oleh handler submit yang sudah ada lewat ambilNilaiTargetWidget().
// ============================================================

(function () {
  'use strict';
  const PREFIX_LIST = ['Notifikasi', 'Informasi', 'Pengumuman'];

  function token() { return window.sppgAdminToken || (typeof authToken !== 'undefined' ? authToken : null); }

  async function isiSemuaDropdown_() {
    let divisiList = [], relawanList = [];
    try { divisiList = await apiGet('getDivisi', { token: token() }); } catch (e) { /* diamkan -- widget tetap jalan dengan opsi Semua saja */ }
    try { relawanList = await apiGet('getRelawan', { semua: 1, token: token() }); } catch (e) { /* diamkan */ }

    PREFIX_LIST.forEach(prefix => {
      const selDivisi = document.getElementById('selectDivisiTarget' + prefix);
      const selRelawan = document.getElementById('selectRelawanTarget' + prefix);
      if (selDivisi) {
        selDivisi.innerHTML = '<option value="">Pilih Divisi...</option>' +
          divisiList.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');
      }
      if (selRelawan) {
        selRelawan.innerHTML = '<option value="">Pilih Relawan...</option>' +
          relawanList.map(r => `<option value="${escapeHtml(r.id || r.ID_RELAWAN)}">${escapeHtml(r.nama || r.NAMA_RELAWAN)}</option>`).join('');
      }
    });
  }

  function pasangHandlerJenis_() {
    PREFIX_LIST.forEach(prefix => {
      const selJenis = document.getElementById('selectJenisTarget' + prefix);
      const selDivisi = document.getElementById('selectDivisiTarget' + prefix);
      const selRelawan = document.getElementById('selectRelawanTarget' + prefix);
      if (!selJenis) return;

      selJenis.addEventListener('change', () => {
        const jenis = selJenis.value;
        if (selDivisi) selDivisi.style.display = (jenis === 'DIVISI') ? '' : 'none';
        if (selRelawan) selRelawan.style.display = (jenis === 'INDIVIDU') ? '' : 'none';
      });
    });
  }

  /**
   * Dipanggil dari handler submit form yang SUDAH ADA di admin.js --
   * return string encoding yang sudah dipahami backend (Utils.gs):
   * "SEMUA" | "DIVISI:NamaDivisi" | ID relawan.
   */
  window.ambilNilaiTargetWidget = function (prefix) {
    const jenis = document.getElementById('selectJenisTarget' + prefix)?.value || 'SEMUA';
    if (jenis === 'DIVISI') {
      const nilai = document.getElementById('selectDivisiTarget' + prefix)?.value;
      if (!nilai) throw new Error('Pilih divisi tujuan dulu.');
      return 'DIVISI:' + nilai;
    }
    if (jenis === 'INDIVIDU') {
      const nilai = document.getElementById('selectRelawanTarget' + prefix)?.value;
      if (!nilai) throw new Error('Pilih relawan tujuan dulu.');
      return nilai;
    }
    return 'SEMUA';
  };

  /** Reset widget ke kondisi awal (dipanggil setelah form.reset()). */
  window.resetTargetWidget = function (prefix) {
    const selJenis = document.getElementById('selectJenisTarget' + prefix);
    const selDivisi = document.getElementById('selectDivisiTarget' + prefix);
    const selRelawan = document.getElementById('selectRelawanTarget' + prefix);
    // Pakai Target Penerima Default dari Pengaturan (kalau sudah diisi Admin),
    // fallback ke SEMUA kalau belum ada.
    const def = window.sppgTargetDefault || 'SEMUA';
    if (selJenis) {
      if (def.indexOf('DIVISI:') === 0) {
        selJenis.value = 'DIVISI';
        if (selDivisi) { selDivisi.value = def.slice(7); selDivisi.style.display = ''; }
        if (selRelawan) { selRelawan.value = ''; selRelawan.style.display = 'none'; }
        return;
      }
      selJenis.value = 'SEMUA';
    }
    if (selDivisi) { selDivisi.value = ''; selDivisi.style.display = 'none'; }
    if (selRelawan) { selRelawan.value = ''; selRelawan.style.display = 'none'; }
  };

  document.addEventListener('DOMContentLoaded', () => {
    pasangHandlerJenis_();
    // Coba isi dropdown berulang sebentar -- form-form ini ada di panel
    // yang mungkin baru dirender belakangan oleh admin.js.
    let percobaan = 0;
    const interval = setInterval(() => {
      const adaForm = PREFIX_LIST.some(p => document.getElementById('selectJenisTarget' + p));
      percobaan++;
      if (adaForm || percobaan > 20) {
        clearInterval(interval);
        if (adaForm) isiSemuaDropdown_();
      }
    }, 300);
  });
})();
