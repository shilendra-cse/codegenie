import type { Sandbox, SandboxLabels } from "@codegenie/sandbox";

export type SandboxFactory = (labels: SandboxLabels) => Promise<Sandbox>;

export type SandboxConnector = (id: string) => Promise<Sandbox | null>;
