const { Skolengo } = require('scolengo-api');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const action = req.query.action || (req.body && req.body.action);
    
    try {
        switch (action) {
            case 'search-school':
                const q = req.query.q || req.query.text;
                if (!q || q.length < 3) return res.json([]);
                
                // On limite à 8 résultats pour une réponse instantanée
                const schools = await Skolengo.searchSchool({ text: q }, 8);
                return res.json(schools);

            case 'get-auth-url':
                const schoolUrl = req.query.url;
                if (!schoolUrl) throw new Error("URL manquante");

                // Configuration du client OIDC comme dans le projet original
                const school = { baseUrl: schoolUrl };
                const oidClient = await Skolengo.getOIDClient(school);
                
                // L'URL de redirection doit être STRICTEMENT en HTTPS sur Vercel
                const redirectUri = `https://${req.headers.host}/login.html`;
                
                const authURL = oidClient.authorizationUrl({
                    redirect_uri: redirectUri,
                    scope: 'openid profile email education',
                    response_type: 'code', // Obligatoire pour capturer le jeton
                });
                
                return res.json({ authURL });

            case 'callback':
                const { code, url } = req.query;
                const callbackSchool = { baseUrl: url };
                const oid = await Skolengo.getOIDClient(callbackSchool);
                const cbUri = `https://${req.headers.host}/login.html`;

                const tokenSet = await oid.callback(cbUri, { code });
                const client = await Skolengo.fromConfigObject({ tokenSet, school: callbackSchool });

                return res.json({ 
                    success: true, 
                    session: client.toConfigObject(), 
                    user: await client.getUserInfo() 
                });

            default:
                return res.json({ status: "ready" });
        }
    } catch (error) {
        console.error("Erreur détaillée:", error.message);
        return res.status(500).json({ error: error.message });
    }
};