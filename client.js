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
    init(url = "wss://ameng-gogs-xray2-35.deno.dev/") {
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
            
        } catch (error) {
            console.error("WebSocket initialization error:", error);
        }
    }
}
