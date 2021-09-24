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
app.use(cors({origin:true}));
let PORT = process.env.PORT || 3000; 

// Writing route to send message to user if connected
// or persist message if not connected
app.post('/sendMessage', async (req, res)=>{
  try {
    let userid = req.body.user_id;

    // Checking parameters
    if(userid == undefined || userid.length == 0){
      res.send({
        errorCode: 400,
        success: false,
        message: 'User id is required',
      });
      return;
    }

    //Handling persistence
    const result = await redis.isUserConnected(userid, 'hello');
    if(result.success && result.immediate){
      console.log('SENDING');
      socketInstance.to(userid).emit('newMessage', 'hello');
    }
    else if(result.success && !result.immediate){
      console.log('PERSISTING MSG');
    }
    else
    {
      console.log('SENDING ERROR => ', result.error);
      res.send({
        errorCode: 404,
        success: false,
        message: result.error,
      });
      return;
    }
    
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
const server = app.listen(PORT,()=>{ 
    console.log('Server started on port: ' + PORT); 
});

// Initializing socket on express server
const io = socket(server);

// Listening for socket connections
io.on("connection", function (socket) {

  // Initializing socket instance for further use
  socketInstance = socket;

  /***** Handling Socket Connetion Starts *****/
  socket.on("userID", async (userid)=>{
    socket.join(userid);

    console.log(`socket is joined ${userid}`);
      
    const result = await redis.newConnection(userid, socket.id);
    if(result.success){
      // Emitting Persistant messages
      console.log("EMITTING MESSAGES => ", result.messages);
      result.messages.forEach((msg, index)=>{
        socket.to(userid).emit("newMessage", msg);
      });
    }
    else{
      console.log('Connection Error => ', result.error);
    }
  });
  /***** Handling Socket Connetion Ends *****/

  /***** Handling Socket Disconnect Starts *****/
  socket.on("disconnect", async () => {
    const response = await redis.disconnectConnection(socket.id);
    if(response.success){
      console.log(`socket is disconnected ${socket.id}`);
    }
    else{
      console.log(`Disconnect Error => ${response.error}`);
    }
  });
  /***** Handling Socket Disconnect Ends *****/
});