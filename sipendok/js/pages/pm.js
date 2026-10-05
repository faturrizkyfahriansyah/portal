import { h, icon } from '../util.js';
import { api } from '../api.js';
import { S, refreshMaster } from '../store.js';
import { toast, modal, chip, emptyState, errMsg, field, banner } from '../ui.js';

export async function render(root, ctx) {
  let q = '', showOff = false;
  const list = h('div', { class: 'list' });
  const search = h('input', { class: 'input', type: 'search', placeholder: 'Cari nama PM…', 'aria-label': 'Cari PM', oninput: (e) => { q = e.target.value.trim().toLowerCase(); draw(); } });
  const sw = h('input', { type: 'checkbox', onchange: (e) => { showOff = e.target.checked; draw(); } });
  root.append(
    h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Penerima Manfaat'), h('div', { class: 'sub' }, 'Master PM — nama dipilih otomatis di penerimaan harian')), h('div', { class: 'spacer' }),
      h('button', { class: 'btn', onclick: () => openForm(null) }, icon('plus', 18), 'Tambah PM')),
    h('div', { class: 'card' }, search, h('label', { class: 'switch', style: { marginTop: '10px' } }, sw, 'Tampilkan PM tidak aktif')), h('div', { style: { height: '12px' } }), list);

  function draw() {
    const rows = S.pm.filter((p) => (showOff || p.STATUS === 'Aktif') && (!q || p.NAMA_PM.toLowerCase().includes(q)));
    if (!rows.length) { list.replaceChildren(emptyState('users', 'PM tidak ditemukan')); return; }
    list.replaceChildren(...rows.map((p) => h('button', { class: 'item' + (p.STATUS !== 'Aktif' ? ' off' : ''), style: { textAlign: 'left', width: '100%', cursor: 'pointer', font: 'inherit' }, onclick: () => openForm(p) },
      h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'title' }, p.NAMA_PM), h('div', { class: 'sub' }, `${p.ID_PM}${p.ALAMAT ? ' · ' + p.ALAMAT : ''}`)),
        chip(p.JENIS_PM, 'info'), chip(p.STATUS, p.STATUS === 'Aktif' ? 'ok' : '')),
      p.KETERANGAN ? h('div', { class: 'hint', style: { marginTop: '6px' } }, p.KETERANGAN) : null)));
  }

  function openForm(pm) {
    const nama = h('input', { class: 'input', value: pm ? pm.NAMA_PM : '', maxlength: 120, autocomplete: 'off' });
    const jenis = h('select', { class: 'select' }, ['SEKOLAH', 'POSYANDU'].map((j) => h('option', { value: j, selected: pm && pm.JENIS_PM === j }, j)));
    const alamat = h('textarea', { class: 'input', maxlength: 250 }, pm ? pm.ALAMAT : '');
    const status = h('select', { class: 'select' }, ['Aktif', 'Tidak Aktif'].map((s) => h('option', { value: s, selected: pm && pm.STATUS === s }, s)));
    const ket = h('textarea', { class: 'input', maxlength: 250 }, pm ? pm.KETERANGAN : '');
    const err = h('div', {});
    modal({
      title: pm ? 'Ubah PM' : 'Tambah PM',
      body: h('div', { class: 'form-grid' }, field('Nama PM', nama), field('Jenis PM', jenis, pm ? 'Jenis tidak dapat diubah bila PM sudah punya riwayat penerimaan.' : 'SEKOLAH: Porsi Kecil, Porsi Besar, Tenaga Pendidik. POSYANDU: Balita, Bumil, Busui.'),
        field('Alamat', alamat), field('Status', status, 'PM tidak aktif tidak muncul di input harian.'), field('Keterangan', ket), err),
      actions: [{ label: 'Batal', kind: 'ghost' }, {
        label: 'Simpan', onClick: async (ev) => {
          const btn = ev.currentTarget; btn.disabled = true; err.replaceChildren();
          try {
            await api('pm.save', { ID_PM: pm ? pm.ID_PM : undefined, NAMA_PM: nama.value, JENIS_PM: jenis.value, ALAMAT: alamat.value, STATUS: status.value, KETERANGAN: ket.value });
            await refreshMaster(); draw(); toast(pm ? 'PM diperbarui.' : 'PM ditambahkan.', 'ok');
          } catch (e) { err.replaceChildren(banner('err', errMsg(e))); btn.disabled = false; return false; }
        } }]
    });
  }
  draw();
}
