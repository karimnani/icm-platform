import { N } from '../node.js';

export const lyon = () => ({
    tpl: 'standard',
    tree: [
      N('s1', 'Site Saint-Priest', 'Site', [
        N('a1', 'Atelier conditionnement', 'Atelier', [
          N('l2', 'Ligne 2', 'Ligne de production', [N('c3', 'Convoyeur C-3', 'Machine'), N('m07', 'Moteur M-07', 'Machine')])
        ]),
        N('a2', 'Utilités', 'Atelier', [N('lu1', 'Ligne fluides', 'Ligne de production', [N('p12', 'Pompe P-12', 'Machine'), N('k4', 'Compresseur K-4', 'Machine'), N('ar2', 'Armoire A2', 'Machine')])])
      ]),
      N('s2', 'Site Corbas', 'Site', [
        N('a3', 'Magasin pièces', 'Atelier', [N('lm1', 'Ligne manutention', 'Ligne de production', [N('ce1', 'Chariot élévateur CE-1', 'Machine')])])
      ])
    ],
    docs: [
      { n: 'Plan général site Saint-Priest.pdf', v: 3, d: '05/10/2026', f: 'PDF', type: "Plans techniques et nomenclatures", node: 's1', q: 'valide', txt: 'implantation ateliers bâtiments accès', ex: ['Plan général', 'Implantation des ateliers conditionnement et utilités, accès pompiers et zones ATEX.'] },
      { n: 'Procédure pompe P-12.pdf', v: 3, d: '12/10/2026', f: 'PDF', type: "Procédures internes / Retours d'expérience (rex)", node: 'p12', q: 'valide', txt: 'graissage paliers graisse EP2 500 heures consignation pompe', ex: ['3. Graissage des paliers', 'Graisser les paliers de la pompe P-12 toutes les 500 heures de fonctionnement avec une graisse de type EP2. Avant toute intervention, appliquer la procédure de consignation.'] },
      { n: 'Fiche consignation pompe P-12.docx', v: 2, d: '08/10/2026', f: 'Word', type: "Sécurité / Rapports réglementaires", node: 'p12', q: 'indexe', txt: 'consignation électrique cadenas sécurité', ex: ['2. Consignation électrique', 'Consigner l’alimentation électrique de la pompe P-12 et poser un cadenas personnel avant toute intervention.'] },
      { n: 'Rapport intervention convoyeur C-3.pdf', v: 1, d: '30/09/2026', f: 'PDF', type: "Rapports d'intervention / Relevés de mesures", node: 'c3', q: 'indexe', txt: 'bruit anormal roulement usé remplacé', ex: ['Intervention du 30/09/2026', 'Bruit anormal relevé côté entraînement, roulement usé remplacé. Essai à vide satisfaisant.'] },
      { n: 'Gamme graissage convoyeur C-3.xlsx', v: 4, d: '21/09/2026', f: 'Excel', type: "Gammes opératoires", node: 'c3', q: 'valide', txt: 'graissage chaîne roulements hebdomadaire', ex: ['Gamme de graissage', 'Chaîne et roulements du convoyeur C-3 : graissage hebdomadaire.'] },
      { n: 'Notice moteur M-07.pdf', v: 1, d: '15/09/2026', f: 'PDF', type: "Documentations constructeurs", node: 'm07', q: 'indexe', txt: 'entraînement convoyeur roulement vibrations démarrage', ex: ['1. Présentation', 'Le moteur M-07 assure l’entraînement du convoyeur C-3.'] },
      { n: 'Manuel compresseur K-4.pdf', v: 2, d: '02/09/2026', f: 'PDF', type: "Documentations constructeurs", node: 'k4', q: 'valide', txt: 'vidange huile filtre pression', ex: ['8. Entretien', 'Vidange et remplacement du filtre à huile toutes les 2 000 heures.'] },
      { n: 'Schéma électrique armoire A2.pdf', v: 3, d: '28/08/2026', f: 'PDF', type: "Plans techniques et nomenclatures", node: 'ar2', q: 'brut', txt: 'disjoncteur alimentation pompe', ex: ['Folio 3', 'Départ moteur de la pompe P-12 protégé par le disjoncteur Q12.'] },
      { n: 'Plan ligne 2.png', v: 1, d: '20/08/2026', f: 'Image', type: "Plans techniques et nomenclatures", node: 'l2', q: 'brut', txt: 'implantation convoyeur moteur', ex: ['Plan de ligne', 'Ligne 2 : convoyeur C-3 entraîné par le moteur M-07.'] }
    ],
    qa: [
      [/pompe|p-12|p12|graiss/, { t: 'Les paliers de la pompe P-12 doivent être graissés toutes les 500 heures de fonctionnement, avec une graisse de type EP2. Appliquez la consignation électrique avant l’intervention.', src: [['Procédure pompe P-12.pdf', 3, 4, '« Graisser les paliers de la pompe P-12 toutes les 500 heures de fonctionnement avec une graisse de type EP2. »'], ['Fiche consignation pompe P-12.docx', 2, 2, '« Consigner l’alimentation électrique et poser un cadenas personnel. »']] }],
      [/convoyeur|c-3|c3|bruit|roulement/, { t: 'Lors de la dernière intervention sur le convoyeur C-3, un bruit anormal côté entraînement était dû à un roulement usé, qui a été remplacé.', src: [['Rapport intervention convoyeur C-3.pdf', 1, 1, '« Bruit anormal relevé côté entraînement, roulement usé remplacé. »']] }],
      [/compresseur|k-4|k4|vidange|huile/, { t: 'La vidange du compresseur K-4 se fait toutes les 2 000 heures, avec remplacement du filtre à huile.', src: [['Manuel compresseur K-4.pdf', 2, 12, '« Vidange et remplacement du filtre à huile toutes les 2 000 heures. »']] }]
    ],
    sugg: ['Quelle est la fréquence de graissage de la pompe P-12 ?', 'Comment consigner la pompe P-12 avant une intervention ?', 'Quelle était la cause du bruit sur le convoyeur C-3 ?', 'Quels roulements remplacer sur le convoyeur C-3 ?', 'Quand faire la vidange du compresseur K-4 ?', 'Quelle graisse utiliser pour la pompe P-12 ?'],
    convQs: [['c1', 'Graissage pompe P-12', "Aujourd'hui", ['Quelle est la fréquence de graissage de la pompe P-12 ?']], ['c2', 'Bruit convoyeur C-3', 'Hier', ['Quelle était la cause du bruit sur le convoyeur C-3 ?']], ['c3', 'Vidange compresseur K-4', '09/10/2026', ['Quand faire la vidange du compresseur K-4 ?']], ['c4', 'Question hors documents', '07/10/2026', ['Quel est le budget maintenance de l’année ?']]],
    crs: [
      { id: 'INT-0142', m: 'c3', d: '09/10/2026', pb: 'Bruit anormal côté entraînement', diag: 'Roulement usé', trav: 'Remplacement du roulement, graissage, essai à vide', h: 1.5, etat: 'Remis en service', by: 'p.durand', st: 'Intégré à la base' },
      { id: 'INT-0139', m: 'p12', d: '02/10/2026', pb: 'Échauffement du palier', diag: 'Graissage insuffisant', trav: 'Graissage EP2, contrôle température', h: 0.5, etat: 'Remis en service', by: 's.leroy', st: 'Intégré à la base' }
    ],
    files: [{ n: 'Procédure pompe P-12.pdf', s: '2,4 Mo', p: 100 }, { n: 'Gamme graissage compresseur K-4.xlsx', s: '0,6 Mo', p: 58 }, { n: 'Photo plaque moteur M-07.jpg', s: '1,1 Mo', p: 12 }],
    fmeta: { 'Procédure pompe P-12.pdf': ["Procédures internes / Retours d'expérience (rex)", 'p12'], 'Gamme graissage compresseur K-4.xlsx': ["Gammes opératoires", 'k4'], 'Photo plaque moteur M-07.jpg': ["Photographies de terrain", 'm07'] },
    val: [
      { id: 1, a: 'Pompe P-12', r: 'utilise', b: 'Graisse EP2', doc: 'Procédure pompe P-12.pdf', v: 3, page: 4, interp: 'La procédure indique l’utilisation d’une graisse EP2 pour le graissage des paliers de la pompe P-12.', know: 'Relation entre l’équipement (Pompe P-12), l’opération (graissage des paliers) et le lubrifiant utilisé (graisse EP2).', st: 'attente', h: ['13/10/2026 14:53 · Proposée par l’IA après intégration'] },
      { id: 2, a: 'Pompe P-12', r: 'nécessite', b: 'Consignation électrique', doc: 'Procédure pompe P-12.pdf', v: 3, page: 4, interp: 'Le document impose une consignation électrique avant toute intervention sur la pompe P-12.', know: 'Prérequis de sécurité associé à l’équipement Pompe P-12.', st: 'attente', h: ['13/10/2026 14:53 · Proposée par l’IA après intégration'] },
      { id: 3, a: 'Bruit anormal', r: 'symptôme de', b: 'Usure roulement', doc: 'Rapport intervention convoyeur C-3.pdf', v: 1, page: 1, interp: 'Le compte rendu associe un bruit côté entraînement à un roulement usé sur le convoyeur C-3.', know: 'Lien symptôme → cause, réutilisable pour diagnostiquer le convoyeur C-3.', st: 'attente', h: ['09/10/2026 17:20 · Proposée par l’IA après intégration'] },
      { id: 4, a: 'Convoyeur C-3', r: 'entraîné par', b: 'Moteur M-07', doc: 'Notice moteur M-07.pdf', v: 1, page: 2, interp: 'La notice précise que le moteur M-07 entraîne le convoyeur C-3.', know: 'Relation fonctionnelle entre deux équipements de la Ligne 2.', st: 'attente', h: ['15/09/2026 10:02 · Proposée par l’IA après intégration'] }
    ],
    stats: { q: 312, s: 221, p: 56, n: 35, jsp: 14, motifs: [24, 11, 9, 3], valB: 27, rejB: 6 },
    top: [['Procédure pompe P-12.pdf', 58], ['Gamme graissage convoyeur C-3.xlsx', 41], ['Manuel compresseur K-4.pdf', 33], ['Rapport intervention convoyeur C-3.pdf', 21]],
    signals: [
      { d: '15/10/2026', q: 'Quel couple de serrage pour le palier de la pompe P-12 ?', e: 'Partiellement', m: 'Information incomplète', src: 'Procédure pompe P-12.pdf · v3 · p. 4', st: 'À analyser' },
      { d: '14/10/2026', q: 'Quelle huile pour le compresseur K-4 ?', e: 'Non, réponse incorrecte', m: 'Source non pertinente ou obsolète', src: 'Manuel compresseur K-4.pdf · v1 · p. 12', st: 'Corrigé (source v2)' }
    ],
    hist: [
      ['13/10/2026 14:58', 'Validation', 'Procédure pompe P-12.pdf', 'Connaissance « Pompe P-12 utilise Graisse EP2 » validée', 'admin', 'Admin'],
      ['12/10/2026 14:52', 'Nouvelle version', 'Procédure pompe P-12.pdf', 'v2 → v3 : graissage passé à 500 h', 'admin', 'Admin'],
      ['12/10/2026 14:50', 'Rattachement', 'Procédure pompe P-12.pdf', 'Type Procédures internes / rex · rattaché à Pompe P-12', 'admin', 'Admin'],
      ['09/10/2026 17:20', 'Intervention', 'INT-0142 Convoyeur C-3', 'Analysée par l’IA et intégrée à la base', 'p.durand', 'Technicien'],
      ['08/10/2026 10:05', 'Arborescence', 'Site Corbas', 'Site ajouté au projet', 'admin', 'Admin'],
      ['30/09/2026 18:10', 'Intégration', 'Rapport intervention convoyeur C-3.pdf', 'Import depuis la GMAO', 'GMAO', 'Automatique']
    ],
    logs: [['16/10/2026 14:58', 0, 'admin', 'Validation', 'Connaissance Pompe P-12 → Graisse EP2', 'Succès'], ['16/10/2026 14:31', 0, 'p.durand', 'Connexion', 'Mot de passe incorrect', 'Échec'], ['16/10/2026 14:29', 0, 'p.durand', 'Connexion', 'Connexion réussie', 'Succès'], ['15/10/2026 09:02', 1, 'j.martin', 'Connexion', 'Connexion réussie', 'Succès'], ['12/10/2026 14:52', 4, 'admin', 'Dépôt', 'Procédure pompe P-12.pdf (v3)', 'Succès'], ['28/09/2026 16:10', 18, 'admin', 'Validation', 'Connaissance Convoyeur C-3 → Moteur M-07', 'Succès']]
});
