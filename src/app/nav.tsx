'use client';

import { ThemeToggle, TopNav } from '@eylulg/ui/chrome';
import Link from 'next/link';

export function Nav() {
  return <TopNav productName='Review Companion' LinkComponent={Link} actions={<ThemeToggle />} />;
}
