export const ROLES = { technicien: 'Technicien', admin: 'Admin' };
export const MAILS = { technicien: 'p.durand@usine-lyon.fr', admin: 'admin@usine-lyon.fr' };
export const TYPES = ["Documentations constructeurs", "Plans techniques et nomenclatures", "Procédures internes / Retours d'expérience (rex)", "Gammes opératoires", "Historiques GMAO", "Rapports d'intervention / Relevés de mesures", "Sécurité / Rapports réglementaires", "Document général de maintenance", "Photographies de terrain"];
export const LEVEL_EX = {
  'Site': ['Plan général du site', 'Arborescence des équipements', 'Consignes générales de sécurité'],
  'Atelier': ['Plan d’atelier', 'Consignes de sécurité de l’atelier'],
  'Ligne de production': ['Plan de ligne', 'Synoptique', 'Gamme de production'],
  'Machine': ['Notice constructeur', 'Procédures et gammes de maintenance', 'Comptes rendus d’intervention', 'Schémas électriques']
};
export const TEMPLATES = {
  standard: { l: 'Site › Atelier › Ligne de production › Machine', levels: [['Site'], ['Atelier'], ['Ligne de production'], ['Machine']] }
};
export const QUAL = { brut: ['Brut', 't-gr'], indexe: ['Indexé', 't-in'], valide: ['Connaissances validées', 't-ok'] };
export const MOTIFS = ['Information incomplète', 'Information erronée', 'Source non pertinente ou obsolète', 'Autre motif'];
export const JSP = { t: 'Je ne sais pas. Aucun document de ce projet ne contient d’information sur cette question.', src: [] };
