import { PRODUCT_NAME } from "@hobai/shared/brand";
import { FREE_PLAN } from "@/lib/plans";

const QUESTIONS = [
  {
    question: "What's a run?",
    answer: `One attempt at a task: ${PRODUCT_NAME} sets up a sandbox, makes the change, runs your checks and opens a pull request, or tells you why it didn't.`,
  },
  {
    question: "Does setting up a repository count?",
    answer: "No. Setup happens once per repository and never uses a run.",
  },
  {
    question: "When do my runs reset?",
    answer:
      "Every month, on the day you signed up. Sign up on the 25th, and your runs come back on the 25th.",
  },
  {
    question: "What if a run fails?",
    answer: `If it failed on ${PRODUCT_NAME}'s side, it doesn't count. Runs you cancel, and runs where the agent couldn't finish, do count: they still use the sandbox and the model.`,
  },
  {
    question: `What happens when I use all ${FREE_PLAN.runsPerCycle}?`,
    answer:
      "You can still open your tasks, review pull requests and set up repositories. New tasks can start again when your cycle resets.",
  },
];

export function PricingQuestions() {
  return (
    <section
      aria-labelledby="questions"
      className="border-t border-border bg-surface"
    >
      <div className="mx-auto max-w-[760px] px-6 py-[72px]">
        <h2
          id="questions"
          className="mb-5 text-[28px] font-semibold tracking-[-0.02em]"
        >
          Questions
        </h2>
        <dl className="border-b border-border">
          {QUESTIONS.map(({ question, answer }) => (
            <div
              key={question}
              className="flex flex-col gap-1.5 border-t border-border py-5"
            >
              <dt className="text-[15px] font-semibold">{question}</dt>
              <dd className="max-w-[640px] text-muted-foreground">{answer}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
