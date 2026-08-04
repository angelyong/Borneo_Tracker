import { useTranslation } from 'react-i18next';
import AnswerSources from './AnswerSources';
import botIcon from '../../assets/AIbot_static.png';

const AIChatMessage = ({ message }) => {
  const { t } = useTranslation();
  const isUser = message.role === 'user';
  const showFallbackLabel = !isUser && message.mode === 'template-fallback';
  const quotaParts = [];

  if (message.quota?.remaining != null) quotaParts.push(t('aiChat.quotaRemaining', { count: message.quota.remaining }));
  if (message.quota?.limit != null) quotaParts.push(t('aiChat.quotaLimit', { count: message.quota.limit }));

  return (
    <article className={`ai-chat-message ${isUser ? 'is-user' : 'is-assistant'}`}>
      {!isUser && (
        <div className="ai-chat-message-avatar" aria-hidden="true">
          <img src={botIcon} alt="" />
        </div>
      )}
      <div className="ai-chat-message-bubble">
        {showFallbackLabel && (
          <div className="ai-chat-fallback-label">{t('aiChat.fallbackLabel')}</div>
        )}
        {message.content.split('\n').map((line, index) => (
          <p key={`${message.id}-${index}`}>{line}</p>
        ))}
        {quotaParts.length > 0 && (
          <p className="ai-chat-quota">{quotaParts.join(' / ')}</p>
        )}
      </div>
      {!isUser && <AnswerSources sources={message.sources} />}
    </article>
  );
};

export default AIChatMessage;
