/** Erreur métier portant le statut HTTP à restituer. */
export class ApplicationError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = 'ApplicationError';
    this.status = status;
  }
}
