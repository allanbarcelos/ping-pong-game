const express = require("express");
const http = require("http");
const socketio = require("socket.io");
const redis = require("redis");
const cors = require("cors");

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

// Configuração do Redis
const redisClient = redis.createClient({
  host: 'localhost',
  port: 6379
});

redisClient.on('error', (err) => {
  console.error('Redis error:', err);
});

redisClient.on('connect', () => {
  console.log('Connected to Redis');
});

// Conectar ao Redis
(async () => {
  await redisClient.connect();
})();

// Constantes para chaves Redis
const ROOM_PREFIX = 'game:';
const PLAYER_PREFIX = 'player:';

// Funções auxiliares para Redis
const redisHelpers = {
  // Salvar sessão do jogador
  async savePlayerSession(socketId, gameId, isPlayer1) {
    const playerData = {
      socketId,
      gameId,
      isPlayer1,
      connected: true,
      joinedAt: new Date().toISOString()
    };
    
    await redisClient.setEx(
      `${PLAYER_PREFIX}${socketId}`, 
      3600, // Expira em 1 hora
      JSON.stringify(playerData)
    );
  },

  // Obter sessão do jogador
  async getPlayerSession(socketId) {
    const data = await redisClient.get(`${PLAYER_PREFIX}${socketId}`);
    return data ? JSON.parse(data) : null;
  },

  // Remover sessão do jogador
  async removePlayerSession(socketId) {
    await redisClient.del(`${PLAYER_PREFIX}${socketId}`);
  },

  // Gerenciar sala de jogo
  async manageGameRoom(gameId, socketId, isPlayer1) {
    const roomKey = `${ROOM_PREFIX}${gameId}`;
    
    if (isPlayer1) {
      // Criar nova sala
      const roomData = {
        gameId,
        player1: socketId,
        player2: null,
        player2Connected: false,
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString()
      };
      
      await redisClient.setEx(roomKey, 7200, JSON.stringify(roomData));
    } else {
      // Juntar-se à sala existente como player2
      const roomData = await redisClient.get(roomKey);
      if (roomData) {
        const room = JSON.parse(roomData);
        room.player2 = socketId;
        room.player2Connected = true;
        room.lastActivity = new Date().toISOString();
        
        await redisClient.setEx(roomKey, 7200, JSON.stringify(room));
      }
    }
  },

  // Obter dados da sala
  async getGameRoom(gameId) {
    const data = await redisClient.get(`${ROOM_PREFIX}${gameId}`);
    return data ? JSON.parse(data) : null;
  },

  // Atualizar última atividade da sala
  async updateRoomActivity(gameId) {
    const roomKey = `${ROOM_PREFIX}${gameId}`;
    const roomData = await redisClient.get(roomKey);
    
    if (roomData) {
      const room = JSON.parse(roomData);
      room.lastActivity = new Date().toISOString();
      await redisClient.setEx(roomKey, 7200, JSON.stringify(room));
    }
  },

  // Limpar sala quando jogo terminar
  async cleanupGameRoom(gameId) {
    await redisClient.del(`${ROOM_PREFIX}${gameId}`);
  },

  // Verificar se sala existe
  async roomExists(gameId) {
    const exists = await redisClient.exists(`${ROOM_PREFIX}${gameId}`);
    return exists === 1;
  }
};

// Middleware de socket com Redis
io.use(async (socket, next) => {
  try {
    const { game } = socket.handshake.query;
    
    if (!game) {
      // Criar novo jogo
      socket.game = makeid(8);
      socket.isPlayer1 = true;
      socket.player2IsOn = false;
      
      await redisHelpers.manageGameRoom(socket.game, socket.id, true);
    } else {
      // Juntar-se a jogo existente
      const roomExists = await redisHelpers.roomExists(game);
      
      if (!roomExists) {
        return next(new Error("Game not found"));
      }
      
      const room = await redisHelpers.getGameRoom(game);
      
      if (room && room.player2) {
        return next(new Error("Game is full"));
      }
      
      socket.game = game;
      socket.isPlayer1 = false;
      socket.player2IsOn = true;
      
      await redisHelpers.manageGameRoom(game, socket.id, false);
    }
    
    // Salvar sessão do jogador
    await redisHelpers.savePlayerSession(socket.id, socket.game, socket.isPlayer1);
    
    next();
  } catch (err) {
    console.error('Socket middleware error:', err);
    next(new Error("Connection failed"));
  }
});

// Eventos de conexão
io.on("connection", async (socket) => {
  try {
    const playerSession = await redisHelpers.getPlayerSession(socket.id);
    
    if (!playerSession) {
      socket.disconnect();
      return;
    }

    socket.join(socket.game);
    
    // Emitir informações do jogo
    io.to(socket.game).emit("game", socket.game);
    io.to(socket.id).emit("isPlayer1", socket.isPlayer1);
    io.to(socket.game).emit("player2IsOn", socket.player2IsOn);

    // Notificar outros jogadores sobre nova conexão
    if (socket.isPlayer1) {
      socket.to(socket.game).emit("playerConnected", { isPlayer1: false });
    } else {
      socket.to(socket.game).emit("playerConnected", { isPlayer1: true });
    }

    // Eventos do jogo
    socket.on("paddle1", (event) => {
      redisHelpers.updateRoomActivity(socket.game);
      io.to(socket.game).emit("paddle1", event);
    });

    socket.on("paddle2", (event) => {
      redisHelpers.updateRoomActivity(socket.game);
      io.to(socket.game).emit("paddle2", event);
    });

    socket.on("ballUpdate", (data) => {
      redisHelpers.updateRoomActivity(socket.game);
      io.to(socket.game).emit("ballUpdate", data);
    });

    socket.on("scoreUpdate", (data) => {
      redisHelpers.updateRoomActivity(socket.game);
      io.to(socket.game).emit("scoreUpdate", data);
    });

    socket.on("gameReset", () => {
      redisHelpers.updateRoomActivity(socket.game);
      io.to(socket.game).emit("gameReset");
    });

    // Evento de desconexão
    socket.on("disconnect", async () => {
      try {
        console.log(`${socket.id} disconnected`);
        
        const playerSession = await redisHelpers.getPlayerSession(socket.id);
        
        if (playerSession) {
          const { gameId, isPlayer1 } = playerSession;
          
          // Notificar outro jogador sobre a desconexão
          socket.to(gameId).emit("playerDisconnected", { isPlayer1 });
          
          // Remover jogador da sala
          if (isPlayer1) {
            // Se player1 desconecta, limpar a sala
            await redisHelpers.cleanupGameRoom(gameId);
          } else {
            // Se player2 desconecta, atualizar sala
            const room = await redisHelpers.getGameRoom(gameId);
            if (room) {
              room.player2 = null;
              room.player2Connected = false;
              await redisClient.setEx(
                `${ROOM_PREFIX}${gameId}`, 
                7200, 
                JSON.stringify(room)
              );
            }
          }
          
          // Remover sessão do jogador
          await redisHelpers.removePlayerSession(socket.id);
        }
      } catch (err) {
        console.error('Disconnect error:', err);
      }
    });

    // Manter conexão ativa
    socket.on("ping", () => {
      socket.emit("pong");
    });

  } catch (err) {
    console.error('Connection error:', err);
    socket.disconnect();
  }
});

// Health check endpoint com verificação do Redis
app.get("/health", async (req, res) => {
  try {
    // Verificar se Redis está respondendo
    await redisClient.ping();
    
    const gameCount = await redisClient.keys(`${ROOM_PREFIX}*`);
    const playerCount = await redisClient.keys(`${PLAYER_PREFIX}*`);
    
    res.json({
      status: "healthy",
      redis: "connected",
      activeGames: gameCount.length,
      activePlayers: playerCount.length,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      status: "unhealthy",
      redis: "disconnected",
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint para listar jogos ativos
app.get("/games", async (req, res) => {
  try {
    const gameKeys = await redisClient.keys(`${ROOM_PREFIX}*`);
    const games = [];
    
    for (const key of gameKeys) {
      const gameData = await redisClient.get(key);
      if (gameData) {
        games.push(JSON.parse(gameData));
      }
    }
    
    res.json({
      totalGames: games.length,
      games
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Inicializar servidor
(async () => {
  try {
    await redisClient.ping();
    console.log('Redis connection established');
    
    server.listen(3000, () => {
      console.log(`Server listening on port 3000`);
    });
  } catch (err) {
    console.error('Failed to connect to Redis:', err);
    process.exit(1);
  }
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

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await redisClient.quit();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await redisClient.quit();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = app;