import { MascotDefinition, MascotState } from "./types";

function face(eyes: string, mouth: string, extras: string = ""): string {
  return `<svg viewBox="0 0 48 56" class="mascot-svg">
    <!-- Body -->
    <ellipse cx="24" cy="22" rx="16" ry="15" fill="#E8825A" class="mascot-body"/>
    <!-- Eyes -->
    ${eyes}
    <!-- Mouth -->
    ${mouth}
    <!-- Legs -->
    <rect x="16" y="37" width="5" height="9" rx="2.5" fill="#D4744E" class="mascot-leg-left"/>
    <rect x="27" y="37" width="5" height="9" rx="2.5" fill="#D4744E" class="mascot-leg-right"/>
    <!-- Extras -->
    ${extras}
  </svg>`;
}

const EYES = {
  normal: `<circle cx="18" cy="19" r="2.5" fill="#2a1a0e"/>
           <circle cx="30" cy="19" r="2.5" fill="#2a1a0e"/>`,
  wide: `<circle cx="18" cy="19" r="3.5" fill="#2a1a0e"/>
         <circle cx="30" cy="19" r="3.5" fill="#2a1a0e"/>
         <circle cx="19" cy="18" r="1.2" fill="white"/>
         <circle cx="31" cy="18" r="1.2" fill="white"/>`,
  closed: `<line x1="15" y1="19" x2="21" y2="19" stroke="#2a1a0e" stroke-width="2" stroke-linecap="round"/>
           <line x1="27" y1="19" x2="33" y2="19" stroke="#2a1a0e" stroke-width="2" stroke-linecap="round"/>`,
  x: `<line x1="15" y1="16" x2="21" y2="22" stroke="#2a1a0e" stroke-width="2" stroke-linecap="round"/>
      <line x1="21" y1="16" x2="15" y2="22" stroke="#2a1a0e" stroke-width="2" stroke-linecap="round"/>
      <line x1="27" y1="16" x2="33" y2="22" stroke="#2a1a0e" stroke-width="2" stroke-linecap="round"/>
      <line x1="33" y1="16" x2="27" y2="22" stroke="#2a1a0e" stroke-width="2" stroke-linecap="round"/>`,
  squint: `<path d="M15 18 Q18 21 21 18" stroke="#2a1a0e" stroke-width="2" fill="none" stroke-linecap="round"/>
           <path d="M27 18 Q30 21 33 18" stroke="#2a1a0e" stroke-width="2" fill="none" stroke-linecap="round"/>`,
};

const MOUTHS = {
  smile: `<path d="M20 26 Q24 30 28 26" stroke="#2a1a0e" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
  open: `<ellipse cx="24" cy="27" rx="3.5" ry="2.5" fill="#2a1a0e"/>`,
  flat: `<line x1="20" y1="27" x2="28" y2="27" stroke="#2a1a0e" stroke-width="1.5" stroke-linecap="round"/>`,
  frown: `<path d="M20 28 Q24 24 28 28" stroke="#2a1a0e" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
  small: `<circle cx="24" cy="27" r="1.5" fill="#2a1a0e"/>`,
};

const EXTRAS = {
  thinkingDots: `<circle cx="38" cy="8" r="2" fill="#ffd700" class="think-dot-1"/>
                 <circle cx="43" cy="5" r="2.5" fill="#ffd700" class="think-dot-2"/>
                 <circle cx="48" cy="2" r="3" fill="#ffd700" class="think-dot-3"/>`,
  questionMark: `<text x="38" y="10" font-size="14" fill="#e0b956" class="question-mark">?</text>`,
  sweatDrops: `<ellipse cx="40" cy="14" rx="1.5" ry="3" fill="#87CEEB" class="sweat-1"/>
               <ellipse cx="8" cy="18" rx="1.2" ry="2.5" fill="#87CEEB" class="sweat-2"/>`,
  bellIcon: `<text x="36" y="12" font-size="12" class="bell-icon">🔔</text>`,
  waveArm: `<rect x="38" y="18" width="4" height="10" rx="2" fill="#D4744E" class="wave-arm"/>`,
};

const states: Record<MascotState, string> = {
  idle: face(EYES.normal, MOUTHS.smile),
  thinking: face(EYES.closed, MOUTHS.small, EXTRAS.thinkingDots),
  "needs-input": face(EYES.wide, MOUTHS.open, EXTRAS.questionMark),
  error: face(EYES.x, MOUTHS.frown),
  compacting: face(EYES.squint, MOUTHS.flat, EXTRAS.sweatDrops),
  notification: face(EYES.normal, MOUTHS.open, EXTRAS.bellIcon + EXTRAS.waveArm),
  entering: face(EYES.wide, MOUTHS.open),
  exiting: face(EYES.closed, MOUTHS.smile),
};

export const claudeCode: MascotDefinition = {
  svg(state: MascotState): string {
    return states[state] ?? states.idle;
  },

  css: `
    /* Idle: gentle breathing */
    .state-idle .mascot-body {
      animation: breathe 3s ease-in-out infinite;
    }
    @keyframes breathe {
      0%, 100% { transform: scaleY(1); }
      50% { transform: scaleY(1.03); }
    }

    /* Thinking: head wobble + dot pulse */
    .state-thinking .mascot-svg {
      animation: wobble 1.5s ease-in-out infinite;
    }
    @keyframes wobble {
      0%, 100% { transform: rotate(-2deg); }
      50% { transform: rotate(2deg); }
    }
    .think-dot-1 { animation: dotPulse 1s 0s infinite; }
    .think-dot-2 { animation: dotPulse 1s 0.3s infinite; }
    .think-dot-3 { animation: dotPulse 1s 0.6s infinite; }
    @keyframes dotPulse {
      0%, 100% { opacity: 0.3; }
      50% { opacity: 1; }
    }

    /* Needs input: bounce + question pulse */
    .state-needs-input .mascot-svg {
      animation: bounce 0.6s ease-in-out infinite alternate;
    }
    @keyframes bounce {
      from { transform: translateY(0); }
      to { transform: translateY(-6px); }
    }
    .question-mark {
      animation: pulse 0.8s ease-in-out infinite alternate;
    }
    @keyframes pulse {
      from { opacity: 0.5; transform: scale(0.8); }
      to { opacity: 1; transform: scale(1.15); }
    }

    /* Error: shake + red tint */
    .state-error .mascot-svg {
      animation: shake 0.3s ease-in-out infinite;
    }
    .state-error .mascot-body {
      fill: #cc4444;
    }
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-3px); }
      75% { transform: translateX(3px); }
    }

    /* Compacting: squeeze + sweat */
    .state-compacting .mascot-svg {
      animation: squeeze 1s ease-in-out infinite;
    }
    @keyframes squeeze {
      0%, 100% { transform: scaleX(1) scaleY(1); }
      50% { transform: scaleX(1.1) scaleY(0.85); }
    }
    .sweat-1 { animation: drip 1.2s 0s ease-in infinite; }
    .sweat-2 { animation: drip 1.2s 0.4s ease-in infinite; }
    @keyframes drip {
      0% { opacity: 1; transform: translateY(0); }
      100% { opacity: 0; transform: translateY(8px); }
    }

    /* Notification: wave arm + bell */
    .wave-arm {
      transform-origin: 38px 18px;
      animation: wave 0.5s ease-in-out infinite alternate;
    }
    @keyframes wave {
      from { transform: rotate(-15deg); }
      to { transform: rotate(15deg); }
    }
    .bell-icon {
      animation: ring 0.4s ease-in-out infinite alternate;
    }
    @keyframes ring {
      from { transform: rotate(-10deg); }
      to { transform: rotate(10deg); }
    }

    /* Entering: drop from above */
    .state-entering .mascot-wrapper {
      animation: enterDrop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }
    @keyframes enterDrop {
      from { transform: translateY(-60px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    /* Exiting: slide down and fade */
    .state-exiting .mascot-wrapper {
      animation: exitSlide 0.4s ease-in forwards;
    }
    @keyframes exitSlide {
      from { transform: translateY(0); opacity: 1; }
      to { transform: translateY(40px); opacity: 0; }
    }
  `,

  metadata: {
    name: "Claude Code",
    defaultColor: "#E8825A",
    size: { width: 48, height: 56 },
  },
};
