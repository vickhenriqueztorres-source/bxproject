import { Client } from 'ssh2';
import fs from 'node:fs';

const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const readStream = fs.createReadStream('infra/keycloak/broker-realm.json');
    const writeStream = sftp.createWriteStream('/root/app/infra/keycloak/broker-realm.json');

    writeStream.on('close', () => {
      console.log('✅ broker-realm.json enviado com sucesso!');
      const cmds = [
        'docker cp /root/app/infra/keycloak/broker-realm.json broker-keycloak:/tmp/broker-realm.json',
        'docker exec broker-keycloak /opt/keycloak/bin/kcadm.sh create realms -f /tmp/broker-realm.json',
        'docker exec broker-keycloak /opt/keycloak/bin/kcadm.sh get realms/broker-demo | grep -i ssl'
      ].join(' && ');

      conn.exec(cmds, (execErr, stream) => {
        if (execErr) throw execErr;
        stream.on('close', (code) => {
          console.log(`✅ Importação de Realm finalizada com Exit Code ${code}`);
          conn.end();
          process.exit(code);
        });
        stream.on('data', d => process.stdout.write(d));
        stream.stderr.on('data', d => process.stderr.write(d));
      });
    });

    readStream.pipe(writeStream);
  });
}).connect({
  host: '169.58.159.77',
  port: 22,
  username: 'root',
  password: 'NqBxE5RrCwSd'
});
