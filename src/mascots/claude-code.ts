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

  icon: {
    svg: `<svg viewBox="0 0 24 24" fill="currentColor">
    <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z"/>
  </svg>`,
  },
};
