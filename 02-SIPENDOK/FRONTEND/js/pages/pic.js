import { h, icon } from '../util.js';
import { api } from '../api.js';
import { S, refreshMaster } from '../store.js';
import { toast, modal, chip, emptyState, errMsg, field, banner } from '../ui.js';

export async function render(root, ctx) {
  const list = h('div', { class: 'stack' });
  root.append(
    h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'PIC / Penanggung Jawab'), h('div', { class: 'sub' }, 'Data internal/riwayat · TIDAK otomatis dicetak ke dokumen (Nama & No. Telp penerima diisi manual)')), h('div', { class: 'spacer' }),
      h('button', { class: 'btn', onclick: () => openForm(null, null) }, icon('plus', 18), 'Tambah PIC')), list);

  function draw() {
    const pms = S.pm.filter((p) => p.STATUS === 'Aktif');
    const tanpa = pms.filter((p) => !S.pic.some((c) => c.ID_PM === p.ID_PM && c.STATUS === 'Aktif')).length;
    const nodes = [];
    if (tanpa) nodes.push(banner('info', h('b', {}, `${tanpa} PM belum memiliki PIC aktif.`), ' Dokumen tetap dapat dibuat; PIC hanya dicatat sebagai data riwayat.'));
    if (!pms.length) { list.replaceChildren(emptyState('users', 'Belum ada PM aktif')); return; }
    pms.forEach((pm) => {
      const pics = S.pic.filter((c) => c.ID_PM === pm.ID_PM).sort((a, b) => (a.STATUS === 'Aktif' ? 0 : 1) - (b.STATUS === 'Aktif' ? 0 : 1));
      const aktif = pics.some((c) => c.STATUS === 'Aktif');
      nodes.push(h('div', { class: 'card' },
        h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { style: { fontWeight: 800 } }, pm.NAMA_PM), h('div', { class: 'sub muted', style: { fontSize: '12.5px' } }, pm.JENIS_PM)),
          aktif ? null : h('button', { class: 'btn sm', onclick: () => openForm(null, pm.ID_PM) }, icon('plus', 16), 'Tambah PIC')),
        pics.length ? h('div', { class: 'divider' }) : null,
        pics.map((c) => h('div', { class: 'row', style: { padding: '6px 0', opacity: c.STATUS === 'Aktif' ? 1 : .55 } },
          h('div', { class: 'grow' }, h('div', { style: { fontWeight: 700 } }, c.NAMA_PIC, ' ', c.JABATAN ? h('span', { class: 'muted', style: { fontWeight: 500 } }, '· ' + c.JABATAN) : null),
            h('div', { class: 'hint' }, c.NOMOR_HP ? h('a', { href: 'tel:' + c.NOMOR_HP.replace(/[^\d+]/g, '') }, c.NOMOR_HP) : 'HP belum diisi', c.NOMOR_REKENING ? ` · Rek. ${c.NOMOR_REKENING}` : ' · Rekening belum diisi')),
          chip(c.STATUS, c.STATUS === 'Aktif' ? 'ok' : ''), h('button', { class: 'btn ghost icon', 'aria-label': 'Ubah PIC ' + c.NAMA_PIC, onclick: () => openForm(c, c.ID_PM) }, icon('edit', 18)))),
        !pics.length ? h('div', { class: 'hint', style: { color: 'var(--err)', fontWeight: 700, marginTop: '6px' } }, 'Belum ada PIC.') : null));
    });
    list.replaceChildren(...nodes);
  }

  function openForm(c, idPm) {
    const pm = h('select', { class: 'select', disabled: !!c }, S.pm.filter((p) => p.STATUS === 'Aktif' || p.ID_PM === idPm).map((p) => h('option', { value: p.ID_PM, selected: p.ID_PM === idPm }, p.NAMA_PM)));
    if (!idPm && !c) pm.prepend(h('option', { value: '', selected: true }, '— pilih PM —'));
    const nama = h('input', { class: 'input', value: c ? c.NAMA_PIC : '', maxlength: 100, autocomplete: 'off' });
    const jab = h('input', { class: 'input', value: c ? c.JABATAN : '', maxlength: 60, placeholder: 'mis. Kepala Sekolah, Guru, Kader' });
    const rek = h('input', { class: 'input', value: c ? c.NOMOR_REKENING : '', inputmode: 'numeric', maxlength: 30, autocomplete: 'off' });
    const hp = h('input', { class: 'input', type: 'tel', value: c ? c.NOMOR_HP : '', maxlength: 25 });
    const st = h('select', { class: 'select' }, ['Aktif', 'Tidak Aktif'].map((s) => h('option', { value: s, selected: c ? c.STATUS === s : s === 'Aktif' }, s)));
    const err = h('div', {});
    modal({
      title: c ? 'Ubah PIC' : 'Tambah PIC',
      body: h('div', { class: 'form-grid' }, field('PM', pm), field('Nama PIC', nama), field('Jabatan', jab), field('Nomor rekening', rek, 'Hanya angka. Disimpan sebagai teks.'), field('Nomor HP', hp), field('Status', st), err),
      actions: [{ label: 'Batal', kind: 'ghost' }, {
        label: 'Simpan', onClick: async (ev) => {
          const btn = ev.currentTarget; btn.disabled = true; err.replaceChildren();
          try {
            await api('pic.save', { ID_PIC: c ? c.ID_PIC : undefined, ID_PM: pm.value, NAMA_PIC: nama.value, JABATAN: jab.value, NOMOR_REKENING: rek.value, NOMOR_HP: hp.value, STATUS: st.value });
            await refreshMaster(); draw(); toast('PIC disimpan.', 'ok');
          } catch (e) { err.replaceChildren(banner('err', errMsg(e))); btn.disabled = false; return false; }
        } }]
    });
  }
  draw();
}
