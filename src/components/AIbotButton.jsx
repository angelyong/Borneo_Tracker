import { useState } from 'react';
import AIChatDialog from './ai-chat/AIChatDialog';

const STATIC_SRC = '../src/assets/AIbot_static.png';
const HOVER_SRC = '../src/assets/AIbot_GIF.gif';

const AIbotButton = () => {
  const [isHovered, setIsHovered] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const imageSrc = isHovered ? HOVER_SRC : STATIC_SRC;

  const buttonStyle = isHovered
    ? { ...styles.button, ...styles.buttonHover }
    : styles.button;

  const imageStyle = isHovered
    ? { ...styles.image, ...styles.imageHover }
    : styles.image;

  return (
    <>
    <button
      type="button"
      style={buttonStyle}
      aria-label="AI Assistant"
      aria-haspopup="dialog"
      aria-expanded={isChatOpen}
      onClick={() => setIsChatOpen(true)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <img
        key={imageSrc}
        src={imageSrc}
        alt=""
        aria-hidden="true"
        style={imageStyle}
        draggable="false"
      />
    </button>
    <AIChatDialog open={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </>
  );
};

const styles = {
  button: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '74px',
    height: '53px',
    marginLeft: '14px',
    padding: '6px 8px',
    border: 'none',
    borderRadius: '0 0 10px 10px',

    background: `
      radial-gradient(
        circle at 0% 0%,
        #fc6c6d 0%,
        rgba(252, 108, 109, 0) 46%
      ),
      radial-gradient(
        circle at 100% 0%,
        #fbd065 0%,
        rgba(251, 208, 101, 0) 50%
      ),
      radial-gradient(
        circle at 0% 75%,
        #a65d9e 0%,
        rgba(166, 93, 158, 0) 48%
      ),
      radial-gradient(
        circle at 100% 65%,
        #73ad73 0%,
        rgba(115, 173, 115, 0) 45%
      ),
      linear-gradient(
        180deg,
        #f9b771 0%,
        #a875aa 50%,
        #00a4b5 100%
      )
    `,

    boxShadow: '0 6px 12px rgba(13, 33, 24, 0.12)',
    cursor: 'pointer',
    overflow: 'hidden',
    flexShrink: 0,
    transition: 'box-shadow 140ms ease',
  },

  buttonHover: {
    boxShadow: '0 8px 15px rgba(13, 33, 24, 0.2)',
  },

  image: {
    width: '50px',
    height: '50px',
    objectFit: 'contain',
    display: 'block',
    pointerEvents: 'none',
    transition: 'transform 140ms ease',
  },

  imageHover: {
    transform: 'translateY(2px)',
  },
};

export default AIbotButton;
