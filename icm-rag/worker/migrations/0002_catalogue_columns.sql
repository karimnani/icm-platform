-- À exécuter UNE seule fois sur la base D1 déjà créée (le catalogue RAG stocke désormais ces compteurs en base).
ALTER TABLE document_version ADD COLUMN chunks INTEGER;
ALTER TABLE document_version ADD COLUMN chars INTEGER;
