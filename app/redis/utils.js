var redis = require('./redis');

// Function to get all users
async function getAllUsers() {
    return await redis.getValue('users');
}

// Function to check is user already exist or not
async function isUserAlreadyExist(userId, users) {

    let user = undefined;

    // Finding user
    users.forEach(element => {
        if(element.userId == userId)
            user = element;
    });

    // Filtering users array
    users = users.filter((element, index)=>{
        return (element.userId != userId)
    });

    if(user != undefined)
        return { isFound: true, user: user, filteredUsers: users };
    else
        return { isFound: false };
}

// Function to update redis cache upon incoming userid and socketid
async function makeNewSocketConnection(userId, socketId) {
    try {
        let users = await getAllUsers();
        if(users != undefined && users != null && users.length != 0){

            // parsing users array
            users = JSON.parse(users);

            // Checking is user already exists
            const response = await isUserAlreadyExist(userId, users);
            let messages = [];

            if(response.isFound){
                // Changing some attributes
                let userObj = {
                    ...response.user,
                    connected: true,
                    socketId: socketId,
                    reconnectedAt: new Date().toISOString(),
                };

                // Pushing updated user back in array
                response.filteredUsers.push(userObj);
                users = response.filteredUsers;

                let msgsResponse = await getUserMessages(userId);
                messages = msgsResponse.messages;
            }
            else{
                let userObj = {
                    socketId: socketId,
                    userId: userId,
                    connected: true,
                    connectedAt: new Date().toISOString(),
                    reconnectedAt: new Date().toISOString(),
                }

                // Pushing updated user back in array
                users.push(userObj);
            }

            console.log('users => ', users);

            // Updating Redis
            await redis.setValue('users', JSON.stringify(users));

            return {success: true, messages: messages}
        }
        else{
            // there is no users in redis cache
            let obj = {
                socketId: socketId,
                userId: userId,
                connected: true,
                connectedAt: new Date().toISOString(),
                reconnectedAt: new Date().toISOString(),
            }
            
            // save array in redis cache
            await redis.setValue('users', JSON.stringify([obj]));
        
            console.log('users => ', users);

            return {success: true, messages: []}
        }
    } catch (error) {
        return {success: false, error: error.toString()};
    }   
}

// Function to change connected status of user 
async function disconnectSocketUser(socketId) {
    try {
        let users = await getAllUsers();
        if(users != undefined && users != null && users.length != 0){
            users = JSON.parse(users);
            
            let user = undefined;

            // Finding user
            users.forEach((element, index)=>{
                if(element.socketId == socketId)
                    user = element;
            });

            if(user != undefined){
                // poping user out
                users = users.filter((element, index)=>{
                    return element.userId != user.userId;
                });

                let userObj = {
                    ...user,
                    connected: false,
                    socketId: socketId,
                };

                // Updating users array with updated object
                users.push(userObj);

                // pushing updated array to redis
                redis.setValue('users', JSON.stringify(users));

                console.log(users);
                return {success: true};
            }
            else{
                return {success: false, error: 'user does not exist'};
            }
        }
        else{
            return {success: false, error: 'user does not exist'};
        }
    } catch (error) {
        return {success: false, error: error.toString()};
    }
}

// Function to get user messages
async function getUserMessages(userId) {
    let messages = await redis.getValue(`${userId}_msgs`);
    if(messages != undefined && messages != null && messages.length != 0){
        // Empty buffer
        await redis.setValue(`${userId}_msgs`, '');
        
        // returning messsages array
        return {success: true, messages: JSON.parse(messages)};
    }
    else{
        return {success: false, messages: [], error: 'User do not have any message in buffer'};
    }
}

async function isUserConnected(userId){
    try {   
        let users = await getAllUsers();
        if(users != undefined && users != null && users.length != 0){
            users = JSON.parse(users);

            let find = false;
            users.forEach((element, index)=>{
                if(element.userId == userId && element.connected)
                    find = true;
            });

            if(find)
                return { success: true, connected: true }  
            else
                return {success: true, connected: false}
        }
        else{
            return {success: false, error: 'user does not exist in redis'}
        }
    } catch (error) {
        return {success: false, error: error.toString()};
    }
}

// Function to handle socket message
async function handleMessage(userId, message) {
    try {

        const response = await isUserConnected(userId);
        console.log('response => ', response);
        if(response.success && response.connected){
            // Emit immediately
            console.log('emit immediately');
            return {success: true, immediate: true};
        }
        else if(response.success && !response.connected){
            // save message
            let messages = await redis.getValue(`${userId}_msgs`);
            if(messages != undefined && messages != null && messages.length != 0){
                
                messages = JSON.parse(messages);

                messages.push(message);

                // Update Message buffer
                await redis.setValue(`${userId}_msgs`, JSON.stringify(messages));
                
                // returning messsages array
                console.log('emit immediately false => ', messages);
                return {success: true, immediate: false};
            }
            else{
                // Update Message buffer
                await redis.setValue(`${userId}_msgs`, JSON.stringify([message]));
                return {success: true, immediate: false};
            }
        }
        else{
            return {success: false, error: response.error};
        }
    } catch (error) {
        return {success: false, error: error.toString()};
    }
}

module.exports = {
    makeNewSocketConnection,
    disconnectSocketUser,
    handleMessage,
}