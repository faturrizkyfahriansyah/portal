// SPPG JEUNGJING — ADMIN: Rekap Mingguan (SIPRES). REVISI 5 Nov 2026 (Admin): HANYA mingguan — pilih TANGGAL MULAI, otomatis 7 hari, langsung termuat
// (tanpa tombol Tampilkan, tanpa "sampai"); filter Divisi / Relawan / Status; ringkasan chip kecil; tanpa keterangan panjang. Tanpa periode. Penggajian mingguan: tarif harian (Master Tarif, berlaku mulai tanggal tertentu) × hari hadir.
// REVISI 4 Nov 2026 (permintaan Admin): tampilan MATRIKS seperti rekap Excel Anda -- nama, divisi, rekening, lalu kolom HARI (Sen..Min + tanggal)
// berwarna menurut kehadiran, lalu Hari Kerja, Tarif/Hari, Total Insentif. Tanpa pita per divisi. Ekspor = Excel asli (.xlsx), bukan CSV.
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

  const akhirMinggu = function (mulai) { return geserHari(mulai, 6); };
  function baris_() {
    if (!hasilTerakhir) return [];
    const dv = $('rmgDivisi').value, id = $('rmgRelawan').value, st = $('rmgStatus').value;
    return hasilTerakhir.data.filter(function (r) {
      if (dv && r.divisi !== dv) return false;
      if (id && String(r.id) !== id) return false;
      if (st) {   // status: relawan yang punya minimal satu hari berstatus itu (angka agregat dari server; Cuti dari data harian)
        const n = { H: (Number(r.hadir) || 0) + (Number(r.terlambat) || 0), T: Number(r.terlambat) || 0, I: Number(r.izin) || 0, S: Number(r.sakit) || 0, A: Number(r.tidakHadir) || 0, C: Object.keys(r.harian || {}).filter(function (k) { return r.harian[k] === 'C'; }).length };
        if (!(n[st] > 0)) return false;
      }
      return true;
    });
  }
  function isiFilterDivisi() {
    const sel = $('rmgDivisi'), pilih = sel.value;
    const unik = Array.from(new Set(hasilTerakhir.data.map(function (r) { return r.divisi; }).filter(Boolean))).sort();
    sel.innerHTML = '<option value="">Semua Divisi</option>' + unik.map(function (d) { return '<option value="' + esc(d) + '">' + esc(d) + '</option>'; }).join('');
    if (unik.indexOf(pilih) >= 0) sel.value = pilih;
    isiFilterRelawan();
  }
  /** Daftar relawan mengikuti pilihan divisi; pilihan nama dipertahankan bila masih ada. */
  function isiFilterRelawan() {
    const sel = $('rmgRelawan'), pilih = sel.value, dv = $('rmgDivisi').value;
    const daftar = hasilTerakhir.data.filter(function (r) { return !dv || r.divisi === dv; }).slice().sort(function (a, b) { return String(a.namaRelawan).localeCompare(String(b.namaRelawan)); });
    sel.innerHTML = '<option value="">Semua Relawan</option>' + daftar.map(function (r) { return '<option value="' + esc(r.id) + '">' + esc(r.namaRelawan) + '</option>'; }).join('');
    if (daftar.some(function (r) { return String(r.id) === pilih; })) sel.value = pilih;
  }
  const jumlah = function (arr, k) { return arr.reduce(function (s, r) { return s + (Number(r[k]) || 0); }, 0); };

  const KODE = { H: ['✓', 'Hadir'], T: ['T', 'Terlambat'], I: ['I', 'Izin'], S: ['S', 'Sakit'], A: ['A', 'Alfa'], C: ['C', 'Cuti'], B: ['·', 'Belum waktunya'] };
  const NAMA_HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'], BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const urutanDivisi = function (a, b) { return String(a.divisi).localeCompare(String(b.divisi)) || String(a.namaRelawan).localeCompare(String(b.namaRelawan)); };
  /** Daftar kolom hari: dari backend (dengan status kalender) atau, bila kosong, dari rentang (maks 93 hari). */
  function daftarHari() {
    const h = hasilTerakhir.hari || [];
    if (h.length) return h.map(function (x) { return { tanggal: x.tanggal, nama: NAMA_HARI[dari(x.tanggal).getDay()], status: x.status }; });
    const a = hasilTerakhir.tanggalAwal, b = hasilTerakhir.tanggalAkhir;
    if (selisihHari(a, b) + 1 > 93) return [];
    const out = []; for (let t = a; t <= b; t = geserHari(t, 1)) out.push({ tanggal: t, nama: NAMA_HARI[dari(t).getDay()], status: '' });
    return out;
  }
  const tglPendek = function (iso) { const d = dari(iso); return d.getDate() + ' ' + BULAN[d.getMonth()]; };
  const tarifTeks = function (r) { return r.tarifBervariasi ? 'bervariasi' : (r.tarifHarian === null ? 'Belum diatur' : rupiah(r.tarifHarian)); };

  function render() {
    if (!hasilTerakhir) return;
    const semua = hasilTerakhir.data, baris = baris_().slice().sort(urutanDivisi), tbody = $('tbodyRekapMingguan'), thead = $('theadRekapMingguan'), hari = daftarHari();
    // Ringkasan = chip kecil, dihitung dari baris yang TAMPIL (ikut filter); Hadir = hadir + terlambat (hari dibayar).
    const hitungCuti = baris.reduce(function (s, r) { return s + Object.keys(r.harian || {}).filter(function (k) { return r.harian[k] === 'C'; }).length; }, 0);
    const f = function (n) { return Number(n || 0).toLocaleString('id-ID'); };
    $('rmgTotalInsentif').textContent = rupiah(jumlah(baris, 'totalInsentif'));
    $('rmgTotalHadir').textContent = f(jumlah(baris, 'hadir') + jumlah(baris, 'terlambat')); $('rmgTotalTerlambat').textContent = f(jumlah(baris, 'terlambat')); $('rmgTotalIzin').textContent = f(jumlah(baris, 'izin'));
    $('rmgTotalSakit').textContent = f(jumlah(baris, 'sakit')); $('rmgTotalAlfa').textContent = f(jumlah(baris, 'tidakHadir')); $('rmgTotalCuti').textContent = f(hitungCuti);
    $('tabelRekapMingguan').classList.toggle('rmg-rapat', hari.length > 14);
    const kolomTotal = 4 + hari.length + 4;
    thead.innerHTML = '<tr><th>No</th><th style="text-align:left;">Nama</th><th>Divisi</th><th>No. Rekening</th>' + hari.map(function (h) {
      const libur = h.status === 'LIBUR', ini = h.tanggal === hasilTerakhir.hariIni;
      return '<th class="' + (libur ? 'rmg-libur ' : '') + (ini ? 'rmg-ini' : '') + '" title="' + esc(h.tanggal.split('-').reverse().join('/') + (libur ? ' · Libur' : (h.status === 'OPERASIONAL_KHUSUS' ? ' · Operasional khusus' : ''))) + '">' + h.nama + '<small>' + tglPendek(h.tanggal) + '</small></th>';
    }).join('') + '<th>Hadir</th><th>Hari<br>Kerja</th><th>Tarif<br>/Hari</th><th>Total<br>Insentif</th></tr>';
    if (!baris.length) { tbody.innerHTML = '<tr><td colspan="' + kolomTotal + '"><div class="empty-state">Tidak ada data presensi pada rentang ini.</div></td></tr>'; return; }
    let html = '', no = 0, divisiSebelum = null;
    baris.forEach(function (r) {
      no++;
      const awalDivisi = divisiSebelum !== null && r.divisi !== divisiSebelum; divisiSebelum = r.divisi;
      const peringatan = (!r.tarifLengkap && r.tarifHarian !== null) ? ' <span style="color:#c0392b;" title="Ada hari dibayar tanpa tarif">(!)</span>' : '';
      html += '<tr' + (awalDivisi ? ' class="rmg-awal-divisi"' : '') + '><td class="rmg-tengah">' + no + '</td><td class="rmg-nama">' + esc(r.namaRelawan) + '</td><td class="rmg-div">' + esc(r.divisi) + '</td><td class="rmg-rek">' + esc(r.nomorRekening || '—') + '</td>' +
        hari.map(function (h) {
          const k = (r.harian || {})[h.tanggal] || '', libur = h.status === 'LIBUR';
          return '<td class="rmg-hari ' + (k ? 'rmg-' + k : (libur ? 'rmg-libur' : '')) + '"' + (k ? ' title="' + esc(KODE[k][1] + ' · ' + h.tanggal.split('-').reverse().join('/')) + '"' : '') + '>' + (k ? KODE[k][0] : '') + '</td>';
        }).join('') +
        '<td class="rmg-tengah"><b>' + ((Number(r.hadir) || 0) + (Number(r.terlambat) || 0)) + '</b></td><td class="rmg-tengah">' + r.totalHariKerja + '</td><td class="rmg-angka">' + (r.tarifHarian === null && !r.tarifBervariasi ? '<span style="color:#c0392b;">Belum diatur</span>' : (r.tarifBervariasi ? '<span title="Tarif berganti di tengah rentang">bervariasi</span>' : rupiah(r.tarifHarian))) + peringatan + '</td><td class="rmg-angka"><b>' + rupiah(r.totalInsentif) + '</b></td></tr>';
    });
    const hadirPerHari = hari.map(function (h) { return baris.filter(function (r) { const k = (r.harian || {})[h.tanggal]; return k === 'H' || k === 'T'; }).length; });
    html += '<tr class="rmg-jumlah"><td colspan="4" style="text-align:right;">Hadir per hari</td>' + hadirPerHari.map(function (n, i) { return '<td class="rmg-hari ' + (hari[i].status === 'LIBUR' ? 'rmg-libur' : '') + '">' + (n || '') + '</td>'; }).join('') + '<td colspan="4"></td></tr>';
    html += '<tr class="rmg-total"><td colspan="4" style="text-align:right;">TOTAL' + ($('rmgDivisi').value ? ' ' + esc($('rmgDivisi').value) : '') + '</td>' + hari.map(function () { return '<td></td>'; }).join('') + '<td class="rmg-tengah">' + (jumlah(baris, 'hadir') + jumlah(baris, 'terlambat')) + '</td><td class="rmg-tengah">' + jumlah(baris, 'totalHariKerja') + '</td><td></td><td class="rmg-angka">' + rupiah(jumlah(baris, 'totalInsentif')) + '</td></tr>';
    tbody.innerHTML = html;
  }

  let urutMuat = 0;
  async function muat() {
    const awal = $('rmgAwal').value, tbody = $('tbodyRekapMingguan'); if (!awal) return;
    const giliran = ++urutMuat;
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state">Memuat…</div></td></tr>';
    try {
      const hasil = await apiPost('getRekapMingguanAdmin', { token: ambilSesiAdmin().token, tanggalAwal: awal, tanggalAkhir: akhirMinggu(awal) });
      if (giliran !== urutMuat) return;      // jawaban lama tidak boleh menimpa pilihan tanggal terbaru
      hasilTerakhir = hasil; isiFilterDivisi(); render();
    } catch (err) {
      if (giliran !== urutMuat) return;
      hasilTerakhir = null;
      tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state" style="color:#c0392b;">' + esc(err.message || 'Gagal memuat rekap.') + '</div></td></tr>';
    }
  }

  /** Ekspor Excel asli (.xlsx): format sama dengan tampilan (matriks hari berwarna), tambah kolom hitungan H/T/I/S/A dan baris total. */
  function exportExcel() {
    const baris = baris_().slice().sort(urutanDivisi), hari = hasilTerakhir ? daftarHari() : [];
    if (!baris.length) { alert('Belum ada data untuk diekspor.'); return; }
    const WARNA = { H: ['C8E6C9', '1B5E20'], T: ['FFE0B2', 'E65100'], I: ['BBDEFB', '0D47A1'], S: ['E1BEE7', '6A1B9A'], C: ['B2DFDB', '004D40'], A: ['FFCDD2', 'B71C1C'] };
    const kep = { f: 'bw', fl: '1F3864', b: 1, h: 'center', w: 1 }, kepLibur = { f: 'bw', fl: '7F8794', b: 1, h: 'center', w: 1 }, teks = { b: 1 }, angka = { b: 1, h: 'center' }, rp = { b: 1, n: 'rp' }, tebalRp = { b: 1, f: 'b', fl: 'E8EDF5', n: 'rp' };
    const nKol = 4 + hari.length + 5 + 4, judul = 'REKAP MINGGUAN  ' + tglIndo(hasilTerakhir.tanggalAwal) + ' s.d. ' + tglIndo(hasilTerakhir.tanggalAkhir) + ($('rmgDivisi').value ? '  ·  ' + $('rmgDivisi').value : '');
    const header = [{ v: 'NO', s: kep }, { v: 'NAMA', s: kep }, { v: 'DIVISI', s: kep }, { v: 'NO. REKENING', s: kep }]
      .concat(hari.map(function (h) { return { v: h.nama + '\n' + tglIndo(h.tanggal).slice(0, 5), s: h.status === 'LIBUR' ? kepLibur : kep }; }))
      .concat(['H', 'T', 'I', 'S', 'A', 'HADIR', 'HARI KERJA', 'TARIF / HARI', 'TOTAL INSENTIF'].map(function (x) { return { v: x, s: kep }; }));
    const isi = baris.map(function (r, i) {
      const sel = [{ v: i + 1, s: { b: 1, h: 'center' } }, { v: r.namaRelawan, s: teks }, { v: r.divisi, s: teks }, { v: r.nomorRekening ? String(r.nomorRekening) : '', s: teks }];
      hari.forEach(function (h) {
        const k = (r.harian || {})[h.tanggal] || '', w = WARNA[k];
        sel.push({ v: k === 'H' ? '✓' : (k === 'B' ? '·' : k), s: w ? { b: 1, fl: w[0], tw: w[1], f: 'b', h: 'center' } : { b: 1, h: 'center', fl: h.status === 'LIBUR' ? 'E6E8EC' : null } });
      });
      [r.hadir, r.terlambat, r.izin, r.sakit, r.tidakHadir, (Number(r.hadir) || 0) + (Number(r.terlambat) || 0), r.totalHariKerja].forEach(function (n) { sel.push({ v: n, s: angka }); });
      sel.push({ v: r.tarifBervariasi ? 'bervariasi' : (r.tarifHarian === null ? 'Belum diatur' : r.tarifHarian), s: r.tarifHarian === null || r.tarifBervariasi ? { b: 1, h: 'right' } : rp });
      sel.push({ v: r.totalInsentif, s: rp });
      return sel;
    });
    const t = { f: 'b', fl: 'E8EDF5', b: 1 }, hadirHari = hari.map(function (h) { return { v: baris.filter(function (r) { const k = (r.harian || {})[h.tanggal]; return k === 'H' || k === 'T'; }).length || '', s: { b: 1, f: 'b', fl: 'F3F5F9', h: 'center' } }; });
    const jumlahKol = function (k) { return { v: jumlah(baris, k), s: { b: 1, f: 'b', fl: 'E8EDF5', h: 'center' } }; };
    const barisTotal = [{ v: 'TOTAL', s: t }, { v: '', s: t }, { v: '', s: t }, { v: '', s: t }].concat(hari.map(function () { return { v: '', s: t }; })).concat([jumlahKol('hadir'), jumlahKol('terlambat'), jumlahKol('izin'), jumlahKol('sakit'), jumlahKol('tidakHadir'), { v: jumlah(baris, 'hadir') + jumlah(baris, 'terlambat'), s: { b: 1, f: 'b', fl: 'E8EDF5', h: 'center' } }, jumlahKol('totalHariKerja'), { v: '', s: t }, { v: jumlah(baris, 'totalInsentif'), s: tebalRp }]);
    const barisHadir = [{ v: 'Hadir per hari', s: { f: 'b', fl: 'F3F5F9', b: 1 } }, { v: '', s: { fl: 'F3F5F9', b: 1 } }, { v: '', s: { fl: 'F3F5F9', b: 1 } }, { v: '', s: { fl: 'F3F5F9', b: 1 } }].concat(hadirHari);
    const keterangan = [[], [{ v: 'Keterangan: ✓ Hadir · T Terlambat · I Izin · S Sakit · A Alfa · C Cuti · · Belum waktunya · abu-abu = Libur. H/T/I/S/A = jumlah hari. Dibayar = Hadir + Terlambat.', s: { f: 'i' } }]];
    const kolom = [5, 30, 20, 16].concat(hari.map(function () { return hari.length > 14 ? 5.5 : 7.5; })).concat([5, 5, 5, 5, 5, 8, 11, 14, 17]);
    const awalData = 3, akhirData = awalData + isi.length - 1;
    Xlsx.unduh('rekap-mingguan-' + hasilTerakhir.tanggalAwal + '-sd-' + hasilTerakhir.tanggalAkhir + '.xlsx', { lembar: [{ nama: 'Rekap Mingguan', kolom: kolom, tinggiBaris: { 1: 24, 2: 34 }, bekuBaris: 2, bekuKolom: 4,
      gabung: ['A1:' + Xlsx.kolomHuruf(Math.min(nKol - 1, 12)) + '1'], filter: 'A2:' + Xlsx.kolomHuruf(nKol - 1) + akhirData,
      baris: [[{ v: judul, s: { f: 'b', z: 14 } }], header].concat(isi, [barisHadir, barisTotal], keterangan) }] });
  }

  $('rmgAwal').value = seninMingguIni();
  $('rmgAwal').addEventListener('change', muat);                       // pilih tanggal mulai = langsung tampil (7 hari)
  $('rmgDivisi').addEventListener('change', function () { if (hasilTerakhir) { isiFilterRelawan(); render(); } });
  $('rmgRelawan').addEventListener('change', function () { if (hasilTerakhir) render(); });
  $('rmgStatus').addEventListener('change', function () { if (hasilTerakhir) render(); });
  $('btnExportRekapMingguan').addEventListener('click', exportExcel);
  $('btnTampilkanRekap').addEventListener('click', function () { sudahMuatPertama = true; muat(); });   // manual / coba lagi
  const tombolMenu = document.querySelector('[data-panel="panelRekapMingguan"]');
  if (tombolMenu) tombolMenu.addEventListener('click', function () { if (!sudahMuatPertama) { sudahMuatPertama = true; muat(); } });
})();
