export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"'`]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }[c]));
export const opt = (arr, cur) => arr.map((o) => { const v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o; return `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(l)}</option>`; }).join('');
export const slug = (x) => x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9.]+/g, '-').replace(/^-|-$/g, '');
export const val = (id) => (document.getElementById(id) || {}).value || '';
export const TODAY = '16/10/2026';
