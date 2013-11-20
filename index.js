var redis = require('redis');

var MAX_INT = 90071999254740992;

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

  if (opts.start === undefined)
    opts.start = Date.now();
  if (opts.repeats === undefined)
    opts.repeats = 1;
  if (opts.period === undefined)
    opts.period = 60000;

  client.incr(['reduler:tasks:nextid'], function(err, tid) {
    client.multi()
      .set(['reduler:tasks:' + tid, JSON.stringify([tid, name, args, opts])])
      .zadd(['reduler:tasks', opts.start, tid])
      .rpush(['reduler:tasks:new', opts.start])
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
  var nextTick = MAX_INT;
  var tickTimer;

  function tick() {
    var now = Date.now();

    // Pop scheduled tasks and peek the next one.
    client.multi()
      .zrangebyscore(['reduler:tasks', '-inf', now])
      .zremrangebyscore(['reduler:tasks', '-inf', now])
      .zrange(['reduler:tasks', 0, 1, 'WITHSCORES'])
      .exec(function(err, replies) {
        // nextTick will be either the next iteration of current scheduled
        // recurring task or the remaining one.
        if (replies[2].length > 0) {
          nextTick = replies[2][1];
          tickTimer = setTimeout(tick, nextTick - Date.now());
        } else {
          nextTick = MAX_INT;
        }

        replies[0].forEach(function(tid) {
          client.get(['reduler:tasks:' + tid], function(err, reply) {
            client.rpush(['reduler:tasks:run', reply], dummy);
            var task = JSON.parse(reply);
            var opts = task[3];
            // If it is a recurrning task, schedule its next run.
            if (!opts.repeats || --opts.repeats > 0) {
              opts.start += opts.period;
              client.multi()
                .set(['reduler:tasks:' + tid, JSON.stringify(task)])
                .zadd(['reduler:tasks', opts.start, tid])
                .rpush(['reduler:tasks:new', opts.start])
                .exec(dummy);
            } else {
              client.del(['reduler:tasks:' + tid]);
            }
          });
        });
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
      process.nextTick(timerUpdate);
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
      process.nextTick(workerLoop);
    });
  })();
};
