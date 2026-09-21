import { createFileRoute } from "@tanstack/react-router";
import { AdminTestUsersPage } from "@/components/admin-test-users";

export const Route = createFileRoute("/admin/test-users")({
  component: AdminTestUsersPage,
});
