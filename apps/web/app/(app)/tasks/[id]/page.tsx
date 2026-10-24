import { TaskScreen } from "./task-screen";

type TaskPageProps = { params: Promise<{ id: string }> };

export default async function TaskPage({ params }: TaskPageProps) {
  const { id } = await params;
  return <TaskScreen taskId={id} />;
}
