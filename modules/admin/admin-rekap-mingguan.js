// SPPG JEUNGJING — ADMIN: Rekap Mingguan (SIPRES). Ditulis ulang 4 Nov 2026 sesuai Blueprint §7 dan §13:
// pilih TANGGAL MULAI -> akhir dihitung otomatis (Mingguan 7 hari kalender, Dua Minggu 14 hari, Bulanan = bulan kalender,
// Kustom = bebas). Tanpa periode. Penggajian mingguan: tarif harian (Master Tarif, berlaku mulai tanggal tertentu) × hari hadir.
// Tanpa memilih divisi, relawan dikelompokkan per divisi dengan subtotal. Memuat otomatis saat menu pertama dibuka.
(function () {
  const panel = document.getElementById('panelRekapMingguan');
  if (!panel) return;
  const $ = function (id) { return document.getElementById(id); };
  const esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  const rupiah = function (n) { return 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID'); };
  const z = function (n) { return String(n).padStart(2, '0'); };
  const isoLokal = function (d) { return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()); };
  const dari = function (iso) { const p = iso.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
  const geserHari = function (iso, n) { const d = dari(iso); d.setDate(d.getDate() + n); return isoLokal(d); };
  const awalBulan = function (iso) { const d = dari(iso); return isoLokal(new Date(d.getFullYear(), d.getMonth(), 1)); };
  const akhirBulan = function (iso) { const d = dari(iso); return isoLokal(new Date(d.getFullYear(), d.getMonth() + 1, 0)); };
  const geserBulan = function (iso, n) { const d = dari(iso); return isoLokal(new Date(d.getFullYear(), d.getMonth() + n, 1)); };
  const selisihHari = function (a, b) { return Math.round((dari(b) - dari(a)) / 86400000); };
  const tglIndo = function (iso) { return iso.split('-').reverse().join('/'); };
  const seninMingguIni = function () { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return isoLokal(d); };

  let hasilTerakhir = null, sudahMuatPertama = false;

  function akhirDari(mode, mulai) {
    if (mode === 'mingguan') return geserHari(mulai, 6);
    if (mode === 'duaminggu') return geserHari(mulai, 13);
    if (mode === 'bulanan') return akhirBulan(mulai);
    return $('rmgAkhir').value || mulai;
  }
  function sesuaikan() {
    const mode = $('rmgMode').value;
    if (mode === 'bulanan' && $('rmgAwal').value) $('rmgAwal').value = awalBulan($('rmgAwal').value);   // bulan kalender: mulai = tanggal 1
    $('rmgAkhir').disabled = mode !== 'kustom';
    if (mode !== 'kustom' && $('rmgAwal').value) $('rmgAkhir').value = akhirDari(mode, $('rmgAwal').value);
    if ($('rmgAwal').value && $('rmgAkhir').value) $('rmgRentang').textContent = tglIndo($('rmgAwal').value) + ' – ' + tglIndo($('rmgAkhir').value) + ' (' + (selisihHari($('rmgAwal').value, $('rmgAkhir').value) + 1) + ' hari kalender)';
  }
  function geser(arah) {
    const mode = $('rmgMode').value, awal = $('rmgAwal').value, akhir = $('rmgAkhir').value; if (!awal) return;
    if (mode === 'mingguan') $('rmgAwal').value = geserHari(awal, 7 * arah);
    else if (mode === 'duaminggu') $('rmgAwal').value = geserHari(awal, 14 * arah);
    else if (mode === 'bulanan') $('rmgAwal').value = geserBulan(awal, arah);
    else { const panjang = selisihHari(awal, akhir) + 1; $('rmgAwal').value = geserHari(awal, panjang * arah); $('rmgAkhir').value = geserHari(akhir, panjang * arah); }
    sesuaikan(); muat();
  }

  function baris_() {
    if (!hasilTerakhir) return [];
    const dv = $('rmgDivisi').value, kata = $('rmgCari').value.trim().toLowerCase();
    return hasilTerakhir.data.filter(function (r) { return (!dv || r.divisi === dv) && (!kata || String(r.namaRelawan).toLowerCase().indexOf(kata) >= 0); });
  }
  function isiFilterDivisi() {
    const sel = $('rmgDivisi'), pilih = sel.value;
    const unik = Array.from(new Set(hasilTerakhir.data.map(function (r) { return r.divisi; }).filter(Boolean))).sort();
    sel.innerHTML = '<option value="">Semua Divisi</option>' + unik.map(function (d) { return '<option value="' + esc(d) + '">' + esc(d) + '</option>'; }).join('');
    if (unik.indexOf(pilih) >= 0) sel.value = pilih;
  }
  const jumlah = function (arr, k) { return arr.reduce(function (s, r) { return s + (Number(r[k]) || 0); }, 0); };

  function render() {
    const semua = hasilTerakhir.data, baris = baris_(), tbody = $('tbodyRekapMingguan');
    $('rmgTotalInsentif').textContent = rupiah(jumlah(semua, 'totalInsentif'));
    $('rmgTotalHadir').textContent = (jumlah(semua, 'hadir') + jumlah(semua, 'terlambat')).toLocaleString('id-ID');
    $('rmgJumlahRelawan').textContent = semua.length.toLocaleString('id-ID');
    $('rmgBelumLengkap').textContent = String(hasilTerakhir.jumlahBelumLengkap);
    const bervariasi = semua.filter(function (r) { return r.tarifBervariasi; }).length, catatan = [];
    if (hasilTerakhir.jumlahBelumLengkap > 0) catatan.push(hasilTerakhir.jumlahBelumLengkap + ' relawan belum punya tarif (insentif Rp0) — atur di menu Master Tarif.');
    if (bervariasi > 0) catatan.push('Tarif berganti di tengah rentang untuk ' + bervariasi + ' relawan (dihitung per hari).');
    catatan.push('Ekspor tiap minggu begitu final: tarif yang diubah dengan tanggal berlaku lampau akan mengubah rekap rentang itu bila dihitung ulang.');
    $('rmgCatatan').textContent = catatan.join(' ');
    if (!baris.length) { tbody.innerHTML = '<tr><td colspan="11"><div class="empty-state">Tidak ada data presensi pada rentang ini.</div></td></tr>'; return; }

    const sel = function (r) {
      let tarif;
      if (r.tarifBervariasi) tarif = '<span title="Tarif berganti di tengah rentang">bervariasi</span>';
      else if (r.tarifHarian === null) tarif = '<span style="color:#c0392b;">Belum diatur</span>';
      else tarif = rupiah(r.tarifHarian);
      const peringatan = (!r.tarifLengkap && r.tarifHarian !== null) ? ' <span style="color:#c0392b;" title="Ada hari dibayar tanpa tarif">⚠</span>' : '';
      return '<tr><td>' + esc(r.namaRelawan) + '</td><td>' + esc(r.divisi) + '</td><td>' + esc(r.nomorRekening || '—') + '</td><td>' + r.hadir + '</td><td>' + r.terlambat + '</td><td>' + r.izin + '</td><td>' + r.sakit + '</td><td>' + r.tidakHadir + '</td><td>' + r.totalHariKerja + '</td><td>' + tarif + peringatan + '</td><td><b>' + rupiah(r.totalInsentif) + '</b></td></tr>';
    };
    const subtotal = function (judul, arr) {
      return '<tr style="background:var(--color-surface,#f6f8fb);font-weight:700;"><td colspan="3">' + esc(judul) + '</td><td>' + jumlah(arr, 'hadir') + '</td><td>' + jumlah(arr, 'terlambat') + '</td><td>' + jumlah(arr, 'izin') + '</td><td>' + jumlah(arr, 'sakit') + '</td><td>' + jumlah(arr, 'tidakHadir') + '</td><td>' + jumlah(arr, 'totalHariKerja') + '</td><td></td><td>' + rupiah(jumlah(arr, 'totalInsentif')) + '</td></tr>';
    };
    const urut = baris.slice().sort(function (a, b) { return String(a.divisi).localeCompare(String(b.divisi)) || String(a.namaRelawan).localeCompare(String(b.namaRelawan)); });
    let html = '';
    if ($('rmgDivisi').value) html = urut.map(sel).join('') + subtotal('TOTAL ' + $('rmgDivisi').value, urut);
    else {
      const grup = {}; urut.forEach(function (r) { (grup[r.divisi || '—'] = grup[r.divisi || '—'] || []).push(r); });
      Object.keys(grup).forEach(function (d) { html += '<tr><td colspan="11" style="background:var(--color-navy,#1f3864);color:#fff;font-weight:700;">' + esc(d) + ' · ' + grup[d].length + ' relawan</td></tr>' + grup[d].map(sel).join('') + subtotal('Subtotal ' + d, grup[d]); });
      html += subtotal('TOTAL SEMUA DIVISI', urut);
    }
    tbody.innerHTML = html;
  }

  async function muat() {
    const awal = $('rmgAwal').value, akhir = $('rmgAkhir').value, tbody = $('tbodyRekapMingguan');
    if (!awal || !akhir) { alert('Pilih tanggal mulai dulu.'); return; }
    if (awal > akhir) { alert('Tanggal mulai tidak boleh setelah tanggal akhir.'); return; }
    tbody.innerHTML = '<tr><td colspan="11"><div class="empty-state">Memuat…</div></td></tr>';
    try {
      hasilTerakhir = await apiPost('getRekapMingguanAdmin', { token: ambilSesiAdmin().token, tanggalAwal: awal, tanggalAkhir: akhir });
      isiFilterDivisi(); render();
    } catch (err) {
      hasilTerakhir = null;
      tbody.innerHTML = '<tr><td colspan="11"><div class="empty-state" style="color:#c0392b;">' + esc(err.message || 'Gagal memuat rekap.') + '</div></td></tr>';
    }
  }

  function exportCsv() {
    const baris = baris_().slice().sort(function (a, b) { return String(a.divisi).localeCompare(String(b.divisi)) || String(a.namaRelawan).localeCompare(String(b.namaRelawan)); });
    if (!baris.length) { alert('Belum ada data untuk diekspor. Klik Tampilkan dulu.'); return; }
    const q = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    const kepala = ['Nama', 'Divisi', 'Nomor Rekening', 'Hadir', 'Terlambat', 'Izin', 'Sakit', 'Alfa', 'Total Hari Kerja', 'Tarif per Hari', 'Total Insentif'];
    const isi = baris.map(function (r) {
      const tarif = r.tarifBervariasi ? 'bervariasi' : (r.tarifHarian === null ? 'belum diatur' : r.tarifHarian);
      const rek = r.nomorRekening ? '="' + r.nomorRekening + '"' : '';   // cegah Excel mengubah nomor rekening jadi notasi ilmiah
      return [q(r.namaRelawan), q(r.divisi), rek, r.hadir, r.terlambat, r.izin, r.sakit, r.tidakHadir, r.totalHariKerja, q(tarif), r.totalInsentif].join(',');
    });
    const blob = new Blob(['\uFEFF' + kepala.map(q).join(',') + '\r\n' + isi.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'rekap-mingguan-' + hasilTerakhir.tanggalAwal + '-sd-' + hasilTerakhir.tanggalAkhir + '.csv';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  $('rmgAwal').value = seninMingguIni(); sesuaikan();
  $('rmgMode').addEventListener('change', function () { if ($('rmgMode').value === 'kustom') $('rmgAkhir').value = $('rmgAkhir').value || akhirDari('mingguan', $('rmgAwal').value); sesuaikan(); });
  $('rmgAwal').addEventListener('change', sesuaikan); $('rmgAkhir').addEventListener('change', sesuaikan);
  $('rmgMundur').addEventListener('click', function () { geser(-1); }); $('rmgMaju').addEventListener('click', function () { geser(1); });
  $('btnMuatRekapMingguan').addEventListener('click', muat); $('btnExportRekapMingguan').addEventListener('click', exportCsv);
  $('rmgDivisi').addEventListener('change', function () { if (hasilTerakhir) render(); });
  $('rmgCari').addEventListener('input', function () { if (hasilTerakhir) render(); });
  const tombolMenu = document.querySelector('[data-panel="panelRekapMingguan"]');
  if (tombolMenu) tombolMenu.addEventListener('click', function () { if (!sudahMuatPertama) { sudahMuatPertama = true; muat(); } });
})();
