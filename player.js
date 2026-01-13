// Player-specific game logic
class BingoPlayer {
    constructor() {
        this.board = [];
        this.markedNumbers = new Set();
        this.gameType = '75ball';
        this.boardNumber = 1;
        this.playerName = 'Player';
        this.calledNumbers = [];
        
        this.boardTypes = {
            '75ball': { range: 75, columns: 5, rows: 5 },
            '90ball': { range: 90, columns: 9, rows: 3 },
            '30ball': { range: 30, columns: 3, rows: 3 },
            '50ball': { range: 50, columns: 5, rows: 5 },
            'pattern': { range: 75, columns: 5, rows: 5 },
            'coverall': { range: 90, columns: 9, rows: 5 }
        };
        
        this.winningPatterns = {
            '75ball': ['row', 'column', 'diagonal', 'four-corners', 'full-house'],
            '90ball': ['one-line', 'two-lines', 'full-house'],
            '30ball': ['full-house'],
            '50ball': ['row', 'column', 'diagonal', 'four-corners', 'full-house'],
            'pattern': ['x-pattern', 'frame', 'postage-stamp', 'small-diamond'],
            'coverall': ['full-board']
        };
        
        this.init();
    }
    
    init() {
        // Load saved settings
        this.loadSettings();
        
        // Generate initial board
        this.generateBoard();
        
        // Setup event listeners
        this.setupEventListeners();
    }
    
    loadSettings() {
        const savedName = localStorage.getItem('bingoPlayerName');
        const savedType = localStorage.getItem('bingoGameType');
        const savedBoard = localStorage.getItem('bingoBoardNumber');
        
        if (savedName) this.playerName = savedName;
        if (savedType) this.gameType = savedType;
        if (savedBoard) this.boardNumber = parseInt(savedBoard);
        
        // Update UI
        const nameInput = document.getElementById('playerNameInput');
        const typeSelect = document.getElementById('gameTypeSelect');
        const boardInput = document.getElementById('boardNumberInput');
        
        if (nameInput) nameInput.value = this.playerName;
        if (typeSelect) typeSelect.value = this.gameType;
        if (boardInput) boardInput.value = this.boardNumber;
    }
    
    saveSettings() {
        localStorage.setItem('bingoPlayerName', this.playerName);
        localStorage.setItem('bingoGameType', this.gameType);
        localStorage.setItem('bingoBoardNumber', this.boardNumber.toString());
    }
    
    setupEventListeners() {
        // Update player name
        const nameInput = document.getElementById('playerNameInput');
        if (nameInput) {
            nameInput.addEventListener('change', (e) => {
                this.playerName = e.target.value;
                this.saveSettings();
                
                // Update WebSocket connection with new name
                if (window.bingoWS && window.bingoWS.socket) {
                    window.bingoWS.send({
                        type: 'update-player',
                        playerName: this.playerName
                    });
                }
            });
        }
        
        // Update game type
        const typeSelect = document.getElementById('gameTypeSelect');
        if (typeSelect) {
            typeSelect.addEventListener('change', (e) => {
                this.gameType = e.target.value;
                this.saveSettings();
                this.generateBoard();
            });
        }
        
        // Update board number
        const boardInput = document.getElementById('boardNumberInput');
        if (boardInput) {
            boardInput.addEventListener('change', (e) => {
                this.boardNumber = parseInt(e.target.value);
                if (this.boardNumber < 1) this.boardNumber = 1;
                if (this.boardNumber > 100) this.boardNumber = 100;
                this.saveSettings();
                this.generateBoard();
            });
        }
    }
    
    generateBoard() {
        const boardElement = document.getElementById('gameBoard');
        if (!boardElement) return;
        
        boardElement.innerHTML = '';
        
        const type = this.boardTypes[this.gameType];
        if (!type) return;
        
        // Create board based on game type
        if (this.gameType === '75ball' || this.gameType === '50ball') {
            this.generateBingoBoard(type, boardElement);
        } else if (this.gameType === '90ball') {
            this.generate90BallBoard(type, boardElement);
        } else if (this.gameType === '30ball') {
            this.generate30BallBoard(type, boardElement);
        } else if (this.gameType === 'pattern') {
            this.generatePatternBoard(type, boardElement);
        } else if (this.gameType === 'coverall') {
            this.generateCoverallBoard(type, boardElement);
        }
        
        // Update game header
        const header = document.getElementById('gameHeader');
        if (header) {
            header.textContent = `${this.getGameTypeName()} - Board ${this.boardNumber} - ${this.playerName}`;
        }
    }
    
    getGameTypeName() {
        const names = {
            '75ball': '75-Ball Bingo',
            '90ball': '90-Ball Bingo',
            '30ball': '30-Ball Bingo',
            '50ball': '50-Ball Bingo',
            'pattern': 'Pattern Bingo',
            'coverall': 'Coverall'
        };
        return names[this.gameType] || 'Bingo';
    }
    
    generateBingoBoard(type, container) {
        const wrapper = document.createElement('div');
        wrapper.className = 'board-75-wrapper';
        
        // BINGO Labels
        const labels = document.createElement('div');
        labels.className = 'bingo-labels';
        'BINGO'.split('').forEach(letter => {
            const label = document.createElement('div');
            label.className = 'bingo-label';
            label.textContent = letter;
            labels.appendChild(label);
        });
        wrapper.appendChild(labels);
        
        // Board Grid
        const grid = document.createElement('div');
        grid.className = 'board-75';
        
        const columnRanges = type.range === 75 ? 
            [[1,15], [16,30], [31,45], [46,60], [61,75]] :
            [[1,10], [11,20], [21,30], [31,40], [41,50]];
        
        const columnNumbers = columnRanges.map(range => {
            let nums = new Set();
            while (nums.size < 5) {
                nums.add(Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0]);
            }
            return Array.from(nums).sort((a, b) => a - b);
        });
        
        this.board = [];
        for (let row = 0; row < 5; row++) {
            this.board[row] = [];
            for (let col = 0; col < 5; col++) {
                const cell = document.createElement('button');
                cell.className = 'board-cell';
                
                if (row === 2 && col === 2) {
                    cell.textContent = '★';
                    cell.classList.add('center-cell');
                    cell.dataset.center = 'true';
                    cell.onclick = () => this.markCenterCell(cell);
                    this.board[row][col] = { number: 'FREE', marked: false };
                } else {
                    const num = columnNumbers[col][row];
                    cell.textContent = num;
                    cell.dataset.number = num;
                    cell.dataset.row = row;
                    cell.dataset.column = col;
                    cell.onclick = () => this.markNumber(cell, num);
                    this.board[row][col] = { number: num, marked: false };
                }
                
                grid.appendChild(cell);
            }
        }
        
        wrapper.appendChild(grid);
        container.appendChild(wrapper);
    }
    
    generate90BallBoard(type, container) {
        // Similar implementation for 90-ball
        // (Implementation details would follow the pattern above)
    }
    
    generate30BallBoard(type, container) {
        // Implementation for 30-ball
    }
    
    generatePatternBoard(type, container) {
        // Implementation for pattern bingo
    }
    
    generateCoverallBoard(type, container) {
        // Implementation for coverall
    }
    
    markNumber(cell, number) {
        if (cell.classList.contains('marked')) {
            cell.classList.remove('marked');
            this.markedNumbers.delete(number);
        } else {
            cell.classList.add('marked');
            this.markedNumbers.add(number);
        }
        
        // Check for win
        this.checkForWin();
    }
    
    markCenterCell(cell) {
        if (!cell.classList.contains('marked')) {
            cell.classList.add('marked');
        }
        this.checkForWin();
    }
    
    checkForNumber(number) {
        // Check if this number is on the board and mark it
        const cells = document.querySelectorAll(`.board-cell[data-number="${number}"]`);
        cells.forEach(cell => {
            if (!cell.classList.contains('marked')) {
                cell.classList.add('marked');
                this.markedNumbers.add(number);
                this.checkForWin();
            }
        });
    }
    
    checkForWin() {
        const patterns = this.winningPatterns[this.gameType];
        if (!patterns) return false;
        
        for (const pattern of patterns) {
            if (this.checkPattern(pattern)) {
                this.declareWin(pattern);
                return true;
            }
        }
        return false;
    }
    
    checkPattern(pattern) {
        // Implementation for checking each pattern type
        // Similar to the original checkPattern function
        return false;
    }
    
    declareWin(pattern) {
        // Show winner notification
        this.showWinnerNotification(pattern);
        
        // Send win announcement to server
        if (window.bingoWS && window.bingoWS.socket) {
            window.bingoWS.send({
                type: 'player-won',
                playerName: this.playerName,
                gameType: this.gameType,
                pattern: pattern,
                boardNumber: this.boardNumber
            });
        }
    }
    
    showWinnerNotification(pattern) {
        const notification = document.getElementById('winnerNotification');
        const winnerName = document.getElementById('winnerName');
        const winPattern = document.getElementById('winPattern');
        
        if (notification && winnerName && winPattern) {
            winnerName.textContent = this.playerName;
            winPattern.textContent = this.getPatternName(pattern);
            notification.style.display = 'block';
        }
    }
    
    getPatternName(pattern) {
        const names = {
            'row': 'Row Complete',
            'column': 'Column Complete',
            'diagonal': 'Diagonal Complete',
            'four-corners': 'Four Corners',
            'full-house': 'Full House',
            'one-line': 'One Line',
            'two-lines': 'Two Lines',
            'x-pattern': 'X Pattern',
            'frame': 'Frame',
            'postage-stamp': 'Postage Stamp',
            'small-diamond': 'Small Diamond',
            'full-board': 'Full Board'
        };
        return names[pattern] || pattern;
    }
    
    updateCalledNumbers(data) {
        const bar = document.getElementById('calledNumbersBar');
        const currentDisplay = document.getElementById('currentNumberDisplay');
        
        if (!bar || !currentDisplay) return;
        
        // Update current number display
        currentDisplay.textContent = data.displayText || data.number;
        
        // Add to called numbers bar
        const span = document.createElement('span');
        span.className = 'called-number amharic-text';
        span.textContent = data.displayText || data.number;
        
        // Insert at beginning
        bar.insertBefore(span, bar.firstChild);
        
        // Limit displayed numbers
        const numbers = bar.querySelectorAll('.called-number');
        if (numbers.length > 8) {
            numbers[numbers.length - 1].remove();
        }
    }
    
    generateNewBoard() {
        this.boardNumber = parseInt(document.getElementById('boardNumberInput').value) || 1;
        this.generateBoard();
        this.saveSettings();
        this.hideSettings();
    }
    
    showGameSettings() {
        const modal = document.getElementById('settingsModal');
        if (modal) {
            modal.style.display = 'block';
        }
    }
    
    hideSettings() {
        const modal = document.getElementById('settingsModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }
    
    announceWin() {
        if (this.checkForWin()) {
            // Win already declared in checkForWin
            return;
        }
        
        alert('No winning pattern detected yet. Keep playing!');
    }
    
    continueGame() {
        const notification = document.getElementById('winnerNotification');
        if (notification) {
            notification.style.display = 'none';
        }
        
        // Reset board for next game
        this.markedNumbers.clear();
        const cells = document.querySelectorAll('.board-cell');
        cells.forEach(cell => {
            if (cell.dataset.center !== 'true') {
                cell.classList.remove('marked');
            }
        });
    }
}

// Initialize player when page loads
document.addEventListener('DOMContentLoaded', function() {
    window.bingoPlayer = new BingoPlayer();
    
    // Expose functions for WebSocket client
    window.updateCalledNumbers = function(data) {
        if (window.bingoPlayer) {
            window.bingoPlayer.updateCalledNumbers(data);
        }
    };
    
    window.checkForNumber = function(number) {
        if (window.bingoPlayer) {
            window.bingoPlayer.checkForNumber(number);
        }
    };
    
    window.onGameStarted = function(data) {
        console.log('Game started:', data);
        // Reset board for new game
        if (window.bingoPlayer) {
            window.bingoPlayer.markedNumbers.clear();
            window.bingoPlayer.generateBoard();
        }
    };
    
    window.onGameEnded = function(data) {
        console.log('Game ended:', data);
        alert('The game has ended!');
    };
    
    window.showWinnerNotification = function(data) {
        if (window.bingoPlayer) {
            window.bingoPlayer.showWinnerNotification(data.pattern);
        }
    };
    
    window.showOtherPlayerWon = function(data) {
        alert(`${data.playerName} won with ${data.pattern} pattern!`);
    };
    
    window.onGameReset = function(data) {
        if (window.bingoPlayer) {
            window.bingoPlayer.markedNumbers.clear();
            window.bingoPlayer.generateBoard();
        }
    };
});