const { Skolengo } = require('scolengo-api');

module.exports = async (req, res) => {
    // Headers CORS
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
                const schools = await Skolengo.searchSchool({ text: q }, 10);
                return res.json(schools);

            case 'get-auth-url':
                let schoolUrl = req.query.url;
                if (!schoolUrl) throw new Error("URL manquante");

                // NETTOYAGE DYNAMIQUE (Pour éviter emsOIDCWellKnownUrl invalid)
                // On retire les slashs de fin et les espaces
                schoolUrl = schoolUrl.trim().replace(/\/$/, "");

                try {
                    const school = { baseUrl: schoolUrl };
                    const oidClient = await Skolengo.getOIDClient(school);

                    // Redirection HTTPS forcée pour Vercel
                    const protocol = req.headers['x-forwarded-proto'] || 'https';
                    const redirectUri = `${protocol}://${req.headers.host}/login.html`;

                    const authURL = oidClient.authorizationUrl({
                        redirect_uri: redirectUri,
                        scope: 'openid profile email education',
                        response_type: 'code',
                        state: Math.random().toString(36).substring(7),
                    });

                    return res.json({ authURL });
                } catch (oidErr) {
                    // Si ça échoue, c'est souvent que l'URL du portail 
                    // n'est pas celle de l'IDP (Identité).
                    throw new Error(`L'établissement ${schoolUrl} ne semble pas supporter la connexion OIDC directe.`);
                }

            case 'callback':
                const { code, url } = req.query;
                if (!code || !url) throw new Error("Paramètres callback manquants");

                const callbackSchool = { baseUrl: url.trim().replace(/\/$/, "") };
                const oid = await Skolengo.getOIDClient(callbackSchool);
                
                const cbProtocol = req.headers['x-forwarded-proto'] || 'https';
                const cbUri = `${cbProtocol}://${req.headers.host}/login.html`;

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
        console.error("ERREUR API:", error.message);
        // On renvoie un message propre au front-end
        return res.status(500).json({ error: error.message });
    }
};