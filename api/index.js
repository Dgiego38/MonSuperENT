const { Skolengo } = require('scolengo-api');
const crypto = require('crypto');

module.exports = async (req, res) => {
    // Headers CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    // Parse body robuste
    let body = {};
    if (req.method === 'POST' && req.body) {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    }

    const query = { ...req.query, ...body };
    const action = query.action;

    // Helpers pour les URLs de redirection
    const getProtocol = () => req.headers['x-forwarded-proto'] || (req.headers.host.includes('localhost') ? 'http' : 'https');
    const getHost = () => req.headers.host;
    const getBaseUrl = () => `${getProtocol()}://${getHost()}`;

    try {
        switch (action) {

            // ─── RECHERCHE D'ÉCOLE (Version Robuste) ──────────────────────────
            case 'search-school': {
                const q = query.q || query.text;
                if (!q || q.length < 3) return res.json([]);
                
                try {
                    const schools = await Skolengo.searchSchool({ text: q }, 15);
                    return res.json(Array.isArray(schools) ? schools : []);
                } catch (e) {
                    console.error("Erreur Skolengo Search:", e.message);
                    return res.json([]); // On renvoie vide au lieu d'une 500
                }
            }

            // ─── GÉNÉRATION URL AUTH (PKCE S256) ─────────────────────────────
            case 'get-auth-url': {
                let schoolUrl = query.url;
                if (!schoolUrl) return res.status(400).json({ error: "URL manquante" });
                
                schoolUrl = decodeURIComponent(schoolUrl).trim().replace(/\/$/, '');
                const school = { baseUrl: schoolUrl };
                const oidClient = await Skolengo.getOIDClient(school);
                const redirectUri = `${getBaseUrl()}/login.html`;

                // Génération PKCE S256
                // Note: En mode serverless, le verifier doit être stocké par le client (localStorage)
                const codeVerifier = crypto.randomBytes(32).toString('base64url');
                const codeChallenge = crypto.createHash('sha256')
                    .update(codeVerifier)
                    .digest('base64url');

                const state = crypto.randomBytes(8).toString('hex');

                const authURL = oidClient.authorizationUrl({
                    redirect_uri: redirectUri,
                    scope: 'openid profile email education',
                    response_type: 'code',
                    code_challenge_method: 'S256',
                    code_challenge: codeChallenge,
                    state,
                });

                // On renvoie le verifier au front pour qu'il le sauvegarde avant la redirection
                return res.json({ authURL, codeVerifier, state });
            }

            // ─── CALLBACK OAUTH ───────────────────────────────────────────────
            case 'callback': {
                const { code, url, verifier } = query;
                if (!code || !url || !verifier) {
                    return res.status(400).json({ error: "Paramètres callback manquants" });
                }

                const callbackSchool = { baseUrl: decodeURIComponent(url).trim().replace(/\/$/, '') };
                const oid = await Skolengo.getOIDClient(callbackSchool);
                const redirectUri = `${getBaseUrl()}/login.html`;

                // Échange du code contre le token avec le verifier S256
                const tokenSet = await oid.callback(
                    redirectUri, 
                    { code }, 
                    { code_verifier: verifier }
                );

                const client = await Skolengo.fromConfigObject({
                    tokenSet,
                    school: callbackSchool
                });

                const userInfo = await client.getUserInfo();

                return res.json({
                    success: true,
                    session: client.toConfigObject(),
                    user: userInfo
                });
            }

            // ─── DEVOIRS ──────────────────────────────────────────────────────
            case 'devoirs': {
                const { session } = body;
                if (!session) return res.status(401).json({ error: "Session manquante" });
                const client = await Skolengo.fromConfigObject(session);
                const homeworks = await client.getHomeworks();
                return res.json({ success: true, items: homeworks || [] });
            }

            // ─── AGENDA ───────────────────────────────────────────────────────
            case 'agenda': {
                const { session, from, to } = body;
                if (!session) return res.status(401).json({ error: "Session manquante" });
                const client = await Skolengo.fromConfigObject(session);
                const start = from || new Date().toISOString().split('T')[0];
                const end = to || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
                const agenda = await client.getAgenda(start, end);
                return res.json({ success: true, items: agenda || [] });
            }

            // ─── ÉVALUATIONS ──────────────────────────────────────────────────
            case 'evaluations': {
                const { session } = body;
                if (!session) return res.status(401).json({ error: "Session manquante" });
                const client = await Skolengo.fromConfigObject(session);
                const evals = await client.getEvaluations();
                return res.json({ success: true, items: evals || [] });
            }

            // ─── MESSAGERIE ──────────────────────────────────────────────────
            case 'messages': {
                const { session } = body;
                if (!session) return res.status(401).json({ error: "Session manquante" });
                const client = await Skolengo.fromConfigObject(session);
                const communications = await client.getCommunications();
                return res.json({ success: true, items: communications || [] });
            }

            default:
                return res.json({ status: "ok", service: "ENT+ API", version: "3.1" });
        }

    } catch (error) {
        console.error(`[ENT+ API] Error:`, error.message);
        return res.status(500).json({
            error: error.message,
            action
        });
    }
};