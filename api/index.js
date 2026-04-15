const { Skolengo } = require('scolengo-api');
const crypto = require('crypto');

module.exports = async (req, res) => {
    // Headers CORS - Autorise ton front-end à appeler cette API
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    // Parsing du body (supporte JSON brut ou stringify)
    let body = {};
    if (req.method === 'POST' && req.body) {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    }

    const query = { ...req.query, ...body };
    const action = query.action;

    // Détermination dynamique de l'URL de base pour les redirections
    const getBaseUrl = () => {
        const protocol = req.headers['x-forwarded-proto'] || (req.headers.host.includes('localhost') ? 'http' : 'https');
        return `${protocol}://${req.headers.host}`;
    };

    try {
        switch (action) {

            // ─── RECHERCHE ÉCOLE ─────────────────────────────────────────────
            case 'search-school': {
                const q = query.q || query.text;
                if (!q || q.length < 3) return res.json([]);
                
                try {
                    const schools = await Skolengo.searchSchool({ text: q }, 15);
                    return res.json(Array.isArray(schools) ? schools : []);
                } catch (e) {
                    console.error("Erreur Search:", e.message);
                    return res.json([]);
                }
            }

            // ─── GÉNÉRATION URL AUTH (PKCE S256) ─────────────────────────────
            case 'get-auth-url': {
                let schoolUrl = query.url;
                if (!schoolUrl) return res.status(400).json({ error: "URL manquante" });
                
                schoolUrl = decodeURIComponent(schoolUrl).trim().replace(/\/$/, '');
                const oidClient = await Skolengo.getOIDClient({ baseUrl: schoolUrl });
                const redirectUri = `${getBaseUrl()}/login.html`;

                // Création du challenge PKCE
                const codeVerifier = crypto.randomBytes(32).toString('base64url');
                const codeChallenge = crypto.createHash('sha256')
                    .update(codeVerifier)
                    .digest('base64url');

                const authURL = oidClient.authorizationUrl({
                    redirect_uri: redirectUri,
                    scope: 'openid profile email education',
                    response_type: 'code',
                    code_challenge_method: 'S256',
                    code_challenge: codeChallenge,
                    state: crypto.randomBytes(8).toString('hex'),
                });

                // On renvoie le verifier au client pour qu'il le stocke dans localStorage
                return res.json({ authURL, codeVerifier });
            }

            // ─── CALLBACK OAUTH ───────────────────────────────────────────────
            case 'callback': {
                const { code, url, verifier } = query;
                if (!code || !url || !verifier) {
                    return res.status(400).json({ error: "Paramètres de session manquants" });
                }

                const school = { baseUrl: decodeURIComponent(url).trim().replace(/\/$/, '') };
                const oid = await Skolengo.getOIDClient(school);
                const redirectUri = `${getBaseUrl()}/login.html`;

                // Échange du code contre les tokens d'accès
                const tokenSet = await oid.callback(
                    redirectUri, 
                    { code }, 
                    { code_verifier: verifier }
                );

                const client = await Skolengo.fromConfigObject({ tokenSet, school });
                const userInfo = await client.getUserInfo();

                return res.json({
                    success: true,
                    session: client.toConfigObject(),
                    user: userInfo
                });
            }

            // ─── RÉCUPÉRATION DES DONNÉES ─────────────────────────────────────
            case 'devoirs': {
                if (!body.session) return res.status(401).json({ error: "Non authentifié" });
                const client = await Skolengo.fromConfigObject(body.session);
                const items = await client.getHomeworks();
                return res.json({ success: true, items: items || [] });
            }

            case 'agenda': {
                if (!body.session) return res.status(401).json({ error: "Non authentifié" });
                const client = await Skolengo.fromConfigObject(body.session);
                const start = query.from || new Date().toISOString().split('T')[0];
                const end = query.to || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
                const items = await client.getAgenda(start, end);
                return res.json({ success: true, items: items || [] });
            }

            case 'evaluations': {
                if (!body.session) return res.status(401).json({ error: "Non authentifié" });
                const client = await Skolengo.fromConfigObject(body.session);
                const items = await client.getEvaluations();
                return res.json({ success: true, items: items || [] });
            }

            case 'messages': {
                if (!body.session) return res.status(401).json({ error: "Non authentifié" });
                const client = await Skolengo.fromConfigObject(body.session);
                const items = await client.getCommunications();
                return res.json({ success: true, items: items || [] });
            }

            default:
                return res.json({ status: "ok", service: "ENT+ API", version: "3.1" });
        }

    } catch (error) {
        console.error(`[API ERROR]`, error.message);
        return res.status(500).json({
            error: error.message,
            action: action
        });
    }
};