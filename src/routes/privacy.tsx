import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal-page";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>Last updated: September 21, 2026.</p>
      <p>
        Upset City is a 1v1 basketball app for players 17+ in Austin. This policy
        explains what we collect and how we use it.
      </p>
      <h2 className="pt-2 text-[16px] font-semibold text-fg">What we collect</h2>
      <p>
        Account info (name, email, password or OAuth identity), profile details
        you provide (photo, height, weight, age, neighborhood), game activity
        (courts, times, scores, ratings), messages you send, reports you file,
        and approximate location when you allow it so we can show nearby courts.
      </p>
      <h2 className="pt-2 text-[16px] font-semibold text-fg">What other players see</h2>
      <p>
        Public profiles show your name, photo, rating, record, and neighborhood.
        Other players never see your age, gender, ethnicity, or email. Direct
        messages and game chats are private between the people in that thread.
      </p>
      <h2 className="pt-2 text-[16px] font-semibold text-fg">How we use data</h2>
      <p>
        To run the app: sign-in, matchmaking, ratings, notifications, safety, and
        support. We send transactional email (password reset, verification, game
        alerts) when mail is configured. We do not sell your personal data.
      </p>
      <h2 className="pt-2 text-[16px] font-semibold text-fg">Retention & deletion</h2>
      <p>
        You can delete your account from Me → Settings. We anonymize your player
        profile so past opponents still see a completed game history, and we
        remove your sign-in.
      </p>
      <h2 className="pt-2 text-[16px] font-semibold text-fg">Contact</h2>
      <p>Email seanvoss23@gmail.com for privacy requests.</p>
    </LegalPage>
  );
}
