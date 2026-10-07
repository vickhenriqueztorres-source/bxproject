import { Client } from 'ssh2';

const conn = new Client();

console.log('Connecting to VPS 169.58.159.77...');

conn.on('ready', () => {
  console.log('✅ SSH Connection established successfully!');
  conn.exec('uname -a && free -h && lscpu | grep "Model name"', (err, stream) => {
    if (err) throw err;
    let output = '';
    stream.on('close', (code, signal) => {
      console.log('Exit code:', code);
      console.log('--- OUTPUT ---');
      console.log(output);
      console.log('--------------');
      conn.end();
    }).on('data', (data) => {
      output += data;
    }).stderr.on('data', (data) => {
      console.error('STDERR:', data.toString());
    });
  });
}).on('error', (err) => {
  console.error('❌ Connection error:', err.message);
}).connect({
  host: '169.58.159.77',
  port: 22,
  username: 'root',
  password: 'NqBxE5RrCwSd',
  readyTimeout: 30000
});
