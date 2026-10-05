import { h, icon, num, todayJakarta, tglIndo, tglPendek, hariIndo, addDays, waktuIndo, BULAN, KAT_LABEL } from '../util.js';
import { api } from '../api.js';
import { S, tahunAktif } from '../store.js';
import { toast, modal, confirmDialog, chip, banner, skeleton, emptyState, linkBtn, errMsg, field } from '../ui.js';

export async function render(root, ctx) {
  const tab = ctx.params.tab === 'riwayat' ? 'riwayat' : 'input';
  root.append(
    h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Penerimaan'), h('div', { class: 'sub' }, 'Catat paket yang diterima setiap PM')) ),
    h('div', { class: 'tabs' },
      h('a', { href: '#/penerimaan', class: tab === 'input' ? 'on' : '' }, 'Input Harian'),
      h('a', { href: '#/penerimaan?tab=riwayat', class: tab === 'riwayat' ? 'on' : '' }, 'Riwayat')));
  const body = h('div', {}); root.append(body);
  if (tab === 'riwayat') return riwayat(body, ctx);
  return input(body, ctx);
}

/* =====================================================================  INPUT HARIAN  */
async function input(root, ctx) {
  let tgl = ctx.params.tanggal || todayJakarta();
  let data = null, dirty = false;
  const cards = {};          // ID_PM -> {card, inputs:{kat:el}, totalEl, item}
  ctx.setGuard(() => dirty);

  const dateIn = h('input', { class: 'input', type: 'date', id: 'tgl', value: tgl, max: addDays(todayJakarta(), 7),
    onchange: async (e) => {
      const v = e.target.value; if (!v) { e.target.value = tgl; return; }
      if (dirty && !(await confirmDialog({ title: 'Ganti tanggal?', message: 'Perubahan yang belum disimpan akan dibuang.', confirmText: 'Buang & ganti', danger: true }))) { e.target.value = tgl; return; }
      tgl = v; dirty = false; load();
    } });
  const dayChip = h('span', { class: 'chip info' });
  const info = h('div', { class: 'stack' });
  const list = h('div', { class: 'stack', style: { marginTop: '12px' } });
  const btnLast = h('button', { class: 'btn ghost sm', type: 'button', onclick: isiTerakhir }, icon('refresh', 16), 'Isi dari penerimaan terakhir');
  root.append(
    h('div', { class: 'card' }, h('div', { class: 'row wrap', style: { alignItems: 'flex-end' } },
      h('div', { class: 'grow', style: { minWidth: '180px' } }, field('Tanggal penerimaan', dateIn)), dayChip), h('div', { style: { marginTop: '10px' } }, btnLast)),
    info, list);

  const sumTotal = h('b', { class: 'num' }, '0'), sumInfo = h('span', {}, ''), btnSave = h('button', { class: 'btn big', type: 'button', onclick: simpan, disabled: true }, icon('check', 20), 'Simpan Semua');
  const bar = h('div', { class: 'savebar' }, h('div', { class: 'inner' }, h('div', { class: 'sum' }, h('div', {}, sumTotal, ' paket'), sumInfo), btnSave));
  ctx.withBar(bar);

  function val(el) { return el.value === '' ? null : Number(el.value); }
  function cardTotal(c) { return Object.values(c.inputs).reduce((a, el) => a + (val(el) || 0), 0); }
  function filled(c) { return Object.values(c.inputs).some((el) => el.value !== ''); }
  function invalid(el) { const v = val(el); return v !== null && (!Number.isInteger(v) || v < 0); }

  function recompute() {
    let total = 0, terisi = 0, n = 0, bad = false;
    Object.values(cards).forEach((c) => {
      n++; const t = cardTotal(c); total += t;
      if (filled(c)) terisi++;
      c.totalEl.textContent = filled(c) ? num(t) : '—';
      Object.values(c.inputs).forEach((el) => { const b = invalid(el); el.style.borderColor = b ? 'var(--err)' : ''; if (b) bad = true; });
    });
    sumTotal.textContent = num(total); sumInfo.textContent = `${terisi} dari ${n} PM terisi`;
    btnSave.disabled = !dirty || bad || !terisi;
  }

  function buildCard(it) {
    const inputs = {};
    const grid = h('div', { class: 'inputs ' + (it.kategori.length === 3 ? 'c3' : 'c2') }, it.kategori.map((k) => {
      const el = h('input', { class: 'input num-in', type: 'number', inputmode: 'numeric', pattern: '[0-9]*', min: '0', step: '1', placeholder: '0',
        value: it.nilai ? String(it.nilai[k]) : '', 'aria-label': `${KAT_LABEL[k]} — ${it.NAMA_PM}`,
        oninput: () => { dirty = true; card.classList.remove('saved'); card.classList.add('empty'); recompute(); } });
      inputs[k] = el;
      return h('div', {}, h('label', {}, KAT_LABEL[k]), el);
    }));
    const kend = h('input', { class: 'input', type: 'text', maxlength: 20, autocapitalize: 'characters', autocomplete: 'off', placeholder: 'opsional', value: it.noKendaraan || '',
      'aria-label': 'No. Kendaraan — ' + it.NAMA_PM, oninput: () => { dirty = true; recompute(); } });
    const totalEl = h('span', { class: 'total num' }, it.total === null ? '—' : num(it.total));
    const picEl = it.pic ? h('span', { class: 'muted' }, 'PIC: ' + it.pic.nama) : h('span', { style: { color: 'var(--err)', fontWeight: 700 } }, 'PIC belum diisi');
    const card = h('div', { class: 'card pm-card ' + (it.tersimpan ? 'saved' : 'empty'), 'data-pm': it.ID_PM },
      h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'name' }, it.NAMA_PM), h('div', { class: 'meta' }, it.JENIS_PM)),
        it.tersimpan ? chip('Tersimpan', 'ok') : chip('Belum diisi'), it.STATUS !== 'Aktif' ? chip('Tidak aktif', 'warn') : null),
      grid,
      h('div', { class: 'veh' }, h('label', {}, 'No. Kendaraan'), kend),
      h('div', { class: 'foot' }, picEl, h('span', {}, h('button', { class: 'linkbtn', type: 'button', title: 'Isi semua 0 bila PM tidak menerima hari ini',
        onclick: () => { Object.values(inputs).forEach((el) => { el.value = '0'; }); dirty = true; recompute(); } }, 'Tidak menerima (0)'), ' ', h('span', { class: 'muted' }, 'Total '), totalEl)));
    cards[it.ID_PM] = { card, inputs, kend, totalEl, item: it };
    return card;
  }

  async function load() {
    list.replaceChildren(skeleton(4)); info.replaceChildren(); Object.keys(cards).forEach((k) => delete cards[k]);
    try { data = await api('penerimaan.get', { tanggal: tgl }); }
    catch (e) { if (ctx.alive()) list.replaceChildren(banner('err', errMsg(e))); return; }
    if (!ctx.alive()) return;
    dayChip.textContent = `${hariIndo(tgl)}, ${tglIndo(tgl)}`;
    if (data.dokumen) info.append(data.perluRevisi
      ? banner('warn', h('b', {}, 'Dokumen tanggal ini sudah dibuat. '), 'Jika Anda mengubah data, dokumen perlu dibuat ulang.')
      : banner('ok', 'Dokumen untuk tanggal ini sudah dibuat. Perubahan data akan meminta pembuatan ulang dokumen.'));
    if (!data.items.length) { list.replaceChildren(emptyState('users', 'Belum ada PM aktif', 'Tambahkan PM di menu PM.')); recompute(); return; }
    list.replaceChildren(...data.items.map(buildCard));
    dirty = false; recompute();
    if (ctx.params.pm && cards[ctx.params.pm]) {
      const c = cards[ctx.params.pm].card; setTimeout(() => { c.scrollIntoView({ block: 'center', behavior: 'smooth' }); c.classList.add('flash'); }, 80);
    }
  }

  async function isiTerakhir() {
    btnLast.disabled = true;
    try {
      const r = await api('penerimaan.terakhir', { tanggal: tgl });
      if (!r.tanggal) { toast('Belum ada penerimaan sebelumnya.', 'warn'); return; }
      let n = 0;
      r.rows.forEach((row) => {
        const c = cards[row.ID_PM];
        if (!c || c.item.tersimpan || filled(c)) return;          // jangan timpa yang sudah terisi / tersimpan
        Object.entries(c.inputs).forEach(([k, el]) => { el.value = String(row.nilai[k] ?? 0); });
        n++;
      });
      if (n) { dirty = true; recompute(); toast(`${n} PM diisi dari ${tglPendek(r.tanggal)}. Periksa lalu simpan.`, 'ok'); }
      else toast('Semua PM sudah terisi — tidak ada yang diubah.', 'info');
    } catch (e) { toast(errMsg(e), 'err'); } finally { btnLast.disabled = false; }
  }

  async function simpan() {
    const rows = Object.entries(cards).filter(([, c]) => filled(c)).map(([id, c]) => ({
      ID_PM: id, noKendaraan: c.kend.value.trim(), nilai: Object.fromEntries(Object.entries(c.inputs).map(([k, el]) => [k, el.value === '' ? '' : Number(el.value)])) }));
    if (!rows.length) { toast('Belum ada jumlah yang diisi.', 'warn'); return; }
    btnSave.disabled = true; btnSave.textContent = 'Menyimpan…';
    try {
      const r = await api('penerimaan.save', { tanggal: tgl, rows });
      dirty = false;
      toast(`Tersimpan: ${r.baru} baru, ${r.diubah} diubah. Total ${num(r.totalPaket)} paket.`, 'ok', { action: { label: 'Buat dokumen', fn: () => ctx.go('dokumen?tanggal=' + tgl) }, ms: 6000 });
      await load();
    } catch (e) { toast(errMsg(e), 'err'); }
    finally { btnSave.textContent = ''; btnSave.append(icon('check', 20), 'Simpan Semua'); recompute(); }
  }

  await load();
}

/* =====================================================================  RIWAYAT  */
async function riwayat(root, ctx) {
  const f = { mode: 'bulan', tanggal: todayJakarta(), bulan: Number(todayJakarta().slice(5, 7)), tahun: Number(todayJakarta().slice(0, 4)), id_pm: '', id_pic: '', jenis: '' };
  const years = []; for (let y = tahunAktif() + 1; y >= 2024; y--) years.push(y);
  const filterBox = h('div', { class: 'card' }), out = h('div', { style: { marginTop: '12px' } });
  root.append(filterBox, out);

  const sel = (opts, value, onch, label) => { const s = h('select', { class: 'select', 'aria-label': label, onchange: (e) => onch(e.target.value) }, opts.map(([v, t]) => h('option', { value: v, selected: String(v) === String(value) }, t))); return s; };
  function drawFilters() {
    const seg = h('div', { class: 'seg' }, [['tanggal', 'Tanggal'], ['bulan', 'Bulan'], ['tahun', 'Tahun']].map(([m, t]) => h('button', { type: 'button', class: f.mode === m ? 'on' : '', onclick: () => { f.mode = m; drawFilters(); cari(); } }, t)));
    const periode = f.mode === 'tanggal'
      ? h('input', { class: 'input', type: 'date', value: f.tanggal, 'aria-label': 'Tanggal', onchange: (e) => { f.tanggal = e.target.value; cari(); } })
      : h('div', { class: 'grid2' },
        f.mode === 'bulan' ? sel(BULAN.map((b, i) => [i + 1, b]), f.bulan, (v) => { f.bulan = +v; cari(); }, 'Bulan') : null,
        sel(years.map((y) => [y, y]), f.tahun, (v) => { f.tahun = +v; cari(); }, 'Tahun'));
    filterBox.replaceChildren(seg, h('div', { style: { margin: '10px 0' } }, periode),
      h('div', { class: 'grid2' },
        sel([['', 'Semua PM'], ...S.pm.map((p) => [p.ID_PM, p.NAMA_PM])], f.id_pm, (v) => { f.id_pm = v; cari(); }, 'PM'),
        sel([['', 'Semua PIC'], ...S.pic.map((c) => [c.ID_PIC, c.NAMA_PIC])], f.id_pic, (v) => { f.id_pic = v; cari(); }, 'PIC'),
        sel([['', 'Semua jenis'], ['Sekolah', 'Sekolah'], ['Posyandu', 'Posyandu']], f.jenis, (v) => { f.jenis = v; cari(); }, 'Jenis PM')));
  }

  let reqId = 0;
  async function cari() {
    const my = ++reqId; out.replaceChildren(skeleton(3));
    const q = { id_pm: f.id_pm || undefined, id_pic: f.id_pic || undefined, jenis: f.jenis || undefined };
    if (f.mode === 'tanggal') q.tanggal = f.tanggal; else if (f.mode === 'bulan') { q.bulan = f.bulan; q.tahun = f.tahun; } else q.tahun = f.tahun;
    try {
      const r = await api('penerimaan.riwayat', q);
      if (my !== reqId || !ctx.alive()) return;
      draw(r);
    } catch (e) { if (my === reqId) out.replaceChildren(banner('err', errMsg(e))); }
  }

  function statusChip(s) { return chip(s, s === 'Sudah dibuat' ? 'ok' : s === 'Perlu revisi' ? 'err' : 'warn'); }
  function draw(r) {
    if (!r.rows.length) { out.replaceChildren(emptyState('inbox', 'Tidak ada data penerimaan', 'Ubah filter atau input penerimaan baru.')); return; }
    const total = r.rows.reduce((a, x) => a + x.TOTAL, 0);
    const nodes = [h('div', { class: 'muted', style: { margin: '2px 2px 0' } }, `${r.rows.length} catatan · total ${num(total)} paket`, r.terpotong ? ' (dibatasi 1.000 baris — persempit filter)' : '')];
    let lastDate = '';
    r.rows.forEach((x) => {
      if (x.TANGGAL !== lastDate) { lastDate = x.TANGGAL; nodes.push(h('div', { class: 'group-h' }, `${hariIndo(x.TANGGAL)}, ${tglIndo(x.TANGGAL)}`)); }
      nodes.push(h('div', { class: 'item' },
        h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'title' }, x.NAMA_PM), h('div', { class: 'sub' }, `${x.JENIS_PM} · PIC: ${x.NAMA_PIC || '-'}`)), h('div', { style: { textAlign: 'right' } }, h('div', { class: 'num', style: { fontWeight: 800, fontSize: '18px', color: 'var(--navy)' } }, num(x.TOTAL)), statusChip(x.statusDokumen))),
        h('div', { class: 'row wrap', style: { marginTop: '10px' } },
          h('button', { class: 'btn ghost sm', onclick: () => lihat(x) }, icon('eye', 16), 'Lihat'),
          h('a', { class: 'btn ghost sm', href: `#/penerimaan?tanggal=${x.TANGGAL}&pm=${x.ID_PM}` }, icon('edit', 16), 'Edit'),
          x.FILE_WORD ? linkBtn('Buka Dokumen', x.FILE_PDF || x.FILE_WORD, 'ghost sm', 'file') : null)));
    });
    out.replaceChildren(...nodes);
  }

  function lihat(x) {
    const allowed = S.kategori[x.JENIS_PM] || [];
    modal({ title: x.NAMA_PM,
      body: h('dl', { class: 'kv' },
        h('dt', {}, 'Tanggal'), h('dd', {}, `${hariIndo(x.TANGGAL)}, ${tglIndo(x.TANGGAL)}`),
        h('dt', {}, 'Jenis PM'), h('dd', {}, x.JENIS_PM),
        allowed.flatMap((k) => [h('dt', {}, KAT_LABEL[k]), h('dd', { class: 'num' }, num(x.nilai[k]))]),
        h('dt', {}, 'Total'), h('dd', { class: 'num' }, num(x.TOTAL)),
        h('dt', {}, 'PIC (data internal)'), h('dd', {}, x.NAMA_PIC || '-'),
        h('dt', {}, 'No. Kendaraan'), h('dd', {}, x.NO_KENDARAAN || '-'),
        h('dt', {}, 'Nomor BAST'), h('dd', {}, x.NOMOR_BAST || 'Belum ada'),
        h('dt', {}, 'Status dokumen'), h('dd', {}, x.statusDokumen),
        h('dt', {}, 'Diinput'), h('dd', {}, `${waktuIndo(x.WAKTU_INPUT)} oleh ${x.USER_INPUT || '-'}`)),
      actions: [{ label: 'Tutup', kind: 'ghost' }, { label: 'Edit', onClick: () => { ctx.go(`penerimaan?tanggal=${x.TANGGAL}&pm=${x.ID_PM}`); } }] });
  }

  drawFilters(); await cari();
}
