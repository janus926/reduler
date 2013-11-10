var redis = require('redis');

var host;
var port;
var client;

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
        if (!err && callback)
          callback(null, tid);
      });
  });
};

exports.remove = function(tid) {
  client.multi()
    .del(['reduler:tasks:' + tid])
    .zrem(['reduler:tasks', tid])
    .exec(redis.print);
};

exports.run = function() {
  var bClient = redis.createClient(port, host);
  var nextRunTime = 9007199254740992;
  var timer;

  function kick() {
    var now = Date.now();
    console.log('kick:', now);
    // Pop scheduled tasks and peek the next one.
    client.multi()
      .zrangebyscore(['reduler:tasks', '-inf', now])
      .zremrangebyscore(['reduler:tasks', '-inf', now])
      .zrange(['reduler:tasks', 0, 1, 'WITHSCORES'])
      .exec(function(err, replies) {
        replies[0].forEach(function(tid) {
          client.hgetall('reduler:tasks:' + tid, function(err, reply) {
            console.log('hgetall', tid, err, reply, now);
            client.rpush(['reduler:tasks:run', JSON.stringify([tid, reply.task, JSON.parse(reply.args)])], redis.print);
            var opts = JSON.parse(reply.opts);
            if (opts.repeats > 1) {
              --opts.repeats;
              opts.date += opts.period;
              console.log(opts);
              client.multi()
                .hmset([
                  'reduler:tasks:' + tid,
                  'opts', JSON.stringify(opts)
                ])
                .zadd(['reduler:tasks', opts.date, tid])
                .rpush(['reduler:tasks:new', opts.date])
                .exec(redis.print);
            }
          });
        });
        // If there're still remaining tasks, set the timer for next kick().
        if (replies[2].length > 0)
          setTimeout(kick, replies[2][1] - Date.now());
      });
  }

  // Update the timer invoking kick() to get scheduled tasks.
  (function updateTimerLoop() {
    console.log('>blpop');
    bClient.blpop(['reduler:tasks:new', 0], function(err, reply) {
      console.log('<blpop:', err, reply);
      if (reply[1] < nextRunTime) {
        nextRunTime = reply[1];
        if (timer !== undefined)
          clearTimeout(timer);
        console.log(nextRunTime - Date.now());
        timer = setTimeout(kick, nextRunTime - Date.now());
      }
      setTimeout(updateTimerLoop, 0);
    });
  })();
};

exports.worker = function(callback) {
  var bClient = redis.createClient(port, host);

  (function runLoop() {
    console.log('worker>blpop');
    bClient.blpop(['reduler:tasks:run', 0], function(err, reply) {
      console.log('worker<blpop:', err, reply);
      callback.apply(null, JSON.parse(reply[1]));
      setTimeout(runLoop, 0);
    });
  })();
};
