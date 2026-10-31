const DATA_IMPOR_BAHAN = [
  {nama:"Beras ketan hitam", bentuk:"Pokok", takaranG:100.0, energiKkal:360.0, proteinG:8.0, lemakG:2.3, karbohidratG:74.5, seratG:1.0, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (median 4 baris, dinormalkan ke 100 g)"},
  {nama:"Kentang", bentuk:"Pokok", takaranG:100.0, energiKkal:77.0, proteinG:2.02, lemakG:0.099, karbohidratG:17.47, seratG:2.2, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (kentang wedges)"},
  {nama:"Kulit dimsum", bentuk:"Pokok", takaranG:100.0, energiKkal:291.0, proteinG:9.3, lemakG:1.5, karbohidratG:57.9, seratG:0.0, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (median 2 baris, dinormalkan ke 100 g)"},
  {nama:"Nasi putih", bentuk:"Pokok", takaranG:100.0, energiKkal:180.0, proteinG:2.98, lemakG:0.293, karbohidratG:39.78, seratG:0.18, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (median 76 baris, dinormalkan ke 100 g)"},
  {nama:"Roti bun", bentuk:"Pokok", takaranG:100.0, energiKkal:277.778, proteinG:11.111, lemakG:2.778, karbohidratG:51.852, seratG:1.852, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (median 2 baris, dinormalkan ke 100 g)"},
  {nama:"Roti tawar", bentuk:"Pokok", takaranG:1.0, energiKkal:100.0, proteinG:3.5, lemakG:1.5, karbohidratG:18.5, seratG:0.6, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (nilai per lembar)"},
  {nama:"Spaghetti (kering)", bentuk:"Pokok", takaranG:100.0, energiKkal:371.0, proteinG:13.0, lemakG:1.5, karbohidratG:74.7, seratG:3.2, sumberCatatan:"Perkiraan umum (bukan dari file Anda); verifikasi ke TKPI"},
  {nama:"Ayam (bagian tulang)", bentuk:"Hewani", takaranG:100.0, energiKkal:245.0, proteinG:24.85, lemakG:15.36, karbohidratG:0.0, seratG:0.0, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (median 33 baris, dinormalkan ke 100 g)"},
  {nama:"Ayam fillet (dada)", bentuk:"Hewani", takaranG:100.0, energiKkal:195.0, proteinG:29.543, lemakG:7.72, karbohidratG:0.0, seratG:0.0, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (median 21 baris, dinormalkan ke 100 g)"},
  {nama:"Daging sapi", bentuk:"Hewani", takaranG:100.0, energiKkal:288.0, proteinG:26.267, lemakG:19.45, karbohidratG:0.0, seratG:0.0, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (median 12 baris, dinormalkan ke 100 g)"},
  {nama:"Ikan lele", bentuk:"Hewani", takaranG:100.0, energiKkal:105.0, proteinG:18.4, lemakG:1.6, karbohidratG:0.0, seratG:0.0, sumberCatatan:"PDF Kandungan Gizi JJ (baris menu terdahulu), dinormalkan ke 100 g"},
  {nama:"Ikan nila", bentuk:"Hewani", takaranG:100.0, energiKkal:96.0, proteinG:20.1, lemakG:1.7, karbohidratG:0.0, seratG:0.0, sumberCatatan:"Perkiraan umum (bukan dari file Anda); verifikasi ke TKPI"},
  {nama:"Telur ayam", bentuk:"Hewani", takaranG:100.0, energiKkal:154.0, proteinG:12.364, lemakG:10.727, karbohidratG:0.727, seratG:0.0, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (median 20 baris, dinormalkan ke 100 g)"},
  {nama:"Telur puyuh", bentuk:"Hewani", takaranG:100.0, energiKkal:116.0, proteinG:10.7, lemakG:7.0, karbohidratG:1.6, seratG:0.0, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (median 2 baris, dinormalkan ke 100 g)"},
  {nama:"Kacang hijau", bentuk:"Nabati", takaranG:100.0, energiKkal:323.0, proteinG:22.9, lemakG:1.5, karbohidratG:56.8, seratG:7.8, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (median 4 baris, dinormalkan ke 100 g)"},
  {nama:"Tahu", bentuk:"Nabati", takaranG:100.0, energiKkal:80.0, proteinG:10.95, lemakG:4.6, karbohidratG:0.9, seratG:0.05, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (median 32 baris, dinormalkan ke 100 g)"},
  {nama:"Tempe", bentuk:"Nabati", takaranG:100.0, energiKkal:201.0, proteinG:20.75, lemakG:8.75, karbohidratG:13.5, seratG:1.4, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (median 34 baris, dinormalkan ke 100 g)"},
  {nama:"Baby corn", bentuk:"Sayur", takaranG:100.0, energiKkal:35.0, proteinG:2.2, lemakG:0.1, karbohidratG:7.4, seratG:1.883, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (median 2 baris, dinormalkan ke 100 g)"},
  {nama:"Bayam", bentuk:"Sayur", takaranG:100.0, energiKkal:23.0, proteinG:2.9, lemakG:0.4, karbohidratG:3.6, seratG:2.2, sumberCatatan:"Perkiraan umum (bukan dari file Anda); verifikasi ke TKPI"},
  {nama:"Brokoli", bentuk:"Sayur", takaranG:100.0, energiKkal:54.0, proteinG:2.3, lemakG:2.688, karbohidratG:3.98, seratG:2.6, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (median 4 baris, dinormalkan ke 100 g)"},
  {nama:"Buncis", bentuk:"Sayur", takaranG:100.0, energiKkal:34.0, proteinG:2.4, lemakG:0.3, karbohidratG:7.2, seratG:1.9, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (median 10 baris, dinormalkan ke 100 g)"},
  {nama:"Jagung pipil", bentuk:"Sayur", takaranG:100.0, energiKkal:366.0, proteinG:9.8, lemakG:7.3, karbohidratG:69.1, seratG:2.2, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (median 6 baris, dinormalkan ke 100 g)"},
  {nama:"Jamur kuping", bentuk:"Sayur", takaranG:100.0, energiKkal:2.1, proteinG:3.8, lemakG:0.6, karbohidratG:0.9, seratG:5.1, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (median 2 baris, dinormalkan ke 100 g)"},
  {nama:"Jamur tiram", bentuk:"Sayur", takaranG:100.0, energiKkal:48.0, proteinG:1.9, lemakG:3.2, karbohidratG:2.8, seratG:1.0, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (median 4 baris, dinormalkan ke 100 g)"},
  {nama:"Kacang panjang", bentuk:"Sayur", takaranG:100.0, energiKkal:46.133, proteinG:4.766, lemakG:0.46, karbohidratG:8.9, seratG:2.6, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (median 8 baris, dinormalkan ke 100 g)"},
  {nama:"Kangkung", bentuk:"Sayur", takaranG:100.0, energiKkal:19.0, proteinG:2.6, lemakG:0.2, karbohidratG:3.1, seratG:2.1, sumberCatatan:"Perkiraan umum (bukan dari file Anda); verifikasi ke TKPI"},
  {nama:"Kembang kol", bentuk:"Sayur", takaranG:100.0, energiKkal:43.827, proteinG:4.2, lemakG:0.3, karbohidratG:8.597, seratG:1.75, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (median 6 baris, dinormalkan ke 100 g)"},
  {nama:"Kol merah", bentuk:"Sayur", takaranG:100.0, energiKkal:38.633, proteinG:1.863, lemakG:0.263, karbohidratG:7.063, seratG:2.532, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (median 4 baris, dinormalkan ke 100 g)"},
  {nama:"Kubis", bentuk:"Sayur", takaranG:100.0, energiKkal:68.0, proteinG:3.327, lemakG:1.463, karbohidratG:10.653, seratG:4.532, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (median 22 baris, dinormalkan ke 100 g)"},
  {nama:"Labu siam", bentuk:"Sayur", takaranG:100.0, energiKkal:17.0, proteinG:0.8, lemakG:0.083, karbohidratG:3.883, seratG:1.683, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (median 10 baris, dinormalkan ke 100 g)"},
  {nama:"Pakcoy", bentuk:"Sayur", takaranG:100.0, energiKkal:77.0, proteinG:2.04, lemakG:5.08, karbohidratG:7.168, seratG:1.4, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (median 2 baris, dinormalkan ke 100 g)"},
  {nama:"Sawi hijau", bentuk:"Sayur", takaranG:100.0, energiKkal:13.0, proteinG:1.5, lemakG:0.2, karbohidratG:2.18, seratG:2.5, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (median 4 baris, dinormalkan ke 100 g)"},
  {nama:"Sawi putih", bentuk:"Sayur", takaranG:100.0, energiKkal:9.0, proteinG:1.0, lemakG:0.1, karbohidratG:1.7, seratG:0.8, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (median 12 baris, dinormalkan ke 100 g)"},
  {nama:"Selada", bentuk:"Sayur", takaranG:100.0, energiKkal:18.0, proteinG:1.2, lemakG:0.2, karbohidratG:2.9, seratG:18.0, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (median 14 baris, dinormalkan ke 100 g)"},
  {nama:"Tauge", bentuk:"Sayur", takaranG:100.0, energiKkal:30.0, proteinG:3.0, lemakG:0.2, karbohidratG:5.9, seratG:1.8, sumberCatatan:"Perkiraan umum (bukan dari file Anda); verifikasi ke TKPI"},
  {nama:"Timun", bentuk:"Sayur", takaranG:100.0, energiKkal:8.0, proteinG:0.2, lemakG:0.2, karbohidratG:1.3, seratG:0.35, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (median 18 baris, dinormalkan ke 100 g)"},
  {nama:"Tomat", bentuk:"Sayur", takaranG:100.0, energiKkal:18.0, proteinG:0.9, lemakG:0.2, karbohidratG:3.9, seratG:1.2, sumberCatatan:"Perkiraan umum (bukan dari file Anda); verifikasi ke TKPI"},
  {nama:"Wortel", bentuk:"Sayur", takaranG:100.0, energiKkal:36.0, proteinG:1.0, lemakG:0.6, karbohidratG:7.9, seratG:1.0, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (median 60 baris, dinormalkan ke 100 g)"},
  {nama:"Anggur", bentuk:"Buah", takaranG:100.0, energiKkal:80.0, proteinG:1.0, lemakG:0.143, karbohidratG:18.6, seratG:1.4, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (versi sheet tabel menu, 35 g = 28 kkal)"},
  {nama:"Apel Fuji", bentuk:"Buah", takaranG:100.0, energiKkal:52.0, proteinG:0.26, lemakG:0.17, karbohidratG:13.81, seratG:2.4, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (median 4 baris, dinormalkan ke 100 g)"},
  {nama:"Buah naga", bentuk:"Buah", takaranG:100.0, energiKkal:71.0, proteinG:1.7, lemakG:3.1, karbohidratG:9.1, seratG:3.2, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (median 4 baris, dinormalkan ke 100 g)"},
  {nama:"Duku", bentuk:"Buah", takaranG:100.0, energiKkal:68.0, proteinG:0.75, lemakG:0.375, karbohidratG:17.1, seratG:1.4, sumberCatatan:"PDF Kandungan Gizi JJ (baris menu terdahulu), dinormalkan ke 100 g"},
  {nama:"Jeruk", bentuk:"Buah", takaranG:1.0, energiKkal:62.0, proteinG:1.2, lemakG:0.1, karbohidratG:15.3, seratG:3.1, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (nilai per bh)"},
  {nama:"Kelengkeng", bentuk:"Buah", takaranG:100.0, energiKkal:52.5, proteinG:1.0, lemakG:0.0, karbohidratG:13.25, seratG:1.0, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (median 22 baris, dinormalkan ke 100 g)"},
  {nama:"Melon", bentuk:"Buah", takaranG:100.0, energiKkal:37.0, proteinG:0.625, lemakG:0.375, karbohidratG:7.75, seratG:1.0, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (median 12 baris, dinormalkan ke 100 g)"},
  {nama:"Nanas", bentuk:"Buah", takaranG:100.0, energiKkal:50.0, proteinG:0.5, lemakG:0.1, karbohidratG:13.0, seratG:1.4, sumberCatatan:"Perkiraan umum (bukan dari file Anda); verifikasi ke TKPI"},
  {nama:"Pepaya", bentuk:"Buah", takaranG:100.0, energiKkal:43.0, proteinG:0.5, lemakG:0.3, karbohidratG:11.0, seratG:1.7, sumberCatatan:"Perkiraan umum (bukan dari file Anda); verifikasi ke TKPI"},
  {nama:"Pir", bentuk:"Buah", takaranG:100.0, energiKkal:58.0, proteinG:0.3, lemakG:0.1, karbohidratG:15.4, seratG:3.1, sumberCatatan:"PDF Kandungan Gizi JJ (baris menu terdahulu), dinormalkan ke 100 g"},
  {nama:"Pisang", bentuk:"Buah", takaranG:100.0, energiKkal:91.3, proteinG:1.13, lemakG:0.35, karbohidratG:23.4, seratG:2.7, sumberCatatan:"PDF Kandungan Gizi JJ (baris menu terdahulu), dinormalkan ke 100 g"},
  {nama:"Semangka", bentuk:"Buah", takaranG:100.0, energiKkal:30.0, proteinG:0.61, lemakG:0.2, karbohidratG:8.0, seratG:0.4, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (median 18 baris, dinormalkan ke 100 g)"},
  {nama:"Strawberry", bentuk:"Buah", takaranG:100.0, energiKkal:32.0, proteinG:0.649, lemakG:0.283, karbohidratG:7.669, seratG:2.0, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (median 2 baris, dinormalkan ke 100 g)"},
  {nama:"Susu 115 ml", bentuk:"Susu", takaranG:1.0, energiKkal:70.0, proteinG:3.0, lemakG:3.5, karbohidratG:6.0, seratG:0.0, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (nilai per kotak)"},
  {nama:"Susu sekolah 125 ml", bentuk:"Susu", takaranG:1.0, energiKkal:90.0, proteinG:5.0, lemakG:4.0, karbohidratG:9.0, seratG:2.0, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (nilai per kotak)"},
  {nama:"Kelapa muda", bentuk:"Lemak", takaranG:100.0, energiKkal:128.3, proteinG:1.867, lemakG:1.7, karbohidratG:26.4, seratG:0.0, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (median 2 baris, dinormalkan ke 100 g)"},
  {nama:"Kelapa tua (parut)", bentuk:"Lemak", takaranG:100.0, energiKkal:359.0, proteinG:3.4, lemakG:34.7, karbohidratG:14.0, seratG:4.7, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (median 6 baris, dinormalkan ke 100 g)"},
  {nama:"Mentega", bentuk:"Lemak", takaranG:100.0, energiKkal:742.0, proteinG:0.5, lemakG:81.6, karbohidratG:1.4, seratG:0.0, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (median 2 baris, dinormalkan ke 100 g)"},
  {nama:"Minyak goreng", bentuk:"Lemak", takaranG:100.0, energiKkal:883.333, proteinG:0.0, lemakG:100.0, karbohidratG:0.0, seratG:0.0, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (median 218 baris, dinormalkan ke 100 g)"},
  {nama:"Santan", bentuk:"Lemak", takaranG:100.0, energiKkal:324.0, proteinG:4.2, lemakG:34.3, karbohidratG:5.6, seratG:0.0, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (median 2 baris, dinormalkan ke 100 g)"},
  {nama:"Tepung beras", bentuk:"Tepung", takaranG:100.0, energiKkal:353.0, proteinG:7.0, lemakG:0.5, karbohidratG:80.0, seratG:2.4, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (median 28 baris, dinormalkan ke 100 g)"},
  {nama:"Tepung maizena", bentuk:"Tepung", takaranG:100.0, energiKkal:341.0, proteinG:0.3, lemakG:0.0, karbohidratG:85.0, seratG:7.0, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (median 24 baris, dinormalkan ke 100 g)"},
  {nama:"Tepung roti", bentuk:"Tepung", takaranG:100.0, energiKkal:360.0, proteinG:8.0, lemakG:2.0, karbohidratG:82.0, seratG:0.0, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (median 8 baris, dinormalkan ke 100 g)"},
  {nama:"Tepung tapioka", bentuk:"Tepung", takaranG:100.0, energiKkal:360.0, proteinG:0.0, lemakG:0.0, karbohidratG:89.5, seratG:0.0, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (median 20 baris, dinormalkan ke 100 g)"},
  {nama:"Tepung terigu", bentuk:"Tepung", takaranG:100.0, energiKkal:333.333, proteinG:10.0, lemakG:0.0, karbohidratG:76.667, seratG:0.0, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (median 32 baris, dinormalkan ke 100 g)"},
  {nama:"Bakso sapi", bentuk:"Olahan", takaranG:100.0, energiKkal:null, proteinG:null, lemakG:null, karbohidratG:null, seratG:null, sumberCatatan:"Belum ada"},
  {nama:"Fla susu", bentuk:"Olahan", takaranG:100.0, energiKkal:null, proteinG:null, lemakG:null, karbohidratG:null, seratG:null, sumberCatatan:"Belum ada"},
  {nama:"Keju slice", bentuk:"Olahan", takaranG:1.0, energiKkal:50.0, proteinG:1.0, lemakG:4.5, karbohidratG:3.0, seratG:0.0, sumberCatatan:"KANDUNGAN_GIZI_JJ.xlsx (nilai per lembar)"},
  {nama:"Nugget ayam", bentuk:"Olahan", takaranG:100.0, energiKkal:null, proteinG:null, lemakG:null, karbohidratG:null, seratG:null, sumberCatatan:"Belum ada"},
  {nama:"Sosis ayam", bentuk:"Olahan", takaranG:100.0, energiKkal:null, proteinG:null, lemakG:null, karbohidratG:null, seratG:null, sumberCatatan:"Belum ada"},
];

const DATA_IMPOR_RESEP = [
  {idAsli:"R001", nama:"Kentang goreng (french fries)", kategori:"Karbohidrat", bahan:[{namaBahan:"Kentang", gramBesar:100.0, gramKecil:80.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R002", nama:"Kentang wedges", kategori:"Karbohidrat", bahan:[{namaBahan:"Kentang", gramBesar:90.0, gramKecil:70.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R003", nama:"Nasi daun jeruk", kategori:"Karbohidrat", bahan:[{namaBahan:"Nasi putih", gramBesar:150.0, gramKecil:125.0}, {namaBahan:"Minyak goreng", gramBesar:3.0, gramKecil:3.0}]},
  {idAsli:"R004", nama:"Nasi hainan", kategori:"Karbohidrat", bahan:[{namaBahan:"Nasi putih", gramBesar:150.0, gramKecil:125.0}]},
  {idAsli:"R005", nama:"Nasi kuning", kategori:"Karbohidrat", bahan:[{namaBahan:"Nasi putih", gramBesar:150.0, gramKecil:125.0}]},
  {idAsli:"R006", nama:"Nasi putih", kategori:"Karbohidrat", bahan:[{namaBahan:"Nasi putih", gramBesar:150.0, gramKecil:125.0}]},
  {idAsli:"R007", nama:"Roti bun", kategori:"Karbohidrat", bahan:[{namaBahan:"Roti bun", gramBesar:54.0, gramKecil:54.0}]},
  {idAsli:"R008", nama:"Roti tawar", kategori:"Karbohidrat", bahan:[{namaBahan:"Roti tawar", gramBesar:1.0, gramKecil:1.0}]},
  {idAsli:"R009", nama:"Ayam bakar", kategori:"Lauk Hewani", bahan:[{namaBahan:"Ayam (bagian tulang)", gramBesar:60.0, gramKecil:40.0}]},
  {idAsli:"R010", nama:"Ayam goreng", kategori:"Lauk Hewani", bahan:[{namaBahan:"Ayam (bagian tulang)", gramBesar:60.0, gramKecil:40.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R011", nama:"Ayam goreng lengkuas", kategori:"Lauk Hewani", bahan:[{namaBahan:"Ayam (bagian tulang)", gramBesar:60.0, gramKecil:40.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R012", nama:"Ayam gulai", kategori:"Lauk Hewani", bahan:[{namaBahan:"Ayam (bagian tulang)", gramBesar:50.0, gramKecil:35.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:5.0}]},
  {idAsli:"R013", nama:"Ayam kecap", kategori:"Lauk Hewani", bahan:[{namaBahan:"Ayam (bagian tulang)", gramBesar:50.0, gramKecil:35.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R014", nama:"Ayam kemangi", kategori:"Lauk Hewani", bahan:[{namaBahan:"Ayam fillet (dada)", gramBesar:50.0, gramKecil:null}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:5.0}, {namaBahan:"Ayam (bagian tulang)", gramBesar:null, gramKecil:35.0}]},
  {idAsli:"R015", nama:"Ayam ketumbar", kategori:"Lauk Hewani", bahan:[{namaBahan:"Ayam (bagian tulang)", gramBesar:60.0, gramKecil:40.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R016", nama:"Ayam kungpau", kategori:"Lauk Hewani", bahan:[{namaBahan:"Ayam fillet (dada)", gramBesar:50.0, gramKecil:35.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R017", nama:"Ayam lada hitam", kategori:"Lauk Hewani", bahan:[{namaBahan:"Ayam (bagian tulang)", gramBesar:50.0, gramKecil:35.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R018", nama:"Ayam mentega", kategori:"Lauk Hewani", bahan:[{namaBahan:"Ayam (bagian tulang)", gramBesar:60.0, gramKecil:40.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R019", nama:"Ayam rica-rica", kategori:"Lauk Hewani", bahan:[{namaBahan:"Ayam (bagian tulang)", gramBesar:50.0, gramKecil:35.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R020", nama:"Ayam semur", kategori:"Lauk Hewani", bahan:[{namaBahan:"Ayam (bagian tulang)", gramBesar:60.0, gramKecil:40.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R021", nama:"Ayam serundeng", kategori:"Lauk Hewani", bahan:[{namaBahan:"Ayam (bagian tulang)", gramBesar:60.0, gramKecil:40.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}, {namaBahan:"Kelapa tua (parut)", gramBesar:3.0, gramKecil:3.0}]},
  {idAsli:"R022", nama:"Ayam teriyaki", kategori:"Lauk Hewani", bahan:[{namaBahan:"Ayam fillet (dada)", gramBesar:50.0, gramKecil:35.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R023", nama:"Beef black pepper", kategori:"Lauk Hewani", bahan:[{namaBahan:"Daging sapi", gramBesar:60.0, gramKecil:50.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R024", nama:"Beef teriyaki", kategori:"Lauk Hewani", bahan:[{namaBahan:"Daging sapi", gramBesar:60.0, gramKecil:50.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R025", nama:"Beef toffa lada", kategori:"Lauk Hewani", bahan:[{namaBahan:"Daging sapi", gramBesar:60.0, gramKecil:50.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R026", nama:"Chicken katsu", kategori:"Lauk Hewani", bahan:[{namaBahan:"Ayam fillet (dada)", gramBesar:50.0, gramKecil:35.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}, {namaBahan:"Tepung tapioka", gramBesar:5.0, gramKecil:3.0}, {namaBahan:"Tepung terigu", gramBesar:5.0, gramKecil:3.0}, {namaBahan:"Tepung roti", gramBesar:5.0, gramKecil:3.0}, {namaBahan:"Tepung maizena", gramBesar:5.0, gramKecil:3.0}, {namaBahan:"Tepung beras", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R027", nama:"Chicken pop (popcorn)", kategori:"Lauk Hewani", bahan:[{namaBahan:"Ayam fillet (dada)", gramBesar:50.0, gramKecil:35.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}, {namaBahan:"Tepung terigu", gramBesar:5.0, gramKecil:3.0}, {namaBahan:"Tepung tapioka", gramBesar:5.0, gramKecil:3.0}, {namaBahan:"Tepung maizena", gramBesar:5.0, gramKecil:3.0}, {namaBahan:"Tepung beras", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R028", nama:"Dimsum", kategori:"Lauk Hewani", bahan:[{namaBahan:"Ayam fillet (dada)", gramBesar:40.0, gramKecil:20.0}, {namaBahan:"Kulit dimsum", gramBesar:6.0, gramKecil:6.0}]},
  {idAsli:"R029", nama:"Fried chicken", kategori:"Lauk Hewani", bahan:[{namaBahan:"Ayam (bagian tulang)", gramBesar:60.0, gramKecil:40.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}, {namaBahan:"Tepung tapioka", gramBesar:5.0, gramKecil:3.0}, {namaBahan:"Tepung terigu", gramBesar:5.0, gramKecil:3.0}, {namaBahan:"Tepung beras", gramBesar:5.0, gramKecil:3.0}, {namaBahan:"Tepung maizena", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R030", nama:"Rendang daging", kategori:"Lauk Hewani", bahan:[{namaBahan:"Daging sapi", gramBesar:60.0, gramKecil:50.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}, {namaBahan:"Santan", gramBesar:15.0, gramKecil:10.0}]},
  {idAsli:"R031", nama:"Semur daging", kategori:"Lauk Hewani", bahan:[{namaBahan:"Daging sapi", gramBesar:60.0, gramKecil:50.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R032", nama:"Telur balado", kategori:"Lauk Hewani", bahan:[{namaBahan:"Telur ayam", gramBesar:55.0, gramKecil:55.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R033", nama:"Telur ceplok", kategori:"Lauk Hewani", bahan:[{namaBahan:"Telur ayam", gramBesar:55.0, gramKecil:55.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R034", nama:"Telur ceplok BB", kategori:"Lauk Hewani", bahan:[{namaBahan:"Telur ayam", gramBesar:55.0, gramKecil:55.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R035", nama:"Telur kecap", kategori:"Lauk Hewani", bahan:[{namaBahan:"Telur ayam", gramBesar:55.0, gramKecil:55.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R036", nama:"Telur pindang", kategori:"Lauk Hewani", bahan:[{namaBahan:"Telur ayam", gramBesar:55.0, gramKecil:55.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R037", nama:"Telur puyuh saus BBQ", kategori:"Lauk Hewani", bahan:[{namaBahan:"Telur puyuh", gramBesar:50.0, gramKecil:35.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R038", nama:"Telur rebus", kategori:"Lauk Hewani", bahan:[{namaBahan:"Telur ayam", gramBesar:55.0, gramKecil:55.0}]},
  {idAsli:"R039", nama:"Jamur crispy", kategori:"Lauk Nabati", bahan:[{namaBahan:"Jamur tiram", gramBesar:25.0, gramKecil:15.0}, {namaBahan:"Tepung terigu", gramBesar:5.0, gramKecil:3.0}, {namaBahan:"Tepung tapioka", gramBesar:5.0, gramKecil:3.0}, {namaBahan:"Tepung maizena", gramBesar:5.0, gramKecil:3.0}, {namaBahan:"Tepung beras", gramBesar:5.0, gramKecil:3.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R040", nama:"Semur tahu", kategori:"Lauk Nabati", bahan:[{namaBahan:"Tahu", gramBesar:40.0, gramKecil:20.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R041", nama:"Tahu goreng", kategori:"Lauk Nabati", bahan:[{namaBahan:"Tahu", gramBesar:40.0, gramKecil:20.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R042", nama:"Tahu kecap", kategori:"Lauk Nabati", bahan:[{namaBahan:"Tahu", gramBesar:40.0, gramKecil:20.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R043", nama:"Tahu kucay", kategori:"Lauk Nabati", bahan:[{namaBahan:"Tahu", gramBesar:40.0, gramKecil:20.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R044", nama:"Tahu mentega", kategori:"Lauk Nabati", bahan:[{namaBahan:"Tahu", gramBesar:40.0, gramKecil:20.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R045", nama:"Tahu popcorn", kategori:"Lauk Nabati", bahan:[{namaBahan:"Tahu", gramBesar:40.0, gramKecil:20.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}, {namaBahan:"Tepung terigu", gramBesar:5.0, gramKecil:3.0}, {namaBahan:"Tepung beras", gramBesar:5.0, gramKecil:3.0}, {namaBahan:"Tepung maizena", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R046", nama:"Tempe bacem", kategori:"Lauk Nabati", bahan:[{namaBahan:"Tempe", gramBesar:40.0, gramKecil:30.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R047", nama:"Tempe daun jeruk crispy", kategori:"Lauk Nabati", bahan:[{namaBahan:"Tempe", gramBesar:40.0, gramKecil:30.0}, {namaBahan:"Minyak goreng", gramBesar:3.0, gramKecil:3.0}, {namaBahan:"Tepung terigu", gramBesar:3.0, gramKecil:3.0}, {namaBahan:"Tepung beras", gramBesar:3.0, gramKecil:3.0}]},
  {idAsli:"R048", nama:"Tempe goreng", kategori:"Lauk Nabati", bahan:[{namaBahan:"Tempe", gramBesar:40.0, gramKecil:30.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R049", nama:"Tempe mendoan", kategori:"Lauk Nabati", bahan:[{namaBahan:"Tempe", gramBesar:40.0, gramKecil:30.0}, {namaBahan:"Minyak goreng", gramBesar:3.0, gramKecil:3.0}, {namaBahan:"Tepung terigu", gramBesar:3.0, gramKecil:3.0}, {namaBahan:"Tepung beras", gramBesar:3.0, gramKecil:3.0}]},
  {idAsli:"R050", nama:"Tempe orek", kategori:"Lauk Nabati", bahan:[{namaBahan:"Tempe", gramBesar:40.0, gramKecil:30.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R051", nama:"Tempe rempah", kategori:"Lauk Nabati", bahan:[{namaBahan:"Tempe", gramBesar:40.0, gramKecil:30.0}, {namaBahan:"Minyak goreng", gramBesar:3.0, gramKecil:3.0}]},
  {idAsli:"R052", nama:"Tempe tepung", kategori:"Lauk Nabati", bahan:[{namaBahan:"Tempe", gramBesar:40.0, gramKecil:30.0}, {namaBahan:"Tepung terigu", gramBesar:5.0, gramKecil:3.0}, {namaBahan:"Tepung beras", gramBesar:5.0, gramKecil:3.0}, {namaBahan:"Tepung maizena", gramBesar:5.0, gramKecil:3.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R053", nama:"Tempe teriyaki", kategori:"Lauk Nabati", bahan:[{namaBahan:"Tempe", gramBesar:40.0, gramKecil:30.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R054", nama:"Acar kuning", kategori:"Sayur", bahan:[{namaBahan:"Timun", gramBesar:25.0, gramKecil:15.0}, {namaBahan:"Wortel", gramBesar:25.0, gramKecil:15.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R055", nama:"Ca kimlo", kategori:"Sayur", bahan:[{namaBahan:"Wortel", gramBesar:25.0, gramKecil:15.0}, {namaBahan:"Kembang kol", gramBesar:15.0, gramKecil:10.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R056", nama:"Cah kubis wortel", kategori:"Sayur", bahan:[{namaBahan:"Wortel", gramBesar:25.0, gramKecil:15.0}, {namaBahan:"Kubis", gramBesar:25.0, gramKecil:15.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R057", nama:"Cah sayur", kategori:"Sayur", bahan:[{namaBahan:"Wortel", gramBesar:25.0, gramKecil:15.0}, {namaBahan:"Sawi putih", gramBesar:25.0, gramKecil:15.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R058", nama:"Capcay merah", kategori:"Sayur", bahan:[{namaBahan:"Wortel", gramBesar:20.0, gramKecil:15.0}, {namaBahan:"Kembang kol", gramBesar:10.0, gramKecil:7.0}, {namaBahan:"Pakcoy", gramBesar:15.0, gramKecil:10.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R059", nama:"Coleslaw", kategori:"Sayur", bahan:[{namaBahan:"Wortel", gramBesar:15.0, gramKecil:10.0}, {namaBahan:"Kubis", gramBesar:15.0, gramKecil:10.0}, {namaBahan:"Kol merah", gramBesar:15.0, gramKecil:10.0}, {namaBahan:"Selada", gramBesar:15.0, gramKecil:15.0}]},
  {idAsli:"R060", nama:"Gado-gado", kategori:"Sayur", bahan:[{namaBahan:"Labu siam", gramBesar:15.0, gramKecil:10.0}, {namaBahan:"Kubis", gramBesar:15.0, gramKecil:10.0}, {namaBahan:"Kacang panjang", gramBesar:15.0, gramKecil:10.0}]},
  {idAsli:"R061", nama:"Lalapan selada timun", kategori:"Sayur", bahan:[{namaBahan:"Selada", gramBesar:25.0, gramKecil:15.0}, {namaBahan:"Timun", gramBesar:35.0, gramKecil:25.0}]},
  {idAsli:"R062", nama:"Mix vegetable", kategori:"Sayur", bahan:[{namaBahan:"Wortel", gramBesar:15.0, gramKecil:10.0}, {namaBahan:"Buncis", gramBesar:15.0, gramKecil:10.0}, {namaBahan:"Jagung pipil", gramBesar:15.0, gramKecil:10.0}]},
  {idAsli:"R063", nama:"Sayur labu wortel", kategori:"Sayur", bahan:[{namaBahan:"Wortel", gramBesar:25.0, gramKecil:15.0}, {namaBahan:"Labu siam", gramBesar:25.0, gramKecil:15.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R064", nama:"Sayur wortel buncis", kategori:"Sayur", bahan:[{namaBahan:"Wortel", gramBesar:25.0, gramKecil:15.0}, {namaBahan:"Buncis", gramBesar:25.0, gramKecil:15.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R065", nama:"Sayur wortel kubis (tanpa minyak)", kategori:"Sayur", bahan:[{namaBahan:"Wortel", gramBesar:25.0, gramKecil:15.0}, {namaBahan:"Kubis", gramBesar:25.0, gramKecil:15.0}]},
  {idAsli:"R066", nama:"Steamed vege", kategori:"Sayur", bahan:[{namaBahan:"Wortel", gramBesar:25.0, gramKecil:15.0}, {namaBahan:"Brokoli", gramBesar:15.0, gramKecil:10.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R067", nama:"Timun", kategori:"Sayur", bahan:[{namaBahan:"Timun", gramBesar:35.0, gramKecil:25.0}]},
  {idAsli:"R068", nama:"Tumis buncis wortel", kategori:"Sayur", bahan:[{namaBahan:"Buncis", gramBesar:25.0, gramKecil:15.0}, {namaBahan:"Wortel", gramBesar:25.0, gramKecil:15.0}]},
  {idAsli:"R069", nama:"Tumis kacang panjang tempe", kategori:"Sayur", bahan:[{namaBahan:"Kacang panjang", gramBesar:30.0, gramKecil:20.0}, {namaBahan:"Tempe", gramBesar:20.0, gramKecil:10.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R070", nama:"Tumis labu wortel", kategori:"Sayur", bahan:[{namaBahan:"Labu siam", gramBesar:25.0, gramKecil:15.0}, {namaBahan:"Wortel", gramBesar:25.0, gramKecil:15.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R071", nama:"Tumis sawi jagung", kategori:"Sayur", bahan:[{namaBahan:"Jagung pipil", gramBesar:25.0, gramKecil:15.0}, {namaBahan:"Sawi putih", gramBesar:25.0, gramKecil:15.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R072", nama:"Tumis sayur campur", kategori:"Sayur", bahan:[{namaBahan:"Jagung pipil", gramBesar:25.0, gramKecil:15.0}, {namaBahan:"Sawi putih", gramBesar:25.0, gramKecil:15.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R073", nama:"Tumis wortel baby corn", kategori:"Sayur", bahan:[{namaBahan:"Wortel", gramBesar:25.0, gramKecil:15.0}, {namaBahan:"Baby corn", gramBesar:25.0, gramKecil:15.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R074", nama:"Tumis wortel kubis", kategori:"Sayur", bahan:[{namaBahan:"Wortel", gramBesar:25.0, gramKecil:15.0}, {namaBahan:"Labu siam", gramBesar:25.0, gramKecil:15.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R075", nama:"Tumis wortel sawi", kategori:"Sayur", bahan:[{namaBahan:"Wortel", gramBesar:25.0, gramKecil:15.0}, {namaBahan:"Sawi putih", gramBesar:25.0, gramKecil:15.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R076", nama:"Urap sayur", kategori:"Sayur", bahan:[{namaBahan:"Wortel", gramBesar:15.0, gramKecil:10.0}, {namaBahan:"Kubis", gramBesar:15.0, gramKecil:10.0}, {namaBahan:"Kacang panjang", gramBesar:15.0, gramKecil:10.0}, {namaBahan:"Kelapa muda", gramBesar:3.0, gramKecil:3.0}]},
  {idAsli:"R077", nama:"Anggur", kategori:"Buah", bahan:[{namaBahan:"Anggur", gramBesar:35.0, gramKecil:35.0}]},
  {idAsli:"R078", nama:"Apel Fuji", kategori:"Buah", bahan:[{namaBahan:"Apel Fuji", gramBesar:100.0, gramKecil:100.0}]},
  {idAsli:"R079", nama:"Buah naga", kategori:"Buah", bahan:[{namaBahan:"Buah naga", gramBesar:100.0, gramKecil:100.0}]},
  {idAsli:"R080", nama:"Jeruk", kategori:"Buah", bahan:[{namaBahan:"Jeruk", gramBesar:1.0, gramKecil:1.0}]},
  {idAsli:"R081", nama:"Kelengkeng", kategori:"Buah", bahan:[{namaBahan:"Kelengkeng", gramBesar:40.0, gramKecil:35.0}]},
  {idAsli:"R082", nama:"Melon", kategori:"Buah", bahan:[{namaBahan:"Melon", gramBesar:80.0, gramKecil:80.0}]},
  {idAsli:"R083", nama:"Semangka", kategori:"Buah", bahan:[{namaBahan:"Semangka", gramBesar:80.0, gramKecil:70.0}]},
  {idAsli:"R084", nama:"Strawberry", kategori:"Buah", bahan:[{namaBahan:"Strawberry", gramBesar:35.0, gramKecil:25.0}]},
  {idAsli:"R085", nama:"Bubur kacang hijau", kategori:"Pelengkap", bahan:[{namaBahan:"Kacang hijau", gramBesar:60.0, gramKecil:50.0}]},
  {idAsli:"R086", nama:"Keju slice", kategori:"Pelengkap", bahan:[{namaBahan:"Keju slice", gramBesar:1.0, gramKecil:1.0}]},
  {idAsli:"R087", nama:"Ketan hitam", kategori:"Pelengkap", bahan:[{namaBahan:"Beras ketan hitam", gramBesar:40.0, gramKecil:30.0}]},
  {idAsli:"R088", nama:"Susu kotak", kategori:"Pelengkap", bahan:[{namaBahan:"Susu sekolah 125 ml", gramBesar:1.0, gramKecil:1.0}]},
  {idAsli:"R089", nama:"[Dasar] Nasi berbumbu (hainan/pandan/daun jeruk)", kategori:"Karbohidrat", bahan:[{namaBahan:"Nasi putih", gramBesar:150.0, gramKecil:125.0}, {namaBahan:"Minyak goreng", gramBesar:3.0, gramKecil:3.0}]},
  {idAsli:"R090", nama:"[Dasar] Ayam fillet olahan", kategori:"Lauk Hewani", bahan:[{namaBahan:"Ayam fillet (dada)", gramBesar:50.0, gramKecil:35.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R091", nama:"[Dasar] Ayam fillet tepung (crispy/popcorn/katsu)", kategori:"Lauk Hewani", bahan:[{namaBahan:"Ayam fillet (dada)", gramBesar:50.0, gramKecil:35.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}, {namaBahan:"Tepung tapioka", gramBesar:5.0, gramKecil:3.0}, {namaBahan:"Tepung terigu", gramBesar:5.0, gramKecil:3.0}, {namaBahan:"Tepung beras", gramBesar:5.0, gramKecil:3.0}, {namaBahan:"Tepung maizena", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R092", nama:"[Dasar] Ayam tulang olahan", kategori:"Lauk Hewani", bahan:[{namaBahan:"Ayam (bagian tulang)", gramBesar:60.0, gramKecil:40.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R093", nama:"[Dasar] Daging sapi olahan", kategori:"Lauk Hewani", bahan:[{namaBahan:"Daging sapi", gramBesar:60.0, gramKecil:50.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R094", nama:"[Dasar] Ikan goreng/olahan", kategori:"Lauk Hewani", bahan:[{namaBahan:"Ikan nila", gramBesar:70.0, gramKecil:60.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R095", nama:"[Dasar] Telur olahan", kategori:"Lauk Hewani", bahan:[{namaBahan:"Telur ayam", gramBesar:55.0, gramKecil:55.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R096", nama:"[Dasar] Tahu olahan", kategori:"Lauk Nabati", bahan:[{namaBahan:"Tahu", gramBesar:40.0, gramKecil:20.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R097", nama:"[Dasar] Tahu tepung (crispy/popcorn)", kategori:"Lauk Nabati", bahan:[{namaBahan:"Tahu", gramBesar:40.0, gramKecil:20.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}, {namaBahan:"Tepung terigu", gramBesar:5.0, gramKecil:3.0}, {namaBahan:"Tepung beras", gramBesar:5.0, gramKecil:3.0}, {namaBahan:"Tepung maizena", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R098", nama:"[Dasar] Tempe olahan", kategori:"Lauk Nabati", bahan:[{namaBahan:"Tempe", gramBesar:40.0, gramKecil:30.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R099", nama:"[Dasar] Tempe tepung (mendoan/crispy)", kategori:"Lauk Nabati", bahan:[{namaBahan:"Tempe", gramBesar:40.0, gramKecil:30.0}, {namaBahan:"Minyak goreng", gramBesar:3.0, gramKecil:3.0}, {namaBahan:"Tepung terigu", gramBesar:3.0, gramKecil:3.0}, {namaBahan:"Tepung beras", gramBesar:3.0, gramKecil:3.0}]},
  {idAsli:"R100", nama:"[Dasar] Sayur kukus/rebus (tanpa minyak)", kategori:"Sayur", bahan:[{namaBahan:"Wortel", gramBesar:25.0, gramKecil:15.0}, {namaBahan:"Buncis", gramBesar:25.0, gramKecil:15.0}]},
  {idAsli:"R101", nama:"[Dasar] Tumis sayur 2 jenis", kategori:"Sayur", bahan:[{namaBahan:"Wortel", gramBesar:25.0, gramKecil:15.0}, {namaBahan:"Kubis", gramBesar:25.0, gramKecil:15.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R102", nama:"Kentang kukus (pengganti nasi / alergi nasi)", kategori:"Karbohidrat", bahan:[{namaBahan:"Kentang", gramBesar:175.0, gramKecil:175.0}]},
  {idAsli:"R103", nama:"Nasi liwet", kategori:"Karbohidrat", bahan:[{namaBahan:"Nasi putih", gramBesar:150.0, gramKecil:125.0}, {namaBahan:"Santan", gramBesar:10.0, gramKecil:8.0}, {namaBahan:"Minyak goreng", gramBesar:3.0, gramKecil:3.0}]},
  {idAsli:"R104", nama:"Nasi uduk", kategori:"Karbohidrat", bahan:[{namaBahan:"Nasi putih", gramBesar:150.0, gramKecil:125.0}, {namaBahan:"Santan", gramBesar:15.0, gramKecil:10.0}, {namaBahan:"Minyak goreng", gramBesar:3.0, gramKecil:3.0}]},
  {idAsli:"R105", nama:"Spaghetti saus bolognese", kategori:"Karbohidrat", bahan:[{namaBahan:"Spaghetti (kering)", gramBesar:50.0, gramKecil:40.0}, {namaBahan:"Daging sapi", gramBesar:30.0, gramKecil:25.0}, {namaBahan:"Tomat", gramBesar:40.0, gramKecil:30.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R106", nama:"Bakso (goreng/kuah)", kategori:"Lauk Hewani", bahan:[{namaBahan:"Bakso sapi", gramBesar:50.0, gramKecil:40.0}]},
  {idAsli:"R107", nama:"Ikan lele goreng", kategori:"Lauk Hewani", bahan:[{namaBahan:"Ikan lele", gramBesar:70.0, gramKecil:60.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R108", nama:"Ikan nila goreng", kategori:"Lauk Hewani", bahan:[{namaBahan:"Ikan nila", gramBesar:70.0, gramKecil:60.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R109", nama:"Nugget ayam", kategori:"Lauk Hewani", bahan:[{namaBahan:"Nugget ayam", gramBesar:50.0, gramKecil:35.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R110", nama:"Sosis bakar", kategori:"Lauk Hewani", bahan:[{namaBahan:"Sosis ayam", gramBesar:50.0, gramKecil:40.0}, {namaBahan:"Minyak goreng", gramBesar:3.0, gramKecil:2.0}]},
  {idAsli:"R111", nama:"Telur bumbu rendang (rebus)", kategori:"Lauk Hewani", bahan:[{namaBahan:"Telur ayam", gramBesar:55.0, gramKecil:55.0}, {namaBahan:"Santan", gramBesar:10.0, gramKecil:8.0}, {namaBahan:"Minyak goreng", gramBesar:3.0, gramKecil:2.0}]},
  {idAsli:"R112", nama:"Sayur bayam bening", kategori:"Sayur", bahan:[{namaBahan:"Bayam", gramBesar:50.0, gramKecil:30.0}]},
  {idAsli:"R113", nama:"Tumis kangkung", kategori:"Sayur", bahan:[{namaBahan:"Kangkung", gramBesar:50.0, gramKecil:30.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R114", nama:"Tumis labu siam jagung", kategori:"Sayur", bahan:[{namaBahan:"Labu siam", gramBesar:25.0, gramKecil:15.0}, {namaBahan:"Jagung pipil", gramBesar:25.0, gramKecil:15.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R115", nama:"Tumis tauge wortel", kategori:"Sayur", bahan:[{namaBahan:"Tauge", gramBesar:25.0, gramKecil:15.0}, {namaBahan:"Wortel", gramBesar:25.0, gramKecil:15.0}, {namaBahan:"Minyak goreng", gramBesar:5.0, gramKecil:3.0}]},
  {idAsli:"R116", nama:"Duku", kategori:"Buah", bahan:[{namaBahan:"Duku", gramBesar:80.0, gramKecil:60.0}]},
  {idAsli:"R117", nama:"Nanas", kategori:"Buah", bahan:[{namaBahan:"Nanas", gramBesar:80.0, gramKecil:70.0}]},
  {idAsli:"R118", nama:"Pepaya", kategori:"Buah", bahan:[{namaBahan:"Pepaya", gramBesar:80.0, gramKecil:70.0}]},
  {idAsli:"R119", nama:"Pir", kategori:"Buah", bahan:[{namaBahan:"Pir", gramBesar:100.0, gramKecil:100.0}]},
  {idAsli:"R120", nama:"Pisang", kategori:"Buah", bahan:[{namaBahan:"Pisang", gramBesar:115.0, gramKecil:90.0}]},
  {idAsli:"R121", nama:"Fla susu", kategori:"Pelengkap", bahan:[{namaBahan:"Fla susu", gramBesar:60.0, gramKecil:60.0}]},
];

const DATA_IMPOR_PADANAN = [
  {kategori:"Karbohidrat", namaMenu:"Nasi Putih", idResepAsli:"R006"},
  {kategori:"Lauk Hewani", namaMenu:"Telur Pindang", idResepAsli:"R036"},
  {kategori:"Sayur", namaMenu:"Tumis Kacang Panjang Tempe", idResepAsli:"R069"},
  {kategori:"Buah", namaMenu:"Semangka", idResepAsli:"R083"},
  {kategori:"Pelengkap", namaMenu:"Susu UHT", idResepAsli:"R088"},
  {kategori:"Lauk Hewani", namaMenu:"Ayam Popcorn", idResepAsli:"R027"},
  {kategori:"Lauk Nabati", namaMenu:"Semur Tahu", idResepAsli:"R040"},
  {kategori:"Sayur", namaMenu:"Tumis Wortel Sawi Putih", idResepAsli:"R075"},
  {kategori:"Buah", namaMenu:"Kelengkeng", idResepAsli:"R081"},
  {kategori:"Karbohidrat", namaMenu:"Nasi Hainan", idResepAsli:"R004"},
  {kategori:"Lauk Hewani", namaMenu:"Ayam Serundeng", idResepAsli:"R021"},
  {kategori:"Lauk Nabati", namaMenu:"Tempe Bacem", idResepAsli:"R046"},
  {kategori:"Sayur", namaMenu:"Lalap Selada Timun", idResepAsli:"R061"},
  {kategori:"Buah", namaMenu:"Melon", idResepAsli:"R082"},
  {kategori:"Lauk Hewani", namaMenu:"Telur Saos Balado", idResepAsli:"R032"},
  {kategori:"Lauk Nabati", namaMenu:"Tahu Goreng", idResepAsli:"R041"},
  {kategori:"Sayur", namaMenu:"Mix Vegetables", idResepAsli:"R062"},
  {kategori:"Buah", namaMenu:"Apel / Anggur", idResepAsli:"R078"},
  {kategori:"Karbohidrat", namaMenu:"Kentang Wedges", idResepAsli:"R002"},
  {kategori:"Lauk Hewani", namaMenu:"Dimsum", idResepAsli:"R028"},
  {kategori:"Lauk Nabati", namaMenu:"Jamur Crispy", idResepAsli:"R039"},
  {kategori:"Sayur", namaMenu:"Coleslaw / Salad", idResepAsli:"R059"},
  {kategori:"Buah", namaMenu:"Jeruk", idResepAsli:"R080"},
  {kategori:"Pelengkap", namaMenu:"Parsley", idResepAsli:null},
  {kategori:"Karbohidrat", namaMenu:"Nasi Daun Jeruk", idResepAsli:"R003"},
  {kategori:"Lauk Hewani", namaMenu:"Telur Balado", idResepAsli:"R032"},
  {kategori:"Sayur", namaMenu:"Acar Kuning Wortel Timun", idResepAsli:"R054"},
  {kategori:"Pelengkap", namaMenu:"Susu", idResepAsli:"R088"},
  {kategori:"Lauk Hewani", namaMenu:"Ayam Goreng lengkuas", idResepAsli:"R011"},
  {kategori:"Sayur", namaMenu:"Gado gado", idResepAsli:"R060"},
  {kategori:"Karbohidrat", namaMenu:"Nasi", idResepAsli:"R006"},
  {kategori:"Lauk Hewani", namaMenu:"Ayam Rica-rica", idResepAsli:"R019"},
  {kategori:"Lauk Nabati", namaMenu:"Tempe Mendoan", idResepAsli:"R049"},
  {kategori:"Sayur", namaMenu:"Tumis Wortel Buncis", idResepAsli:"R068"},
  {kategori:"Lauk Hewani", namaMenu:"Daging Teriyaki", idResepAsli:"R024"},
  {kategori:"Sayur", namaMenu:"Tumis Wortel Baby Corn", idResepAsli:"R073"},
  {kategori:"Karbohidrat", namaMenu:"Roti Tawar", idResepAsli:"R008"},
  {kategori:"Lauk Hewani", namaMenu:"Chicken Katsu", idResepAsli:"R026"},
  {kategori:"Sayur", namaMenu:"Selada & Timun", idResepAsli:"R061"},
  {kategori:"Buah", namaMenu:"Anggur", idResepAsli:"R077"},
  {kategori:"Pelengkap", namaMenu:"Keju Slice", idResepAsli:"R086"},
  {kategori:"Lauk Hewani", namaMenu:"Telur Bumbu Rendang (Rebus)", idResepAsli:"R111"},
  {kategori:"Sayur", namaMenu:"Tumis Labu Siam + Wortel", idResepAsli:"R070"},
  {kategori:"Pelengkap", namaMenu:"Susu 125ml", idResepAsli:"R088"},
  {kategori:"Lauk Hewani", namaMenu:"Ayam Kentucky", idResepAsli:"R029"},
  {kategori:"Lauk Nabati", namaMenu:"Tahu Kecap", idResepAsli:"R042"},
  {kategori:"Sayur", namaMenu:"Tumis Wortel Kol", idResepAsli:"R074"},
  {kategori:"Lauk Hewani", namaMenu:"Ayam Lada Hitam", idResepAsli:"R017"},
  {kategori:"Lauk Nabati", namaMenu:"Tempe Daun Jeruk Crispy (Potong 12)", idResepAsli:"R047"},
  {kategori:"Sayur", namaMenu:"Mix Vegetable", idResepAsli:"R062"},
  {kategori:"Pelengkap", namaMenu:"Biji Wijen", idResepAsli:null},
  {kategori:"Karbohidrat", namaMenu:"Nasi Kuning", idResepAsli:"R005"},
  {kategori:"Lauk Hewani", namaMenu:"Ayam Bakar", idResepAsli:"R009"},
  {kategori:"Lauk Nabati", namaMenu:"Orek Tempe", idResepAsli:"R050"},
  {kategori:"Sayur", namaMenu:"Lalap Timun Selada", idResepAsli:"R061"},
  {kategori:"Lauk Hewani", namaMenu:"Telur Rebus (Kupas)", idResepAsli:"R038"},
  {kategori:"Lauk Nabati", namaMenu:"Bubur Kacang Hijau & Ketan Hitam", idResepAsli:"R085"},
  {kategori:"Buah", namaMenu:"Buah Naga", idResepAsli:"R079"},
  {kategori:"Pelengkap", namaMenu:"Fla Susu", idResepAsli:"R121"},
  {kategori:"Karbohidrat", namaMenu:"Nasi putih", idResepAsli:"R006"},
  {kategori:"Lauk Hewani", namaMenu:"Sate telur puyuh saus BBQ", idResepAsli:"R037"},
  {kategori:"Sayur", namaMenu:"Tumis Buncis Wortel", idResepAsli:"R068"},
  {kategori:"Buah", namaMenu:"kelengkeng", idResepAsli:"R081"},
  {kategori:"Lauk Hewani", namaMenu:"Ayam fillet saus mentega", idResepAsli:"R018"},
  {kategori:"Lauk Nabati", namaMenu:"Tahu goreng", idResepAsli:"R041"},
  {kategori:"Sayur", namaMenu:"Tumis labu siang jagung", idResepAsli:"R114"},
  {kategori:"Karbohidrat", namaMenu:"Nasi Liwet", idResepAsli:"R103"},
  {kategori:"Lauk Hewani", namaMenu:"Ayam Goreng Bawang putih", idResepAsli:"R010"},
  {kategori:"Lauk Nabati", namaMenu:"Tempe teriyaki", idResepAsli:"R053"},
  {kategori:"Sayur", namaMenu:"Mentimun selada", idResepAsli:"R061"},
  {kategori:"Lauk Hewani", namaMenu:"Daging Blackpaper", idResepAsli:"R023"},
  {kategori:"Lauk Nabati", namaMenu:"Lumpia tahu", idResepAsli:"R097"},
  {kategori:"Sayur", namaMenu:"Tumis Wortel sawi putih", idResepAsli:"R075"},
  {kategori:"Karbohidrat", namaMenu:"Jasuke", idResepAsli:null},
  {kategori:"Lauk Hewani", namaMenu:"Soais Bakar", idResepAsli:"R110"},
  {kategori:"Lauk Nabati", namaMenu:"Tahu bulat", idResepAsli:"R096"},
  {kategori:"Sayur", namaMenu:"Selada", idResepAsli:"R061"},
];
/**
 * SIPOGIM — ImporData.gs (bagian kode, data literal di atas)
 * Skrip SEKALI JALAN memasukkan 68 Bahan, 121 Resep (+282 baris
 * Resep_Bahan), dan 74 Padanan Nama awal dari Pustaka_Resep_Gizi_DRAFT.xlsx.
 *
 * IDEMPOTEN: aman dijalankan berkali-kali -- bahan/resep/padanan yang
 * NAMA-nya (setelah dinormalisasi) sudah ada di sheet TIDAK dibuat
 * dobel, dilewati dengan dicatat di log.
 *
 * DIOPTIMALKAN utk kecepatan: semua baris dikumpulkan dulu di memori,
 * ditulis ke tiap sheet dalam SATU panggilan setValues() per sheet
 * (bukan appendRow() satu-satu 545 kali) -- Apps Script punya batas
 * eksekusi 6 menit, menulis satu-satu berisiko lambat/kena batas itu.
 *
 * Status awal (draf/perlu_dicek) ditentukan dari KELENGKAPAN data gizi
 * bahan, SAMA seperti aturan bahan yang ditambah manual (lihat Bahan.gs)
 * -- bukan disalin mentah dari kolom "Status" sumbernya (vocabulary-nya
 * beda, tidak cocok langsung dengan 3 tingkat SIPOGIM).
 */
function jalankanImporDataAwal() {
  const waktuMulai = new Date().getTime();

  // ===== 1. BAHAN =====
  const sheetBahan = getSheetSipogim_('BAHAN');
  const bahanAda = sheetToObjectsSipogim_(sheetBahan);
  const petaBahanNamaKeId = {};
  bahanAda.forEach(b => { petaBahanNamaKeId[b.NAMA_NORM] = b.ID; });
  let idBahanBerikutnya = (Math.max(0, ...bahanAda.map(b => parseInt(String(b.ID).replace('BH', ''), 10) || 0))) + 1;

  const barisBaruBahan = [];
  let bahanBaru = 0, bahanDilewati = 0;
  DATA_IMPOR_BAHAN.forEach(b => {
    const namaNorm = normalisasiNamaSipogim_(b.nama);
    if (petaBahanNamaKeId[namaNorm]) { bahanDilewati++; return; }
    const id = 'BH' + String(idBahanBerikutnya++).padStart(3, '0');
    const lengkap = [b.energiKkal, b.proteinG, b.lemakG, b.karbohidratG, b.seratG].every(v => v !== null);
    const status = lengkap ? 'draf' : 'perlu_dicek';
    barisBaruBahan.push([id, b.nama, namaNorm, b.bentuk, b.takaranG, b.energiKkal, b.proteinG, b.lemakG, b.karbohidratG, b.seratG, 'impor_awal', b.sumberCatatan, status, '', '', 1, 'Impor Awal', new Date()]);
    petaBahanNamaKeId[namaNorm] = id;
    bahanBaru++;
  });
  if (barisBaruBahan.length) {
    sheetBahan.getRange(sheetBahan.getLastRow() + 1, 1, barisBaruBahan.length, 18).setValues(barisBaruBahan);
  }

  // ===== 2. RESEP + RESEP_BAHAN =====
  const sheetResep = getSheetSipogim_('RESEP');
  const resepAda = sheetToObjectsSipogim_(sheetResep);
  const petaResepNamaKeId = {};
  resepAda.forEach(r => { petaResepNamaKeId[r.NAMA_NORM] = r.ID; });
  let idResepBerikutnya = (Math.max(0, ...resepAda.map(r => parseInt(String(r.ID).replace('RS', ''), 10) || 0))) + 1;

  const petaIdAsliKeIdBaru = {};
  const barisBaruResep = [];
  const barisBaruResepBahan = [];
  let resepBaru = 0, resepDilewati = 0;
  const peringatanBahanHilang = [];

  DATA_IMPOR_RESEP.forEach(r => {
    const namaNorm = normalisasiNamaSipogim_(r.nama);
    if (petaResepNamaKeId[namaNorm]) {
      petaIdAsliKeIdBaru[r.idAsli] = petaResepNamaKeId[namaNorm];
      resepDilewati++;
      return;
    }
    const id = 'RS' + String(idResepBerikutnya++).padStart(3, '0');
    barisBaruResep.push([id, r.nama, namaNorm, r.kategori, 'utuh', 'draf', '', '', '', 1, 'Impor Awal', new Date()]);
    petaResepNamaKeId[namaNorm] = id;
    petaIdAsliKeIdBaru[r.idAsli] = id;

    r.bahan.forEach((bh, i) => {
      const bahanNamaNorm = normalisasiNamaSipogim_(bh.namaBahan);
      const bahanId = petaBahanNamaKeId[bahanNamaNorm];
      if (!bahanId) { peringatanBahanHilang.push('Resep "' + r.nama + '": bahan "' + bh.namaBahan + '" tidak ditemukan.'); return; }
      barisBaruResepBahan.push([Utilities.getUuid(), id, bahanId, bh.gramBesar, bh.gramKecil, i + 1, '']);
    });
    resepBaru++;
  });
  if (barisBaruResep.length) sheetResep.getRange(sheetResep.getLastRow() + 1, 1, barisBaruResep.length, 12).setValues(barisBaruResep);
  if (barisBaruResepBahan.length) {
    const sheetRB = getSheetSipogim_('RESEP_BAHAN');
    sheetRB.getRange(sheetRB.getLastRow() + 1, 1, barisBaruResepBahan.length, 7).setValues(barisBaruResepBahan);
  }

  // ===== 3. PADANAN_NAMA =====
  const sheetPadanan = getSheetSipogim_('PADANAN_NAMA');
  const padananAda = sheetToObjectsSipogim_(sheetPadanan);
  const padananNamaSet = new Set(padananAda.map(p => p.NAMA_NORM));
  let idPadananBerikutnya = (Math.max(0, ...padananAda.map(p => parseInt(String(p.ID).replace('PD', ''), 10) || 0))) + 1;

  const barisBaruPadanan = [];
  let padananBaru = 0, padananDilewati = 0, padananTanpaResepDiSumber = 0;
  DATA_IMPOR_PADANAN.forEach(p => {
    const namaNorm = normalisasiNamaSipogim_(p.namaMenu);
    if (padananNamaSet.has(namaNorm)) { padananDilewati++; return; }
    const id = 'PD' + String(idPadananBerikutnya++).padStart(3, '0');
    if (p.idResepAsli === null) {
      // File sumber sendiri belum punya padanan utk nama ini (lihat 3 contoh:
      // Parsley/Biji Wijen/Jasuke) -- tetap diimpor supaya langsung masuk
      // antrian Beranda, BUKAN diam-diam dilewati.
      barisBaruPadanan.push([id, namaNorm, p.namaMenu, '', 'belum_ada_resep', 'manual', '', '', '']);
      padananTanpaResepDiSumber++;
    } else {
      const resepId = petaIdAsliKeIdBaru[p.idResepAsli];
      if (!resepId) { padananDilewati++; return; } // resepnya sendiri gagal diimpor -- seharusnya tidak pernah terjadi, lihat peringatan
      barisBaruPadanan.push([id, namaNorm, p.namaMenu, resepId, 'terkonfirmasi', 'manual', '', 'Impor Awal', new Date()]);
    }
    padananNamaSet.add(namaNorm);
    padananBaru++;
  });
  if (barisBaruPadanan.length) sheetPadanan.getRange(sheetPadanan.getLastRow() + 1, 1, barisBaruPadanan.length, 9).setValues(barisBaruPadanan);

  const detikBerlalu = ((new Date().getTime()) - waktuMulai) / 1000;
  Logger.log('=== IMPOR DATA AWAL SELESAI (' + detikBerlalu.toFixed(1) + ' detik) ===');
  Logger.log('Bahan: ' + bahanBaru + ' baru, ' + bahanDilewati + ' dilewati (sudah ada sebelumnya).');
  Logger.log('Resep: ' + resepBaru + ' baru, ' + resepDilewati + ' dilewati (sudah ada sebelumnya). Baris Resep_Bahan ditulis: ' + barisBaruResepBahan.length + '.');
  Logger.log('Padanan Nama: ' + padananBaru + ' baru (termasuk ' + padananTanpaResepDiSumber + ' tanpa resep -- masuk antrian "belum ada resep"), ' + padananDilewati + ' dilewati.');
  if (peringatanBahanHilang.length) {
    Logger.log('PERINGATAN -- ' + peringatanBahanHilang.length + ' baris bahan tidak ditemukan di master Bahan:');
    peringatanBahanHilang.slice(0, 20).forEach(p => Logger.log('  ' + p));
    if (peringatanBahanHilang.length > 20) Logger.log('  ...dan ' + (peringatanBahanHilang.length - 20) + ' lainnya.');
  }
}

