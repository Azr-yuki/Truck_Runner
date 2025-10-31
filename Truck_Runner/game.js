const truckWrapper = document.getElementById('truck-wrapper');
const obstaclesContainer = document.getElementById('obstacles-container');
const scoreDisplay = document.getElementById('score');
const loopWrapper = document.getElementById('loop-wrapper');

let score = 0;
let isJumping = false;
let isGameOver = false;
let gameStarted = false;

const obstacles = [];
const obstacleSpeed = 8;
let backgroundPhase = 0;

document.getElementById('startBtn').addEventListener('click', () => {
  document.getElementById('overlay').style.display = 'none';
  startGame();
});

function startGame() {
  gameStarted = true;

  // Start spawning obstacles
  scheduleNextObstacle();

  // Start moving obstacles
  requestAnimationFrame(moveObstacles);

  // Score & events
  setInterval(() => {
    if (!isGameOver && gameStarted) {
      score++;
      scoreDisplay.textContent = 'Score: ' + score;

      if (score % 200 === 0) updateBackgroundPhase();
    }
  }, 200);

  // Jump listener
  document.addEventListener('keydown', e => {
    if (e.code === 'Space' && !isJumping && !isGameOver && gameStarted) jump();
  });
}

function jump() {
  isJumping = true;
  truckWrapper.classList.add('jump');
  setTimeout(() => {
    truckWrapper.classList.remove('jump');
    isJumping = false;
  }, 600);
}

// ----------------- Obstacles -----------------
function spawnObstacle() {
  const types = [
    { type: 'tire', height: 30, width: 30 },
    { type: 'rock', height: 25, width: 35 },
    { type: 'debris', height: 20 + Math.floor(Math.random() * 20), width: 20 + Math.floor(Math.random() * 20) }
  ];
  const chosen = types[Math.floor(Math.random() * types.length)];

  const obs = document.createElement('div');
  obs.classList.add('obstacle', chosen.type);
  obs.style.height = chosen.height + 'px';
  obs.style.width = chosen.width + 'px';
  obs.style.left = '600px';
  obs.style.bottom = '0px';
  if (chosen.type === 'debris') obs.style.transform = `rotate(${Math.floor(Math.random() * 30 - 15)}deg)`;

  obstaclesContainer.appendChild(obs);
  obstacles.push(obs);
}

function scheduleNextObstacle() {
  if (isGameOver) return;
  if (gameStarted) spawnObstacle();
  const nextIn = 1000 + Math.random() * 1000;
  setTimeout(scheduleNextObstacle, nextIn);
}

function moveObstacles() {
  if (isGameOver) return;

  if (!gameStarted) { // Pause movement
    requestAnimationFrame(moveObstacles);
    return;
  }

  obstacles.forEach((obs, index) => {
    let left = parseInt(obs.style.left);
    left -= obstacleSpeed;
    obs.style.left = left + 'px';

    if (left < -50) {
      obs.remove();
      obstacles.splice(index, 1);
    }

    if (isColliding(truckWrapper, obs)) gameOver();
  });

  requestAnimationFrame(moveObstacles);
}

// ----------------- Collision -----------------
function isColliding(truck, obs) {
  const t = truck.getBoundingClientRect();
  const o = obs.getBoundingClientRect();
  return !(t.top > o.bottom || t.bottom < o.top || t.right < o.left || t.left > o.right);
}

// ----------------- Game Over -----------------
function gameOver() {
  if (isGameOver) return;
  isGameOver = true;

  // Freeze everything
  gameStarted = false;
  freezeAnimations();

  // Trigger Banana API
  pauseForBananaAPI();
}
function freezeAnimations() {
  // Pause CSS animations globally
  document.querySelectorAll('*').forEach(el => {
    el.style.animationPlayState = 'paused';
  });
}



// ----------------- Background -----------------
function updateBackgroundPhase() {
  backgroundPhase = (backgroundPhase + 1) % 4;
  let gradient;
  switch (backgroundPhase) {
    case 0: gradient = 'linear-gradient(to top, #87ceeb, #fff)'; break; // morning
    case 1: gradient = 'linear-gradient(to top, #fffacd, #ffff00)'; break; // afternoon
    case 2: gradient = 'linear-gradient(to top, #ff4500, #ffa500)'; break; // evening
    case 3: gradient = 'linear-gradient(to top, #00008b, #000000)'; break; // night
  }
  document.body.style.transition = 'background 4s linear';
  document.body.style.background = gradient;
}

// ----------------- Banana API Pause -----------------
function pauseForBananaAPI() {
  if (isGameOver) return;
  gameStarted = false; // pause everything

  const overlay = document.createElement('div');
  overlay.id = 'banana-popup';
  overlay.style.position = 'absolute';
  overlay.style.top = '50%';
  overlay.style.left = '50%';
  overlay.style.transform = 'translate(-50%,-50%)';
  overlay.style.background = 'rgba(0,0,0,0.9)';
  overlay.style.color = 'white';
  overlay.style.padding = '30px';
  overlay.style.textAlign = 'center';
  overlay.style.borderRadius = '10px';
  overlay.style.zIndex = '50';
  overlay.innerHTML = `
    <h2>Banana Mini-Game</h2>
    <p>Complete this task to continue!</p>
    <button id="completeBtn">Complete</button>
  `;
  loopWrapper.appendChild(overlay);

  document.getElementById('completeBtn').addEventListener('click', () => {
    overlay.remove();
    showCountdown(5); // 5 second visual countdown
  });
}

// ----------------- Countdown -----------------
function showCountdown(seconds) {
  const countdown = document.createElement('div');
  countdown.id = 'countdown';
  countdown.style.position = 'absolute';
  countdown.style.top = '50%';
  countdown.style.left = '50%';
  countdown.style.transform = 'translate(-50%,-50%)';
  countdown.style.color = 'yellow';
  countdown.style.fontSize = '40px';
  countdown.style.zIndex = '50';
  loopWrapper.appendChild(countdown);

  let current = seconds;
  countdown.textContent = current;

  const interval = setInterval(() => {
    current--;
    if (current <= 0) {
      clearInterval(interval);
      countdown.remove();

      // Wait 3 seconds before resuming
      setTimeout(() => {
        isGameOver = false;
        gameStarted = true;
        resumeAnimations();
        scheduleNextObstacle(); // resume spawning
      }, 3000);
    } else {
      countdown.textContent = current;
    }

  }, 1000);
}
