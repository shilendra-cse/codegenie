import type { ReactNode } from "react";

export type MarketingLayoutProps = {
  header: ReactNode;
  footer: ReactNode;
  children: ReactNode;
};

export function MarketingLayout({
  header,
  footer,
  children,
}: MarketingLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      {header}
      <main className="flex-1">{children}</main>
      {footer}
    </div>
  );
}
