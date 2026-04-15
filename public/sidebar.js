// ═══════════════════════════════════════════════════════════
// ENT+ Sidebar Renderer
// ═══════════════════════════════════════════════════════════

function renderSidebar(activePage) {
    const user = Session.getUser();
    const name = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Élève';
    const initials = user ? ((user.firstName||'?')[0]+(user.lastName||'?')[0]).toUpperCase() : '?';

    const pages = [
        { id: 'accueil',          href: 'accueil.html',          icon: '🏠', label: 'Tableau de bord' },
        { id: 'cahier-de-texte',  href: 'cahier-de-texte.html',  icon: '📒', label: 'Cahier de texte' },
        { id: 'emploi-du-temps',  href: 'emploi-du-temps.html',  icon: '🗓️', label: 'Emploi du temps' },
        { id: 'evaluations',      href: 'evaluations.html',      icon: '📊', label: 'Évaluations' },
        { id: 'absences',         href: 'absences.html',         icon: '🚫', label: 'Absences' },
        { id: 'messagerie',       href: 'messagerie.html',       icon: '✉️', label: 'Messagerie' },
        { id: 'fiche-eleve',      href: 'fiche-eleve.html',      icon: '👤', label: 'Mon profil' },
    ];

    const linksHTML = pages.map(p => `
        <a href="${p.href}" class="nav-item ${p.id === activePage ? 'active' : ''}">
            <span class="nav-icon">${p.icon}</span>
            <span>${p.label}</span>
        </a>
    `).join('');

    return `
        <nav class="sidebar" id="sidebar">
            <div class="logo">
                <div class="logo-icon">🏫</div>
                ENT+
            </div>

            <span class="nav-section-label">Navigation</span>
            ${linksHTML}

            <div class="sidebar-spacer"></div>

            <div class="sidebar-user">
                <div class="user-avatar" id="userAvatar">${initials}</div>
                <div>
                    <div class="user-name" id="userName">${name}</div>
                    <div class="user-role">Élève</div>
                </div>
                <button class="btn-logout" onclick="Session.logout()" title="Déconnexion">↪</button>
            </div>
        </nav>
    `;
}

function initPage(activePage) {
    if (!Session.check()) return;
    document.body.insertAdjacentHTML('afterbegin', renderSidebar(activePage));
}
