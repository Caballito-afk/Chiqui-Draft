/**
 * test.js - Pruebas automatizadas de aislamiento y persistencia para ChiquiDraft
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const db = require("./db");

console.log("=== INICIANDO PRUEBAS DE CHIKIDRAFT ===");

// 1. Inicialización
db.init();
console.log("✔ DB inicializada correctamente.");

// 2. Aislamiento de sesiones entre jugadores distintos
const userA = { clubName: "Boca Juniors", color: "#0000ff" };
const userB = { clubName: "River Plate", color: "#ff0000" };

db.saveSession("session_player_1", userA);
db.saveSession("session_player_2", userB);

const readA = db.getSession("session_player_1");
const readB = db.getSession("session_player_2");

assert.strictEqual(readA.clubName, "Boca Juniors", "Error: Club de jugador 1 incorrecto");
assert.strictEqual(readB.clubName, "River Plate", "Error: Club de jugador 2 incorrecto");
assert.notStrictEqual(readA.clubName, readB.clubName, "Error: Los estados de los jugadores se cruzaron");
console.log("✔ Aislamiento de sesiones verificado: Jugador 1 y Jugador 2 son completamente independientes.");

// 3. Aislamiento de salas de juego
const room1 = {
  code: "SALA01",
  game: "puja",
  players: [{ id: 0, sessionId: "session_player_1", name: "Boca" }]
};
const room2 = {
  code: "SALA02",
  game: "reloj",
  players: [{ id: 0, sessionId: "session_player_2", name: "River" }]
};

db.saveRoom("SALA01", room1);
db.saveRoom("SALA02", room2);

const readRoom1 = db.getRoom("SALA01");
const readRoom2 = db.getRoom("SALA02");

assert.strictEqual(readRoom1.game, "puja");
assert.strictEqual(readRoom2.game, "reloj");
assert.notStrictEqual(readRoom1.code, readRoom2.code);
console.log("✔ Aislamiento de salas verificado: SALA01 y SALA02 coexisten sin pisarse.");

// 4. Aislamiento y persistencia de estados de partida (Draft / Liga)
db.saveGameState("SALA01", { currentRound: 1, currentBid: 50, bidder: "Boca" });
db.saveGameState("SALA02", { currentRound: 5, currentBid: 250, bidder: "River" });

const state1 = db.getGameState("SALA01");
const state2 = db.getGameState("SALA02");

assert.strictEqual(state1.currentBid, 50);
assert.strictEqual(state2.currentBid, 250);
console.log("✔ Aislamiento de estado de partida verificado: Estados de subasta independientes.");

// 5. Verificación de archivos persistidos en disco
const sessionFileA = path.join(__dirname, "data", "sessions", "session_player_1.json");
const roomFile1 = path.join(__dirname, "data", "rooms", "SALA01.json");
const gameFile1 = path.join(__dirname, "data", "games", "SALA01.json");

assert.ok(fs.existsSync(sessionFileA), "El archivo de sesión debe existir en disco");
assert.ok(fs.existsSync(roomFile1), "El archivo de sala debe existir en disco");
assert.ok(fs.existsSync(gameFile1), "El archivo de estado de partida debe existir en disco");
console.log("✔ Persistencia en disco verificada: Archivos atómicos generados en /data.");

// 6. Limpieza de datos de prueba
db.deleteSession("session_player_1");
db.deleteSession("session_player_2");
db.deleteRoom("SALA01");
db.deleteRoom("SALA02");

assert.strictEqual(db.getSession("session_player_1"), null);
assert.strictEqual(db.getRoom("SALA01"), null);
console.log("✔ Limpieza completada con éxito.");

console.log("\n=============================================");
console.log("🎉 TODAS LAS PRUEBAS PASARON EXITOSAMENTE 🎉");
console.log("=============================================\n");
