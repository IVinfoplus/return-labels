const net = require('net');

function sendZplToZebra(host, port = 9100, payload) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let settled = false;

    socket.connect(port, host, () => {
      socket.write(payload, () => socket.end());
    });

    socket.on('close', () => {
      if (!settled) {
        settled = true;
        resolve({ ok: true });
      }
    });

    socket.on('error', (err) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    });
  });
}

module.exports = { sendZplToZebra };
