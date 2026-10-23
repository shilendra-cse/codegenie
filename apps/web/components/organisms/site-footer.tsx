import { Logo } from "@/components/atoms/logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-[1160px] flex-wrap items-center gap-4 px-6 py-6">
        <Logo variant="mark" />
        <span className="text-[13px] text-faint">
          © {new Date().getFullYear()} CodeGenie
        </span>
      </div>
    </footer>
  );
}
