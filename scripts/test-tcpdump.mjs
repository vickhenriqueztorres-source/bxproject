import { Client } from 'ssh2';

const conn = new Client();
conn.on('ready', () => {
  conn.exec('timeout 8 tcpdump -i any "port 80 or port 443" -n', (err, stream) => {
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stderr.write(d));
    stream.on('close', () => {
      conn.end();
      process.exit(0);
    });
  });
}).connect({ host: '169.58.159.77', port: 22, username: 'root', password: 'NqBxE5RrCwSd' });
