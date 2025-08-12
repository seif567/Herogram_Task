import React from 'react';

export default React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(props, ref){
  return <input ref={ref} {...props} className="w-full px-4 py-2 rounded-lg border border-neutral-200 focus:ring-2 focus:ring-brand-300 outline-none" />;
});
