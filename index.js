var redis = require('redis');

var host;
var port;
var client;

function dummy() {
  ;
}

exports.connect = function(_host, _port) {
  host = _host || '127.0.0.1';
  port = _port || 6379;
  client = redis.createClient(port, host);
};

exports.add = function(name, args, opts, callback) {
  opts = opts || {};

  if (opts.date === undefined)
    opts.date = Date.now();
  if (opts.repeats === undefined)
    opts.repeats = 1;
  if (opts.period === undefined)
    opts.period = 60000;

  client.incr(['reduler:tasks:nextid'], function(err, tid) {
    client.multi()
      .set(['reduler:tasks:' + tid, JSON.stringify([tid, name, args, opts])])
      .zadd(['reduler:tasks', opts.date, tid])
      .rpush(['reduler:tasks:new', opts.date])
      .exec(function(err, replies) {
        if (callback)
          callback(err, tid);
      });
  });
};

exports.remove = function(tid) {
  client.multi()
    .del(['reduler:tasks:' + tid])
    .zrem(['reduler:tasks', tid])
    .exec(dummy);
};

exports.run = function() {
  var bClient = redis.createClient(port, host);
  var nextTick = 9007199254740992;
  var tickTimer;

  function tick() {
    var now = Date.now();

    // Pop scheduled tasks and peek the next one.
    client.multi()
      .zrangebyscore(['reduler:tasks', '-inf', now])
      .zremrangebyscore(['reduler:tasks', '-inf', now])
      .zrange(['reduler:tasks', 0, 1, 'WITHSCORES'])
      .exec(function(err, replies) {
        replies[0].forEach(function(tid) {
          client.get(['reduler:tasks:' + tid], function(err, reply) {
            client.rpush(['reduler:tasks:run', reply], dummy);
            // Check if it is a recurrning task.
            var task = JSON.parse(reply);
            var opts = task[3];
            if (opts.repeats > 1) {
              --opts.repeats;
              opts.date += opts.period;
              client.multi()
                .set(['reduler:tasks:' + tid, JSON.stringify(task)])
                .zadd(['reduler:tasks', opts.date, tid])
                .rpush(['reduler:tasks:new', opts.date])
                .exec(dummy);
            } else {
              client.del(['reduler:tasks:' + tid]);
            }
          });
        });
        // If there're still remaining tasks, set the timer for next tick().
        if (replies[2].length > 0)
          tickTimer = setTimeout(tick, replies[2][1] - Date.now());
      });
  }

  // Update the timer invoking tick() when new task is added.
  (function timerUpdate() {
    bClient.blpop(['reduler:tasks:new', 0], function(err, reply) {
      if (reply[1] < nextTick) {
        nextTick = reply[1];
        if (tickTimer !== undefined)
          clearTimeout(tickTimer);
        tickTimer = setTimeout(tick, nextTick - Date.now());
      }
      setTimeout(timerUpdate, 0);
    });
  })();
};

exports.worker = function(callback) {
  var bClient = redis.createClient(port, host);

  (function workerLoop() {
    bClient.blpop(['reduler:tasks:run', 0], function(err, reply) {
      var task = JSON.parse(reply[1]);
      task.pop();
      callback.apply(null, task);
      setTimeout(workerLoop, 0);
    });
  })();
};
