if (!window.nexusInitialized) {

window.nexusInitialized = true;

const panel = document.createElement("div");

panel.id = "nexus-panel";

panel.innerHTML = `
<div id="nexus-header">

  <div id="nexus-title">
    NEXUS AI
  </div>

  <button id="nexus-close">
    ✕
  </button>

</div>

<div id="nexus-content">

  <div id="nexus-chat">

    <div class="nexus-msg nexus-ai">
      NEXUS conectado.
    </div>

  </div>

</div>

<div id="nexus-bottom">

  <input
    id="nexus-input"
    placeholder="Digite algo..."
  />

  <button id="nexus-send">
    ➤
  </button>

</div>
`;

document.body.appendChild(panel);

document.getElementById("nexus-close").onclick = () => {
  panel.style.display = "none";
};

const input = document.getElementById("nexus-input");

const send = document.getElementById("nexus-send");

const chat = document.getElementById("nexus-chat");

function addMessage(text, type) {

  const msg = document.createElement("div");

  msg.className = `nexus-msg nexus-${type}`;

  msg.innerText = text;

  chat.appendChild(msg);

  chat.scrollTop = chat.scrollHeight;
}

send.onclick = () => {

  const text = input.value.trim();

  if (!text) return;

  addMessage(text, "user");

  input.value = "";

  setTimeout(() => {

    addMessage(
      "Resposta simulada da IA: " + text,
      "ai"
    );

  }, 700);

};

chrome.runtime.onMessage.addListener((msg) => {

  if (msg.action === "toggle_nexus") {

    if (panel.style.display === "none") {
      panel.style.display = "flex";
    } else {
      panel.style.display = "none";
    }

  }

});

let dragging = false;

let offsetX = 0;
let offsetY = 0;

const header = document.getElementById("nexus-header");

header.addEventListener("mousedown", (e) => {

  dragging = true;

  offsetX = e.clientX - panel.offsetLeft;
  offsetY = e.clientY - panel.offsetTop;

});

document.addEventListener("mousemove", (e) => {

  if (!dragging) return;

  panel.style.left = `${e.clientX - offsetX}px`;
  panel.style.top = `${e.clientY - offsetY}px`;

  panel.style.right = "auto";

});

document.addEventListener("mouseup", () => {
  dragging = false;
});

}