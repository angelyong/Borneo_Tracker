import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
    document.querySelector('[aria-label="Send message"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

const errorResponse = (status, error) => ({
  ok: false,
  status,
  json: () => Promise.resolve(error ? { error } : {}),
});

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
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    act(() => {
      root?.unmount();
    });
    container?.remove();
    container = null;
    root = null;
  });

  it('opens from the existing AI button and closes with the close button', () => {
    render(<MemoryRouter><ControlledChat /></MemoryRouter>);
    click(document.querySelector('[aria-label="AI Assistant"]'));
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();

    click(document.querySelector('[aria-label="Close chatbot"]'));
    expect(document.querySelector('[role="dialog"]')).toBeFalsy();
  });

  it('closes with Escape', () => {
    render(<MemoryRouter><ControlledChat /></MemoryRouter>);
    click(document.querySelector('[aria-label="AI Assistant"]'));
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(document.querySelector('[role="dialog"]')).toBeFalsy();
  });

  it('disables empty submission and shows loading after a user message', () => {
    render(<MemoryRouter><ControlledChat /></MemoryRouter>);
    click(document.querySelector('[aria-label="AI Assistant"]'));
    const send = document.querySelector('[aria-label="Send message"]');
    expect(send.disabled).toBe(true);

    const input = document.querySelector('#ai-chat-input');
    changeTextarea(input, 'What is Borneo Tracker?');
    expect(send.disabled).toBe(false);

    click(send);
    expect(document.body.textContent).toContain('What is Borneo Tracker?');
    expect(document.querySelector('[aria-label="Assistant is loading"]')).toBeTruthy();
  });

  it('renders sources below assistant answers', () => {
    render(
      <AIChatMessage
        message={{
          id: 'assistant-1',
          role: 'assistant',
          content: 'Forest Cover is placeholder knowledge.',
          sources: [{ title: 'Forest Cover', type: 'static', url: '/esg' }],
        }}
      />
    );
    expect(document.querySelector('.ai-chat-source')?.textContent).toContain('Forest Cover');
  });

  it('shows a service unavailable error for 404 responses', async () => {
    fetch.mockResolvedValueOnce(errorResponse(404));
    render(<MemoryRouter><ControlledChat /></MemoryRouter>);
    click(document.querySelector('[aria-label="AI Assistant"]'));

    await submitMessage('What is Borneo Tracker?');

    expect(document.querySelector('[role="alert"]')?.textContent).toContain('not available yet');
    expect(document.body.textContent).not.toContain('Placeholder content');
  });

  it('shows a quota error for 429 responses', async () => {
    fetch.mockResolvedValueOnce(errorResponse(429));
    render(<MemoryRouter><ControlledChat /></MemoryRouter>);
    click(document.querySelector('[aria-label="AI Assistant"]'));

    await submitMessage('What is the latest forest cover value?');

    expect(document.querySelector('[role="alert"]')?.textContent).toContain('quota has been reached');
    expect(document.body.textContent).not.toContain('Dynamic data connection is not configured yet');
  });

  it('shows a safe server error for 500 responses', async () => {
    fetch.mockResolvedValueOnce(errorResponse(500, 'stack trace should not be shown'));
    render(<MemoryRouter><ControlledChat /></MemoryRouter>);
    click(document.querySelector('[aria-label="AI Assistant"]'));

    await submitMessage('Explain SDG progress');

    expect(document.querySelector('[role="alert"]')?.textContent).toContain('server had a problem');
    expect(document.body.textContent).not.toContain('stack trace');
    expect(document.body.textContent).not.toContain('Placeholder content');
  });

  it('does not render mock answers for production-style network failures', async () => {
    vi.stubEnv('VITE_AI_CHAT_CLIENT_MOCK_FALLBACK', 'false');
    fetch.mockRejectedValueOnce(new Error('Network failed'));
    render(<MemoryRouter><ControlledChat /></MemoryRouter>);
    click(document.querySelector('[aria-label="AI Assistant"]'));

    await submitMessage('What is Borneo Tracker?');

    expect(document.querySelector('[role="alert"]')?.textContent).toContain('connection failed');
    expect(document.body.textContent).not.toContain('Placeholder content');
  });

  it('uses explicit development mock mode when enabled', async () => {
    vi.stubEnv('VITE_AI_CHAT_CLIENT_MOCK_FALLBACK', 'true');
    fetch.mockRejectedValueOnce(new Error('Local dev backend missing'));
    render(<MemoryRouter><ControlledChat /></MemoryRouter>);
    click(document.querySelector('[aria-label="AI Assistant"]'));

    await submitMessage('What is Borneo Tracker?');

    expect(document.body.textContent).toContain('Placeholder content');
    expect(document.querySelector('[role="alert"]')).toBeFalsy();
  });
});
