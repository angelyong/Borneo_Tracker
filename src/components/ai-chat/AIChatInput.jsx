import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';

const AIChatInput = forwardRef(({ value, onChange, onSubmit, loading }, ref) => {
  const { t } = useTranslation();
  const canSend = value.trim().length > 0 && !loading;

  return (
    <form className="ai-chat-input-row" onSubmit={onSubmit}>
      <label className="sr-only" htmlFor="ai-chat-input">{t('aiChat.inputLabel')}</label>
      <textarea
        ref={ref}
        id="ai-chat-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            if (canSend) onSubmit(event);
          }
        }}
        placeholder={t('aiChat.placeholder')}
        aria-label={t('aiChat.inputLabel')}
        rows={2}
        disabled={loading}
      />
      <button type="submit" className="ai-chat-send" disabled={!canSend} aria-label={t('aiChat.send')}>
        <span aria-hidden="true" />
      </button>
    </form>
  );
});

AIChatInput.displayName = 'AIChatInput';

export default AIChatInput;
