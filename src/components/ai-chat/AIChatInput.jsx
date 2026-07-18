import { useEffect, useRef } from 'react';

const AIChatInput = ({ value, onChange, onSubmit, loading }) => {
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const canSend = value.trim().length > 0 && !loading;

  return (
    <form className="ai-chat-input-row" onSubmit={onSubmit}>
      <label className="sr-only" htmlFor="ai-chat-input">Message Borneo Tracker AI</label>
      <textarea
        ref={inputRef}
        id="ai-chat-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            if (canSend) onSubmit(event);
          }
        }}
        placeholder="Enter your message..."
        aria-label="Message Borneo Tracker AI"
        rows={2}
        disabled={loading}
      />
      <button type="submit" className="ai-chat-send" disabled={!canSend} aria-label="Send message">
        <span aria-hidden="true" />
      </button>
    </form>
  );
};

export default AIChatInput;
