// BT-22/23: the four-question answer strip — What is happening? Where?
// Why does it matter? What next? — one compact horizontal row, not four
// separate cards. Purely presentational: every page that mounts this
// computes its own 4 slots from whatever data it already has (BT-07's
// buildHeadline for the Dashboard's "What", ESG/SDG counts for those pages,
// the selected territory for Regional Details) — AnswerStrip itself does no
// data derivation, so it can't drift between the pages that reuse it.
//
// Any slot may be omitted (undefined/null) — that slot is suppressed rather
// than padded with placeholder content, per BT-23's explicit "3 genuine
// answers beats 4 with one filler" rule. `whatNext` is the only slot that
// can carry a link (`{ text, href }`); the rest are plain text.
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import './AnswerStrip.css';

function normalizeSlot(value) {
  if (!value) return null;
  if (typeof value === 'string') return { text: value };
  return value.text ? value : null;
}

export default function AnswerStrip({ what, where, why, whatNext, ariaLabel }) {
  const { t } = useTranslation();

  const slots = [
    { key: 'what', labelKey: 'answerStrip.whatLabel', value: normalizeSlot(what) },
    { key: 'where', labelKey: 'answerStrip.whereLabel', value: normalizeSlot(where) },
    { key: 'why', labelKey: 'answerStrip.whyLabel', value: normalizeSlot(why) },
    { key: 'whatNext', labelKey: 'answerStrip.whatNextLabel', value: normalizeSlot(whatNext) },
  ].filter((slot) => slot.value);

  if (!slots.length) return null;

  return (
    <div className="answer-strip" role="region" aria-label={ariaLabel || t('answerStrip.regionLabel')}>
      {slots.map((slot) => (
        <div key={slot.key} className="answer-strip-slot">
          <span className="answer-strip-label">{t(slot.labelKey)}</span>
          {slot.key === 'whatNext' && slot.value.href ? (
            <Link to={slot.value.href} className="answer-strip-cta">
              {slot.value.text}
            </Link>
          ) : (
            <span className="answer-strip-text">{slot.value.text}</span>
          )}
        </div>
      ))}
    </div>
  );
}
