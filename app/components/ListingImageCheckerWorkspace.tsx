'use client';

import React, { useMemo, useRef, useState } from 'react';
import { getFileTypeLabel, formatFileSizeLabel } from '../lib/fileInspectorUtils';
import {
  LISTING_CROP_PREVIEWS,
  SAFE_AREA_DEFAULT_ENABLED,
  buildThumbnailNotes,
  getListingAspectRatio,
  getListingOrientation,
  getListingPreviewStatus,
  getListingPreviewStatusColor,
  getListingPreviewStatusNote,
} from '../lib/listingImageCheckerUtils';

type PreviewViewMode = 'crop' | 'fit';

type ListingImageCheckerWorkspaceProps = {
  file: File | null;
  img: HTMLImageElement | null;
  showSafeArea: boolean;
  onShowSafeAreaChange: (value: boolean) => void;
  onAddImage: (file: File) => void;
  onClear: () => void;
  uploadInputKey: number;
};

const cardStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 12,
  background: 'rgba(15, 23, 42, 0.55)',
  border: '1px solid rgba(148, 163, 184, 0.28)',
  display: 'grid',
  gap: 8,
};

const uploadZoneStyle: React.CSSProperties = {
  padding: 20,
  borderRadius: 14,
  border: '2px dashed rgba(125, 211, 252, 0.35)',
  background: 'rgba(8, 47, 73, 0.25)',
  display: 'grid',
  gap: 10,
  placeItems: 'center',
  textAlign: 'center',
};

function CropPreviewCard({
  crop,
  imageUrl,
  imageAlt,
  showSafeArea,
  previewViewMode,
}: {
  crop: (typeof LISTING_CROP_PREVIEWS)[number];
  imageUrl: string;
  imageAlt: string;
  showSafeArea: boolean;
  previewViewMode: PreviewViewMode;
}) {
  const isCropView = previewViewMode === 'crop';

  return (
    <div style={{ ...cardStyle, gap: 4, padding: 8 }}>
      <div style={{ fontWeight: 800, fontSize: 12, color: '#f8fafc' }}>{crop.name}</div>
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxHeight: 120,
          aspectRatio: `${crop.aspectRatio}`,
          borderRadius: 8,
          overflow: 'hidden',
          background: '#0f172a',
          border: '1px solid rgba(148, 163, 184, 0.22)',
        }}
      >
        <img
          src={imageUrl}
          alt={`${imageAlt} — ${crop.name} preview`}
          style={{
            width: '100%',
            height: '100%',
            objectFit: isCropView ? 'cover' : 'contain',
            objectPosition: 'center',
            display: 'block',
          }}
        />
        {showSafeArea && isCropView ? (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: '10%',
              border: '1px dashed rgba(125, 211, 252, 0.75)',
              borderRadius: 6,
              pointerEvents: 'none',
            }}
          />
        ) : null}
      </div>
      <div style={{ fontSize: 10, color: '#93c5fd', fontWeight: 700 }}>{crop.ratioLabel}</div>
      <div style={{ fontSize: 11, lineHeight: 1.4, color: '#cbd5e1' }}>{crop.note}</div>
    </div>
  );
}

export default function ListingImageCheckerWorkspace({
  file,
  img,
  showSafeArea,
  onShowSafeAreaChange,
  onAddImage,
  onClear,
  uploadInputKey,
}: ListingImageCheckerWorkspaceProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewViewMode, setPreviewViewMode] = useState<PreviewViewMode>('crop');

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (selected) onAddImage(selected);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) onAddImage(dropped);
  };

  const widthPx = img?.naturalWidth ?? 0;
  const heightPx = img?.naturalHeight ?? 0;

  const thumbnailNotes = useMemo(
    () => (file ? buildThumbnailNotes(widthPx, heightPx, file.size) : []),
    [file, widthPx, heightPx],
  );

  const previewStatus = useMemo(
    () => getListingPreviewStatus(widthPx, heightPx, file?.size ?? 0),
    [widthPx, heightPx, file],
  );

  const statusColor = getListingPreviewStatusColor(previewStatus);
  const statusNote = getListingPreviewStatusNote(previewStatus);

  if (!file || !img) {
    return (
      <div style={{ display: 'grid', gap: 12, padding: 12, boxSizing: 'border-box' }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 18, color: '#f8fafc', letterSpacing: '0.02em' }}>
            LISTING IMAGE CHECKER
          </div>
          <div style={{ marginTop: 4, fontSize: 13, lineHeight: 1.45, color: '#cbd5e1' }}>
            Check how your product image looks as a store listing and thumbnail.
          </div>
        </div>

        <div
          style={uploadZoneStyle}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
        >
          <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>Drag a listing image here</div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: '10px 16px',
              borderRadius: 12,
              border: 'none',
              background: '#2563eb',
              color: '#ffffff',
              fontWeight: 800,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Add Listing Image
          </button>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>PNG, JPG or WEBP</div>
        </div>

        <input
          key={uploadInputKey}
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          onChange={handleFileChange}
          style={{ display: 'none' }}
          aria-label="Add listing image"
        />

        <div style={{ fontSize: 12, lineHeight: 1.45, color: '#94a3b8' }}>
          This tool checks the image you show to shoppers. It does not change your print artwork.
        </div>
      </div>
    );
  }

  const imageUrl = img.src;
  const fileTypeLabel = getFileTypeLabel(file);
  const aspectRatio = getListingAspectRatio(widthPx, heightPx);
  const orientation = getListingOrientation(widthPx, heightPx);

  return (
    <div style={{ display: 'grid', gap: 12, padding: 12, boxSizing: 'border-box' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div>
          <div style={{ fontWeight: 900, fontSize: 18, color: '#f8fafc' }}>LISTING IMAGE CHECKER</div>
          <div style={{ marginTop: 2, fontSize: 12, color: '#94a3b8', wordBreak: 'break-word' }}>{file.name}</div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: '7px 12px',
              borderRadius: 10,
              border: '1px solid rgba(147, 197, 253, 0.35)',
              background: 'rgba(37, 99, 235, 0.15)',
              color: '#bfdbfe',
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Replace Image
          </button>
          <button
            type="button"
            onClick={onClear}
            style={{
              padding: '7px 12px',
              borderRadius: 10,
              border: '1px solid rgba(148, 163, 184, 0.35)',
              background: 'rgba(15, 23, 42, 0.55)',
              color: '#cbd5e1',
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
        </div>
      </div>

      <input
        key={uploadInputKey}
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        aria-label="Replace listing image"
      />

      <div style={cardStyle}>
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxHeight: 360,
            borderRadius: 10,
            overflow: 'hidden',
            background: '#0f172a',
            border: '1px solid rgba(148, 163, 184, 0.22)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img
            src={imageUrl}
            alt={`Listing image preview: ${file.name}`}
            style={{
              maxWidth: '100%',
              maxHeight: 360,
              objectFit: 'contain',
              display: 'block',
            }}
          />
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ fontWeight: 800, fontSize: 13, color: '#bae6fd' }}>Listing Preview Status</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: statusColor }}>{previewStatus}</div>
        {statusNote ? (
          <div style={{ fontSize: 12, lineHeight: 1.45, color: '#cbd5e1' }}>{statusNote}</div>
        ) : null}
      </div>

      <div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            marginBottom: 8,
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 14, color: '#f8fafc' }}>LISTING PREVIEWS</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <button
              type="button"
              onClick={() => setPreviewViewMode('fit')}
              aria-pressed={previewViewMode === 'fit'}
              style={{
                padding: '5px 10px',
                borderRadius: 8,
                border:
                  previewViewMode === 'fit'
                    ? '1px solid rgba(125, 211, 252, 0.65)'
                    : '1px solid rgba(148, 163, 184, 0.35)',
                background:
                  previewViewMode === 'fit' ? 'rgba(37, 99, 235, 0.22)' : 'rgba(15, 23, 42, 0.55)',
                color: previewViewMode === 'fit' ? '#bfdbfe' : '#cbd5e1',
                fontWeight: 700,
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              Fit View
            </button>
            <button
              type="button"
              onClick={() => setPreviewViewMode('crop')}
              aria-pressed={previewViewMode === 'crop'}
              style={{
                padding: '5px 10px',
                borderRadius: 8,
                border:
                  previewViewMode === 'crop'
                    ? '1px solid rgba(125, 211, 252, 0.65)'
                    : '1px solid rgba(148, 163, 184, 0.35)',
                background:
                  previewViewMode === 'crop' ? 'rgba(37, 99, 235, 0.22)' : 'rgba(15, 23, 42, 0.55)',
                color: previewViewMode === 'crop' ? '#bfdbfe' : '#cbd5e1',
                fontWeight: 700,
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              Crop View
            </button>
          </div>
        </div>
        <div style={{ fontSize: 11, lineHeight: 1.4, color: '#94a3b8', marginBottom: 8 }}>
          {previewViewMode === 'crop'
            ? 'Thumbnail crop preview — shows what may be cut off in listing thumbnails.'
            : 'Full image fit — shows the whole image inside each preview shape.'}
        </div>
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 8,
            fontSize: 12,
            color: '#cbd5e1',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={showSafeArea}
            onChange={(event) => onShowSafeAreaChange(event.target.checked)}
          />
          Show Safe Area
        </label>
        {showSafeArea && previewViewMode === 'crop' ? (
          <div style={{ fontSize: 11, lineHeight: 1.35, color: '#94a3b8', marginBottom: 8 }}>
            Dashed line = suggested safe area for important details.
          </div>
        ) : null}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 8,
          }}
        >
          {LISTING_CROP_PREVIEWS.map((crop) => (
            <CropPreviewCard
              key={crop.id}
              crop={crop}
              imageUrl={imageUrl}
              imageAlt={file.name}
              showSafeArea={showSafeArea}
              previewViewMode={previewViewMode}
            />
          ))}
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ fontWeight: 800, fontSize: 13, color: '#bae6fd' }}>IMAGE FACTS</div>
        <div style={{ display: 'grid', gap: 6, fontSize: 13, lineHeight: 1.45 }}>
          <div>
            <span style={{ color: '#93c5fd', fontWeight: 700 }}>Image size: </span>
            <span style={{ color: '#e2e8f0' }}>
              {widthPx} × {heightPx} px
            </span>
          </div>
          <div>
            <span style={{ color: '#93c5fd', fontWeight: 700 }}>File size: </span>
            <span style={{ color: '#e2e8f0' }}>{formatFileSizeLabel(file.size)}</span>
          </div>
          <div>
            <span style={{ color: '#93c5fd', fontWeight: 700 }}>File type: </span>
            <span style={{ color: '#e2e8f0' }}>{fileTypeLabel}</span>
          </div>
          <div>
            <span style={{ color: '#93c5fd', fontWeight: 700 }}>Aspect ratio: </span>
            <span style={{ color: '#e2e8f0' }}>{aspectRatio}</span>
          </div>
          <div>
            <span style={{ color: '#93c5fd', fontWeight: 700 }}>Orientation: </span>
            <span style={{ color: '#e2e8f0' }}>{orientation}</span>
          </div>
        </div>
      </div>

      {thumbnailNotes.length > 0 ? (
        <div style={cardStyle}>
          <div style={{ fontWeight: 800, fontSize: 13, color: '#bae6fd' }}>THUMBNAIL NOTES</div>
          <div style={{ display: 'grid', gap: 6 }}>
            {thumbnailNotes.map((note) => (
              <div key={note.text} style={{ fontSize: 12, lineHeight: 1.45, color: '#cbd5e1' }}>
                {note.text}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div style={{ fontSize: 11, lineHeight: 1.45, color: '#64748b' }}>
        Crop previews are visual guides only. They do not change your file.
      </div>
    </div>
  );
}

export { SAFE_AREA_DEFAULT_ENABLED };
