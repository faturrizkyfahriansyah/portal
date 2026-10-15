// SPPG JEUNGJING — MONITORING (ASN & Kepala SPPG)
// Backend (Role.gs -> requireRole_) yang menentukan boleh/tidaknya akses,
// bukan halaman ini -- kalau role bukan ASN/KEPALA_SPPG, panggilan API
// pertama akan gagal dan halaman menampilkan pesan "Akses Ditolak".

document.addEventListener('DOMContentLoaded', async () => {
  const sesi = ambilSesiRelawan();
  if (!sesi || !sesi.token) {
    window.location.href = 'login.html';
    return;
  }
  const token = sesi.token;

  const el = {
    ditolak: document.getElementById('monitoringAksesDitolak'),
    konten: document.getElementById('monitoringKontenUtama'),
    monTotalRelawan: document.getElementById('monTotalRelawan'),
    monSudahAbsen: document.getElementById('monSudahAbsen'),
    monBelumAbsen: document.getElementById('monBelumAbsen'),
    monitoringStokWrap: document.getElementById('monitoringStokWrap'),
    monitoringStokKosong: document.getElementById('monitoringStokKosong'),
    monStokTotal: document.getElementById('monStokTotal'),
    monStokAman: document.getElementById('monStokAman'),
    monStokMenipis: document.getElementById('monStokMenipis'),
    monStokHabis: document.getElementById('monStokHabis'),
    monitoringSipanduWrap: document.getElementById('monitoringSipanduWrap'),
    monitoringSipanduKosong: document.getElementById('monitoringSipanduKosong'),
    monSipanduTotal: document.getElementById('monSipanduTotal'),
    monSipanduDraft: document.getElementById('monSipanduDraft'),
    monSipanduReady: document.getElementById('monSipanduReady'),
    monSipanduSelesai: document.getElementById('monSipanduSelesai'),
    monitoringPmWrap: document.getElementById('monitoringPmWrap'),
    monitoringPmKosong: document.getElementById('monitoringPmKosong'),
    monPmTanggal: document.getElementById('monPmTanggal'),
    monPmHariIni: document.getElementById('monPmHariIni'),
    monPmLibur: document.getElementById('monPmLibur'),
    monPmPK: document.getElementById('monPmPK'),
    monPmPB: document.getElementById('monPmPB'),
    monPm3B: document.getElementById('monPm3B'),
    monPmTotal: document.getElementById('monPmTotal'),
    monitoringMenuWrap: document.getElementById('monitoringMenuWrap'),
    monitoringMenuKosong: document.getElementById('monitoringMenuKosong'),
    monMenuHariTgl: document.getElementById('monMenuHariTgl'),
    monMenuTema: document.getElementById('monMenuTema'),
    monMenuKarbohidrat: document.getElementById('monMenuKarbohidrat'),
    monMenuLaukHewani: document.getElementById('monMenuLaukHewani'),
    monMenuLaukNabati: document.getElementById('monMenuLaukNabati'),
    monMenuSayur: document.getElementById('monMenuSayur'),
    monMenuBuah: document.getElementById('monMenuBuah'),
    monMenuPelengkap: document.getElementById('monMenuPelengkap')
  };

  try {
    showLoading('Memuat ringkasan...');
    const d = await apiGet('getRingkasanMonitoring', { token });
    hideLoading();

    el.monTotalRelawan.textContent = d.totalRelawanAktif;
    el.monSudahAbsen.textContent = d.sudahAbsenHariIni;
    el.monBelumAbsen.textContent = d.belumAbsenHariIni;

    if (d.stok) {
      el.monStokTotal.textContent = d.stok.totalJenisBarang;
      el.monStokAman.textContent = d.stok.aman;
      el.monStokMenipis.textContent = d.stok.menipis;
      el.monStokHabis.textContent = d.stok.habis;
    } else {
      el.monitoringStokWrap.style.display = 'none';
      el.monitoringStokKosong.style.display = 'block';
    }

    if (d.sipandu) {
      el.monSipanduTotal.textContent = d.sipandu.totalWorkOrder;
      el.monSipanduDraft.textContent = d.sipandu.perStatus.DRAFT;
      el.monSipanduReady.textContent = d.sipandu.perStatus.READY;
      el.monSipanduSelesai.textContent = d.sipandu.perStatus.COMPLETED;
    } else {
      el.monitoringSipanduWrap.style.display = 'none';
      el.monitoringSipanduKosong.style.display = 'block';
    }

    // Rincian Menu Hari Ini -- dibaca langsung dari spreadsheet siklus
    // menu eksternal (SiklusMenu.gs). null kalau sheet belum bisa
    // diakses ATAU hari ini memang tidak ada di jadwal siklus.
    if (d.menuHariIni) {
      const m = d.menuHariIni;
      el.monMenuHariTgl.textContent = m.hari + ', ' + m.tanggal;
      el.monMenuTema.textContent = m.tema ? ('Tema: ' + m.tema) : '';
      el.monMenuKarbohidrat.textContent = m.karbohidrat || '-';
      el.monMenuLaukHewani.textContent = m.laukHewani || '-';
      el.monMenuLaukNabati.textContent = m.laukNabati || '-';
      el.monMenuSayur.textContent = m.sayur || '-';
      el.monMenuBuah.textContent = m.buah || '-';
      el.monMenuPelengkap.textContent = m.pelengkap || '-';
    } else {
      el.monitoringMenuWrap.style.display = 'none';
      el.monitoringMenuKosong.style.display = 'block';
    }

    // Ringkasan Penerima Manfaat (SIPENDOK, via panggilSipendok_ yg sudah
    // ada) -- null kalau SIPENDOK tidak bisa dihubungi, pola SAMA dgn
    // Stok & SIPANDU di atas.
    if (d.penerimaManfaat) {
      const pm = d.penerimaManfaat;
      el.monPmTanggal.textContent = pm.tanggalIndo;
      el.monPmHariIni.textContent = pm.jumlahPmHariIni;
      el.monPmLibur.textContent = pm.jumlahPmLibur;
      el.monPmPK.textContent = pm.totalPK;
      el.monPmPB.textContent = pm.totalPB;
      el.monPm3B.textContent = pm.total3B;
      el.monPmTotal.textContent = pm.totalJumlah;
    } else {
      el.monitoringPmWrap.style.display = 'none';
      el.monitoringPmKosong.style.display = 'block';
    }

    el.konten.style.display = 'block';
  } catch (err) {
    hideLoading();
    el.ditolak.style.display = 'block';
  }
});
