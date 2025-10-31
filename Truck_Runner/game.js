import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut } from "firebase/auth";
import { getFirestore, collection, addDoc, query, where, orderBy, limit, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAjpAGju43D4gxe5rmWCU3ubS87_i6rnIc",
  authDomain: "truck-runner.firebaseapp.com",
  projectId: "truck-runner",
  storageBucket: "truck-runner.firebasestorage.app",
  messagingSenderId: "5012366741",
  appId: "1:5012366741:web:98be4db0150851023b029c",
  measurementId: "G-Y6701WR63E"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// Game elements
const truckWrapper = document.getElementById('truck-wrapper');
const obstaclesContainer = document.getElementById('obstacles-container');
const scoreDisplay = document.getElementById('score');
const loopWrapper = document.getElementById('loop-wrapper');
const authButton = document.getElementById('auth-button');
const userInfo = document.getElementById('user-info');
const userAvatar = document.getElementById('user-avatar');
const userName = document.getElementById('user-name');

let score = 0;
let isJumping = false;
let isGameOver = false;
let gameStarted = false;

// Auth state observer
auth.onAuthStateChanged((user) => {
  if (user) {
    authButton.textContent = 'Switch Account';
    userInfo.style.display = 'block';
    userAvatar.src = user.photoURL;
    userName.textContent = user.displayName;
  } else {
    authButton.textContent = 'Sign In';
    userInfo.style.display = 'none';
  }
});

// Auth button handler
authButton.addEventListener('click', async () => {
  if (auth.currentUser) {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error('Error signing in:', error);
  }
});

// Game initialization
const obstacles = [];
const obstacleSpeed = 8;
let backgroundPhase = 0;

document.getElementById('startBtn').addEventListener('click', () => {
  document.getElementById('overlay').style.display = 'none';
  startGame();
});

function startGame() {
  if (!auth.currentUser) {
    alert('Please sign in to play!');
    return;
  }
  
  gameStarted = true;
  score = 0;
  scoreDisplay.textContent = 'Score: 0';
  scheduleNextObstacle();
  requestAnimationFrame(moveObstacles);

  document.addEventListener('keydown', e => {
    if (e.code === 'Space' && !isJumping && !isGameOver && gameStarted) jump();
  });

  setInterval(() => {
    if (!isGameOver && gameStarted) {
      score++;
      scoreDisplay.textContent = 'Score: ' + score;
    }
  }, 200);
}

function jump() {
  isJumping = true;
  truckWrapper.classList.add('jump');
  setTimeout(() => {
    truckWrapper.classList.remove('jump');
    isJumping = false;
  }, 600);
}

function spawnObstacle() {
  const types = [
    { type: 'tire', height: 30, width: 30 },
    { type: 'rock', height: 25, width: 35 },
    { type: 'debris', height: 20 + Math.random() * 20, width: 20 + Math.random() * 20 }
  ];
  const chosen = types[Math.floor(Math.random() * types.length)];

  const obs = document.createElement('div');
  obs.classList.add('obstacle', chosen.type);
  obs.style.height = chosen.height + 'px';
  obs.style.width = chosen.width + 'px';
  obs.style.left = '600px';
  obs.style.bottom = '0px';
  
  if (chosen.type === 'debris') {
    obs.style.transform = `rotate(${Math.random() * 30 - 15}deg)`;
  }

  obstaclesContainer.appendChild(obs);
  obstacles.push(obs);
}

function scheduleNextObstacle() {
  if (isGameOver) return;
  if (gameStarted) spawnObstacle();
  setTimeout(scheduleNextObstacle, 1000 + Math.random() * 1000);
}

function moveObstacles() {
  if (isGameOver) return;
  if (!gameStarted) {
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

function isColliding(truck, obs) {
  const t = truck.getBoundingClientRect();
  const o = obs.getBoundingClientRect();
  return !(t.top > o.bottom || t.bottom < o.top || t.right < o.left || t.left > o.right);
}

async function saveScore() {
  if (!auth.currentUser) return;
  
  try {
    await addDoc(collection(db, "scores"), {
      userId: auth.currentUser.uid,
      userName: auth.currentUser.displayName,
      score: score,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    console.error("Error saving score:", e);
  }
}

function gameOver() {
  if (isGameOver) return;
  isGameOver = true;
  gameStarted = false;
  
  if (auth.currentUser) {
    saveScore();
  }

  const gameOverScreen = document.createElement('div');
  gameOverScreen.id = 'game-over-screen';
  gameOverScreen.style.position = 'absolute';
  gameOverScreen.style.top = '50%';
  gameOverScreen.style.left = '50%';
  gameOverScreen.style.transform = 'translate(-50%, -50%)';
  gameOverScreen.style.background = 'rgba(0,0,0,0.8)';
  gameOverScreen.style.color = 'white';
  gameOverScreen.style.padding = '20px';
  gameOverScreen.style.textAlign = 'center';
  gameOverScreen.style.borderRadius = '10px';
  gameOverScreen.style.zIndex = '100';
  
  gameOverScreen.innerHTML = `
    <h2>Game Over!</h2>
    <p>Your Score: ${score}</p>
    <button onclick="location.reload()">Play Again</button>
  `;
  
  document.body.appendChild(gameOverScreen);
}

function pauseForBananaAPI() {
  if (isGameOver) return;
  gameStarted = false;

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
    showCountdown(5);
  });
}

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
      gameStarted = true;
    } else {
      countdown.textContent = current;
    }
  }, 1000);
}