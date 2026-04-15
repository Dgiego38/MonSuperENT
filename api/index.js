const { Skolengo } = require('scolengo-api');
const crypto = require('crypto');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    let body = {};
    if (req.method === 'POST' && req.body) {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    }

    const query = { ...req.query, ...body };
    const action = query.action;

    const getBaseUrl = () => {
        const protocol =
            req.headers['x-forwarded-proto'] ||
            (req.headers.host.includes('localhost') ? 'http' : 'https');
        return `${protocol}://${req.headers.host}`;
    };

    try {

        // ───────────────────────────────
        // 🔍 SEARCH SCHOOL
        // ───────────────────────────────
        if (action === 'search-school') {
            const q = query.q || query.text;
            if (!q || q.length < 3) return res.json([]);

            try {
                const schools = await Skolengo.searchSchool({ text: q }, 10);

                console.log("SCHOOLS:", schools);

                return res.json(schools);

            } catch (e) {
                console.error("Erreur Search:", e.message);
                return res.json([]);
            }
        }

        // ───────────────────────────────
        // 🔐 AUTH URL (FIX TOTAL)
        // ───────────────────────────────
        if (action === 'get-auth-url') {

            // 🔥 ON FORCE L’API OFFICIELLE (clé du fix)
            const oidClient = await Skolengo.getOIDClient({
                baseUrl: "https://api.skolengo.com"
            });

            const redirectUri = `${getBaseUrl()}/login.html`;

            const codeVerifier = crypto.randomBytes(32).toString('base64url');
            const codeChallenge = crypto
                .createHash('sha256')
                .update(codeVerifier)
                .digest('base64url');

            const authURL = oidClient.authorizationUrl({
                redirect_uri: redirectUri,
                scope: 'openid profile email',
                response_type: 'code',
                code_challenge_method: 'S256',
                code_challenge: codeChallenge,
                state: crypto.randomBytes(8).toString('hex'),
            });

            console.log("AUTH URL:", authURL);

            return res.json({ authURL, codeVerifier });
        }

        // ───────────────────────────────
        // 🔁 CALLBACK (FIX TOTAL)
        // ───────────────────────────────
        if (action === 'callback') {
            const { code, verifier } = query;

            if (!code || !verifier) {
                return res.status(400).json({
                    error: "Paramètres manquants"
                });
            }

            const oid = await Skolengo.getOIDClient({
                baseUrl: "https://api.skolengo.com"
            });

            const redirectUri = `${getBaseUrl()}/login.html`;

            const tokenSet = await oid.callback(
                redirectUri,
                { code },
                { code_verifier: verifier }
            );

            const client = await Skolengo.fromConfigObject({
                tokenSet
            });

            const userInfo = await client.getUserInfo();

            return res.json({
                success: true,
                session: client.toConfigObject(),
                user: userInfo
            });
        }

        // ───────────────────────────────
        // 📚 DATA
        // ───────────────────────────────
        if (action === 'devoirs') {
            if (!body.session) return res.status(401).json({ error: "Non authentifié" });

            const client = await Skolengo.fromConfigObject(body.session);
            const items = await client.getHomeworks();

            return res.json({ success: true, items: items || [] });
        }

        if (action === 'agenda') {
            if (!body.session) return res.status(401).json({ error: "Non authentifié" });

            const client = await Skolengo.fromConfigObject(body.session);

            const start = query.from || new Date().toISOString().split('T')[0];
            const end = query.to || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

            const items = await client.getAgenda(start, end);

            return res.json({ success: true, items: items || [] });
        }

        if (action === 'evaluations') {
            if (!body.session) return res.status(401).json({ error: "Non authentifié" });

            const client = await Skolengo.fromConfigObject(body.session);
            const items = await client.getEvaluations();

            return res.json({ success: true, items: items || [] });
        }

        if (action === 'messages') {
            if (!body.session) return res.status(401).json({ error: "Non authentifié" });

            const client = await Skolengo.fromConfigObject(body.session);
            const items = await client.getCommunications();

            return res.json({ success: true, items: items || [] });
        }

        return res.json({
            status: "ok",
            service: "ENT+ API FIXED",
        });

    } catch (error) {
        console.error("[API ERROR]", error.message);

        return res.status(500).json({
            error: error.message,
            action: action
        });
    }
};