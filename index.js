// server.js
const http = require('http');
const WebSocket = require('ws');
const express = require('express');
const app = express();
const cors = require('cors');

app.use(cors({
  origin: ['https://truruky.ru', 'https://www.truruky.ru', 'https://truruki.ru', 'https://www.truruki.ru'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: false,
}));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });



let broadcaster = null;  // WebSocket клиента-транслятора
let viewers = new Set(); // Set WebSocket клиентов-зрителей

wss.on('connection', ws => {
  ws.on('message', message => {
    let data;
    try {
      data = JSON.parse(message);
    } catch(e) {
      console.error('Invalid JSON', e);
      return;
    }

    switch(data.type) {
      case 'broadcaster':
        broadcaster = ws;
        ws.role = 'broadcaster';
        console.log('Broadcaster connected');
        break;

      case 'viewer':
        viewers.add(ws);
        ws.role = 'viewer';
        console.log('Viewer connected');
        // Сообщаем транслятору о новом зрителе
        if (broadcaster) {
          broadcaster.send(JSON.stringify({ type: 'watcher' }));
        }
        break;

      case 'offer':
        // Broadcaster получил оффер от зрителя (SDP)
        if (ws.role === 'broadcaster') {
          viewers.forEach(viewer => {
            if (viewer.readyState === WebSocket.OPEN) {
              viewer.send(JSON.stringify({ type: 'offer', sdp: data.sdp }));
            }
          });
        }
        break;

      case 'answer':
        // Зритель отправляет серверу SDP, пересылаем транслятору
        if (ws.role === 'viewer' && broadcaster && broadcaster.readyState === WebSocket.OPEN) {
          broadcaster.send(JSON.stringify({ type: 'answer', sdp: data.sdp }));
        }
        break;

      case 'candidate':
        // ICE кандидаты пересылаются соответствующим сторонам
        if (ws.role === 'broadcaster') {
          viewers.forEach(viewer => {
            if (viewer.readyState === WebSocket.OPEN) {
              viewer.send(JSON.stringify({ type: 'candidate', candidate: data.candidate }));
            }
          });
        } else if (ws.role === 'viewer' && broadcaster && broadcaster.readyState === WebSocket.OPEN) {
          broadcaster.send(JSON.stringify({ type: 'candidate', candidate: data.candidate }));
        }
        break;

      default:
        console.log('Unknown message type: ', data.type);
    }
  });

  ws.on('close', () => {
    if (ws.role === 'broadcaster') {
      broadcaster = null;
      // Уведомляем всех зрителей, что транслятор отключился
      viewers.forEach(viewer => {
        if (viewer.readyState === WebSocket.OPEN) {
          viewer.send(JSON.stringify({ type: 'broadcasterDisconnected' }));
        }
      });
    }
    if (ws.role === 'viewer') {
      viewers.delete(ws);
    }
  });
});

server.listen(30333, () => {
  console.log('Server listening on port 30333');
});