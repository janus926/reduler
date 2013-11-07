var redis = require('redis');

var reHost;
var rePort;
var reClient;

exports.connect = function(host, port) {
  reHost = host || '127.0.0.1';
  rePort = port || 6379;
  reClient = redis.createClient(rePort, reHost);
};

exports.add = function(task, args, opts, callback) {
  opts = opts || {};

  if (opts.date === undefined)
    opts.date = Date.now();
  if (opts.repeats === undefined)
    opts.repeats = 1;
  if (opts.period === undefined)
    opts.period = 6000;

  reClient.incr(['reduler:tasks:nextid'], function(err, tid) {
    console.log('incr err=' + err + ', tid=' + tid);
    reClient.hmset([
      'reduler:tasks:' + tid,
      'task', task, 'args', JSON.stringify(args), 'opts', JSON.stringify(opts)
    ], redis.print);
    reClient.zadd(['reduler:tasks', opts.date, tid], function(err, result) {
      console.log('zadd err=' + err + ', result=' + result);
      if (callback)
        callback(null, tid);
    });
  });
};

exports.remove = function(tid) {
  reClient.multi()
    .del(['reduler:tasks:' + tid])
    .zrem(['reduler:tasks', tid])
    .exec(redis.print);
};

exports.run = function(callback) {
  var client = redis.createClient(rePort, reHost);
  var schedule = 9007199254740992;
  var scheduleTimer = setTimeout(exec, schedule);

  function complete(result) {
    console.log(result);
  }

  function exec() {
    var now = Date.now();

    reClient.multi()
      .zrangebyscore(['reduler:tasks', '-inf', now])
      .zremrangebyscore(['reduler:tasks', '-inf', now])
      .exec(function(err, replies) {
        replies.forEach(function(reply, index) {
          console.log(index + ': ' + reply);
          if (!index) {
            var tid = reply;
            reClient.hgetall('reduler:tasks:' + tid, function(err, reply) {
              console.log('hgetall', err, reply);
              callback(tid, reply.task, JSON.parse(reply.args), complete);
            });
          }
        });
      });
  }

  (function updateLoop() {
    client.blpop(['reduler:tasks:new', 0], function(err, reply) {
      if (reply[1] < nextSchedule) {
        nextSchedule = reply[1];
        if (nextScheduleTimer !== undefined)
          clearTimeout(timeout);
      }
      timeout = setTimeout(exec(), next - Date.now());
      setTimeout(updateLoop, 0);
    });
  })();
};
