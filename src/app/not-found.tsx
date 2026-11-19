import Link from 'next/link';
import { LINK_CLASS } from '@/components/styles';

export default function NotFound() {
  return (
    <div className='mx-auto flex max-w-xl flex-col items-start gap-4 py-16'>
      <h1 className='text-display-xs font-semibold text-primary'>Page not found</h1>
      <p className='text-md text-tertiary'>There is nothing at this address.</p>
      <Link className={LINK_CLASS} href='/'>
        Back to Review Companion
      </Link>
    </div>
  );
}
