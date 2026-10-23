import { AddRepositoryScreen } from "./add-repository-screen";

type AddRepositoryPageProps = {
  searchParams: Promise<{ github?: string }>;
};

export default async function AddRepositoryPage({
  searchParams,
}: AddRepositoryPageProps) {
  const { github } = await searchParams;
  return <AddRepositoryScreen github={github} />;
}
