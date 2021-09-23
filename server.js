var express = require('express');
const socket = require("socket.io");
var cors = require('cors');
var redis = require('./service/utils');

// Configuring environment variables
require('dotenv').config();

// declaring socket instance
var socketInstance = undefined;

// setting up the express server
let app = express();
app.use(express.json());
app.use(cors());
let PORT = process.env.PORT || 3000;

// Writing route to send message to user if connected
// or persist message if not connected
app.post('/sendMessage', async (req, res) => {
  try {
    let userid = req.body.user_id;

    // Checking parameters
    if (userid == undefined || userid.length == 0) {
      res.send({
        errorCode: 400,
        success: false,
        message: 'User id is required',
      });
      return;
    }

    //Handling persistence
    const result = await redis.handleMessage(userid, 'hello');
    if (result.success && result.immediate) {
      console.log('sending');
      socketInstance.to(userid).emit('newMessage', 'hello');
      socketInstance.emit('action', 'hello');
    }
    else if (result.success && !result.immediate) {
      console.log('Persisting Message');
    }
    else
      console.log('Persisting Error => ', result.error);

    // Sending Message to user
    res.send({
      errorCode: 200,
      success: true,
      message: 'Your message has been sent',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    res.send({
      errorCode: error.code,
      success: false,
      message: error.message
    })
  }

});


// Starting express server
const server = app.listen(PORT, () => {
  console.log('Server started on port: ' + PORT);
});

// Initializing socket on express server
const io = socket(server);

// Listening for socket connections
io.on("connection", function (socket) {

  // Initializing socket instance for further use
  socketInstance = socket;

  /***** Handling Socket Connetion Starts *****/
  socket.on("userID", async (userid) => {
    socket.join(userid);
    console.log(`socket is joined ${userid}`);

    const result = await redis.makeNewSocketConnection(userid, socket.id);
    if (result.success) {
      // Emitting Persistant messages
      console.log("EMITTING MESSAGES => ", result.messages);
      result.messages.forEach((msg, index) => {
        socket.to(userid).emit("newMessage", msg);
      });
    }
    else {
      console.log('Connection Error => ', result.error);
    }
  });
  /***** Handling Socket Connetion Ends *****/

  /***** Handling Socket Disconnect Starts *****/
  socket.on("disconnect", async () => {
    const response = await redis.disconnectSocketUser(socket.id);
    if (response.success) {
      console.log(`socket is disconnected ${socket.id}`);
    }
    else {
      console.log(`Disconnect Error => ${response.error}`);
    }
  });
  /***** Handling Socket Disconnect Ends *****/
});