import { Check } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { PRODUCT_NAME } from "@hobai/shared/brand";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Icon } from "@/components/atoms/icon";
import { FREE_PLAN } from "@/lib/plans";
import { APP_HOME, SIGN_IN } from "@/lib/routes";
import { cn } from "@/lib/utils";

function Features({ items }: { items: ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5">
          <Icon icon={Check} className="mt-0.5 text-muted-foreground" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function PlanCard({
  name,
  badge,
  price,
  priceNote,
  features,
  action,
  className,
}: {
  name: string;
  badge?: ReactNode;
  price: string;
  priceNote?: string;
  features: ReactNode[];
  action: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label={`${name} plan`}
      className={cn(
        "flex h-full flex-col gap-[22px] rounded-[14px] border border-border bg-card p-7",
        className,
      )}
    >
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{name}</h2>
          {badge}
        </div>
        <p className="flex items-baseline gap-1.5">
          <span
            className={cn(
              "text-[40px] font-semibold tracking-[-0.03em]",
              !priceNote && "text-faint",
            )}
          >
            {price}
          </span>
          {priceNote && <span className="text-faint">{priceNote}</span>}
        </p>
      </div>
      <Features items={features} />
      <span className="flex-1" />
      {action}
    </section>
  );
}

export type PlanCardsProps = { signedIn: boolean };

/** Free, and Pro coming soon. */
export function PlanCards({ signedIn }: PlanCardsProps) {
  return (
    <div className="mx-auto grid max-w-[880px] grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-5 px-6 pt-4 pb-[72px]">
      <div className="beam">
        <PlanCard
          name="Free"
          badge={signedIn && <Badge>Your plan</Badge>}
          price="₹0"
          priceNote="/ month"
          className="border-0"
          features={[
            <>
              <strong className="font-semibold">
                {FREE_PLAN.runsPerCycle} runs
              </strong>{" "}
              per cycle, a month from the day you sign up
            </>,
            `${FREE_PLAN.concurrentRuns} task at a time`,
            FREE_PLAN.model,
            "Setting up a repository is free and doesn't count",
            "Pull requests with your own lint, type-check and tests run",
          ]}
          action={
            <Button
              asChild
              size="lg"
              variant={signedIn ? "secondary" : "primary"}
              glow={!signedIn}
              className="w-full"
            >
              {signedIn ? (
                <Link href={APP_HOME}>Open {PRODUCT_NAME}</Link>
              ) : (
                <Link href={SIGN_IN}>Start free</Link>
              )}
            </Button>
          }
        />
      </div>
      <PlanCard
        name="Pro"
        badge={<Badge>Coming soon</Badge>}
        price="Soon"
        className="bg-surface"
        features={[
          "More runs every month",
          "Choose the model for each task",
          "More tasks at once",
          "Everything in Free",
        ]}
        action={
          <Button size="lg" disabled className="w-full">
            Coming soon
          </Button>
        }
      />
    </div>
  );
}
