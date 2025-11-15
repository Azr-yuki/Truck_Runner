// 🔹 Import Firebase modules for app, analytics, authentication, and Firestore database
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-analytics.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, getDoc, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// 🔹 Firebase configuration object (connects your web app to Firebase project)
const firebaseConfig = {
  apiKey: "AIzaSyAjpAGju43D4gxe5rmWCU3ubS87_i6rnIc",
  authDomain: "truck-runner.firebaseapp.com",
  projectId: "truck-runner",
  storageBucket: "truck-runner.firebasestorage.app",
  messagingSenderId: "5012366741",
  appId: "1:5012366741:web:98be4db0150851023b029c",
  measurementId: "G-Y6701WR63E"
};

// 🔹 DOM elements references (for easy manipulation later)
const dbStatus = document.getElementById('dbStatus'); // Shows Firebase connection status
const userProfileEl = document.getElementById('user-profile'); // Container showing logged-in user info
const userPhoto = document.getElementById('userPhoto'); // User profile image
const userName = document.getElementById('userName'); // User name display
const signinContainer = document.getElementById('signin-container'); // Container for Sign In button
const googleSignInBtn = document.getElementById('googleSignInBtn'); // Google sign-in button
const signOutBtn = document.getElementById('signOutBtn'); // Sign out button
const showLeaderboardBtn = document.getElementById('showLeaderboardBtn'); // Opens leaderboard modal
const leaderboardModal = document.getElementById('leaderboardModal'); // Leaderboard modal container
const leaderboardList = document.getElementById('leaderboardList'); // List inside leaderboard modal
const closeLeaderboardBtn = document.getElementById('closeLeaderboardBtn'); // Close leaderboard modal button
const bananaModal = document.getElementById('bananaModal'); // Banana puzzle modal container
const bananaImage = document.getElementById('bananaImage'); // Image element for banana puzzle
const bananaAnswer = document.getElementById('bananaAnswer'); // Input box for puzzle answer
const submitBananaBtn = document.getElementById('submitBananaBtn'); // Submit answer button
const skipBananaBtn = document.getElementById('skipBananaBtn'); // Skip puzzle button (game over)
const bananaStatus = document.getElementById('bananaStatus'); // Shows success/error status for banana puzzle
const startBtn = document.getElementById('startBtn'); // Start game button
const overlay = document.getElementById('overlay'); // Overlay shown at start/game over
const truckWrapper = document.getElementById('truck-wrapper'); // Truck container element
const obstaclesContainer = document.getElementById('obstacles-container'); // Obstacles container
const scoreDisplay = document.getElementById('score'); // Score display element

// 🔹 Game & Firebase state variables
let app = null; // Firebase app
let auth = null; // Firebase auth
let db = null; // Firestore database
let firebaseAvailable = false; // True if Firebase is initialized
let authUser = null; // Currently signed-in user

let score = 0; // Player score
let isJumping = false; // Whether truck is currently jumping
let isGameOver = false; // Game over state
let gameStarted = false; // True if a game session is active
const obstacles = []; // List of obstacles on screen
let obstacleSpeed = 8; // Speed at which obstacles move
let scoreIntervalId = null; // Interval ID for score updates
let hasUsedSecondLife = false; // Tracks if banana puzzle second life is used
let currentBananaSolution = null; // Stores solution of current banana puzzle

// 🔹 Helper function to update Firebase connection status in UI
function showStatus(text, color = '#666') {
  if (dbStatus) {
    dbStatus.textContent = text;
    dbStatus.style.color = color;
  }
}

// 🔹 Update UI based on whether user is signed in
function updateUI() {
  if (authUser) {
    // Signed in -> show profile, hide sign-in button
    userProfileEl.style.display = 'flex';
    signinContainer.style.display = 'none';
    userPhoto.src = authUser.photoURL || `https://via.placeholder.com/28?text=${(authUser.displayName || 'U')[0]}`;
    userName.textContent = authUser.displayName || authUser.email || 'User';
  } else {
    // Not signed in -> show sign-in button, hide profile
    userProfileEl.style.display = 'none';
    signinContainer.style.display = 'block';
  }
}

// 🔹 Initialize Firebase app, auth, and Firestore
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  firebaseAvailable = true;
  showStatus('🟢 Online', '#4caf50'); // Firebase ready
} catch (e) {
  console.warn('Firebase init failed', e);
  firebaseAvailable = false;
  showStatus('⚪ Offline', '#666'); // Show offline if Firebase fails
}

// 🔹 Reliable Firebase status check to update DB connectivity in UI
async function checkFirebaseStatus() {
  if (!firebaseAvailable || !db) {
    showStatus('⚪ Offline', '#666');
    return;
  }
  try {
    await getDocs(query(collection(db, 'users'), limit(1)));
    showStatus('🟢 Online', '#4caf50'); // Database reachable
  } catch (e) {
    console.warn('Firebase DB unreachable', e);
    showStatus('⚠ Offline / DB unreachable', '#b35000'); // Error reaching DB
  }
}

// Check status initially and every 15s
if (firebaseAvailable && db) {
  checkFirebaseStatus();
  setInterval(checkFirebaseStatus, 15000);
}

// 🔹 Google Authentication
if (googleSignInBtn) googleSignInBtn.addEventListener('click', async () => {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    authUser = result.user;
    updateUI(); // Refresh UI after sign-in
  } catch (e) {
    console.error('Sign-in failed', e);
  }
});

if (signOutBtn) signOutBtn.addEventListener('click', async () => {
  if (authUser) {
    await signOut(auth);
    authUser = null;
  }
  updateUI(); // Refresh UI after sign-out
});

// Listen for auth state changes (keeps UI synced)
onAuthStateChanged(auth, user => {
  authUser = user;
  updateUI();
});

// 🔹 Save score to Firestore (both individual and high score)
async function saveScore(finalScore) {
  if (!authUser || !firebaseAvailable || !db) {
    console.warn('Cannot save score: User must be signed in with Firebase');
    return;
  }
  
  try {
    // Add score to "scores" collection
    await addDoc(collection(db, 'scores'), {
      userId: authUser.uid,
      userName: authUser.displayName || authUser.email || 'Unknown',
      score: finalScore,
      timestamp: new Date().toISOString()
    });
    
    // Update high score for user
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

// 🔹 Leaderboard logic
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

// Event listeners for leaderboard
if (showLeaderboardBtn) showLeaderboardBtn.addEventListener('click', openLeaderboard);
if (closeLeaderboardBtn) closeLeaderboardBtn.addEventListener('click', () => {
  leaderboardModal.style.display = 'none';
});

// 🔹 Banana API integration (second life puzzle)
// Use Marc Conrad's Banana API; route through a public CORS proxy so no local Node server is needed.
const BANANA_API_URL = 'https://marcconrad.com/uob/banana/api.php?out=json';
const PROXY_PREFIX = 'https://api.allorigins.win/raw?url='; // Public CORS proxy

async function fetchBananaPuzzle() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7000); // 7s timeout
  try {
    // Try via proxy first (avoids CORS issues)
    const proxied = `${PROXY_PREFIX}${encodeURIComponent(BANANA_API_URL)}`;
    let response = await fetch(proxied, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) throw new Error(`Proxy HTTP ${response.status}`);

    const data = await response.json();
    console.log('Banana API (proxy) response:', data);
    return {
      imageUrl: data.question,
      solution: parseInt(data.solution)
    };
  } catch (error) {
    console.warn('Proxy failed, trying direct Banana API:', error);
    try {
      // Attempt direct call (works if API sends proper CORS headers)
      const direct = await fetch(BANANA_API_URL, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      if (!direct.ok) throw new Error(`Direct HTTP ${direct.status}`);
      const data = await direct.json();
      console.log('Banana API (direct) response:', data);
      return {
        imageUrl: data.question,
        solution: parseInt(data.solution)
      };
    } catch (error2) {
      console.error('Failed to fetch banana puzzle:', error2);
      // Fallback simple math problem
      const a = Math.floor(Math.random() * 10) + 1;
      const b = Math.floor(Math.random() * 10) + 1;
      return {
        imageUrl: null,
        solution: a + b,
        fallbackQuestion: `${a} + ${b} = ?`
      };
    }
  } finally {
    clearTimeout(timeoutId);
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

// Event listeners for banana modal buttons and Enter key
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

// 🔹 Game start button
startBtn.addEventListener('click', () => {
  overlay.style.display = 'none';
  startGame();
});

// 🔹 Start game function
function startGame() {
  if (gameStarted) return; // Prevent double start
  gameStarted = true;
  score = 0;
  obstaclesContainer.innerHTML = '';
  obstacles.length = 0;
  scoreDisplay.textContent = 'Score: 0';
  isGameOver = false;
  obstacleSpeed = 8;
  hasUsedSecondLife = false; // Reset second life

  // Increment score every 200ms
  scoreIntervalId = setInterval(() => {
    if (!isGameOver) {
      score += 1;
      scoreDisplay.textContent = 'Score: ' + score;
    }
  }, 200);

  requestAnimationFrame(gameLoop); // Start game loop
  spawnObstacleLoop(); // Start spawning obstacles
}

// 🔹 Game over function
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

// 🔹 Player jump on space key
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

// 🔹 Obstacles
function spawnObstacleLoop() {
  if (isGameOver) return;
  spawnObstacle();
  setTimeout(spawnObstacleLoop, 2000 + Math.random() * 1500); // Random interval
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

// 🔹 Main game loop: move obstacles, detect collisions
function gameLoop() {
  if (isGameOver) return;
  obstacles.forEach((o, i) => {
    let currentRight = parseInt(o.el.style.right.replace('px', ''));
    currentRight += obstacleSpeed;
    o.el.style.right = currentRight + 'px';
    
    // Collision detection with tolerance
    const truckRect = truckWrapper.getBoundingClientRect();
    const obsRect = o.el.getBoundingClientRect();
    
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
    
    const hasCollision = !(truckBox.right < obsBox.left || 
                          truckBox.left > obsBox.right || 
                          truckBox.bottom < obsBox.top || 
                          truckBox.top > obsBox.bottom);
    
    if (hasCollision && !isJumping) {
      console.log('Collision detected!', { truckBox, obsBox });
      
      if (!hasUsedSecondLife) {
        isGameOver = true; // Pause game loop
        showBananaPuzzle(); // Show puzzle for second life
      } else {
        gameOver(); // No second life
      }
    }
    
    // Remove obstacles offscreen
    if (currentRight > 700) {
      o.el.remove();
      obstacles.splice(i, 1);
    }
  });
  requestAnimationFrame(gameLoop); // Continue loop
}

// 🔹 Initialize UI at load
updateUI();
