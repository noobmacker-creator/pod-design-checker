"use client";
import { useState } from "react";

export default function Home() {
  const [fileName, setFileName] = useState("");
  const [imageWidth, setImageWidth] = useState<number | null>(null);
  const [imageHeight, setImageHeight] = useState<number | null>(null);

  function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    const imageUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      setImageWidth(img.width);
      setImageHeight(img.height);
      URL.revokeObjectURL(imageUrl);
    };

    img.src = imageUrl;
  }

  const isPerfectSize = imageWidth === 4200 && imageHeight === 4800;
  const isLargeEnough =
    imageWidth !== null &&
    imageHeight !== null &&
    imageWidth >= 4200 &&
    imageHeight >= 4800;

  return (
    <main style={{ textAlign: "center", padding: "40px", fontFamily: "Arial" }}>
      <h1>POD Design Checker</h1>

      <p>Upload your design to start scanning.</p>

      <input type="file" accept="image/png" onChange={handleUpload} />

      {fileName && (
        <div style={{ marginTop: "20px" }}>
          <p>Uploaded file:</p>
          <strong>{fileName}</strong>
        </div>
      )}

      {imageWidth !== null && imageHeight !== null && (
        <div style={{ marginTop: "20px" }}>
          <p>
            Image size: <strong>{imageWidth} × {imageHeight}</strong>
          </p>

          {isPerfectSize && (
            <p style={{ color: "green", fontWeight: "bold" }}>
              ✔ Perfect size for POD
            </p>
          )}

          {isLargeEnough && !isPerfectSize && (
            <p style={{ color: "orange", fontWeight: "bold" }}>
              ⚠ Larger than recommended. Consider resizing canvas to 4200 × 4800.
            </p>
          )}

          {!isLargeEnough && (
            <p style={{ color: "red", fontWeight: "bold" }}>
              ✘ Too small for high-quality POD printing. Recommended: 4200 × 4800.
            </p>
          )}
        </div>
      )}

      <div style={{ marginTop: "40px" }}>
        <a
          href="https://buymeacoffee.com/poddesignchecker"
          target="_blank"
          rel="noreferrer"
        >
          Support the project ☕
        </a>
      </div>
    </main>
  );
}