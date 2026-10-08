async function test() {
  const res = await fetch('http://169.58.159.77/api/contracts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': 'key_' + Date.now(),
    },
    body: JSON.stringify({
      symbol: 'SYNTH_VOL_50',
      direction: 'UP',
      stake_minor: 1000,
      duration_seconds: 120,
    }),
  });

  console.log('Status:', res.status);
  const data = await res.json();
  console.log('Body:', data);
}

test().catch(console.error);
