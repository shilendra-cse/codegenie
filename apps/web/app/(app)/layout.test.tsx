import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppLayout from "./layout";

const auth = vi.hoisted(() => ({
  session: { data: null as unknown, isPending: false },
  signOut: vi.fn(),
}));
const router = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("@/lib/auth-client", () => ({
  useSession: () => auth.session,
  signOut: auth.signOut,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/welcome",
}));
vi.mock("@/features/projects/projects", async (original) => ({
  ...(await original<typeof import("@/features/projects/projects")>()),
  useProjects: () => ({ data: [], isError: false }),
}));
vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "system", setTheme: vi.fn() }),
}));

const ada = {
  user: { name: "Ada Lovelace", email: "ada@example.com", image: null },
};

function renderApp() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <AppLayout>
        <p>Page content</p>
      </AppLayout>
    </QueryClientProvider>,
  );
}

describe("the app shell", () => {
  beforeEach(() => {
    router.replace.mockReset();
    auth.signOut.mockReset().mockResolvedValue({});
  });

  it("shows the page with the signed-in user's account menu", () => {
    auth.session = { data: ada, isPending: false };
    renderApp();

    expect(screen.getByText("Page content")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ada Lovelace, account menu" }),
    ).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("waits while the session loads", () => {
    auth.session = { data: null, isPending: true };
    renderApp();

    expect(router.replace).not.toHaveBeenCalled();
  });

  it("sends an expired session back to sign in", () => {
    auth.session = { data: null, isPending: false };
    renderApp();

    expect(router.replace).toHaveBeenCalledWith("/signin?next=%2Fwelcome");
  });

  it("signs out to the landing page", async () => {
    auth.session = { data: ada, isPending: false };
    renderApp();

    fireEvent.keyDown(
      screen.getByRole("button", { name: "Ada Lovelace, account menu" }),
      { key: "Enter" },
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(auth.signOut).toHaveBeenCalledOnce();
  });
});
