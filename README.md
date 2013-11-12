# reduler - a redis-backed distributed scheduler

# API

## reduler.connect([host], [port])
Default host 127.0.0.1, port 6379.

## reduler.add(name, args, [options], [callback])
- `name`
- `args`
- `options` Object
  - `date` when to run the task, default is Date.now().
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
