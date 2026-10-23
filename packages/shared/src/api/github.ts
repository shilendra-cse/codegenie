export type GitHubInstallation = {
  id: number;
  accountLogin: string;
  accountType: "user" | "organization";
};

export type GitHubRepo = {
  id: number;
  fullName: string;
  owner: string;
  name: string;
  defaultBranch: string;
  private: boolean;
  htmlUrl: string;
  updatedAt: string | null;
  projectId: string | null;
};

export type GitHubInstallationsResponse = {
  installations: GitHubInstallation[];
  installUrl: string;
};

export type GitHubReposResponse = { repositories: GitHubRepo[] };
