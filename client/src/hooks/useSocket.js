import { useEffect, useRef, useState, useCallback } from 'react'
import { io } from 'socket.io-client'
import { Buffer } from 'buffer'

if (typeof window !== 'undefined' && !window.Buffer) {
  window.Buffer = Buffer
}

export default function useSocket(token) {
  const [isConnected, setIsConnected] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState(new Map())
  const socketRef = useRef(null)

  useEffect(() => {
    if (!token) return

    const socket = io('/', {
      auth: { token },
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    })

    socket.on('connect', () => {
      setIsConnected(true)
      socket.emit('user:join')
    })

    socket.on('disconnect', () => setIsConnected(false))

    socket.on('user:online', ({ userId }) => {
      setOnlineUsers((prev) => new Map(prev).set(userId, true))
    })

    socket.on('user:offline', ({ userId }) => {
      setOnlineUsers((prev) => {
        const next = new Map(prev)
        next.delete(userId)
        return next
      })
    })

    socketRef.current = socket

    return () => {
      socket.close()
    }
  }, [token])

  const emit = useCallback((event, data) => {
    socketRef.current?.emit(event, data)
  }, [])

  const on = useCallback((event, handler) => {
    socketRef.current?.on(event, handler)
    return () => socketRef.current?.off(event, handler)
  }, [])

  const off = useCallback((event, handler) => {
    socketRef.current?.off(event, handler)
  }, [])

  return { socket: socketRef.current, isConnected, onlineUsers, emit, on, off }
}
