const express = require('express');
const cors = require('cors');
const app = express();
const port = 30333;

let clients = [];
let latestFrame = null;

// Настройка CORS - разрешаем запросы от камеры (можно заменить '*' на конкретный домен/адрес)
app.use(cors({
  origin: ['https://truruky.ru', 'https://www.truruky.ru', 'https://truruki.ru', 'https://www.truruki.ru'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: false,
}));



//Простая страница для просмотра трансляции
app.get('/server', (req, res) => {
  res.send(`
    <html>
      <body>
        <h2>+++Проверка работы сервера</h2>
        <p> Работает! </p>
         
      </body>
    </html>
  `);
});



app.listen(port, () => {
  console.log(`Сервер запущен http://85.28.47.165:${port}`);
});