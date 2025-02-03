import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import Chat from '../chat/Chat';
import { API_URL, SOCKET_CONFIG } from '../config';

const ViewerPage = () => {
  const [username, setUsername] = useState(() => localStorage.getItem('viewerName') || '');
  const [isJoined, setIsJoined] = useState(false);
  const [messages, setMessages] = useState([]);
  const socketRef = useRef(null);
  const videoRef = useRef(null);
  const peerConnectionRef = useRef(null);

  const handleJoin = (e) => {
    e.preventDefault();
    if (username.trim()) {
      localStorage.setItem('viewerName', username);
      setIsJoined(true);
    }
  };

  const handleSendMessage = (message) => {
    if (socketRef.current && message.trim()) {
      const messageData = {
        username,
        message: message.trim(),
        timestamp: new Date().toISOString(),
        id: Math.random().toString(36).substr(2, 9)
      };
      socketRef.current.emit('chat:message', messageData);
    }
  };

  const setupPeerConnection = async () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    console.log('Setting up new peer connection');
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });
    peerConnectionRef.current = pc;

    // Handle incoming tracks
    pc.ontrack = (event) => {
      console.log('Received track:', event.track.kind);
      if (videoRef.current && event.streams[0]) {
        console.log('Setting video source');
        videoRef.current.srcObject = event.streams[0];
        videoRef.current.play().catch(e => console.error('Error playing video:', e));
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('Connection state changed:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        console.log('WebRTC connection established!');
      }
    };

    // Handle ICE connection state
    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState);
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Sending ICE candidate to streamer');
        socketRef.current.emit('ice-candidate', {
          candidate: event.candidate,
          streamerId: socketRef.current.id
        });
      }
    };

    return pc;
  };

  useEffect(() => {
    if (isJoined) {
      socketRef.current = io(API_URL, SOCKET_CONFIG);

      socketRef.current.on('connect', () => {
        console.log('Connected to server');
        socketRef.current.emit('viewer:join', username);
      });

      // Handle chat messages
      socketRef.current.on('chat:message', (msg) => {
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev.slice(-99), msg];
        });
      });

      // Request chat history when connecting
      socketRef.current.emit('chat:history');
      socketRef.current.on('chat:history', (history) => {
        if (Array.isArray(history)) {
          setMessages(history);
        }
      });

      // Handle stream setup
      socketRef.current.on('stream-available', async ({ streamerId }) => {
        console.log('Stream is available, creating peer connection...');
        try {
          const pc = await setupPeerConnection();
          
          // Create and send offer
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          
          console.log('Sending offer to streamer');
          socketRef.current.emit('offer', {
            offer,
            streamerId
          });
        } catch (error) {
          console.error('Error setting up stream:', error);
        }
      });

      // Handle answer from streamer
      socketRef.current.on('answer', async ({ answer }) => {
        console.log('Received answer from streamer');
        try {
          if (peerConnectionRef.current) {
            await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
            console.log('Set remote description successfully');
          }
        } catch (error) {
          console.error('Error setting remote description:', error);
        }
      });

      // Handle ICE candidates
      socketRef.current.on('ice-candidate', async ({ candidate }) => {
        console.log('Received ICE candidate');
        try {
          if (peerConnectionRef.current) {
            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
            console.log('Added ICE candidate successfully');
          }
        } catch (error) {
          console.error('Error adding ICE candidate:', error);
        }
      });

      return () => {
        if (socketRef.current) {
          socketRef.current.disconnect();
        }
        if (peerConnectionRef.current) {
          peerConnectionRef.current.close();
        }
      };
    }
  }, [isJoined, username]);

  if (!isJoined) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <form onSubmit={handleJoin} className="bg-gray-800 p-8 rounded-lg shadow-lg">
          <h2 className="text-2xl text-white mb-4">Join Stream</h2>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username"
            className="w-full p-2 mb-4 bg-gray-700 text-white rounded"
            required
          />
          <button
            type="submit"
            className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
          >
            Join
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
          className="w-full h-full object-cover rounded-lg bg-gray-800"
        />
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

export default ViewerPage;
