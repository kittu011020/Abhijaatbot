// index.js
const express = require('express');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// Health check
app.get('/', (req, res) => res.send('Messenger bot running'));

// Webhook verification (GET)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED');
      return res.status(200).send(challenge);
    } else {
      return res.sendStatus(403);
    }
  }
  res.sendStatus(400);
});

// Webhook receiver (POST)
app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;

    // Make sure this is a page subscription
    if (body.object === 'page') {
      body.entry.forEach(function(entry) {
        // Iterate over messaging events
        const messaging = entry.messaging || [];
        messaging.forEach(event => {
          if (event.message && event.sender) {
            handleMessage(event.sender.id, event.message);
          }
          if (event.postback && event.sender) {
            handlePostback(event.sender.id, event.postback);
          }
        });
      });

      res.status(200).send('EVENT_RECEIVED');
    } else {
      // Return 404 if not from a page subscription
      res.sendStatus(404);
    }
  } catch (err) {
    console.error('Webhook POST error', err);
    res.sendStatus(500);
  }
});

async function handleMessage(senderPsid, message) {
  console.log('Received message for:', senderPsid, 'message:', message);

  // Simple echo logic (if quick_reply or text)
  let reply = { text: "I didn't understand that. Try typing 'hi'." };

  if (message.text) {
    const txt = message.text.trim().toLowerCase();
    if (txt === 'hi' || txt === 'hello') {
      reply = { text: `Hello! 👋 How can I help you today?` };
    } else if (txt === 'help') {
      reply = { text: `Available commands: hi, help, echo <text>` };
    } else if (txt.startsWith('echo ')) {
      reply = { text: message.text.slice(5) };
    } else {
      reply = { text: `You said: "${message.text}" (this bot echoes)` };
    }
  } else if (message.attachments && message.attachments.length) {
    reply = { text: 'Thanks for the attachment!' };
  }

  await callSendAPI(senderPsid, reply);
}

async function handlePostback(senderPsid, postback) {
  const payload = postback.payload;
  const text = `Postback received: ${payload}`;
  await callSendAPI(senderPsid, { text });
}

async function callSendAPI(senderPsid, response) {
  if (!PAGE_ACCESS_TOKEN) {
    console.error('Missing PAGE_ACCESS_TOKEN env var');
    return;
  }
  const url = `https://graph.facebook.com/v17.0/me/messages?access_token=${encodeURIComponent(PAGE_ACCESS_TOKEN)}`;
  const body = {
    recipient: { id: senderPsid },
    message: response
  };

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    if (!resp.ok) {
      console.error('Send API error', data);
    } else {
      console.log('Message sent:', data);
    }
  } catch (err) {
    console.error('callSendAPI error', err);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
