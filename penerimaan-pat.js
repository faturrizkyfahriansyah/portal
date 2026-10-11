// SPPG JEUNGJING — LOGIC HALAMAN PENERIMAAN PAT (RELAWAN, READ ONLY)
// Menggunakan getPenerimaManfaatRelawan -- endpoint ini SECARA DESAIN
// tidak pernah menyertakan BUDGET/KETERANGAN/DIBUAT_OLEH/dst (data
// internal Pengelola) sama sekali, jadi tidak ada yang perlu disembunyikan
// di sisi frontend -- kalau field itu tidak ada di response, tidak
// mungkin tertampil di sini.

document.addEventListener('DOMContentLoaded', async () => {
  const sesi = ambilSesiRelawan();
  if (!sesi || !sesi.token) {
    window.location.href = 'login.html';
    return;
  }

  const main = document.getElementById('pmMain');
  const tbody = document.getElementById('pmRelawanTbody');
  const rekapWrap = document.getElementById('pmRelawanRekap');
  const inputCari = document.getElementById('pmRelawanCari');
  let daftarTerakhir = [];

  function labelOrientasi_(k) {
    if (k === 'PESERTA_DIDIK') return 'Peserta Didik';
    if (k === '3B') return '3B';
    return '(tidak dikenal)';
  }

  function renderRekap_(daftar) {
    let totalPenerima = 0, totalPk = 0, totalPb = 0, totalBumil = 0, totalBusui = 0, totalBalita = 0;
    daftar.forEach(r => {
      totalPenerima += r.jumlah;
      totalPk += r.pk; totalPb += r.pb;
      totalBumil += r.bumil; totalBusui += r.busui; totalBalita += r.balita;
    });
    rekapWrap.innerHTML = `
      <div class="panel-block" style="flex:1;min-width:120px;padding:12px 14px;text-align:center;"><div style="font-size:11px;color:var(--color-text-muted);">Total Penerima</div><div style="font-size:20px;font-weight:800;color:var(--color-navy);">${totalPenerima}</div></div>
      <div class="panel-block" style="flex:1;min-width:80px;padding:12px 14px;text-align:center;"><div style="font-size:11px;color:var(--color-text-muted);">PK</div><div style="font-size:16px;font-weight:700;">${totalPk || '—'}</div></div>
      <div class="panel-block" style="flex:1;min-width:80px;padding:12px 14px;text-align:center;"><div style="font-size:11px;color:var(--color-text-muted);">PB</div><div style="font-size:16px;font-weight:700;">${totalPb || '—'}</div></div>
      <div class="panel-block" style="flex:1;min-width:80px;padding:12px 14px;text-align:center;"><div style="font-size:11px;color:var(--color-text-muted);">Bumil</div><div style="font-size:16px;font-weight:700;">${totalBumil || '—'}</div></div>
      <div class="panel-block" style="flex:1;min-width:80px;padding:12px 14px;text-align:center;"><div style="font-size:11px;color:var(--color-text-muted);">Busui</div><div style="font-size:16px;font-weight:700;">${totalBusui || '—'}</div></div>
      <div class="panel-block" style="flex:1;min-width:80px;padding:12px 14px;text-align:center;"><div style="font-size:11px;color:var(--color-text-muted);">Balita</div><div style="font-size:16px;font-weight:700;">${totalBalita || '—'}</div></div>
    `;
  }

  function renderTabel_() {
    const cari = (inputCari.value || '').trim().toLowerCase();
    const hasil = !cari ? daftarTerakhir : daftarTerakhir.filter(r =>
      r.id.toLowerCase().indexOf(cari) !== -1 || String(r.instansi).toLowerCase().indexOf(cari) !== -1
    );
    if (!hasil.length) {
      tbody.innerHTML = '<tr><td colspan="10"><div class="empty-state">Tidak ada data yang cocok.</div></td></tr>';
      return;
    }
    // Nilai 0 ditampilkan "—" di sini (presentation layer saja) -- data
    // di database tetap 0, tidak diubah jadi teks (§32).
    tbody.innerHTML = hasil.map(r => `
      <tr>
        <td>${escapeHtml(r.id)}</td>
        <td>${escapeHtml(r.instansi)}</td>
        <td>${labelOrientasi_(r.kategori)}</td>
        <td>${r.pk || '—'}</td>
        <td>${r.pb || '—'}</td>
        <td>${r.bumil || '—'}</td>
        <td>${r.busui || '—'}</td>
        <td>${r.balita || '—'}</td>
        <td><strong>${r.jumlah}</strong></td>
        <td>${escapeHtml(r.namaPic || '—')}</td>
      </tr>`).join('');
  }

  inputCari.addEventListener('input', renderTabel_);

  try {
    showLoading('Memuat data Penerima Manfaat...');
    daftarTerakhir = await apiGet('getPenerimaManfaatRelawan', { token: sesi.token });
    hideLoading();
    renderRekap_(daftarTerakhir);
    renderTabel_();
    main.style.display = 'block';
  } catch (err) {
    hideLoading();
    if (apakahErrorSesiTidakValid(err.message)) {
      hapusSesiRelawan();
      simpanNotisLogin(err.message || 'Sesi telah berakhir. Silakan login kembali.');
      window.location.href = 'login.html';
      return;
    }
    showError(err.message || 'Gagal memuat data. Silakan coba lagi.');
    main.innerHTML = `
      <div class="empty-state" style="padding:40px 20px;text-align:center;">
        <p style="margin:0 0 12px;font-size:14px;color:#55606f;">Gagal memuat data. Silakan coba lagi.</p>
        <button type="button" id="btnCobaLagiPM" class="btn-outline">↻ Coba Lagi</button>
      </div>`;
    main.style.display = 'block';
    const btnCobaLagi = document.getElementById('btnCobaLagiPM');
    if (btnCobaLagi) btnCobaLagi.addEventListener('click', () => window.location.reload());
  }
});
