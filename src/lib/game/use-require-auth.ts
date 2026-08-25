import { useNavigate } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { AUTH_REASON_COPY, saveAuthIntent } from "@/lib/game/guest";

export function useRequireAuth() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();

  return (action: string, next = "/"): boolean => {
    if (isPending) return false;
    if (user) return true;
    saveAuthIntent({ next, action });
    void navigate({ to: "/login" });
    return false;
  };
}

export function authReasonCopy(action?: string | null): string {
  if (!action) return "An account is required for this action.";
  return AUTH_REASON_COPY[action] ?? "An account is required for this action.";
}