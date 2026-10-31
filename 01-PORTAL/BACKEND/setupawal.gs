function langkah1_DryRun() {
  Logger.log(JSON.stringify(
    migrasiAbsensiKeRosterV2_(true),
    null,
    2
  ));
}
function langkah2_MigrasiSungguhan() {
  Logger.log(JSON.stringify(
    migrasiAbsensiKeRosterV2_(false),
    null,
    2
  ));
}
function langkah3_Validasi() {
  Logger.log(JSON.stringify(
    validasiIntegritasRosterV2_(),
    null,
    2
  ));
}
function langkah4_BuatRosterOperasionalAktif() {
  getKalenderRows_()
    .filter(k => k.STATUS === 'AKTIF')
    .forEach(k => {
      Logger.log(
        k.ID_OPERASIONAL + ': ' +
        JSON.stringify(
          buatRosterUntukOperasional_(
            k.ID_OPERASIONAL,
            'SETUP_AWAL'
          )
        )
      );
    });
}
function siapkanTarifPeriodeAktif() {
  const periodeAktif = sheetToObjects(getPeriodeSheet())
    .filter(p => p.STATUS === 'AKTIF');
  periodeAktif.forEach(p => {
    Logger.log(
      p.ID_PERIODE + ': ' +
      JSON.stringify(
        siapkanMasterTarifUntukPeriode_(
          p.ID_PERIODE,
          'SETUP_AWAL'
        )
      )
    );
  });
}
