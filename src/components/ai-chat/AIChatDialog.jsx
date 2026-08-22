import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { AuthContext } from '../../auth/authContext';
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

const AIChatDialog = ({ open, onClose, initialMessage = '' }) => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const auth = useContext(AuthContext);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState(initialMessage);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastRequest, setLastRequest] = useState(null);
  const conversationIdRef = useRef(createConversationId());
  const wasOpenRef = useRef(false);
  const closeRef = useRef(null);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  // Pre-fills the input box exactly once per open (e.g. BT-14's "Ask
  // BorneoBot: <query>" search fallback) without clobbering anything the
  // user types afterward while the dialog stays open.
  useEffect(() => {
    if (open && !wasOpenRef.current && initialMessage) {
      setInput(initialMessage);
    }
    wasOpenRef.current = open;
  }, [open, initialMessage]);

  const assistantBusy = useMemo(
    () => (loading ? newMessage('assistant', t('aiChat.loading')) : null),
    [loading, t]
  );

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
    if (open && !loading) inputRef.current?.focus?.();
  }, [loading, open]);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

  if (!open) return null;

  const submitMessage = async (event, overrideMessage, retryRequest) => {
    event?.preventDefault();
    const content = (retryRequest?.message || overrideMessage || input).trim();
    if (!content || loading) return;

    const request = {
      message: content,
      currentPage: location.pathname,
      region: '',
      language: i18n.language || 'en',
    };

    if (!retryRequest) {
      setMessages((current) => [...current, newMessage('user', content)]);
      setInput('');
    }
    setLastRequest(request);
    setError(null);
    setLoading(true);

    try {
      const response = await sendAIChatMessage({
        ...request,
        accessTokenProvider: () => auth?.session?.access_token || '',
      });
      setMessages((current) => [
        ...current,
        newMessage('assistant', response.answer, {
          sources: response.sources || [],
          mode: response.mode,
          fallback: response.fallback,
          quota: response.quota,
        }),
      ]);
    } catch (chatError) {
      setError({
        code: chatError?.code || 'AI_CHAT_ERROR',
        message: chatError?.message || t('aiChat.errors.AI_CHAT_ERROR'),
        status: chatError?.status,
        retryable: Boolean(chatError?.retryable),
      });
    } finally {
      setLoading(false);
    }
  };

  const clearConversation = () => {
    setMessages([]);
    setError(null);
    setInput('');
    setLastRequest(null);
    conversationIdRef.current = createConversationId();
  };

  const retryLastRequest = (event) => {
    if (!lastRequest || loading) return;
    submitMessage(event, null, lastRequest);
  };

  const errorText = error
    ? t(`aiChat.errors.${error.code}`, { defaultValue: error.message })
    : '';

  return (
    <div className="ai-chat-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section
        className="ai-chat-dialog"
        role="dialog"
        aria-labelledby="ai-chat-title"
        aria-modal="false"
      >
        <header className="ai-chat-header">
          <div className="ai-chat-brand">
            <img src={botIcon} alt="" aria-hidden="true" className="ai-chat-brand-icon" />
            <h2 id="ai-chat-title">BorneoBot</h2>
          </div>
          <button ref={closeRef} type="button" className="ai-chat-icon-button" onClick={onClose} aria-label={t('aiChat.close')}>
            x
          </button>
        </header>

        <div className="ai-chat-history" aria-live="polite">
          {messages.length === 0 && (
            <div className="ai-chat-empty">
              <AIChatMessage
                message={{
                  id: 'assistant-welcome',
                  role: 'assistant',
                  content: t('aiChat.welcome'),
                  sources: [],
                }}
              />
              <p className="ai-chat-suggestion-label">{t('aiChat.tryOne')}</p>
              <SuggestedQuestions onSelect={(question) => submitMessage(null, question)} disabled={loading} />
            </div>
          )}
          {messages.map((message) => <AIChatMessage key={message.id} message={message} />)}
          {assistantBusy && (
            <div className="ai-chat-loading" role="status" aria-label={t('aiChat.loading')}>
              <span className="sr-only">{t('aiChat.loading')}</span>
              <span />
              <span />
              <span />
            </div>
          )}
          <div ref={endRef} />
        </div>

        {error && (
          <div className="ai-chat-error" role="alert">
            <span>{errorText}</span>
            {error.retryable && (
              <button type="button" onClick={retryLastRequest} disabled={loading}>
                {t('common.retry')}
              </button>
            )}
          </div>
        )}

        <footer className="ai-chat-footer">
          <button type="button" className="ai-chat-clear" onClick={clearConversation} disabled={loading || messages.length === 0}>
            {t('aiChat.clearConversation')}
          </button>
          <AIChatInput
            ref={inputRef}
            value={input}
            onChange={setInput}
            onSubmit={submitMessage}
            loading={loading}
          />
        </footer>
      </section>
    </div>
  );
};

export default AIChatDialog;
