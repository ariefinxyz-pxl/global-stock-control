import { BedDouble, Coffee, Package, Presentation, Shirt, SprayCan, Wrench } from 'lucide-react';

const MAP = {
  cafe: Coffee,
  'daily-hk': SprayCan,
  linen: BedDouble,
  engineering: Wrench,
  meeting: Presentation,
  uniform: Shirt,
};

export function CategoryIcon({ kategori, className }) {
  const Icon = MAP[kategori] || Package;
  return <Icon className={className} />;
}
