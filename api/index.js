const { Skolengo } = require('scolengo-api');

module.exports = async (req, res) => {
    // Configuration des headers CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // Récupération des données (GET ou POST)
    let body = {};
    if (req.method === 'POST') {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    }
    const query = { ...req.query, ...body };
    const action = query.action;

    try {
        // 1. RECHERCHE D'ÉTABLISSEMENT
        if (action === 'search-school') {
            const q = query.q || query.text;
            if (!q || q.length < 3) return res.json([]);

            try {
                const schools = await Skolengo.searchSchool({ text: q }, 10);
                return res.json(Array.isArray(schools) ? schools : []);
            } catch (err) {
                console.error("Erreur Skolengo Search:", err.message);
                return res.json([]); // On renvoie vide au lieu de crash 500
            }
        }

        // 2. GÉNÉRATION URL D'AUTH (PKCE)
        if (action === 'get-auth-url') {
            const schoolUrl = query.url;
            if (!schoolUrl) return res.status(400).json({ error: "URL de l'établissement manquante" });

            const { authURL, codeVerifier } = await Skolengo.getAuthURL(schoolUrl);
            
            return res.json({ authURL, codeVerifier });
        }

        // 3. CALLBACK (ÉCHANGE DU CODE CONTRE SESSION)
        if (action === 'callback') {
            const { code, verifier, url } = query;
            if (!code || !verifier || !url) {
                return res.status(400).json({ error: "Paramètres manquants pour le callback" });
            }

            try {
                const client = await Skolengo.login(url, code, verifier);
                const session = client.getConfigObject();
                const user = await client.getUser();

                return res.json({ success: true, session, user });
            } catch (err) {
                return res.status(401).json({ success: false, error: "Échec de l'authentification" });
            }
        }

        // --- ACTIONS NÉCESSITANT UNE SESSION ---

        if (!query.session) {
            return res.status(401).json({ error: "Session manquante" });
        }

        const client = await Skolengo.fromConfigObject(query.session);

        // 4. CAHIER DE TEXTE (DEVOIRS)
        if (action === 'homework') {
            const homeworks = await client.getHomeworks();
            return res.json({ items: homeworks || [] });
        }

        // 5. EMPLOI DU TEMPS
        if (action === 'agenda') {
            const start = query.from || new Date().toISOString().split('T')[0];
            const end = query.to || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
            const lessons = await client.getAgenda(start, end);
            return res.json({ items: lessons || [] });
        }

        // 6. ÉVALUATIONS / NOTES
        if (action === 'evaluations') {
            const evals = await client.getEvaluations();
            return res.json({ items: evals || [] });
        }

        // 7. MESSAGERIE
        if (action === 'messages') {
            const messages = await client.getCommunications();
            return res.json({ items: messages || [] });
        }

        // 8. ABSENCES
        if (action === 'absences') {
            const absences = await client.getAbsences();
            return res.json({ items: absences || [] });
        }

        // Route par défaut
        return res.json({ status: "ready", service: "ENT+ API" });

    } catch (error) {
        console.error("[CRITICAL ERROR]", error);
        return res.status(500).json({ 
            error: "Erreur interne du serveur", 
            details: error.message 
        });
    }
};