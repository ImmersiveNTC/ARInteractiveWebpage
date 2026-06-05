/**
 * ColorManager utility
 * Converts a hex code to HSL and applies variations for different layout areas.
 */

export class ColorManager {
  /**
   * Applies the theme color to the application by setting CSS variables on :root.
   * @param {string} hexCode - Hex color string (e.g., '#6366f1')
   */
  static setTheme(hexCode) {
    if (!hexCode || !/^#?[0-9A-F]{6}$/i.test(hexCode)) {
      console.warn('Invalid hex color provided to ColorManager. Using default #6366f1.');
      hexCode = '#6366f1';
    }

    const { h, s, l } = this.hexToHsl(hexCode);

    // Apply adjustments based on the single hex code:
    // 1. Base theme color
    const baseHsl = `hsl(${h}, ${s}%, ${l}%)`;
    const baseHslRaw = `${h}, ${s}%, ${l}%`;

    // 2. Header: Brighter and less saturated
    const headerS = Math.max(15, s - 30);
    const headerL = Math.min(88, l + 15);
    const headerHsl = `hsl(${h}, ${headerS}%, ${headerL}%)`;

    // 3. Footer: Brighter
    const footerL = Math.min(88, l + 15);
    const footerHsl = `hsl(${h}, ${s}%, ${footerL}%)`;

    // 4. Background: Darker and more saturated
    const bgS = Math.min(100, s + 15);
    const bgL = Math.max(8, Math.round(l * 0.15)); // ensure it remains a dark dark background
    const bgHsl = `hsl(${h}, ${bgS}%, ${bgL}%)`;

    // 5. Card glass border/accent color
    const accentL = Math.min(75, l + 5);
    const accentHsl = `hsl(${h}, ${s}%, ${accentL}%)`;

    const root = document.documentElement;
    root.style.setProperty('--theme-base-hex', hexCode);
    root.style.setProperty('--theme-base', baseHsl);
    root.style.setProperty('--theme-base-raw', baseHslRaw);
    root.style.setProperty('--theme-header', headerHsl);
    root.style.setProperty('--theme-footer', footerHsl);
    root.style.setProperty('--theme-background', bgHsl);
    root.style.setProperty('--theme-accent', accentHsl);

    window.dispatchEvent(new CustomEvent('themechanged', { detail: { hex: hexCode } }));

    console.log(`Theme updated successfully:
      Base: ${baseHsl}
      Header: ${headerHsl}
      Footer: ${footerHsl}
      Background: ${bgHsl}
    `);
  }

  /**
   * Helper to convert Hex to HSL
   * @param {string} hex
   * @returns {{h: number, s: number, l: number}}
   */
  static hexToHsl(hex) {
    hex = hex.replace(/^#/, '');
    
    let r = parseInt(hex.substring(0, 2), 16) / 255;
    let g = parseInt(hex.substring(2, 4), 16) / 255;
    let b = parseInt(hex.substring(4, 6), 16) / 255;

    let max = Math.max(r, g, b);
    let min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    let l = (max + min) / 2;

    if (max !== min) {
      let d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      
      switch (max) {
        case r: 
          h = (g - b) / d + (g < b ? 6 : 0); 
          break;
        case g: 
          h = (b - r) / d + 2; 
          break;
        case b: 
          h = (r - g) / d + 4; 
          break;
      }
      h /= 6;
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100)
    };
  }
}
