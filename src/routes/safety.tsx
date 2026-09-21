import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, SUPPORT_EMAIL } from "@/components/legal-page";

export const Route = createFileRoute("/safety")({
  component: SafetyPage,
});

function SafetyPage() {
  return (
    <LegalPage title="Community Guidelines">
      <p>Last updated: September 21, 2026.</p>
      <p>
        Upset City is competitive, not hostile. Play hard, keep it clean, and
        treat people like humans you might see at the park tomorrow.
      </p>
      <h2 className="pt-2 text-[16px] font-semibold text-fg">On the court</h2>
      <p>
        Call your own fouls. No betting through the app. Don’t bring extra
        people to a listed 1v1. If you can’t make it, cancel in the app.
      </p>
      <h2 className="pt-2 text-[16px] font-semibold text-fg">Meeting people</h2>
      <p>
        Games happen in public parks. Tell someone where you’re going. If a
        situation feels off, leave. We cannot watch the court for you.
      </p>
      <h2 className="pt-2 text-[16px] font-semibold text-fg">In the app</h2>
      <p>
        No harassment, slurs, threats, or sexual content. Don’t share someone
        else’s personal info. You can Block and Report any player, message, or
        game from their profile, chat, or game details.
      </p>
      <h2 className="pt-2 text-[16px] font-semibold text-fg">If something happens</h2>
      <p>
        Use Report for conduct in the app. For an emergency, call local
        authorities first. Then email{" "}
        <a className="font-semibold text-court" href={`mailto:${SUPPORT_EMAIL}`}>
          {SUPPORT_EMAIL}
        </a>
        .
      </p>
    </LegalPage>
  );
}
