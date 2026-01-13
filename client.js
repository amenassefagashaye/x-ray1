// WebSocket Client for Assefa Digital Bingo Game
class BingoWebSocket {
    constructor() {
        this.socket = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;
        this.isAdmin = false;
        this.gameState = {
            gameType: '75ball',
            calledNumbers: [],
            gameActive: false,
            playerName: 'Player',
            boardNumber: 1,
            connectedPlayers: 0
        };
        
        this.messageHandlers = {
            'connected': this.handleConnected.bind(this),
            'error': this.handleError.bind(this),
            'number-drawn': this.handleNumberDrawn.bind(this),
            'game-started': this.handleGameStarted.bind(this),
            'game-ended': this.handleGameEnded.bind(this),
            'player-joined': this.handlePlayerJoined.bind(this),
            'player-left': this.handlePlayerLeft.bind(this),
            'player-won': this.handlePlayerWon.bind(this),
            'admin-login-success': this.handleAdminLoginSuccess.bind(this),
            'admin-login-failed': this.handleAdminLoginFailed.bind(this),
            'reset-game': this.handleResetGame.bind(this)
        };
    }
    
    // Initialize WebSocket connection
    init(url) {
        try {
            this.socket = new WebSocket(url);
            
            this.socket.onopen = () => {
                console.log('WebSocket connected');
                this.reconnectAttempts = 0;
                this.updateConnectionStatus(true);
                
                // Send initial connection message
                this.send({
                    type: 'connect',
                    isAdmin: this.isAdmin,
                    playerName: this.gameState.playerName,
                    gameType: this.gameState.gameType
                });
            };
            
            this.socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleMessage(data);
                } catch (error) {
                    console.error('Error parsing message:', error);
                }
            };
            
            this.socket.onclose = (event) => {
                console.log('WebSocket disconnected:', event.code, event.reason);
                this.updateConnectionStatus(false);
                this.attemptReconnect();
            };
            
            this.socket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.updateConnectionStatus(false);
            };
            
        } catch (error) {
            console.error('Failed to initialize WebSocket:', error);
            this.attemptReconnect();
        }
    }
    
    // Handle incoming messages
    handleMessage(data) {
        const handler = this.messageHandlers[data.type];
        if (handler) {
            handler(data);
        } else {
            console.warn('Unknown message type:', data.type);
        }
    }
    
    // Send message to server
    send(message) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(message));
            return true;
        } else {
            console.warn('WebSocket not ready, cannot send:', message);
            return false;
        }
    }
    
    // Update connection status UI
    updateConnectionStatus(connected) {
        const statusElement = document.getElementById(this.isAdmin ? 'adminConnectionStatus' : 'connectionStatus');
        if (statusElement) {
            const dot = statusElement.querySelector('.status-dot');
            const text = statusElement.querySelector('.status-text');
            
            if (connected) {
                dot.className = 'status-dot connected';
                text.textContent = 'Connected';
                text.style.color = '#28a745';
            } else {
                dot.className = 'status-dot';
                text.textContent = 'Disconnected';
                text.style.color = '#dc3545';
            }
        }
    }
    
    // Attempt to reconnect
    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            
            setTimeout(() => {
                // Use the same URL or get from configuration
                const wsUrl = this.isAdmin ? 
                    `wss://${window.location.hostname}/ws?admin=true` : 
                    `wss://${window.location.hostname}/ws`;
                this.init(wsUrl);
            }, this.reconnectDelay);
        } else {
            console.error('Max reconnection attempts reached');
            this.showConnectionError();
        }
    }
    
    // Show connection error
    showConnectionError() {
        alert('Unable to connect to the game server. Please refresh the page.');
    }
    
    // Message handlers
    handleConnected(data) {
        console.log('Server connected:', data);
        this.gameState.connectedPlayers = data.playerCount || 0;
        this.updatePlayerCount(data.playerCount || 0);
    }
    
    handleError(data) {
        console.error('Server error:', data.message);
        alert(`Error: ${data.message}`);
    }
    
    handleNumberDrawn(data) {
        console.log('Number drawn:', data);
        this.gameState.calledNumbers.push(data.number);
        
        // Update UI
        if (typeof window.updateCalledNumbers === 'function') {
            window.updateCalledNumbers(data);
        }
        
        // Check if player has this number
        if (typeof window.checkForNumber === 'function') {
            window.checkForNumber(data.number);
        }
    }
    
    handleGameStarted(data) {
        console.log('Game started:', data);
        this.gameState.gameActive = true;
        this.gameState.gameType = data.gameType;
        this.gameState.calledNumbers = [];
        
        if (typeof window.onGameStarted === 'function') {
            window.onGameStarted(data);
        }
    }
    
    handleGameEnded(data) {
        console.log('Game ended:', data);
        this.gameState.gameActive = false;
        
        if (typeof window.onGameEnded === 'function') {
            window.onGameEnded(data);
        }
    }
    
    handlePlayerJoined(data) {
        console.log('Player joined:', data);
        this.gameState.connectedPlayers = data.playerCount || 0;
        this.updatePlayerCount(data.playerCount || 0);
    }
    
    handlePlayerLeft(data) {
        console.log('Player left:', data);
        this.gameState.connectedPlayers = data.playerCount || 0;
        this.updatePlayerCount(data.playerCount || 0);
    }
    
    handlePlayerWon(data) {
        console.log('Player won:', data);
        
        // If this player is the winner
        if (data.playerName === this.gameState.playerName) {
            if (typeof window.showWinnerNotification === 'function') {
                window.showWinnerNotification(data);
            }
        } else {
            // Show other player won notification
            if (typeof window.showOtherPlayerWon === 'function') {
                window.showOtherPlayerWon(data);
            }
        }
    }
    
    handleAdminLoginSuccess(data) {
        console.log('Admin login successful');
        this.isAdmin = true;
        
        if (typeof window.onAdminLoginSuccess === 'function') {
            window.onAdminLoginSuccess(data);
        }
    }
    
    handleAdminLoginFailed(data) {
        console.log('Admin login failed');
        
        if (typeof window.onAdminLoginFailed === 'function') {
            window.onAdminLoginFailed(data);
        }
    }
    
    handleResetGame(data) {
        console.log('Game reset:', data);
        this.gameState.calledNumbers = [];
        this.gameState.gameActive = false;
        
        if (typeof window.onGameReset === 'function') {
            window.onGameReset(data);
        }
    }
    
    // Update player count display
    updatePlayerCount(count) {
        const countElement = document.getElementById('playerCount');
        if (countElement) {
            countElement.textContent = count;
        }
    }
    
    // Disconnect
    disconnect() {
        if (this.socket) {
            this.socket.close();
        }
    }
}

// Create global WebSocket instance
window.bingoWS = new BingoWebSocket();

// Initialize connection when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Determine if this is admin page
    const isAdminPage = window.location.pathname.includes('admin.html');
    const urlParams = new URLSearchParams(window.location.search);
    const isAdminParam = urlParams.get('admin') === 'true';
    
    // Get WebSocket URL from environment or use current host
    const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    const host = window.location.hostname;
    const port = window.location.port ? `:${window.location.port}` : '';
    
    // For Deno Deploy, use the secure WebSocket URL
    // In production, this would be: wss://your-app.deno.dev/ws
    // For local development: ws://localhost:8000/ws
    let wsUrl;
    
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        wsUrl = `ws://localhost:8000/ws`;
    } else {
        // On Deno Deploy, use the same host with wss
        wsUrl = `wss://${host}/ws`;
    }
    
    // Add query parameters if admin
    if (isAdminPage || isAdminParam) {
        window.bingoWS.isAdmin = true;
        wsUrl += '?admin=true';
    }
    
    // Initialize WebSocket connection
    window.bingoWS.init(wsUrl);
    
    // Handle page unload
    window.addEventListener('beforeunload', function() {
        window.bingoWS.disconnect();
    });
});