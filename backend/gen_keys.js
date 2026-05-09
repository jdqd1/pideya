const webpush = require('web-push');
const fs = require('fs');
const vapidKeys = webpush.generateVAPIDKeys();
const content = `VITE_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}\nVAPID_PUBLIC_KEY=${vapidKeys.publicKey}\nVAPID_PRIVATE_KEY=${vapidKeys.privateKey}\nVAPID_SUBJECT=mailto:admin@brownies.com`;
fs.writeFileSync('keys.txt', content);
console.log('Keys written to keys.txt');
