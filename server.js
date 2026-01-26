const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static('public'));

// Endpoint per cercare sinonimi e contrari da Virgilio Sapere
app.get('/api/search/:word', async (req, res) => {
  const word = req.params.word.toLowerCase().trim();

  try {
    const url = `https://sapere.virgilio.it/parole/sinonimi-e-contrari/${encodeURIComponent(word)}`;

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    const sinonimi = [];
    const contrari = [];

    // Trova il container principale
    const container = $('.sct-descr');

    let currentType = null;

    // Itera su tutti gli elementi dentro il container
    container.children().each((i, el) => {
      const $el = $(el);

      // Controlla se è un'intestazione di tipo (Sinonimi/Contrari)
      if ($el.hasClass('sct-macrotipo')) {
        const text = $el.text().trim().toLowerCase();
        if (text.includes('sinonimi')) {
          currentType = 'sinonimi';
        } else if (text.includes('contrari')) {
          currentType = 'contrari';
        }
      }
      // Se è un paragrafo con i link delle parole
      else if ($el.is('p') && currentType) {
        $el.find('a').each((j, link) => {
          const parola = $(link).text().trim();
          // Filtra parole vuote e link di navigazione
          if (parola && parola.length > 1 && !parola.includes('Leggi') && !parola.includes('>>')) {
            if (currentType === 'sinonimi') {
              sinonimi.push(parola);
            } else if (currentType === 'contrari') {
              contrari.push(parola);
            }
          }
        });
      }
    });

    // Limita i risultati
    res.json({
      word,
      sinonimi: sinonimi.slice(0, 20),
      contrari: contrari.slice(0, 15)
    });

  } catch (error) {
    console.error('Errore:', error.message);

    // Se la parola non esiste, ritorna array vuoti
    if (error.response && error.response.status === 404) {
      return res.json({
        word,
        sinonimi: [],
        contrari: [],
        notFound: true
      });
    }

    res.status(500).json({
      error: 'Errore nella ricerca',
      message: error.message,
      sinonimi: [],
      contrari: []
    });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 LexiPop server running at http://localhost:${PORT}`);
});
