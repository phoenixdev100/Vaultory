/** Dispatched by anything that wants to open the palette (top bar search). */
export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent('vaultory:open-palette'));
}
