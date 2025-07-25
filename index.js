const http = require('http');
const WebSocket = require('ws');
const express = require('express');
const app = express();
const cors = require('cors');
const { v4: uuidv4 } = require('uuid'); // для генерации уникальных ID

app.use(cors({
  origin: ['https://truruky.ru', 'https://www.truruky.ru', 'https://truruki.ru', 'https://www.truruki.ru'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: false,
}));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let broadcaster = null;
const viewers = new Map(); // id => ws

wss.on('connection', ws => {
  ws.id = uuidv4();

  ws.on('message', message => {
    let data;
    try {
      data = JSON.parse(message);
    } catch (e) {
      console.error('Invalid JSON', e);
      return;
    }

    switch (data.type) {
      case 'broadcaster':
        broadcaster = ws;
        ws.role = 'broadcaster';
        console.log('Broadcaster connected');
        break;

      case 'viewer':
        ws.role = 'viewer';
        viewers.set(ws.id, ws);
        console.log('Viewer connected:', ws.id);
        if (broadcaster && broadcaster.readyState === WebSocket.OPEN) {
          // Сообщаем транслятору о новом зрителе с его ID
          broadcaster.send(JSON.stringify({ type: 'watcher', id: ws.id }));
        }
        break;

      case 'offer':
        // Broadcaster присылает оффер для конкретного зрителя
        if (ws.role === 'broadcaster') {
          const viewer = viewers.get(data.id);
          if (viewer && viewer.readyState === WebSocket.OPEN) {
            viewer.send(JSON.stringify({ type: 'offer', sdp: data.sdp }));
          }
        }
        break;

      case 'answer':
        // Зритель отправляет answer для конкретного транслятора (единственного)
        if (ws.role === 'viewer' && broadcaster && broadcaster.readyState === WebSocket.OPEN) {
          broadcaster.send(JSON.stringify({ type: 'answer', sdp: data.sdp, id: ws.id }));
        }
        break;

      case 'candidate':
        // ICE кандидаты маршрутизируются по ролям и ID
        if (ws.role === 'broadcaster') {
          // Транслятор пересылает кандидатам конкретным зрителям
          viewers.forEach((viewer, id) => {
            if (viewer.readyState === WebSocket.OPEN && data.id === id) {
              viewer.send(JSON.stringify({ type: 'candidate', candidate: data.candidate }));
            }
          });
        } else if (ws.role === 'viewer' && broadcaster && broadcaster.readyState === WebSocket.OPEN) {
          broadcaster.send(JSON.stringify({ type: 'candidate', candidate: data.candidate, id: ws.id }));
        }
        break;

      default:
        console.log('Unknown message type:', data.type);
        break;
    }
  });

  ws.on('close', () => {
    if (ws.role === 'broadcaster') {
      broadcaster = null;
      viewers.forEach(viewer => {
        if (viewer.readyState === WebSocket.OPEN) {
          viewer.send(JSON.stringify({ type: 'broadcasterDisconnected' }));
        }
      });
    }
    if (ws.role === 'viewer') {
      viewers.delete(ws.id);
      if (broadcaster && broadcaster.readyState === WebSocket.OPEN) {
        broadcaster.send(JSON.stringify({ type: 'disconnect', id: ws.id }));
      }
    }
  });
});

server.listen(30333, () => {
  console.log('Server listening on port 30333');
});