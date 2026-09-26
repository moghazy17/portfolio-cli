export type CvSyncErrorCode =
  | 'NO_INPUT'
  | 'UNREADABLE'
  | 'EXTRACTION_FAILED'
  | 'INVALID_RESULT';

export class CvSyncError extends Error {
  constructor(
    public readonly code: CvSyncErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'CvSyncError';
  }
}
