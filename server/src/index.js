require("dotenv").config();
const http = require("http");
const WebSocket = require("ws");
const { nanoid } = require("nanoid");

const { resultOf } = require("./gameLogic");
const {
  rooms,
  ensureRoom,
  deleteRoomIfEmpty,
  getRoomState,
} = require("./roomManager");

const server = http.createServer();
const wss = new WebSocket.Server({ server });

/** ws -> { id, roomId } */
const clients = new Map();

function safeSend(ws, obj) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

function broadcast(roomId, obj) {
  const room = rooms.get(roomId);
  if (!room) return;
  for (const ws of room.players.values()) safeSend(ws, obj);
}

function cleanupClient(ws) {
  const meta = clients.get(ws);
  if (!meta) return;

  const { id, roomId } = meta;
  if (roomId) {
    const room = rooms.get(roomId);
    if (room) {
      room.players.delete(id);
      room.choices.delete(id);

      // Odada kalan varsa güncelle
      broadcast(roomId, { type: "ROOM_UPDATE", payload: getRoomState(roomId) });

      // Rakibe bilgi
      broadcast(roomId, {
        type: "OPPONENT_LEFT",
        payload: { message: "Rakip odadan çıktı." },
      });

      deleteRoomIfEmpty(roomId);
    }
  }
  clients.delete(ws);
}

wss.on("connection", (ws) => {
  const clientId = nanoid(8);
  clients.set(ws, { id: clientId, roomId: null });

  safeSend(ws, { type: "WELCOME", payload: { clientId } });

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return safeSend(ws, {
        type: "ERROR",
        payload: { message: "Invalid JSON" },
      });
    }

    const meta = clients.get(ws);
    if (!meta) return;

    const { type, payload } = msg;

    if (type === "CREATE_ROOM") {
      const roomId = nanoid(6);
      ensureRoom(roomId);
      return safeSend(ws, { type: "ROOM_CREATED", payload: { roomId } });
    }

    if (type === "JOIN_ROOM") {
      const roomId = String(payload?.roomId || "").trim();
      if (!roomId)
        return safeSend(ws, {
          type: "ERROR",
          payload: { message: "roomId required" },
        });

      const room = ensureRoom(roomId);
      if (room.players.size >= 2)
        return safeSend(ws, { type: "ROOM_FULL", payload: { roomId } });

      // Eğer başka odadaysa önce çık
      if (meta.roomId) cleanupClient(ws);

      // Join
      room.players.set(meta.id, ws);
      clients.set(ws, { ...meta, roomId });

      safeSend(ws, { type: "JOINED", payload: { roomId, clientId: meta.id } });
      broadcast(roomId, { type: "ROOM_UPDATE", payload: getRoomState(roomId) });

      if (room.players.size === 2) {
        broadcast(roomId, {
          type: "READY",
          payload: { message: "2 oyuncu hazır. Seçimini yap!" },
        });
      }
      return;
    }

    if (type === "LEAVE_ROOM") {
      cleanupClient(ws);
      return safeSend(ws, { type: "LEFT", payload: {} });
    }

    if (type === "PLAY") {
      const roomId = meta.roomId;
      if (!roomId)
        return safeSend(ws, {
          type: "ERROR",
          payload: { message: "Not in a room" },
        });

      const room = rooms.get(roomId);
      if (!room)
        return safeSend(ws, {
          type: "ERROR",
          payload: { message: "Room not found" },
        });

      if (room.players.size !== 2) {
        return safeSend(ws, {
          type: "ERROR",
          payload: { message: "Need 2 players" },
        });
      }

      const choice = payload?.choice;
      if (!["rock", "paper", "scissors"].includes(choice)) {
        return safeSend(ws, {
          type: "ERROR",
          payload: { message: "Invalid choice" },
        });
      }

      // Aynı round içinde choice değişmesin:
      if (room.choices.has(meta.id)) {
        return safeSend(ws, {
          type: "ERROR",
          payload: { message: "Already played this round" },
        });
      }

      room.choices.set(meta.id, choice);
      broadcast(roomId, {
        type: "CHOICE_RECEIVED",
        payload: { choicesCount: room.choices.size },
      });

      if (room.choices.size === 2) {
        const [idA, idB] = Array.from(room.players.keys());
        const choiceA = room.choices.get(idA);
        const choiceB = room.choices.get(idB);

        const winner = resultOf(choiceA, choiceB); // draw|a|b
        const winnerId = winner === "draw" ? null : winner === "a" ? idA : idB;

        broadcast(roomId, {
          type: "ROUND_RESULT",
          payload: {
            choices: { [idA]: choiceA, [idB]: choiceB },
            winnerId,
            draw: winner === "draw",
          },
        });

        // Yeni round için sıfırla
        room.choices.clear();
        broadcast(roomId, {
          type: "ROOM_UPDATE",
          payload: getRoomState(roomId),
        });
      }
      return;
    }

    safeSend(ws, {
      type: "ERROR",
      payload: { message: `Unknown type: ${type}` },
    });
  });

  ws.on("close", () => cleanupClient(ws));
  ws.on("error", () => cleanupClient(ws));
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`WS server on :${PORT}`));
