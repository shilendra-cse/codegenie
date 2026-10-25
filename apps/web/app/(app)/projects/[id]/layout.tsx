import type { ReactNode } from "react";
import { ProjectFrame } from "./project-frame";

type ProjectLayoutProps = {
  params: Promise<{ id: string }>;
  children: ReactNode;
};

export default async function ProjectLayout({
  params,
  children,
}: ProjectLayoutProps) {
  const { id } = await params;
  return <ProjectFrame projectId={id}>{children}</ProjectFrame>;
}
