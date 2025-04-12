// Chess Game Board Setup
let board = null;
let game = new Chess();
let playerColor = 'white';
let computerThinking = false;
let gameActive = false;
let playerTimer = null;
let aiTimer = null;
let gameTime = 10 * 60; // In seconds (10 minutes)
let timeLeft = {
    player: gameTime,
    ai: gameTime
};
let difficulty = 'medium';
let moveHistory = [];
let currentPromotion = null;

// OpenAI API Setup
const OPENAI_API_KEY = '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'; // Add your API key here but remove it from final code
// Unicode Piece Setup
const unicodePieces = {
    'wK': '♔', // White King
    'wQ': '♕', // White Queen
    'wR': '♖', // White Rook
    'wB': '♗', // White Bishop
    'wN': '♘', // White Knight
    'wP': '♙', // White Pawn
    'bK': '♚', // Black King
    'bQ': '♛', // Black Queen
    'bR': '♜', // Black Rook
    'bB': '♝', // Black Bishop
    'bN': '♞', // Black Knight
    'bP': '♟', // Black Pawn
};

// Custom chess piece render function
function customRenderPiece(piece, isLight) {
    if (piece === null) return '';
    
    const pieceType = piece.charAt(0) === 'w' ? 'w' : 'b';
    const pieceCode = unicodePieces[piece];
    const colorClass = pieceType === 'w' ? 'white-piece' : 'black-piece';
    
    return `<span class="chess-piece ${colorClass}">${pieceCode}</span>`;
}
// Initialize chess board
function initializeBoard() {
    const config = {
        draggable: true,
        position: 'start',
        onDragStart: onDragStart,
        onDrop: onDrop,
        onSnapEnd: onSnapEnd,
        pieceTheme: function(piece) {
            // Used if custom rendering doesn't work
            return 'https://chessboardjs.com/img/chesspieces/wikipedia/' + piece + '.png';
        },
        renderPiece: customRenderPiece
    };
    board = Chessboard('board', config);
    updateStatus();
}

// Start game
function startGame() {
    gameActive = true;
    document.getElementById('startBtn').disabled = true;
    document.getElementById('hintBtn').disabled = false;
    document.getElementById('undoBtn').disabled = false;
    clearTimers();
    setupTimers();
    startPlayerTimer();
    updateStatus("Game started. Your turn (white)");
    
    // Send start message to chat
    sendMessageToAI("New game started. I'm playing with white stamps. Any tips for getting started?");
}

// Reset game
function newGame() {
    game = new Chess();
    board.position('start');
    gameActive = false;
    computerThinking = false;
    document.getElementById('startBtn').disabled = false;
    document.getElementById('hintBtn').disabled = true;
    document.getElementById('undoBtn').disabled = true;
    clearTimers();
    document.getElementById('playerTimer').textContent = formatTime(gameTime);
    document.getElementById('aiTimer').textContent = formatTime(gameTime);
    timeLeft.player = gameTime;
    timeLeft.ai = gameTime;
    updateStatus("Ready to start");
    clearMoveHistory();
    
    // Reset chat
    addChatMessage("Hi! I'll help you play chess. I can give you advice and analyze the game.", 'bot');
}

// When starting to drag a piece
function onDragStart(source, piece, position, orientation) {
    // Don't allow piece movement if game is over
    if (game.game_over() || !gameActive) return false;
    
    // Don't allow dragging black pieces (computer)
    if (piece.search(/^b/) !== -1) return false;
    
    // Don't allow dragging if it's not your turn
    if ((game.turn() === 'b' && playerColor === 'white') ||
        (game.turn() === 'w' && playerColor === 'black')) {
        return false;
    }
}

// When dropping a piece
function onDrop(source, target) {
    // Check if move is valid
    const move = game.move({
        from: source,
        to: target,
        promotion: 'q' // Always choose queen for pawn promotion
    });
    
    // If move is invalid
    if (move === null) return 'snapback';
    
    // Check if pawn has reached the end for promotion
    if (move.flags.includes('p')) {
        // Pawn promotion - for simplicity, we automatically choose queen
        // You can add more functionality for promotion choices
    }
    
    // Log the move
    logMove(move);
    
    // Stop player timer and start computer timer
    pausePlayerTimer();
    startAITimer();
    
    // Send move to chat for analysis
    const moveNotation = getMoveNotation(move);
    sendMessageToAI(`I moved: ${moveNotation}. how's this move Analyze it.`);
    
    // Computer's turn
    setTimeout(makeComputerMove, 250);
    
    updateStatus();
}

// After dragging ends, pieces are rearranged
function onSnapEnd() {
    board.position(game.fen());
}

// Create computer move
function makeComputerMove() {
    if (game.game_over() || !gameActive || computerThinking) return;
    
    computerThinking = true;
    
    // Computer move difficulty level
    let depth;
    switch(difficulty) {
        case 'easy': depth = 1; break;
        case 'medium': depth = 2; break;
        case 'hard': depth = 3; break;
        default: depth = 2;
    }
    
    // Computer selects a move
    setTimeout(() => {
        const possibleMoves = game.moves();
        
        // If no moves are available, game is over
        if (possibleMoves.length === 0) {
            computerThinking = false;
            return;
        }
        
        // Find best move
        const computerMove = getBestMove(game, depth);
        
        // Make computer move
        const move = game.move(computerMove);
        
        // Log move
        logMove(move);
        
        // Update chess board
        board.position(game.fen());
        
        // Stop computer timer and start player timer
        pauseAITimer();
        startPlayerTimer();
        
        // Send computer move to chat
        const moveNotation = getMoveNotation(move);
        sendMessageToAI(`The computer moved: ${moveNotation}. Analyze this move and tell me what my best answer is?`);
        
        computerThinking = false;
        updateStatus();
    }, 500);
}

// Select best move for computer
function getBestMove(gameState, depth) {
    // Game state evaluation function
    function evaluateBoard(board) {
        let totalEvaluation = 0;
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                totalEvaluation += getPieceValue(board.board()[i][j], i, j);
            }
        }
        return totalEvaluation;
    }
    
    // Value of each piece
    function getPieceValue(piece, x, y) {
        if (piece === null) return 0;
        
        // Base value for each piece
        const pieceValue = {
            'p': 10,   // Pawn
            'n': 30,   // Knight
            'b': 30,   // Bishop
            'r': 50,   // Rook
            'q': 90,   // Queen
            'k': 900   // King
        };
        
        // Value based on piece type
        const absoluteValue = pieceValue[piece.type];
        
        // If piece belongs to computer (black) value is positive, otherwise negative
        return piece.color === 'b' ? absoluteValue : -absoluteValue;
    }
    
    // Minimax algorithm to find best move
    function minimax(gameState, depth, alpha, beta, isMaximizingPlayer) {
        if (depth === 0 || gameState.game_over()) {
            return evaluateBoard(gameState);
        }
        
        const possibleMoves = gameState.moves();
        
        if (isMaximizingPlayer) {
            let maxEval = -Infinity;
            for (let i = 0; i < possibleMoves.length; i++) {
                gameState.move(possibleMoves[i]);
                const evaluation = minimax(gameState, depth - 1, alpha, beta, false);
                gameState.undo();
                maxEval = Math.max(maxEval, evaluation);
                alpha = Math.max(alpha, evaluation);
                if (beta <= alpha) {
                    break;
                }
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (let i = 0; i < possibleMoves.length; i++) {
                gameState.move(possibleMoves[i]);
                const evaluation = minimax(gameState, depth - 1, alpha, beta, true);
                gameState.undo();
                minEval = Math.min(minEval, evaluation);
                beta = Math.min(beta, evaluation);
                if (beta <= alpha) {
                    break;
                }
            }
            return minEval;
        }
    }
    
    // Find best move using minimax algorithm
    const possibleMoves = gameState.moves();
    let bestMove = null;
    let bestEvaluation = -Infinity;
    
    for (let i = 0; i < possibleMoves.length; i++) {
        gameState.move(possibleMoves[i]);
        
        // Evaluate move
        const evaluation = minimax(gameState, depth - 1, -Infinity, Infinity, false);
        
        gameState.undo();
        
        // If move is better than previous
        if (evaluation > bestEvaluation) {
            bestEvaluation = evaluation;
            bestMove = possibleMoves[i];
        }
    }
    
    return bestMove;
}

// Update game status
function updateStatus(message) {
    const statusElement = document.getElementById('status');
    
    if (message) {
        statusElement.textContent = message;
        return;
    }
    
    let status = '';
    
    if (game.in_checkmate()) {
        status = game.turn() === 'w' ? 'Game over! You lost.' : 'Congratulations! You won!';
        showGameOverModal(status);
        updateScores(game.turn() !== 'w');
        gameActive = false;
        clearTimers();
    } else if (game.in_draw()) {
        status = 'Game finished! Draw.';
        showGameOverModal(status);
        gameActive = false;
        clearTimers();
    } else {
        status = game.turn() === 'w' ? 'Your turn (white)' : 'Computer\'s turn (black)';
        
        if (game.in_check()) {
            status += ' - Check!';
        }
    }
    
    statusElement.textContent = status;
}

// Show game over modal
function showGameOverModal(message) {
    const modal = document.getElementById('gameOverModal');
    const modalText = document.getElementById('modalText');
    
    modalText.textContent = message;
    modal.style.display = 'flex';
}

// Update scores
function updateScores(playerWon) {
    if (playerWon) {
        document.getElementById('playerScore').textContent = 
            parseInt(document.getElementById('playerScore').textContent) + 1;
            
        // Update score based on difficulty level
        const levelScore = document.getElementById(`${difficulty}Score`);
        levelScore.textContent = parseInt(levelScore.textContent) + 1;
    } else {
        document.getElementById('aiScore').textContent = 
            parseInt(document.getElementById('aiScore').textContent) + 1;
    }
}

// Log moves
function logMove(move) {
    const moveNumber = Math.floor((game.history().length - 1) / 2) + 1;
    const isWhiteMove = game.history().length % 2 === 1;
    const formattedMove = getMoveNotation(move);
    
    moveHistory.push({
        number: moveNumber,
        move: formattedMove,
        color: isWhiteMove ? 'white' : 'black'
    });
    
    displayMoveHistory();
}

// Convert move to standard chess notation
function getMoveNotation(move) {
    let notation = '';
    
    // Check if checkmate or check
    if (game.in_checkmate()) {
        notation = move.san + '#';
    } else if (game.in_check()) {
        notation = move.san + '+';
    } else {
        notation = move.san;
    }
    
    return notation;
}

// Display move history
function displayMoveHistory() {
    const historyElement = document.getElementById('moveHistory');
    historyElement.innerHTML = '';
    
    let currentRow = null;
    
    moveHistory.forEach((historyItem, index) => {
        if (index % 2 === 0) {
            // Create new row for each pair of moves (white and black)
            currentRow = document.createElement('li');
            currentRow.className = 'move-row';
            currentRow.innerHTML = `<span class="move-number">${historyItem.number}.</span> <span class="white-move">${historyItem.move}</span>`;
            historyElement.appendChild(currentRow);
        } else {
            // Add black move to current row
            const blackMove = document.createElement('span');
            blackMove.className = 'black-move';
            blackMove.textContent = historyItem.move;
            currentRow.appendChild(blackMove);
        }
    });
    
    // Scroll to end of move history
    historyElement.scrollTop = historyElement.scrollHeight;
}

// Clear move history
function clearMoveHistory() {
    moveHistory = [];
    document.getElementById('moveHistory').innerHTML = '';
}

// Set up timers
function setupTimers() {
    timeLeft.player = gameTime;
    timeLeft.ai = gameTime;
    document.getElementById('playerTimer').textContent = formatTime(timeLeft.player);
    document.getElementById('aiTimer').textContent = formatTime(timeLeft.ai);
}

// Format time
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}

// Start player timer
function startPlayerTimer() {
    if (!gameActive) return;
    
    clearInterval(playerTimer);
    playerTimer = setInterval(() => {
        timeLeft.player--;
        document.getElementById('playerTimer').textContent = formatTime(timeLeft.player);
        
        if (timeLeft.player <= 0) {
            clearInterval(playerTimer);
            updateStatus("Time's up! You lost.");
            showGameOverModal("Time's up! You lost.");
            updateScores(false);
            gameActive = false;
        }
    }, 1000);
}

// Pause player timer
function pausePlayerTimer() {
    clearInterval(playerTimer);
}

// Start computer timer
function startAITimer() {
    if (!gameActive) return;
    
    clearInterval(aiTimer);
    aiTimer = setInterval(() => {
        timeLeft.ai--;
        document.getElementById('aiTimer').textContent = formatTime(timeLeft.ai);
        
        if (timeLeft.ai <= 0) {
            clearInterval(aiTimer);
            updateStatus("Time's up! You won.");
            showGameOverModal("Time's up! You won.");
            updateScores(true);
            gameActive = false;
        }
    }, 1000);
}

// Pause computer timer
function pauseAITimer() {
    clearInterval(aiTimer);
}

// Clear all timers
function clearTimers() {
    clearInterval(playerTimer);
    clearInterval(aiTimer);
}

// Show best move hint
function showHint() {
    if (!gameActive) return;
    
    // Find best move for player
    const bestMove = getBestMove(game, 2);
    const hintMove = game.move(bestMove);
    
    // Show move on board
    board.position(game.fen());
    
    // Return to previous state
    setTimeout(() => {
        game.undo();
        board.position(game.fen());
        
        // Send move to chat
        sendMessageToAI(`Best move in this situation: ${getMoveNotation(hintMove)}. Why is this move good?`);
    }, 1000);
}

// Undo move
function undoMove() {
    if (!gameActive || game.history().length < 2) return;
    
    // Go back two moves (player and computer)
    game.undo(); // Undo computer move
    game.undo(); // Undo player move
    
    // Update board
    board.position(game.fen());
    
    // Update move history
    moveHistory.pop();
    moveHistory.pop();
    displayMoveHistory();
    
    // Update game status
    updateStatus();
    
    // Send message to chat
    sendMessageToAI("Last two moves back. What advice do you have in this situation?");
}

// Add message to chat
function addChatMessage(message, sender) {
    const messagesContainer = document.getElementById('chatMessages');
    const messageElement = document.createElement('div');
    messageElement.className = `chat-message ${sender}-message`;
    messageElement.textContent = message;
    messagesContainer.appendChild(messageElement);
    
    // Scroll to end of chat
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Send message to OpenAI API
async function sendMessageToAI(message) {
    // Add player message to chat
    addChatMessage(message, 'user');
    
    // Show loader
    document.getElementById('chatLoader').style.display = 'block';
    
    try {
        // This part should be changed to send message to OpenAI API
        // This is an example
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        "role": "system",
                        "content": "You are an expert in chess. Card is about analyzing moves, suggesting the best move and helping the player. The player plays with white stamps and plays against a computer that uses black stamps. Keep your answers short and easy to understand."
                    },
                    {
                        "role": "user",
                        "content": message
                    }
                ],
                max_tokens: 150
            })
        });
        
        const data = await response.json();
        
        // Get response from API
        const aiResponse = data.choices[0].message.content;
        
        // Add AI response to chat
        addChatMessage(aiResponse, 'bot');
    } catch (error) {
        console.error('Error connecting to OpenAI API:', error);
        addChatMessage("Sorry, there's an error connecting to the chess analyzer. Please try again later.", 'bot');
    }
    
    // Hide loader
    document.getElementById('chatLoader').style.display = 'none';
}

// Time selection events
document.querySelectorAll('.time-btn').forEach(button => {
    button.addEventListener('click', () => {
        // Remove active from all buttons
        document.querySelectorAll('.time-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Add active to selected button
        button.classList.add('active');
        
        // Select time
        const minutes = parseInt(button.getAttribute('data-time'));
        gameTime = minutes * 60;
        
        // Update time display
        document.getElementById('playerTimer').textContent = formatTime(gameTime);
        document.getElementById('aiTimer').textContent = formatTime(gameTime);
        
        // Update time left
        timeLeft.player = gameTime;
        timeLeft.ai = gameTime;
    });
});

// Event for starting new game after closing game over modal
window.addEventListener('click', (e) => {
    const modal = document.getElementById('gameOverModal');
    if (e.target === modal) {
        modal.style.display = 'none';
        newGame();
    }
});

// Pawn promotion event (you can expand this in the future)
function handlePromotion(source, target) {
    // Add pawn promotion code here
    // For now, we simply choose queen
    return 'q'; // q for queen
}

// Start game when page loads
document.addEventListener('DOMContentLoaded', () => {
    initializeBoard();
    newGame();
});
document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('newGameBtn').addEventListener('click', newGame);
document.getElementById('hintBtn').addEventListener('click', showHint);
document.getElementById('undoBtn').addEventListener('click', undoMove);
document.getElementById('newGameModalBtn').addEventListener('click', () => {
    document.getElementById('gameOverModal').style.display = 'none';
    newGame();
});

// Event for sending message in chat
document.getElementById('sendBtn').addEventListener('click', () => {
    const chatInput = document.getElementById('chatInput');
    const message = chatInput.value.trim();
    
    if (message) {
        sendMessageToAI(message);
        chatInput.value = '';
    }
});

// Event for sending message with Enter key
document.getElementById('chatInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const chatInput = document.getElementById('chatInput');
        const message = chatInput.value.trim();
        
        if (message) {
            sendMessageToAI(message);
            chatInput.value = '';
        }
    }
});

// Difficulty level selection events
document.querySelectorAll('.difficulty-btn').forEach(button => {
    button.addEventListener('click', () => {
        // Remove active from all buttons
        document.querySelectorAll('.difficulty-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Add active to selected button
        button.classList.add('active');
        
        // Select difficulty level
        difficulty = button.getAttribute('data-level');
    });
});

// Dark mode management
function toggleDarkMode() {
    const body = document.body;
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = themeToggle.querySelector('i');
    
    // Toggle mode
    body.classList.toggle('dark-mode');
    
    // Change icon
    if (body.classList.contains('dark-mode')) {
        themeIcon.className = 'fas fa-sun';
        localStorage.setItem('theme', 'dark');
    } else {
        themeIcon.className = 'fas fa-moon';
        localStorage.setItem('theme', 'light');
    }
    
    // Update chess board
    if (board) {
        // Save current position
        const currentPosition = board.position();
        
        // Recreate chess board
        board = Chessboard('board', config);
        board.position(currentPosition);
    }
}
// Load saved theme
function loadSavedTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        document.getElementById('themeToggle').querySelector('i').className = 'fas fa-sun';
    }
}

// Events for dark mode
document.addEventListener('DOMContentLoaded', (event) => {
    // Load saved theme
    loadSavedTheme();
    
    // Click event for mode change button
    document.getElementById('themeToggle').addEventListener('click', toggleDarkMode);
});
