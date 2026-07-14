import { useEffect, useMemo, useRef, useState } from 'react';
import { COLORS, FONT, RADII } from '../../theme';
import { Icons } from '../../components/ui';
import { kindForFile, formatFileSize, validateAttachments } from './communityUploadConfig';

// Extensions we hint to the OS file dialog. Real validation still happens in
// code (validateAttachments) — `accept` is only a convenience, never a gate.
const ACCEPT = '.jpg,.jpeg,.png,.webp,.mp4,.webm,.pdf,.docx,.xlsx,.csv';

const kindLabel = (kind) => (kind === 'image' ? 'Image' : kind === 'video' ? 'Video' : 'File');

// Pre-publish attachment manager: browse or drag-and-drop, preview, remove.
// The parent (NewPostForm) owns the staged `files` array; this component only
// adds/removes and reports validation errors inline (plan §7.3).
const AttachmentPicker = ({ files, onChange, disabled }) => {
  const inputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [errors, setErrors] = useState([]);

  // [{ file, url }] — url is a temporary object URL for image thumbnails only.
  // Derived (not state) so we never setState in an effect; the effect below only
  // revokes the URLs when they change or on unmount, so nothing leaks (plan §7.3).
  const previews = useMemo(
    () =>
      files.map((file) => ({
        file,
        url: kindForFile(file) === 'image' ? URL.createObjectURL(file) : null,
      })),
    [files],
  );

  useEffect(() => () => previews.forEach((p) => p.url && URL.revokeObjectURL(p.url)), [previews]);

  const addFiles = (fileList) => {
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;
    const { accepted, errors: nextErrors } = validateAttachments(files, incoming);
    if (accepted.length) onChange([...files, ...accepted]);
    setErrors(nextErrors);
  };

  const removeAt = (index) => {
    onChange(files.filter((_, i) => i !== index));
    setErrors([]);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    if (disabled) return;
    addFiles(e.dataTransfer.files);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    if (!disabled) setDragActive(true);
  };

  return (
    <div>
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragEnter={onDragOver}
        onDragLeave={() => setDragActive(false)}
        style={{
          ...styles.dropzone,
          borderColor: dragActive ? COLORS.forest : COLORS.border,
          background: dragActive ? COLORS.greenSoft : '#FAFAF7',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <Icons.Upload size={22} color={COLORS.muted} />
        <div style={styles.dropText}>
          <span>Drag &amp; drop files here, or </span>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
            style={styles.browseBtn}
          >
            browse
          </button>
        </div>
        <div style={styles.hint}>
          Images (JPEG/PNG/WebP), video (MP4/WebM), documents (PDF/DOCX/XLSX/CSV). Up to 10 files, 75&nbsp;MB total.
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = ''; // allow re-selecting the same file after removal
          }}
          style={{ display: 'none' }}
          disabled={disabled}
        />
      </div>

      {errors.length > 0 && (
        <ul style={styles.errorList} role="alert" aria-live="assertive">
          {errors.map((message, i) => (
            <li key={i} style={styles.errorItem}>
              <Icons.Warn size={15} color={COLORS.red} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{message}</span>
            </li>
          ))}
        </ul>
      )}

      {previews.length > 0 && (
        <ul style={styles.fileList}>
          {previews.map(({ file, url }, index) => {
            const kind = kindForFile(file);
            return (
              <li key={`${file.name}-${index}`} style={styles.fileRow}>
                {url ? (
                  <img src={url} alt="" style={styles.thumb} />
                ) : (
                  <div style={styles.iconBox}>
                    <Icons.FileArrow size={20} color={COLORS.muted} />
                  </div>
                )}
                <div style={styles.fileMeta}>
                  <div style={styles.fileName} title={file.name}>
                    {file.name}
                  </div>
                  <div style={styles.fileSub}>
                    {kindLabel(kind)} · {formatFileSize(file.size)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeAt(index)}
                  disabled={disabled}
                  aria-label={`Remove ${file.name}`}
                  style={styles.removeBtn}
                >
                  <Icons.Close size={16} color={COLORS.muted} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

const styles = {
  dropzone: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    textAlign: 'center',
    border: `1.5px dashed ${COLORS.border}`,
    borderRadius: RADII.md,
    padding: '18px 16px',
    transition: 'background 120ms, border-color 120ms',
  },
  dropText: { fontSize: 14, color: COLORS.ink, fontFamily: FONT },
  browseBtn: {
    border: 'none',
    background: 'transparent',
    color: COLORS.navy,
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
    padding: 0,
    fontFamily: FONT,
    textDecoration: 'underline',
  },
  hint: { fontSize: 12, color: COLORS.muted, fontFamily: FONT, maxWidth: 420, lineHeight: 1.4 },
  errorList: { listStyle: 'none', margin: '10px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 },
  errorItem: {
    display: 'flex',
    gap: 8,
    fontSize: 13,
    color: COLORS.red,
    fontFamily: FONT,
    lineHeight: 1.4,
  },
  fileList: { listStyle: 'none', margin: '12px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 },
  fileRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 8,
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADII.md,
    background: COLORS.card,
  },
  thumb: { width: 44, height: 44, borderRadius: RADII.sm, objectFit: 'cover', flexShrink: 0 },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: RADII.sm,
    background: COLORS.greySoft,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  fileMeta: { flex: 1, minWidth: 0 },
  fileName: {
    fontSize: 13.5,
    fontWeight: 600,
    color: COLORS.ink,
    fontFamily: FONT,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  fileSub: { fontSize: 12, color: COLORS.muted, fontFamily: FONT, marginTop: 2 },
  removeBtn: {
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    padding: 6,
    flexShrink: 0,
    display: 'inline-flex',
    borderRadius: RADII.sm,
  },
};

export default AttachmentPicker;
