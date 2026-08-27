/** Shared markup for the first-paint + in-app loader. Keep CSS inline so it
 *  never flashes white while styles.css / JS are still arriving. */

export const PREMIUM_BOOT_CSS = `
html,body{background:#070708!important;color:#f4f4f5}
#uc-premium-boot{position:fixed;inset:0;z-index:2147483646;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#070708;overflow:hidden;font-family:system-ui,-apple-system,sans-serif;color:#fafafa}
#uc-premium-boot.uc-boot-out{opacity:0;pointer-events:none;transition:opacity .45s cubic-bezier(.22,1,.36,1)}
#uc-premium-boot .uc-floor{position:absolute;inset:0;background:
  radial-gradient(ellipse 90% 55% at 50% 108%, rgba(196,92,38,.38), transparent 58%),
  radial-gradient(ellipse 70% 45% at 50% 40%, rgba(201,162,39,.12), transparent 70%),
  radial-gradient(circle at 50% 50%, #14110e 0%, #070708 72%)}
#uc-premium-boot .uc-grid{position:absolute;inset:0;opacity:.18;background-image:
  linear-gradient(rgba(255,255,255,.07) 1px, transparent 1px),
  linear-gradient(90deg, rgba(255,255,255,.07) 1px, transparent 1px);background-size:48px 48px;transform:perspective(500px) rotateX(62deg) translateY(38%) scale(1.6);transform-origin:center bottom}
#uc-premium-boot .uc-sweep{position:absolute;inset:-40%;background:conic-gradient(from 180deg, transparent 0 62%, rgba(196,92,38,.16) 70%, transparent 78%);animation:uc-sweep 7s linear infinite}
#uc-premium-boot .uc-stage{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;text-align:center;padding:1.5rem}
#uc-premium-boot .uc-orb-wrap{position:relative;width:7.25rem;height:7.25rem;margin-bottom:1.6rem}
#uc-premium-boot .uc-ring{position:absolute;inset:0;border-radius:9999px;border:1px solid rgba(196,92,38,.4);animation:uc-spin 9s linear infinite}
#uc-premium-boot .uc-ring:after{content:"";position:absolute;top:-3px;left:50%;width:7px;height:7px;margin-left:-3.5px;border-radius:9999px;background:#e0783a;box-shadow:0 0 16px #e0783a}
#uc-premium-boot .uc-ring-2{position:absolute;inset:-10px;border-radius:9999px;border:1px dashed rgba(201,162,39,.28);animation:uc-spin 14s linear infinite reverse}
#uc-premium-boot .uc-orb{position:absolute;inset:18px;border-radius:9999px;background:linear-gradient(165deg,#f0a36a,#c45c26 55%,#8a3514);box-shadow:0 18px 50px rgba(196,92,38,.55), inset 0 1px 0 rgba(255,255,255,.28);display:grid;place-items:center;animation:uc-pulse 2.1s ease-in-out infinite}
#uc-premium-boot .uc-brand{letter-spacing:.34em;font-size:11px;font-weight:700;color:#e0783a;text-transform:uppercase;margin:0}
#uc-premium-boot h1{margin:.55rem 0 0;font-size:1.85rem;font-weight:650;line-height:1.12;max-width:16.5rem;letter-spacing:-.03em}
#uc-premium-boot .uc-line{margin-top:1.35rem;width:9.5rem;height:3px;border-radius:9999px;background:rgba(255,255,255,.08);overflow:hidden}
#uc-premium-boot .uc-line>i{display:block;height:100%;width:38%;border-radius:inherit;background:linear-gradient(90deg,#c9a227,#e0783a);animation:uc-bar 1.25s cubic-bezier(.22,1,.36,1) infinite}
#uc-premium-boot .uc-status{margin:.7rem 0 0;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#a1a1aa;min-height:1.1em;font-weight:600}
#uc-premium-boot .uc-tick{position:absolute;width:3px;height:10px;background:#c9a227;border-radius:2px;opacity:.7;animation:uc-tick 1.8s ease-in-out infinite}
@keyframes uc-spin{to{transform:rotate(360deg)}}
@keyframes uc-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.045)}}
@keyframes uc-bar{0%{transform:translateX(-120%)}100%{transform:translateX(340%)}}
@keyframes uc-sweep{to{transform:rotate(360deg)}}
@keyframes uc-tick{0%,100%{opacity:.25}50%{opacity:1}}
@media (prefers-reduced-motion:reduce){
  #uc-premium-boot .uc-ring,#uc-premium-boot .uc-ring-2,#uc-premium-boot .uc-orb,#uc-premium-boot .uc-line>i,#uc-premium-boot .uc-sweep,#uc-premium-boot .uc-tick{animation:none}
}
`;

export const PREMIUM_BOOT_HTML = `
<div class="uc-floor"></div>
<div class="uc-grid"></div>
<div class="uc-sweep"></div>
<div class="uc-stage">
  <div class="uc-orb-wrap">
    <div class="uc-ring-2"></div>
    <div class="uc-ring"></div>
    <div class="uc-orb">
      <svg width="42" height="42" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <circle cx="32" cy="32" r="22" stroke="white" stroke-width="2.2"/>
        <path d="M32 10v44M10 32h44" stroke="white" stroke-width="2"/>
        <path d="M18 16c8 6 20 6 28 0M18 48c8-6 20-6 28 0" stroke="white" stroke-width="2"/>
      </svg>
    </div>
  </div>
  <p class="uc-brand">Upset City</p>
  <h1>Where the best hoopers emerge</h1>
  <div class="uc-line"><i></i></div>
  <p class="uc-status" id="uc-boot-status">Lacing up</p>
</div>
`;

const LINES = ["Lacing up", "Checking the board", "Finding a run", "Tip-off soon"];

export function hidePremiumBoot() {
  if (typeof document === "undefined") return;
  const el = document.getElementById("uc-premium-boot");
  if (!el || el.classList.contains("uc-boot-out")) return;
  el.classList.add("uc-boot-out");
  window.setTimeout(() => el.remove(), 500);
}

export function armPremiumBoot() {
  if (typeof document === "undefined") return;
  const status = document.getElementById("uc-boot-status");
  let i = 0;
  const tick = window.setInterval(() => {
    i = (i + 1) % LINES.length;
    if (status) status.textContent = LINES[i];
  }, 900);
  const hide = () => {
    window.clearInterval(tick);
    hidePremiumBoot();
  };
  document.addEventListener("uc:app-ready", hide, { once: true });
  window.setTimeout(hide, 12000);
}

export function PremiumBootFallback() {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col items-center justify-center bg-[#070708] px-6 text-center"
      role="status"
      aria-label="Loading Upset City"
    >
      <p className="text-[11px] font-bold tracking-[0.34em] text-court uppercase">Upset City</p>
      <p className="mt-2 max-w-[16rem] font-display text-[1.4rem] font-semibold leading-tight text-fg">
        Finding your run
      </p>
    </div>
  );
}
