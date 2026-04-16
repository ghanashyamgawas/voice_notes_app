// utils/debounce.js
/*
  Simple debounce utility (no side effects).
  Returns a debounced function that delays invoking `fn`
  until after `wait` ms have elapsed since the last call.

  Usage:
    import { debounce } from './utils/debounce.js';
    const handler = debounce(() => { ... }, 300);
*/

export function debounce(fn, wait = 300) {
  let t = null;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}
