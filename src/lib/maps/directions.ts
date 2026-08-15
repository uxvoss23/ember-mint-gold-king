/** Open native maps for turn-by-turn routing to a court. */
export function directionsUrl(
  lat: number,
  lon: number,
  label?: string,
): string {
  const q = label?.trim()
    ? encodeURIComponent(label)
    : `${lat},${lon}`;

  // iPhone / iPad → Apple Maps directions
  if (
    typeof navigator !== "undefined" &&
    /iPhone|iPad|iPod/.test(navigator.userAgent)
  ) {
    return `https://maps.apple.com/?daddr=${lat},${lon}&q=${q}&dirflg=d`;
  }

  // Android, desktop, Mac → Google Maps directions
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`;
}

export function openDirections(lat: number, lon: number, label?: string) {
  window.open(directionsUrl(lat, lon, label), "_blank", "noopener,noreferrer");
}
