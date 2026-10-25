import type { Sandbox, SandboxLabels } from "@hobai/sandbox";

export type SandboxFactory = (labels: SandboxLabels) => Promise<Sandbox>;

export type SandboxConnector = (id: string) => Promise<Sandbox | null>;
