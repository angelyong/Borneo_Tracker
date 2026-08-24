import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import i18n from '../i18n';
import ScoreExplainer from './ScoreExplainer';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

function render(ui) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(ui);
  });
}

function click(element) {
  act(() => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

describe('ScoreExplainer', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
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

  it('opens by click and explains index, strict score and gap', () => {
    render(<ScoreExplainer />);

    const button = document.querySelector('button[aria-label="Explain Resilience Index, Strict score and fragility gap"]');
    click(button);

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('arithmetic mean');
    expect(dialog?.textContent).toContain('geometric mean');
    expect(dialog?.textContent).toContain('imbalance');
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });

  // The Dashboard mounts this beside the Strict score, so its accessible name
  // has to describe that job rather than reuse the Regional Details wording.
  it('accepts the strict-score label the Dashboard passes and shows the client question', () => {
    render(<ScoreExplainer labelKey="scoreExplainer.strictOpenLabel" />);

    const button = document.querySelector(
      'button[aria-label="Explain why the Index and Strict scores differ"]'
    );
    expect(button).toBeTruthy();
    click(button);

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog.getAttribute('aria-label')).toBe('Why are these scores different?');
    expect(dialog.textContent).toContain('Why are these scores different?');
  });

  it('closes on Escape and returns focus to the trigger', () => {
    render(<ScoreExplainer />);

    const button = document.querySelector('button[aria-label="Explain Resilience Index, Strict score and fragility gap"]');
    click(button);
    button.focus();

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(document.querySelector('[role="dialog"]')).toBeFalsy();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(button);
  });
});
