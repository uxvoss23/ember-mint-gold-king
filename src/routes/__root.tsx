import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { CreatedWithGrokBanner } from "@/components/created-with-grok-banner";
import appCss from "../styles.css?url";

const APP_NAME = "Upset City — Where the best hoopers emerge";
const host = import.meta.env.VITE_PUBLIC_HOSTNAME;
const ogImage = host
  ? `https://og.grok.me/v1/card.png?host=${encodeURIComponent(host)}&title=${encodeURIComponent("Upset City")}`
  : undefined;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=overlays-content",
      },
      {
        name: "description",
        content:
          "Upset City — where the best hoopers emerge. Find Austin outdoor courts and step into the rated 1v1 scene.",
      },
      { name: "theme-color", content: "#0c0c0d" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { title: APP_NAME },
      ...(ogImage
        ? [
            { property: "og:image", content: ogImage },
            { property: "og:image:width", content: "1200" },
            { property: "og:image:height", content: "630" },
          ]
        : []),
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Instrument+Sans:wght@500;600;700&display=swap",
      },
    ],
  }),
  component: RootDocument,
});

function RootDocument() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* Critical first paint — covers body until React boot splash takes over */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
html,body{overflow:hidden}
#uc-static-boot{position:fixed;inset:0;z-index:2147483646;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0c0c0d;color:#fafafa;font-family:system-ui,sans-serif}
#uc-static-boot .uc-orb{width:4.25rem;height:4.25rem;border-radius:9999px;background:linear-gradient(180deg,#e0783a,#c45c26);display:grid;place-items:center;box-shadow:0 12px 40px rgba(196,92,38,.45)}
#uc-static-boot p{margin:.75rem 0 0;letter-spacing:.28em;font-size:13px;font-weight:600;color:#c45c26;text-transform:uppercase}
#uc-static-boot h1{margin:.35rem 0 0;font-size:1.65rem;font-weight:600;text-align:center;line-height:1.15;max-width:16rem}
#uc-static-boot .uc-sub{margin-top:1.75rem;font-size:11px;color:#71717a}
`,
          }}
        />
      </head>
      <body className="bg-bg text-fg antialiased">
        <div id="uc-static-boot" aria-hidden="true">
          <div className="uc-orb">
            <svg width="40" height="40" viewBox="0 0 64 64" fill="none" aria-hidden="true">
              <circle cx="32" cy="32" r="22" stroke="white" strokeWidth="2.2" />
              <path d="M32 10v44M10 32h44" stroke="white" strokeWidth="2" />
              <path d="M18 16c8 6 20 6 28 0M18 48c8-6 20-6 28 0" stroke="white" strokeWidth="2" />
            </svg>
          </div>
          <p>Upset City</p>
          <h1>Where the best hoopers emerge</h1>
          <div className="uc-sub">Loading Austin…</div>
        </div>
        <CreatedWithGrokBanner />
        <AuthProvider>
          <Outlet />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
