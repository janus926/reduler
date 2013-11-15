var cluster = require('cluster');
var reduler = require('./index');
var numCPUs = require('os').cpus().length;

reduler.connect();

if (cluster.isMaster) {
  for (var i = 0; i < numCPUs; ++i)
    cluster.fork();

  reduler.run();

  console.log((new Date()).toString() + ' adding...');
  reduler.add('multiply', [1, 2], {
    start: Date.now() + 10000
  }, function(err, id) {
    console.log((new Date()).toString() + ' added: multiply [1, 2]', err, id);
  });

  console.log((new Date()).toString() + ' adding...');
  reduler.add('multiply', [3, 4], {
    start: Date.now() + 3000,
    repeats: 2
  }, function(err, id) {
    console.log((new Date()).toString() + ' added: multiply [3, 4]', err, id);
  });
} else {
  var tasks = {
    'multiply': function (a, b) {
      console.log(a * b);
    }
  }
  reduler.worker(function(id, name, args) {
    console.log((new Date()).toString() + ' worker-' + cluster.worker.id, id, name, args);
    tasks[name].apply(null, args);
  });
}
