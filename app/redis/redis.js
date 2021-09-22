const Redis = require("ioredis");
const RedisConfig = require('./redis-config.json');
let redis = undefined;

if (process.env.NODE_ENV === 'production') {

    console.log('Connected to production redis cluster');
    var nodes = [{
        host: process.env.REDIS_HOST,
        port: '6379',
    }];
    redis = new Redis.Cluster(nodes);
} else if (process.env.NODE_ENV === 'test') {

    console.log('Connected to test redis cluster');
    var nodes = [{
        host: process.env.REDIS_HOST,
        port: '6379',
    }];
    redis = new Redis.Cluster(nodes);
}
else {
    console.log('Connected to dev redis');
    redis = new Redis(RedisConfig.redisClusterDev);
}


// function to get value from redis cache
function getValue(key) {
    return redis.get(key, function (err, result) {
        if (err) {
            console.error(err);
            return undefined;
        } else {
            return result;
        }
    });
}

// function to remove value from redis cache
function removeValue(key) {
    return redis.del(key, function (err, result) {
        if (err) {
            console.error(err);
            return undefined;
        } else {
            return result;
        }
    });
}

// function to set value in redis cache
function setValue(key, value) {
    redis.set(key, value);
}

module.exports = {
    getValue,
    setValue,
    removeValue
}