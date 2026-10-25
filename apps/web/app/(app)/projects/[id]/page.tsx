import { ProjectTasksScreen } from "./project-tasks-screen";

type ProjectPageProps = { params: Promise<{ id: string }> };

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params;
  return <ProjectTasksScreen projectId={id} />;
}
