import { Client } from 'ssh2';

const conn = new Client();
conn.on('ready', () => {
  const cmd = `
    echo "=== NGINX SITES ==="
    cat /etc/nginx/sites-enabled/*
    echo "=== NGINX ERROR LOG ==="
    tail -n 25 /var/log/nginx/error.log
    echo "=== WWW DIRS ==="
    ls -la /var/www/
    ls -la /var/www/binmax 2>/dev/null || true
    ls -la /var/www/html 2>/dev/null || true
  `;
  conn.exec(cmd, (err, stream) => {
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
