/** Circular finder pins — restored from the pre-teardrop HTML `.uc-pin-finder` design. */

const COURT = "#c45c26";
const PIN_PATH = "M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z";

export const COURT_PIN_VIEWBOX = "0 0 36 36";
export const COURT_PIN_PATH = PIN_PATH;

function pinSvg(selected: boolean) {
  const size = selected ? 50 : 36;
  const r = selected ? 22 : 16;
  const cx = size / 2;
  const cy = size / 2;
  const icon = selected ? 18 : 14;
  const ox = cx - icon / 2;
  const oy = cy - icon / 2;
  const s = icon / 24;
  const ring = selected
    ? `<circle cx="${cx}" cy="${cy}" r="${r + 3.5}" fill="none" stroke="${COURT}" stroke-width="3"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" fill="none">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${COURT}" stroke="#fff" stroke-width="${selected ? 3 : 2}"/>
    ${ring}
    <g transform="translate(${ox} ${oy}) scale(${s})" fill="none" stroke="#fff" stroke-width="2.2" stroke-linejoin="round">
      <circle cx="12" cy="10" r="3"/>
      <path d="${PIN_PATH}"/>
    </g>
  </svg>`;
}

export const INACTIVE_PIN_SVG = pinSvg(false);
export const SELECTED_PIN_SVG = pinSvg(true);

export function courtPinSvg(selected = false) {
  return selected ? SELECTED_PIN_SVG : INACTIVE_PIN_SVG;
}

function drawAsset(ctx: CanvasRenderingContext2D, selected: boolean) {
  const size = selected ? 50 : 36;
  const r = selected ? 22 : 16;
  const cx = size / 2;
  const cy = size / 2;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = selected ? 16 : 10;
  ctx.shadowOffsetY = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = COURT;
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = selected ? 3 : 2;
  ctx.stroke();

  if (selected) {
    ctx.beginPath();
    ctx.arc(cx, cy, r + 3.5, 0, Math.PI * 2);
    ctx.strokeStyle = COURT;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  const icon = selected ? 18 : 14;
  ctx.save();
  ctx.translate(cx - icon / 2, cy - icon / 2);
  ctx.scale(icon / 24, icon / 24);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2.2;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(12, 10, 3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.stroke(new Path2D(PIN_PATH));
  ctx.restore();
}

export function courtPinImageData(selected: boolean): ImageData {
  const dpr = 4;
  const size = selected ? 50 : 36;
  const pad = selected ? 10 : 6;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil((size + pad * 2) * dpr);
  canvas.height = Math.ceil((size + pad * 2) * dpr);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.translate(pad, pad);
  drawAsset(ctx, selected);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}
