/* =====================================================================
   HangOut — chat page logic
   Socket model (both ends controlled here + Backend/index.js):
     client -> "identify"   { userId }
     client -> "send-dm"    { to, from, text, time }
     client -> "set-typing" { to, from, typing }
     server -> "recv-dm"    { to, from, text, time }
     server -> "peer-typing"{ to, from, typing }
     server -> "presence"   { userId, online }
     server -> "presence-init" [userId, ...]
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

  var authToken = (loggedUser && loggedUser.token) || null;
  function authHeaders() {
    var h = { "Content-Type": "application/json" };
    if (authToken) h["Authorization"] = "Bearer " + authToken;
    return h;
  }
  var redirecting = false;
  function handle401() {
    if (redirecting) return;
    redirecting = true;
    try { UI.toast("Session expired — please log in again", { type: "error" }); } catch (e) {}
    localStorage.removeItem("LoggedUser");
    setTimeout(function () { location.href = "./login.html"; }, 900);
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

  /* -------- state -------- */
  var users = [];
  var currentPeer = null;
  var onlineSet = new Set();          // userIds currently online
  var threads = {};                   // peerId -> [ {id, text, mine, time, status} ]
  var loadedPeers = new Set();        // peers whose history has been fetched
  var unread = {};                    // peerId -> count
  var lastSender = null;
  var msgSeq = 0;
  var BASE_TITLE = "HangOut · Messages";

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

  function identify() { socket.emit("identify", { userId: myId }); }
  socket.on("connect", identify);
  socket.io.on("reconnect", identify);

  socket.on("presence-init", function (ids) {
    onlineSet = new Set(ids);
    refreshPresenceUI();
  });
  socket.on("presence", function (p) {
    if (!p || !p.userId) return;
    if (p.online) onlineSet.add(p.userId); else onlineSet.delete(p.userId);
    setBlockPresence(p.userId, p.online);
    if (currentPeer && currentPeer._id === p.userId) setPeerStatus(p.online);
  });

  socket.on("recv-dm", function (msg) {
    if (!msg || !msg.from) return;
    var m = { id: msg.id, text: msg.text || "", mine: false, time: msg.time || Date.now() };
    pushThread(msg.from, m);

    // acknowledge delivery to the sender
    socket.emit("dm-delivered", { to: msg.from, from: myId, id: msg.id });

    var openHere = currentPeer && currentPeer._id === msg.from;
    if (openHere) {
      hideTyping();
      renderMessage(m);
      if (isNearBottom()) scrollToBottom(true); else showScrollFab();
      lastSender = "friend";
    }
    // Unread if the chat isn't open, or the tab isn't focused.
    if (!openHere || !isActive()) {
      unread[msg.from] = (unread[msg.from] || 0) + 1;
    } else {
      // read immediately
      socket.emit("dm-read", { to: msg.from, from: myId });
    }
    updateBlock(msg.from, m.text, m.time);
    playIncoming();
    updateTitle();
  });

  socket.on("dm-delivered", function (ack) {
    if (!ack || !ack.from || !ack.id) return;
    var th = threads[ack.from];
    if (!th) return;
    for (var i = 0; i < th.length; i++) {
      if (th[i].id === ack.id && th[i].mine) {
        if (th[i].status === "sent") th[i].status = "delivered";
        if (currentPeer && currentPeer._id === ack.from) updateTick(ack.id, th[i].status);
        break;
      }
    }
  });

  socket.on("dm-read", function (ack) {
    if (!ack || !ack.from) return;
    var th = threads[ack.from];
    if (!th) return;
    th.forEach(function (m) { if (m.mine) m.status = "read"; });
    if (currentPeer && currentPeer._id === ack.from) updateAllMineTicks();
  });

  socket.on("peer-typing", function (state) {
    if (!state || !currentPeer || state.from !== currentPeer._id) return;
    if (state.typing) showTyping(); else hideTyping();
  });

  /* -------- users / chat list -------- */
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
      var res = await fetch("/details/get", { headers: authHeaders() });
      if (res.status === 401) { handle401(); return; }
      if (!res.ok) throw new Error("Failed to load");
      var all = await res.json();
      users = all.filter(function (u) { return String(u._id) !== String(myId); });
      renderChatList(users);
      renderMeCard(all);
    } catch (e) {
      chatlistEl.innerHTML =
        '<div class="empty-state"><h3>Couldn\'t load chats</h3><p>' +
        UI.escapeHtml(e.message) + "</p></div>";
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

      var thread = threads[u._id];
      var last = thread && thread.length ? thread[thread.length - 1] : null;
      var preview = last ? UI.escapeHtml(last.text) : "Tap to start chatting";
      var time = last ? formatTime(last.time) : "";
      var online = onlineSet.has(u._id);

      block.appendChild(UI.avatar(u.name, { seed: u._id, presence: online ? "online" : "offline" }));
      var details = document.createElement("div");
      details.className = "details";
      var count = unread[u._id] || 0;
      details.innerHTML =
        '<div class="listHead"><h4>' + UI.escapeHtml(u.name) + "</h4>" +
        '<span class="time">' + time + "</span></div>" +
        '<div class="message_p"><p class="preview">' + preview + "</p>" +
        (count ? '<b class="unread-badge">' + count + "</b>" : "") + "</div>";
      block.appendChild(details);

      block.addEventListener("click", function () { selectPeer(u); });
      chatlistEl.appendChild(block);
    });
  }

  /* -------- select / open a conversation -------- */
  async function loadHistory(peerId) {
    if (loadedPeers.has(peerId)) return;
    try {
      var res = await fetch("/messages/" + encodeURIComponent(myId) + "/" + encodeURIComponent(peerId), { headers: authHeaders() });
      if (res.status === 401) { handle401(); return; }
      if (!res.ok) return;
      var rows = await res.json();
      var fetched = rows.map(function (r) {
        var mine = String(r.from) === String(myId);
        return {
          id: r.cid || r._id,
          text: r.text,
          mine: mine,
          time: r.time,
          status: mine ? (r.read ? "read" : "delivered") : undefined,
        };
      });
      // Merge with any in-memory messages not yet reflected in the DB fetch.
      var seen = new Set(fetched.map(function (m) { return m.id; }));
      (threads[peerId] || []).forEach(function (m) { if (!seen.has(m.id)) fetched.push(m); });
      fetched.sort(function (a, b) { return a.time - b.time; });
      threads[peerId] = fetched;
      loadedPeers.add(peerId);
    } catch (e) {}
  }

  async function selectPeer(peer) {
    currentPeer = peer;

    Array.prototype.forEach.call(chatlistEl.querySelectorAll(".block"), function (b) {
      b.classList.toggle("active", b.dataset.id === peer._id);
    });

    // header
    peerEl.innerHTML = "";
    peerEl.appendChild(UI.avatar(peer.name, { seed: peer._id, presence: onlineSet.has(peer._id) ? "online" : "offline" }));
    var info = document.createElement("div");
    info.className = "peer-info";
    info.innerHTML =
      '<div class="peer-name">' + UI.escapeHtml(peer.name) + "</div>" +
      '<div class="peer-status"></div>';
    peerEl.appendChild(info);
    setPeerStatus(onlineSet.has(peer._id));

    // swap panels + show loading, then render this thread
    chatEmpty.hidden = true;
    chatActive.hidden = false;
    chatboxEl.innerHTML = '<div class="day-divider">Today</div>';
    await loadHistory(peer._id);
    if (currentPeer !== peer) return; // user switched away while loading
    renderThread(peer._id);
    hideTyping();
    msgInput.focus();

    // clear unread + tell the peer I've read their messages
    if (unread[peer._id]) {
      unread[peer._id] = 0;
      var badge = chatlistEl.querySelector('.block[data-id="' + peer._id + '"] .unread-badge');
      if (badge) badge.remove();
    }
    socket.emit("dm-read", { to: peer._id, from: myId });
    updateTitle();

    if (window.matchMedia("(max-width: 820px)").matches) closeSidebar();
  }

  function renderThread(peerId) {
    chatboxEl.innerHTML = '<div class="day-divider">Today</div>';
    lastSender = null;
    var thread = threads[peerId] || [];
    thread.forEach(function (m) { renderMessage(m); });
    scrollToBottom(false);
  }

  /* -------- messages -------- */
  function pushThread(peerId, m) {
    if (!threads[peerId]) threads[peerId] = [];
    threads[peerId].push(m);
  }

  function updateTick(id, status) {
    var wrap = chatboxEl.querySelector('.message[data-msg-id="' + id + '"]');
    if (!wrap) return;
    var ticks = wrap.querySelector(".ticks");
    if (ticks) ticks.outerHTML = ticksSvg(status);
  }
  function updateAllMineTicks() {
    if (!currentPeer) return;
    var th = threads[currentPeer._id] || [];
    th.forEach(function (m) { if (m.mine && m.id) updateTick(m.id, m.status); });
  }

  function ticksSvg(status) {
    if (status === "sent" || !status) {
      return '<span class="ticks" title="Sent"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>';
    }
    var cls = status === "read" ? "ticks double read" : "ticks double";
    var title = status === "read" ? "Read" : "Delivered";
    return '<span class="' + cls + '" title="' + title + '"><svg viewBox="0 0 30 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 6 7.5 17 4 13.5"/><polyline points="26 6 14 21"/></svg></span>';
  }

  function renderMessage(m) {
    var wrap = document.createElement("div");
    wrap.className = "message " + (m.mine ? "my_msg" : "friend_msg");
    if (m.mine && m.id) wrap.dataset.msgId = m.id;

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
    meta.innerHTML = "<span>" + formatTime(m.time) + "</span>";
    if (m.mine) meta.innerHTML += ticksSvg(m.status || "sent");
    bubble.appendChild(meta);
    wrap.appendChild(bubble);
    chatboxEl.appendChild(wrap);
    lastSender = m.mine ? "me" : "friend";
  }

  function updateBlock(peerId, text, time) {
    var block = chatlistEl.querySelector('.block[data-id="' + peerId + '"]');
    if (!block) return;
    var p = block.querySelector(".preview");
    var t = block.querySelector(".time");
    if (p) p.textContent = text;
    if (t) t.textContent = formatTime(time);
    // move to top for recency
    chatlistEl.prepend(block);
    // unread badge (only when not the open chat)
    if (unread[peerId] && (!currentPeer || currentPeer._id !== peerId)) {
      var mp = block.querySelector(".message_p");
      var badge = block.querySelector(".unread-badge");
      if (!badge && mp) {
        badge = document.createElement("b");
        badge.className = "unread-badge";
        mp.appendChild(badge);
      }
      if (badge) badge.textContent = unread[peerId];
    }
  }

  /* -------- send -------- */
  function sendMessage() {
    var text = msgInput.value.trim();
    if (!text || !currentPeer) return;
    var time = Date.now();
    var id = myId + "-" + time + "-" + (msgSeq++);
    var m = { id: id, text: text, mine: true, time: time, status: "sent" };
    pushThread(currentPeer._id, m);
    renderMessage(m);
    scrollToBottom(true);
    socket.emit("send-dm", { to: currentPeer._id, from: myId, text: text, time: time, id: id });
    updateBlock(currentPeer._id, text, time);
    msgInput.value = "";
    autoGrow();
    updateSendState();
    stopTyping();
    msgInput.focus();
  }

  sendBtn.addEventListener("click", sendMessage);
  msgInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
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
    if (currentPeer) socket.emit("set-typing", { to: currentPeer._id, from: myId, typing: state });
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
  function showTyping() { typingRow.hidden = false; if (isNearBottom()) scrollToBottom(true); }
  function hideTyping() { typingRow.hidden = true; }

  /* -------- presence UI -------- */
  function setPeerStatus(online) {
    var el = peerEl.querySelector(".peer-status");
    if (!el) return;
    el.textContent = online ? "Active now" : "Offline";
    el.classList.toggle("online", !!online);
    var dot = peerEl.querySelector(".presence");
    if (dot) dot.classList.toggle("online", !!online);
  }
  function setBlockPresence(userId, online) {
    var dot = chatlistEl.querySelector('.block[data-id="' + userId + '"] .presence');
    if (dot) dot.classList.toggle("online", !!online);
  }
  function refreshPresenceUI() {
    Array.prototype.forEach.call(chatlistEl.querySelectorAll(".block"), function (b) {
      var dot = b.querySelector(".presence");
      if (dot) dot.classList.toggle("online", onlineSet.has(b.dataset.id));
    });
    if (currentPeer) setPeerStatus(onlineSet.has(currentPeer._id));
  }

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
    renderChatList(q ? users.filter(function (u) { return u.name.toLowerCase().indexOf(q) !== -1; }) : users);
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
  emojiBtn.addEventListener("click", function (e) { e.stopPropagation(); emojiPanel.hidden = !emojiPanel.hidden; });
  emojiPanel.addEventListener("click", function (e) {
    if (e.target.tagName === "BUTTON") {
      msgInput.value += e.target.textContent;
      autoGrow(); updateSendState(); msgInput.focus();
    }
  });
  document.addEventListener("click", function (e) {
    if (!emojiPanel.hidden && !emojiPanel.contains(e.target) && e.target !== emojiBtn) emojiPanel.hidden = true;
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

  /* -------- focus / unread title -------- */
  function isActive() { return !document.hidden && document.hasFocus(); }
  function totalUnread() {
    return Object.keys(unread).reduce(function (n, k) { return n + (unread[k] || 0); }, 0);
  }
  function updateTitle() {
    var n = totalUnread();
    document.title = n > 0 ? "(" + n + ") " + BASE_TITLE : BASE_TITLE;
  }
  function onFocusBack() {
    if (currentPeer && unread[currentPeer._id]) {
      unread[currentPeer._id] = 0;
      var badge = chatlistEl.querySelector('.block[data-id="' + currentPeer._id + '"] .unread-badge');
      if (badge) badge.remove();
      socket.emit("dm-read", { to: currentPeer._id, from: myId });
      updateTitle();
    }
  }
  window.addEventListener("focus", onFocusBack);
  document.addEventListener("visibilitychange", function () { if (isActive()) onFocusBack(); });

  /* -------- notification sound (WebAudio, no assets) -------- */
  var audioCtx = null;
  var soundOn = localStorage.getItem("hangout-sound") !== "off";
  function ensureAudio() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
    } catch (e) {}
  }
  document.addEventListener("click", ensureAudio);
  document.addEventListener("keydown", ensureAudio);

  function playIncoming() {
    if (!soundOn || !audioCtx) return;
    var t = audioCtx.currentTime;
    [[0, 660], [0.08, 990]].forEach(function (p) {
      var o = audioCtx.createOscillator();
      var g = audioCtx.createGain();
      o.type = "sine";
      o.frequency.value = p[1];
      o.connect(g); g.connect(audioCtx.destination);
      g.gain.setValueAtTime(0.0001, t + p[0]);
      g.gain.exponentialRampToValueAtTime(0.16, t + p[0] + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + p[0] + 0.18);
      o.start(t + p[0]); o.stop(t + p[0] + 0.2);
    });
  }

  var SND_ON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14"/></svg>';
  var SND_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>';
  var soundBtn = $("#soundBtn");
  function renderSoundBtn() {
    soundBtn.innerHTML = soundOn ? SND_ON : SND_OFF;
    soundBtn.title = soundOn ? "Mute notifications" : "Unmute notifications";
  }
  soundBtn.addEventListener("click", function () {
    soundOn = !soundOn;
    localStorage.setItem("hangout-sound", soundOn ? "on" : "off");
    renderSoundBtn();
    if (soundOn) { ensureAudio(); playIncoming(); }
    UI.toast(soundOn ? "Sound on" : "Sound muted", { type: soundOn ? "success" : "" });
  });
  renderSoundBtn();

  /* -------- go -------- */
  updateSendState();
  updateTitle();
  loadUsers();
})();
