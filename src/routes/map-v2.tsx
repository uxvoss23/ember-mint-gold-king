import { createFileRoute } from "@tanstack/react-router";
import { MapV2 } from "@/components/map-v2";

export const Route = createFileRoute("/map-v2")({
  component: MapV2Page,
});

function MapV2Page() {
  return (
    <main style={{ height: "100dvh", width: "100%", background: "#101318" }}>
      <MapV2 />
    </main>
  );
}
