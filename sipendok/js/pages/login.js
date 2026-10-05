import { h, icon } from '../util.js';
import { api, session, apiConfigured } from '../api.js';
import { banner, errMsg } from '../ui.js';

export function renderLogin(app, onSuccess) {
  const err = h('div', { id: 'login-err' });
  const user = h('input', { class: 'input', id: 'lu', autocomplete: 'username', autocapitalize: 'none', autocorrect: 'off', spellcheck: 'false', required: true });
  const pin = h('input', { class: 'input', id: 'lp', type: 'password', autocomplete: 'current-password', inputmode: 'text', required: true });
  const btn = h('button', { class: 'btn big block', type: 'submit' }, 'Masuk');
  const form = h('form', { onsubmit: async (e) => {
    e.preventDefault(); err.replaceChildren(); btn.disabled = true; btn.textContent = 'Memeriksa…';
    try {
      const r = await api('login', { username: user.value, pin: pin.value });
      session.set(r.token, { nama: r.nama, username: r.username });
      await onSuccess();
    } catch (ex) { err.replaceChildren(banner('err', errMsg(ex))); pin.value = ''; pin.focus(); }
    finally { btn.disabled = false; btn.textContent = 'Masuk'; }
  } },
    h('div', { class: 'field' }, h('label', { for: 'lu' }, 'Nama pengguna'), user),
    h('div', { class: 'field' }, h('label', { for: 'lp' }, 'PIN'), pin),
    err, btn);
  app.replaceChildren(h('div', { class: 'login' },
    h('div', { class: 'logo' }, h('img', { src: 'icons/icon-192.png', alt: '' }), h('div', {}, h('h1', {}, 'SIPENDOK'), h('div', { class: 'tag' }, 'Sistem Informasi Penerimaan & Dokumen'), h('div', { class: 'tag' }, 'SPPG Jeungjing'))),
    apiConfigured() ? null : h('div', { style: { marginBottom: '14px' } }, banner('warn', h('b', {}, 'API belum diatur. '), 'Isi ', h('code', {}, 'API_URL'), ' pada ', h('code', {}, 'frontend/config.js'), ' dengan URL Web App Apps Script.')),
    form,
    h('p', { class: 'hint', style: { marginTop: '18px', textAlign: 'center' } }, 'Akun dibuat oleh pengelola melalui Apps Script.')));
  setTimeout(() => user.focus(), 50);
}
