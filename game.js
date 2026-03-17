const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const statusText = document.getElementById("status");

const TILE = 32;
const COLS = 20;
const ROWS = 15;

const keys = {};
let gameOver = false;
let victory = false;
let frame = 0;

const player = {
  x: 2,
  y: 2,
  hp: 6,
  maxHp: 6,
  gold: 0,
  facing: "down",
  attackTimer: 0,
};

let level = 1;
let map = [];
let enemies = [];
let loot = [];
let stairs = { x: 18, y: 13 };

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function makeLevel() {
  map = Array.from({ length: ROWS }, (_, y) =>
    Array.from({ length: COLS }, (_, x) => {
      const border = x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1;
      if (border) return 1;
      return Math.random() < 0.1 ? 1 : 0;
    })
  );

  for (let y = 1; y <= 3; y++) {
    for (let x = 1; x <= 3; x++) {
      map[y][x] = 0;
    }
  }

  stairs = findFreeSpot();
  enemies = Array.from({ length: 3 + level }, () => ({
    ...findFreeSpot(),
    hp: 2 + Math.floor(level / 2),
    cooldown: 0,
  }));
  loot = Array.from({ length: 3 }, () => ({ ...findFreeSpot(), value: rand(1, 3) }));
}

function findFreeSpot() {
  while (true) {
    const x = rand(1, COLS - 2);
    const y = rand(1, ROWS - 2);
    const blocked = map[y][x] === 1;
    const occupiedByEnemy = enemies.some((e) => e.x === x && e.y === y);
    const occupiedByLoot = loot.some((l) => l.x === x && l.y === y);
    const startArea = x <= 3 && y <= 3;
    if (!blocked && !occupiedByEnemy && !occupiedByLoot && !startArea) {
      return { x, y };
    }
  }
}

function resetGame() {
  level = 1;
  player.x = 2;
  player.y = 2;
  player.hp = player.maxHp;
  player.gold = 0;
  gameOver = false;
  victory = false;
  makeLevel();
}

function canMoveTo(x, y) {
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return false;
  if (map[y][x] === 1) return false;
  return !enemies.some((e) => e.x === x && e.y === y);
}

function movePlayer(dx, dy) {
  if (gameOver || victory) return;
  const nx = player.x + dx;
  const ny = player.y + dy;
  if (canMoveTo(nx, ny)) {
    player.x = nx;
    player.y = ny;
  }
  if (dx === 1) player.facing = "right";
  if (dx === -1) player.facing = "left";
  if (dy === 1) player.facing = "down";
  if (dy === -1) player.facing = "up";
}

function attack() {
  if (player.attackTimer > 0 || gameOver || victory) return;
  player.attackTimer = 10;
  const dir = {
    up: [0, -1],
    down: [0, 1],
    left: [-1, 0],
    right: [1, 0],
  }[player.facing];
  const tx = player.x + dir[0];
  const ty = player.y + dir[1];

  enemies.forEach((e) => {
    if (e.x === tx && e.y === ty) {
      e.hp -= 1;
    }
  });
  enemies = enemies.filter((e) => e.hp > 0);
}

function updateEnemies() {
  enemies.forEach((e) => {
    if (e.cooldown > 0) {
      e.cooldown -= 1;
      return;
    }
    e.cooldown = 12 + rand(0, 12);
    const dx = Math.sign(player.x - e.x);
    const dy = Math.sign(player.y - e.y);
    const chaseX = Math.abs(player.x - e.x) > Math.abs(player.y - e.y);

    const nx = e.x + (chaseX ? dx : 0);
    const ny = e.y + (chaseX ? 0 : dy);

    const blocked = map[ny][nx] === 1 || enemies.some((o) => o !== e && o.x === nx && o.y === ny);
    if (!blocked) {
      e.x = nx;
      e.y = ny;
    }

    if (Math.abs(e.x - player.x) + Math.abs(e.y - player.y) === 1) {
      player.hp -= 1;
      if (player.hp <= 0) {
        gameOver = true;
      }
    }
  });
}

function pickupLoot() {
  loot = loot.filter((l) => {
    if (l.x === player.x && l.y === player.y) {
      player.gold += l.value;
      return false;
    }
    return true;
  });
}

function checkProgress() {
  if (player.x === stairs.x && player.y === stairs.y && enemies.length === 0) {
    level += 1;
    player.x = 2;
    player.y = 2;
    player.hp = Math.min(player.maxHp, player.hp + 2);
    if (level > 3) {
      victory = true;
      return;
    }
    makeLevel();
  }
}

function drawTile(x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
}

function draw() {
  frame += 1;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const wall = map[y][x] === 1;
      drawTile(x, y, wall ? "#25314f" : "#141c34");
      if (wall) {
        ctx.fillStyle = "#3e5285";
        ctx.fillRect(x * TILE + 4, y * TILE + 4, TILE - 8, TILE - 8);
      }
    }
  }

  drawTile(stairs.x, stairs.y, enemies.length === 0 ? "#2e8b57" : "#556" );

  loot.forEach((l) => {
    ctx.fillStyle = "#ffcc33";
    ctx.beginPath();
    ctx.arc(l.x * TILE + 16, l.y * TILE + 16, 6, 0, Math.PI * 2);
    ctx.fill();
  });

  enemies.forEach((e) => {
    drawTile(e.x, e.y, "#91263c");
    ctx.fillStyle = "#ff8ca0";
    ctx.fillRect(e.x * TILE + 10, e.y * TILE + 8, 12, 16);
  });

  drawTile(player.x, player.y, "#1f6feb");
  ctx.fillStyle = "#9fd0ff";
  ctx.fillRect(player.x * TILE + 9, player.y * TILE + 7, 14, 18);

  if (player.attackTimer > 0) {
    player.attackTimer -= 1;
    const dir = {
      up: [0, -1],
      down: [0, 1],
      left: [-1, 0],
      right: [1, 0],
    }[player.facing];
    ctx.fillStyle = "#e6edf3";
    ctx.fillRect((player.x + dir[0]) * TILE + 12, (player.y + dir[1]) * TILE + 12, 8, 8);
  }

  ctx.fillStyle = "rgba(0,0,0,.45)";
  ctx.fillRect(0, 0, canvas.width, 28);
  ctx.fillStyle = "#f0f6ff";
  ctx.font = "16px Verdana";
  ctx.fillText(`生命: ${"❤".repeat(Math.max(player.hp, 0))}   金币: ${player.gold}   层数: ${level}/3`, 10, 19);

  if (gameOver || victory) {
    ctx.fillStyle = "rgba(0,0,0,.65)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = victory ? "#ffd166" : "#ff7b93";
    ctx.font = "bold 36px Verdana";
    ctx.fillText(victory ? "你成功逃离地下城！" : "你被击败了", 120, 220);
    ctx.font = "20px Verdana";
    ctx.fillStyle = "#d7e3ff";
    ctx.fillText("按 R 重新开始", 240, 265);
  }

  statusText.textContent = gameOver
    ? "状态：冒险失败。"
    : victory
      ? "状态：胜利！"
      : enemies.length > 0
        ? `状态：清理敌人后前往出口（剩余敌人 ${enemies.length}）`
        : "状态：出口已开启，前往绿色楼梯！";
}

function gameLoop() {
  if (!gameOver && !victory) {
    updateEnemies();
    pickupLoot();
    checkProgress();
  }
  draw();
  requestAnimationFrame(gameLoop);
}

window.addEventListener("keydown", (e) => {
  keys[e.key.toLowerCase()] = true;

  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(e.key.toLowerCase())) {
    e.preventDefault();
  }

  switch (e.key.toLowerCase()) {
    case "arrowup":
    case "w":
      movePlayer(0, -1);
      break;
    case "arrowdown":
    case "s":
      movePlayer(0, 1);
      break;
    case "arrowleft":
    case "a":
      movePlayer(-1, 0);
      break;
    case "arrowright":
    case "d":
      movePlayer(1, 0);
      break;
    case " ":
      attack();
      break;
    case "r":
      resetGame();
      break;
    default:
      break;
  }
});

window.addEventListener("keyup", (e) => {
  keys[e.key.toLowerCase()] = false;
});

resetGame();
gameLoop();
