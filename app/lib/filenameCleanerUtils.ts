export type FilenameCleanOptions = {
  lowercase: boolean;
  replaceSpacesWithHyphens: boolean;
  removeRandomIds: boolean;
  removeDuplicateWords: boolean;
  removeJunkWords: boolean;
  keepColourWords: boolean;
  addSizeToFilename: boolean;
};

export const DEFAULT_FILENAME_CLEAN_OPTIONS: FilenameCleanOptions = {
  lowercase: true,
  replaceSpacesWithHyphens: true,
  removeRandomIds: true,
  removeDuplicateWords: true,
  removeJunkWords: true,
  keepColourWords: false,
  addSizeToFilename: false,
};

export const COLOUR_WORDS = new Set([
  'white',
  'black',
  'grey',
  'gray',
  'navy',
  'red',
  'blue',
  'green',
  'yellow',
  'pink',
  'purple',
  'orange',
  'brown',
  'cream',
  'beige',
  'charcoal',
  'heather',
  'forest',
  'maroon',
  'gold',
  'silver',
]);

const JUNK_WORDS = new Set([
  'copy',
  'final',
  'finalfinal',
  'download',
  'mockup',
  'mockups',
  'preview',
  'edited',
  'new',
  'untitled',
]);

const ALLOWED_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp']);

const UNSAFE_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;

export function splitFilename(filename: string): { basename: string; extension: string } {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot <= 0) {
    return { basename: filename, extension: '' };
  }
  return {
    basename: filename.slice(0, lastDot),
    extension: filename.slice(lastDot + 1).toLowerCase(),
  };
}

export function joinFilename(basename: string, extension: string): string {
  const ext = extension.toLowerCase();
  return ext ? `${basename}.${ext}` : basename;
}

function collapseHyphens(value: string): string {
  return value.replace(/-+/g, '-').replace(/^-+|-+$/g, '');
}

function isProtectedShortToken(token: string): boolean {
  const lower = token.toLowerCase();
  if (/^\d{1,2}s$/.test(lower)) return true;
  if (/^version-\d+$/i.test(token)) return true;
  if (/^design-\d+$/i.test(token)) return true;
  if (/^\d+x\d+$/i.test(token)) return true;
  if (/^\d+dpi$/i.test(token)) return true;
  if (/^\d{1,2}$/.test(token)) return true;
  return false;
}

function isRandomIdToken(token: string): boolean {
  if (!token) return false;
  if (isProtectedShortToken(token)) return false;

  const lower = token.toLowerCase();

  if (/^img[_-]?\d{8}([_-]\d+)?$/i.test(lower)) return true;
  if (/^screenshot[_-]?\d{4}[_-]?\d{2}[_-]?\d{2}$/i.test(lower)) return true;
  if (/^copy-of-download-\d{6,}$/i.test(lower)) return true;

  if (/^[a-f0-9]{10,}$/i.test(token)) return true;
  if (/^\d{9,}$/.test(token)) return true;

  return false;
}

function removeRandomIdPatterns(text: string): string {
  let value = text;
  value = value.replace(/\bimg[_-]?\d{8}[_-]?\d+\b/gi, ' ');
  value = value.replace(/\bscreenshot[_-]?\d{4}[_-]?\d{2}[_-]?\d{2}\b/gi, ' ');
  value = value.replace(/\bcopy-of-download-\d{6,}\b/gi, ' ');
  value = value.replace(/\b[a-f0-9]{12,}\b/gi, ' ');
  value = value.replace(/[_-]?\d{13,}\b/g, ' ');
  return value;
}

function tokenizeBasename(basename: string): string[] {
  return basename
    .split(/[-_\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function removeAdjacentDuplicateWords(parts: string[]): string[] {
  const result: string[] = [];
  for (const part of parts) {
    const lower = part.toLowerCase();
    const prev = result.length > 0 ? result[result.length - 1].toLowerCase() : null;
    if (prev === lower) continue;
    result.push(part);
  }
  return result;
}

function shouldKeepWord(word: string, options: FilenameCleanOptions): boolean {
  const lower = word.toLowerCase();
  if (options.keepColourWords && COLOUR_WORDS.has(lower)) return true;
  if (options.removeJunkWords && JUNK_WORDS.has(lower)) return false;
  return true;
}

export function cleanBasename(
  basename: string,
  options: FilenameCleanOptions,
  imageSize?: { width: number; height: number } | null,
): string {
  let value = basename;

  if (options.lowercase) {
    value = value.toLowerCase();
  }

  if (options.replaceSpacesWithHyphens) {
    value = value.replace(/[\s_]+/g, '-');
  }

  value = value.replace(UNSAFE_FILENAME_CHARS, '');
  value = value.replace(/[^a-zA-Z0-9.-]+/g, '-');

  if (options.removeRandomIds) {
    value = removeRandomIdPatterns(value);
  }

  let parts = tokenizeBasename(value);

  if (options.removeRandomIds) {
    parts = parts.filter((part) => !isRandomIdToken(part));
  }

  if (options.removeJunkWords || options.keepColourWords) {
    parts = parts.filter((part) => shouldKeepWord(part, options));
  }

  if (options.removeDuplicateWords) {
    parts = removeAdjacentDuplicateWords(parts);
  }

  if (options.addSizeToFilename && imageSize && imageSize.width > 0 && imageSize.height > 0) {
    const sizeToken = `${imageSize.width}x${imageSize.height}`;
    const hasSizeAlready = parts.some((part) => part.toLowerCase() === sizeToken.toLowerCase());
    if (!hasSizeAlready) {
      parts.push(sizeToken);
    }
  }

  let cleaned = collapseHyphens(parts.join('-'));
  if (!cleaned) cleaned = 'design';
  return cleaned;
}

export function cleanFilename(
  originalFilename: string,
  options: FilenameCleanOptions,
  imageSize?: { width: number; height: number } | null,
): string {
  const { basename, extension } = splitFilename(originalFilename);
  const cleanedBasename = cleanBasename(basename, options, imageSize);
  const ext = extension.toLowerCase() || 'png';
  return joinFilename(cleanedBasename, ext);
}

export type ManualFilenameValidation = {
  valid: boolean;
  message: string | null;
  normalized: string | null;
};

export function validateManualFilename(value: string): ManualFilenameValidation {
  const trimmed = value.trim();
  if (!trimmed) {
    return { valid: false, message: 'Filename cannot be empty.', normalized: null };
  }

  if (UNSAFE_FILENAME_CHARS.test(trimmed)) {
    return { valid: false, message: 'Remove unsafe filename characters.', normalized: null };
  }

  const { basename, extension } = splitFilename(trimmed);
  if (!extension || !ALLOWED_EXTENSIONS.has(extension.toLowerCase())) {
    return {
      valid: false,
      message: 'Use a valid extension: .png, .jpg, .jpeg or .webp.',
      normalized: null,
    };
  }

  const safeBasename = basename.replace(UNSAFE_FILENAME_CHARS, '').trim();
  if (!safeBasename) {
    return { valid: false, message: 'Filename cannot be empty.', normalized: null };
  }

  return {
    valid: true,
    message: null,
    normalized: joinFilename(safeBasename, extension.toLowerCase()),
  };
}

export type ResolvedFilenameRow = {
  cleanFilename: string;
  statusNote: string | null;
};

export function resolveDuplicateFilenames(filenames: string[]): ResolvedFilenameRow[] {
  const used = new Map<string, number>();
  return filenames.map((filename) => {
    const { basename, extension } = splitFilename(filename);
    const ext = extension || 'png';
    let candidate = joinFilename(basename, ext);
    let statusNote: string | null = null;
    const key = candidate.toLowerCase();

    if (used.has(key)) {
      let counter = used.get(key)! + 1;
      let nextCandidate = joinFilename(`${basename}-${counter}`, ext);
      while (used.has(nextCandidate.toLowerCase())) {
        counter += 1;
        nextCandidate = joinFilename(`${basename}-${counter}`, ext);
      }
      used.set(key, counter);
      used.set(nextCandidate.toLowerCase(), counter);
      candidate = nextCandidate;
      statusNote = 'Renamed to avoid duplicate';
    } else {
      used.set(key, 1);
    }

    return { cleanFilename: candidate, statusNote };
  });
}

export function formatCombinedFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
