var cluster = require('cluster');
var reduler = require('./index');
var numCPUs = require('os').cpus().length;

reduler.connect();

if (cluster.isMaster) {
  for (var i = 0; i < numCPUs; ++i)
    cluster.fork();

  reduler.run();
  reduler.add('multiply', [1, 2], {date: Date.now() + 10000}, function(err, id) {
    console.log('added: multiply [1, 2]', err, id);
  });
  reduler.add('multiply', [3, 4], {date: Date.now() + 3000, repeats: 2}, function(err, id) {
    console.log('added: multiply [3, 4]', err, id);
  });
} else {
  var tasks = {
    'multiply': function (a, b) {
      console.log(a * b);
    }
  }

  reduler.worker(function(id, name, args) {
    console.log('worker-' + cluster.worker.id, id, name, args);
    tasks[name].apply(null, args);
  });
}
