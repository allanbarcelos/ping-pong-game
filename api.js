const express = require("express");
const http = require("http");
const socketio = require("socket.io");
var cors = require("cors");
const app = express();

app.use(
  cors({
    origin: "*",
  })
);

const server = http.createServer(app);
const io = socketio(server, {
  cors: {
    origin: "*",
  },
});

app.use(express.json());

io.use((socket, next) => {
  try {
    socket.game = socket.handshake.query.game;
    socket.isPlayer1 = false;
    socket.player2IsOn = false;
    if (!socket.game) {
      socket.game = makeid(8);
      socket.isPlayer1 = true;
    }else {
        socket.player2IsOn = true;
        console.log('Player 2');
    }
    next();
  } catch (err) {
    next(new Error("Connection"));
  }
});

io.on("connection", (socket) => {
  socket.join(socket.game);

  io.to(socket.game).emit("game", socket.game);
  io.to(socket.id).emit("isPlayer1", socket.isPlayer1);
  io.to(socket.game).emit("player2IsOn", socket.player2IsOn);

  socket.on("paddle1", (event) => {
    // console.log(`paddle1 ${event.clientY}`);
    io.to(socket.game).emit("paddle1", event);
  });

  socket.on("paddle2", (event) => {
    // console.log(`paddle2 ${event.clientY}`);
    io.to(socket.game).emit("paddle2", event);
  });

  socket.on("disconnect", () => {
    console.log(`${socket.client.id} disconnected`);
  });
});

(async () => {
  server.listen(3000, () => {
    console.log(`Server listening on port 3000`);
  });
})();

function makeid(length) {
  let result = "";
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}

module.exports = app;
