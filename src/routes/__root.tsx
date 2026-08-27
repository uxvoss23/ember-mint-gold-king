import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { CreatedWithGrokBanner } from "@/components/created-with-grok-banner";
import { PREMIUM_BOOT_CSS, PREMIUM_BOOT_HTML } from "@/components/premium-boot";
import appCss from "../styles.css?url";

const APP_NAME = "Upset City — Where the best hoopers emerge";
const host = import.meta.env.VITE_PUBLIC_HOSTNAME;
const ogImage = host
  ? `https://og.grok.me/v1/card.png?host=${encodeURIComponent(host)}&title=${encodeURIComponent("Upset City")}`
  : undefined;

const BOOT_SCRIPT = `(function(){var lines=["Lacing up","Checking the board","Finding a run","Tip-off soon"];var i=0;var s=document.getElementById("uc-boot-status");var t=setInterval(function(){i=(i+1)%lines.length;if(s)s.textContent=lines[i];},900);function hide(){clearInterval(t);var el=document.getElementById("uc-premium-boot");if(!el||el.classList.contains("uc-boot-out"))return;el.classList.add("uc-boot-out");setTimeout(function(){try{el.remove()}catch(e){}},500);}document.addEventListener("uc:app-ready",hide,{once:true});setTimeout(hide,12000);})();`;

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
      { name: "theme-color", content: "#070708" },
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
        <style dangerouslySetInnerHTML={{ __html: PREMIUM_BOOT_CSS }} />
      </head>
      <body className="bg-bg text-fg antialiased">
        <div
          id="uc-premium-boot"
          suppressHydrationWarning
          role="status"
          aria-label="Loading Upset City"
          dangerouslySetInnerHTML={{ __html: PREMIUM_BOOT_HTML }}
        />
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
