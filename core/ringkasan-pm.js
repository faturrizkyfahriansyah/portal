// SPPG JEUNGJING — Tampilan "Penerima Manfaat Hari Ini" (BARU 2 Nov 2026)
// Dipakai BERSAMA oleh Dashboard Relawan (dashboard.js) dan Dashboard Pengelola (admin.js)
// supaya tampilannya sama persis dan meniru website publik: jumlah total, rincian
// PK / PB / 3B (3B dirinci Balita, Ibu Menyusui, Ibu Hamil), dan tombol "Lihat detail"
// yang menampilkan nama instansi beserta rincian jumlahnya.
//
// Data: respons getRingkasanPmDashboard. Bila backend lama belum menyediakan rincian 3B
// (totalBalita/totalBusui/totalBumil tidak ada), tampilan otomatis ringkas (PK/PB/3B saja)
// dan tidak error -- urutan deploy frontend/backend tidak menjadi masalah.
function isiRingkasanPm(el, pm) {
  const f = function (n) { return Number(n || 0).toLocaleString('id-ID'); };
  const esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  const C = { muted: 'var(--color-text-muted,#55606f)', garis: 'var(--color-border,#e8ebef)', sukses: 'var(--color-success,#2e7d32)', navy: 'var(--color-navy,#1f3864)', latar: 'var(--color-surface,#f6f8fb)' };
  const rinci = pm.totalBalita !== undefined && pm.totalBusui !== undefined && pm.totalBumil !== undefined;
  const total = (pm.totalPK || 0) + (pm.totalPB || 0) + (pm.total3B || 0);
  const daftar = Array.isArray(pm.pmHariIni) ? pm.pmHariIni : [];
  const libur = Array.isArray(pm.pmLibur) ? pm.pmLibur : [];
  const uid = 'rpm' + Math.random().toString(36).slice(2, 8);

  const kotak = function (angka, label, warna) {
    return '<div style="flex:1;min-width:0;text-align:center;padding:10px 4px;background:' + C.latar + ';border-radius:10px;">' +
      '<div style="font-size:18px;font-weight:800;color:' + (warna || C.navy) + ';">' + f(angka) + '</div>' +
      '<div style="font-size:11px;color:' + C.muted + ';margin-top:2px;">' + label + '</div></div>';
  };

  let html =
    '<div style="text-align:center;margin-bottom:12px;">' +
      '<div style="font-size:30px;font-weight:800;color:' + C.sukses + ';line-height:1;">' + f(total) + '</div>' +
      '<div style="font-size:12px;color:' + C.muted + ';margin-top:4px;font-weight:600;">Total Porsi PM Hari Ini</div>' +
      '<div style="font-size:11px;color:' + C.muted + ';margin-top:6px;">' + f(pm.jumlahPmHariIni) + ' institusi aktif · ' + f(pm.jumlahPmLibur) + ' libur</div>' +
      (pm.belumAdaData ? '<div style="font-size:11.5px;color:#c0392b;margin-top:6px;font-weight:600;">Belum ada data PM harian yang terverifikasi.</div>' : (pm.bukanHariIni && pm.tanggalData ? '<div style="font-size:11.5px;color:#e65100;margin-top:6px;font-weight:600;">Data PM harian terakhir: ' + esc(pm.tanggalData.split('-').reverse().join('/')) + ' (hari ini belum diisi)</div>' : '')) +
    '</div>' +
    '<div style="display:flex;gap:8px;border-top:1px solid ' + C.garis + ';padding-top:12px;">' +
      kotak(pm.totalPK, 'PK (Porsi Kecil)') + kotak(pm.totalPB, 'PB (Porsi Besar)') + kotak(pm.total3B, '3B') +
    '</div>';

  if (rinci) {
    html += '<div style="display:flex;gap:8px;margin-top:8px;">' +
      kotak(pm.totalBalita, 'Balita', C.muted) + kotak(pm.totalBusui, 'Ibu Menyusui', C.muted) + kotak(pm.totalBumil, 'Ibu Hamil', C.muted) +
    '</div><div style="font-size:11px;color:' + C.muted + ';text-align:center;margin-top:4px;">3B = Balita + Ibu Menyusui + Ibu Hamil</div>';
  }

  // ---- Tabel detail per instansi ----
  const th = function (t, kiri) { return '<th style="padding:8px 6px;text-align:' + (kiri ? 'left' : 'right') + ';font-weight:700;white-space:nowrap;border-bottom:1px solid ' + C.garis + ';">' + t + '</th>'; };
  const td = function (t, kiri, tebal) { return '<td style="padding:7px 6px;text-align:' + (kiri ? 'left' : 'right') + ';' + (tebal ? 'font-weight:700;' : '') + 'border-bottom:1px solid ' + C.garis + ';">' + t + '</td>'; };
  let kepala = th('Instansi', true) + th('PK') + th('PB');
  kepala += rinci ? th('Balita') + th('Busui') + th('Bumil') : th('3B');
  kepala += th('Total');
  const baris = daftar.map(function (p) {
    let b = td(esc(p.NAMA_PM), true) + td(f(p.PK)) + td(f(p.PB));
    b += rinci ? td(f(p.BALITA)) + td(f(p.BUSUI)) + td(f(p.BUMIL)) : td(f(p.TIGA_B));
    return '<tr>' + b + td(f(p.JUMLAH), false, true) + '</tr>';
  }).join('');
  let jumlahBaris = td('<b>Jumlah</b>', true) + td('<b>' + f(pm.totalPK) + '</b>') + td('<b>' + f(pm.totalPB) + '</b>');
  jumlahBaris += rinci ? td('<b>' + f(pm.totalBalita) + '</b>') + td('<b>' + f(pm.totalBusui) + '</b>') + td('<b>' + f(pm.totalBumil) + '</b>') : td('<b>' + f(pm.total3B) + '</b>');
  jumlahBaris += td('<b>' + f(total) + '</b>');

  html +=
    '<button type="button" id="' + uid + 'Btn" aria-expanded="false" style="width:100%;margin-top:14px;padding:9px;border:1px solid ' + C.garis + ';background:transparent;border-radius:10px;font-weight:600;cursor:pointer;color:inherit;">Lihat detail per instansi ▾</button>' +
    '<div id="' + uid + 'Isi" style="display:none;margin-top:12px;">' +
      (daftar.length
        ? '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:12px;min-width:' + (rinci ? 420 : 340) + 'px;"><thead><tr>' + kepala + '</tr></thead><tbody>' + baris + '<tr style="background:' + C.latar + ';">' + jumlahBaris + '</tr></tbody></table></div>'
        : '<p style="margin:0;font-size:12.5px;color:' + C.muted + ';">Belum ada instansi aktif hari ini.</p>') +
      (libur.length ? '<p style="font-size:11.5px;color:' + C.muted + ';margin:10px 0 0;"><b>Libur hari ini:</b> ' + libur.map(function (p) { return esc(p.NAMA_PM); }).join(', ') + '</p>' : '') +
    '</div>';

  el.innerHTML = html;
  const btn = document.getElementById(uid + 'Btn'), isi = document.getElementById(uid + 'Isi');
  btn.addEventListener('click', function () {
    const buka = isi.style.display === 'none';
    isi.style.display = buka ? 'block' : 'none';
    btn.setAttribute('aria-expanded', String(buka));
    btn.textContent = buka ? 'Sembunyikan detail ▴' : 'Lihat detail per instansi ▾';
  });
}
