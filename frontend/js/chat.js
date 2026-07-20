/* =====================================================================
   HangOut — chat page logic
   Preserves the original socket contract:
     emit "roomName" {roomid, id}  ·  emit "friend_msg"  ·  on "join"
     on "display_friend_msg"       ·  (added) "typing" / "display_typing"
   Endpoints: GET /details/get, GET /user/logout
   Auth state: localStorage "LoggedUser" = { email, id }
   ===================================================================== */
(function () {
  "use strict";

  /* -------- auth guard -------- */
  var loggedUser = null;
  try { loggedUser = JSON.parse(localStorage.getItem("LoggedUser")); } catch (e) {}

  var params = new URLSearchParams(location.search);
  var myId = params.get("id") || (loggedUser && loggedUser.id);
  if (!myId) {
    location.href = "./login.html";
    return;
  }

  /* -------- elements -------- */
  var $ = function (s) { return document.querySelector(s); };
  var app = $("#app");
  var chatlistEl = $("#chatlist");
  var chatboxEl = $("#chatbox");
  var chatEmpty = $("#chatEmpty");
  var chatActive = $("#chatActive");
  var peerEl = $("#peer");
  var msgInput = $("#msgInput");
  var sendBtn = $("#msg_send");
  var typingRow = $("#typingRow");
  var scrollFab = $("#scrollFab");
  var searchInput = $("#searchInput");
  var meCard = $("#meCard");
  var scrim = $("#scrim");

  /* -------- theme + basic wiring -------- */
  UI.mountThemeToggle("#themeToggle");

  $("#logo_msg").addEventListener("click", function () { location.href = "./index.html"; });

  $("#logoutBtn").addEventListener("click", async function () {
    try {
      await fetch("/user/logout", { method: "GET", headers: { "Content-Type": "application/json" } });
    } catch (e) {}
    UI.toast("Logged out", { type: "success" });
    setTimeout(function () { location.href = "./login.html"; }, 500);
  });

  /* -------- socket -------- */
  var socket = io({ transports: ["websocket"] });
  var currentPeer = null;
  var reconnecting = false;

  socket.on("connect", function () {
    if (currentPeer) socket.emit("roomName", { roomid: currentPeer._id, id: myId });
  });

  socket.on("display_friend_msg", function (data) {
    hideTyping();
    var text = typeof data === "string" ? data : (data && data.text) || "";
    var time = (data && data.time) || Date.now();
    appendMessage({ text: text, mine: false, time: time });
  });

  socket.on("display_typing", function (state) {
    if (state && state.typing) showTyping(); else hideTyping();
  });

  /* -------- users / chat list -------- */
  var users = [];
  var lastMessages = {}; // peerId -> {text, time}

  function showSkeletons() {
    var html = "";
    for (var i = 0; i < 6; i++) {
      html +=
        '<div class="sk-row">' +
        '<div class="skeleton circle" style="width:44px;height:44px"></div>' +
        '<div class="sk-txt">' +
        '<div class="skeleton" style="height:12px;width:55%"></div>' +
        '<div class="skeleton" style="height:10px;width:80%"></div>' +
        "</div></div>";
    }
    chatlistEl.innerHTML = html;
  }

  async function loadUsers() {
    showSkeletons();
    try {
      var res = await fetch("/details/get", { headers: { "Content-Type": "application/json" } });
      if (!res.ok) throw new Error("Failed to load");
      var all = await res.json();
      // Exclude myself from the conversation list
      users = all.filter(function (u) { return String(u._id) !== String(myId); });
      renderChatList(users);
      renderMeCard(all);
    } catch (e) {
      chatlistEl.innerHTML =
        '<div class="empty-state"><h3>Couldn\'t load chats</h3><p>' +
        UI.escapeHtml(e.message) +
        '</p></div>';
      UI.toast("Could not load conversations", { type: "error" });
    }
  }

  function renderMeCard(all) {
    var me = all.filter(function (u) { return String(u._id) === String(myId); })[0];
    var name = (me && me.name) || (loggedUser && loggedUser.email) || "You";
    meCard.innerHTML = "";
    meCard.appendChild(UI.avatar(name, { size: "sm", seed: myId }));
    var info = document.createElement("div");
    info.className = "me-info";
    info.innerHTML =
      '<div class="me-name">' + UI.escapeHtml(name) + "</div>" +
      '<div class="me-status">Online</div>';
    meCard.appendChild(info);
  }

  function renderChatList(list) {
    if (!list.length) {
      chatlistEl.innerHTML =
        '<div class="empty-state"><h3>No conversations</h3><p>Invite a friend to sign up and start chatting.</p></div>';
      return;
    }
    chatlistEl.innerHTML = "";
    list.forEach(function (u, i) {
      var block = document.createElement("div");
      block.className = "block";
      block.setAttribute("role", "listitem");
      block.dataset.id = u._id;
      block.style.animationDelay = Math.min(i * 30, 300) + "ms";

      var last = lastMessages[u._id];
      var preview = last ? UI.escapeHtml(last.text) : "Tap to start chatting";
      var time = last ? formatTime(last.time) : "";

      block.appendChild(UI.avatar(u.name, { seed: u._id, presence: "offline" }));
      var details = document.createElement("div");
      details.className = "details";
      details.innerHTML =
        '<div class="listHead"><h4>' + UI.escapeHtml(u.name) + "</h4>" +
        '<span class="time">' + time + "</span></div>" +
        '<div class="preview">' + preview + "</div>";
      block.appendChild(details);

      block.addEventListener("click", function () { selectPeer(u); });
      chatlistEl.appendChild(block);
    });
  }

  /* -------- select / join a conversation -------- */
  function selectPeer(peer) {
    currentPeer = peer;

    // highlight active
    Array.prototype.forEach.call(chatlistEl.querySelectorAll(".block"), function (b) {
      b.classList.toggle("active", b.dataset.id === peer._id);
    });

    // header
    peerEl.innerHTML = "";
    peerEl.appendChild(UI.avatar(peer.name, { seed: peer._id, presence: "online" }));
    var info = document.createElement("div");
    info.className = "peer-info";
    info.innerHTML =
      '<div class="peer-name">' + UI.escapeHtml(peer.name) + "</div>" +
      '<div class="peer-status online">Active now</div>';
    peerEl.appendChild(info);

    // swap panels + reset thread
    chatEmpty.hidden = true;
    chatActive.hidden = false;
    chatboxEl.innerHTML = '<div class="day-divider">Today</div>';
    hideTyping();
    msgInput.focus();

    // (re)join room on a fresh connection to avoid stacked backend listeners
    if (socket.connected) {
      reconnecting = true;
      socket.disconnect();
      socket.connect();
    } else {
      socket.connect();
    }

    if (window.matchMedia("(max-width: 820px)").matches) closeSidebar();
  }

  /* -------- messages -------- */
  var lastSender = null;

  function appendMessage(m) {
    var wrap = document.createElement("div");
    wrap.className = "message " + (m.mine ? "my_msg" : "friend_msg");

    // avatar for friend messages (hidden on consecutive to group)
    if (!m.mine) {
      var av = UI.avatar(currentPeer ? currentPeer.name : "?", {
        size: "sm", seed: currentPeer && currentPeer._id,
      });
      av.classList.add("msg-avatar");
      if (lastSender === "friend") av.classList.add("hidden");
      wrap.appendChild(av);
    }

    var bubble = document.createElement("div");
    bubble.className = "bubble";
    var textNode = document.createElement("div");
    textNode.textContent = m.text;
    bubble.appendChild(textNode);

    var meta = document.createElement("div");
    meta.className = "meta";
    meta.innerHTML = '<span>' + formatTime(m.time) + "</span>";
    if (m.mine) {
      meta.innerHTML +=
        '<span class="ticks" title="Sent"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>';
    }
    bubble.appendChild(meta);
    wrap.appendChild(bubble);

    var nearBottom = isNearBottom();
    chatboxEl.appendChild(wrap);
    lastSender = m.mine ? "me" : "friend";

    // update sidebar preview
    if (currentPeer) {
      lastMessages[currentPeer._id] = { text: m.text, time: m.time };
      updatePreview(currentPeer._id, m.text, m.time);
    }

    if (m.mine || nearBottom) scrollToBottom(true);
    else showScrollFab();
  }

  function updatePreview(peerId, text, time) {
    var block = chatlistEl.querySelector('.block[data-id="' + peerId + '"]');
    if (!block) return;
    var p = block.querySelector(".preview");
    var t = block.querySelector(".time");
    if (p) p.textContent = text;
    if (t) t.textContent = formatTime(time);
  }

  /* -------- send -------- */
  function sendMessage() {
    var text = msgInput.value.trim();
    if (!text || !currentPeer) return;
    var time = Date.now();
    appendMessage({ text: text, mine: true, time: time });
    socket.emit("friend_msg", { text: text, time: time });
    msgInput.value = "";
    autoGrow();
    updateSendState();
    stopTyping();
    msgInput.focus();
  }

  sendBtn.addEventListener("click", sendMessage);
  msgInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  /* -------- textarea auto-grow + typing -------- */
  function autoGrow() {
    msgInput.style.height = "auto";
    msgInput.style.height = Math.min(msgInput.scrollHeight, 140) + "px";
  }
  function updateSendState() { sendBtn.disabled = !msgInput.value.trim(); }

  var typingTimer = null;
  var amTyping = false;
  function emitTyping(state) {
    if (currentPeer) socket.emit("typing", { typing: state });
  }
  function startTyping() {
    if (!amTyping) { amTyping = true; emitTyping(true); }
    clearTimeout(typingTimer);
    typingTimer = setTimeout(stopTyping, 1500);
  }
  function stopTyping() {
    clearTimeout(typingTimer);
    if (amTyping) { amTyping = false; emitTyping(false); }
  }

  msgInput.addEventListener("input", function () {
    autoGrow();
    updateSendState();
    if (msgInput.value.trim()) startTyping(); else stopTyping();
  });

  /* -------- typing indicator (incoming) -------- */
  function showTyping() {
    typingRow.hidden = false;
    if (isNearBottom()) scrollToBottom(true);
  }
  function hideTyping() { typingRow.hidden = true; }

  /* -------- scroll handling -------- */
  function isNearBottom() {
    return chatboxEl.scrollHeight - chatboxEl.scrollTop - chatboxEl.clientHeight < 120;
  }
  function scrollToBottom(smooth) {
    chatboxEl.scrollTo({ top: chatboxEl.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    hideScrollFab();
  }
  function showScrollFab() { scrollFab.hidden = false; }
  function hideScrollFab() { scrollFab.hidden = true; }

  chatboxEl.addEventListener("scroll", function () {
    if (isNearBottom()) hideScrollFab(); else showScrollFab();
  });
  scrollFab.addEventListener("click", function () { scrollToBottom(true); });

  /* -------- search -------- */
  searchInput.addEventListener("input", function () {
    var q = searchInput.value.trim().toLowerCase();
    renderChatList(
      q ? users.filter(function (u) { return u.name.toLowerCase().indexOf(q) !== -1; }) : users
    );
    if (currentPeer) {
      var b = chatlistEl.querySelector('.block[data-id="' + currentPeer._id + '"]');
      if (b) b.classList.add("active");
    }
  });

  /* -------- emoji -------- */
  var EMOJIS = "😀 😁 😂 🤣 😊 😍 😘 😎 🤩 🥳 🤔 😴 😇 🙃 😜 🤗 👍 👏 🙌 🙏 💪 👀 🔥 ✨ 🎉 ❤️ 🧡 💛 💚 💙 💜 🖤 💯 ✅ ⭐ 🚀 ☕ 🍕 🎁 🐶".split(" ");
  var emojiBtn = $("#emojiBtn");
  var emojiPanel = $("#emojiPanel");
  emojiPanel.innerHTML = EMOJIS.map(function (e) { return "<button type='button'>" + e + "</button>"; }).join("");
  emojiBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    emojiPanel.hidden = !emojiPanel.hidden;
  });
  emojiPanel.addEventListener("click", function (e) {
    if (e.target.tagName === "BUTTON") {
      msgInput.value += e.target.textContent;
      autoGrow();
      updateSendState();
      msgInput.focus();
    }
  });
  document.addEventListener("click", function (e) {
    if (!emojiPanel.hidden && !emojiPanel.contains(e.target) && e.target !== emojiBtn) {
      emojiPanel.hidden = true;
    }
  });

  /* -------- mobile sidebar -------- */
  function openSidebar() { app.classList.add("sidebar-open"); scrim.hidden = false; }
  function closeSidebar() { app.classList.remove("sidebar-open"); scrim.hidden = true; }
  $("#backBtn").addEventListener("click", openSidebar);
  scrim.addEventListener("click", closeSidebar);
  if (window.matchMedia("(max-width: 820px)").matches) openSidebar();

  /* -------- time formatting -------- */
  function formatTime(ts) {
    var d = new Date(ts);
    var h = d.getHours();
    var m = d.getMinutes();
    var ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return h + ":" + (m < 10 ? "0" + m : m) + " " + ampm;
  }

  /* -------- go -------- */
  updateSendState();
  loadUsers();
})();
