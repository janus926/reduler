var reduler = require('./index');

function jobMultiply (id, args) {
  return args.a * args.b;
}

reduler.init(host, port);
reduler.add(multiply, { a: 1, b: 2 }, new Date() + 10000);
reduler.remove();
