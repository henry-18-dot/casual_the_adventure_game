const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const gameTabs = document.getElementById("gameTabs");
const chapterTitle = document.getElementById("chapterTitle");
const controlHint = document.getElementById("controlHint");
const statusText = document.getElementById("status");

const W = canvas.width;
const H = canvas.height;
const keys = {};

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function circleHit(a, b, r = 14) {
  return Math.hypot(a.x - b.x, a.y - b.y) < r;
}

const AgentEngine = {
  agents: [],
  mount(game) {
    this.agents = game.agents;
    this.agents.forEach((agent) => agent.init?.(game));
  },
  step(game, dt) {
    this.agents.forEach((agent) => agent.update?.(game, dt));
    this.agents.forEach((agent) => agent.draw?.(game, ctx));
  },
};

function drawBanner(game) {
  ctx.fillStyle = "rgba(0,0,0,.35)";
  ctx.fillRect(0, 0, W, 34);
  ctx.fillStyle = "#f1e4b0";
  ctx.font = "15px sans-serif";
  ctx.fillText(`${game.chapter} · ${game.name}`, 12, 22);
}

function createGuildCourierGame() {
  const game = {
    chapter: "第一章",
    name: "王都酒馆：卷轴速递",
    hint: "W/S 或 ↑/↓ 切换车道，躲避盗匪并收集 6 封公会密函。",
    state: {},
    agents: [],
  };

  const logic = {
    init(g) {
      g.state.player = { lane: 1, x: 150, y: 250 };
      g.state.lanes = [140, 250, 360];
      g.state.bandits = [];
      g.state.letters = [];
      g.state.spawn = 0;
      g.state.pickups = 0;
      g.state.hp = 3;
      g.state.win = false;
      g.state.dead = false;
      g.state.keyLock = false;
    },
    update(g, dt) {
      if (g.state.win || g.state.dead) return;
      const s = g.state;

      if (!s.keyLock && (keys.w || keys.ArrowUp)) {
        s.player.lane = (s.player.lane + 2) % 3;
        s.keyLock = true;
      }
      if (!s.keyLock && (keys.s || keys.ArrowDown)) {
        s.player.lane = (s.player.lane + 1) % 3;
        s.keyLock = true;
      }
      if (!keys.w && !keys.s && !keys.ArrowUp && !keys.ArrowDown) s.keyLock = false;
      s.player.y = s.lanes[s.player.lane];

      s.spawn -= dt;
      if (s.spawn <= 0) {
        s.spawn = rand(0.4, 0.8);
        const lane = Math.floor(rand(0, 3));
        if (Math.random() < 0.65) {
          s.bandits.push({ x: W + 20, y: s.lanes[lane], vx: rand(280, 380) });
        } else {
          s.letters.push({ x: W + 20, y: s.lanes[lane], vx: rand(220, 300) });
        }
      }

      s.bandits.forEach((b) => (b.x -= b.vx * dt));
      s.letters.forEach((m) => (m.x -= m.vx * dt));
      s.bandits = s.bandits.filter((b) => b.x > -40);
      s.letters = s.letters.filter((m) => m.x > -40);

      const p = { x: s.player.x, y: s.player.y };
      s.bandits = s.bandits.filter((b) => {
        if (circleHit(p, b, 22)) {
          s.hp -= 1;
          return false;
        }
        return true;
      });
      s.letters = s.letters.filter((m) => {
        if (circleHit(p, m, 20)) {
          s.pickups += 1;
          return false;
        }
        return true;
      });

      if (s.hp <= 0) s.dead = true;
      if (s.pickups >= 6) s.win = true;
    },
    draw(g, c) {
      const s = g.state;
      c.fillStyle = "#12141f";
      c.fillRect(0, 0, W, H);
      c.fillStyle = "#3f2f24";
      s.lanes.forEach((y) => c.fillRect(0, y - 28, W, 56));
      c.strokeStyle = "#6f5641";
      c.setLineDash([12, 12]);
      s.lanes.forEach((y) => {
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(W, y);
        c.stroke();
      });
      c.setLineDash([]);

      c.fillStyle = "#6ec5ff";
      c.fillRect(s.player.x - 16, s.player.y - 16, 32, 32);
      c.fillStyle = "#f7e7a5";
      s.letters.forEach((m) => c.fillRect(m.x - 8, m.y - 8, 16, 16));
      c.fillStyle = "#d86b7e";
      s.bandits.forEach((b) => c.fillRect(b.x - 11, b.y - 11, 22, 22));

      drawBanner(g);
      statusText.textContent = s.dead
        ? "任务失败：密函被截断。按 R 重开本章。"
        : s.win
          ? "任务成功：你完成了公会首个委托！按 R 重开。"
          : `密函 ${s.pickups}/6 · 生命 ${s.hp}`;
    },
  };

  game.agents = [logic];
  return game;
}

function createElvenRunesGame() {
  const game = {
    chapter: "第二章",
    name: "银叶林地：符文点灯",
    hint: "移动采集灵火并按顺序点亮 5 个精灵符文柱；迷雾会周期收缩视野。",
    state: {},
    agents: [],
  };

  const logic = {
    init(g) {
      g.state.p = { x: 100, y: 250, speed: 190 };
      g.state.time = 0;
      g.state.nextRune = 0;
      g.state.runes = Array.from({ length: 5 }, (_, i) => ({ x: 180 + i * 140, y: 140 + (i % 2) * 190 }));
      g.state.wisps = Array.from({ length: 12 }, () => ({ x: rand(90, 860), y: rand(70, 430) }));
      g.state.energy = 0;
      g.state.dead = false;
      g.state.win = false;
    },
    update(g, dt) {
      if (g.state.dead || g.state.win) return;
      const s = g.state;
      s.time += dt;
      s.p.x = clamp(s.p.x + (((keys.d || keys.ArrowRight) ? 1 : 0) - ((keys.a || keys.ArrowLeft) ? 1 : 0)) * s.p.speed * dt, 12, W - 12);
      s.p.y = clamp(s.p.y + (((keys.s || keys.ArrowDown) ? 1 : 0) - ((keys.w || keys.ArrowUp) ? 1 : 0)) * s.p.speed * dt, 12, H - 12);

      s.wisps = s.wisps.filter((w) => {
        if (circleHit(s.p, w, 18)) {
          s.energy += 1;
          return false;
        }
        return true;
      });

      const target = s.runes[s.nextRune];
      if (target && circleHit(s.p, target, 20) && s.energy > 0) {
        s.energy -= 1;
        s.nextRune += 1;
      }

      if (s.nextRune >= s.runes.length) s.win = true;
      if (s.wisps.length === 0 && s.energy === 0 && !s.win) s.dead = true;
    },
    draw(g, c) {
      const s = g.state;
      c.fillStyle = "#0b1c17";
      c.fillRect(0, 0, W, H);

      s.runes.forEach((r, i) => {
        c.fillStyle = i < s.nextRune ? "#67f0c8" : "#335f55";
        c.fillRect(r.x - 14, r.y - 30, 28, 60);
      });

      c.fillStyle = "#a8ffd6";
      s.wisps.forEach((w) => {
        c.beginPath();
        c.arc(w.x, w.y, 6 + Math.sin((s.time + w.x) * 2) * 1.5, 0, Math.PI * 2);
        c.fill();
      });

      c.fillStyle = "#8fb8ff";
      c.beginPath();
      c.arc(s.p.x, s.p.y, 10, 0, Math.PI * 2);
      c.fill();

      const fogRadius = 120 + (Math.sin(s.time * 1.7) * 0.5 + 0.5) * 170;
      c.save();
      c.fillStyle = "rgba(3,8,13,.76)";
      c.fillRect(0, 0, W, H);
      c.globalCompositeOperation = "destination-out";
      c.beginPath();
      c.arc(s.p.x, s.p.y, fogRadius, 0, Math.PI * 2);
      c.fill();
      c.restore();

      drawBanner(g);
      statusText.textContent = s.dead
        ? "任务失败：灵火耗尽，符文熄灭。按 R 重开。"
        : s.win
          ? "任务成功：林地封印重启！按 R 重开。"
          : `当前进度：${s.nextRune}/5 · 灵火储备 ${s.energy}`;
    },
  };

  game.agents = [logic];
  return game;
}

function createDwarfForgeGame() {
  const game = {
    chapter: "第三章",
    name: "矮人古矿：熔轨跃迁",
    hint: "A/D 移动，空格切换上下轨。躲避熔岩锤并收集 5 块秘银矿。",
    state: {},
    agents: [],
  };

  const logic = {
    init(g) {
      g.state.p = { x: 120, rail: 0, y: 180 };
      g.state.rails = [180, 320];
      g.state.hammers = [];
      g.state.ores = [];
      g.state.spawn = 0;
      g.state.collected = 0;
      g.state.hp = 3;
      g.state.dead = false;
      g.state.win = false;
      g.state.flipLock = false;
      g.state.t = 0;
    },
    update(g, dt) {
      if (g.state.dead || g.state.win) return;
      const s = g.state;
      s.t += dt;
      const mv = ((keys.d || keys.ArrowRight) ? 1 : 0) - ((keys.a || keys.ArrowLeft) ? 1 : 0);
      s.p.x = clamp(s.p.x + mv * 220 * dt, 22, W - 22);

      if (!s.flipLock && keys[" "]) {
        s.p.rail = 1 - s.p.rail;
        s.flipLock = true;
      }
      if (!keys[" "]) s.flipLock = false;
      s.p.y = s.rails[s.p.rail];

      s.spawn -= dt;
      if (s.spawn <= 0) {
        s.spawn = rand(0.45, 0.9);
        if (Math.random() < 0.62) {
          s.hammers.push({ x: W + 30, rail: Math.floor(rand(0, 2)), vx: rand(230, 330) });
        } else {
          s.ores.push({ x: W + 30, rail: Math.floor(rand(0, 2)), vx: rand(210, 290) });
        }
      }

      s.hammers.forEach((h) => (h.x -= h.vx * dt));
      s.ores.forEach((o) => (o.x -= o.vx * dt));
      s.hammers = s.hammers.filter((h) => h.x > -40);
      s.ores = s.ores.filter((o) => o.x > -40);

      s.hammers = s.hammers.filter((h) => {
        if (Math.abs(h.x - s.p.x) < 18 && h.rail === s.p.rail) {
          s.hp -= 1;
          return false;
        }
        return true;
      });
      s.ores = s.ores.filter((o) => {
        if (Math.abs(o.x - s.p.x) < 18 && o.rail === s.p.rail) {
          s.collected += 1;
          return false;
        }
        return true;
      });

      if (s.hp <= 0) s.dead = true;
      if (s.collected >= 5) s.win = true;
    },
    draw(g, c) {
      const s = g.state;
      c.fillStyle = "#150d09";
      c.fillRect(0, 0, W, H);
      c.fillStyle = "#523326";
      s.rails.forEach((y) => c.fillRect(0, y - 6, W, 12));

      c.fillStyle = "#6ec5ff";
      c.fillRect(s.p.x - 12, s.p.y - 12, 24, 24);
      c.fillStyle = "#ff8f72";
      s.hammers.forEach((h) => c.fillRect(h.x - 13, s.rails[h.rail] - 13, 26, 26));
      c.fillStyle = "#d8d0ff";
      s.ores.forEach((o) => c.fillRect(o.x - 9, s.rails[o.rail] - 9, 18, 18));

      c.fillStyle = "rgba(255,130,80,.25)";
      c.fillRect(0, H - 70 + Math.sin(s.t * 4) * 8, W, 80);

      drawBanner(g);
      statusText.textContent = s.dead
        ? "任务失败：被熔岩锤击倒。按 R 重开。"
        : s.win
          ? "任务成功：秘银矿收集完成！按 R 重开。"
          : `秘银矿 ${s.collected}/5 · 生命 ${s.hp}`;
    },
  };

  game.agents = [logic];
  return game;
}

function createDragonRidgeGame() {
  const game = {
    chapter: "第四章",
    name: "龙脊山口：焰息突围",
    hint: "W/S 或 ↑/↓ 上下飞行。龙焰会提前瞄准并爆发，生存 30 秒。",
    state: {},
    agents: [],
  };

  const logic = {
    init(g) {
      g.state.p = { x: 140, y: 250 };
      g.state.time = 0;
      g.state.markers = [];
      g.state.cooldown = 1;
      g.state.dead = false;
      g.state.win = false;
    },
    update(g, dt) {
      if (g.state.dead || g.state.win) return;
      const s = g.state;
      s.time += dt;
      s.p.y = clamp(s.p.y + (((keys.s || keys.ArrowDown) ? 1 : 0) - ((keys.w || keys.ArrowUp) ? 1 : 0)) * 220 * dt, 20, H - 20);

      s.cooldown -= dt;
      if (s.cooldown <= 0) {
        s.cooldown = rand(0.8, 1.5);
        s.markers.push({ y: s.p.y, phase: "warn", t: 0.6 });
      }

      s.markers.forEach((m) => {
        m.t -= dt;
        if (m.phase === "warn" && m.t <= 0) {
          m.phase = "fire";
          m.t = 0.55;
        }
      });

      s.markers.forEach((m) => {
        if (m.phase === "fire" && Math.abs(s.p.y - m.y) < 30) s.dead = true;
      });
      s.markers = s.markers.filter((m) => m.t > 0);

      if (s.time >= 30) s.win = true;
    },
    draw(g, c) {
      const s = g.state;
      c.fillStyle = "#100b1f";
      c.fillRect(0, 0, W, H);

      c.fillStyle = "#2d2745";
      for (let i = 0; i < 8; i++) {
        c.fillRect(i * 120, 320 - ((i % 2) * 80), 90, 210);
      }

      s.markers.forEach((m) => {
        if (m.phase === "warn") {
          c.fillStyle = "rgba(255,190,120,.35)";
          c.fillRect(240, m.y - 16, W - 240, 32);
        } else {
          c.fillStyle = "rgba(255,90,70,.62)";
          c.fillRect(240, m.y - 20, W - 240, 40);
        }
      });

      c.fillStyle = "#79d3ff";
      c.beginPath();
      c.moveTo(s.p.x - 12, s.p.y);
      c.lineTo(s.p.x + 12, s.p.y - 10);
      c.lineTo(s.p.x + 12, s.p.y + 10);
      c.closePath();
      c.fill();

      c.fillStyle = "#c84758";
      c.fillRect(W - 70, 80, 40, 40);
      c.fillStyle = "#f6e6ba";
      c.fillText("龙", W - 55, 106);

      drawBanner(g);
      statusText.textContent = s.dead
        ? "任务失败：被龙焰命中。按 R 重开。"
        : s.win
          ? "任务成功：你穿过了龙脊山口！按 R 重开。"
          : `生存倒计时：${Math.ceil(30 - s.time)} 秒`;
    },
  };

  game.agents = [logic];
  return game;
}

function createArcaneTowerGame() {
  const game = {
    chapter: "第五章",
    name: "奥术高塔：镜像决斗",
    hint: "WASD 移动。你的镜像会延迟 2 秒复制轨迹，触碰即失败；收集 7 枚法印获胜。",
    state: {},
    agents: [],
  };

  const logic = {
    init(g) {
      g.state.p = { x: 90, y: 250, speed: 200 };
      g.state.mirror = { x: 90, y: 250 };
      g.state.history = [];
      g.state.sigils = Array.from({ length: 7 }, () => ({ x: rand(220, 860), y: rand(60, 440) }));
      g.state.dead = false;
      g.state.win = false;
    },
    update(g, dt) {
      if (g.state.dead || g.state.win) return;
      const s = g.state;
      const dx = ((keys.d || keys.ArrowRight) ? 1 : 0) - ((keys.a || keys.ArrowLeft) ? 1 : 0);
      const dy = ((keys.s || keys.ArrowDown) ? 1 : 0) - ((keys.w || keys.ArrowUp) ? 1 : 0);
      s.p.x = clamp(s.p.x + dx * s.p.speed * dt, 14, W - 14);
      s.p.y = clamp(s.p.y + dy * s.p.speed * dt, 14, H - 14);

      s.history.push({ x: s.p.x, y: s.p.y });
      if (s.history.length > 120) {
        const delayed = s.history.shift();
        s.mirror.x = delayed.x;
        s.mirror.y = delayed.y;
      }

      s.sigils = s.sigils.filter((sigil) => !circleHit(s.p, sigil, 18));
      if (circleHit(s.p, s.mirror, 16)) s.dead = true;
      if (s.sigils.length === 0) s.win = true;
    },
    draw(g, c) {
      const s = g.state;
      c.fillStyle = "#0b1023";
      c.fillRect(0, 0, W, H);

      c.strokeStyle = "#384b8a";
      c.beginPath();
      s.history.forEach((h, i) => {
        if (i === 0) c.moveTo(h.x, h.y);
        else c.lineTo(h.x, h.y);
      });
      c.stroke();

      c.fillStyle = "#6f7dff";
      s.sigils.forEach((sigil) => {
        c.beginPath();
        c.arc(sigil.x, sigil.y, 8, 0, Math.PI * 2);
        c.fill();
      });

      c.fillStyle = "#ff7893";
      c.beginPath();
      c.arc(s.mirror.x, s.mirror.y, 10, 0, Math.PI * 2);
      c.fill();

      c.fillStyle = "#8ec1ff";
      c.beginPath();
      c.arc(s.p.x, s.p.y, 10, 0, Math.PI * 2);
      c.fill();

      drawBanner(g);
      statusText.textContent = s.dead
        ? "任务失败：镜像吞没了你。按 R 重开。"
        : s.win
          ? "终章完成：你成为艾斯塔拉新任守护者！按 R 重开。"
          : `剩余法印：${s.sigils.length}`;
    },
  };

  game.agents = [logic];
  return game;
}

const games = [
  createGuildCourierGame(),
  createElvenRunesGame(),
  createDwarfForgeGame(),
  createDragonRidgeGame(),
  createArcaneTowerGame(),
];

let active = 0;
let last = performance.now();

function mountTabs() {
  gameTabs.innerHTML = "";
  games.forEach((g, i) => {
    const btn = document.createElement("button");
    btn.className = `tab-btn ${i === active ? "active" : ""}`;
    btn.textContent = `${g.chapter} ${g.name}`;
    btn.addEventListener("click", () => switchGame(i));
    gameTabs.appendChild(btn);
  });
}

function switchGame(i) {
  active = i;
  mountTabs();
  const g = games[active];
  AgentEngine.mount(g);
  chapterTitle.textContent = `${g.chapter}｜${g.name}`;
  controlHint.textContent = `操作：${g.hint}`;
}

document.addEventListener("keydown", (e) => {
  keys[e.key] = true;
  if (e.key === " ") e.preventDefault();
  if (e.key.toLowerCase() === "r") switchGame(active);
});

document.addEventListener("keyup", (e) => {
  keys[e.key] = false;
});

function loop(ts) {
  const dt = Math.min((ts - last) / 1000, 0.033);
  last = ts;
  AgentEngine.step(games[active], dt);
  requestAnimationFrame(loop);
}

switchGame(0);
requestAnimationFrame(loop);
