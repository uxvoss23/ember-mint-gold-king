/** Shared markup for the first-paint + in-app loader. Keep CSS inline so it
 *  never flashes white while styles.css / JS are still arriving. */

export const PREMIUM_BOOT_CSS = `
html,body{background:#070708!important;color:#f4f4f5}
#uc-premium-boot{position:fixed;inset:0;z-index:2147483646;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;background:#070708;overflow:hidden;font-family:system-ui,-apple-system,sans-serif;color:#fafafa}
#uc-premium-boot.uc-boot-out{opacity:0;pointer-events:none;transition:opacity .45s cubic-bezier(.22,1,.36,1)}
#uc-premium-boot .uc-reel{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:saturate(1.08) contrast(1.12) sepia(.18);pointer-events:none;-webkit-appearance:none}
#uc-premium-boot .uc-reel::-webkit-media-controls,
#uc-premium-boot .uc-reel::-webkit-media-controls-start-playback-button,
#uc-premium-boot .uc-reel::-webkit-media-controls-overlay-play-button,
#uc-premium-boot .uc-reel::-webkit-media-controls-enclosure{display:none!important;opacity:0!important;-webkit-appearance:none;pointer-events:none;width:0;height:0}
#uc-premium-boot .uc-scrim{position:absolute;inset:0;background:
  linear-gradient(180deg,rgba(7,7,8,.2) 0%,rgba(7,7,8,.35) 38%,rgba(7,7,8,.78) 72%,#070708 100%),
  radial-gradient(ellipse 80% 50% at 50% 100%, rgba(196,92,38,.28), transparent 70%)}
#uc-premium-boot .uc-grain{position:absolute;inset:0;opacity:.22;pointer-events:none;mix-blend-mode:overlay;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");animation:uc-grain .18s steps(2) infinite}
#uc-premium-boot .uc-vignette{position:absolute;inset:0;box-shadow:inset 0 0 120px 24px #070708}
#uc-premium-boot .uc-stage{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;text-align:center;padding:0 1.5rem 3.4rem;width:100%}
#uc-premium-boot .uc-brand{letter-spacing:.34em;font-size:11px;font-weight:700;color:#e0783a;text-transform:uppercase;margin:0;text-shadow:0 2px 18px rgba(0,0,0,.8)}
#uc-premium-boot h1{margin:.5rem 0 0;font-size:1.85rem;font-weight:650;line-height:1.12;max-width:16.5rem;letter-spacing:-.03em;text-shadow:0 8px 28px rgba(0,0,0,.75)}
#uc-premium-boot .uc-line{margin-top:1.2rem;width:9.5rem;height:3px;border-radius:9999px;background:rgba(255,255,255,.12);overflow:hidden}
#uc-premium-boot .uc-line>i{display:block;height:100%;width:38%;border-radius:inherit;background:linear-gradient(90deg,#c9a227,#e0783a);animation:uc-bar 1.25s cubic-bezier(.22,1,.36,1) infinite}
#uc-premium-boot .uc-status{margin:.7rem 0 0;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#d4d4d8;min-height:1.1em;font-weight:600;text-shadow:0 1px 10px #000}
@keyframes uc-bar{0%{transform:translateX(-120%)}100%{transform:translateX(340%)}}
@keyframes uc-grain{0%{transform:translate(0,0)}100%{transform:translate(-2%,1%)}}
@media (prefers-reduced-motion:reduce){
  #uc-premium-boot .uc-line>i,#uc-premium-boot .uc-grain{animation:none}
  #uc-premium-boot .uc-reel{display:none}
}
`;

export const PREMIUM_BOOT_HTML = `
<video id="uc-boot-reel" class="uc-reel" autoplay muted loop playsinline webkit-playsinline disablepictureinpicture disableremoteplayback controlslist="nodownload nofullscreen noremoteplayback" preload="auto" aria-hidden="true">
  <source src="/boot/vintage-1v1.mp4" type="video/mp4" />
</video>
<div class="uc-scrim"></div>
<div class="uc-grain"></div>
<div class="uc-vignette"></div>
<div class="uc-stage">
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
      className="relative flex min-h-0 flex-1 flex-col items-center justify-end overflow-hidden bg-[#070708] px-6 pb-14 text-center"
      role="status"
      aria-label="Loading Upset City"
    >
      <video
        className="pointer-events-none absolute inset-0 h-full w-full object-cover [&::-webkit-media-controls]:hidden [&::-webkit-media-controls-start-playback-button]:hidden"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        controls={false}
        disablePictureInPicture
        aria-hidden
        onCanPlay={(e) => {
          const v = e.currentTarget;
          v.muted = true;
          v.volume = 0;
          void v.play().catch(() => {});
        }}
      >
        <source src="/boot/vintage-1v1.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-[#070708]" />
      <div className="relative">
        <p className="text-[11px] font-bold tracking-[0.34em] text-court uppercase">Upset City</p>
        <p className="mt-2 max-w-[16rem] font-display text-[1.4rem] font-semibold leading-tight text-fg">
          Finding your run
        </p>
      </div>
    </div>
  );
}
