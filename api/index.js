const { Skolengo } = require('scolengo-api');

module.exports = async (req, res) => {
    // Headers CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // Extraction des paramètres peu importe la méthode (GET ou POST)
    const action = req.query.action || (req.body && req.body.action);
    const q = req.query.q;
    const code = req.query.code;
    const schoolUrl = req.query.url;

    try {
        // Parsing du body si présent
        let body = {};
        if (req.body) {
            body = (typeof req.body === 'string') ? JSON.parse(req.body) : req.body;
        }

        switch (action) {
            case 'search-school':
                // On s'assure d'avoir une requête
                const searchTerm = q || req.query.text; 
                if (!searchTerm) return res.json([]);

                // Appel à la méthode statique de recherche
                const schools = await Skolengo.searchSchool({ text: searchTerm }, 15);
                return res.json(schools);

            case 'get-auth-url':
                if (!schoolUrl) throw new Error("URL de l'établissement manquante");
                
                const schoolObj = { baseUrl: schoolUrl };
                const oidClient = await Skolengo.getOIDClient(schoolObj);
                
                // On utilise l'hôte actuel pour la redirection
                const protocol = req.headers['x-forwarded-proto'] || 'https';
                const redirectUri = `${protocol}://${req.headers.host}/login.html`;
                
                const authURL = oidClient.authorizationUrl({
                    redirect_uri: redirectUri,
                    scope: 'openid profile email education',
                });
                
                return res.json({ authURL });

            case 'callback':
                if (!code || !schoolUrl) throw new Error("Code ou URL manquants");
                
                const targetSchool = { baseUrl: schoolUrl };
                const oid = await Skolengo.getOIDClient(targetSchool);
                
                const cbProtocol = req.headers['x-forwarded-proto'] || 'https';
                const callbackUri = `${cbProtocol}://${req.headers.host}/login.html`;

                const tokenSet = await oid.callback(callbackUri, { code });
                
                const client = await Skolengo.fromConfigObject({ 
                    tokenSet, 
                    school: targetSchool 
                });

                return res.json({ 
                    success: true, 
                    session: client.toConfigObject(), 
                    user: await client.getUserInfo() 
                });

            case 'devoirs':
                const sessionData = body.session || (req.query.session ? JSON.parse(req.query.session) : null);
                if (!sessionData) return res.status(401).json({ error: "Non connecté" });
                
                const sessionClient = await Skolengo.fromConfigObject(sessionData);
                const studentId = sessionClient.getTokenClaims().sub;
                
                const start = new Date().toISOString().split('T')[0];
                const end = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                
                const homework = await sessionClient.getHomeworkAssignments(studentId, start, end);
                return res.json(homework);

            default:
                return res.json({ status: "API Connectée", actionReceived: action });
        }
    } catch (error) {
        console.error("ERREUR API:", error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
};