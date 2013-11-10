# reduler - a distributed redis-backed scheduler
# API
## reduler.connect(host, port)
## reduler.add(task, args, options, callback)
options:
- date: when to run the task, default is Date.now().
- repeats: default is 1, use 0 for unlimited.
- period: the time in milliseconds of repeat cycle, default 60000.

## reduler.remove(id)
## reduler.run()
The main loop handling tasks life cycle, it should be invoked exactly one time.

## reduler.worker(callback)
The worker can be invoked from a different process other than reduler.run().
