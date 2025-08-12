import { useRouter } from "next/router";
import PaintingStatusList from "../../components/PaintingStatusList";

export default function JobPage() {
  const { query } = useRouter();
  if (!query.jobId) return null;
  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Job Status</h1>
      <PaintingStatusList jobId={query.jobId as string} />
    </div>
  );
}
