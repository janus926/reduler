# reduler - a redis-backed distributed task scheduler

# Usage
```javascript
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
```
Output:
```
Fri Nov 15 2013 14:23:38 GMT+0800 (CST) adding...
Fri Nov 15 2013 14:23:38 GMT+0800 (CST) adding...
Fri Nov 15 2013 14:23:38 GMT+0800 (CST) added: multiply [1, 2] null 5
Fri Nov 15 2013 14:23:38 GMT+0800 (CST) added: multiply [3, 4] null 6
Fri Nov 15 2013 14:23:41 GMT+0800 (CST) worker-1 6 multiply [ 3, 4 ]
12
Fri Nov 15 2013 14:23:48 GMT+0800 (CST) worker-2 5 multiply [ 1, 2 ]
2
Fri Nov 15 2013 14:24:41 GMT+0800 (CST) worker-1 6 multiply [ 3, 4 ]
12
```

# API

## reduler.connect([host], [port])
Default host 127.0.0.1, port 6379.

## reduler.add(name, args, [options], [callback])
- `name`
- `args`
- `options` Object
  - `start` start date running the task, default is Date.now().
  - `repeats` default is 1, use 0 for unlimited. 
  - `period` the time in milliseconds of repeat cycle, default 60000.
- `callback` Function  
The callback gets two arguments `(err, id)`.

## reduler.remove(id)

## reduler.run()
The main loop handling tasks life cycle, there should have exactly one
invocation.

## reduler.worker(callback)
The worker can be invoked from a process other than the one calling
reduler.run().  
The callback gets three arguments `(id, name, args)`, where name and args are
the ones from reduler.add().
