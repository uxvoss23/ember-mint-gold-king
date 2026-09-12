/** Compact Upset City court pins. Same teardrop, smaller idle, brighter selected. */

export const COURT_PIN_VIEWBOX = "0 0 32 42";
export const COURT_PIN_PATH =
  "M16 39.7C16.55 30.15 28.55 22.7 28.55 14.1A12.15 12.15 0 1 0 3.45 14.1C3.45 22.7 15.45 30.15 16 39.7Z";

const FILL_TOP = "#FF8A3A";
const FILL_HI = "#FF741D";
const FILL_MID = "#F24E08";
const FILL_BOT = "#CF4101";

function pinSvg(selected: boolean) {
  const glow = selected
    ? `<radialGradient id="ucPinGlow" cx="16" cy="14" r="16" gradientUnits="userSpaceOnUse">
        <stop stop-color="#FF6A22" stop-opacity="0.38"/>
        <stop offset="0.55" stop-color="#FF6A22" stop-opacity="0.1"/>
        <stop offset="1" stop-color="#FF6A22" stop-opacity="0"/>
      </radialGradient>
      <circle cx="16" cy="14.1" r="16" fill="url(#ucPinGlow)"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${COURT_PIN_VIEWBOX}" fill="none">
    <defs>
      <linearGradient id="ucPinFill" x1="16" y1="2.2" x2="16" y2="40">
        <stop stop-color="${FILL_TOP}"/>
        <stop offset="0.22" stop-color="${FILL_HI}"/>
        <stop offset="0.55" stop-color="${FILL_MID}"/>
        <stop offset="1" stop-color="${FILL_BOT}"/>
      </linearGradient>
      <clipPath id="ucBallClip"><circle cx="16" cy="14.1" r="7.6"/></clipPath>
    </defs>
    ${glow}
    <ellipse cx="16" cy="40.5" rx="${selected ? 5.4 : 4.2}" ry="${selected ? 1.4 : 1.1}" fill="rgba(0,0,0,${selected ? 0.3 : 0.2})"/>
    <path d="${COURT_PIN_PATH}" fill="url(#ucPinFill)" stroke="#fff" stroke-width="${selected ? 2.5 : 2.15}" stroke-linejoin="round" stroke-linecap="round"/>
    <g fill="none" stroke="#fff" stroke-width="${selected ? 1.7 : 1.55}" stroke-linecap="round" clip-path="url(#ucBallClip)">
      <circle cx="16" cy="14.1" r="6.9"/>
      <path d="M16 7.2V21"/>
      <path d="M15.2 7.4C10.8 10.6 10.8 17.6 15.2 20.8"/>
      <path d="M16.8 7.4C21.2 10.6 21.2 17.6 16.8 20.8"/>
    </g>
  </svg>`;
}

export const INACTIVE_PIN_SVG = pinSvg(false);
export const SELECTED_PIN_SVG = pinSvg(true);

export function courtPinSvg(selected = false) {
  return selected ? SELECTED_PIN_SVG : INACTIVE_PIN_SVG;
}

function drawAsset(ctx: CanvasRenderingContext2D, selected: boolean) {
  const pin = new Path2D(COURT_PIN_PATH);

  if (selected) {
    const glow = ctx.createRadialGradient(16, 14.1, 3, 16, 14.1, 16);
    glow.addColorStop(0, "rgba(255,106,34,0.38)");
    glow.addColorStop(0.55, "rgba(255,106,34,0.1)");
    glow.addColorStop(1, "rgba(255,106,34,0)");
    ctx.beginPath();
    ctx.arc(16, 14.1, 16, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();
  }

  ctx.beginPath();
  ctx.ellipse(16, 40.5, selected ? 5.4 : 4.2, selected ? 1.4 : 1.1, 0, 0, Math.PI * 2);
  ctx.fillStyle = selected ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.2)";
  ctx.fill();

  const fill = ctx.createLinearGradient(16, 2.2, 16, 40);
  fill.addColorStop(0, FILL_TOP);
  fill.addColorStop(0.22, FILL_HI);
  fill.addColorStop(0.55, FILL_MID);
  fill.addColorStop(1, FILL_BOT);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.fillStyle = fill;
  ctx.fill(pin);
  ctx.lineWidth = selected ? 2.5 : 2.15;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke(pin);

  ctx.save();
  ctx.beginPath();
  ctx.arc(16, 14.1, 7.6, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = selected ? 1.7 : 1.55;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(16, 14.1, 6.9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(16, 7.2);
  ctx.lineTo(16, 21);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(15.2, 7.4);
  ctx.bezierCurveTo(10.8, 10.6, 10.8, 17.6, 15.2, 20.8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(16.8, 7.4);
  ctx.bezierCurveTo(21.2, 10.6, 21.2, 17.6, 16.8, 20.8);
  ctx.stroke();
  ctx.restore();
}

export function courtPinImageData(selected: boolean): ImageData {
  const dpr = 4;
  const cssW = selected ? 28 : 22;
  const cssH = selected ? 37 : 29;
  const pad = selected ? 8 : 4;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil((cssW + pad * 2) * dpr);
  canvas.height = Math.ceil((cssH + pad * 2) * dpr);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.translate(pad, pad * 0.15);
  const s = cssW / 32;
  ctx.scale(s, s);
  drawAsset(ctx, selected);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}
