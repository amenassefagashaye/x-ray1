// Admin-specific game logic
class BingoAdmin {
    constructor() {
        this.autoDrawInterval = null;
        this.autoDrawEnabled = false;
        this.drawnNumbers = [];
        this.gameType = '75ball';
        this.gameActive = false;
        this.connectedPlayers = [];
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.loadSettings();
    }
    
    setupEventListeners() {
        // Login form
        const passwordInput = document.getElementById('adminPassword');
        if (passwordInput) {
            passwordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.adminLogin();
                }
            });
        }
        
        // Game type select
        const gameTypeSelect = document.getElementById('adminGameType');
        if (gameTypeSelect) {
            gameTypeSelect.addEventListener('change', (e) => {
                this.gameType = e.target.value;
                this.updateRemainingCount();
            });
        }
        
        // Auto draw interval
        const autoDrawInput = document.getElementById('autoDrawInterval');
        if (autoDrawInput) {
            autoDrawInput.addEventListener('change', (e) => {
                this.saveSettings();
            });
        }
    }
    
    loadSettings() {
        const savedInterval = localStorage.getItem('bingoAutoDrawInterval');
        const savedDuration = localStorage.getItem('bingoGameDuration');
        const savedMaxNumbers = localStorage.getItem('bingoMaxNumbers');
        
        if (savedInterval) {
            document.getElementById('autoDrawInterval').value = savedInterval;
        }
        if (savedDuration) {
            document.getElementById('gameDuration').value = savedDuration;
        }
        if (savedMaxNumbers) {
            document.getElementById('maxNumbers').value = savedMaxNumbers;
        }
    }
    
    saveSettings() {
        const interval = document.getElementById('autoDrawInterval').value;
        const duration = document.getElementById('gameDuration').value;
        const maxNumbers = document.getElementById('maxNumbers').value;
        
        localStorage.setItem('bingoAutoDrawInterval', interval);
        localStorage.setItem('bingoGameDuration', duration);
        localStorage.setItem('bingoMaxNumbers', maxNumbers);
    }
    
    adminLogin() {
        const password = document.getElementById('adminPassword').value;
        const errorElement = document.getElementById('loginError');
        
        if (password === 'asse2123') {
            // Send login request to server
            if (window.bingoWS && window.bingoWS.socket) {
                window.bingoWS.send({
                    type: 'admin-login',
                    password: password
                });
            } else {
                // If WebSocket not ready, show dashboard directly (for demo)
                this.showDashboard();
            }
            
            if (errorElement) {
                errorElement.style.display = 'none';
            }
        } else {
            if (errorElement) {
                errorElement.style.display = 'block';
            }
        }
    }
    
    showDashboard() {
        document.getElementById('loginPage').classList.remove('active');
        document.getElementById('dashboardPage').classList.add('active');
    }
    
    startNewGame() {
        const gameType = document.getElementById('adminGameType').value;
        this.gameType = gameType;
        this.drawnNumbers = [];
        this.gameActive = true;
        
        // Clear displayed numbers
        this.updateCalledNumbersGrid();
        this.updateRemainingCount();
        
        // Send start game command to server
        if (window.bingoWS && window.bingoWS.socket) {
            window.bingoWS.send({
                type: 'start-game',
                gameType: gameType
            });
        }
        
        alert(`New ${this.getGameTypeName(gameType)} game started!`);
    }
    
    resetGame() {
        if (confirm('Are you sure you want to reset the game? All drawn numbers will be cleared.')) {
            this.drawnNumbers = [];
            this.gameActive = false;
            
            // Clear displayed numbers
            this.updateCalledNumbersGrid();
            this.updateRemainingCount();
            
            // Reset current number display
            document.getElementById('adminCurrentNumber').textContent = '--';
            
            // Send reset command to server
            if (window.bingoWS && window.bingoWS.socket) {
                window.bingoWS.send({
                    type: 'reset-game'
                });
            }
            
            // Stop auto-draw if running
            this.stopAutoDraw();
            
            alert('Game has been reset.');
        }
    }
    
    drawNumber() {
        if (!this.gameActive) {
            alert('Please start a new game first.');
            return;
        }
        
        const maxNumbers = this.getMaxNumbersForType(this.gameType);
        
        if (this.drawnNumbers.length >= maxNumbers) {
            alert('All numbers have been drawn!');
            return;
        }
        
        // Generate random number (in production, this would come from server)
        let number;
        do {
            number = Math.floor(Math.random() * maxNumbers) + 1;
        } while (this.drawnNumbers.includes(number));
        
        this.drawnNumbers.push(number);
        
        // Format display text based on game type
        const displayText = this.formatNumberDisplay(number, this.gameType);
        
        // Update UI
        this.updateCurrentNumberDisplay(number, displayText);
        this.updateCalledNumbersGrid();
        this.updateRemainingCount();
        
        // Send to server
        if (window.bingoWS && window.bingoWS.socket) {
            window.bingoWS.send({
                type: 'draw-number',
                number: number,
                displayText: displayText,
                gameType: this.gameType
            });
        }
    }
    
    autoDrawToggle() {
        const button = document.getElementById('autoDrawBtn');
        
        if (this.autoDrawEnabled) {
            this.stopAutoDraw();
            button.textContent = 'Auto Draw (Off)';
            button.classList.remove('btn-danger');
            button.classList.add('btn-secondary');
        } else {
            this.startAutoDraw();
            button.textContent = 'Auto Draw (On)';
            button.classList.remove('btn-secondary');
            button.classList.add('btn-danger');
        }
    }
    
    startAutoDraw() {
        if (!this.gameActive) {
            alert('Please start a new game first.');
            return;
        }
        
        this.autoDrawEnabled = true;
        const interval = parseInt(document.getElementById('autoDrawInterval').value) || 7;
        
        this.autoDrawInterval = setInterval(() => {
            this.drawNumber();
            
            // Stop if all numbers drawn
            const maxNumbers = this.getMaxNumbersForType(this.gameType);
            if (this.drawnNumbers.length >= maxNumbers) {
                this.stopAutoDraw();
                alert('All numbers have been drawn!');
            }
        }, interval * 1000);
    }
    
    stopAutoDraw() {
        this.autoDrawEnabled = false;
        if (this.autoDrawInterval) {
            clearInterval(this.autoDrawInterval);
            this.autoDrawInterval = null;
        }
        
        const button = document.getElementById('autoDrawBtn');
        if (button) {
            button.textContent = 'Auto Draw (Off)';
            button.classList.remove('btn-danger');
            button.classList.add('btn-secondary');
        }
    }
    
    getMaxNumbersForType(gameType) {
        const ranges = {
            '75ball': 75,
            '90ball': 90,
            '30ball': 30,
            '50ball': 50,
            'pattern': 75,
            'coverall': 90
        };
        return ranges[gameType] || 75;
    }
    
    getGameTypeName(gameType) {
        const names = {
            '75ball': '75-Ball Bingo',
            '90ball': '90-Ball Bingo',
            '30ball': '30-Ball Bingo',
            '50ball': '50-Ball Bingo',
            'pattern': 'Pattern Bingo',
            'coverall': 'Coverall'
        };
        return names[gameType] || 'Bingo';
    }
    
    formatNumberDisplay(number, gameType) {
        if (gameType === '75ball' || gameType === '50ball' || gameType === 'pattern') {
            const letters = 'BINGO';
            let columnSize, columnIndex;
            
            if (gameType === '75ball' || gameType === 'pattern') {
                columnSize = 15;
            } else {
                columnSize = 10;
            }
            
            columnIndex = Math.floor((number - 1) / columnSize);
            columnIndex = Math.min(columnIndex, 4);
            const letter = letters[columnIndex];
            return `${letter}-${number}`;
        }
        return number.toString();
    }
    
    updateCurrentNumberDisplay(number, displayText) {
        const display = document.getElementById('adminCurrentNumber');
        if (display) {
            display.textContent = displayText;
            display.style.animation = 'none';
            setTimeout(() => {
                display.style.animation = 'pulse 0.5s';
            }, 10);
        }
    }
    
    updateCalledNumbersGrid() {
        const grid = document.getElementById('calledNumbersGrid');
        if (!grid) return;
        
        grid.innerHTML = '';
        
        // Show last 20 numbers (most recent first)
        const recentNumbers = [...this.drawnNumbers].reverse().slice(0, 20);
        
        recentNumbers.forEach(number => {
            const cell = document.createElement('div');
            cell.className = 'called-number-cell amharic-text';
            cell.textContent = this.formatNumberDisplay(number, this.gameType);
            grid.appendChild(cell);
        });
    }
    
    updateRemainingCount() {
        const maxNumbers = this.getMaxNumbersForType(this.gameType);
        const remaining = maxNumbers - this.drawnNumbers.length;
        
        document.getElementById('drawnCount').textContent = this.drawnNumbers.length;
        document.getElementById('remainingCount').textContent = remaining;
    }
    
    updatePlayersList(players) {
        this.connectedPlayers = players;
        const list = document.getElementById('playersList');
        if (!list) return;
        
        list.innerHTML = '';
        
        players.forEach(player => {
            const item = document.createElement('div');
            item.className = 'player-item';
            item.innerHTML = `
                <div class="player-name">${player.name}</div>
                <div class="player-stats">${player.gameType} • Board ${player.board}</div>
            `;
            list.appendChild(item);
        });
    }
    
    addWinner(winner) {
        const list = document.getElementById('winnersList');
        if (!list) return;
        
        const item = document.createElement('div');
        item.className = 'winner-item';
        item.innerHTML = `
            <div class="player-name">${winner.playerName}</div>
            <div class="player-stats">${winner.pattern} • ${new Date().toLocaleTimeString()}</div>
        `;
        
        // Add at beginning
        list.insertBefore(item, list.firstChild);
        
        // Limit to 10 winners
        const items = list.querySelectorAll('.winner-item');
        if (items.length > 10) {
            items[items.length - 1].remove();
        }
    }
    
    showSettings() {
        const modal = document.getElementById('adminSettingsModal');
        if (modal) {
            modal.style.display = 'block';
        }
    }
    
    hideAdminSettings() {
        const modal = document.getElementById('adminSettingsModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }
    
    logoutAdmin() {
        if (confirm('Are you sure you want to logout?')) {
            // Stop auto-draw
            this.stopAutoDraw();
            
            // Send logout to server
            if (window.bingoWS && window.bingoWS.socket) {
                window.bingoWS.send({
                    type: 'admin-logout'
                });
            }
            
            // Reload page to show login
            window.location.reload();
        }
    }
}

// Initialize admin when page loads
document.addEventListener('DOMContentLoaded', function() {
    window.bingoAdmin = new BingoAdmin();
    
    // Expose functions for WebSocket client
    window.onAdminLoginSuccess = function(data) {
        console.log('Admin login successful');
        if (window.bingoAdmin) {
            window.bingoAdmin.showDashboard();
        }
    };
    
    window.onAdminLoginFailed = function(data) {
        console.log('Admin login failed');
        alert('Invalid admin password!');
    };
    
    // Handle player updates from server
    window.handlePlayerUpdate = function(data) {
        if (window.bingoAdmin) {
            window.bingoAdmin.updatePlayersList(data.players);
        }
    };
    
    // Handle winner announcements
    window.handleWinnerAnnouncement = function(data) {
        if (window.bingoAdmin) {
            window.bingoAdmin.addWinner(data);
            alert(`${data.playerName} won with ${data.pattern} pattern!`);
        }
    };
});