import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal-page";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>Last updated: September 21, 2026.</p>
      <p>
        By creating an account you agree to these terms. Upset City is for
        recreational 1v1 basketball among players 17 or older.
      </p>
      <h2 className="pt-2 text-[16px] font-semibold text-fg">Eligibility</h2>
      <p>
        You must be at least 17. You are responsible for the accuracy of your
        profile. Accounts that fail the age requirement cannot post or join games.
      </p>
      <h2 className="pt-2 text-[16px] font-semibold text-fg">The product</h2>
      <p>
        We help you find a court and an opponent. We do not supervise games, own
        the parks, or guarantee that anyone will show up. You play at your own
        risk and follow park rules.
      </p>
      <h2 className="pt-2 text-[16px] font-semibold text-fg">Fair play</h2>
      <p>
        Ratings update only after both players confirm a score. Cheating, fake
        scores, harassment, or no-shows can lead to warnings, suspension, or a
        ban.
      </p>
      <h2 className="pt-2 text-[16px] font-semibold text-fg">Your content</h2>
      <p>
        You keep rights to photos and messages you upload. You give Upset City a
        license to display them in the app so the product works.
      </p>
      <h2 className="pt-2 text-[16px] font-semibold text-fg">Limitation</h2>
      <p>
        Upset City is provided as-is. We are not liable for on-court injuries,
        missed games, or disputes between players. Meeting someone from the
        internet is your choice — use the safety tools.
      </p>
    </LegalPage>
  );
}
