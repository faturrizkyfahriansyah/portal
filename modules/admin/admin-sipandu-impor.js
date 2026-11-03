// SPPG JEUNGJING — ADMIN: SIPANDU › Manajemen PM › Impor riwayat Penerimaan SIPENDOK. BARU 4 Nov 2026.
// Pagu/Rekap Biaya/Insentif/Kalender membaca PM HARIAN; tanggal sebelum peralihan perlu diimpor dari 03_PENERIMAAN SIPENDOK (tab _IMPOR_PENERIMAAN
// di database SIPANDU, dari berkas IMPOR_RIWAYAT_PENERIMAAN.xlsx). Kartu ini hanya muncul bila ada yang BARU untuk diimpor. Backend: SipanduImporV2.gs.
(function () {
  const panel = document.getElementById('panelSipanduPm'); if (!panel) return;
  const esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  const f = function (n) { return Number(n || 0).toLocaleString('id-ID'); };
  const api = function (aksi, payload) { return apiPost(aksi, Object.assign({ token: ambilSesiAdmin().token }, payload || {})); };
  async function periksa() {
    const lama = document.getElementById('imporKartu'); if (lama) lama.remove();
    let r; try { r = await api('getRencanaImporRiwayatV2'); } catch (e) { return; }          // DB belum tersambung / tanpa izin: tidak tampil
    if (!r || !r.tersedia || (!r.tanggalBaru.length && !r.masalah.length)) return;
    const k = document.createElement('div'); k.id = 'imporKartu'; k.className = 'admin-stat-card ' + (r.masalah.length ? 'accent-warning' : ''); k.style.cssText = 'padding:14px;text-align:left;margin:0 0 14px;font-size:13px;';
    const rentang = r.tanggalBaru.length ? r.tanggalBaru[0].tanggal.split('-').reverse().join('/') + ' – ' + r.tanggalBaru[r.tanggalBaru.length - 1].tanggal.split('-').reverse().join('/') : '';
    k.innerHTML = '<b>Riwayat Penerimaan SIPENDOK siap diimpor</b><div style="margin-top:4px;">' + r.tanggalBaru.length + ' tanggal baru (' + esc(rentang) + '), ' + f(r.totalBaris) + ' baris, ' + f(r.totalPorsi) + ' porsi' + (r.tanggalDilewati.length ? ' · ' + r.tanggalDilewati.length + ' tanggal sudah ada di SIPANDU (dilewati, tidak ditimpa)' : '') + '.</div>' +
      (r.masalah.length ? '<div style="color:#c0392b;margin-top:6px;"><b>' + r.masalah.length + ' masalah — impor dibatalkan sampai diperbaiki:</b><ul style="margin:4px 0 0 18px;">' + r.masalah.slice(0, 5).map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul></div>' :
        '<div style="margin-top:4px;color:var(--color-text-muted,#55606f);">Tanpa ini, tanggal-tanggal itu tampil kosong di Pagu, Rekap Biaya, Insentif, dan Kalender. Data yang sudah Anda isi di SIPANDU tidak diubah.</div><div style="margin-top:8px;"><button class="btn-mini primary" id="imporJalan" type="button">Impor sekarang</button> <span id="imporPesan" style="margin-left:8px;"></span></div>');
    const head = panel.querySelector('.shell-page-head'); if (head) head.insertAdjacentElement('afterend', k); else panel.insertBefore(k, panel.firstChild);
    const b = document.getElementById('imporJalan'); if (b) b.addEventListener('click', jalan);
  }
  async function jalan() {
    if (!confirm('Impor riwayat Penerimaan SIPENDOK ke PM Harian SIPANDU?\n\nTanggal yang sudah ada di SIPANDU dilewati. Bila ada satu masalah, tidak ada yang ditulis.')) return;
    const p = document.getElementById('imporPesan'); p.style.color = ''; p.textContent = 'Mengimpor…';
    try { const h = await api('jalankanImporRiwayatV2', { konfirmasi: true }); await periksa(); const d = document.createElement('div'); d.id = 'imporKartu'; d.className = 'admin-stat-card'; d.style.cssText = 'padding:12px 14px;margin:0 0 14px;font-size:13px;color:#2e7d32;'; d.textContent = 'Selesai: ' + h.tanggalDiimpor + ' tanggal (' + f(h.barisDiimpor) + ' baris, ' + f(h.totalPorsi) + ' porsi) diimpor.' + (h.tanggalDilewati.length ? ' ' + h.tanggalDilewati.length + ' tanggal dilewati karena sudah ada.' : '');
      if (!document.getElementById('imporKartu')) { const head = panel.querySelector('.shell-page-head'); if (head) head.insertAdjacentElement('afterend', d); } }
    catch (err) { p.style.color = '#c0392b'; p.textContent = err.message || 'Gagal.'; }
  }
  const tombol = document.querySelector('[data-panel="panelSipanduPm"]');
  if (tombol) tombol.addEventListener('click', function () { setTimeout(periksa, 400); });
})();
