import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { CreatedWithGrokBanner } from "@/components/created-with-grok-banner";
import { PREMIUM_BOOT_CSS, PremiumBootHost } from "@/components/premium-boot";
import { NotFoundPage } from "@/components/not-found";
import appCss from "../styles.css?url";

const APP_NAME = "Upset City — Where the best hoopers emerge";
const host = import.meta.env.VITE_PUBLIC_HOSTNAME;
const ogImage = host
  ? `https://og.grok.me/v1/card.png?host=${encodeURIComponent(host)}&title=${encodeURIComponent("Upset City")}`
  : undefined;

const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Instrument+Sans:wght@500;600;700&display=swap";

const BOOT_SCRIPT = `(function(){document.documentElement.removeAttribute("data-uc-booting");var lines=["Lacing up","Checking the board","Finding a run","Tip-off soon"];var i=0;var s=document.getElementById("uc-boot-status");var t=setInterval(function(){i=(i+1)%lines.length;if(s)s.textContent=lines[i];if(!document.getElementById("uc-premium-boot"))clearInterval(t);},900);})();`;

export const Route = createRootRoute({
  notFoundComponent: NotFoundPage,
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
      { name: "theme-color", content: "#070708" },
      { name: "color-scheme", content: "dark" },
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
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
    ],
  }),
  component: RootDocument,
});

function RootDocument() {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      style={{ background: "#070708", colorScheme: "dark" }}
    >
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: `html,body,#root{background:#070708!important;color-scheme:dark}${PREMIUM_BOOT_CSS}`,
          }}
        />
        <HeadContent />
        <link rel="stylesheet" href={appCss} />
        <link
          rel="stylesheet"
          href={FONT_HREF}
          media="print"
          onLoad={(e) => {
            e.currentTarget.media = "all";
          }}
        />
        <noscript>
          <link rel="stylesheet" href={FONT_HREF} />
        </noscript>
      </head>
      <body
        className="bg-bg text-fg antialiased"
        style={{ background: "#070708", color: "#f4f4f5", margin: 0 }}
      >
        <PremiumBootHost />
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
        <CreatedWithGrokBanner />
        <AuthProvider>
          <Outlet />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
