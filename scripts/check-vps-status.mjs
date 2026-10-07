import { Client } from 'ssh2';

const conn = new Client();
conn.on('ready', () => {
  console.log('Conectado à VPS.');
  conn.exec('uptime && echo "--- DOCKER ---" && docker ps --format "table {{.Names}}\t{{.Status}}" && echo "--- PM2 ---" && pm2 list && echo "--- HTTP HEAD ---" && curl -sI http://127.0.0.1/ | head -n 5 && echo "--- ADMIN HEAD ---" && curl -sI http://127.0.0.1/admin-ui/ | head -n 5', (err, stream) => {
    if (err) throw err;
    stream.on('close', () => {
      conn.end();
      process.exit(0);
    });
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stderr.write(d));
  });
}).connect({
  host: '169.58.159.77',
  port: 22,
  username: 'root',
  password: 'NqBxE5RrCwSd'
});
