const rooms = new Map();

function ensureRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, { players: new Map(), choices: new Map() });
  }
  return rooms.get(roomId);
}

function deleteRoomIfEmpty(roomId) {
  const room = rooms.get(roomId);
  if (room && room.players.size === 0) rooms.delete(roomId);
}

function getRoomState(roomId) {
  const room = rooms.get(roomId);
  if (!room) return null;
  return {
    roomId,
    playerCount: room.players.size,
    players: Array.from(room.players.keys()),
    choicesCount: room.choices.size,
  };
}

module.exports = {
  rooms,
  ensureRoom,
  deleteRoomIfEmpty,
  getRoomState,
};
