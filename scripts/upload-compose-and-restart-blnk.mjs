import { Client } from 'ssh2';
import fs from 'node:fs';

const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const readStreamBlnk = fs.createReadStream('infra/blnk.json');
    const writeStreamBlnk = sftp.createWriteStream('/root/app/infra/blnk.json');
    writeStreamBlnk.on('close', () => {
      console.log('infra/blnk.json uploaded cleanly.');
      conn.exec('cd /root/app && docker compose -f infra/compose.yaml restart blnk && sleep 3 && docker ps --filter name=broker-blnk-core && docker logs --tail 20 broker-blnk-core', (execErr, stream) => {
        if (execErr) throw execErr;
        stream.on('close', () => {
          conn.end();
          process.exit(0);
        });
        stream.on('data', d => process.stdout.write(d));
        stream.stderr.on('data', d => process.stderr.write(d));
      });
    });
    readStreamBlnk.pipe(writeStreamBlnk);
  });
}).connect({
  host: '169.58.159.77',
  port: 22,
  username: 'root',
  password: 'NqBxE5RrCwSd'
});
