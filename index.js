var redis = require('redis');

var mHost;
var mPort;
var mClient;

exports.connect = function(host, port) {
  mHost = host || '127.0.0.1';
  mPort = port || 6379;
  mClient = redis.createClient(mPort, mHost);
};

exports.add = function(task, args, opts, callback) {
  opts = opts || {};

  if (opts.date === undefined)
    opts.date = Date.now();
  if (opts.repeats === undefined)
    opts.repeats = 1;
  if (opts.period === undefined)
    opts.period = 6000;

  mClient.incr(['reduler:tasks:nextid'], function(err, tid) {
    console.log('incr err=' + err + ', tid=' + tid);
    mClient.multi()
      .hmset([
        'reduler:tasks:' + tid,
        'task', task, 'args', JSON.stringify(args), 'opts', JSON.stringify(opts)
      ])
      .zadd(['reduler:tasks', opts.date, tid])
      .rpush(['reduler:tasks:new', opts.date])
      .exec(function(err, replies) {
        if (!err && callback)
          callback(null, tid);
      });
  });
};

exports.remove = function(tid) {
  mClient.multi()
    .del(['reduler:tasks:' + tid])
    .zrem(['reduler:tasks', tid])
    .exec(redis.print);
};

exports.run = function(callback) {
  var client = redis.createClient(mPort, mHost);
  var nextRunTime = 9007199254740992;
  var timer;

  function complete(result) {
    console.log(result);
  }

  function fire() {
    var now = Date.now();
    console.log('fire:', now);
    mClient.multi()
      .zrangebyscore(['reduler:tasks', '-inf', now])
      .zremrangebyscore(['reduler:tasks', '-inf', now])
      .exec(function(err, replies) {
        replies[0].forEach(function(tid) {
          mClient.hgetall('reduler:tasks:' + tid, function(err, reply) {
            console.log('hgetall', err, reply, now);
            callback(tid, reply.task, JSON.parse(reply.args), complete);
          });
        });
      });
  }

  (function updateTimerLoop() {
    console.log('>blpop');
    client.blpop(['reduler:tasks:new', 0], function(err, reply) {
      console.log('<blpop:', err, reply);
      if (reply[1] < nextRunTime) {
        nextRunTime = reply[1];
        if (timer !== undefined)
          clearTimeout(timer);
        console.log(nextRunTime - Date.now());
        timer = setTimeout(fire, nextRunTime - Date.now());
      }
      setTimeout(updateTimerLoop, 0);
    });
  })();
};
