import type {
  OnboardingAnswer,
  OnboardingAnswerMessage,
} from "@codegenie/shared";

type Receive = (questionId: string, answer: OnboardingAnswer) => void;

/** Hands answers arriving over Redis to the setup this worker is running. */
export type AnswerRouter = {
  /** Returns the function that stops receiving. */
  register(onboardingId: string, receive: Receive): () => void;
  /** False when no setup here is waiting for it (another worker may hold it). */
  deliver(message: OnboardingAnswerMessage): boolean;
};

export function createAnswerRouter(): AnswerRouter {
  const setups = new Map<string, Receive>();
  return {
    register(onboardingId, receive) {
      setups.set(onboardingId, receive);
      return () => {
        if (setups.get(onboardingId) === receive) setups.delete(onboardingId);
      };
    },
    deliver({ onboardingId, questionId, answer }) {
      const receive = setups.get(onboardingId);
      receive?.(questionId, answer);
      return Boolean(receive);
    },
  };
}
