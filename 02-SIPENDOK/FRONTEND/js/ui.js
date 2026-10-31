/* ui.js — toast, modal/konfirmasi, overlay proses, potongan UI bersama. */
import { h, icon } from './util.js';

export function toast(msg, type = 'info', opts = {}) {
  const root = document.getElementById('toasts');
  const t = h('div', { class: 'toast ' + (type === 'info' ? '' : type), role: 'status' }, h('span', {}, msg));
  if (opts.action) t.append(h('button', { onclick: () => { opts.action.fn(); t.remove(); } }, opts.action.label));
  root.append(t);
  setTimeout(() => t.remove(), opts.ms || (type === 'err' ? 6500 : 3200));
}

/** Modal bawah (HP) / tengah (desktop). Mengembalikan {close, el}. */
export function modal({ title, body, actions = [], onClose, dismissible = true }) {
  const root = document.getElementById('modal-root');
  const overlay = h('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'Dialog' });
  const close = (v) => { overlay.remove(); document.removeEventListener('keydown', onKey); if (onClose) onClose(v); };
  const onKey = (e) => { if (e.key === 'Escape' && dismissible) close(); };
  const sheet = h('div', { class: 'sheet' }, title ? h('h2', {}, title) : null, body,
    actions.length ? h('div', { class: 'actions' }, actions.map((a) => h('button', {
      class: 'btn ' + (a.kind || ''), type: 'button', disabled: a.disabled,
      onclick: async (ev) => { const r = a.onClick ? await a.onClick(ev, { close }) : undefined; if (a.close !== false && r !== false) close(a.value); }
    }, a.label))) : null);
  overlay.append(sheet);
  if (dismissible) overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', onKey);
  root.append(overlay);
  const first = sheet.querySelector('input,select,textarea'); if (first) setTimeout(() => first.focus(), 60);
  return { close, el: sheet };
}

export function confirmDialog({ title, message, confirmText = 'Ya, lanjutkan', cancelText = 'Batal', danger = false }) {
  return new Promise((resolve) => {
    modal({
      title, body: typeof message === 'string' ? h('p', { style: { margin: 0 } }, message) : message,
      actions: [{ label: cancelText, kind: 'ghost', value: false }, { label: confirmText, kind: danger ? 'danger' : '', value: true }],
      onClose: (v) => resolve(v === true)
    });
  });
}

let busyEl = null;
export function showBusy(text, sub) {
  hideBusy();
  busyEl = h('div', { class: 'busy', role: 'alertdialog', 'aria-busy': 'true' },
    h('div', { class: 'box' }, h('div', { class: 'spinner' }), h('b', {}, text || 'Memproses…'), sub ? h('p', { class: 'muted', style: { margin: '6px 0 0', fontSize: '13px' } }, sub) : null));
  document.body.append(busyEl);
}
export function hideBusy() { if (busyEl) { busyEl.remove(); busyEl = null; } }

export const chip = (text, kind = '') => h('span', { class: 'chip ' + kind }, text);
export const banner = (kind, ...kids) => h('div', { class: 'banner ' + kind, role: kind === 'err' ? 'alert' : null }, icon(kind === 'ok' ? 'check' : kind === 'info' ? 'info' : 'alert', 18), h('div', {}, ...kids));
export const skeleton = (n = 3) => h('div', { class: 'stack' }, Array.from({ length: n }, () => h('div', { class: 'skel' })));
export const emptyState = (iconName, title, sub) => h('div', { class: 'empty-state' }, icon(iconName, 36), h('div', { style: { fontWeight: 800, color: 'var(--text)' } }, title), sub ? h('div', {}, sub) : null);

/** Tombol/ tautan yang membuka URL Drive di tab baru. */
export function linkBtn(label, href, kind = 'ghost sm', ico = 'external') {
  if (!href) return h('span', { class: 'chip' }, label + ': -');
  return h('a', { class: 'btn ' + kind, href, target: '_blank', rel: 'noopener noreferrer' }, icon(ico, 16), label);
}

export function field(label, control, hint) {
  const id = control.id || ('f' + Math.random().toString(36).slice(2, 8));
  control.id = id;
  return h('div', { class: 'field' }, h('label', { for: id }, label), control, hint ? h('div', { class: 'hint' }, hint) : null);
}

export function errMsg(e) { return (e && e.message) ? e.message : 'Terjadi kesalahan.'; }
