import { EnvironmentScreen } from "./environment-screen";

type EnvironmentPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
};

export default async function EnvironmentPage({
  params,
  searchParams,
}: EnvironmentPageProps) {
  const [{ id }, { view }] = await Promise.all([params, searchParams]);
  return <EnvironmentScreen projectId={id} view={view} />;
}
