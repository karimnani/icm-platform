-- Activer les contraintes de clés étrangères
PRAGMA foreign_keys = ON;

-- ========================================================
-- 1. PROJETS & UTILISATEURS
-- ========================================================
CREATE TABLE IF NOT EXISTS projet (
    id TEXT PRIMARY KEY,
    nom TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user (
    id TEXT PRIMARY KEY,
    login TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Association "Affecter" (User <-> Projet avec rôle)
CREATE TABLE IF NOT EXISTS affecter (
    user_id TEXT NOT NULL,
    projet_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('Admin', 'Technicien')),
    PRIMARY KEY (user_id, projet_id),
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
    FOREIGN KEY (projet_id) REFERENCES projet(id) ON DELETE CASCADE
);

-- ========================================================
-- 2. ARBORESCENCE INDUSTRIELLE (Site > Atelier > Ligne > Machine)
-- ========================================================
CREATE TABLE IF NOT EXISTS site (
    id TEXT PRIMARY KEY,
    nom TEXT NOT NULL,
    localisation TEXT,
    projet_id TEXT NOT NULL,
    FOREIGN KEY (projet_id) REFERENCES projet(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS atelier (
    id TEXT PRIMARY KEY,
    nom TEXT NOT NULL,
    localisation TEXT,
    site_id TEXT NOT NULL,
    FOREIGN KEY (site_id) REFERENCES site(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ligne (
    id TEXT PRIMARY KEY,
    nom TEXT NOT NULL,
    localisation TEXT,
    atelier_id TEXT NOT NULL,
    FOREIGN KEY (atelier_id) REFERENCES atelier(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS machine (
    id TEXT PRIMARY KEY,
    nom TEXT NOT NULL,
    code_equipement TEXT UNIQUE,
    modele TEXT,
    numero_serie TEXT,
    ligne_id TEXT NOT NULL,
    FOREIGN KEY (ligne_id) REFERENCES ligne(id) ON DELETE CASCADE
);

-- ========================================================
-- 3. GESTION DOCUMENTAIRE
-- ========================================================
CREATE TABLE IF NOT EXISTS type_document (
    id TEXT PRIMARY KEY,
    nom TEXT NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS document (
    id TEXT PRIMARY KEY,
    titre TEXT NOT NULL,
    qualification TEXT DEFAULT 'brut' CHECK(qualification IN ('brut', 'indexe', 'valide')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    projet_id TEXT NOT NULL,
    type_id TEXT NOT NULL,
    -- Rattachement au niveau souhaité dans l'arborescence (relation "Concerner")
    site_id TEXT,
    atelier_id TEXT,
    ligne_id TEXT,
    machine_id TEXT,
    FOREIGN KEY (projet_id) REFERENCES projet(id) ON DELETE CASCADE,
    FOREIGN KEY (type_id) REFERENCES type_document(id),
    FOREIGN KEY (site_id) REFERENCES site(id) ON DELETE SET NULL,
    FOREIGN KEY (atelier_id) REFERENCES atelier(id) ON DELETE SET NULL,
    FOREIGN KEY (ligne_id) REFERENCES ligne(id) ON DELETE SET NULL,
    FOREIGN KEY (machine_id) REFERENCES machine(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS document_version (
    id TEXT PRIMARY KEY,
    numero INTEGER NOT NULL,
    fichier_path TEXT,
    type_mime TEXT,
    nb_pages INTEGER,
    note_changement TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    document_id TEXT NOT NULL,
    FOREIGN KEY (document_id) REFERENCES document(id) ON DELETE CASCADE
);

-- ========================================================
-- 4. CONNAISSANCES, DÉCISIONS & RAPPORTS
-- ========================================================
CREATE TABLE IF NOT EXISTS connaissance (
    id TEXT PRIMARY KEY,
    sujet TEXT NOT NULL,
    relation TEXT NOT NULL,
    objet TEXT NOT NULL,
    interpretation_ia TEXT,
    texte_valide TEXT,
    page INTEGER,
    statut TEXT DEFAULT 'attente' CHECK(statut IN ('attente', 'validee', 'rejetee', 'corrigee')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    document_version_id TEXT NOT NULL,
    machine_id TEXT,
    FOREIGN KEY (document_version_id) REFERENCES document_version(id) ON DELETE CASCADE,
    FOREIGN KEY (machine_id) REFERENCES machine(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS decision (
    id TEXT PRIMARY KEY,
    ancien_statut TEXT NOT NULL,
    nouveau_statut TEXT NOT NULL,
    motif TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    connaissance_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    FOREIGN KEY (connaissance_id) REFERENCES connaissance(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES user(id)
);

CREATE TABLE IF NOT EXISTS rapport (
    id TEXT PRIMARY KEY,
    reference TEXT UNIQUE NOT NULL,
    date DATE NOT NULL,
    type TEXT,
    duree REAL,
    duree_diagnostic REAL,
    probleme TEXT NOT NULL,
    diagnostic TEXT NOT NULL,
    actions TEXT NOT NULL,
    pieces TEXT,
    etat_final TEXT NOT NULL,
    statut TEXT DEFAULT 'Intégré à la base',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    auteur_id TEXT,
    machine_id TEXT NOT NULL,
    document_id TEXT,
    connaissance_id TEXT,
    FOREIGN KEY (auteur_id) REFERENCES user(id) ON DELETE SET NULL,
    -- RESTRICT (et non CASCADE) : supprimer une machine ne doit jamais détruire en silence ses comptes rendus
    -- (cohérent avec document.machine_id et avec le blocage appliqué par l'API : traçabilité de bout en bout).
    FOREIGN KEY (machine_id) REFERENCES machine(id) ON DELETE RESTRICT,
    FOREIGN KEY (document_id) REFERENCES document(id) ON DELETE SET NULL,
    FOREIGN KEY (connaissance_id) REFERENCES connaissance(id) ON DELETE SET NULL
);

-- ========================================================
-- 5. CHATBOT RAG & ÉVALUATIONS
-- ========================================================
CREATE TABLE IF NOT EXISTS discussion (
    id TEXT PRIMARY KEY,
    prompt TEXT,
    historique TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id TEXT,
    projet_id TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE SET NULL,
    FOREIGN KEY (projet_id) REFERENCES projet(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS message (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
    contenu TEXT NOT NULL,
    sans_reponse INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    discussion_id TEXT NOT NULL,
    FOREIGN KEY (discussion_id) REFERENCES discussion(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS citation (
    id TEXT PRIMARY KEY,
    page INTEGER,
    section TEXT,
    extrait TEXT,
    message_id TEXT NOT NULL,
    document_version_id TEXT,
    connaissance_id TEXT,
    FOREIGN KEY (message_id) REFERENCES message(id) ON DELETE CASCADE,
    FOREIGN KEY (document_version_id) REFERENCES document_version(id) ON DELETE SET NULL,
    FOREIGN KEY (connaissance_id) REFERENCES connaissance(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS note (
    id TEXT PRIMARY KEY,
    niveau_utile TEXT CHECK(niveau_utile IN ('satisfaisante', 'partielle', 'incorrecte')),
    commentaire TEXT,
    motif TEXT,
    statut_suivi TEXT DEFAULT 'À analyser',     -- 'À analyser' | 'Corrigé' | 'Sans suite' (validé par l'API)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    discussion_id TEXT NOT NULL,
    message_id TEXT,                             -- la réponse de l'assistant qui a été évaluée
    suivi_commentaire TEXT,                      -- ce qui a été corrigé (source, connaissance…) ou pourquoi sans suite
    traite_par TEXT,
    traite_at TIMESTAMP,
    FOREIGN KEY (discussion_id) REFERENCES discussion(id) ON DELETE CASCADE,
    FOREIGN KEY (message_id) REFERENCES message(id) ON DELETE CASCADE,
    FOREIGN KEY (traite_par) REFERENCES user(id) ON DELETE SET NULL
);

-- ========================================================
-- 6. AUDIT & LOGS
-- ========================================================
CREATE TABLE IF NOT EXISTS log (
    id TEXT PRIMARY KEY,
    categorie TEXT NOT NULL,
    action_sur_doc TEXT,
    action TEXT NOT NULL,
    element_type TEXT,
    element_id TEXT,
    detail TEXT,
    status TEXT DEFAULT 'Succès',
    login_saisi TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    projet_id TEXT,
    user_id TEXT,
    FOREIGN KEY (projet_id) REFERENCES projet(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE SET NULL
);

-- ========================================================
-- 7. INDEX D'ACCÉLÉRATION RECHERCHE & RAG
-- ========================================================
CREATE INDEX IF NOT EXISTS idx_doc_projet ON document(projet_id);
CREATE INDEX IF NOT EXISTS idx_version_doc ON document_version(document_id);
CREATE INDEX IF NOT EXISTS idx_machine_ligne ON machine(ligne_id);
CREATE INDEX IF NOT EXISTS idx_msg_discussion ON message(discussion_id);
CREATE INDEX IF NOT EXISTS idx_log_projet ON log(projet_id);
CREATE INDEX IF NOT EXISTS idx_disc_projet ON discussion(projet_id, user_id);
CREATE INDEX IF NOT EXISTS idx_note_discussion ON note(discussion_id);
CREATE INDEX IF NOT EXISTS idx_note_message ON note(message_id);
CREATE INDEX IF NOT EXISTS idx_citation_message ON citation(message_id);