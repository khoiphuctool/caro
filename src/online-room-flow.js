(function(global){
  function createEmptyRoomSnapshot(roomNumber, isVip, base) {
    return {
      roomNumber,
      isVip: !!isVip,
      status: 'empty',
      playerX_id: '',
      playerX_name: '',
      playerX_status: 'offline',
      playerX_avatar: '',
      playerX_skin: 'skin_default',
      playerX_lastPing: null,
      playerO_id: '',
      playerO_name: '',
      playerO_status: 'offline',
      playerO_avatar: '',
      playerO_skin: 'skin_default',
      playerO_lastPing: null,
      guestReady: false,
      playerXConfirmed: null,
      playerOConfirmed: null,
      turn: 'X',
      winCount: 5,
      chan2Dau: true,
      winner: '',
      lastMove: { row: -1, col: -1, by: '' },
      moves: { init: true },
      betAmount: base && base.betAmount ? base.betAmount : 0,
      betPot: base && base.betPot ? base.betPot : 0,
      updatedAt: Date.now()
    };
  }

  function resolveJoinIntent(room, myId, myName, preferredRole) {
    const safeRoom = room || createEmptyRoomSnapshot(1, false);
    const isX = myId && safeRoom.playerX_id === myId;
    const isO = myId && safeRoom.playerO_id === myId;
    if (isX) {
      return { committed: true, role: 'X', room: safeRoom };
    }
    if (isO) {
      return { committed: true, role: 'O', room: safeRoom };
    }
    const explicitRole = preferredRole === 'X' || preferredRole === 'O' ? preferredRole : null;
    const hostSeatOpen = !safeRoom.playerX_id || safeRoom.status === 'empty' || safeRoom.status === 'ended';
    const guestSeatOpen = !safeRoom.playerO_id && !!safeRoom.playerX_id && safeRoom.playerX_id !== myId;
    if (hostSeatOpen && (explicitRole !== 'O' || !guestSeatOpen)) {
      const nextRoom = {
        ...safeRoom,
        playerX_id: myId,
        playerX_name: myName,
        playerX_status: 'online',
        playerO_id: safeRoom.playerO_id || '',
        playerO_name: safeRoom.playerO_name || '',
        playerO_status: safeRoom.playerO_id ? safeRoom.playerO_status : 'offline',
        status: 'waiting',
        winner: '',
        endReason: '',
        moves: { init: true },
        lastMove: { row: -1, col: -1, by: '' },
        updatedAt: Date.now()
      };
      return { committed: true, role: 'X', room: nextRoom };
    }
    if (guestSeatOpen && (explicitRole !== 'X')) {
      const nextRoom = {
        ...safeRoom,
        playerO_id: myId,
        playerO_name: myName,
        playerO_status: 'online',
        updatedAt: Date.now()
      };
      return { committed: true, role: 'O', room: nextRoom };
    }
    return { committed: false, role: null, room: safeRoom };
  }

  function buildStartPayload(options) {
    const room = options && options.room ? options.room : {};
    const winCount = typeof options.winCount === 'number' ? options.winCount : (typeof resolveRoomWinCount === 'function' ? resolveRoomWinCount(room) : (room.winCount || 5));
    const chan2Dau = typeof options.chan2Dau === 'boolean' ? options.chan2Dau : (room.chan2Dau ?? true);
    const firstTurn = options.firstTurn || room.firstTurn || 'X';
    return {
      status: 'playing',
      turn: firstTurn,
      winCount,
      chan2Dau,
      firstTurn,
      winner: '',
      endReason: '',
      moves: { init: true },
      lastMove: { row: -1, col: -1, by: '' },
      endedAt: null,
      playerXConfirmed: null,
      playerOConfirmed: null,
      updatedAt: Date.now()
    };
  }

  function buildLeavePayload(room, myId, role) {
    const safeRoom = room || createEmptyRoomSnapshot(1, false);
    const nextRoom = { ...safeRoom };
    if (role === 'X' && myId === safeRoom.playerX_id) {
      if (safeRoom.playerO_id) {
        nextRoom.playerX_id = safeRoom.playerO_id;
        nextRoom.playerX_name = safeRoom.playerO_name;
        nextRoom.playerX_status = safeRoom.playerO_status || 'offline';
        nextRoom.playerX_avatar = safeRoom.playerO_avatar || '';
        nextRoom.playerX_skin = safeRoom.playerO_skin || 'skin_default';
        nextRoom.playerX_lastPing = safeRoom.playerO_lastPing || null;
        nextRoom.playerO_id = '';
        nextRoom.playerO_name = '';
        nextRoom.playerO_status = 'offline';
        nextRoom.playerO_avatar = '';
        nextRoom.playerO_skin = 'skin_default';
        nextRoom.playerO_lastPing = null;
        nextRoom.status = 'waiting';
      } else {
        nextRoom.playerX_id = '';
        nextRoom.playerX_name = '';
        nextRoom.playerX_status = 'offline';
        nextRoom.playerX_avatar = '';
        nextRoom.playerX_skin = 'skin_default';
        nextRoom.playerX_lastPing = null;
        nextRoom.playerO_id = '';
        nextRoom.playerO_name = '';
        nextRoom.playerO_status = 'offline';
        nextRoom.playerO_avatar = '';
        nextRoom.playerO_skin = 'skin_default';
        nextRoom.playerO_lastPing = null;
        nextRoom.status = 'empty';
      }
    } else if (role === 'O' && myId === safeRoom.playerO_id) {
      nextRoom.playerO_id = '';
      nextRoom.playerO_name = '';
      nextRoom.playerO_status = 'offline';
      nextRoom.playerO_avatar = '';
      nextRoom.playerO_skin = 'skin_default';
      nextRoom.playerO_lastPing = null;
      nextRoom.status = 'waiting';
    }
    nextRoom.winner = '';
    nextRoom.endReason = '';
    nextRoom.moves = { init: true };
    nextRoom.lastMove = { row: -1, col: -1, by: '' };
    nextRoom.guestReady = false;
    nextRoom.playerXConfirmed = null;
    nextRoom.playerOConfirmed = null;
    nextRoom.updatedAt = Date.now();
    return nextRoom;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createEmptyRoomSnapshot, resolveJoinIntent, buildStartPayload, buildLeavePayload };
  }
  global.onlineRoomFlow = { createEmptyRoomSnapshot, resolveJoinIntent, buildStartPayload, buildLeavePayload };
})(typeof globalThis !== 'undefined' ? globalThis : window);
