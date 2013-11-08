# reduler - a redis-backed scheduler
Still in design phase.
# API
## reduler.connect(host, port)
## reduler.add(task, args, options, callback)
options:
- date: when to run the task, default is Date.now().
- repeats: default is 1, use 0 for unlimited.
- period: the time in milliseconds of repeat cycle, default 6000.

## reduler.remove(id)
## reduler.run()
## reduler.worker(callback)
