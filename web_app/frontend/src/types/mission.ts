export interface Mission {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'aborted';
  createdAt?: string;
  updatedAt?: string;
}
