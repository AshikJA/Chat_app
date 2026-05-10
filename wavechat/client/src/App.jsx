import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import Root from './components/Root';
import Login from './pages/Login';
import Register from './pages/Register';
import OTPVerify from './pages/OTPVerify';
import ChatList from './pages/ChatList';
import ChatScreen from './pages/ChatScreen';
import VideoCall from './pages/VideoCall';
import Profile from './pages/Profile';
import AddFriend from './pages/AddFriend';
import FriendRequests from './pages/FriendRequests';

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!localStorage.getItem('wc_token')) return <Navigate to="/" replace />;
  if (!user) return null;
  return children;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const socketRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('wc_token');
    const stored = localStorage.getItem('wc_user');
    if (token && stored) {
      try { setUser(JSON.parse(stored)); } catch { localStorage.clear(); }
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    socketRef.current = io('/', { auth: { token: localStorage.getItem('wc_token') } });
    socketRef.current.on('connect', () => {
      socketRef.current.emit('user:join', user.id);
    });
    return () => { socketRef.current?.disconnect(); };
  }, [user]);

  const login = (token, userData) => {
    localStorage.setItem('wc_token', token);
    localStorage.setItem('wc_user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('wc_token');
    localStorage.removeItem('wc_user');
    localStorage.removeItem('wc_private_key');
    setUser(null);
    socketRef.current?.disconnect();
    navigate('/');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, socket: socketRef.current }}>
      {children}
    </AuthContext.Provider>
  );
}

function AppRoutes() {
  return (
    <Root>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-otp" element={<OTPVerify />} />
        <Route path="/chats" element={<ProtectedRoute><ChatList /></ProtectedRoute>} />
        <Route path="/chat/:userId" element={<ProtectedRoute><ChatScreen /></ProtectedRoute>} />
        <Route path="/call/:userId" element={<ProtectedRoute><VideoCall /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/add-friend" element={<ProtectedRoute><AddFriend /></ProtectedRoute>} />
        <Route path="/friend-requests" element={<ProtectedRoute><FriendRequests /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Root>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
