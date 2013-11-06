var reduler = require('./index');

var tasks = {
  'multiply': function (a, b) {
    return a * b;
  }
}

var taskId;

reduler.init(host, port);
reduler.add('multiply', { a: 1, b: 2 }, function(err, id) {
  console.log('added:', err, id);
  taskId = id;
});

reduler.run(function(id, task, args, callback) {
  tasks[task](args);
});

reduler.on('success', function(id, task, args, result) {
});
reduler.on('failed', function(id, task, args, reason) {
});

reduler.remove(taskId);
