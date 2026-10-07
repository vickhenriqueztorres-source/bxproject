import { Client } from 'ssh2';

const cmd = process.argv.slice(2).join(' ');
if (!cmd) {
  console.error('Command required');
  process.exit(1);
}

const conn = new Client();
conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code) => {
      conn.end();
      process.exit(code);
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
