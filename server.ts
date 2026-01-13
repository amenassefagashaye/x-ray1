// Assefa Digital Bingo Game - WebSocket Server
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { serveDir } from "https://deno.land/std@0.168.0/http/file_server.ts";

// Game state
interface Player {
  socket: WebSocket;
  name: string;
  gameType: string;
  boardNumber: number;
  isAdmin: boolean;
  id: string;
}

interface GameState {
  players: Map<string, Player>;
  admin: Player | null;
  drawnNumbers: number[];
  gameType: string;
  gameActive: boolean;
  maxNumbers: number;
}

const gameState: GameState = {
  players: new Map(),
  admin: null,
  drawnNumbers: [],
  gameType: '75ball',
  gameActive: false,
  maxNumbers: 75
};

// Helper functions
function generatePlayerId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function broadcast(message: any, excludePlayerId?: string) {
  const data = JSON.stringify(message);
  gameState.players.forEach((player, id) => {
    if (id !== excludePlayerId && player.socket.readyState === WebSocket.OPEN) {
      player.socket.send(data);
    }
  });
}

function sendToAdmin(message: any) {
  if (gameState.admin && gameState.admin.socket.readyState === WebSocket.OPEN) {
    gameState.admin.socket.send(JSON.stringify(message));
  }
}

function getMaxNumbers(gameType: string): number {
  const ranges: Record<string, number> = {
    '75ball': 75,
    '90ball': 90,
    '30ball': 30,
    '50ball': 50,
    'pattern': 75,
    'coverall': 90
  };
  return ranges[gameType] || 75;
}

function formatNumberDisplay(number: number, gameType: string): string {
  if (gameType === '75ball' || gameType === '50ball' || gameType === 'pattern') {
    const letters = 'BINGO';
    let columnSize = gameType === '75ball' || gameType === 'pattern' ? 15 : 10;
    let columnIndex = Math.floor((number - 1) / columnSize);
    columnIndex = Math.min(columnIndex, 4);
    const letter = letters[columnIndex];
    return `${letter}-${number}`;
  }
  return number.toString();
}

// Handle WebSocket connections
function handleWebSocket(socket: WebSocket, request: Request): void {
  const url = new URL(request.url);
  const isAdmin = url.searchParams.get('admin') === 'true';
  const playerId = generatePlayerId();
  
  console.log(`New ${isAdmin ? 'admin' : 'player'} connection: ${playerId}`);
  
  // Add to players map
  const player: Player = {
    socket,
    name: 'Player',
    gameType: '75ball',
    boardNumber: 1,
    isAdmin,
    id: playerId
  };
  
  gameState.players.set(playerId, player);
  
  if (isAdmin) {
    gameState.admin = player;
  }
  
  // Send initial connection info
  socket.send(JSON.stringify({
    type: 'connected',
    playerId,
    isAdmin,
    playerCount: gameState.players.size - (isAdmin ? 1 : 0), // Exclude admin from count
    gameState: {
      gameType: gameState.gameType,
      gameActive: gameState.gameActive,
      drawnNumbers: gameState.drawnNumbers
    }
  }));
  
  // Update admin about new player
  if (!isAdmin) {
    sendToAdmin({
      type: 'player-joined',
      playerId,
      playerName: player.name,
      playerCount: gameState.players.size - 1 // Exclude admin
    });
  }
  
  // Handle messages
  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleMessage(data, playerId);
    } catch (error) {
      console.error('Error parsing message:', error);
      socket.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format'
      }));
    }
  };
  
  // Handle disconnection
  socket.onclose = () => {
    console.log(`Connection closed: ${playerId}`);
    gameState.players.delete(playerId);
    
    if (isAdmin) {
      gameState.admin = null;
      console.log('Admin disconnected');
    } else {
      // Notify admin about player leaving
      sendToAdmin({
        type: 'player-left',
        playerId,
        playerCount: gameState.players.size - (gameState.admin ? 1 : 0)
      });
    }
    
    // Update all players about new count
    broadcast({
      type: 'player-count-update',
      playerCount: gameState.players.size - (gameState.admin ? 1 : 0)
    });
  };
  
  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
}

// Handle incoming messages
function handleMessage(data: any, playerId: string): void {
  const player = gameState.players.get(playerId);
  if (!player) return;
  
  console.log(`Message from ${playerId}:`, data.type);
  
  switch (data.type) {
    case 'connect':
      player.name = data.playerName || 'Player';
      player.gameType = data.gameType || '75ball';
      player.boardNumber = data.boardNumber || 1;
      break;
      
    case 'update-player':
      player.name = data.playerName || player.name;
      break;
      
    case 'admin-login':
      if (data.password === 'asse2123') {
        player.isAdmin = true;
        gameState.admin = player;
        
        player.socket.send(JSON.stringify({
          type: 'admin-login-success',
          message: 'Admin login successful'
        }));
        
        // Send current game state to admin
        sendToAdmin({
          type: 'game-state',
          gameType: gameState.gameType,
          gameActive: gameState.gameActive,
          drawnNumbers: gameState.drawnNumbers,
          players: Array.from(gameState.players.values())
            .filter(p => !p.isAdmin)
            .map(p => ({
              id: p.id,
              name: p.name,
              gameType: p.gameType,
              boardNumber: p.boardNumber
            }))
        });
      } else {
        player.socket.send(JSON.stringify({
          type: 'admin-login-failed',
          message: 'Invalid password'
        }));
      }
      break;
      
    case 'admin-logout':
      player.isAdmin = false;
      if (gameState.admin?.id === playerId) {
        gameState.admin = null;
      }
      break;
      
    case 'start-game':
      if (!player.isAdmin) {
        player.socket.send(JSON.stringify({
          type: 'error',
          message: 'Admin privileges required'
        }));
        return;
      }
      
      gameState.gameType = data.gameType || '75ball';
      gameState.drawnNumbers = [];
      gameState.gameActive = true;
      gameState.maxNumbers = getMaxNumbers(gameState.gameType);
      
      // Broadcast game start to all players
      broadcast({
        type: 'game-started',
        gameType: gameState.gameType,
        message: 'New game started!'
      });
      
      console.log(`Game started: ${gameState.gameType}`);
      break;
      
    case 'draw-number':
      if (!player.isAdmin) {
        player.socket.send(JSON.stringify({
          type: 'error',
          message: 'Admin privileges required'
        }));
        return;
      }
      
      if (!gameState.gameActive) {
        player.socket.send(JSON.stringify({
          type: 'error',
          message: 'No active game'
        }));
        return;
      }
      
      // Generate unique number
      let number: number;
      const maxNumbers = gameState.maxNumbers;
      
      if (gameState.drawnNumbers.length >= maxNumbers) {
        player.socket.send(JSON.stringify({
          type: 'error',
          message: 'All numbers have been drawn'
        }));
        return;
      }
      
      do {
        number = Math.floor(Math.random() * maxNumbers) + 1;
      } while (gameState.drawnNumbers.includes(number));
      
      gameState.drawnNumbers.push(number);
      
      const displayText = formatNumberDisplay(number, gameState.gameType);
      
      // Broadcast to all players
      broadcast({
        type: 'number-drawn',
        number,
        displayText,
        gameType: gameState.gameType,
        drawnCount: gameState.drawnNumbers.length,
        remaining: maxNumbers - gameState.drawnNumbers.length
      });
      
      console.log(`Number drawn: ${displayText}`);
      break;
      
    case 'player-won':
      // Verify the win (in production, you'd want more robust verification)
      const winData = {
        type: 'player-won',
        playerId: playerId,
        playerName: player.name,
        gameType: player.gameType,
        pattern: data.pattern,
        boardNumber: player.boardNumber,
        timestamp: new Date().toISOString()
      };
      
      // Broadcast win to all players
      broadcast(winData);
      
      // Notify admin
      sendToAdmin({
        type: 'winner-announced',
        ...winData
      });
      
      console.log(`Player ${player.name} won with pattern: ${data.pattern}`);
      break;
      
    case 'reset-game':
      if (!player.isAdmin) {
        player.socket.send(JSON.stringify({
          type: 'error',
          message: 'Admin privileges required'
        }));
        return;
      }
      
      gameState.drawnNumbers = [];
      gameState.gameActive = false;
      
      broadcast({
        type: 'reset-game',
        message: 'Game has been reset'
      });
      
      console.log('Game reset');
      break;
      
    default:
      console.warn('Unknown message type:', data.type);
      player.socket.send(JSON.stringify({
        type: 'error',
        message: 'Unknown message type'
      }));
  }
}

// Main server handler
async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  
  // Handle WebSocket connections
  if (url.pathname === '/ws') {
    const { socket, response } = Deno.upgradeWebSocket(request);
    handleWebSocket(socket, request);
    return response;
  }
  
  // Serve static files from frontend/public
  if (url.pathname === '/' || url.pathname === '/index.html') {
    return serveDir(request, {
      fsRoot: 'frontend/public',
      urlRoot: '',
      showDirListing: false,
      enableCors: true
    });
  }
  
  if (url.pathname === '/admin.html') {
    return serveDir(request, {
      fsRoot: 'frontend/public',
      urlRoot: '',
      showDirListing: false,
      enableCors: true
    });
  }
  
  // Serve other static files
  if (url.pathname.startsWith('/')) {
    return serveDir(request, {
      fsRoot: 'frontend/public',
      urlRoot: '',
      showDirListing: false,
      enableCors: true
    });
  }
  
  // Default response
  return new Response('Assefa Digital Bingo Game Server', {
    status: 200,
    headers: { 'content-type': 'text/plain' }
  });
}

// Start server
console.log('Assefa Digital Bingo Game Server starting on http://localhost:8000');
serve(handler, { port: 8000 });