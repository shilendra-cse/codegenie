import { SetupScreen } from "./setup-screen";

type EnvironmentPageProps = { params: Promise<{ id: string }> };

export default async function EnvironmentPage({
  params,
}: EnvironmentPageProps) {
  const { id } = await params;
  return <SetupScreen projectId={id} />;
}
