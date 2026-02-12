const queues = new Map();

function enqueue(chatId, fn) {
  const prev = queues.get(chatId) || Promise.resolve();
  const next = prev.then(fn, fn);
  queues.set(chatId, next);
  next.finally(() => {
    if (queues.get(chatId) === next) {
      queues.delete(chatId);
    }
  });
  return next;
}

module.exports = { enqueue };
