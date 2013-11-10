var reduler = require('./index');

var funcs = {
  'multiply': function (a, b) {
    console.log(a * b);
  }
}

reduler.connect();

reduler.add('multiply', [1, 2], {date: Date.now() + 10000}, function(err, id) {
  console.log('job added: [1, 2]', err, id);
});

reduler.add('multiply', [3, 4], {date: Date.now() + 3000, repeats: 2}, function(err, id) {
  console.log('job added: [3, 4]', err, id);
});

reduler.run();

reduler.worker(function(id, task, args) {
  funcs[task].apply(undefined, args);
});
