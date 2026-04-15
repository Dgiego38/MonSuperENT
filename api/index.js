const ScolengoLib = require('scolengo-api');

module.exports = async (req, res) => {
    // Headers anti-CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { action } = req.query;
    
    // --- INITIALISATION ULTRA-ROBUSTE ---
    let client;
    try {
        if (typeof ScolengoLib.Scolengo === 'function') {
            client = new ScolengoLib.Scolengo(); // Cas v3 standard
        } else if (typeof ScolengoLib === 'function') {
            client = new ScolengoLib(); // Cas export direct
        } else if (ScolengoLib.default && typeof ScolengoLib.default === 'function') {
            client = new ScolengoLib.default(); // Cas export ESM/TypeScript
        } else {
            // Si on arrive ici, on log ce qu'il y a dans la lib pour debug
            console.log("Contenu de la lib :", Object.keys(ScolengoLib));
            throw new Error("Impossible de trouver le constructeur Scolengo");
        }
    } catch (e) {
        return res.status(500).json({ error: "Erreur d'initialisation : " + e.message });
    }
    // -------------------------------------

    try {
        if (req.body && req.body.session) {
            client.session = req.body.session;
        }

        switch (action) {
            case 'login':
                const { username, password, url } = req.body;
                await client.login(username, password, url || 'https://cas.monbureaunumerique.fr');
                return res.json({ success: true, session: client.session, user: client.user });

            case 'devoirs':
                if (!client.session) throw new Error("Session manquante");
                // On tente getHomeworks (v3) ou getHomework (v2)
                const method = client.getHomeworks ? 'getHomeworks' : 'getHomework';
                const devoirs = await client[method](); 
                return res.json(devoirs);

            default:
                return res.json({ status: "Prêt", lib_keys: Object.keys(ScolengoLib) });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};