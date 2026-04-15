// ═══════════════════════════════════════════════════════════
// ENT+ Shared Utilities v3.0
// ═══════════════════════════════════════════════════════════

// ─── SESSION ────────────────────────────────────────────────
const Session = {
    check() {
        if (localStorage.getItem('ent_logged') !== 'true') {
            window.location.replace('/login.html');
            return false;
        }
        return true;
    },
    get() {
        const raw = localStorage.getItem('ent_session');
        return raw ? JSON.parse(raw) : null;
    },
    getUser() {
        const raw = localStorage.getItem('ent_user');
        return raw ? JSON.parse(raw) : null;
    },
    logout() {
        localStorage.clear();
        window.location.replace('/login.html');
    }
};

// ─── API CALLS ───────────────────────────────────────────────
const API = {
    async post(action, extra = {}) {
        const session = Session.get();
        const res = await fetch(`/api/index?action=${action}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session, ...extra })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        return data;
    }
};

// ─── DATE UTILS ─────────────────────────────────────────────
const DateUtils = {
    format(dateStr, opts = {}) {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        if (isNaN(d)) return '—';
        return d.toLocaleDateString('fr-FR', opts);
    },
    short(dateStr) {
        return this.format(dateStr, { day: 'numeric', month: 'short' });
    },
    long(dateStr) {
        return this.format(dateStr, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    },
    weekday(dateStr) {
        return this.format(dateStr, { weekday: 'short', day: 'numeric', month: 'short' });
    },
    isUrgent(dateStr) {
        const d = new Date(dateStr);
        const diff = (d - new Date()) / (1000 * 3600 * 24);
        return diff >= 0 && diff <= 2;
    },
    isOverdue(dateStr) {
        return new Date(dateStr) < new Date();
    }
};

// ─── DOM HELPERS ────────────────────────────────────────────
const DOM = {
    $(sel) { return document.querySelector(sel); },
    $$(sel) { return document.querySelectorAll(sel); },
    setUserInfo() {
        const user = Session.getUser();
        if (!user) return;
        const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
        const initials = ((user.firstName || '?')[0] + (user.lastName || '?')[0]).toUpperCase();

        const nameEl = document.getElementById('userName');
        const avatarEl = document.getElementById('userAvatar');
        if (nameEl) nameEl.textContent = name;
        if (avatarEl) avatarEl.textContent = initials;
    },
    loading(id, msg = 'Chargement...') {
        const el = document.getElementById(id);
        if (el) el.innerHTML = `
            <div class="empty-state">
                <div class="loading-dots">
                    <span></span><span></span><span></span>
                </div>
                <p style="color:var(--text-3); font-size:13px;">${msg}</p>
            </div>
        `;
    },
    error(id, msg = 'Erreur de connexion.') {
        const el = document.getElementById(id);
        if (el) el.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">⚠️</span>
                <div class="empty-title">Erreur</div>
                <p style="color:var(--text-3); font-size:13px;">${msg}</p>
                <button class="btn btn-ghost" style="margin-top:16px" onclick="location.reload()">Réessayer</button>
            </div>
        `;
    },
    empty(id, icon, title, sub = '') {
        const el = document.getElementById(id);
        if (el) el.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">${icon}</span>
                <div class="empty-title">${title}</div>
                ${sub ? `<p style="color:var(--text-3); font-size:13px;">${sub}</p>` : ''}
            </div>
        `;
    }
};

// ─── SUBJECT COLOR ───────────────────────────────────────────
function subjectColor(name = '') {
    const n = name.toLowerCase();
    if (n.includes('math'))   return '#4f8ef7';
    if (n.includes('fran'))   return '#a78bfa';
    if (n.includes('hist') || n.includes('géo')) return '#fb923c';
    if (n.includes('sc') || n.includes('svt') || n.includes('phy')) return '#34d399';
    if (n.includes('angl') || n.includes('esp') || n.includes('all')) return '#f472b6';
    if (n.includes('sport') || n.includes('eps')) return '#fbbf24';
    if (n.includes('info') || n.includes('nsi')) return '#22d3ee';
    const colors = ['#4f8ef7','#a78bfa','#34d399','#fb923c','#f472b6','#fbbf24','#22d3ee'];
    return colors[name.charCodeAt(0) % colors.length];
}

// ─── MODAL ───────────────────────────────────────────────────
function openModal(content) {
    const overlay = document.getElementById('modal');
    const box = document.getElementById('modalContent');
    if (!overlay || !box) return;
    box.innerHTML = content;
    overlay.classList.add('open');
}

function closeModal() {
    const overlay = document.getElementById('modal');
    if (overlay) overlay.classList.remove('open');
}

// Close on overlay click
document.addEventListener('click', e => {
    if (e.target.id === 'modal') closeModal();
});
