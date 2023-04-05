// INDEX
const game = prompt('Press "OK" to new game or type the Game Code:');

const api = `//${window.location.hostname}:3000`;

const socket = io(`${api}`, {
  query: { game },
});

socket.on("connect", () => {
  console.log("Connected to server");
});

socket.on("game", (game) => {
  const gameDiv = document.getElementById("game");
  gameDiv.innerHTML = game;
});

// Variables
let ball = document.getElementById("ball");
let paddle1 = document.getElementById("paddle1");
let paddle2 = document.getElementById("paddle2");
let gameBoard = document.getElementById("game-board");
let player = document.getElementById("player");
let ballSpeed = 5;
let ballXSpeed = ballSpeed;
let ballYSpeed = ballSpeed;
let player1Score = 0;
let player2Score = 0;
let gameOver = false;

let player1ScoreBoard = document.getElementById("player1ScoreBoard");
let player2ScoreBoard = document.getElementById("player2ScoreBoard");

// Ball movement
function moveBall() {

  let ballX = parseInt(ball.style.left) + ballXSpeed;
  let ballY = parseInt(ball.style.top) + ballYSpeed;

 console.log(ballY <= 0 || ballY >= gameBoard.offsetHeight - ball.offsetHeight)
  // Check for collisions with game board walls
  if (ballY <= 0 || ballY >= gameBoard.offsetHeight - ball.offsetHeight) {
    ballYSpeed = -ballYSpeed;
  }

  // Check for collisions with paddles
  if (
    ballX <= paddle1.offsetWidth &&
    ballY >= paddle1.offsetTop &&
    ballY <= paddle1.offsetTop + paddle1.offsetHeight
  ) {
    ballXSpeed = ballSpeed;
  }

  if (
    ballX >= gameBoard.offsetWidth - paddle2.offsetWidth - ball.offsetWidth &&
    ballY >= paddle2.offsetTop &&
    ballY <= paddle2.offsetTop + paddle2.offsetHeight
  ) {
    ballXSpeed = -ballSpeed;
  }

  // Check for missed ball
  if (ballX <= 0 || ballX >= gameBoard.offsetWidth - ball.offsetWidth) {
    if (ballX <= 0) {
      player2Score++;
    } else {
      player1Score++;
    }
    resetBall();
  }

  // Update ball position
  ball.style.top = ballY + "px";
  ball.style.left = ballX + "px";

  // Check for game over
  if (gameOver) {
    if (player1Score === 5) {
      alert("Player 1 wins!");
    } else if (player2Score === 5) {
      alert("Player 2 wins!");
    }
  } else {
    window.requestAnimationFrame(moveBall);
  }
}

// Reset ball to center of game board
function resetBall() {
  ball.style.top = gameBoard.offsetHeight / 2 - ball.offsetHeight / 2 + "px";
  ball.style.left = gameBoard.offsetWidth / 2 - ball.offsetWidth / 2 + "px";
  ballXSpeed = ballSpeed;
  ballYSpeed = ballSpeed;
  player1ScoreBoard.innerHTML = player1Score;
  player2ScoreBoard.innerHTML = player2Score;
  gameOver = player1Score === 5 || player2Score === 5;
}

// Paddle movement
function movePaddle1(event) {
  let paddleY = event.clientY - gameBoard.offsetTop - paddle1.offsetHeight / 2;
  if (paddleY < 0) {
    paddleY = 0;
  } else if (paddleY > gameBoard.offsetHeight - paddle1.offsetHeight) {
    paddleY = gameBoard.offsetHeight - paddle1.offsetHeight;
  }
  paddle1.style.top = paddleY + "px";
}

function movePaddle2(event) {
  let paddleY = event.clientY - gameBoard.offsetTop - paddle2.offsetHeight / 2;
  if (paddleY < 0) {
    paddleY = 0;
  } else if (paddleY > gameBoard.offsetHeight - paddle2.offsetHeight) {
    paddleY = gameBoard.offsetHeight - paddle2.offsetHeight;
  }
  paddle2.style.top = paddleY + "px";
}

// Event listeners
socket.on("player2IsOn", (player2IsOn) => {
  if(player2IsOn){
    setTimeout('', 5000);
    resetBall();
    moveBall();
  }
});

socket.on("isPlayer1", (isPlayer1) => {

  
  if (isPlayer1) {
    player.innerHTML = 'Player 1'

    document.addEventListener("mousemove", (e) => {
      movePaddle1(e);
      socket.emit("paddle1", {
        clientY: e.clientY,
      });
    });

    socket.on("paddle2", (event) => {
      movePaddle2(event);
    });
  }

  if (!isPlayer1) {
    player.innerHTML = 'Player 2'

    document.addEventListener("mousemove", (e) => {
      movePaddle2(e);
      socket.emit("paddle2", {
        clientY: e.clientY,
      });
    });

    socket.on("paddle1", (event) => {
      movePaddle1(event);
    });
  }
});



//

// socket.on("paddle1", (event) => {
//   movePaddle1(event);
// });


// socket.on("paddle2", (event) => {
//   movePaddle2(event);
// });


// Start game
// resetBall();

