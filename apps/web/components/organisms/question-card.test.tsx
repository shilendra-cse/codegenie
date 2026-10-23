import type { OnboardingQuestion } from "@codegenie/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuestionCard } from "./question-card";

const question: OnboardingQuestion = {
  id: "q-1",
  question: "Backend tests need PostgreSQL. What should I do?",
  why: "They connect to localhost:5432.",
  options: [
    { label: "Skip them", detail: "pnpm test --exclude 'test/db/**'" },
    { label: "Keep them" },
  ],
  allowOther: true,
};
const you = { name: "Ada Lovelace", image: null };

function open(overrides: Partial<OnboardingQuestion> = {}, extra = {}) {
  const onAnswer = vi.fn();
  render(
    <QuestionCard
      number={1}
      question={{ ...question, ...overrides }}
      you={you}
      state="open"
      onAnswer={onAnswer}
      busy={false}
      error={null}
      {...extra}
    />,
  );
  return onAnswer;
}

describe("QuestionCard", () => {
  it("asks, recommends the first option, and answers with the choice", () => {
    const onAnswer = open();

    expect(
      screen.getByRole("heading", { name: question.question }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("They connect to localhost:5432."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Question 1 · I ask at most 5"),
    ).toBeInTheDocument();
    expect(screen.getByText("Recommended")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Skip them/ })).toBeChecked();

    fireEvent.click(screen.getByRole("radio", { name: "Keep them" }));
    fireEvent.click(screen.getByRole("button", { name: "Answer" }));
    expect(onAnswer).toHaveBeenCalledWith({ option: 1 });
  });

  it("takes an answer in your own words, only where allowed", () => {
    const onAnswer = open();
    fireEvent.click(screen.getByRole("radio", { name: /Something else/ }));
    const answerButton = screen.getByRole("button", { name: "Answer" });

    expect(answerButton).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "Your answer" }), {
      target: { value: "  Use SQLite  " },
    });
    fireEvent.click(answerButton);
    expect(onAnswer).toHaveBeenCalledWith({ other: "Use SQLite" });
  });

  it("offers only the options when free text isn't allowed", () => {
    open({ allowOther: false });
    expect(screen.queryByRole("radio", { name: /Something else/ })).toBeNull();
  });

  it("shows that it's sending, and why sending failed", () => {
    open({}, { busy: true, error: "Couldn't reach CodeGenie." });
    expect(screen.getByRole("button", { name: "Answer" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't reach CodeGenie.",
    );
  });

  it("shows your answer once given, and says when none came", () => {
    const { rerender } = render(
      <QuestionCard
        number={1}
        question={question}
        you={you}
        state="answered"
        answer="Skip them"
      />,
    );
    expect(screen.getByText("Skip them")).toBeInTheDocument();
    expect(screen.queryByRole("radio")).toBeNull();

    rerender(
      <QuestionCard
        number={1}
        question={question}
        you={you}
        state="unanswered"
      />,
    );
    expect(screen.getByText("No answer was given.")).toBeInTheDocument();
  });
});
