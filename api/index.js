const { Skolengo } = require('scolengo-api');

module.exports = async (req, res) => {
    // Headers CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const query = { ...req.query, ...req.body };
    const action = query.action;

    try {
        switch (action) {
            case 'search-school':
                const q = query.q || query.text;
                if (!q || q.length < 3) return res.json([]);
                // On utilise l'API de recherche comme Papillon
                const schools = await Skolengo.searchSchool({ text: q }, 10);
                return res.json(schools);

            case 'get-auth-url':
                let schoolUrl = query.url;
                if (!schoolUrl) throw new Error("URL manquante");

                schoolUrl = schoolUrl.trim().replace(/\/$/, "");

                try {
                    const school = { baseUrl: schoolUrl };
                    
                    // Récupération du client avec les paramètres OIDC de l'ENT
                    const oidClient = await Skolengo.getOIDClient(school);

                    const protocol = req.headers['x-forwarded-proto'] || (req.headers.host.includes('localhost') ? 'http' : 'https');
                    const redirectUri = `${protocol}://${req.headers.host}/login.html`;

                    // Génération de l'URL comme dans le code de Papillon (mode PLAIN)
                    const authURL = oidClient.authorizationUrl({
                        redirect_uri: redirectUri,
                        scope: 'openid profile email education',
                        response_type: 'code',
                        // Ajout du challenge pour éviter les rejets OIDC (très important pour l'Occitanie)
                        code_challenge_method: 'plain',
                        code_challenge: Math.random().toString(36).substring(2, 15),
                        state: Math.random().toString(36).substring(7),
                    });

                    console.log("AuthURL OK pour:", schoolUrl);
                    return res.json({ authURL });

                } catch (oidErr) {
                    console.error("Détail erreur OIDC:", oidErr.message);
                    // On renvoie un message spécifique pour que le front sache que c'est l'ENT qui bloque
                    return res.status(500).json({ 
                        error: `L'ENT (${schoolUrl}) bloque la connexion externe.`,
                        details: oidErr.message 
                    });
                }

            case 'callback':
                const { code, url } = query;
                if (!code || !url) throw new Error("Paramètres callback manquants");

                const callbackSchool = { baseUrl: url.trim().replace(/\/$/, "") };
                const oid = await Skolengo.getOIDClient(callbackSchool);
                
                const cbProtocol = req.headers['x-forwarded-proto'] || (req.headers.host.includes('localhost') ? 'http' : 'https');
                const cbUri = `${cbProtocol}://${req.headers.host}/login.html`;

                // Finalisation de l'échange (Échange du code contre un Token)
                const tokenSet = await oid.callback(cbUri, { code });
                const client = await Skolengo.fromConfigObject({ tokenSet, school: callbackSchool });

                // On récupère les infos pour être sûr que la session est valide
                const userInfo = await client.getUserInfo();

                return res.json({ 
                    success: true, 
                    session: client.toConfigObject(), 
                    user: userInfo
                });

            default:
                return res.json({ status: "ready", message: "ENT+ API is running" });
        }
    } catch (error) {
        console.error("--- ERREUR SERVEUR ---");
        console.error("Action:", action);
        console.error("Message:", error.message);
        
        return res.status(500).json({ 
            error: error.message,
            debug: "Consultez les logs de votre terminal Node ou Vercel."
        });
    }
};