// filepath: c:\Users\aDMIN\OneDrive\Desktop\Top Up 1st Sem\S4E\Truck_Runner\game.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.5.2/firebase-app.js';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } 
from 'https://www.gstatic.com/firebasejs/10.5.2/firebase-auth.js';
import { getFirestore, collection, addDoc } from 'https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/10.5.2/firebase-analytics.js';

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
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
const analytics = getAnalytics(app);

// Game elements
const truckWrapper = document.getElementById('truck-wrapper');
const obstaclesContainer = document.getElementById('obstacles-container');
const scoreDisplay = document.getElementById('score');
const signInBtn = document.getElementById('signInBtn');
const signOutBtn = document.getElementById('signOutBtn');
const userProfile = document.getElementById('user-profile');
const userPhoto = document.getElementById('userPhoto');
const userName = document.getElementById('userName');

// Game state
let score = 0;
let isJumping = false;
let isGameOver = false;
let gameStarted = false;
const obstacles = [];
const obstacleSpeed = 8;

// Auth state observer
onAuthStateChanged(auth, (user) => {
    console.log('Auth state changed:', user ? 'logged in' : 'logged out');
    if (user) {
        signInBtn.style.display = 'none';
        signOutBtn.style.display = 'block';
        userProfile.style.display = 'block';
        userPhoto.src = user.photoURL || 'default-avatar.png';
        userName.textContent = user.displayName || 'Player';
    } else {
        signInBtn.style.display = 'block';
        signOutBtn.style.display = 'none';
        userProfile.style.display = 'none';
        if (gameStarted) {
            location.reload();
        }
    }
});

// Auth event listeners
signInBtn.addEventListener('click', async () => {
    try {
        const result = await signInWithPopup(auth, provider);
        console.log('Signed in:', result.user.displayName);
    } catch (error) {
        console.error('Sign in error:', error);
        alert('Failed to sign in: ' + error.message);
    }
});

signOutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
        console.log('Signed out successfully');
    } catch (error) {
        console.error('Sign out error:', error);
        alert('Failed to sign out: ' + error.message);
    }
});

// Game initialization
document.getElementById('startBtn').addEventListener('click', () => {
    if (!auth.currentUser) {
        alert('Please sign in to play!');
        return;
    }
    document.getElementById('overlay').style.display = 'none';
    startGame();
});

function startGame() {
    gameStarted = true;
    score = 0;
    isGameOver = false;
    scoreDisplay.textContent = 'Score: 0';
    
    // Clear existing obstacles
    while (obstaclesContainer.firstChild) {
        obstaclesContainer.removeChild(obstaclesContainer.firstChild);
    }
    
    scheduleNextObstacle();
    requestAnimationFrame(moveObstacles);
    document.addEventListener('keydown', handleJump);
    
    setInterval(() => {
        if (!isGameOver && gameStarted) {
            score++;
            scoreDisplay.textContent = 'Score: ' + score;
        }
    }, 200);
}

function handleJump(e) {
    if (e.code === 'Space' && !isJumping && !isGameOver && gameStarted) {
        jump();
    }
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
        console.log('Score saved successfully');
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
    gameOverScreen.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 20px;
        text-align: center;
        border-radius: 10px;
        z-index: 100;
    `;
    
    gameOverScreen.innerHTML = `
        <h2>Game Over!</h2>
        <p>Your Score: ${score}</p>
        <button onclick="location.reload()">Play Again</button>
    `;
    
    document.body.appendChild(gameOverScreen);
    document.removeEventListener('keydown', handleJump);
}