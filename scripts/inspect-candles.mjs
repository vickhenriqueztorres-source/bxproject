import https from 'node:https';

fetch('https://binmaxbroker.com/api/candles?symbol=VOL_50&interval=1m&limit=2880')
  .then(r => r.json())
  .then(data => {
    console.log('Total candles:', data.length);
    for (let i = Math.max(0, data.length - 15); i < data.length; i++) {
      const d = data[i];
      const iso = new Date(d.time * 1000).toISOString();
      console.log(`[${i}] time: ${d.time} (${iso}) | open: ${d.open} close: ${d.close} | prov: ${d.provenance} leg: ${d.legacy}`);
    }
  })
  .catch(console.error);
