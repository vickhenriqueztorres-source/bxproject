import https from 'node:https';

const email = `test.trader.${Date.now()}@gmail.com`;
const payload = JSON.stringify({
  name: 'Trader Teste Binmax',
  email: email,
  password: 'Password123!',
  country: 'BR'
});

const req = https.request('https://binmaxbroker.com/api/v1/auth/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Response: ${data}`);
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
});

req.write(payload);
req.end();
