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

exports.add = function(task, args, opts, callback) {
  opts = opts || {};

  if (opts.date === undefined)
    opts.date = Date.now();
  if (opts.repeats === undefined)
    opts.repeats = 1;
  if (opts.period === undefined)
    opts.period = 60000;

  client.incr(['reduler:tasks:nextid'], function(err, tid) {
    client.multi()
      .hmset([
        'reduler:tasks:' + tid,
        'task', task, 'args', JSON.stringify(args), 'opts', JSON.stringify(opts)
      ])
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
          client.hgetall(['reduler:tasks:' + tid], function(err, reply) {
            // Push to running queue.
            client.rpush([
              'reduler:tasks:run',
              JSON.stringify([
                tid,
                reply.task,
                JSON.parse(reply.args)
              ])
            ], dummy);
            // Check is it recurrning task.
            var opts = JSON.parse(reply.opts);
            if (opts.repeats > 1) {
              --opts.repeats;
              opts.date += opts.period;
              client.multi()
                .hmset([
                  'reduler:tasks:' + tid,
                  'opts', JSON.stringify(opts)
                ])
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
      callback.apply(null, JSON.parse(reply[1]));
      setTimeout(workerLoop, 0);
    });
  })();
};
