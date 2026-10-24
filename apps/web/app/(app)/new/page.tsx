import { NewTaskScreen } from "./new-task-screen";

type NewTaskPageProps = { searchParams: Promise<{ project?: string }> };

export default async function NewTaskPage({ searchParams }: NewTaskPageProps) {
  const { project } = await searchParams;
  return <NewTaskScreen projectId={project} />;
}
