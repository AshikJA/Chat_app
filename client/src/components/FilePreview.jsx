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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-[#0a0a12]/90 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-lg glass rounded-3xl p-6 shadow-2xl animate-slide-up overflow-hidden">
        <div className="rounded-2xl overflow-hidden mb-5 bg-black/40 flex items-center justify-center max-h-[60vh] ring-1 ring-white/5">
          {isVideo ? (
            <video controls src={preview} className="max-w-full max-h-full block" />
          ) : (
            <img src={preview} alt="Preview" className="max-w-full max-h-full object-contain block" />
          )}
        </div>
        
        <div className="flex flex-col gap-1 mb-6">
          <span className="text-white text-sm font-semibold truncate px-1">{file.name}</span>
          <span className="text-slate-500 text-xs px-1">{formatSize(file.size)}</span>
        </div>
        
        <div className="flex gap-3">
          <button 
            onClick={onCancel} 
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-all border border-white/5"
          >
            Cancel
          </button>
          <button 
            onClick={() => onSend(file)} 
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 transition-all shadow-lg shadow-violet-600/20 active:scale-95"
          >
            Send File
          </button>
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
