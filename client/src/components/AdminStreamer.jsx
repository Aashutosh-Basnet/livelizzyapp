import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import Chat from '../chat/Chat';
import { API_URL, SOCKET_CONFIG } from '../config';

const AdminStreamer = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [streamError, setStreamError] = useState('');
  const [messages, setMessages] = useState([]);
  const [viewerStats, setViewerStats] = useState({ count: 0, viewers: [] });
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const socketRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const peerConnectionsRef = useRef({});

  const toggleVideo = async () => {
    if (!streamRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: isAudioEnabled
        });
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        setIsVideoEnabled(true);
        
        // Start streaming if this is the first time
        if (!socketRef.current) {
          initializeSocket();
        }
        socketRef.current.emit('stream:start');
      } catch (error) {
        console.error('Error accessing camera:', error);
        alert('Failed to access camera. Please check permissions.');
        return;
      }
    } else {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = async () => {
    if (!streamRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: isVideoEnabled,
          audio: true
        });
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        setIsAudioEnabled(true);
        
        if (!socketRef.current) {
          initializeSocket();
        }
        socketRef.current.emit('stream:start');
      } catch (error) {
        console.error('Error accessing microphone:', error);
        alert('Failed to access microphone. Please check permissions.');
        return;
      }
    } else {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const initializeSocket = () => {
    socketRef.current = io(API_URL, SOCKET_CONFIG);

    // Handle chat messages
    socketRef.current.on('chat:message', (msg) => {
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev.slice(-99), msg];
      });
    });

    // Request chat history
    socketRef.current.emit('chat:history');
    socketRef.current.on('chat:history', (history) => {
      if (Array.isArray(history)) {
        setMessages(history);
      }
    });

    // Handle viewer offers
    socketRef.current.on('offer', async ({ offer, viewerId }) => {
      try {
        let pc = peerConnectionsRef.current[viewerId];
        if (!pc) {
          pc = new RTCPeerConnection({
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' }
            ]
          });
          peerConnectionsRef.current[viewerId] = pc;

          // Add local stream
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => {
              pc.addTrack(track, streamRef.current);
            });
          }

          pc.onicecandidate = (event) => {
            if (event.candidate) {
              socketRef.current.emit('ice-candidate', {
                candidate: event.candidate,
                viewerId
              });
            }
          };

          pc.onconnectionstatechange = () => {
            console.log(`Connection state for viewer ${viewerId}:`, pc.connectionState);
          };
        }

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socketRef.current.emit('answer', { answer, viewerId });
      } catch (error) {
        console.error('Error handling offer:', error);
      }
    });

    // Handle ICE candidates
    socketRef.current.on('ice-candidate', async ({ candidate, viewerId }) => {
      try {
        const pc = peerConnectionsRef.current[viewerId];
        if (pc) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    });

    // Handle viewer stats
    socketRef.current.on('viewers:update', (stats) => {
      setViewerStats(stats);
    });
  };

  const handleSendMessage = (message) => {
    if (!socketRef.current || !message.trim()) return;

    const messageData = {
      username: 'Admin',
      message: message.trim(),
      timestamp: new Date().toISOString(),
      id: Math.random().toString(36).substr(2, 9)
    };

    socketRef.current.emit('chat:message', messageData);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'admin',
          password: '12345'
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setIsAuthenticated(true);
        localStorage.setItem('isAdminAuthenticated', 'true');
        initializeSocket();
      } else {
        throw new Error(data.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      alert(error.message);
    }
  };

  useEffect(() => {
    const isAuth = localStorage.getItem('isAdminAuthenticated') === 'true';
    if (isAuth) {
      setIsAuthenticated(true);
      initializeSocket();
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
    };
  }, []);

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <form onSubmit={handleLogin} className="bg-gray-800 p-8 rounded-lg shadow-lg">
          <h2 className="text-2xl text-white mb-4">Admin Login</h2>
          <button
            type="submit"
            className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
          >
            Login as Admin
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 p-4 bg-gray-900 min-h-screen">
      <div className="lg:w-2/3">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover rounded-lg bg-gray-800"
        />
        <div className="flex gap-4 mt-4">
          <button
            onClick={toggleVideo}
            className={`px-4 py-2 rounded ${
              isVideoEnabled ? 'bg-red-500' : 'bg-green-500'
            } text-white`}
          >
            {isVideoEnabled ? 'Stop Video' : 'Start Video'}
          </button>
          <button
            onClick={toggleAudio}
            className={`px-4 py-2 rounded ${
              isAudioEnabled ? 'bg-red-500' : 'bg-green-500'
            } text-white`}
          >
            {isAudioEnabled ? 'Mute Audio' : 'Unmute Audio'}
          </button>
        </div>
        
        <div className="mt-4 bg-gray-800 p-4 rounded-lg">
          <h3 className="text-white text-lg mb-2">Viewers: {viewerStats.count}</h3>
          <div className="grid grid-cols-2 gap-2">
            {viewerStats.viewers.slice(0, 50).map((viewer, index) => (
              <div key={index} className="text-gray-300 text-sm">
                {viewer.username} ({viewer.country})
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="lg:w-1/3">
        <Chat
          messages={messages}
          onSendMessage={handleSendMessage}
        />
      </div>
    </div>
  );
};

export default AdminStreamer;
