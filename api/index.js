const { Scolengo } = require('scolengo-api');

module.exports = async (req, res) => {
    // Headers anti-CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { action } = req.query;
    const client = new Scolengo();

    try {
        switch (action) {
            case 'login':
                const { username, password, ent } = req.body;
                // On tente la connexion (ent est l'URL de ton ENT, ex: 'clg-la-pierre-polie.monbureaunumerique.fr')
                await client.login(username, password, ent);
                
                // On renvoie les données de session au front pour les stocker dans le localStorage
                // Note : scolengo-api génère un fichier de session, mais sur Vercel on renvoie le résultat
                return res.json({ 
                    success: true, 
                    session: client.session,
                    user: client.user
                });

            case 'homework':
                // Pour récupérer les devoirs, il nous faut la session envoyée par le front
                const sessionData = req.body.session;
                client.session = sessionData;
                const devoirs = await client.getHomework();
                return res.json(devoirs);

            case 'notes':
                client.session = req.body.session;
                const notes = await client.getGrades();
                return res.json(notes);

            default:
                return res.json({ status: "API Scolengo prête" });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erreur Scolengo: " + error.message });
    }
};