# CHANGELOG — SIPRES Roster-First + Master Tarif + Pengajuan Ketidakhadiran

## [Unreleased] — 2026-09-21/22

### Added — Roster-First Attendance (paralel, opt-in)
- `Roster.gs`, `AbsensiV2.gs`, `MigrasiRosterV2.gs`, `RekapV2.gs`
- Sheet baru `03_DATA_ABSENSI_V2`
- Hook otomatis pembuatan roster di Kalender.gs/Shift.gs

### Added — Master Tarif & Fondasi Penggajian (backend/database saja, TANPA UI)
- `MasterTarif.gs` — sheet baru `31_MASTER_TARIF`
- Hook auto-populate saat periode dibuat (Periode.gs: `addPeriode`)
- `getRekapPenggajian_` — reuse `getRekapDuaMinggu` existing, digabung dengan tarif

### Added — Pengajuan Ketidakhadiran (alur persetujuan BARU)
- `PengajuanKetidakhadiran.gs` — sheet baru `32_PENGAJUAN_KETIDAKHADIRAN`
- Alur MENUNGGU → DISETUJUI/DITOLAK/DIBATALKAN
- Saat DISETUJUI: memperbarui STATUS_KEHADIRAN di roster V2 (03_DATA_ABSENSI_V2) untuk setiap tanggal dalam rentang
- Upload dokumen pendukung (gambar/PDF) ke Drive
- Notifikasi ke relawan saat diproses
- **BEDA dari `ajukanIzinSakit()` lama** (Absensi.gs) — fungsi lama TIDAK dihapus/diubah, tapi tidak lagi dipakai alur baru ini

### Unchanged (dipertahankan penuh)
- `Absensi.gs` (submitAbsensi, getRekapHarian, dst — versi lama)
- Seluruh UI relawan/Admin existing — endpoint baru belum dipasang ke UI

Lihat `SIPRES_SPPG_JEUNGJING_AUDIT_TEST_DEPLOY.md` untuk detail lengkap.
