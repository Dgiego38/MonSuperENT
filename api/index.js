const axios = require('axios');

module.exports = async (req, res) => {
  // On autorise tout le monde (CORS OK)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Ici, on simulera la requête vers l'ENT
  try {
    res.status(200).json({ status: "Connecté au Proxy Vercel !" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};