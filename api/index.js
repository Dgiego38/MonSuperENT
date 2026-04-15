const { Skolengo } = require('scolengo-api');

module.exports = async (req, res) => {
    // Headers CORS pour éviter les blocages navigateur
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
                const schools = await Skolengo.searchSchool({ text: q }, 10);
                return res.json(schools);

            case 'get-auth-url':
                let schoolUrl = query.url;
                if (!schoolUrl) throw new Error("URL manquante");

                // Nettoyage de l'URL
                schoolUrl = schoolUrl.trim().replace(/\/$/, "");

                try {
                    // On définit l'établissement
                    const school = { baseUrl: schoolUrl };
                    
                    // On récupère le client OIDC avec un timeout ou une gestion d'erreur propre
                    const oidClient = await Skolengo.getOIDClient(school);

                    // Configuration de l'URL de retour (Redirect URI)
                    // En local ça donnera http://localhost:3000/login.html
                    // Sur Vercel ça donnera https://ton-projet.vercel.app/login.html
                    const protocol = req.headers['x-forwarded-proto'] || (req.headers.host.includes('localhost') ? 'http' : 'https');
                    const redirectUri = `${protocol}://${req.headers.host}/login.html`;

                    const authURL = oidClient.authorizationUrl({
                        redirect_uri: redirectUri,
                        scope: 'openid profile email education',
                        response_type: 'code',
                        state: Math.random().toString(36).substring(7),
                    });

                    console.log("AuthURL générée avec succès pour:", schoolUrl);
                    return res.json({ authURL });

                } catch (oidErr) {
                    console.error("Détail erreur OIDC:", oidErr);
                    throw new Error(`L'ENT (${schoolUrl}) ne répond pas ou refuse la connexion (OIDC Invalid).`);
                }

            case 'callback':
                const { code, url } = query;
                if (!code || !url) throw new Error("Paramètres callback manquants");

                const callbackSchool = { baseUrl: url.trim().replace(/\/$/, "") };
                const oid = await Skolengo.getOIDClient(callbackSchool);
                
                const cbProtocol = req.headers['x-forwarded-proto'] || (req.headers.host.includes('localhost') ? 'http' : 'https');
                const cbUri = `${cbProtocol}://${req.headers.host}/login.html`;

                const tokenSet = await oid.callback(cbUri, { code });
                const client = await Skolengo.fromConfigObject({ tokenSet, school: callbackSchool });

                return res.json({ 
                    success: true, 
                    session: client.toConfigObject(), 
                    user: await client.getUserInfo() 
                });

            default:
                return res.json({ status: "ready", message: "ENT+ API is running" });
        }
    } catch (error) {
        // C'est ici que l'erreur 500 est captée. On log le message réel dans ton terminal.
        console.error("--- ERREUR SERVEUR ---");
        console.error("Action:", action);
        console.error("Message:", error.message);
        
        return res.status(500).json({ 
            error: error.message,
            debug: "Vérifiez la console du serveur pour plus de détails."
        });
    }
};