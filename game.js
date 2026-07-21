import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, collection, arrayUnion } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDYqQwLQ2eQyvC_72529zCAMp5kD_Az91c",
    authDomain: "mafia-online-8d543.firebaseapp.com",
    projectId: "mafia-online-8d543",
    storageBucket: "mafia-online-8d543.firebasestorage.app",
    messagingSenderId: "1074431288177",
    appId: "1:1074431288177:web:531cc4eddcbbae02b08cd0",
    measurementId: "G-Q35R5WBKBV"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const loginScreen = document.getElementById("login-screen");
const gameScreen = document.getElementById("game-screen");
const usernameInput = document.getElementById("username");
const newRoomCodeInput = document.getElementById("new-room-code");
const createRoomBtn = document.getElementById("create-room-btn");
const roomsListDiv = document.getElementById("rooms-list");

const playersList = document.getElementById("players-list");
const roomTitleBar = document.getElementById("room-title-bar");
const roleDisplay = document.getElementById("role-display");
const chatBox = document.getElementById("chat-box");
const chatInput = document.getElementById("chat-input");
const sendChatBtn = document.getElementById("send-chat-btn");
const startBtn = document.getElementById("start-btn");
const actionInstruction = document.getElementById("action-instruction");
const targetSelect = document.getElementById("target-select");
const actionBtn = document.getElementById("action-btn");

let playerName = "";
let roomCode = "";

function loadRoomsList() {
    const roomsRef = collection(db, "rooms");
    onSnapshot(roomsRef, (snapshot) => {
        roomsListDiv.innerHTML = "";
        if (snapshot.empty) {
            roomsListDiv.innerHTML = "<p style='font-size: 11px; color: #666; padding: 5px;'>Нет комнат. Создайте свою!</p>";
            return;
        }

        snapshot.forEach((docSnap) => {
            const rCode = docSnap.id;
            const rData = docSnap.data();
            const playersCount = rData.players ? rData.players.length : 0;
            const statusText = rData.status === "waiting" ? "Ожидание" : "Идет игра";

            const div = document.createElement("div");
            div.style.cssText = "display: flex; justify-content: space-between; align-items: center; background: #fff; border: 1px solid #7f9db9; padding: 4px; margin-bottom: 3px; font-size: 11px;";
            div.innerHTML = `
                <span><b>${rCode}</b> (${statusText}, игроков: ${playersCount})</span>
                <button data-code="${rCode}" class="join-room-btn">Войти</button>
            `;
            roomsListDiv.appendChild(div);
        });

        document.querySelectorAll(".join-room-btn").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                const targetCode = e.target.getAttribute("data-code");
                await joinRoom(targetCode);
            });
        });
    });
}

createRoomBtn.addEventListener("click", async () => {
    playerName = usernameInput.value.trim();
    roomCode = newRoomCodeInput.value.trim();

    if (!playerName) { alert("Введите имя!"); return; }
    if (!roomCode) { alert("Введите название комнаты!"); return; }

    try {
        const roomRef = doc(db, "rooms", roomCode);
        const roomSnap = await getDoc(roomRef);

        if (roomSnap.exists()) {
            alert("Комната уже существует!");
            return;
        }

        await setDoc(roomRef, {
            host: playerName,
            status: "waiting",
            players: [{ name: playerName, role: "Ожидание", alive: true }],
            messages: []
        });

        enterGameScreen();
    } catch (err) {
        console.error(err);
        alert("Ошибка создания комнаты.");
    }
});

async function joinRoom(code) {
    playerName = usernameInput.value.trim();
    if (!playerName) { alert("Сначала введите ваше имя вверху!"); return; }

    roomCode = code;
    try {
        const roomRef = doc(db, "rooms", roomCode);
        const roomSnap = await getDoc(roomRef);

        if (!roomSnap.exists()) { alert("Комната не найдена!"); return; }

        const data = roomSnap.data();
        if (data.status !== "waiting") { alert("Игра уже началась!"); return; }

        const exists = data.players.find(p => p.name === playerName);
        if (!exists) {
            await updateDoc(roomRef, {
                players: arrayUnion({ name: playerName, role: "Ожидание", alive: true })
            });
        }

        enterGameScreen();
    } catch (err) {
        console.error(err);
        alert("Ошибка входа.");
    }
}

function enterGameScreen() {
    loginScreen.classList.add("hidden");
    gameScreen.classList.remove("hidden");
    roomTitleBar.innerText = `Мафия - Комната: ${roomCode}`;
    subscribeToRoom();
}

startBtn.addEventListener("click", async () => {
    const roomRef = doc(db, "rooms", roomCode);
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists()) return;
    
    let players = roomSnap.data().players;
    if (players.length < 1) { alert("Мало игроков!"); return; }

    const rolesPool = ["Мафия", "Шериф"];
    while (rolesPool.length < players.length) rolesPool.push("Мирный");
    rolesPool.sort(() => Math.random() - 0.5);

    players.forEach((p, i) => { p.role = rolesPool[i]; p.alive = true; });

    await updateDoc(roomRef, {
        status: "night",
        players: players,
        messages: arrayUnion({ sender: "Система", time: new Date().toLocaleTimeString().slice(0, 5), text: "Игра началась! Наступила ночь." })
    });
});

async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;
    const roomRef = doc(db, "rooms", roomCode);
    await updateDoc(roomRef, {
        messages: arrayUnion({ sender: playerName, text: text, time: new Date().toLocaleTimeString().slice(0, 5) })
    });
    chatInput.value = "";
}

sendChatBtn.addEventListener("click", sendMessage);
chatInput.addEventListener("keypress", (e) => { if (e.key === "Enter") sendMessage(); });

function subscribeToRoom() {
    const roomRef = doc(db, "rooms", roomCode);
    onSnapshot(roomRef, (docSnap) => {
        if (!docSnap.exists()) return;
        const data = docSnap.data();

        if (data.host === playerName && data.status === "waiting") {
            startBtn.classList.remove("hidden");
        } else {
            startBtn.classList.add("hidden");
        }

        playersList.innerHTML = "";
        data.players.forEach(p => {
            const li = document.createElement("li");
            li.innerText = `${p.name} [${p.alive ? 'Жив' : 'Мертв'}]`;
            playersList.appendChild(li);
        });

        const me = data.players.find(p => p.name === playerName);
        if (me && data.status !== "waiting") {
            roleDisplay.innerText = `Ваша роль: ${me.role}`;
        }

        if (data.messages) {
            chatBox.innerHTML = "";
            data.messages.forEach(msg => {
                const div = document.createElement("div");
                div.className = "chat-msg";
                div.innerHTML = `<b>[${msg.time}] ${msg.sender}:</b> ${msg.text}`;
                chatBox.appendChild(div);
            });
            chatBox.scrollTop = chatBox.scrollHeight;
        }
    });
}

loadRoomsList();
