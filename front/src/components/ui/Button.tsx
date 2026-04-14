import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'default', size = 'default', ...props }, ref) => {
    let variantStyles = '';
    switch (variant) {
      case 'default':
        variantStyles = 'bg-primary text-white hover:bg-primary/90';
        break;
      case 'outline':
        variantStyles = 'border border-border bg-transparent hover:bg-white/5';
        break;
      case 'ghost':
        variantStyles = 'hover:bg-white/10 hover:text-white';
        break;
      case 'link':
        variantStyles = 'text-primary underline-offset-4 hover:underline';
        break;
    }

    let sizeStyles = '';
    switch (size) {
      case 'default':
        sizeStyles = 'h-10 px-4 py-2';
        break;
      case 'sm':
        sizeStyles = 'h-9 rounded-md px-3';
        break;
      case 'lg':
        sizeStyles = 'h-11 rounded-md px-8';
        break;
      case 'icon':
        sizeStyles = 'h-10 w-10';
        break;
    }

    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 ${variantStyles} ${sizeStyles} ${className}`}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
