import {
  SUGGESTED_QUESTION_CONTRACT_VERSION,
  SUGGESTED_QUESTIONS,
} from '../../shared/aiChatContracts';

const SuggestedQuestions = ({ onSelect, disabled }) => (
  <div
    className="ai-chat-suggestions"
    aria-label="Suggested questions"
    data-suggestion-contract-version={SUGGESTED_QUESTION_CONTRACT_VERSION}
  >
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
