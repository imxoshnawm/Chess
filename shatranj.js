// بەکارهێنانی دەستەی یاری شەتڕەنج
let board = null;
let game = new Chess();
let playerColor = 'white';
let computerThinking = false;
let gameActive = false;
let playerTimer = null;
let aiTimer = null;
let gameTime = 10 * 60; // بە چرکە (10 خولەک)
let timeLeft = {
    player: gameTime,
    ai: gameTime
};
let difficulty = 'medium';
let moveHistory = [];
let currentPromotion = null;

// دامەزراندنی API بۆ OpenAI
const OPENAI_API_KEY = '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'; // لێرە API کلیلی خۆت دابنێ بەڵام لە کۆدی کۆتاییدا نەیهێڵە

// دامەزراندنی تەختەی شەتڕەنج
function initializeBoard() {
    const config = {
        draggable: true,
        position: 'start',
        onDragStart: onDragStart,
        onDrop: onDrop,
        onSnapEnd: onSnapEnd,
        pieceTheme: 'https://cdnjs.cloudflare.com/ajax/libs/chessboard-js/1.0.0/img/chesspieces/wikipedia/{piece}.png'
    };
    board = Chessboard('board', config);
    updateStatus();
}

// دەستپێکردنی یاری
function startGame() {
    gameActive = true;
    document.getElementById('startBtn').disabled = true;
    document.getElementById('hintBtn').disabled = false;
    document.getElementById('undoBtn').disabled = false;
    clearTimers();
    setupTimers();
    startPlayerTimer();
    updateStatus("یاری دەستیپێکرد. نۆرەی تۆیە (سپی)");
    
    // ناردنی پەیامی دەستپێکردن بۆ چات
    sendMessageToAI("New game started. I'm playing with white stamps. Any tips for getting started?");
}

// نوێکردنەوەی یاری
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
    updateStatus("ئامادە بۆ دەستپێکردن");
    clearMoveHistory();
    
    // دەستپێکردنەوەی چات
    addChatMessage("Hi! I'll help you play chess. I can give you advice and analyze the game.", 'bot');
}

// کاتێک دەست بە ڕاکێشانی مۆرە دەکەیت
function onDragStart(source, piece, position, orientation) {
    // ڕێگە نەدان بە جوڵاندنی مۆرە ئەگەر یاری کۆتایی هاتبێت
    if (game.game_over() || !gameActive) return false;
    
    // ڕێگە نەدان بە جوڵاندنی مۆرەی ڕەش (کۆمپیوتەر)
    if (piece.search(/^b/) !== -1) return false;
    
    // ڕێگە نەدان بە جوڵاندنی مۆرە ئەگەر نۆرەی تۆ نەبێت
    if ((game.turn() === 'b' && playerColor === 'white') ||
        (game.turn() === 'w' && playerColor === 'black')) {
        return false;
    }
}

// کاتێک مۆرەکە دادەنێیت
function onDrop(source, target) {
    // بزانە جوڵەکە دروستە یان نا
    const move = game.move({
        from: source,
        to: target,
        promotion: 'q' // هەمیشە وەزیر هەڵبژێرە بۆ بەرزکردنەوەی سەرباز
    });
    
    // ئەگەر جوڵە دروست نەبێت
    if (move === null) return 'snapback';
    
    // بزانە ئایا سەربازەکە گەیشتۆتە ئاخری خانەکان بۆ بەرزکردنەوە
    if (move.flags.includes('p')) {
        // بەرزکردنەوەی سەرباز - بە شێوەیەکی ئاسان وەزیر هەڵدەبژێرین
        // دەتوانیت کاری زیاتر زیاد بکەیت بۆ هەڵبژاردنی جۆری بەرزکردنەوە
    }
    
    // تۆمارکردنی جوڵە
    logMove(move);
    
    // ڕاگرتنی کاتژمێری یاریزان و دەستپێکردنی کاتژمێری کۆمپیوتەر
    pausePlayerTimer();
    startAITimer();
    
    // ناردنی جوڵەکە بۆ چات بۆ شیکردنەوە
    const moveNotation = getMoveNotation(move);
    sendMessageToAI(`I moved: ${moveNotation}. how's this move Analyze it.`);
    
    // نۆرەی کۆمپیوتەر
    setTimeout(makeComputerMove, 250);
    
    updateStatus();
}

// دوای تەواوبوونی ڕاکێشان مۆرەکان ڕێکدەخاتەوە
function onSnapEnd() {
    board.position(game.fen());
}

// دروستکردنی جوڵەی کۆمپیوتەر
function makeComputerMove() {
    if (game.game_over() || !gameActive || computerThinking) return;
    
    computerThinking = true;
    
    // ئاستی سەختی جوڵەی کۆمپیوتەر
    let depth;
    switch(difficulty) {
        case 'easy': depth = 1; break;
        case 'medium': depth = 2; break;
        case 'hard': depth = 3; break;
        default: depth = 2;
    }
    
    // کۆمپیوتەر جوڵەیەک هەڵدەبژێرێت
    setTimeout(() => {
        const possibleMoves = game.moves();
        
        // ئەگەر هیچ جوڵەیەک نەبێت، واتە یاری کۆتایی هاتووە
        if (possibleMoves.length === 0) {
            computerThinking = false;
            return;
        }
        
        // دۆزینەوەی باشترین جوڵە
        const computerMove = getBestMove(game, depth);
        
        // ئەنجامدانی جوڵەی کۆمپیوتەر
        const move = game.move(computerMove);
        
        // تۆمارکردنی جوڵە
        logMove(move);
        
        // نوێکردنەوەی تەختەی شەتڕەنج
        board.position(game.fen());
        
        // ڕاگرتنی کاتژمێری کۆمپیوتەر و دەستپێکردنی کاتژمێری یاریزان
        pauseAITimer();
        startPlayerTimer();
        
        // ناردنی جوڵەی کۆمپیوتەر بۆ چات
        const moveNotation = getMoveNotation(move);
        sendMessageToAI(`The computer moved: ${moveNotation}. Analyze this move and tell me what my best answer is?`);
        
        computerThinking = false;
        updateStatus();
    }, 500);
}

// هەڵبژاردنی باشترین جوڵە بۆ کۆمپیوتەر
function getBestMove(gameState, depth) {
    // پێوەری هەڵسەنگاندنی دۆخی یاری (دەتوانیت پەرەی پێبدەیت)
    function evaluateBoard(board) {
        let totalEvaluation = 0;
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                totalEvaluation += getPieceValue(board.board()[i][j], i, j);
            }
        }
        return totalEvaluation;
    }
    
    // نرخی هەر مۆرەیەک
    function getPieceValue(piece, x, y) {
        if (piece === null) return 0;
        
        // نرخی سەرەتایی بۆ هەر مۆرەیەک
        const pieceValue = {
            'p': 10,   // سەرباز
            'n': 30,   // ئەسپ
            'b': 30,   // فیل
            'r': 50,   // قەڵا
            'q': 90,   // وەزیر
            'k': 900   // شا
        };
        
        // نرخ بە پێی جۆری مۆرە
        const absoluteValue = pieceValue[piece.type];
        
        // ئەگەر مۆرە هی کۆمپیوتەر بێت (ڕەش) ئەوا نرخەکە ئەرێنییە، ئەگەر نا نرخەکە نەرێنییە
        return piece.color === 'b' ? absoluteValue : -absoluteValue;
    }
    
    // ئەلگۆریتمی مینیماکس بۆ دۆزینەوەی باشترین جوڵە
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
    
    // دۆزینەوەی باشترین جوڵە بە ئەلگۆریتمی مینیماکس
    const possibleMoves = gameState.moves();
    let bestMove = null;
    let bestEvaluation = -Infinity;
    
    for (let i = 0; i < possibleMoves.length; i++) {
        gameState.move(possibleMoves[i]);
        
        // هەڵسەنگاندنی جوڵە
        const evaluation = minimax(gameState, depth - 1, -Infinity, Infinity, false);
        
        gameState.undo();
        
        // ئەگەر جوڵەکە باشتر بێت لەوەی پێشوو
        if (evaluation > bestEvaluation) {
            bestEvaluation = evaluation;
            bestMove = possibleMoves[i];
        }
    }
    
    return bestMove;
}

// نوێکردنەوەی حاڵەتی یاری
function updateStatus(message) {
    const statusElement = document.getElementById('status');
    
    if (message) {
        statusElement.textContent = message;
        return;
    }
    
    let status = '';
    
    if (game.in_checkmate()) {
        status = game.turn() === 'w' ? 'کۆتایی یاری! تۆ دۆڕایت.' : 'پیرۆزە! تۆ بردتەوە!';
        showGameOverModal(status);
        updateScores(game.turn() !== 'w');
        gameActive = false;
        clearTimers();
    } else if (game.in_draw()) {
        status = 'یاری تەواوبوو! یەکسانی.';
        showGameOverModal(status);
        gameActive = false;
        clearTimers();
    } else {
        status = game.turn() === 'w' ? 'نۆرەی تۆیە (سپی)' : 'نۆرەی کۆمپیوتەرە (ڕەش)';
        
        if (game.in_check()) {
            status += ' - کش!';
        }
    }
    
    statusElement.textContent = status;
}

// نیشاندانی فۆرمی کۆتایی یاری
function showGameOverModal(message) {
    const modal = document.getElementById('gameOverModal');
    const modalText = document.getElementById('modalText');
    
    modalText.textContent = message;
    modal.style.display = 'flex';
}

// نوێکردنەوەی خاڵەکان
function updateScores(playerWon) {
    if (playerWon) {
        document.getElementById('playerScore').textContent = 
            parseInt(document.getElementById('playerScore').textContent) + 1;
            
        // نوێکردنەوەی خاڵ بە پێی ئاستی سەختی
        const levelScore = document.getElementById(`${difficulty}Score`);
        levelScore.textContent = parseInt(levelScore.textContent) + 1;
    } else {
        document.getElementById('aiScore').textContent = 
            parseInt(document.getElementById('aiScore').textContent) + 1;
    }
}

// تۆمارکردنی جوڵەکان
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

// وەرگێڕانی جوڵە بۆ فۆڕماتی ستانداردی شەتڕەنج
function getMoveNotation(move) {
    let notation = '';
    
    // ئایا کیش یان ماتە
    if (game.in_checkmate()) {
        notation = move.san + '#';
    } else if (game.in_check()) {
        notation = move.san + '+';
    } else {
        notation = move.san;
    }
    
    return notation;
}

// نیشاندانی مێژووی جوڵەکان
function displayMoveHistory() {
    const historyElement = document.getElementById('moveHistory');
    historyElement.innerHTML = '';
    
    let currentRow = null;
    
    moveHistory.forEach((historyItem, index) => {
        if (index % 2 === 0) {
            // دروستکردنی ڕیزی نوێ بۆ هەر دوو جوڵە (سپی و ڕەش)
            currentRow = document.createElement('li');
            currentRow.className = 'move-row';
            currentRow.innerHTML = `<span class="move-number">${historyItem.number}.</span> <span class="white-move">${historyItem.move}</span>`;
            historyElement.appendChild(currentRow);
        } else {
            // زیادکردنی جوڵەی ڕەش بۆ ڕیزی ئێستا
            const blackMove = document.createElement('span');
            blackMove.className = 'black-move';
            blackMove.textContent = historyItem.move;
            currentRow.appendChild(blackMove);
        }
    });
    
    // سکرۆڵکردن بۆ کۆتایی مێژووی جوڵەکان
    historyElement.scrollTop = historyElement.scrollHeight;
}

// پاککردنەوەی مێژووی جوڵەکان
function clearMoveHistory() {
    moveHistory = [];
    document.getElementById('moveHistory').innerHTML = '';
}

// دامەزراندنی کاتژمێرەکان
function setupTimers() {
    timeLeft.player = gameTime;
    timeLeft.ai = gameTime;
    document.getElementById('playerTimer').textContent = formatTime(timeLeft.player);
    document.getElementById('aiTimer').textContent = formatTime(timeLeft.ai);
}

// فۆڕماتکردنی کات
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}

// دەستپێکردنی کاتژمێری یاریزان
function startPlayerTimer() {
    if (!gameActive) return;
    
    clearInterval(playerTimer);
    playerTimer = setInterval(() => {
        timeLeft.player--;
        document.getElementById('playerTimer').textContent = formatTime(timeLeft.player);
        
        if (timeLeft.player <= 0) {
            clearInterval(playerTimer);
            updateStatus("کات تەواوبوو! تۆ دۆڕایت.");
            showGameOverModal("کات تەواوبوو! تۆ دۆڕایت.");
            updateScores(false);
            gameActive = false;
        }
    }, 1000);
}

// ڕاگرتنی کاتژمێری یاریزان
function pausePlayerTimer() {
    clearInterval(playerTimer);
}

// دەستپێکردنی کاتژمێری کۆمپیوتەر
function startAITimer() {
    if (!gameActive) return;
    
    clearInterval(aiTimer);
    aiTimer = setInterval(() => {
        timeLeft.ai--;
        document.getElementById('aiTimer').textContent = formatTime(timeLeft.ai);
        
        if (timeLeft.ai <= 0) {
            clearInterval(aiTimer);
            updateStatus("کات تەواوبوو! تۆ بردتەوە.");
            showGameOverModal("کات تەواوبوو! تۆ بردتەوە.");
            updateScores(true);
            gameActive = false;
        }
    }, 1000);
}

// ڕاگرتنی کاتژمێری کۆمپیوتەر
function pauseAITimer() {
    clearInterval(aiTimer);
}

// پاککردنەوەی هەموو کاتژمێرەکان
function clearTimers() {
    clearInterval(playerTimer);
    clearInterval(aiTimer);
}

// پیشاندانی باشترین جوڵە
function showHint() {
    if (!gameActive) return;
    
    // دۆزینەوەی باشترین جوڵە بۆ یاریزان
    const bestMove = getBestMove(game, 2);
    const hintMove = game.move(bestMove);
    
    // پیشاندانی جوڵە لەسەر تەختە
    board.position(game.fen());
    
    // گەڕانەوە بۆ دۆخی پێشوو
    setTimeout(() => {
        game.undo();
        board.position(game.fen());
        
        // ناردنی جوڵەکە بۆ چات
        sendMessageToAI(`Best move in this situation: ${getMoveNotation(hintMove)}. Why is this move good?`);
    }, 1000);
}

// گەڕانەوە بۆ دواوە
function undoMove() {
    if (!gameActive || game.history().length < 2) return;
    
    // گەڕانەوە بۆ دوو جوڵە پێشوو (جوڵەی یاریزان و کۆمپیوتەر)
    game.undo(); // گەڕانەوە لە جوڵەی کۆمپیوتەر
    game.undo(); // گەڕانەوە لە جوڵەی یاریزان
    
    // نوێکردنەوەی تەختە
    board.position(game.fen());
    
    // نوێکردنەوەی مێژووی جوڵەکان
    moveHistory.pop();
    moveHistory.pop();
    displayMoveHistory();
    
    // نوێکردنەوەی حاڵەتی یاری
    updateStatus();
    
    // ناردنی پەیام بۆ چات
    sendMessageToAI("Last two moves back. What advice do you have in this situation?");
}

// زیادکردنی پەیام بۆ چات
function addChatMessage(message, sender) {
    const messagesContainer = document.getElementById('chatMessages');
    const messageElement = document.createElement('div');
    messageElement.className = `chat-message ${sender}-message`;
    messageElement.textContent = message;
    messagesContainer.appendChild(messageElement);
    
    // سکرۆڵکردن بۆ کۆتایی چات
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ناردنی پەیام بۆ OpenAI API
async function sendMessageToAI(message) {
    // زیادکردنی پەیامی یاریزان بۆ چات
    addChatMessage(message, 'user');
    
    // نیشاندانی لۆدەر
    document.getElementById('chatLoader').style.display = 'block';
    
    try {
        // ئەو بەشە دەبێت بگۆڕدرێت بە ناردنی پەیام بۆ OpenAI API
        // ئەمە نموونەیەکە
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
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
        
        // وەرگرتنی وەڵام لە API
        const aiResponse = data.choices[0].message.content;
        
        // زیادکردنی وەڵامی AI بۆ چات
        addChatMessage(aiResponse, 'bot');
    } catch (error) {
        console.error('هەڵە لە پەیوەندیکردن بە OpenAI API:', error);
        addChatMessage("ببورە، هەڵەیەک هەیە لە پەیوەندیکردن بە شیکارکەری شەتڕەنج. تکایە دواتر هەوڵ بدەرەوە.", 'bot');
    }
    
    // شاردنەوەی لۆدەر
    document.getElementById('chatLoader').style.display = 'none';
}

// ڕووداوەکانی هەڵبژاردنی کات
document.querySelectorAll('.time-btn').forEach(button => {
    button.addEventListener('click', () => {
        // لابردنی چالاکی لە هەموو دوگمەکان
        document.querySelectorAll('.time-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // زیادکردنی چالاکی بۆ دوگمەی هەڵبژێردراو
        button.classList.add('active');
        
        // هەڵبژاردنی کات
        const minutes = parseInt(button.getAttribute('data-time'));
        gameTime = minutes * 60;
        
        // نوێکردنەوەی نیشاندانی کات
        document.getElementById('playerTimer').textContent = formatTime(gameTime);
        document.getElementById('aiTimer').textContent = formatTime(gameTime);
        
        // نوێکردنەوەی کاتی ماوە
        timeLeft.player = gameTime;
        timeLeft.ai = gameTime;
    });
});

// ڕووداوی دەستکردن بە یاری نوێ دوای داخستنی نافیزەی کۆتایی یاری
window.addEventListener('click', (e) => {
    const modal = document.getElementById('gameOverModal');
    if (e.target === modal) {
        modal.style.display = 'none';
        newGame();
    }
});

// ڕووداوی بەرزکردنەوەی سەرباز (دەتوانیت پەرەی پێبدەیت لە داهاتوودا)
function handlePromotion(source, target) {
    // پێویستە کۆدی بەرزکردنەوەی سەرباز لێرە زیاد بکەیت
    // بۆ ئێستا، بە شێوەیەکی ئاسان وەزیر هەڵدەبژێرین
    return 'q'; // q بۆ وەزیر
}

// دەستکردن بە یاری کاتێک ماڵپەڕ دەکرێتەوە
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

// ڕووداوی ناردنی پەیام لە چات
document.getElementById('sendBtn').addEventListener('click', () => {
    const chatInput = document.getElementById('chatInput');
    const message = chatInput.value.trim();
    
    if (message) {
        sendMessageToAI(message);
        chatInput.value = '';
    }
});

// ڕووداوی ناردنی پەیام بە کلیلی Enter
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

// ڕووداوەکانی هەڵبژاردنی ئاستی سەختی
document.querySelectorAll('.difficulty-btn').forEach(button => {
    button.addEventListener('click', () => {
        // لابردنی چالاکی لە هەموو دوگمەکان
        document.querySelectorAll('.difficulty-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // زیادکردنی چالاکی بۆ دوگمەی هەڵبژێردراو
        button.classList.add('active');
        
        // هەڵبژاردنی ئاستی سەختی
        difficulty = button.getAttribute('data-level');
    });
});

// ڕووداوە
