-- Données initiales : projets, types de documents, comptes de démonstration.
-- ⚠ Mot de passe de TOUS les comptes ci-dessous : « Changeme!2026 » — à changer / supprimer avant toute mise en production.
INSERT OR IGNORE INTO projet (id, nom) VALUES ('lyon','Usine de Lyon'), ('grenoble','Usine de Grenoble');

INSERT OR IGNORE INTO type_document (id, nom) VALUES
  ('type-1', 'Documentations constructeurs'),
  ('type-2', 'Plans techniques et nomenclatures'),
  ('type-3', 'Procédures internes / Retours d''expérience (rex)'),
  ('type-4', 'Gammes opératoires'),
  ('type-5', 'Historiques GMAO'),
  ('type-6', 'Rapports d''intervention / Relevés de mesures'),
  ('type-7', 'Sécurité / Rapports réglementaires'),
  ('type-8', 'Document général de maintenance'),
  ('type-9', 'Photographies de terrain');

INSERT OR IGNORE INTO user (id, login, email, password_hash) VALUES ('u-admin-lyon','admin','admin@usine-lyon.fr','pbkdf2$100000$veSH2J8h4Of2HNeApwzoeQ==$3v5SdyDoDdRD2EzgYZyeRgcrTHuYBjre6KEE+UoIbGs=');
INSERT OR IGNORE INTO affecter (user_id, projet_id, role) VALUES ('u-admin-lyon','lyon','Admin');
INSERT OR IGNORE INTO user (id, login, email, password_hash) VALUES ('u-tech-lyon','p.durand','p.durand@usine-lyon.fr','pbkdf2$100000$4etShaLlAP1JEpTPDYavBw==$l/4/E/kL2jnrJ7jcW4tuY1AwaSzOH0of7LZiDzBBNfU=');
INSERT OR IGNORE INTO affecter (user_id, projet_id, role) VALUES ('u-tech-lyon','lyon','Technicien');
INSERT OR IGNORE INTO user (id, login, email, password_hash) VALUES ('u-admin-gre','admin.gre','admin@usine-grenoble.fr','pbkdf2$100000$OS1AAmRsxmKLBCU/Dxr/1g==$XLqv7B6IXMoTJbsKCuLaqH1e6YFD1jU5e65jm9G5EGo=');
INSERT OR IGNORE INTO affecter (user_id, projet_id, role) VALUES ('u-admin-gre','grenoble','Admin');
INSERT OR IGNORE INTO user (id, login, email, password_hash) VALUES ('u-tech-gre','l.bernard','l.bernard@usine-grenoble.fr','pbkdf2$100000$uiNTXxY2qeuJTlD06Y/aOA==$9/QXmPI2Gp4VdMpzZdY0ThQ1bVxUNPLjYzJeGr3H+Vg=');
INSERT OR IGNORE INTO affecter (user_id, projet_id, role) VALUES ('u-tech-gre','grenoble','Technicien');
