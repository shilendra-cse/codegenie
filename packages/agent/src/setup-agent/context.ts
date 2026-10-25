import type {
  EnvironmentDecision,
  EnvironmentProposal,
  TryResult,
  UserChannel,
} from "@hobai/shared";

export type SetupToolContext = {
  tryEnvironment: (proposal: EnvironmentProposal) => Promise<TryResult>;
  channel: UserChannel;
  questionsAsked: number;
  decisions: EnvironmentDecision[];
};
