"use client";

import type { OnboardingAnswer } from "@hobai/shared";
import { useQueryClient } from "@tanstack/react-query";
import { Alert } from "@/components/atoms/alert";
import { Button } from "@/components/atoms/button";
import { Skeleton } from "@/components/atoms/skeleton";
import { SetupIntro } from "@/components/molecules/setup-intro";
import { SetupStatusBadge } from "@/components/molecules/setup-status-badge";
import { EnvironmentCard } from "@/components/organisms/environment-card";
import { QuestionCard } from "@/components/organisms/question-card";
import { SetupOutcome } from "@/components/organisms/setup-outcome";
import { SetupTimeline } from "@/components/organisms/setup-timeline";
import { useAccount } from "@/features/account/use-account";
import { useProject } from "@/features/projects/projects";
import { onboardingKey } from "@/features/setup/api";
import {
  useAnswerOnboarding,
  useCancelOnboarding,
  useEnvironments,
  useStartOnboarding,
} from "@/features/setup/use-onboarding";
import { useSetupProgress } from "@/features/setup/use-setup-progress";
import { ApiError } from "@/lib/api/client";
import { formatCost, formatDuration } from "@/lib/format";
import { newTaskPath } from "@/lib/routes";
import { useNow } from "@/lib/use-now";
import { toSetupBlocks } from "./setup-blocks";

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong. Try again.";

export type SetupScreenProps = { projectId: string };

export function SetupScreen({ projectId }: SetupScreenProps) {
  const queryClient = useQueryClient();
  const { account } = useAccount();
  const projectName =
    useProject(projectId).project?.repo.name ?? "this project";
  const { latest, onboarding, active, timeline } = useSetupProgress(projectId);
  const now = useNow(active);
  const blocks = toSetupBlocks(timeline.lines, { active, now });
  const saved = onboarding?.status === "succeeded";
  const environments = useEnvironments(saved ? projectId : undefined);
  const environment = environments.data?.find(
    (e) => e.version === onboarding?.environmentVersion,
  );

  const start = useStartOnboarding(projectId);
  const answer = useAnswerOnboarding(projectId);
  const stop = useCancelOnboarding(projectId);

  const sendAnswer = (questionId: string, given: OnboardingAnswer) =>
    answer.mutate(
      { questionId, answer: given },
      {
        // Answered elsewhere, stopped or timed out: show what's true now.
        onError: (error) => {
          if (error instanceof ApiError && error.code === "QUESTION_NOT_OPEN") {
            void queryClient.invalidateQueries({
              queryKey: onboardingKey(projectId),
            });
          }
        },
      },
    );
  const answerError =
    answer.error instanceof ApiError &&
    answer.error.code === "QUESTION_NOT_OPEN"
      ? null
      : answer.error && messageOf(answer.error);

  const startedAt = onboarding?.startedAt
    ? Date.parse(onboarding.startedAt)
    : null;
  const elapsed =
    onboarding?.durationMs ?? (startedAt !== null ? now - startedAt : null);
  const meta = [
    elapsed !== null && formatDuration(elapsed),
    onboarding && onboarding.costUsd > 0 && formatCost(onboarding.costUsd),
  ]
    .filter(Boolean)
    .join(" · ");

  const outcomeProps = {
    projectName,
    onStart: () => start.mutate(),
    starting: start.isPending,
    startError: start.error && messageOf(start.error),
  };

  return (
    <div className="mx-auto flex w-full max-w-[780px] flex-col gap-6 px-6 pt-8 pb-20">
      {(onboarding || meta) && (
        <div className="flex flex-wrap items-center gap-2.5">
          {onboarding && (
            <SetupStatusBadge
              status={onboarding.status}
              version={onboarding.environmentVersion}
            />
          )}
          <span className="flex-1" />
          {meta && <span className="text-[13px] text-faint">{meta}</span>}
          {active && (
            <Button
              variant="ghost"
              size="sm"
              busy={stop.isPending}
              onClick={() => stop.mutate()}
            >
              Stop setup
            </Button>
          )}
        </div>
      )}
      <SetupIntro projectName={projectName} />
      {stop.error && (
        <Alert tone="error">
          Couldn&apos;t stop setup: {messageOf(stop.error)}
        </Alert>
      )}

      {latest.isPending ? (
        <Skeleton className="h-40 rounded-lg" />
      ) : latest.isError ? (
        <Alert tone="error">
          We couldn&apos;t load this setup. {messageOf(latest.error)}
        </Alert>
      ) : (
        <>
          {blocks.map((block) =>
            block.kind === "lines" ? (
              <SetupTimeline
                key={block.key}
                lines={block.lines}
                live={block.live}
              />
            ) : block.state === "open" ? (
              <QuestionCard
                key={block.key}
                number={block.number}
                question={block.question}
                you={{
                  name: account?.name ?? "You",
                  image: account?.image ?? null,
                }}
                state="open"
                busy={answer.isPending}
                error={answerError}
                onAnswer={(given) => sendAnswer(block.question.id, given)}
              />
            ) : (
              <QuestionCard
                key={block.key}
                number={block.number}
                question={block.question}
                you={{
                  name: account?.name ?? "You",
                  image: account?.image ?? null,
                }}
                {...(block.state === "answered"
                  ? { state: "answered" as const, answer: block.answer ?? "" }
                  : { state: "unanswered" as const })}
              />
            ),
          )}

          {!onboarding && (
            <SetupOutcome {...outcomeProps} state="not-started" />
          )}
          {onboarding?.status === "queued" && (
            <SetupOutcome {...outcomeProps} state="queued" />
          )}
          {onboarding?.status === "failed" && (
            <SetupOutcome
              {...outcomeProps}
              state="failed"
              reason={onboarding.error?.message ?? "Setup didn't finish."}
            />
          )}
          {onboarding?.status === "cancelled" && (
            <SetupOutcome {...outcomeProps} state="stopped" />
          )}
          {saved && environment && (
            <EnvironmentCard
              projectName={projectName}
              environment={environment}
              newTaskHref={newTaskPath(projectId)}
            />
          )}
        </>
      )}
    </div>
  );
}
