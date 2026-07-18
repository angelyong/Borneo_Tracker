import { SUGGESTED_QUESTIONS } from '../../services/AIChatService';

const SuggestedQuestions = ({ onSelect, disabled }) => (
  <div className="ai-chat-suggestions" aria-label="Suggested questions">
    {SUGGESTED_QUESTIONS.map((question) => (
      <button
        key={question}
        type="button"
        className="ai-chat-suggestion"
        onClick={() => onSelect(question)}
        disabled={disabled}
      >
        {question}
      </button>
    ))}
  </div>
);

export default SuggestedQuestions;
