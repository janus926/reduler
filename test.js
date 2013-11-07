var reduler = require('./index');

var tasks = {
  'multiply': function (a, b, callback) {
    callback(a * b);
  }
}

var taskId;

reduler.connect();
reduler.add('multiply', [1, 2], {}, function(err, id) {
  console.log('added:', err, id);
  taskId = id;
});

reduler.run(function(id, task, args, callback) {
  console.log(id, task, args, typeof args, callback);
  args.push(callback)
  tasks[task].apply(undefined, args);
});
/*
reduler.on('success', function(id, task, args, result) {
});
reduler.on('failed', function(id, task, args, error) {
});
*/
reduler.remove(taskId);
