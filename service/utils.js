var redis = require('./redis');

/**
 * Function that return unix timestamp
 * @returns Number
 */
function getUnixTime(){
    return new Date().getTime()/1000;
}

/**
 * Function to persist user message
 * @param {string} userId 
 * @param {string} msg 
 */
async function persistMessage(userId, msg){
    let messages = await redis.getValue(`${userId}_msgs`);
    if(messages != null && messages != undefined){
        messages = JSON.parse(messages);
        messages.push(msg);
        await redis.setValue(`${userId}_msgs`, JSON.stringify(messages));
    }
    else{
        await redis.setValue(`${userId}_msgs`, JSON.stringify([msg]));
    }
    console.log("MESSAGES => ", messages);
}

/**
 * Fcuntion to check is user connected
 * @param {string} userId 
 * @param {string} msg 
 */
async function isUserConnected(userId, msg){
    let user = await redis.getValue(`${userId}`);
    if(user != null && user != undefined){
        user = JSON.parse(user);
        if(user.connected)
            return {success: true, immediate: true};
        else{
            await persistMessage(userId, msg);
            return {success: true, immediate: false};
        }
    }
    else{
        return {success: false, error: 'User does not exists'}
    }
}

/**
 * Function that return userId against socketId
 * @returns Number
*/
async function getUserID(socketId){
    const userId = await redis.getValue(`${socketId}`);
    
    // Remove this socket id from redis
    await redis.removeValue(`${socketId}`);

    return userId;
}

/**
 * Function to determine is it a new or old user
 * @param {string} userId 
 */
async function isOldUser(userId){
    const user = await redis.getValue(`${userId}`);
    if(user != null && user != undefined)
        return true;
    else
        return false;
}

/**
 * Function to get user messages if exists
 * @param {string} userId 
 */
async function getUserMessages(userId){
    try {
        const messages = await redis.getValue(`${userId}_msgs`);
        if(messages != null && messages != undefined){

            // Removing user messages from redis
            await redis.removeValue(`${userId}_msgs`);

            // returning messages
            return JSON.parse(messages);
        }
        else
            return [];
    } catch (error) {
        console.log("GET MSG ERROR => ", error);
        return [];
    }
}

/**
 * Function to add new user or update existing one
 * @param {string} userId 
 * @param {string} socketId 
 */
async function newConnection(userId, socketId){
    try {
        let messages = [];
        let userObj = undefined;

        // Checking is it a new connection or old one coming back
        if(await isOldUser(userId)){

            // Updating old user
            const user = JSON.parse(await redis.getValue(`${userId}`));
            userObj = {
                ...user,
                socketId: socketId,
                connected: true,
                reconnectedAt: getUnixTime(),
            };

            // Getting messages
            messages = await getUserMessages(userId);
        }
        else{

            // Saving new connection
            userObj = {
                socketId: socketId,
                connected: true,
                connectedAt: getUnixTime(),
                reconnectedAt: getUnixTime(),
            };
        }

        console.log("CONNECTED => ", userObj);
        console.log("MESSAGES => ", messages);
        console.log();
        // Save new user in redis and its userId against its socket id
        await redis.setValue(`${userId}`, JSON.stringify(userObj));
        await redis.setValue(`${socketId}`, `${userId}`);

        return {success: true, messages: messages};
    } catch (error) {
        return {success: false, error: error.toString()};
    }
}

/**
 * Function to disconnect user
 * @param {string} socketId 
 */
 async function disconnectConnection(socketId){
    try {

        // Get userId using socket id
        const userId = await getUserID(socketId);

        // Update User Object
        const user = JSON.parse(await redis.getValue(`${userId}`));
        let userObj = {
            ...user,
            connected: false,
        };

        console.log("DISCONNECTED => ", userObj);

        // Updating user in redis
        await redis.setValue(`${userId}`, JSON.stringify(userObj));

        return {success: true};
    } catch (error) {
        return {success: false, error: error.toString()};
    }
}

module.exports = {
    newConnection,
    disconnectConnection,
    isUserConnected,
}