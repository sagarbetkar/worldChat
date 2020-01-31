$(function() {
  const FADE_TIME = 150;
  const TYPING_TIMER_LENGTH = 400; // ms
  const COLORS = [
    "#e21400",
    "#91580f",
    "#f8a700",
    "#f78b00",
    "#58dc00",
    "#287b00",
    "#a8f07a",
    "#4ae8c4",
    "#3b88eb",
    "#3824aa",
    "#a700ff",
    "#d300e7"
  ];

  window.SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  recognition.interimResults = true;

  const socket = io();
  const $window = $(window);
  const $usernameInput = $(".usernameInput");
  const $messages = $(".messages");
  const $inputMessage = $(".input-box .inputMessage");
  const $microphone = document.querySelector(".input-box button");

  const $loginPage = $(".login.page");
  const $chatPage = $(".chat.page");

  let username;
  let connected = false;
  let typing = false;
  let $currentInput = $usernameInput.focus();

  socket.on("login", data => {
    connected = true;
    const message = "Welcome to WorldChat";
    log(message, {
      prepend: true
    });
    addParticipantsMessage(data);
  });

  socket.on("user joined", data => {
    log(data.username + " joined");
    addParticipantsMessage(data);
  });

  socket.on("new message", function(data) {
    addChatMessage(data);
  });

  socket.on("user left", function(data) {
    log(data.username + " left");
    addParticipantsMessage(data);
    removeChatTyping(data);
  });

  // Whenever the server emits 'typing', show the typing message
  socket.on("typing", function(data) {
    addChatTyping(data);
  });

  // Whenever the server emits 'stop typing', kill the typing message
  socket.on("stop typing", function(data) {
    removeChatTyping(data);
  });

  socket.on("disconnect", function() {
    log("you have been disconnected");
  });

  socket.on("reconnect", function() {
    log("you have been reconnected");
    if (username) {
      socket.emit("add user", username);
    }
  });

  socket.on("reconnect_error", function() {
    log("attempt to reconnect has failed");
  });

  socket.on("my-name-is", function(serverName) {
    log("host is now " + serverName);
  });

  function getUsernameColor(username) {
    // Compute hash code
    var hash = 7;
    for (var i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + (hash << 5) - hash;
    }
    // Calculate color
    var index = Math.abs(hash % COLORS.length);
    return COLORS[index];
  }

  function getTypingMessages(data) {
    return $(".typing.message").filter(function(i) {
      return $(this).data("username") === data.username;
    });
  }

  function removeChatTyping(data) {
    getTypingMessages(data).fadeOut(function() {
      $(this).remove();
    });
  }

  function addChatTyping(data) {
    data.typing = true;
    data.message = "is typing";
    addChatMessage(data);
  }

  function addChatMessage(data, options) {
    const $typingMessages = getTypingMessages(data);
    options = options || {};
    if ($typingMessages.length !== 0) {
      options.fade = false;
      $typingMessages.remove();
    }

    const $usernameDiv = $('<span class="username"/>')
      .text(data.username)
      .css("color", getUsernameColor(data.username));
    const $messageBodyDiv = $('<span class="messageBody">').text(data.message);

    const typingClass = data.typing ? "typing" : "";
    const $messageDiv = $('<li class="message"/>')
      .data("username", data.username)
      .addClass(typingClass)
      .append($usernameDiv, $messageBodyDiv);

    addMessageElement($messageDiv, options);
  }

  function updateTyping() {
    if (connected) {
      if (!typing) {
        typing = true;
        socket.emit("typing");
      }
      lastTypingTime = new Date().getTime();

      setTimeout(() => {
        const typingTimer = new Date().getTime();
        const timeDiff = typingTimer - lastTypingTime;
        if (timeDiff >= TYPING_TIMER_LENGTH && typing) {
          socket.emit("stop typing");
          typing = false;
        }
      }, TYPING_TIMER_LENGTH);
    }
  }

  function addParticipantsMessage(data) {
    let message = "";
    if (data.numUsers === 1) {
      message += "there's 1 participant";
    } else {
      message += "there are " + data.numUsers + " participants";
    }
    log(message);
  }

  function addMessageElement(el, options) {
    var $el = $(el);

    // Setup default options
    if (!options) {
      options = {};
    }
    if (typeof options.fade === "undefined") {
      options.fade = true;
    }
    if (typeof options.prepend === "undefined") {
      options.prepend = false;
    }

    // Apply options
    if (options.fade) {
      $el.hide().fadeIn(FADE_TIME);
    }
    if (options.prepend) {
      $messages.prepend($el);
    } else {
      $messages.append($el);
    }
    $messages[0].scrollTop = $messages[0].scrollHeight;
  }

  function log(message, options) {
    const $el = $("<li>")
      .addClass("log")
      .text(message);
    addMessageElement($el, options);
  }

  function cleanInput(input) {
    return $("<div/>")
      .text(input)
      .text();
  }

  function sendMessage() {
    let message = $inputMessage.val();

    message = cleanInput(message);

    if (message && connected) {
      $inputMessage.val("");
      addChatMessage({
        username: username,
        message: message
      });

      socket.emit("new message", message);
    }
  }

  function setUsername() {
    username = cleanInput($usernameInput.val().trim());

    if (username) {
      $loginPage.fadeOut();
      $chatPage.show();
      $loginPage.off("click");
      $currentInput = $inputMessage.focus();

      socket.emit("add user", username);
    }
  }

  $window.keydown(event => {
    if (!(event.ctrlKey || event.metaKey || event.altKey)) {
      $currentInput.focus();
    }

    if (event.which === 13) {
      if (username) {
        sendMessage();
        socket.emit("stop Typing");
        typing = false;
      } else {
        setUsername();
      }
    }
  });

  recognition.addEventListener("result", e => {
    const transcript = Array.from(e.results)
      .map(result => result[0])
      .map(result => result.transcript)
      .join("");

    $inputMessage.val(transcript);
    if (e.results[0].isFinal) {
      sendMessage();
    }
  });

  $microphone.addEventListener("mousedown", () => {
    recognition.start();
  });

  $microphone.addEventListener("mouseup", () => {
    recognition.stop();
  });

  $inputMessage.on("input", () => {
    updateTyping();
  });

  // focus on input when clicking anywhere on login page
  $loginPage.click(() => {
    $currentInput.focus();
  });

  $inputMessage.click(() => {
    $inputMessage.focus();
  });
});
