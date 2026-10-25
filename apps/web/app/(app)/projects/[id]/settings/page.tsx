import { SettingsScreen } from "./settings-screen";

type SettingsPageProps = { params: Promise<{ id: string }> };

export default async function SettingsPage({ params }: SettingsPageProps) {
  const { id } = await params;
  return <SettingsScreen projectId={id} />;
}
