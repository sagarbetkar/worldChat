const express = require("express");
const app = express();
const path = require("path");
const server = require("http").createServer(app);
const io = require("socket.io")(server);
const port = process.env.PORT || 3000;

// Routing
app.use(express.static(path.join(__dirname, "public")));

let numUsers = 0;

io.on("connection", socket => {
  let addedUser;

  socket.on("add user", username => {
    console.log(username);
    if (addedUser) return;

    socket.username = username;
    ++numUsers;
    socket.emit("login", {
      numUsers: numUsers
    });

    socket.broadcast.emit("user joined", {
      username: socket.username,
      numUsers: numUsers
    });
  });

  socket.on("typing", () => {
    socket.broadcast.emit("typing", {
      username: socket.username
    });
  });
  socket.on("stop typing", () => {
    socket.broadcast.emit("stop typing", {
      username: socket.username
    });
  });

  socket.on("new message", data => {
    socket.broadcast.emit("new message", {
      username: socket.username,
      message: data
    });
  });

  socket.on("disconnect", () => {
    if (addedUser) {
      --numUsers;

      socket.boardcast.emit("user left", {
        username: socket.username,
        numUsers: numUsers
      });
    }
  });
});

server.listen(port, () => {
  console.log("Server listening at port %d", port);
});
