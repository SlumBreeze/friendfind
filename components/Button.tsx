import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  fullWidth = false,
  className = '',
  ...props 
}) => {
  const baseStyles = "inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-primary-400 hover:bg-primary-500 text-stone-900 shadow-sm",
    secondary: "bg-stone-200 hover:bg-stone-300 text-stone-800",
    accent: "bg-accent-500 hover:bg-accent-600 text-white shadow-md shadow-accent-500/30",
    outline: "border-2 border-stone-200 hover:border-stone-300 text-stone-600 bg-transparent",
    ghost: "bg-transparent hover:bg-stone-100 text-stone-600",
    danger: "bg-red-100 text-red-600 hover:bg-red-200 border border-red-200"
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-5 py-3 text-base",
    lg: "px-6 py-4 text-lg",
  };

  const width = fullWidth ? "w-full" : "";

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${width} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};