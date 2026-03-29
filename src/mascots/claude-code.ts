import { MascotDefinition, MascotState } from "./types";

const COLOR = "#CC785C";

function body(eyes: string, extras: string = "", viewBox = "0 0 66 52"): string {
  return `<svg viewBox="${viewBox}" class="mascot-svg">
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
  keyboard: `<rect x="-4" y="55" width="74" height="18" rx="3" fill="#555" class="keyboard"/>
             <rect x="0" y="58" width="8" height="4" rx="1" fill="#888" class="key key-1"/>
             <rect x="10" y="58" width="8" height="4" rx="1" fill="#888" class="key key-2"/>
             <rect x="20" y="58" width="8" height="4" rx="1" fill="#888" class="key key-3"/>
             <rect x="30" y="58" width="8" height="4" rx="1" fill="#888" class="key key-4"/>
             <rect x="40" y="58" width="8" height="4" rx="1" fill="#888" class="key key-5"/>
             <rect x="50" y="58" width="8" height="4" rx="1" fill="#888" class="key key-6"/>
             <rect x="60" y="58" width="6" height="4" rx="1" fill="#888" class="key key-8"/>
             <rect x="4" y="64" width="8" height="4" rx="1" fill="#888" class="key key-7"/>
             <rect x="14" y="64" width="30" height="4" rx="1" fill="#888" class="key key-space"/>
             <rect x="46" y="64" width="8" height="4" rx="1" fill="#888" class="key key-9"/>
             <rect x="56" y="64" width="8" height="4" rx="1" fill="#888" class="key key-10"/>`,
  thinkingDots: `<circle cx="58" cy="-4" r="2" fill="#ffd700" class="think-dot-1"/>
                 <circle cx="63" cy="-8" r="2.5" fill="#ffd700" class="think-dot-2"/>
                 <circle cx="68" cy="-12" r="3" fill="#ffd700" class="think-dot-3"/>`,
  questionMark: `<text x="56" y="-2" font-size="14" fill="#e0b956" font-weight="bold" class="question-mark">?</text>`,
  sweatDrops: `<ellipse cx="62" cy="8" rx="1.5" ry="3" fill="#87CEEB" class="sweat-1"/>
               <ellipse cx="2" cy="12" rx="1.2" ry="2.5" fill="#87CEEB" class="sweat-2"/>`,
  bellIcon: `<text x="56" y="0" font-size="12" class="bell-icon">&#x1F514;</text>`,
  waveArm: `<rect x="60" y="10" width="6" height="16" fill="${COLOR}" class="wave-arm"/>`,
  sleepZzz: `<text x="52" y="-2" font-size="10" fill="#aaa" font-weight="bold" class="zzz-1">z</text>
              <text x="60" y="-10" font-size="13" fill="#aaa" font-weight="bold" class="zzz-2">z</text>
              <text x="66" y="-20" font-size="16" fill="#aaa" font-weight="bold" class="zzz-3">Z</text>`,
};

const states: Record<MascotState, string> = {
  idle: body(EYES.normal),
  thinking: body(EYES.squint, EXTRAS.keyboard, "-4 0 74 75"),
  "needs-input": body(EYES.wide, EXTRAS.questionMark),
  error: body(EYES.x),
  compacting: body(EYES.squint, EXTRAS.sweatDrops),
  notification: body(EYES.normal, EXTRAS.bellIcon + EXTRAS.waveArm),
  entering: body(EYES.wide),
  exiting: body(EYES.closed),
  sleeping: body(EYES.closed, EXTRAS.sleepZzz, "-4 -30 80 82"),
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

    /* Thinking: typing on keyboard */
    .state-thinking .arm-left {
      animation: typeLeft 0.4s ease-in-out infinite alternate;
    }
    .state-thinking .arm-right {
      animation: typeRight 0.4s 0.2s ease-in-out infinite alternate;
    }
    @keyframes typeLeft {
      from { transform: translateY(0); }
      to { transform: translateY(3px); }
    }
    @keyframes typeRight {
      from { transform: translateY(0); }
      to { transform: translateY(3px); }
    }
    .state-thinking .key-1 { animation: keyPress 0.8s 0s ease-in-out infinite; }
    .state-thinking .key-3 { animation: keyPress 0.8s 0.15s ease-in-out infinite; }
    .state-thinking .key-5 { animation: keyPress 0.8s 0.3s ease-in-out infinite; }
    .state-thinking .key-2 { animation: keyPress 0.8s 0.45s ease-in-out infinite; }
    .state-thinking .key-7 { animation: keyPress 0.8s 0.6s ease-in-out infinite; }
    .state-thinking .key-4 { animation: keyPress 0.8s 0.75s ease-in-out infinite; }
    @keyframes keyPress {
      0%, 70%, 100% { fill: #888; transform: translateY(0); }
      35% { fill: #bbb; transform: translateY(0.5px); }
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

    /* Sleeping: gentle breathing + floating Z's */
    .state-sleeping .mascot-svg {
      animation: breathe 3s ease-in-out infinite;
    }
    @keyframes breathe {
      0%, 100% { transform: scaleY(1); }
      50% { transform: scaleY(0.95); }
    }
    .zzz-1 {
      animation: floatZ 2.5s 0s ease-in-out infinite;
    }
    .zzz-2 {
      animation: floatZ 2.5s 0.5s ease-in-out infinite;
    }
    .zzz-3 {
      animation: floatZ 2.5s 1s ease-in-out infinite;
    }
    @keyframes floatZ {
      0% { opacity: 0; transform: translate(0, 0); }
      30% { opacity: 1; }
      100% { opacity: 0; transform: translate(5px, -10px); }
    }
  `,

  metadata: {
    name: "Claude Code",
    defaultColor: COLOR,
    size: { width: 66, height: 52 },
  },
};
