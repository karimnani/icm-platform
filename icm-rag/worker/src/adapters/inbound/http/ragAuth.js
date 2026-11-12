import { ApplicationError } from '../../../application/errors.js';
import { clean } from '../../../domain/text/identifiers.js';

/**
 * Contrôle d'accès OPTIONNEL des routes RAG (/ingest /list /delete /purge et chat), activé par la variable Worker RAG_REQUIRE_AUTH = "1".
 * Même jeton que l'API /api/* ; le rôle est celui de la table `affecter` pour le projet visé (Admin requis pour écrire/supprimer).
 */
export function makeRagAuthorize({ repo, crypto: cx, secret, defaultProject }) {
  return async function authorize(request, project, role) {
    const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const p = await cx.verifyToken(token, secret);
    const u = p && await repo.userById(p.uid);
    if (!u || !u.is_active) throw new ApplicationError('Authentification requise : connectez-vous à l’application ICM.', 401);
    const r = await repo.roleOf(u.id, clean(project || defaultProject));
    if (!r) throw new ApplicationError('Accès refusé à ce projet.', 403);
    if (role && r !== role) throw new ApplicationError('Action réservée aux administrateurs du projet.', 403);
  };
}
