import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import i18n from '../../i18n';
import { createConversationId, sendAIChatMessage } from '../../services/AIChatService';
import botIcon from '../../assets/AIbot_static.png';
import AIChatInput from './AIChatInput';
import AIChatMessage from './AIChatMessage';
import SuggestedQuestions from './SuggestedQuestions';
import './aiChat.css';

const newMessage = (role, content, extra = {}) => ({
  id: `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  role,
  content,
  ...extra,
});

const AIChatDialog = ({ open, onClose }) => {
  const location = useLocation();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const conversationIdRef = useRef(createConversationId());
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  const endRef = useRef(null);

  const assistantBusy = useMemo(() => loading ? newMessage('assistant', 'Thinking...') : null, [loading]);

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    closeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previous?.focus?.();
    };
  }, [onClose, open]);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

  if (!open) return null;

  const submitMessage = async (event, overrideMessage) => {
    event?.preventDefault();
    const content = (overrideMessage || input).trim();
    if (!content || loading) return;

    const userMessage = newMessage('user', content);
    const history = [...messages, userMessage];
    setMessages(history);
    setInput('');
    setError('');
    setLoading(true);

    try {
      const response = await sendAIChatMessage({
        message: content,
        conversationId: conversationIdRef.current,
        currentPage: location.pathname,
        language: i18n.language || 'en',
        history,
      });
      conversationIdRef.current = response.conversationId || conversationIdRef.current;
      setMessages((current) => [
        ...current,
        newMessage('assistant', response.answer, {
          sources: response.sources || [],
          mode: response.mode,
        }),
      ]);
    } catch {
      setError('The AI assistant could not respond right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const clearConversation = () => {
    setMessages([]);
    setError('');
    setInput('');
    conversationIdRef.current = createConversationId();
  };

  return (
    <div className="ai-chat-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section
        ref={panelRef}
        className="ai-chat-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-chat-title"
      >
        <header className="ai-chat-header">
          <div className="ai-chat-brand">
            <img src={botIcon} alt="" aria-hidden="true" className="ai-chat-brand-icon" />
            <h2 id="ai-chat-title">BorneoBot</h2>
          </div>
          <button ref={closeRef} type="button" className="ai-chat-icon-button" onClick={onClose} aria-label="Close chatbot">
            ×
          </button>
        </header>

        <div className="ai-chat-history" aria-live="polite">
          {messages.length === 0 && (
            <div className="ai-chat-empty">
              <AIChatMessage
                message={{
                  id: 'assistant-welcome',
                  role: 'assistant',
                  content: "Hi there! I'm BorneoBot, your Borneo AI assistant.\n\nAsk me anything about Borneo regions, ESG indicators, SDG progress and data sources.",
                  sources: [],
                }}
              />
              <p className="ai-chat-suggestion-label">Try one of these:</p>
              <SuggestedQuestions onSelect={(question) => submitMessage(null, question)} disabled={loading} />
            </div>
          )}
          {messages.map((message) => <AIChatMessage key={message.id} message={message} />)}
          {assistantBusy && (
            <div className="ai-chat-loading" role="status" aria-label="Assistant is loading">
              <span />
              <span />
              <span />
            </div>
          )}
          <div ref={endRef} />
        </div>

        {error && <div className="ai-chat-error" role="alert">{error}</div>}

        <footer className="ai-chat-footer">
          <button type="button" className="ai-chat-clear" onClick={clearConversation} disabled={loading || messages.length === 0}>
            Clear conversation
          </button>
          <AIChatInput value={input} onChange={setInput} onSubmit={submitMessage} loading={loading} />
        </footer>
      </section>
    </div>
  );
};

export default AIChatDialog;
