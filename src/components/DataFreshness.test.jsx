import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import i18n from '../i18n';
import DataFreshness from './DataFreshness';

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

describe('DataFreshness', () => {
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

  it('opens a trust-chain popover from the freshness chip using artifact meta', () => {
    render(
      <DataFreshness
        generatedAt="2026-08-17"
        artifact={{
          meta: {
            schemaVersion: 1,
            updateCadence: 'mixed',
            sourceCount: 12,
            coverage: {
              totalRows: 102,
              canonicalRows: 48,
              territories: {
                Sabah: { latestYear: 2026 },
                Brunei: { latestYear: 2024 },
              },
            },
          },
          rows: [
            { source: 'DOSM / OpenDOSM', year: '2024' },
            { source: 'World Bank', year: '2023' },
            { source: 'NASA FIRMS', year: '2026-08-16' },
          ],
        }}
      />
    );

    const button = document.querySelector('button[aria-label="Open data freshness and trust-chain summary"]');
    expect(button).toBeTruthy();
    click(button);

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('Data trust chain');
    expect(dialog?.textContent).toContain('JSON built 17 Aug 2026');
    expect(dialog?.textContent).toContain('latest source observation year 2026');
    expect(dialog?.textContent).toContain('12 source labels');
    expect(dialog?.textContent).toContain('checked daily, updates when sources change');
    expect(dialog?.textContent).toContain('102 rows, 48 canonical');
    expect(dialog?.textContent).toContain('Using artifact metadata.');
    expect(dialog?.textContent).not.toContain('updated daily');
    expect(dialog?.textContent).not.toContain('verified daily');
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });

  it('falls back to visible rows when BT-16a meta is not present', () => {
    render(
      <DataFreshness
        generatedAt="2026-08-17"
        artifact={{
          rows: [
            { source: 'DOSM / OpenDOSM', year: '2024' },
            { source: 'World Bank', year: '2023' },
          ],
        }}
      />
    );

    click(document.querySelector('button'));

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('Metadata is unavailable here');
    expect(dialog?.textContent).toContain('2 source labels');
    expect(dialog?.textContent).toContain('latest source observation year 2024');
    expect(dialog?.textContent).toContain('2 rows');
  });

  it('closes on Escape and returns focus to the trigger', () => {
    render(<DataFreshness generatedAt="2026-08-17" />);

    const button = document.querySelector('button');
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
