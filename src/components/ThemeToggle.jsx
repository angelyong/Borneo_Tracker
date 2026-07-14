import { useState } from 'react';
import { Icons } from './ui';
import { applyTheme, getCurrentTheme } from '../utils/theme';

// Caller supplies `style` so this can drop into any icon-button slot (e.g.
// MiniTopBar's existing circular icon buttons) without duplicating that CSS.
const ThemeToggle = ({ style }) => {
  const [theme, setTheme] = useState(getCurrentTheme);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setTheme(next);
  };

  const Icon = theme === 'dark' ? Icons.Sun : Icons.Moon;
  const label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';

  return (
    <button type="button" onClick={toggle} aria-label={label} title={label} style={style}>
      <Icon size={19} />
    </button>
  );
};

export default ThemeToggle;
