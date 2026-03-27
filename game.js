const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const statusText = document.getElementById("status");
const controlHint = document.getElementById("controlHint");
const gameTabs = document.getElementById("gameTabs");

const W = canvas.width;
const H = canvas.height;
const keys = {};

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

const AgentFramework = {
  agents: [],
  use(game) {
    this.agents = game.agents;
    this.agents.forEach((a) => a.init?.(game));
  },
  tick(game, dt) {
    this.agents.forEach((a) => a.update?.(game, dt));
    this.agents.forEach((a) => a.draw?.(game, ctx));
  },
};

function createEchoTrailGame() {
  const game = {
    name: "1) 回声轨迹",
    hint: "WASD/方向键移动。收集 8 个光点，躲开延迟跟随你路径的影子。",
    state: {},
    agents: [],
  };

  const logicAgent = {
    init(g) {
      g.state.player = { x: 80, y: 240, speed: 180 };
      g.state.history = [];
      g.state.shadow = { x: 80, y: 240 };
      g.state.orbs = Array.from({ length: 8 }, () => ({ x: rand(180, 760), y: rand(40, 440), r: 8 }));
      g.state.win = false;
      g.state.dead = false;
    },
    update(g, dt) {
      if (g.state.win || g.state.dead) return;
      const p = g.state.player;
      const dx = (keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.a ? 1 : 0);
      const dy = (keys.ArrowDown || keys.s ? 1 : 0) - (keys.ArrowUp || keys.w ? 1 : 0);
      p.x = clamp(p.x + dx * p.speed * dt, 12, W - 12);
      p.y = clamp(p.y + dy * p.speed * dt, 12, H - 12);

      g.state.history.push({ x: p.x, y: p.y });
      if (g.state.history.length > 180) {
        const t = g.state.history.shift();
        g.state.shadow.x = t.x;
        g.state.shadow.y = t.y;
      }

      g.state.orbs = g.state.orbs.filter((o) => Math.hypot(o.x - p.x, o.y - p.y) > 14);
      if (Math.hypot(g.state.shadow.x - p.x, g.state.shadow.y - p.y) < 14) g.state.dead = true;
      if (g.state.orbs.length === 0) g.state.win = true;
    },
    draw(g, c) {
      c.fillStyle = "#060c19";
      c.fillRect(0, 0, W, H);

      c.strokeStyle = "#2f416f";
      c.beginPath();
      g.state.history.forEach((h, i) => {
        if (i === 0) c.moveTo(h.x, h.y);
        else c.lineTo(h.x, h.y);
      });
      c.stroke();

      c.fillStyle = "#ff6a88";
      c.beginPath();
      c.arc(g.state.shadow.x, g.state.shadow.y, 10, 0, Math.PI * 2);
      c.fill();

      c.fillStyle = "#67e3c4";
      g.state.orbs.forEach((o) => {
        c.beginPath();
        c.arc(o.x, o.y, o.r + Math.sin(performance.now() / 120) * 1.5, 0, Math.PI * 2);
        c.fill();
      });

      c.fillStyle = "#7ab8ff";
      c.beginPath();
      c.arc(g.state.player.x, g.state.player.y, 10, 0, Math.PI * 2);
      c.fill();

      statusText.textContent = g.state.dead
        ? "失败：你被自己的回声捕获。按 R 重开本游戏。"
        : g.state.win
          ? "成功：你驾驭了延迟追踪机制！按 R 再玩一次。"
          : `剩余光点：${g.state.orbs.length}（影子会沿你 3 秒前路径追来）`;
    },
  };

  game.agents = [logicAgent];
  return game;
}

function createGravityFlipGame() {
  const game = { name: "2) 重力翻面", hint: "A/D 或 ←/→ 横移，空格切换重力方向。穿过动态缝隙到达右侧终点。", state: {}, agents: [] };

  const logic = {
    init(g) {
      g.state.p = { x: 40, y: 420, vx: 0, vy: 0, r: 10, grav: 1 };
      g.state.t = 0;
      g.state.win = false;
      g.state.dead = false;
    },
    update(g, dt) {
      if (g.state.win || g.state.dead) return;
      g.state.t += dt;
      const p = g.state.p;
      const ax = ((keys.d || keys.ArrowRight) ? 1 : 0) - ((keys.a || keys.ArrowLeft) ? 1 : 0);
      p.vx = ax * 180;
      p.vy += 620 * p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.y > H - p.r) { p.y = H - p.r; p.vy = 0; }
      if (p.y < p.r) { p.y = p.r; p.vy = 0; }
      p.x = clamp(p.x, p.r, W - p.r);

      for (let i = 0; i < 4; i++) {
        const x = 180 + i * 150;
        const center = 240 + Math.sin(g.state.t * 1.6 + i) * 120;
        const gap = 90;
        if (Math.abs(p.x - x) < 14 && (p.y < center - gap / 2 || p.y > center + gap / 2)) g.state.dead = true;
      }
      if (p.x > W - 32) g.state.win = true;
    },
    draw(g, c) {
      c.fillStyle = "#070a14";
      c.fillRect(0, 0, W, H);
      c.fillStyle = "#1e2c4e";
      for (let i = 0; i < 4; i++) {
        const x = 180 + i * 150;
        const center = 240 + Math.sin(g.state.t * 1.6 + i) * 120;
        const gap = 90;
        c.fillRect(x - 6, 0, 12, center - gap / 2);
        c.fillRect(x - 6, center + gap / 2, 12, H);
      }
      c.fillStyle = "#6cf0ca";
      c.fillRect(W - 20, 0, 20, H);

      c.fillStyle = g.state.p.grav > 0 ? "#7ab8ff" : "#ffd166";
      c.beginPath();
      c.arc(g.state.p.x, g.state.p.y, g.state.p.r, 0, Math.PI * 2);
      c.fill();

      statusText.textContent = g.state.dead
        ? "失败：撞上了动态墙。按 R 重开。"
        : g.state.win
          ? "成功：你完成了反重力穿越！按 R 重开。"
          : `重力方向：${g.state.p.grav > 0 ? "向下" : "向上"}（空格翻转）`;
    },
  };

  game.agents = [logic];
  return game;
}

function createRewindGame() {
  const game = { name: "3) 时序倒带", hint: "移动到右侧终点。按住 Shift 倒带 2 秒轨迹，躲开扫描线。", state: {}, agents: [] };
  const logic = {
    init(g) {
      g.state.p = { x: 50, y: 240, speed: 190 };
      g.state.trail = [];
      g.state.beams = [120, 220, 320];
      g.state.time = 0;
      g.state.dead = false;
      g.state.win = false;
    },
    update(g, dt) {
      if (g.state.dead || g.state.win) return;
      g.state.time += dt;
      const p = g.state.p;
      const dx = (keys.d || keys.ArrowRight ? 1 : 0) - (keys.a || keys.ArrowLeft ? 1 : 0);
      const dy = (keys.s || keys.ArrowDown ? 1 : 0) - (keys.w || keys.ArrowUp ? 1 : 0);

      g.state.trail.push({ x: p.x, y: p.y });
      if (g.state.trail.length > 150) g.state.trail.shift();

      if (keys.Shift && g.state.trail.length > 0) {
        const back = g.state.trail.pop();
        p.x = back.x;
        p.y = back.y;
      } else {
        p.x = clamp(p.x + dx * p.speed * dt, 12, W - 12);
        p.y = clamp(p.y + dy * p.speed * dt, 12, H - 12);
      }

      const sweep = (Math.sin(g.state.time * 1.8) * 0.5 + 0.5) * W;
      if (Math.abs(p.x - sweep) < 10 && g.state.beams.some((y) => Math.abs(y - p.y) < 55)) g.state.dead = true;
      if (p.x > W - 36) g.state.win = true;
    },
    draw(g, c) {
      c.fillStyle = "#090d1a";
      c.fillRect(0, 0, W, H);
      c.fillStyle = "#1e2e56";
      g.state.beams.forEach((y) => c.fillRect(0, y - 2, W, 4));
      const sweep = (Math.sin(g.state.time * 1.8) * 0.5 + 0.5) * W;
      c.fillStyle = "rgba(255,120,140,.28)";
      c.fillRect(sweep - 10, 0, 20, H);

      c.fillStyle = "#ffd166";
      c.fillRect(W - 20, 0, 20, H);

      c.fillStyle = keys.Shift ? "#7af0cb" : "#8fb8ff";
      c.beginPath();
      c.arc(g.state.p.x, g.state.p.y, 10, 0, Math.PI * 2);
      c.fill();

      statusText.textContent = g.state.dead
        ? "失败：被扫描线命中。按 R 重开。"
        : g.state.win
          ? "成功：你掌握了时序倒带！按 R 重开。"
          : `倒带缓存：${g.state.trail.length} 帧（按住 Shift 逆转）`;
    },
  };
  game.agents = [logic];
  return game;
}

function createRhythmGame() {
  const game = { name: "4) 脉冲走廊", hint: "仅左右移动。节拍脉冲扩散时会短暂开门，抓窗口穿越 6 道门。", state: {}, agents: [] };
  const logic = {
    init(g) {
      g.state.p = { x: 30, y: 240, r: 10 };
      g.state.time = 0;
      g.state.win = false;
      g.state.dead = false;
    },
    update(g, dt) {
      if (g.state.dead || g.state.win) return;
      g.state.time += dt;
      const p = g.state.p;
      p.x = clamp(p.x + (((keys.d || keys.ArrowRight) ? 1 : 0) - ((keys.a || keys.ArrowLeft) ? 1 : 0)) * 170 * dt, 10, W - 10);

      for (let i = 0; i < 6; i++) {
        const x = 130 + i * 105;
        const phase = (g.state.time * 2.2 + i * 0.7) % (Math.PI * 2);
        const gateOpen = Math.sin(phase) > 0.72;
        if (!gateOpen && Math.abs(p.x - x) < 9) g.state.dead = true;
      }
      if (p.x > W - 24) g.state.win = true;
    },
    draw(g, c) {
      c.fillStyle = "#090a12";
      c.fillRect(0, 0, W, H);
      for (let i = 0; i < 6; i++) {
        const x = 130 + i * 105;
        const phase = (g.state.time * 2.2 + i * 0.7) % (Math.PI * 2);
        const gateOpen = Math.sin(phase) > 0.72;
        c.fillStyle = gateOpen ? "#3f8f7b" : "#7c2c42";
        c.fillRect(x - 5, 0, 10, H);

        const pulse = (Math.sin(g.state.time * 2.2 - i * 0.2) + 1) * 0.5;
        c.strokeStyle = `rgba(113,241,203,${0.1 + pulse * 0.45})`;
        c.beginPath();
        c.arc(x, H / 2, 20 + pulse * 30, 0, Math.PI * 2);
        c.stroke();
      }

      c.fillStyle = "#ffd166";
      c.fillRect(W - 20, 0, 20, H);

      c.fillStyle = "#8ab7ff";
      c.beginPath();
      c.arc(g.state.p.x, g.state.p.y, g.state.p.r, 0, Math.PI * 2);
      c.fill();

      statusText.textContent = g.state.dead
        ? "失败：错过节拍窗口。按 R 重开。"
        : g.state.win
          ? "成功：你完成了节奏穿门！按 R 重开。"
          : "观察门颜色：绿开红关，节拍窗口很短。";
    },
  };
  game.agents = [logic];
  return game;
}

function createMirageGame() {
  const game = { name: "5) 蜃楼择门", hint: "上下移动选择门，空格进入。地图每 3 秒重排；选中真正出口 3 次获胜。", state: {}, agents: [] };
  const logic = {
    init(g) {
      g.state.cursor = 1;
      g.state.timer = 3;
      g.state.real = Math.floor(rand(0, 3));
      g.state.score = 0;
      g.state.dead = false;
      g.state.win = false;
      g.state.lock = 0;
    },
    update(g, dt) {
      if (g.state.dead || g.state.win) return;
      g.state.timer -= dt;
      g.state.lock -= dt;
      if (g.state.timer <= 0) {
        g.state.timer = 3;
        g.state.real = Math.floor(rand(0, 3));
      }
      if (g.state.lock <= 0) {
        if (keys.ArrowUp || keys.w) { g.state.cursor = (g.state.cursor + 2) % 3; g.state.lock = 0.16; }
        if (keys.ArrowDown || keys.s) { g.state.cursor = (g.state.cursor + 1) % 3; g.state.lock = 0.16; }
      }
    },
    draw(g, c) {
      c.fillStyle = "#060913";
      c.fillRect(0, 0, W, H);
      for (let i = 0; i < 3; i++) {
        const y = 120 + i * 120;
        c.fillStyle = i === g.state.cursor ? "#294b82" : "#1a2745";
        c.fillRect(280, y - 40, 240, 80);
        c.fillStyle = "#cde0ff";
        c.font = "18px sans-serif";
        c.fillText(`门 ${i + 1}`, 380, y + 6);
      }
      c.fillStyle = "#7af0cb";
      c.fillText(`重排倒计时：${g.state.timer.toFixed(1)}s`, 22, 36);
      c.fillText(`正确次数：${g.state.score}/3`, 22, 64);

      statusText.textContent = g.state.dead
        ? "失败：进入了幻门。按 R 重开。"
        : g.state.win
          ? "成功：你识破了蜃楼规律！按 R 重开。"
          : "每次重排后真实门会变化，观察节奏后再赌。";
    },
  };

  const inputAgent = {
    update(g) {
      if ((keys[" "] || keys.Spacebar) && !g.state.dead && !g.state.win) {
        keys[" "] = false;
        if (g.state.cursor === g.state.real) {
          g.state.score += 1;
          g.state.real = Math.floor(rand(0, 3));
          g.state.timer = 3;
          if (g.state.score >= 3) g.state.win = true;
        } else {
          g.state.dead = true;
        }
      }
    },
  };

  game.agents = [logic, inputAgent];
  return game;
}

const games = [
  createEchoTrailGame(),
  createGravityFlipGame(),
  createRewindGame(),
  createRhythmGame(),
  createMirageGame(),
];

let activeIndex = 0;
let lastTs = performance.now();

function mountTabs() {
  gameTabs.innerHTML = "";
  games.forEach((g, i) => {
    const btn = document.createElement("button");
    btn.className = `tab-btn ${i === activeIndex ? "active" : ""}`;
    btn.textContent = g.name;
    btn.addEventListener("click", () => switchGame(i));
    gameTabs.appendChild(btn);
  });
}

function switchGame(i) {
  activeIndex = i;
  mountTabs();
  AgentFramework.use(games[activeIndex]);
  controlHint.textContent = `操作：${games[activeIndex].hint}`;
}

document.addEventListener("keydown", (e) => {
  keys[e.key] = true;
  if (e.key === " ") e.preventDefault();

  if (e.key.toLowerCase() === "r") switchGame(activeIndex);
  if (e.key === " ") {
    const g = games[activeIndex];
    if (g.name.includes("重力翻面") && !g.state.dead && !g.state.win) g.state.p.grav *= -1;
  }
});

document.addEventListener("keyup", (e) => {
  keys[e.key] = false;
});

function loop(ts) {
  const dt = Math.min((ts - lastTs) / 1000, 0.033);
  lastTs = ts;
  AgentFramework.tick(games[activeIndex], dt);
  requestAnimationFrame(loop);
}

switchGame(0);
requestAnimationFrame(loop);
