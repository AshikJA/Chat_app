import { useState, useEffect, useRef, useCallback } from 'react'
import Peer from 'simple-peer'

const CALL_STATUS = {
  IDLE: 'idle',
  INITIATING: 'initiating',
  RINGING: 'ringing',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  ENDED: 'ended',
}

export default function VideoCall({
  socket,
  localUserId,
  remoteUserId,
  remoteUserName = 'User',
  mode,
  incomingSignal,
  onEnd,
}) {
  const [callStatus, setCallStatus] = useState(CALL_STATUS.IDLE)
  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [videoEnabled, setVideoEnabled] = useState(true)
  const [iceServers, setIceServers] = useState([])

  const peerRef = useRef(null)
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const streamRef = useRef(null)
  const endedRef = useRef(false)

  useEffect(() => {
    fetch('/api/ice-servers')
      .then((r) => r.json())
      .then((data) => setIceServers(data.iceServers))
      .catch(() =>
        setIceServers([{ urls: 'stun:stun.l.google.com:19302' }])
      )
  }, [])

  const cleanupMedia = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setLocalStream(null)
    setRemoteStream(null)
  }, [])

  const cleanupPeer = useCallback(() => {
    if (peerRef.current) {
      peerRef.current.destroy()
      peerRef.current = null
    }
  }, [])

  const endCall = useCallback(() => {
    if (endedRef.current) return
    endedRef.current = true
    if (socket) {
      socket.emit('call:end', { receiverId: remoteUserId })
    }
    cleanupPeer()
    cleanupMedia()
    setCallStatus(CALL_STATUS.ENDED)
    onEnd?.()
  }, [socket, remoteUserId, cleanupPeer, cleanupMedia, onEnd])

  const getMediaStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      })
      streamRef.current = stream
      setLocalStream(stream)
      return stream
    } catch {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        streamRef.current = stream
        setLocalStream(stream)
        return stream
      } catch {
        return null
      }
    }
  }, [])

  const createPeer = useCallback(
    (initiator, stream) => {
      const peer = new Peer({
        initiator,
        stream,
        trickle: true,
        config: {
          iceServers: iceServers.length > 0
            ? iceServers
            : [{ urls: 'stun:stun.l.google.com:19302' }],
        },
      })

      peer.on('signal', (data) => {
        if (data.type === 'offer') {
          socket?.emit('call:offer', { receiverId: remoteUserId, offer: data })
        } else if (data.type === 'answer') {
          socket?.emit('call:answer', { receiverId: remoteUserId, answer: data })
        } else if (data.type === 'candidate') {
          socket?.emit('call:ice-candidate', { receiverId: remoteUserId, candidate: data })
        }
      })

      peer.on('stream', (stream) => {
        setRemoteStream(stream)
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream
        }
      })

      peer.on('connect', () => {
        setCallStatus(CALL_STATUS.CONNECTED)
      })

      peer.on('close', () => {
        if (!endedRef.current) endCall()
      })

      peer.on('error', () => {
        if (!endedRef.current) endCall()
      })

      peerRef.current = peer
      return peer
    },
    [socket, remoteUserId, iceServers, endCall]
  )

  useEffect(() => {
    if (!socket || !iceServers.length) return

    let cancelled = false
    endedRef.current = false

    const handlers = {
      answer: null,
      iceCandidate: null,
      ended: null,
      offer: null,
    }

    if (mode === 'outgoing') {
      ;(async () => {
        if (cancelled) return
        const stream = await getMediaStream()
        if (cancelled || !stream) return

        setCallStatus(CALL_STATUS.INITIATING)
        socket.emit('call:initiate', { receiverId: remoteUserId })
        createPeer(true, stream)
      })()

      handlers.answer = ({ from, answer }) => {
        if (from === remoteUserId && peerRef.current) {
          peerRef.current.signal(answer)
        }
      }
      socket.on('call:answer', handlers.answer)

      handlers.iceCandidate = ({ from, candidate }) => {
        if (from === remoteUserId && peerRef.current) {
          peerRef.current.signal(candidate)
        }
      }
      socket.on('call:ice-candidate', handlers.iceCandidate)

      handlers.ended = ({ from }) => {
        if (from === remoteUserId) endCall()
      }
      socket.on('call:ended', handlers.ended)
    }

    if (mode === 'incoming') {
      setCallStatus(CALL_STATUS.RINGING)

      if (incomingSignal) {
        ;(async () => {
          if (cancelled) return
          const stream = await getMediaStream()
          if (cancelled || !stream) return
          setCallStatus(CALL_STATUS.CONNECTING)
          const peer = createPeer(false, stream)
          peer.signal(incomingSignal)
        })()
      }

      handlers.offer = async ({ from, offer }) => {
        if (from !== remoteUserId || cancelled || peerRef.current) return
        const stream = await getMediaStream()
        if (cancelled || !stream) return
        setCallStatus(CALL_STATUS.CONNECTING)
        const peer = createPeer(false, stream)
        peer.signal(offer)
      }
      socket.on('call:offer', handlers.offer)

      handlers.iceCandidate = ({ from, candidate }) => {
        if (from === remoteUserId && peerRef.current) {
          peerRef.current.signal(candidate)
        }
      }
      socket.on('call:ice-candidate', handlers.iceCandidate)

      handlers.ended = ({ from }) => {
        if (from === remoteUserId) endCall()
      }
      socket.on('call:ended', handlers.ended)
    }

    return () => {
      cancelled = true
      if (handlers.answer) socket.off('call:answer', handlers.answer)
      if (handlers.offer) socket.off('call:offer', handlers.offer)
      if (handlers.iceCandidate) socket.off('call:ice-candidate', handlers.iceCandidate)
      if (handlers.ended) socket.off('call:ended', handlers.ended)
      if (!endedRef.current) {
        cleanupPeer()
        cleanupMedia()
      }
    }
  }, [socket, mode, remoteUserId, iceServers, incomingSignal])

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
    }
  }, [localStream])

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream
    }
  }, [remoteStream])

  const toggleAudio = () => {
    if (streamRef.current) {
      const enabled = !audioEnabled
      streamRef.current.getAudioTracks().forEach((t) => (t.enabled = enabled))
      setAudioEnabled(enabled)
    }
  }

  const toggleVideo = () => {
    if (streamRef.current) {
      const enabled = !videoEnabled
      streamRef.current.getVideoTracks().forEach((t) => (t.enabled = enabled))
      setVideoEnabled(enabled)
    }
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.container}>
        {callStatus === CALL_STATUS.RINGING && (
          <div style={styles.statusOverlay}>
            <div style={styles.statusText}>Incoming call from {remoteUserName}...</div>
            <div style={styles.ringingIcon}>
              {[0, 1, 2, 3].map((i) => (
                <span key={i} style={{ ...styles.ringBar, animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          </div>
        )}

        {callStatus === CALL_STATUS.INITIATING && (
          <div style={styles.statusOverlay}>
            <div style={styles.statusText}>Calling {remoteUserName}...</div>
          </div>
        )}

        {callStatus === CALL_STATUS.CONNECTING && (
          <div style={styles.statusOverlay}>
            <div style={styles.statusText}>Connecting...</div>
          </div>
        )}

        {callStatus === CALL_STATUS.ENDED && (
          <div style={styles.statusOverlay}>
            <div style={styles.statusText}>Call ended</div>
          </div>
        )}

        <div style={styles.videosContainer}>
          <video ref={remoteVideoRef} autoPlay playsInline style={styles.remoteVideo} />
          <video ref={localVideoRef} autoPlay playsInline muted style={styles.localVideo} />
        </div>

        <div style={styles.controls}>
          {callStatus === CALL_STATUS.CONNECTED && (
            <>
              <button
                onClick={toggleAudio}
                style={{ ...styles.controlBtn, ...(audioEnabled ? {} : styles.controlOff) }}
              >
                {audioEnabled ? micIcon : micOffIcon}
              </button>
              <button onClick={endCall} style={styles.endCallBtn}>
                {endCallIcon}
              </button>
              <button
                onClick={toggleVideo}
                style={{ ...styles.controlBtn, ...(videoEnabled ? {} : styles.controlOff) }}
              >
                {videoEnabled ? videoIcon : videoOffIcon}
              </button>
            </>
          )}
          {(callStatus === CALL_STATUS.INITIATING ||
            callStatus === CALL_STATUS.RINGING ||
            callStatus === CALL_STATUS.CONNECTING) && (
            <button onClick={endCall} style={styles.endCallBtn}>
              {endCallIcon}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const micIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
)

const micOffIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="1" y1="1" x2="23" y2="23" />
    <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
    <path d="M15 9.34V4a3 3 0 0 0-5.94-.6" />
    <path d="M17 16.95A7 7 0 0 1 5 12v-2" />
    <path d="M12 19v4" />
    <path d="M8 23h8" />
  </svg>
)

const videoIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="23 7 16 12 23 17 23 7" />
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
  </svg>
)

const videoOffIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="1" y1="1" x2="23" y2="23" />
    <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />
    <path d="M17 9l3-3v12l-3-3" />
    <path d="M9 5h5a2 2 0 0 1 2 2v1" />
  </svg>
)

const endCallIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
)

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: '#000',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    width: '100%',
    height: '100%',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
  },
  videosContainer: {
    flex: 1,
    position: 'relative',
    background: '#111',
  },
  remoteVideo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  localVideo: {
    position: 'absolute',
    bottom: '80px',
    right: '16px',
    width: '160px',
    height: '120px',
    borderRadius: '12px',
    objectFit: 'cover',
    border: '2px solid rgba(255,255,255,0.3)',
    background: '#222',
  },
  controls: {
    position: 'absolute',
    bottom: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '12px 24px',
    borderRadius: '40px',
    background: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(8px)',
  },
  controlBtn: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    border: 'none',
    background: 'rgba(255,255,255,0.15)',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
  },
  controlOff: {
    background: '#e53935',
  },
  endCallBtn: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    border: 'none',
    background: '#e53935',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
  },
  statusOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#111',
    gap: '16px',
  },
  statusText: {
    color: '#fff',
    fontSize: '18px',
    fontWeight: 500,
  },
  ringingIcon: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    height: '40px',
  },
  ringBar: {
    width: '4px',
    height: '100%',
    background: '#4caf50',
    borderRadius: '2px',
    animation: 'waveform 0.8s ease-in-out infinite alternate',
  },
}
