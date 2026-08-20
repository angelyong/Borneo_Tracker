import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import i18n from '../../i18n';
import AboutPage from './AboutPage';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

function renderAbout() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(
      <MemoryRouter>
        <AboutPage />
      </MemoryRouter>
    );
  });
}

describe('AboutPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ms');
  });

  afterEach(async () => {
    await i18n.changeLanguage('en');
    act(() => {
      root?.unmount();
    });
    container?.remove();
    container = null;
    root = null;
  });

  it('uses stable section ids instead of translated headings', () => {
    renderAbout();

    expect(document.querySelector('#how-it-works')?.textContent).toBe('Cara Ia Berfungsi');
    expect(document.querySelector('section[aria-labelledby="how-it-works"]')).toBeTruthy();
    expect(document.querySelector('#cara-ia-berfungsi')).toBeFalsy();
  });
});
