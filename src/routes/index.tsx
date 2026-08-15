import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { User } from "lucide-react";
import { BootSplash, useBootSplash } from "@/components/boot-splash";
import { ViewportLock } from "@/components/viewport-lock";
import { IosKeyboardGuard } from "@/components/ios-keyboard-guard";
import { SceneShell } from "@/components/compete/scene-shell";
import { DEFAULT_CITY, catalogNear } from "@/lib/courts/catalog";
import { fetchCourtsNear } from "@/lib/courts/fetch-courts";
import type { Court, UserLocation } from "@/lib/courts/types";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { SignedIn, SignedOut, UserButton } from "@/lib/auth/gates";
import { milesToMeters } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Home });

const AUSTIN: UserLocation = {
  lat: DEFAULT_CITY.lat,
  lon: DEFAULT_CITY.lon,
  label: "Austin, TX",
};

/** Instant paint — curated courts, no network wait */
function seedCourts(loc: UserLocation, miles: number): Court[] {
  return catalogNear(loc.lat, loc.lon, Math.max(milesToMeters(miles), 12_000), 40);
}

function Home() {
  const [location, setLocation] = useState<UserLocation | null>(AUSTIN);
  const [courts, setCourts] = useState<Court[]>(() => seedCourts(AUSTIN, 8));
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [radiusMi, setRadiusMi] = useState(8);
  const [dataSource, setDataSource] = useState<string>("catalog");
  const { isPending: authPending } = useCurrentUserState();
  const locationRef = useRef<UserLocation | null>(AUSTIN);
  const skipRadiusEffect = useRef(true);
  const bootstrapped = useRef(false);

  const loadCourts = useCallback(async (loc: UserLocation, miles: number) => {
    // Always show seed immediately so the tab never sits empty
    setCourts(seedCourts(loc, miles));
    setLocation(loc);
    locationRef.current = loc;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchCourtsNear({
        data: {
          lat: loc.lat,
          lon: loc.lon,
          radiusMeters: Math.round(milesToMeters(miles)),
          label: loc.label,
        },
      });
      setCourts(result.courts);
      setDataSource(result.source);
      setLocation(result.location);
      locationRef.current = result.location;
    } catch (e) {
      console.error(e);
      // Keep seed courts — don’t wipe the map on network failure
      setError(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    void loadCourts(AUSTIN, 8);
  }, [loadCourts]);

  const requestLocation = useCallback(() => {
    setLocError(null);
    if (!navigator.geolocation) {
      setLocError("Location isn’t available. Showing Austin courts instead.");
      void loadCourts(AUSTIN, radiusMi);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc: UserLocation = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          label: "Near you",
        };
        locationRef.current = loc;
        setLocation(loc);
        setLocating(false);
        void loadCourts(loc, radiusMi);
      },
      () => {
        setLocating(false);
        setLocError("Couldn’t get your location. Showing Austin.");
        void loadCourts(AUSTIN, radiusMi);
      },
      // Fast GPS first — high accuracy can hang for 10–12s on iPhone
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 60_000 },
    );
  }, [loadCourts, radiusMi]);

  useEffect(() => {
    if (skipRadiusEffect.current) {
      skipRadiusEffect.current = false;
      return;
    }
    const loc = locationRef.current;
    if (loc) void loadCourts(loc, radiusMi);
  }, [radiusMi, loadCourts]);

  // Single phase: splash covers until ready, then tabs + content appear together
  const bootReady =
    !authPending && !!location && courts.length > 0 && !locating;
  const showBoot = useBootSplash(bootReady, { minMs: 1600, maxMs: 3500 });
  // Tabs mount in the same gate as splash dismiss — never flash content alone
  const appReady = !showBoot;

  return (
    <div className="app-shell mx-auto w-full max-w-lg overflow-hidden bg-bg">
      <ViewportLock />
      <IosKeyboardGuard />
      <BootSplash active={showBoot} />

      <header className="sticky top-0 z-30 shrink-0 border-b border-border/70 bg-bg/90 px-3 pt-1 pb-1 backdrop-blur-md safe-pt">
        <div className="flex h-9 items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="font-display truncate text-[13px] font-semibold tracking-tight text-fg leading-none">
              <span className="text-court">Upset City</span>
              <span className="mx-1 text-fg-subtle font-normal">·</span>
              <span className="font-medium text-fg-muted">
                {location?.label ?? "Austin, TX"}
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-1.5">
            {authPending ? (
              <div className="size-8 animate-pulse rounded-full bg-bg-subtle" />
            ) : (
              <>
                <SignedIn>
                  <UserButton />
                </SignedIn>
                <SignedOut>
                  <Link
                    to="/login"
                    className="flex size-8 items-center justify-center rounded-full border border-border bg-bg-elevated text-fg-muted"
                    aria-label="Sign in"
                  >
                    <User className="size-3.5" strokeWidth={1.75} />
                  </Link>
                </SignedOut>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {location ? (
          <SceneShell
            courts={courts}
            location={location}
            courtsLoading={loading}
            courtsLocating={locating}
            courtsError={error}
            courtsLocError={locError}
            radiusMi={radiusMi}
            dataSource={dataSource}
            onRadiusChange={setRadiusMi}
            onRefreshCourts={() =>
              location && void loadCourts(location, radiusMi)
            }
            onNearMe={requestLocation}
            showTabBar={appReady}
          />
        ) : (
          <p className="px-4 pt-4 text-center text-sm text-fg-muted">Loading…</p>
        )}
      </main>
    </div>
  );
}
