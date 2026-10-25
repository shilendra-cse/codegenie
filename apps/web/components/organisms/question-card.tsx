"use client";

import type { OnboardingAnswer, OnboardingQuestion } from "@hobai/shared";
import { useState } from "react";
import { PRODUCT_NAME } from "@hobai/shared/brand";
import { Alert } from "@/components/atoms/alert";
import { Avatar } from "@/components/atoms/avatar";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Input } from "@/components/atoms/input";
import { Logo } from "@/components/atoms/logo";
import { RadioCard } from "@/components/atoms/radio-card";
import { cn } from "@/lib/utils";

const MAX_QUESTIONS = 5;
const OTHER = -1;

export type QuestionCardProps = {
  number: number;
  question: OnboardingQuestion;
  you: { name: string; image: string | null };
} & (
  | {
      state: "open";
      onAnswer: (answer: OnboardingAnswer) => void;
      busy: boolean;
      error: string | null;
    }
  | { state: "answered"; answer: string }
  | { state: "unanswered" }
);

export function QuestionCard(props: QuestionCardProps) {
  const { number, question } = props;
  const [choice, setChoice] = useState(0);
  const [other, setOther] = useState("");
  const headingId = `question-${question.id}`;
  const answer: OnboardingAnswer =
    choice === OTHER ? { other: other.trim() } : { option: choice };

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "rise flex flex-col gap-3.5 rounded-lg border bg-card p-5",
        props.state === "open" ? "border-primary-border" : "border-border",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="flex size-6 items-center justify-center">
          <Logo variant="mark" />
        </span>
        <span className="text-[13px] text-faint">
          Question {number} · I ask at most {MAX_QUESTIONS}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <h2 id={headingId} className="text-base leading-snug font-semibold">
          {question.question}
        </h2>
        {question.why && (
          <p className="text-[13px] text-muted-foreground">{question.why}</p>
        )}
      </div>

      {props.state === "open" && (
        <form
          className="flex flex-col gap-3.5"
          onSubmit={(event) => {
            event.preventDefault();
            props.onAnswer(answer);
          }}
        >
          <div
            role="radiogroup"
            aria-labelledby={headingId}
            className="flex flex-col gap-2"
          >
            {question.options.map((option, index) => (
              <RadioCard
                key={option.label}
                name={headingId}
                checked={choice === index}
                onSelect={() => setChoice(index)}
              >
                <span className="flex flex-wrap items-center gap-2 font-medium">
                  {option.label}
                  {index === 0 && <Badge tone="progress">Recommended</Badge>}
                </span>
                {option.detail && (
                  <span className="text-[13px] text-muted-foreground">
                    {option.detail}
                  </span>
                )}
              </RadioCard>
            ))}
            {question.allowOther && (
              <RadioCard
                name={headingId}
                checked={choice === OTHER}
                onSelect={() => setChoice(OTHER)}
              >
                <span className="font-medium">Something else</span>
                {choice === OTHER && (
                  <Input
                    aria-label="Your answer"
                    placeholder={`Tell ${PRODUCT_NAME} what to do`}
                    value={other}
                    maxLength={2000}
                    onChange={(event) => setOther(event.target.value)}
                    className="mt-2"
                  />
                )}
              </RadioCard>
            )}
          </div>
          {props.error && <Alert tone="error">{props.error}</Alert>}
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              type="submit"
              variant="primary"
              glow
              busy={props.busy}
              disabled={choice === OTHER && !other.trim()}
            >
              Answer
            </Button>
            <span className="text-[13px] text-faint">
              Setup continues as soon as you answer. It waits up to 30 minutes.
            </span>
          </div>
        </form>
      )}

      {props.state === "answered" && (
        <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2.5">
          <Avatar name={props.you.name} src={props.you.image} />
          <span>{props.answer}</span>
        </div>
      )}
      {props.state === "unanswered" && (
        <span className="text-[13px] text-faint">No answer was given.</span>
      )}
    </section>
  );
}
