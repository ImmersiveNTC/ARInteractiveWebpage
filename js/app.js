import { ColorManager } from './ColorManager.js';
import '../components/Header.js';
import '../components/Background.js';
import '../components/Footer.js';
import '../components/Viewer.js';

// Initial default theme color
const DEFAULT_THEME = '#6366f1';

// Set initial theme before layout finishes loading to avoid flash
ColorManager.setTheme(DEFAULT_THEME);

// Bind theme picker on DOM load
document.addEventListener('DOMContentLoaded', () => {
  const picker = document.getElementById('themeColorPicker');
  if (picker) {
    picker.value = DEFAULT_THEME;
    picker.addEventListener('input', (e) => {
      ColorManager.setTheme(e.target.value);
    });
  }
});
