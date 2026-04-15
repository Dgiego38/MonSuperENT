const { Skolengo } = require('scolengo-api');
const crypto = require('crypto');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    // Parse body si POST
    let body = {};
    if (req.method === 'POST' && req.body) {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    }

    const query = { ...req.query, ...body };
    const action = req.query.action || query.action;

    const getProtocol = () => req.headers['x-forwarded-proto'] || 'https';
    const getHost = () => req.headers['x-forwarded-host'] || req.headers.host;
    const getBaseUrl = () => `${getProtocol()}://${getHost()}`;

    try {
        switch (action) {

            // ─── RECHERCHE D'ÉCOLE ────────────────────────────────────────────
            case 'search-school': {
                const q = req.query.q || query.q;
                if (!q || q.length < 2) return res.json([]);
                const schools = await Skolengo.searchSchool({ text: q }, 20);
                return res.json(schools || []);
            }

            // ─── GÉNÉRATION URL AUTH (PKCE S256 correct) ─────────────────────
            case 'get-auth-url': {
                let schoolUrl = req.query.url || query.url;
                if (!schoolUrl) return res.status(400).json({ error: "URL manquante" });
                schoolUrl = decodeURIComponent(schoolUrl).trim().replace(/\/$/, '');

                const school = { baseUrl: schoolUrl };
                const oidClient = await Skolengo.getOIDClient(school);
                const redirectUri = `${getBaseUrl()}/login.html`;

                // PKCE S256 propre
                const codeVerifier = crypto.randomBytes(32).toString('base64url');
                const codeChallenge = crypto.createHash('sha256')
                    .update(codeVerifier)
                    .digest('base64url');

                const state = crypto.randomBytes(8).toString('hex');

                const authURL = oidClient.authorizationUrl({
                    redirect_uri: redirectUri,
                    scope: 'openid profile email',
                    response_type: 'code',
                    code_challenge_method: 'S256',
                    code_challenge: codeChallenge,
                    state,
                });

                return res.json({ authURL, codeVerifier, state });
            }

            // ─── CALLBACK OAUTH ───────────────────────────────────────────────
            case 'callback': {
                const code = req.query.code || query.code;
                const schoolUrl = req.query.url || query.url;
                const verifier = req.query.verifier || query.verifier;

                if (!code || !schoolUrl || !verifier) {
                    return res.status(400).json({ error: "Paramètres incomplets", received: { code: !!code, url: !!schoolUrl, verifier: !!verifier } });
                }

                const callbackSchool = { baseUrl: decodeURIComponent(schoolUrl).trim().replace(/\/$/, '') };
                const oid = await Skolengo.getOIDClient(callbackSchool);
                const redirectUri = `${getBaseUrl()}/login.html`;

                const tokenSet = await oid.callback(
                    redirectUri,
                    { code },
                    { code_verifier: decodeURIComponent(verifier) }
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

            // ─── AGENDA / EMPLOI DU TEMPS ─────────────────────────────────────
            case 'agenda': {
                const { session, from, to } = body;
                if (!session) return res.status(401).json({ error: "Session manquante" });

                const client = await Skolengo.fromConfigObject(session);
                const startDate = from || new Date().toISOString().split('T')[0];
                const endDate = to || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

                const agenda = await client.getAgenda(startDate, endDate);
                return res.json({ success: true, items: agenda || [] });
            }

            // ─── ÉVALUATIONS / NOTES ─────────────────────────────────────────
            case 'evaluations': {
                const { session } = body;
                if (!session) return res.status(401).json({ error: "Session manquante" });

                const client = await Skolengo.fromConfigObject(session);
                const evals = await client.getEvaluations();
                return res.json({ success: true, items: evals || [] });
            }

            // ─── ABSENCES ────────────────────────────────────────────────────
            case 'absences': {
                const { session } = body;
                if (!session) return res.status(401).json({ error: "Session manquante" });

                const client = await Skolengo.fromConfigObject(session);
                const absences = await client.getAbsenceFiles();
                return res.json({ success: true, items: absences || [] });
            }

            // ─── MESSAGERIE ──────────────────────────────────────────────────
            case 'messages': {
                const { session, folderId } = body;
                if (!session) return res.status(401).json({ error: "Session manquante" });

                const client = await Skolengo.fromConfigObject(session);
                const msgs = await client.getUsersMailSettings();
                const communications = await client.getCommunications();
                return res.json({ success: true, items: communications || [], settings: msgs });
            }

            // ─── FICHES ÉLÈVES ────────────────────────────────────────────────
            case 'students': {
                const { session } = body;
                if (!session) return res.status(401).json({ error: "Session manquante" });

                const client = await Skolengo.fromConfigObject(session);
                const userInfo = await client.getUserInfo();
                return res.json({ success: true, user: userInfo });
            }

            // ─── REFRESH TOKEN ────────────────────────────────────────────────
            case 'refresh': {
                const { session } = body;
                if (!session) return res.status(401).json({ error: "Session manquante" });

                const client = await Skolengo.fromConfigObject(session);
                await client.refreshToken();
                return res.json({ success: true, session: client.toConfigObject() });
            }

            // ─── HEALTH CHECK ─────────────────────────────────────────────────
            default:
                return res.json({ status: "ok", version: "ENT+ API v3.0", timestamp: new Date().toISOString() });
        }

    } catch (error) {
        console.error(`[ENT+ API] Error on action "${action}":`, error.message);
        return res.status(500).json({
            error: error.message,
            action,
            stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
        });
    }
};
