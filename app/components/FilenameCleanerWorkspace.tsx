'use client';

import React, { useMemo, useRef, useState } from 'react';
import {
  cleanFilename,
  DEFAULT_FILENAME_CLEAN_OPTIONS,
  formatCombinedFileSize,
  resolveDuplicateFilenames,
  type FilenameCleanOptions,
  validateManualFilename,
} from '../lib/filenameCleanerUtils';

export type FilenameCleanerFileEntry = {
  id: string;
  file: File;
  imageSize: { width: number; height: number } | null;
  manualFilename: string | null;
};

type FilenameCleanerWorkspaceProps = {
  entries: FilenameCleanerFileEntry[];
  onEntriesChange: (entries: FilenameCleanerFileEntry[]) => void;
  uploadInputKey: number;
  onDownloadMessage?: (message: string) => void;
};

const cardStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 12,
  background: 'rgba(15, 23, 42, 0.55)',
  border: '1px solid rgba(148, 163, 184, 0.28)',
  display: 'grid',
  gap: 8,
};

const multiFilePickerTipStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#60a5fa',
  lineHeight: 1.45,
  maxWidth: 420,
  padding: '8px 12px',
  borderRadius: 999,
  background: 'rgba(30, 64, 175, 0.28)',
  border: '1px solid rgba(96, 165, 250, 0.5)',
  boxShadow: '0 0 14px rgba(59, 130, 246, 0.28)',
};

const uploadZoneStyle: React.CSSProperties = {
  padding: 20,
  borderRadius: 14,
  border: '2px dashed rgba(125, 211, 252, 0.35)',
  background: 'rgba(8, 47, 73, 0.25)',
  display: 'grid',
  gap: 10,
  justifyItems: 'center',
  textAlign: 'center',
};

const buttonStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid rgba(147, 197, 253, 0.35)',
  background: '#2563eb',
  color: '#ffffff',
  fontWeight: 800,
  fontSize: 13,
  cursor: 'pointer',
};

const quietButtonStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 10,
  border: '1px solid rgba(148, 163, 184, 0.28)',
  background: 'rgba(15, 23, 42, 0.55)',
  color: '#cbd5e1',
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
};

const inputStyle: React.CSSProperties = {
  padding: '6px 8px',
  borderRadius: 8,
  border: '1px solid rgba(148, 163, 184, 0.35)',
  background: 'rgba(2, 6, 23, 0.55)',
  color: '#f8fafc',
  fontSize: 12,
  width: '100%',
  boxSizing: 'border-box',
};

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

function createEntryId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function readImageSize(file: File): Promise<{ width: number; height: number } | null> {
  if (!ACCEPTED_TYPES.includes(file.type)) return null;
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    image.src = url;
  });
}

async function buildEntriesFromFiles(files: File[]): Promise<FilenameCleanerFileEntry[]> {
  const validFiles = files.filter((file) => ACCEPTED_TYPES.includes(file.type));
  const entries: FilenameCleanerFileEntry[] = [];
  for (const file of validFiles) {
    const imageSize = await readImageSize(file);
    entries.push({
      id: createEntryId(),
      file,
      imageSize,
      manualFilename: null,
    });
  }
  return entries;
}

type PreviewRow = {
  id: string;
  originalFilename: string;
  suggestedFilename: string;
  finalFilename: string;
  statusNote: string | null;
  manualError: string | null;
};

function OptionCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        fontSize: 12,
        lineHeight: 1.4,
        color: '#e2e8f0',
        cursor: 'pointer',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        style={{ marginTop: 2 }}
      />
      <span>{label}</span>
    </label>
  );
}

export default function FilenameCleanerWorkspace({
  entries,
  onEntriesChange,
  uploadInputKey,
  onDownloadMessage,
}: FilenameCleanerWorkspaceProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [options, setOptions] = useState<FilenameCleanOptions>(DEFAULT_FILENAME_CLEAN_OPTIONS);
  const [manualErrors, setManualErrors] = useState<Record<string, string | null>>({});
  const [isDownloading, setIsDownloading] = useState(false);

  const combinedSize = useMemo(
    () => entries.reduce((total, entry) => total + entry.file.size, 0),
    [entries],
  );

  const previewRows = useMemo<PreviewRow[]>(() => {
    const suggested = entries.map((entry) => {
      if (entry.manualFilename) {
        const validation = validateManualFilename(entry.manualFilename);
        return {
          id: entry.id,
          originalFilename: entry.file.name,
          suggestedFilename: validation.valid
            ? validation.normalized!
            : entry.manualFilename,
          manualError: validation.valid ? null : validation.message,
        };
      }
      return {
        id: entry.id,
        originalFilename: entry.file.name,
        suggestedFilename: cleanFilename(entry.file.name, options, entry.imageSize),
        manualError: null,
      };
    });

    const resolved = resolveDuplicateFilenames(suggested.map((row) => row.suggestedFilename));

    return suggested.map((row, index) => ({
      id: row.id,
      originalFilename: row.originalFilename,
      suggestedFilename: row.suggestedFilename,
      finalFilename: resolved[index].cleanFilename,
      statusNote: resolved[index].statusNote,
      manualError: row.manualError ?? manualErrors[row.id] ?? null,
    }));
  }, [entries, options, manualErrors]);

  const readyCount = previewRows.filter((row) => !row.manualError).length;

  const addFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    const newEntries = await buildEntriesFromFiles(list);
    onEntriesChange([...entries, ...newEntries]);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files;
    if (selected && selected.length > 0) {
      await addFiles(selected);
    }
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (event.dataTransfer.files.length > 0) {
      await addFiles(event.dataTransfer.files);
    }
  };

  const handleRemove = (id: string) => {
    onEntriesChange(entries.filter((entry) => entry.id !== id));
    setManualErrors((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  };

  const handleClearAll = () => {
    onEntriesChange([]);
    setManualErrors({});
  };

  const handleManualChange = (id: string, value: string) => {
    onEntriesChange(
      entries.map((entry) =>
        entry.id === id ? { ...entry, manualFilename: value } : entry,
      ),
    );
    const validation = validateManualFilename(value);
    setManualErrors((current) => ({
      ...current,
      [id]: validation.valid ? null : validation.message,
    }));
  };

  const updateOption = <K extends keyof FilenameCleanOptions>(key: K, value: FilenameCleanOptions[K]) => {
    setOptions((current) => ({ ...current, [key]: value }));
  };

  const handleDownloadZip = async () => {
    if (entries.length === 0 || readyCount === 0 || isDownloading) return;

    setIsDownloading(true);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      for (const row of previewRows) {
        if (row.manualError) continue;
        const entry = entries.find((item) => item.id === row.id);
        if (!entry) continue;
        zip.file(row.finalFilename, entry.file);
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'renamed-design-files.zip';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      onDownloadMessage?.('Download started: renamed-design-files.zip. Check your Downloads folder.');
    } finally {
      setIsDownloading(false);
    }
  };

  const workspaceShellStyle: React.CSSProperties = {
    display: 'grid',
    gap: 12,
    padding: 12,
    boxSizing: 'border-box',
    height: '100%',
    minHeight: 0,
    minWidth: 0,
    maxWidth: '100%',
    overflowY: 'auto',
    overflowX: 'hidden',
    alignContent: 'start',
  };

  const previewListStyle: React.CSSProperties = {
    display: 'grid',
    gap: 10,
    maxHeight: 'min(420px, 45vh)',
    overflowY: 'auto',
    overflowX: 'hidden',
    paddingRight: 4,
    scrollbarGutter: 'stable',
  };

  return (
    <div style={workspaceShellStyle}>
      <div>
        <div style={{ fontWeight: 900, fontSize: 18, color: '#f8fafc', letterSpacing: '0.02em' }}>
          FILENAME CLEANER
        </div>
        <div style={{ marginTop: 4, fontSize: 13, color: '#94a3b8', lineHeight: 1.45 }}>
          Clean messy design filenames without changing the image.
        </div>
      </div>

      <div
        style={uploadZoneStyle}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <div style={{ fontWeight: 800, fontSize: 14, color: '#e2e8f0' }}>Drag files here</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          <button
            type="button"
            style={{ ...buttonStyle, whiteSpace: 'nowrap' }}
            onClick={() => folderInputRef.current?.click()}
          >
            Add Folder of Designs
          </button>
          <button
            type="button"
            style={{ ...buttonStyle, whiteSpace: 'nowrap' }}
            onClick={() => fileInputRef.current?.click()}
          >
            Add Individual Files
          </button>
        </div>
        <div style={{ fontSize: 12, color: '#93c5fd', lineHeight: 1.45, maxWidth: 420 }}>
          Fastest option: put your designs in one folder, then use Add Folder of Designs.
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>
          Add Individual Files is for one file or a few selected files.
        </div>
        <div style={multiFilePickerTipStyle}>
          <strong style={{ color: '#93c5fd', fontWeight: 800 }}>Tip:</strong> in the file window,
          Ctrl-click on Windows or Cmd-click on Mac can select several files.
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>PNG, JPG or WEBP</div>
        <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.4 }}>
          This tool only renames file copies. It does not change your artwork.
        </div>
        <input
          key={uploadInputKey}
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          multiple
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <input
          key={`${uploadInputKey}-folder`}
          ref={folderInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          multiple
          {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </div>

      {entries.length > 0 ? (
        <>
          <div style={cardStyle}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <div style={{ fontWeight: 800, color: '#93c5fd', fontSize: 13 }}>
                {entries.length} file{entries.length === 1 ? '' : 's'} added
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>
                Combined size: {formatCombinedFileSize(combinedSize)}
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button type="button" style={quietButtonStyle} onClick={() => fileInputRef.current?.click()}>
                Add More Files
              </button>
              <button type="button" style={quietButtonStyle} onClick={handleClearAll}>
                Clear All
              </button>
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ fontWeight: 900, fontSize: 13, color: '#f8fafc' }}>CLEAN OPTIONS</div>
            <div style={{ display: 'grid', gap: 6 }}>
              <OptionCheckbox
                label="Lowercase filenames"
                checked={options.lowercase}
                onChange={(checked) => updateOption('lowercase', checked)}
              />
              <OptionCheckbox
                label="Replace spaces with hyphens"
                checked={options.replaceSpacesWithHyphens}
                onChange={(checked) => updateOption('replaceSpacesWithHyphens', checked)}
              />
              <OptionCheckbox
                label="Remove random ID numbers"
                checked={options.removeRandomIds}
                onChange={(checked) => updateOption('removeRandomIds', checked)}
              />
              <OptionCheckbox
                label="Remove duplicate words"
                checked={options.removeDuplicateWords}
                onChange={(checked) => updateOption('removeDuplicateWords', checked)}
              />
              <OptionCheckbox
                label={'Remove "copy", "final", "download", "mockup"'}
                checked={options.removeJunkWords}
                onChange={(checked) => updateOption('removeJunkWords', checked)}
              />
              <OptionCheckbox
                label="Keep colour words"
                checked={options.keepColourWords}
                onChange={(checked) => updateOption('keepColourWords', checked)}
              />
              <OptionCheckbox
                label="Add size to filename"
                checked={options.addSizeToFilename}
                onChange={(checked) => updateOption('addSizeToFilename', checked)}
              />
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ fontWeight: 900, fontSize: 13, color: '#f8fafc' }}>FILENAME PREVIEW</div>
            <div style={previewListStyle}>
              {previewRows.map((row) => (
                <div
                  key={row.id}
                  style={{
                    padding: 10,
                    borderRadius: 10,
                    background: 'rgba(2, 6, 23, 0.35)',
                    border: '1px solid rgba(148, 163, 184, 0.18)',
                    display: 'grid',
                    gap: 6,
                  }}
                >
                  <div style={{ fontSize: 11, color: '#93c5fd', fontWeight: 700 }}>Original</div>
                  <div style={{ fontSize: 12, color: '#cbd5e1', wordBreak: 'break-word' }}>
                    {row.originalFilename}
                  </div>
                  <label style={{ fontSize: 11, color: '#93c5fd', fontWeight: 700 }}>
                    Clean filename
                    <input
                      type="text"
                      value={
                        entries.find((entry) => entry.id === row.id)?.manualFilename ??
                        row.finalFilename
                      }
                      onChange={(event) => handleManualChange(row.id, event.target.value)}
                      style={{ ...inputStyle, marginTop: 4 }}
                      aria-label={`Clean filename for ${row.originalFilename}`}
                    />
                  </label>
                  {row.manualError ? (
                    <div style={{ fontSize: 11, color: '#fca5a5' }} role="alert">
                      {row.manualError}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: '#86efac' }}>
                      {row.statusNote ?? 'Ready'}
                    </div>
                  )}
                  <button type="button" style={{ ...quietButtonStyle, justifySelf: 'start' }} onClick={() => handleRemove(row.id)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ fontWeight: 900, fontSize: 13, color: '#f8fafc' }}>DOWNLOAD RENAMED FILES</div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>
              {readyCount} file{readyCount === 1 ? '' : 's'} ready
            </div>
            <button
              type="button"
              style={{
                ...buttonStyle,
                opacity: readyCount > 0 && !isDownloading ? 1 : 0.55,
                cursor: readyCount > 0 && !isDownloading ? 'pointer' : 'not-allowed',
              }}
              onClick={handleDownloadZip}
              disabled={readyCount === 0 || isDownloading}
            >
              {isDownloading ? 'Building ZIP…' : 'Download Renamed ZIP'}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
