export interface Agent {
  id: string;
  name: string;
  title: string;
  bio: string;
  avatarType: 'sphere' | 'shield' | 'lattice' | 'rocket' | 'lightning' | 'wave' | 'placeholder';
}
