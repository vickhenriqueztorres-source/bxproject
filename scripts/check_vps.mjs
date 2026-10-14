import { Client } from 'ssh2';

const conn = new Client();
conn.on('ready', () => {
  conn.exec('ls -la /root/app/apps/web/dist && ls -la /root/app/apps/web/dist/assets', (err, stream) => {
    stream.on('data', d => process.stdout.write(d));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '169.58.159.77', port: 22, username: 'root', password: 'NqBxE5RrCwSd' });
