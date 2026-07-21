import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, arrayUnion } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

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
const joinBtn = document.getElementById("join-btn");
const usernameInput = document.getElementById("username");
const roomCodeInput = document.getElementById("room-code");
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

joinBtn.addEventListener("click", async () => {
    playerName = usernameInput.value.trim();
    roomCode = roomCodeInput.value.trim();

    if (!playerName || !roomCode) {
        alert("Заполните все поля!");
        return;
    }

    const roomRef = doc(db, "rooms", roomCode);
    const roomSnap = await getDoc(roomRef);

    if (!roomSnap.exists()) {
        await setDoc(roomRef, {
            host: playerName,
            status: "waiting",
            players: [{ name: playerName, role: "Ожидание", alive: true }],
            messages: []
        });
    } else {
        const data = roomSnap.data();
        if (data.status !== "waiting") {
            alert("Игра уже началась в этой комнате!");
            return;
        }
        const exists = data.players.find(p => p.name === playerName);
        if (!exists) {
            await updateDoc(roomRef, {
                players: arrayUnion({ name: playerName, role: "Ожидание", alive: true })
            });
        }
    }

    loginScreen.classList.add("hidden");
    gameScreen.classList.remove("hidden");
    roomTitleBar.innerText = `Мафия - Комната: ${roomCode}`;

    subscribeToRoom();
});

startBtn.addEventListener("click", async () => {
    const roomRef = doc(db, "rooms", roomCode);
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists()) return;
    
    const data = roomSnap.data();
    let players = data.players;
    
    if (players.length < 3) {
        alert("Нужно хотя бы 3 игрока для старта!");
        return;
    }

    const rolesPool = ["Мафия", "Шериф", "Путана"];
    while (rolesPool.length < players.length) {
        rolesPool.push("Мирный");
    }

    rolesPool.sort(() => Math.random() - 0.5);

    players.forEach((p, index) => {
        p.role = rolesPool[index];
        p.alive = true;
    });

    await updateDoc(roomRef, {
        status: "night",
        players: players,
        messages: arrayUnion({ sender: "Система", time: new Date().toLocaleTimeString().slice(0, 5), text: "Игра началась! Наступила ночь. Роли распределены." })
    });
});

actionBtn.addEventListener("click", async () => {
    const targetName = targetSelect.value;
    if (!targetName) return;

    const roomRef = doc(db, "rooms", roomCode);
    const roomSnap = await getDoc(roomRef);
    const data = roomSnap.data();

    const me = data.players.find(p => p.name === playerName);
    let actionText = `${playerName} (${me.role}) сделал выбор: ${targetName}`;
    
    await updateDoc(roomRef, {
        messages: arrayUnion({ sender: "Ночной ход", time: new Date().toLocaleTimeString().slice(0, 5), text: actionText })
    });

    alert("Ваш ход принят!");
    actionBtn.classList.add("hidden");
    targetSelect.classList.add("hidden");
    actionInstruction.innerText = "Ход сделан. Ожидание остальных...";
});

function linkify(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, function(url) {
        return `<a href="${url}" target="_blank">${url}</a>`;
    });
}

async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    const roomRef = doc(db, "rooms", roomCode);
    await updateDoc(roomRef, {
        messages: arrayUnion({
            sender: playerName,
            text: text,
            time: new Date().toLocaleTimeString().slice(0, 5)
        })
    });

    chatInput.value = "";
}

sendChatBtn.addEventListener("click", sendMessage);
chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
});

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
        if (me) {
            if (data.status === "waiting") {
                roleDisplay.innerText = "Ваша роль: Ожидание начала игры...";
            } else {
                roleDisplay.innerText = `Ваша роль: ${me.role} (${me.alive ? 'Жив' : 'Мертв'})`;
                
                if (data.status === "night" && me.alive) {
                    if (me.role === "Мафия" || me.role === "Шериф" || me.role === "Путана") {
                        actionInstruction.innerText = getInstructionForRole(me.role);
                        targetSelect.innerHTML = "";
                        
                        data.players.forEach(p => {
                            if (p.name !== playerName && p.alive) {
                                const opt = document.createElement("option");
                                opt.value = p.name;
                                opt.innerText = p.name;
                                targetSelect.appendChild(opt);
                            }
                        });

                        targetSelect.classList.remove("hidden");
                        actionBtn.classList.remove("hidden");
                    } else {
                        actionInstruction.innerText = "Ночь. Вы мирный житель, спите и ждете утра.";
                        targetSelect.classList.add("hidden");
                        actionBtn.classList.add("hidden");
                    }
                } else if (data.status === "day") {
                    actionInstruction.innerText = "Наступил день. Обсуждайте и голосуйте в чате!";
                    targetSelect.classList.add("hidden");
                    actionBtn.classList.add("hidden");
                }
            }
        }

        if (data.messages) {
            chatBox.innerHTML = "";
            data.messages.forEach(msg => {
                const div = document.createElement("div");
                div.className = "chat-msg";
                div.innerHTML = `<b>[${msg.time}] ${msg.sender}:</b> ${linkify(msg.text)}`;
                chatBox.appendChild(div);
            });
            chatBox.scrollTop = chatBox.scrollHeight;
        }
    });
}

function getInstructionForRole(role) {
    if (role === "Мафия") return "Выберите жертву для устранения:";
    if (role === "Шериф") return "Выберите игрока для проверки (Шериф проверяет статус):";
    if (role === "Путана") return "Выберите игрока, к которому пойдете ночью:";
    return "";
}
