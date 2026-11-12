-- À exécuter UNE seule fois sur une base D1 déjà créée (les installations neuves utilisent schema.sql, qui contient déjà ces colonnes).
--   npx wrangler d1 execute icm-database --remote --file=migrations/0003_pilotage.sql
-- Boucle d'amélioration continue : une évaluation (note) est rattachée à la réponse évaluée, et son traitement est tracé.
ALTER TABLE note ADD COLUMN message_id TEXT REFERENCES message(id) ON DELETE CASCADE;
ALTER TABLE note ADD COLUMN suivi_commentaire TEXT;
ALTER TABLE note ADD COLUMN traite_par TEXT REFERENCES user(id) ON DELETE SET NULL;
ALTER TABLE note ADD COLUMN traite_at TIMESTAMP;
-- Citations : titre de section (la page n'est renseignée que si le convertisseur fournit des sauts de page).
ALTER TABLE citation ADD COLUMN section TEXT;
CREATE INDEX IF NOT EXISTS idx_disc_projet ON discussion(projet_id, user_id);
CREATE INDEX IF NOT EXISTS idx_note_discussion ON note(discussion_id);
CREATE INDEX IF NOT EXISTS idx_note_message ON note(message_id);
CREATE INDEX IF NOT EXISTS idx_citation_message ON citation(message_id);
-- NB : sur une base existante, rapport.machine_id garde son ancienne clé étrangère (ON DELETE CASCADE) : SQLite ne permet pas de la modifier
-- sans reconstruire la table. L'API refuse déjà toute suppression d'un élément portant des comptes rendus (409) ; aucune autre voie ne supprime de machine.
