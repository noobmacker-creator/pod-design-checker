'use client';

import React, { useEffect, useRef, useState } from 'react';

const TARGET_W = 4200;
const TARGET_H = 4800;

export default function Page() {
  const [file, setFile] = useState<File | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [imgUrl, setImgUrl] = useState('');
  const [actionMessage, setActionMessage] = useState('Upload a design to begin.');
  const [downloadMessage, setDownloadMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    return () => {
      if (imgUrl) URL.revokeObjectURL(imgUrl);
    };
  }, [imgUrl]);

  useEffect(() => {
    if (!img || !previewCanvasRef.current) return;

    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = TARGET_W;
    canvas.height = TARGET_H;

    const square = 40;
    for (let y = 0; y < TARGET_H; y += square) {
      for (let x = 0; x < TARGET_W; x += square) {
        ctx.fillStyle =
          (Math.floor(x / square) + Math.floor(y / square)) % 2 === 0 ? '#1f2937' : '#374151';
        ctx.fillRect(x, y, square, square);
      }
    }

    const scale = Math.min(TARGET_W / img.naturalWidth, TARGET_H / img.naturalHeight);
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    const drawX = Math.round((TARGET_W - drawW) / 2);
    const drawY = Math.round((TARGET_H - drawH) / 2);

    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, TARGET_W - 6, TARGET_H - 6);
  }, [img]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (imgUrl) URL.revokeObjectURL(imgUrl);

    setIsProcessing(true);
    setFile(selected);
    setDownloadMessage('');

    const url = URL.createObjectURL(selected);
    setImgUrl(url);

    const nextImg = new Image();
    nextImg.onload = () => {
      setImg(nextImg);
      setActionMessage('Design loaded. Press "Fix Transparency" if needed.');
      setIsProcessing(false);
    };
    nextImg.onerror = () => {
      setActionMessage('Could not load this image file.');
      setIsProcessing(false);
    };
    nextImg.src = url;
  }

  function handleFixTransparency() {
    if (!img) {
      setActionMessage('Upload a design first, then press Fix Transparency.');
      return;
    }

    setIsProcessing(true);

    const processCanvas = document.createElement('canvas');
    processCanvas.width = img.naturalWidth;
    processCanvas.height = img.naturalHeight;

    const ctx = processCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      setActionMessage('Could not start transparency processing.');
      setIsProcessing(false);
      return;
    }

    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, processCanvas.width, processCanvas.height);
    const { data, width, height } = imageData;

    const corners = [
      0,
      (width - 1) * 4,
      ((height - 1) * width) * 4,
      ((height - 1) * width + (width - 1)) * 4,
    ];

    let bgR = 0;
    let bgG = 0;
    let bgB = 0;

    corners.forEach((idx) => {
      bgR += data[idx];
      bgG += data[idx + 1];
      bgB += data[idx + 2];
    });

    bgR /= corners.length;
    bgG /= corners.length;
    bgB /= corners.length;

    const tolerance = 52;
    let removedPixels = 0;

    for (let i = 0; i < data.length; i += 4) {
      const dr = data[i] - bgR;
      const dg = data[i + 1] - bgG;
      const db = data[i + 2] - bgB;
      const distance = Math.sqrt(dr * dr + dg * dg + db * db);

      if (distance <= tolerance && data[i + 3] > 0) {
        data[i + 3] = 0;
        removedPixels++;
      }
    }

    ctx.putImageData(imageData, 0, 0);

    const nextImg = new Image();
    nextImg.onload = () => {
      setImg(nextImg);
      setActionMessage(
        removedPixels > 0
          ? `Removed background-like pixels: ${removedPixels.toLocaleString()}.`
          : 'No near-solid background pixels found to remove.'
      );
      setDownloadMessage('Transparency fix complete. You can now download PNG.');
      setIsProcessing(false);
    };

    nextImg.src = processCanvas.toDataURL('image/png');
  }

  function handleDownloadPng() {
    if (!img) {
      setActionMessage('Upload a design first before download.');
      return;
    }

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = TARGET_W;
    exportCanvas.height = TARGET_H;

    const ctx = exportCanvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    ctx.clearRect(0, 0, TARGET_W, TARGET_H);

    const scale = Math.min(TARGET_W / img.naturalWidth, TARGET_H / img.naturalHeight);
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    const drawX = Math.round((TARGET_W - drawW) / 2);
    const drawY = Math.round((TARGET_H - drawH) / 2);

    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    const baseName = file?.name?.replace(/\.[^/.]+$/, '') || 'pod-design-fixed';
    const link = document.createElement('a');
    link.download = `${baseName}-4200x4800.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();

    setDownloadMessage('Download started: 4200×4800 PNG.');
    setActionMessage('Export complete.');
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #0b1220 0%, #111827 100%)',
        color: '#f8fafc',
        padding: 24,
        fontFamily: 'Arial, Helvetica, sans-serif',
      }}
    >
      <div style={{ maxWidth: 1360, margin: '0 auto', display: 'grid', gap: 16 }}>
        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900 }}>POD Design Checker</h1>

        <div style={{ display: 'grid', gridTemplateColumns: '340px minmax(0, 1fr)', gap: 16 }}>
          <section
            style={{
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 16,
              padding: 14,
              background: 'rgba(15,23,42,0.72)',
              display: 'grid',
              gap: 10,
              alignSelf: 'start',
            }}
          >
            <label
              htmlFor="design-upload"
              style={{
                width: '100%',
                textAlign: 'center',
                background: '#2563eb',
                color: '#fff',
                borderRadius: 12,
                padding: '12px 10px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'block',
              }}
            >
              Upload design
            </label>
            <input
              id="design-upload"
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

            <button
              onClick={handleFixTransparency}
              style={{
                width: '100%',
                background: '#0f766e',
                color: '#fff',
                border: '1px solid rgba(94,234,212,0.45)',
                borderRadius: 12,
                padding: '12px 10px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Step 1: Fix Transparency
            </button>

            <button
              onClick={handleDownloadPng}
              style={{
                width: '100%',
                background: '#1d4ed8',
                color: '#fff',
                border: '1px solid rgba(147,197,253,0.45)',
                borderRadius: 12,
                padding: '12px 10px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Step 2: Download 4200×4800 PNG
            </button>

            <div style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.5 }}>
              <div>Status: {isProcessing ? 'Processing...' : actionMessage}</div>
              {file ? <div style={{ marginTop: 6 }}>File: {file.name}</div> : null}
              {downloadMessage ? (
                <div style={{ marginTop: 6, color: '#7dd3fc' }}>{downloadMessage}</div>
              ) : null}
            </div>
          </section>

          <section
            style={{
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 16,
              padding: 14,
              background: 'rgba(15,23,42,0.72)',
              overflow: 'auto',
            }}
          >
            <canvas
              ref={previewCanvasRef}
              style={{
                display: 'block',
                width: '100%',
                maxWidth: 780,
                height: 'auto',
                borderRadius: 12,
                border: '1px solid rgba(56,189,248,0.45)',
              }}
            />
          </section>
        </div>
      </div>
    </main>
  );
}