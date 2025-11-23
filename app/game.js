// Game state management
class GameState {
    constructor() {
        this.ball = {
            x: 0,
            y: 0,
            speedX: 5,
            speedY: 5
        };
        this.paddles = {
            paddle1: { y: 0 },
            paddle2: { y: 0 }
        };
        this.scores = {
            player1: 0,
            player2: 0
        };
        this.gameOver = false;
        this.isPlayer1 = false;
        this.player2Connected = false;
        this.gameStarted = false;
    }
}

// Game manager
class GameManager {
    constructor() {
        this.state = new GameState();
        this.socket = null;
        this.animationFrameId = null;
        this.lastUpdateTime = 0;
        this.fps = 60;
        this.frameInterval = 1000 / this.fps;
        
        this.initializeElements();
        this.initializeSocket();
        this.setupEventListeners();
    }

    initializeElements() {
        this.elements = {
            ball: document.getElementById("ball"),
            paddle1: document.getElementById("paddle1"),
            paddle2: document.getElementById("paddle2"),
            gameBoard: document.getElementById("game-board"),
            player: document.getElementById("player"),
            player1ScoreBoard: document.getElementById("player1ScoreBoard"),
            player2ScoreBoard: document.getElementById("player2ScoreBoard"),
            gameCode: document.getElementById("game-code"),
            connectionStatus: document.getElementById("connection-status"),
            waitingMessage: document.getElementById("waiting-message"),
            gameOverScreen: document.getElementById("game-over-screen"),
            winnerMessage: document.getElementById("winner-message"),
            restartButton: document.getElementById("restart-button")
        };

        // Create missing UI elements if they don't exist
        this.createUIElements();
    }

    createUIElements() {
        const style = document.createElement('style');
        style.textContent = `
            .status-indicator {
                position: fixed;
                top: 10px;
                right: 10px;
                padding: 5px 10px;
                border-radius: 15px;
                color: white;
                font-size: 12px;
                z-index: 1000;
            }
            .connected { background: #4CAF50; }
            .disconnected { background: #f44336; }
            .waiting { background: #ff9800; }
            
            .waiting-message {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0,0,0,0.8);
                color: white;
                padding: 20px;
                border-radius: 10px;
                text-align: center;
                z-index: 100;
            }
            
            .game-over-screen {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.9);
                display: none;
                justify-content: center;
                align-items: center;
                flex-direction: column;
                color: white;
                z-index: 200;
            }
            
            .restart-button {
                margin-top: 20px;
                padding: 10px 20px;
                background: #4CAF50;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-size: 16px;
            }
            
            .restart-button:hover {
                background: #45a049;
            }
        `;
        document.head.appendChild(style);

        if (!this.elements.connectionStatus) {
            const statusDiv = document.createElement('div');
            statusDiv.id = 'connection-status';
            statusDiv.className = 'status-indicator disconnected';
            statusDiv.textContent = 'Connecting...';
            document.body.appendChild(statusDiv);
            this.elements.connectionStatus = statusDiv;
        }

        if (!this.elements.waitingMessage) {
            const waitingDiv = document.createElement('div');
            waitingDiv.id = 'waiting-message';
            waitingDiv.className = 'waiting-message';
            waitingDiv.innerHTML = '<h3>Waiting for opponent...</h3><p>Share this game code: <strong id="share-code"></strong></p>';
            waitingDiv.style.display = 'none';
            this.elements.gameBoard.appendChild(waitingDiv);
            this.elements.waitingMessage = waitingDiv;
        }

        if (!this.elements.gameOverScreen) {
            const gameOverDiv = document.createElement('div');
            gameOverDiv.id = 'game-over-screen';
            gameOverDiv.className = 'game-over-screen';
            gameOverDiv.innerHTML = `
                <h2 id="winner-message">Game Over</h2>
                <button id="restart-button" class="restart-button">Play Again</button>
            `;
            this.elements.gameBoard.appendChild(gameOverDiv);
            this.elements.gameOverScreen = gameOverDiv;
            this.elements.winnerMessage = document.getElementById('winner-message');
            this.elements.restartButton = document.getElementById('restart-button');
        }
    }

    initializeSocket() {
        const game = prompt('Press "OK" to start new game or type the Game Code:');
        const api = `//${window.location.hostname}`;

        this.socket = io(`${api}`, {
            query: { game },
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });

        this.setupSocketEvents();
    }

    setupSocketEvents() {
        this.socket.on("connect", () => {
            console.log("Connected to server");
            this.updateConnectionStatus('connected', 'Connected');
        });

        this.socket.on("disconnect", () => {
            console.log("Disconnected from server");
            this.updateConnectionStatus('disconnected', 'Disconnected');
            this.showWaitingMessage("Connection lost. Reconnecting...");
        });

        this.socket.on("reconnect", () => {
            console.log("Reconnected to server");
            this.updateConnectionStatus('connected', 'Reconnected');
            this.hideWaitingMessage();
        });

        this.socket.on("connect_error", (error) => {
            console.error("Connection error:", error);
            this.updateConnectionStatus('disconnected', 'Connection Failed');
        });

        this.socket.on("game", (gameCode) => {
            this.elements.gameCode.textContent = gameCode;
            document.getElementById('share-code').textContent = gameCode;
        });

        this.socket.on("isPlayer1", (isPlayer1) => {
            this.state.isPlayer1 = isPlayer1;
            this.elements.player.textContent = isPlayer1 ? 'Player 1' : 'Player 2';
            this.setupPlayerControls();
            
            if (isPlayer1) {
                this.showWaitingMessage("Waiting for Player 2...");
            } else {
                this.hideWaitingMessage();
            }
        });

        this.socket.on("player2IsOn", (player2IsOn) => {
            this.state.player2Connected = player2IsOn;
            
            if (player2IsOn && this.state.isPlayer1) {
                this.hideWaitingMessage();
                if (!this.state.gameStarted) {
                    this.startGame();
                }
            }
        });

        this.socket.on("playerConnected", (data) => {
            console.log(`Player ${data.isPlayer1 ? '1' : '2'} connected`);
            if (data.isPlayer1 && !this.state.isPlayer1) {
                this.hideWaitingMessage();
                if (!this.state.gameStarted) {
                    this.startGame();
                }
            }
        });

        this.socket.on("playerDisconnected", (data) => {
            console.log(`Player ${data.isPlayer1 ? '1' : '2'} disconnected`);
            this.showWaitingMessage("Opponent disconnected. Waiting for reconnection...");
            this.pauseGame();
        });

        this.socket.on("paddle1", (event) => {
            if (!this.state.isPlayer1) {
                this.movePaddle(this.elements.paddle1, event.clientY);
            }
        });

        this.socket.on("paddle2", (event) => {
            if (this.state.isPlayer1) {
                this.movePaddle(this.elements.paddle2, event.clientY);
            }
        });

        this.socket.on("ballUpdate", (data) => {
            this.state.ball.x = data.x;
            this.state.ball.y = data.y;
            this.state.ball.speedX = data.speedX;
            this.state.ball.speedY = data.speedY;
        });

        this.socket.on("scoreUpdate", (data) => {
            this.state.scores.player1 = data.player1;
            this.state.scores.player2 = data.player2;
            this.updateScoreboard();
            
            if (data.player1 >= 5 || data.player2 >= 5) {
                this.endGame(data.player1 >= 5 ? 'Player 1' : 'Player 2');
            }
        });

        this.socket.on("gameReset", () => {
            this.resetGame();
        });
    }

    setupEventListeners() {
        // Restart button
        if (this.elements.restartButton) {
            this.elements.restartButton.addEventListener('click', () => {
                this.restartGame();
            });
        }

        // Window resize
        window.addEventListener('resize', () => {
            this.resetBallPosition();
        });

        // Visibility change (tab switch)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseGame();
            } else {
                this.resumeGame();
            }
        });
    }

    setupPlayerControls() {
        document.addEventListener("mousemove", (e) => {
            if (this.state.gameOver || !this.state.gameStarted) return;

            const paddleToMove = this.state.isPlayer1 ? this.elements.paddle1 : this.elements.paddle2;
            const eventType = this.state.isPlayer1 ? "paddle1" : "paddle2";
            
            this.movePaddle(paddleToMove, e.clientY);
            this.socket.emit(eventType, { clientY: e.clientY });
        });

        // Touch support for mobile devices
        document.addEventListener("touchmove", (e) => {
            if (this.state.gameOver || !this.state.gameStarted) return;
            
            e.preventDefault();
            const touch = e.touches[0];
            const paddleToMove = this.state.isPlayer1 ? this.elements.paddle1 : this.elements.paddle2;
            const eventType = this.state.isPlayer1 ? "paddle1" : "paddle2";
            
            this.movePaddle(paddleToMove, touch.clientY);
            this.socket.emit(eventType, { clientY: touch.clientY });
        });
    }

    movePaddle(paddle, clientY) {
        const gameBoardRect = this.elements.gameBoard.getBoundingClientRect();
        let paddleY = clientY - gameBoardRect.top - paddle.offsetHeight / 2;
        
        // Constrain paddle to game board
        paddleY = Math.max(0, Math.min(paddleY, gameBoardRect.height - paddle.offsetHeight));
        
        paddle.style.top = paddleY + "px";
    }

    startGame() {
        this.state.gameStarted = true;
        this.resetBallPosition();
        this.updateScoreboard();
        this.startGameLoop();
    }

    startGameLoop() {
        this.lastUpdateTime = performance.now();
        this.gameLoop();
    }

    gameLoop(currentTime = performance.now()) {
        if (this.state.gameOver || !this.state.gameStarted) return;

        const deltaTime = currentTime - this.lastUpdateTime;
        
        if (deltaTime > this.frameInterval) {
            this.updateGameState();
            this.render();
            this.lastUpdateTime = currentTime - (deltaTime % this.frameInterval);
        }

        this.animationFrameId = requestAnimationFrame((time) => this.gameLoop(time));
    }

    updateGameState() {
        // Only update ball position if we're player 1 (authoritative client)
        if (this.state.isPlayer1 && this.state.player2Connected) {
            this.updateBallPosition();
        }
    }

    updateBallPosition() {
        let ballX = this.state.ball.x + this.state.ball.speedX;
        let ballY = this.state.ball.y + this.state.ball.speedY;

        // Wall collisions
        if (ballY <= 0 || ballY >= this.elements.gameBoard.offsetHeight - this.elements.ball.offsetHeight) {
            this.state.ball.speedY = -this.state.ball.speedY;
            ballY = ballY <= 0 ? 0 : this.elements.gameBoard.offsetHeight - this.elements.ball.offsetHeight;
        }

        // Paddle collisions
        const paddle1Rect = this.elements.paddle1.getBoundingClientRect();
        const paddle2Rect = this.elements.paddle2.getBoundingClientRect();
        const ballRect = this.elements.ball.getBoundingClientRect();

        if (ballX <= paddle1Rect.width && 
            ballY + this.elements.ball.offsetHeight >= paddle1Rect.top && 
            ballY <= paddle1Rect.bottom) {
            this.state.ball.speedX = Math.abs(this.state.ball.speedX);
            // Add some randomness to ball angle
            this.state.ball.speedY += (Math.random() - 0.5) * 2;
        }

        if (ballX >= this.elements.gameBoard.offsetWidth - paddle2Rect.width - this.elements.ball.offsetWidth && 
            ballY + this.elements.ball.offsetHeight >= paddle2Rect.top && 
            ballY <= paddle2Rect.bottom) {
            this.state.ball.speedX = -Math.abs(this.state.ball.speedX);
            // Add some randomness to ball angle
            this.state.ball.speedY += (Math.random() - 0.5) * 2;
        }

        // Score detection
        if (ballX <= 0) {
            this.state.scores.player2++;
            this.socket.emit("scoreUpdate", this.state.scores);
            this.resetBallPosition();
        } else if (ballX >= this.elements.gameBoard.offsetWidth - this.elements.ball.offsetWidth) {
            this.state.scores.player1++;
            this.socket.emit("scoreUpdate", this.state.scores);
            this.resetBallPosition();
        }

        this.state.ball.x = ballX;
        this.state.ball.y = ballY;

        // Emit ball update to other player
        this.socket.emit("ballUpdate", this.state.ball);
    }

    render() {
        this.elements.ball.style.left = this.state.ball.x + "px";
        this.elements.ball.style.top = this.state.ball.y + "px";
    }

    resetBallPosition() {
        this.state.ball.x = this.elements.gameBoard.offsetWidth / 2 - this.elements.ball.offsetWidth / 2;
        this.state.ball.y = this.elements.gameBoard.offsetHeight / 2 - this.elements.ball.offsetHeight / 2;
        this.state.ball.speedX = this.state.isPlayer1 ? 5 : -5;
        this.state.ball.speedY = (Math.random() - 0.5) * 8;
    }

    updateScoreboard() {
        this.elements.player1ScoreBoard.textContent = this.state.scores.player1;
        this.elements.player2ScoreBoard.textContent = this.state.scores.player2;
    }

    endGame(winner) {
        this.state.gameOver = true;
        this.state.gameStarted = false;
        
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }

        this.elements.winnerMessage.textContent = `${winner} Wins!`;
        this.elements.gameOverScreen.style.display = 'flex';
    }

    restartGame() {
        this.state.scores.player1 = 0;
        this.state.scores.player2 = 0;
        this.state.gameOver = false;
        this.elements.gameOverScreen.style.display = 'none';
        
        this.socket.emit("gameReset");
        this.resetGame();
    }

    resetGame() {
        this.updateScoreboard();
        this.resetBallPosition();
        
        if (this.state.player2Connected) {
            this.startGame();
        }
    }

    pauseGame() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    resumeGame() {
        if (this.state.gameStarted && !this.state.gameOver && !this.animationFrameId) {
            this.startGameLoop();
        }
    }

    updateConnectionStatus(status, message) {
        if (this.elements.connectionStatus) {
            this.elements.connectionStatus.className = `status-indicator ${status}`;
            this.elements.connectionStatus.textContent = message;
        }
    }

    showWaitingMessage(message) {
        if (this.elements.waitingMessage) {
            this.elements.waitingMessage.style.display = 'block';
            if (message) {
                this.elements.waitingMessage.innerHTML = `<h3>${message}</h3>`;
            }
        }
    }

    hideWaitingMessage() {
        if (this.elements.waitingMessage) {
            this.elements.waitingMessage.style.display = 'none';
        }
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.gameManager = new GameManager();
});

// Fallback initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.gameManager = new GameManager();
    });
} else {
    window.gameManager = new GameManager();
}