import { useState, useEffect } from 'react'

export default function FilePreview({ file, onSend, onCancel }) {
  const [preview, setPreview] = useState(null)
  const isVideo = file.type.startsWith('video/')

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        <div style={styles.previewContainer}>
          {isVideo ? (
            <video controls src={preview} style={styles.media} />
          ) : (
            <img src={preview} alt="Preview" style={styles.media} />
          )}
        </div>
        <div style={styles.info}>
          <span style={styles.name}>{file.name}</span>
          <span style={styles.size}>{formatSize(file.size)}</span>
        </div>
        <div style={styles.actions}>
          <button onClick={onCancel} style={styles.cancelBtn}>Cancel</button>
          <button onClick={() => onSend(file)} style={styles.sendBtn}>Send</button>
        </div>
      </div>
    </div>
  )
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.7)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    background: '#1a1a1a',
    borderRadius: '16px',
    padding: '24px',
    maxWidth: '500px',
    width: '90%',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  previewContainer: {
    borderRadius: '12px',
    overflow: 'hidden',
    maxHeight: '400px',
    background: '#000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  media: {
    maxWidth: '100%',
    maxHeight: '400px',
    objectFit: 'contain',
    display: 'block',
  },
  info: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  name: {
    color: '#fff',
    fontSize: '14px',
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  size: {
    color: '#888',
    fontSize: '12px',
  },
  actions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    padding: '10px 24px',
    borderRadius: '8px',
    border: '1px solid #333',
    background: 'transparent',
    color: '#888',
    fontSize: '14px',
    cursor: 'pointer',
  },
  sendBtn: {
    padding: '10px 24px',
    borderRadius: '8px',
    border: 'none',
    background: '#4f46e5',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
}
