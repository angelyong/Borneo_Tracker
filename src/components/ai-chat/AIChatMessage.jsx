import AnswerSources from './AnswerSources';
import botIcon from '../../assets/AIbot_static.png';

const AIChatMessage = ({ message }) => {
  const isUser = message.role === 'user';
  return (
    <article className={`ai-chat-message ${isUser ? 'is-user' : 'is-assistant'}`}>
      {!isUser && (
        <div className="ai-chat-message-avatar" aria-hidden="true">
          <img src={botIcon} alt="" />
        </div>
      )}
      <div className="ai-chat-message-bubble">
        {message.content.split('\n').map((line, index) => (
          <p key={`${message.id}-${index}`}>{line}</p>
        ))}
      </div>
      {!isUser && <AnswerSources sources={message.sources} />}
    </article>
  );
};

export default AIChatMessage;
