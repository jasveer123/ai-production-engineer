// APE_TOKEN=ape_live_... APE_ENDPOINT=http://localhost:4000 node examples/express.js
// (needs `npm install express` in this folder)
const ape = require('@ape/agent');
ape.start({ service: 'example-shop', environment: 'development' });

const express = require('express');
const app = express();

app.get('/', (_req, res) => {
  console.log('home page served');
  res.send('ok');
});

app.get('/checkout', () => {
  const coupon = null;
  return coupon.percentOff; // TypeError: an incident opens for it
});

app.use(ape.errorHandler());
app.listen(3005, () => console.log('example on http://localhost:3005'));
