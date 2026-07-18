import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AIbotButton from '../AIbotButton';
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

describe('AI chat dialog', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    act(() => {
      root?.unmount();
    });
    container?.remove();
    container = null;
    root = null;
  });

  it('opens from the existing AI button and closes with the close button', () => {
    render(<MemoryRouter><AIbotButton /></MemoryRouter>);
    click(document.querySelector('[aria-label="AI Assistant"]'));
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();

    click(document.querySelector('[aria-label="Close chatbot"]'));
    expect(document.querySelector('[role="dialog"]')).toBeFalsy();
  });

  it('closes with Escape', () => {
    render(<MemoryRouter><AIbotButton /></MemoryRouter>);
    click(document.querySelector('[aria-label="AI Assistant"]'));
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(document.querySelector('[role="dialog"]')).toBeFalsy();
  });

  it('disables empty submission and shows loading after a user message', () => {
    render(<MemoryRouter><AIbotButton /></MemoryRouter>);
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
});
