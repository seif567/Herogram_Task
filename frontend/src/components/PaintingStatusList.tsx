import { useEffect, useState } from "react";
import API from "../services/api";
import PaintingCard from "./PaintingCard";

export default function PaintingStatusList({ jobId }: { jobId: string }) {
  const [paintings, setPaintings] = useState([]);

  useEffect(() => {
    if (!jobId) return;
    const interval = setInterval(async () => {
      const { data } = await API.get(`/jobs/${jobId}`);
      setPaintings(data.paintings);
    }, 2000);
    return () => clearInterval(interval);
  }, [jobId]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {paintings.map((p: any) => (
        <PaintingCard key={p.id} painting={p} />
      ))}
    </div>
  );
}
