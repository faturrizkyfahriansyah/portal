/* api.js — klien untuk backend Google Apps Script (Web App).
 * POST text/plain (tanpa preflight CORS). Token sesi disimpan di localStorage; tidak ada rahasia di sini. */
const CFG = window.SIPENDOK_CONFIG || {};
const TOKEN = 'sipendok.token', USER = 'sipendok.user';

export class ApiError extends Error {
  constructor(message, code, details) { super(message); this.code = code || 'ERROR'; this.details = details || null; }
}
export const session = {
  get token() { return localStorage.getItem(TOKEN); },
  get user() { try { return JSON.parse(localStorage.getItem(USER)); } catch { return null; } },
  set(token, user) { localStorage.setItem(TOKEN, token); localStorage.setItem(USER, JSON.stringify(user)); },
  clear() { localStorage.removeItem(TOKEN); localStorage.removeItem(USER); }
};
let authLost = () => {};
export const onAuthLost = (fn) => { authLost = fn; };
export const apiConfigured = () => !!CFG.API_URL && !/^GANTI/.test(CFG.API_URL);

export async function api(action, data = {}, opts = {}) {
  if (!apiConfigured()) throw new ApiError('API_URL belum diatur. Isi frontend/config.js dengan URL Web App Apps Script.', 'KONFIG');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeout || 60000);
  let res;
  try {
    res = await fetch(CFG.API_URL, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow', signal: ctrl.signal,
      body: JSON.stringify({ action, token: session.token, data })
    });
  } catch (e) {
    throw new ApiError(e.name === 'AbortError' ? 'Waktu permintaan habis. Periksa hasilnya di Arsip sebelum mengulang.' : 'Tidak dapat terhubung ke server. Periksa koneksi internet.', 'JARINGAN');
  } finally { clearTimeout(timer); }
  let json;
  try { json = await res.json(); } catch { throw new ApiError('Respons server tidak dapat dibaca. Pastikan Web App sudah di-deploy (akses: Anyone).', 'RESPON'); }
  if (!json.ok) {
    if (json.code === 'SESI_HABIS') { session.clear(); authLost(); }
    throw new ApiError(json.error, json.code, json.details);
  }
  return json.data;
}
