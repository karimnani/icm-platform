import { N } from '../node.js';

export const grenoble = () => ({
    tpl: 'standard',
    tree: [
      N('g1', 'Site Échirolles', 'Site', [
        N('ga1', 'Atelier extrusion', 'Atelier', [N('gl1', 'Ligne extrusion 1', 'Ligne de production', [N('e1', 'Extrudeuse E-1', 'Machine'), N('r3', 'Refroidisseur R-3', 'Machine')]), N('gl2', 'Ligne extrusion 2', 'Ligne de production', [N('e2', 'Extrudeuse E-2', 'Machine')])]),
        N('ga2', 'Atelier broyage', 'Atelier', [N('gl3', 'Ligne broyage', 'Ligne de production', [N('b2', 'Broyeur B-2', 'Machine')])]),
        N('ga3', 'Chaufferie', 'Atelier', [N('gl4', 'Ligne vapeur', 'Ligne de production', [N('ch1', 'Chaudière CH-1', 'Machine')])])
      ])
    ],
    docs: [
      { n: 'Plan général site Échirolles.pdf', v: 1, d: '01/10/2026', f: 'PDF', type: "Plans techniques et nomenclatures", node: 'g1', q: 'indexe', txt: 'implantation ateliers', ex: ['Plan général', 'Ateliers extrusion, broyage et chaufferie.'] },
      { n: 'Procédure démarrage extrudeuse E-1.pdf', v: 2, d: '11/10/2026', f: 'PDF', type: "Procédures internes / Retours d'expérience (rex)", node: 'e1', q: 'valide', txt: 'démarrage préchauffage température 220 °C vis fourreau', ex: ['2. Démarrage à froid', 'Préchauffer le fourreau de l’extrudeuse E-1 jusqu’à 220 °C pendant 45 minutes avant de lancer la vis.'] },
      { n: 'Consignes sécurité broyeur B-2.docx', v: 1, d: '08/10/2026', f: 'Word', type: "Sécurité / Rapports réglementaires", node: 'b2', q: 'indexe', txt: 'arrêt d’urgence trémie lames protection', ex: ['1. Avant toute intervention', 'Couper l’alimentation, attendre l’arrêt complet des lames et verrouiller la trappe de la trémie.'] },
      { n: 'Rapport intervention broyeur B-2.pdf', v: 1, d: '03/10/2026', f: 'PDF', type: "Rapports d'intervention / Relevés de mesures", node: 'b2', q: 'indexe', txt: 'lames émoussées remplacées bourrage', ex: ['Intervention du 03/10/2026', 'Bourrages répétés : lames émoussées remplacées, jeu réglé à 0,3 mm.'] },
      { n: 'Manuel chaudière CH-1.pdf', v: 3, d: '25/09/2026', f: 'PDF', type: "Documentations constructeurs", node: 'ch1', q: 'brut', txt: 'pression brûleur ramonage contrôle annuel', ex: ['6. Entretien', 'Contrôler la pression de service (6 bar) chaque semaine et faire ramoner la chaudière CH-1 une fois par an.'] }
    ],
    qa: [
      [/extrud|e-1|e1|démarr|préchauff|temp/, { t: 'Avant de lancer la vis de l’extrudeuse E-1, préchauffez le fourreau jusqu’à 220 °C pendant 45 minutes.', src: [['Procédure démarrage extrudeuse E-1.pdf', 2, 3, '« Préchauffer le fourreau de l’extrudeuse E-1 jusqu’à 220 °C pendant 45 minutes avant de lancer la vis. »']] }],
      [/broyeur|b-2|b2|lame|bourr/, { t: 'Les bourrages répétés du broyeur B-2 venaient de lames émoussées. Elles ont été remplacées et le jeu réglé à 0,3 mm.', src: [['Rapport intervention broyeur B-2.pdf', 1, 1, '« Bourrages répétés : lames émoussées remplacées, jeu réglé à 0,3 mm. »']] }],
      [/chaudi|ch-1|ch1|pression|ramon/, { t: 'La pression de service de la chaudière CH-1 est de 6 bar, à contrôler chaque semaine. Le ramonage est annuel.', src: [['Manuel chaudière CH-1.pdf', 3, 22, '« Contrôler la pression de service (6 bar) chaque semaine et faire ramoner la chaudière CH-1 une fois par an. »']] }]
    ],
    sugg: ['Quelle température de préchauffage pour l’extrudeuse E-1 ?', 'Comment démarrer l’extrudeuse E-1 à froid ?', 'Pourquoi le broyeur B-2 se bourre-t-il ?', 'Quand changer les lames du broyeur B-2 ?', 'Quelle est la pression de service de la chaudière CH-1 ?'],
    convQs: [['c1', 'Préchauffage extrudeuse E-1', "Aujourd'hui", ['Quelle température de préchauffage pour l’extrudeuse E-1 ?']], ['c2', 'Bourrage broyeur B-2', '10/10/2026', ['Pourquoi le broyeur B-2 se bourre-t-il ?']]],
    crs: [{ id: 'INT-0021', m: 'b2', d: '03/10/2026', pb: 'Bourrages répétés', diag: 'Lames émoussées', trav: 'Remplacement des lames, réglage du jeu à 0,3 mm', h: 2, etat: 'Remis en service', by: 'l.bernard', st: 'Intégré à la base' }],
    files: [{ n: 'Procédure démarrage extrudeuse E-1.pdf', s: '1,8 Mo', p: 100 }],
    fmeta: { 'Procédure démarrage extrudeuse E-1.pdf': ["Procédures internes / Retours d'expérience (rex)", 'e1'] },
    val: [
      { id: 1, a: 'Extrudeuse E-1', r: 'nécessite', b: 'Préchauffage 220 °C', doc: 'Procédure démarrage extrudeuse E-1.pdf', v: 2, page: 3, interp: 'La procédure impose un préchauffage du fourreau à 220 °C pendant 45 minutes avant le démarrage.', know: 'Condition de démarrage associée à l’équipement Extrudeuse E-1.', st: 'attente', h: ['11/10/2026 10:14 · Proposée par l’IA après intégration'] },
      { id: 2, a: 'Lames émoussées', r: 'cause de', b: 'Bourrage', doc: 'Rapport intervention broyeur B-2.pdf', v: 1, page: 1, interp: 'Le compte rendu relie les bourrages répétés à l’usure des lames du broyeur B-2.', know: 'Lien cause → panne pour le broyeur B-2.', st: 'attente', h: ['03/10/2026 16:40 · Proposée par l’IA après intégration'] }
    ],
    stats: { q: 64, s: 41, p: 15, n: 8, jsp: 6, motifs: [9, 4, 3, 2], valB: 5, rejB: 1 },
    top: [['Procédure démarrage extrudeuse E-1.pdf', 22], ['Rapport intervention broyeur B-2.pdf', 14], ['Manuel chaudière CH-1.pdf', 9]],
    signals: [{ d: '13/10/2026', q: 'Quelle pression maximale pour la chaudière CH-1 ?', e: 'Partiellement', m: 'Information incomplète', src: 'Manuel chaudière CH-1.pdf · v3 · p. 22', st: 'À analyser' }],
    hist: [
      ['11/10/2026 10:12', 'Nouvelle version', 'Procédure démarrage extrudeuse E-1.pdf', 'v1 → v2 : préchauffage porté à 45 minutes', 'admin', 'Admin'],
      ['08/10/2026 09:30', 'Intégration', 'Consignes sécurité broyeur B-2.docx', 'Nouveau document · rattaché à Broyeur B-2', 'admin', 'Admin'],
      ['03/10/2026 16:35', 'Intervention', 'INT-0021 Broyeur B-2', 'Analysée par l’IA et intégrée à la base', 'l.bernard', 'Technicien'],
      ['01/10/2026 08:00', 'Arborescence', 'Site Échirolles', 'Arborescence importée depuis Excel', 'admin', 'Admin']
    ],
    logs: [['16/10/2026 08:12', 0, 'l.bernard', 'Connexion', 'Connexion réussie', 'Succès'], ['11/10/2026 10:12', 5, 'admin', 'Dépôt', 'Procédure démarrage extrudeuse E-1.pdf (v2)', 'Succès'], ['10/10/2026 07:55', 6, 'c.roux', 'Connexion', 'Mot de passe incorrect', 'Échec']]
});
