import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-analytics.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, getDoc, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAjpAGju43D4gxe5rmWCU3ubS87_i6rnIc",
  authDomain: "truck-runner.firebaseapp.com",
  projectId: "truck-runner",
  storageBucket: "truck-runner.firebasestorage.app",
  messagingSenderId: "5012366741",
  appId: "1:5012366741:web:98be4db0150851023b029c",
  measurementId: "G-Y6701WR63E"
};

// DOM refs
const dbStatus = document.getElementById('dbStatus');
const userProfileEl = document.getElementById('user-profile');
const userPhoto = document.getElementById('userPhoto');
const userName = document.getElementById('userName');
const signinContainer = document.getElementById('signin-container');
const googleSignInBtn = document.getElementById('googleSignInBtn');
const signOutBtn = document.getElementById('signOutBtn');
const userSelect = document.getElementById('userSelect');
const newUserName = document.getElementById('newUserName');
const addUserBtn = document.getElementById('addUserBtn');
const removeUserBtn = document.getElementById('removeUserBtn');
const showLeaderboardBtn = document.getElementById('showLeaderboardBtn');
const leaderboardModal = document.getElementById('leaderboardModal');
const leaderboardList = document.getElementById('leaderboardList');
const closeLeaderboardBtn = document.getElementById('closeLeaderboardBtn');
const bananaModal = document.getElementById('bananaModal');
const bananaImage = document.getElementById('bananaImage');
const bananaAnswer = document.getElementById('bananaAnswer');
const submitBananaBtn = document.getElementById('submitBananaBtn');
const skipBananaBtn = document.getElementById('skipBananaBtn');
const bananaStatus = document.getElementById('bananaStatus');
const startBtn = document.getElementById('startBtn');
const overlay = document.getElementById('overlay');
const truckWrapper = document.getElementById('truck-wrapper');
const obstaclesContainer = document.getElementById('obstacles-container');
const scoreDisplay = document.getElementById('score');

let app = null;
let auth = null;
let db = null;
let firebaseAvailable = false;
let authUser = null;

let score = 0;
let isJumping = false;
let isGameOver = false;
let gameStarted = false;
const obstacles = [];
let obstacleSpeed = 8;
let scoreIntervalId = null;
let hasUsedSecondLife = false;
let currentBananaSolution = null;

// helpers
function showStatus(text, color = '#666') {
  if (dbStatus) {
    dbStatus.textContent = text;
    dbStatus.style.color = color;
  }
}



function updateUI() {
  if (authUser) {
    // User is signed in - show profile
    userProfileEl.style.display = 'flex';
    signinContainer.style.display = 'none';
    userPhoto.src = authUser.photoURL || `https://via.placeholder.com/28?text=${(authUser.displayName || 'U')[0]}`;
    userName.textContent = authUser.displayName || authUser.email || 'User';
    // Hide local user management controls
    userSelect.style.display = 'none';
    newUserName.style.display = 'none';
    addUserBtn.style.display = 'none';
    removeUserBtn.style.display = 'none';
  } else {
    // User is not signed in - show sign in prompt only
    userProfileEl.style.display = 'none';
    signinContainer.style.display = 'block';
    // Hide all local user management controls since we're Firebase-only now
    userSelect.style.display = 'none';
    newUserName.style.display = 'none';
    addUserBtn.style.display = 'none';
    removeUserBtn.style.display = 'none';
  }
}

// Firebase init
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  firebaseAvailable = true;
  showStatus('🟢 Online', '#4caf50');
} catch (e) {
  console.warn('Firebase init failed', e);
  firebaseAvailable = false;
  showStatus('⚪ Offline', '#666');
}

// reliable Firebase status check
async function checkFirebaseStatus() {
  if (!firebaseAvailable || !db) {
    showStatus('⚪ Offline', '#666');
    return;
  }
  try {
    await getDocs(query(collection(db, 'users'), limit(1)));
    showStatus('🟢 Online', '#4caf50');
  } catch (e) {
    console.warn('Firebase DB unreachable', e);
    showStatus('⚠ Offline / DB unreachable', '#b35000');
  }
}

if (firebaseAvailable && db) {
  checkFirebaseStatus();
  setInterval(checkFirebaseStatus, 15000);
}

// Google Auth
if (googleSignInBtn) googleSignInBtn.addEventListener('click', async () => {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    authUser = result.user;
    updateUI();
  } catch (e) {
    console.error('Sign-in failed', e);
  }
});

if (signOutBtn) signOutBtn.addEventListener('click', async () => {
  if (authUser) {
    await signOut(auth);
    authUser = null;
  }
  updateUI();
});

onAuthStateChanged(auth, user => {
  authUser = user;
  updateUI();
});

// Local user button event listeners removed - now Firebase-only

// Score handling
async function saveScore(finalScore) {
  if (!authUser || !firebaseAvailable || !db) {
    console.warn('Cannot save score: User must be signed in with Firebase');
    return;
  }
  
  try {
    // Save individual score to scores collection
    await addDoc(collection(db, 'scores'), {
      userId: authUser.uid,
      userName: authUser.displayName || authUser.email || 'Unknown',
      score: finalScore,
      timestamp: new Date().toISOString()
    });
    
    // Update user's high score if this is a new record
    const userRef = doc(db, 'users', authUser.uid);
    const userDoc = await getDoc(userRef);
    const currentHigh = userDoc.exists() ? userDoc.data().highScore || 0 : 0;
    if (finalScore > currentHigh) {
      await setDoc(userRef, { highScore: finalScore }, { merge: true });
    }
    
    console.log('Score saved successfully to Firestore');
  } catch (e) {
    console.error('Failed to save score to Firestore:', e);
  }
}

// Leaderboard
async function openLeaderboard() {
  leaderboardList.innerHTML = '';
  
  if (!firebaseAvailable || !db) {
    leaderboardList.innerHTML = '<div style="padding:8px">Firebase required for leaderboard. Please check your connection.</div>';
    leaderboardModal.style.display = 'flex';
    return;
  }
  
  try {
    const scoresSnap = await getDocs(query(collection(db, 'scores'), orderBy('score', 'desc'), limit(10)));
    if (scoresSnap.empty) {
      leaderboardList.innerHTML = '<div style="padding:8px">No scores yet. Be the first to play!</div>';
    } else {
      let i = 1;
      scoresSnap.forEach(docSnap => {
        const data = docSnap.data();
        const time = data.timestamp ? new Date(data.timestamp).toLocaleString() : '—';
        const div = document.createElement('div');
        div.style.padding = '6px 0';
        div.textContent = `${i++}. ${data.userName || 'Unknown'} — Score: ${data.score} — ${time}`;
        leaderboardList.appendChild(div);
      });
    }
    leaderboardModal.style.display = 'flex';
  } catch (e) {
    console.error('Error loading leaderboard', e);
    leaderboardList.innerHTML = '<div style="padding:8px">Error loading leaderboard. Please try again later.</div>';
    leaderboardModal.style.display = 'flex';
  }
}

if (showLeaderboardBtn) showLeaderboardBtn.addEventListener('click', openLeaderboard);
if (closeLeaderboardBtn) closeLeaderboardBtn.addEventListener('click', () => {
  leaderboardModal.style.display = 'none';
});

// Banana API integration
async function fetchBananaPuzzle() {
  try {
    const response = await fetch("http://localhost:3000/banana");
    const data = await response.json();
    console.log('Banana API response:', data);
    return {
      imageUrl: data.question,
      solution: parseInt(data.solution)
    };
  } catch (error) {
    console.error('Failed to fetch banana puzzle:', error);
    // Fallback: create a simple math problem
    const a = Math.floor(Math.random() * 10) + 1;
    const b = Math.floor(Math.random() * 10) + 1;
    return {
      imageUrl: null,
      solution: a + b,
      fallbackQuestion: `${a} + ${b} = ?`
    };
  }
}

async function showBananaPuzzle() {
  bananaStatus.textContent = 'Loading puzzle...';
  bananaStatus.className = '';
  bananaModal.style.display = 'flex';
  bananaAnswer.value = '';
  bananaAnswer.focus();

  const puzzle = await fetchBananaPuzzle();
  currentBananaSolution = puzzle.solution;

  if (puzzle.imageUrl) {
    bananaImage.src = puzzle.imageUrl;
    bananaImage.style.display = 'block';
    bananaStatus.textContent = 'Solve the math puzzle shown in the image above!';
  } else {
    bananaImage.style.display = 'none';
    bananaStatus.textContent = puzzle.fallbackQuestion || 'Solve the puzzle to continue!';
  }
}

function handleBananaAnswer() {
  const userAnswer = parseInt(bananaAnswer.value);
  
  if (isNaN(userAnswer)) {
    bananaStatus.textContent = 'Please enter a valid number!';
    bananaStatus.className = 'error';
    return;
  }

  if (userAnswer === currentBananaSolution) {
    bananaStatus.textContent = '🎉 Correct! You get a second life!';
    bananaStatus.className = 'success';
    
    setTimeout(() => {
      bananaModal.style.display = 'none';
      hasUsedSecondLife = true;
      // Remove the obstacle that caused the collision
      if (obstacles.length > 0) {
        const lastObstacle = obstacles[obstacles.length - 1];
        if (lastObstacle && lastObstacle.el) {
          lastObstacle.el.remove();
          obstacles.pop();
        }
      }
      // Resume the game
      isGameOver = false;
      requestAnimationFrame(gameLoop);
      // Restart obstacle spawning
      spawnObstacleLoop();
    }, 1500);
  } else {
    bananaStatus.textContent = `❌ Wrong! The answer was ${currentBananaSolution}. Game Over!`;
    bananaStatus.className = 'error';
    
    setTimeout(() => {
      bananaModal.style.display = 'none';
      gameOver();
    }, 2000);
  }
}

// Banana modal event listeners
if (submitBananaBtn) submitBananaBtn.addEventListener('click', handleBananaAnswer);
if (skipBananaBtn) skipBananaBtn.addEventListener('click', () => {
  bananaModal.style.display = 'none';
  gameOver();
});

if (bananaAnswer) bananaAnswer.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    handleBananaAnswer();
  }
});

// Game start / loop
startBtn.addEventListener('click', () => {
  overlay.style.display = 'none';
  startGame();
});

function startGame() {
  if (gameStarted) return;
  gameStarted = true;
  score = 0;
  obstaclesContainer.innerHTML = '';
  obstacles.length = 0;
  scoreDisplay.textContent = 'Score: 0';
  isGameOver = false;
  obstacleSpeed = 8;
  hasUsedSecondLife = false; // Reset second life for new game

  scoreIntervalId = setInterval(() => {
    if (!isGameOver) {
      score += 1;
      scoreDisplay.textContent = 'Score: ' + score;
    }
  }, 200);

  requestAnimationFrame(gameLoop);
  spawnObstacleLoop();
}

function gameOver() {
  isGameOver = true;
  gameStarted = false;
  clearInterval(scoreIntervalId);
  saveScore(score);
  overlay.style.display = 'block';
  overlay.innerHTML = `<h1>Game Over</h1><p>Score: ${score}</p><button id="startBtn">Restart</button>`;
  document.getElementById('startBtn').addEventListener('click', () => {
    overlay.style.display = 'none';
    startGame();
  });
}

// Player jump
document.addEventListener('keydown', e => {
  if (e.code === 'Space' && !isJumping && !isGameOver) {
    jump();
  }
});

function jump() {
  isJumping = true;
  truckWrapper.classList.add('jump');
  setTimeout(() => {
    truckWrapper.classList.remove('jump');
    isJumping = false;
  }, 600);
}

// Obstacles
function spawnObstacleLoop() {
  if (isGameOver) return;
  spawnObstacle();
  setTimeout(spawnObstacleLoop, 2000 + Math.random() * 1500);
}

function spawnObstacle() {
  const types = ['tire', 'rock', 'debris'];
  const type = types[Math.floor(Math.random() * types.length)];
  const el = document.createElement('div');
  el.classList.add('obstacle', type);
  el.style.right = '-60px';
  obstaclesContainer.appendChild(el);
  obstacles.push({ el, type });
}

function gameLoop() {
  if (isGameOver) return;
  obstacles.forEach((o, i) => {
    let currentRight = parseInt(o.el.style.right.replace('px', ''));
    currentRight += obstacleSpeed;
    o.el.style.right = currentRight + 'px';
    
    // Improved collision detection with tolerance
    const truckRect = truckWrapper.getBoundingClientRect();
    const obsRect = o.el.getBoundingClientRect();
    
    // Add collision tolerance (reduce collision box by 5px on each side)
    const tolerance = 5;
    const truckBox = {
      left: truckRect.left + tolerance,
      right: truckRect.right - tolerance,
      top: truckRect.top + tolerance,
      bottom: truckRect.bottom - tolerance
    };
    
    const obsBox = {
      left: obsRect.left + tolerance,
      right: obsRect.right - tolerance,
      top: obsRect.top + tolerance,
      bottom: obsRect.bottom - tolerance
    };
    
    // Check for collision with tolerance
    const hasCollision = !(truckBox.right < obsBox.left || 
                          truckBox.left > obsBox.right || 
                          truckBox.bottom < obsBox.top || 
                          truckBox.top > obsBox.bottom);
    
    if (hasCollision && !isJumping) {
      console.log('Collision detected!', { truckBox, obsBox }); // Debug log
      
      // Check if player has used their second life
      if (!hasUsedSecondLife) {
        // Pause the game and show banana puzzle
        isGameOver = true; // Temporarily stop the game loop
        showBananaPuzzle();
      } else {
        // No second life available, game over
        gameOver();
      }
    }
    
    if (currentRight > 700) {
      o.el.remove();
      obstacles.splice(i, 1);
    }
  });
  requestAnimationFrame(gameLoop);
}

// Initialize
updateUI();