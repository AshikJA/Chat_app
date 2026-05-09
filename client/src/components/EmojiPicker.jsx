import { useState, useRef, useEffect } from 'react'
import data from '@emoji-mart/data'
import Picker from '@emoji-mart/react'

export default function EmojiPicker({ onSelect }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-colors"
        title="Add emoji"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M8 14s1.5 2 4 2 4-2 4-2" />
          <line x1="9" y1="9" x2="9.01" y2="9" />
          <line x1="15" y1="9" x2="15.01" y2="9" />
        </svg>
      </button>

      {open && (
        <div className="absolute bottom-[110%] left-0 z-[100] animate-fade-in shadow-2xl rounded-[20px] overflow-hidden">
          <Picker
            data={data}
            onEmojiSelect={(emoji) => {
              onSelect(emoji.native)
              setOpen(false)
            }}
            previewPosition="none"
            skinTonePosition="none"
            maxFrequentRows={2}
            theme="dark"
          />
        </div>
      )}
    </div>
  )
}
