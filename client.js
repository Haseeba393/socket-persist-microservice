const {io} = require('socket.io-client');

const socket = io("http://127.0.0.1:5000");

socket.on('newMessage',(data)=>{
    console.log('data => '+data);
});

// When device is connected send uuid to server
socket.on('connect',()=>{
    socket.emit('userID', 'abcd');
});