import { MascotDefinition, MascotState } from "./types";

const COLOR = "#CC785C";

function body(eyes: string, extras: string = ""): string {
  return `<svg viewBox="0 0 66 52" class="mascot-svg">
    <!-- Body -->
    <rect x="6" y="0" width="54" height="39" fill="${COLOR}" class="mascot-body"/>
    <!-- Arms -->
    <rect x="0" y="13" width="6" height="13" fill="${COLOR}" class="arm-left"/>
    <rect x="60" y="13" width="6" height="13" fill="${COLOR}" class="arm-right"/>
    <!-- Eyes -->
    <g class="eyes">${eyes}</g>
    <!-- Legs -->
    <rect x="6" y="39" width="6" height="13" fill="${COLOR}" class="leg leg-1"/>
    <rect x="18" y="39" width="6" height="13" fill="${COLOR}" class="leg leg-2"/>
    <rect x="42" y="39" width="6" height="13" fill="${COLOR}" class="leg leg-3"/>
    <rect x="54" y="39" width="6" height="13" fill="${COLOR}" class="leg leg-4"/>
    <!-- Extras -->
    ${extras}
  </svg>`;
}

const EYES = {
  normal: `<rect x="12" y="13" width="6" height="6.5" fill="black" class="eye eye-l"/>
           <rect x="48" y="13" width="6" height="6.5" fill="black" class="eye eye-r"/>`,
  wide: `<rect x="12" y="11" width="6" height="9" fill="black" class="eye eye-l"/>
         <rect x="48" y="11" width="6" height="9" fill="black" class="eye eye-r"/>
         <rect x="13" y="12" width="2" height="3" fill="white" class="eye-glint"/>
         <rect x="49" y="12" width="2" height="3" fill="white" class="eye-glint"/>`,
  closed: `<rect x="12" y="16" width="6" height="2" fill="black" class="eye eye-l"/>
           <rect x="48" y="16" width="6" height="2" fill="black" class="eye eye-r"/>`,
  x: `<line x1="12" y1="13" x2="18" y2="19.5" stroke="black" stroke-width="2"/>
      <line x1="18" y1="13" x2="12" y2="19.5" stroke="black" stroke-width="2"/>
      <line x1="48" y1="13" x2="54" y2="19.5" stroke="black" stroke-width="2"/>
      <line x1="54" y1="13" x2="48" y2="19.5" stroke="black" stroke-width="2"/>`,
  squint: `<rect x="12" y="15" width="6" height="3" fill="black" class="eye eye-l"/>
           <rect x="48" y="15" width="6" height="3" fill="black" class="eye eye-r"/>`,
};

const EXTRAS = {
  thinkingDots: `<circle cx="58" cy="-4" r="2" fill="#ffd700" class="think-dot-1"/>
                 <circle cx="63" cy="-8" r="2.5" fill="#ffd700" class="think-dot-2"/>
                 <circle cx="68" cy="-12" r="3" fill="#ffd700" class="think-dot-3"/>`,
  questionMark: `<text x="56" y="-2" font-size="14" fill="#e0b956" font-weight="bold" class="question-mark">?</text>`,
  sweatDrops: `<ellipse cx="62" cy="8" rx="1.5" ry="3" fill="#87CEEB" class="sweat-1"/>
               <ellipse cx="2" cy="12" rx="1.2" ry="2.5" fill="#87CEEB" class="sweat-2"/>`,
  bellIcon: `<text x="56" y="0" font-size="12" class="bell-icon">&#x1F514;</text>`,
  waveArm: `<rect x="60" y="10" width="6" height="16" fill="${COLOR}" class="wave-arm"/>`,
};

const states: Record<MascotState, string> = {
  idle: body(EYES.normal),
  thinking: body(EYES.closed, EXTRAS.thinkingDots),
  "needs-input": body(EYES.wide, EXTRAS.questionMark),
  error: body(EYES.x),
  compacting: body(EYES.squint, EXTRAS.sweatDrops),
  notification: body(EYES.normal, EXTRAS.bellIcon + EXTRAS.waveArm),
  entering: body(EYES.wide),
  exiting: body(EYES.closed),
};

export const claudeCode: MascotDefinition = {
  svg(state: MascotState): string {
    return states[state] ?? states.idle;
  },

  css: `
    /* Idle: eyes look left → center → right → center */
    .state-idle .eyes {
      animation: lookAround 3s ease-in-out infinite;
    }
    @keyframes lookAround {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-4px); }
      50% { transform: translateX(0); }
      75% { transform: translateX(4px); }
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
    .state-error .mascot-body,
    .state-error .arm-left,
    .state-error .arm-right,
    .state-error .leg {
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
      transform-origin: 60px 10px;
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
    defaultColor: COLOR,
    size: { width: 66, height: 52 },
  },
};
