// Brauzer ichidagi demo "server": holat localStorage'da saqlanadi.
import { useSyncExternalStore } from 'react';
import { createSeed } from '../data/seed.js';

const KEY = 'regup-demo-state';
const SESSION_KEY = 'regup-demo-session';

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s.schema === createSeed().schema) return s;
    }
  } catch {
    /* buzilgan saqlov — seed */
  }
  return createSeed();
}

let state = load();
let session = (() => {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY)) || { mode: 'admin', employeeId: 'e-malika' };
  } catch {
    return { mode: 'admin', employeeId: 'e-malika' };
  }
})();
let toasts = [];
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const getState = () => state;
export function setState(next) {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* saqlov yo'q (sandbox) — holat faqat xotirada */ }
  emit();
}
export const useAppState = () => useSyncExternalStore(subscribe, () => state);

export const useSession = () => useSyncExternalStore(subscribe, () => session);
export function setSession(patch) {
  session = { ...session, ...patch };
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch { /* sandbox */ }
  emit();
}

export const useToasts = () => useSyncExternalStore(subscribe, () => toasts);
export function toast(text, tone = 'good') {
  const id = Math.random().toString(36).slice(2);
  toasts = [...toasts, { id, text, tone }];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, tone === 'bad' ? 6000 : 3000);
}

/** Domen amalini bajaradi: xato bo'lsa holat o'zgarmaydi va sabab ko'rsatiladi. */
export function run(fn, payload, okText) {
  try {
    setState(fn(state, payload));
    if (okText) toast(okText);
    return true;
  } catch (e) {
    toast(e.message, 'bad');
    return false;
  }
}

export function resetDemo() {
  setState(createSeed());
  toast('Demo ma’lumotlar boshlang‘ich holatga qaytarildi');
}
