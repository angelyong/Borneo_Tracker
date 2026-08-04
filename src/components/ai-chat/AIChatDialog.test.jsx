import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n';
import AIbotButton from '../AIbotButton';
import AIChatDialog from './AIChatDialog';
import AIChatMessage from './AIChatMessage';

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

function changeTextarea(element, value) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
  act(() => {
    setter.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function submitMessage(text) {
  const input = document.querySelector('#ai-chat-input');
  changeTextarea(input, text);
  await act(async () => {
    document.querySelector('.ai-chat-send').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

const successResponse = (body) => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve(body),
});

const errorResponse = (status, body = {}) => ({
  ok: false,
  status,
  json: () => Promise.resolve(body),
});

const geminiFixture = {
  answer: 'Forest cover is a verified dashboard indicator.',
  mode: 'gemini-test',
  sources: [{ title: 'Forest Cover', publisher: 'GFW', year: 2024, url: 'https://example.test/forest' }],
};

const fallbackFixture = {
  answer: 'This deterministic answer is still grounded in verified data.',
  mode: 'template-fallback',
  sources: [{ title: 'Resilience Methodology', publisher: 'Borneo Tracker', year: 2026 }],
  fallback: { used: true, reason: 'GEMINI_TIMEOUT', degraded: true },
};

const ControlledChat = () => {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <AIbotButton isOpen={open} onToggle={() => setOpen((value) => !value)} />
      <AIChatDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
};

describe('AI chat dialog', () => {
  beforeEach(async () => {
    vi.stubEnv('VITE_AI_CHAT_ENDPOINT', 'https://example.test/ai-chat');
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    await i18n.changeLanguage('en');
  });

  afterEach(async () => {
    await i18n.changeLanguage('en');
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    act(() => {
      root?.unmount();
    });
    container?.remove();
    container = null;
    root = null;
  });

  it('opens with an accessible dialog name and closes with Escape', () => {
    render(<MemoryRouter><ControlledChat /></MemoryRouter>);
    click(document.querySelector('[aria-label="AI Assistant"]'));
    expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-labelledby')).toBe('ai-chat-title');

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(document.querySelector('[role="dialog"]')).toBeFalsy();
  });

  it('renders the user message and loading announcement while pending', () => {
    render(<MemoryRouter><ControlledChat /></MemoryRouter>);
    click(document.querySelector('[aria-label="AI Assistant"]'));

    const send = document.querySelector('[aria-label="Send message"]');
    expect(send.disabled).toBe(true);

    changeTextarea(document.querySelector('#ai-chat-input'), 'What is Borneo Tracker?');
    expect(send.disabled).toBe(false);
    click(send);

    expect(document.body.textContent).toContain('What is Borneo Tracker?');
    expect(document.querySelector('[role="status"]')?.getAttribute('aria-label')).toBe('Assistant is loading');
    expect(send.disabled).toBe(true);
  });

  it('sends with Enter and preserves multiline with Shift+Enter', async () => {
    fetch.mockResolvedValueOnce(successResponse(geminiFixture));
    render(<MemoryRouter><ControlledChat /></MemoryRouter>);
    click(document.querySelector('[aria-label="AI Assistant"]'));

    const input = document.querySelector('#ai-chat-input');
    changeTextarea(input, 'Line one');
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, shiftKey: true }));
    });
    expect(fetch).not.toHaveBeenCalled();

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('renders Gemini responses and safe source links', async () => {
    fetch.mockResolvedValueOnce(successResponse(geminiFixture));
    render(<MemoryRouter><ControlledChat /></MemoryRouter>);
    click(document.querySelector('[aria-label="AI Assistant"]'));

    await submitMessage('Explain forest cover');

    expect(document.body.textContent).toContain(geminiFixture.answer);
    const link = document.querySelector('.ai-chat-source');
    expect(link?.textContent).toContain('Forest Cover / GFW / 2024');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link?.getAttribute('href')).toBe('https://example.test/forest');
  });

  it('renders template fallback, blocked, and clarification answers as normal success', async () => {
    fetch
      .mockResolvedValueOnce(successResponse(fallbackFixture))
      .mockResolvedValueOnce(successResponse({ ...fallbackFixture, answer: 'This comparison is blocked by methodology.', fallback: { used: true, reason: 'DETERMINISTIC_BLOCKED', degraded: false } }))
      .mockResolvedValueOnce(successResponse({ ...fallbackFixture, answer: 'Which territory do you mean?', fallback: { used: true, reason: 'DETERMINISTIC_CLARIFICATION', degraded: false } }));

    render(<MemoryRouter><ControlledChat /></MemoryRouter>);
    click(document.querySelector('[aria-label="AI Assistant"]'));

    await submitMessage('fallback');
    expect(document.body.textContent).toContain('Verified data response');
    expect(document.body.textContent).toContain(fallbackFixture.answer);
    expect(document.querySelector('[role="alert"]')).toBeFalsy();

    await submitMessage('blocked');
    await submitMessage('clarify');
    expect(document.body.textContent).toContain('This comparison is blocked by methodology.');
    expect(document.body.textContent).toContain('Which territory do you mean?');
  });

  it('renders the fallback label in Malay', async () => {
    await i18n.changeLanguage('ms');
    fetch.mockResolvedValueOnce(successResponse(fallbackFixture));
    render(<MemoryRouter><ControlledChat /></MemoryRouter>);
    click(document.querySelector('[aria-label="AI Assistant"]'));

    await submitMessage('fallback');
    expect(document.body.textContent).toContain('Jawapan data yang disahkan');
  });

  it('shows manual retry only for retryable errors and prevents duplicate submission', async () => {
    let resolveFetch;
    fetch.mockImplementationOnce(() => new Promise((resolve) => {
      resolveFetch = resolve;
    }));

    render(<MemoryRouter><ControlledChat /></MemoryRouter>);
    click(document.querySelector('[aria-label="AI Assistant"]'));
    await act(async () => {
      submitMessage('Try once');
      submitMessage('Try twice');
    });
    expect(fetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFetch(errorResponse(500));
    });
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('server had a problem');
    expect(document.querySelector('[role="alert"] button')?.textContent).toBe('Retry');

    fetch.mockResolvedValueOnce(errorResponse(400, { code: 'INVALID_REQUEST' }));
    await submitMessage('Bad request');
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('request could not be sent');
    expect(document.querySelector('[role="alert"] button')).toBeFalsy();
  });

  it('handles missing source fields, unsafe URLs, internal fields, quota absence, and optional quota', () => {
    render(
      <AIChatMessage
        message={{
          id: 'assistant-1',
          role: 'assistant',
          mode: 'gemini-test',
          content: '<img src=x onerror=alert(1)>',
          sources: [
            { title: 'Safe Source', url: 'https://example.test/source', sourceFile: 'hidden.json', sourcePath: '/secret', id: 'internal-id' },
            { publisher: 'Publisher Only', url: 'javascript:alert(1)' },
          ],
          quota: { remaining: 2, limit: 5 },
        }}
      />
    );

    expect(document.body.innerHTML).not.toContain('<img src=x');
    expect(document.body.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(document.body.textContent).toContain('Safe Source');
    expect(document.body.textContent).toContain('Publisher Only');
    expect(document.body.textContent).not.toContain('hidden.json');
    expect(document.body.textContent).not.toContain('/secret');
    expect(document.body.textContent).not.toContain('internal-id');
    expect(document.querySelectorAll('a.ai-chat-source')).toHaveLength(1);
    expect(document.body.textContent).toContain('2 responses remaining / 5 responses limit');
  });

  it('shows safe missing-endpoint and malformed-response errors without fake answers', async () => {
    vi.stubEnv('VITE_AI_CHAT_ENDPOINT', '');
    render(<MemoryRouter><ControlledChat /></MemoryRouter>);
    click(document.querySelector('[aria-label="AI Assistant"]'));

    await submitMessage('What is Borneo Tracker?');
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('not configured yet');
    expect(document.body.textContent).not.toContain('fake Borneo Tracker answer');

    vi.stubEnv('VITE_AI_CHAT_ENDPOINT', 'https://example.test/ai-chat');
    fetch.mockResolvedValueOnce(successResponse({ answer: '<b>bad</b>', mode: 'old-mode', sources: [] }));
    await submitMessage('Malformed');
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('invalid response');
    expect(document.body.textContent).not.toContain('<b>bad</b>');
  });
});
