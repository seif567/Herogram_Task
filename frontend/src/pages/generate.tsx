// pages/generate.tsx
import { useState } from "react";
import API from "../services/api";

export default function GeneratePage() {
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [numImages, setNumImages] = useState(1);
  const [files, setFiles] = useState<File[]>([]);

  async function startGeneration() {
    const formData = new FormData();
    formData.append("title", title);
    formData.append("instructions", instructions);
    formData.append("numImages", String(numImages));
    files.forEach((f) => formData.append("refs", f));

    const { data } = await API.post("/generate", formData);
    // navigate to job status page
    window.location.href = `/job/${data.jobId}`;
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Generate Paintings</h1>
      <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea placeholder="Instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} />
      <input type="number" value={numImages} min={1} max={10} onChange={(e) => setNumImages(Number(e.target.value))} />
      <input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} />
      <button onClick={startGeneration}>Generate Paintings</button>
    </div>
  );
}
