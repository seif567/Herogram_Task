import React from 'react';
import clsx from 'clsx';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary'|'ghost'|'outline'
}

export default function Button({variant='primary', className, children, ...rest}:Props){
  const base = "inline-flex items-center justify-center px-4 py-2 rounded-xl font-medium shadow-sm transition";
  const styles = {
    primary: "bg-brand-500 text-white hover:bg-brand-700",
    ghost: "bg-white border border-transparent hover:bg-neutral-100",
    outline: "bg-transparent border border-neutral-200 text-neutral-700"
  }
  return <button className={clsx(base, styles[variant], className)} {...rest}>{children}</button>;
}
