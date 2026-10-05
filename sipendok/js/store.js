/* store.js — data master yang dimuat sekali (PM, PIC, tarif, pengaturan publik). */
import { api } from './api.js';

export const S = { user: null, settings: {}, pm: [], pic: [], tarif: null, kategori: {}, tarifMap: {}, folderRoot: '', versi: '' };

export async function loadBootstrap() { Object.assign(S, await api('bootstrap')); return S; }
export async function refreshMaster() {
  const [pm, pic] = await Promise.all([api('pm.list'), api('pic.list')]);
  S.pm = pm; S.pic = pic;
}
export const pmById = (id) => S.pm.find((p) => p.ID_PM === id);
export const picAktif = (idPm) => S.pic.find((p) => p.ID_PM === idPm && p.STATUS === 'Aktif');
export const tahunAktif = () => Number(S.settings.TAHUN_AKTIF) || new Date().getFullYear();
